import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressService, PROGRESS_STORAGE_KEY, createRunId } from '../src/services/progressService.js';
import { createStorage } from '../src/services/localStorageService.js';
import { createAuthService } from '../src/services/authService.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const runInput = (overrides = {}) => ({ levelId: 1, durationMs: 18000, mistakes: 0, hintsUsed: 0, ...overrides });
const memoryStorage = () => {
  const values = new Map();
  return createStorage({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });
};
const noAuth = { onChange: () => () => {}, ensureSession: async () => null };
const localService = (storage = memoryStorage()) => new ProgressService({ configured: false, client: null, auth: noAuth, storage, configurationError: '' });

function fakeCloud() {
  const database = { profiles: [], level_progress: [], runs: [] };
  const controls = { failProgress: false, owner: A, maxHints: 6 };
  const client = {
    from(table) {
      let action = 'select';
      let payload;
      let options;
      const predicates = [];
      let single = false;
      let range = null;
      const query = {
        select() { return query; },
        eq(key, value) { predicates.push([key, value]); return query; },
        order() { return query; },
        limit() { return query; },
        range(start, end) { range = [start, end]; return query; },
        maybeSingle() { single = true; return query; },
        upsert(input, config) { action = 'upsert'; payload = Array.isArray(input) ? input : [input]; options = config; return query; },
        then(resolve, reject) {
          try {
            if (action === 'select') {
              let rows = database[table].filter((row) => predicates.every(([key, value]) => row[key] === value));
              if (range) rows = rows.slice(range[0], range[1] + 1);
              resolve({ data: single ? rows[0] || null : structuredClone(rows), error: null });
              return;
            }
            if (table === 'level_progress' && controls.failProgress) {
              resolve({ data: null, error: new Error('fetch failed') });
              return;
            }
            if (table === 'runs' && payload.some((row) => row.hints_used > controls.maxHints)) {
              resolve({ data: null, error: new Error('new row violates check constraint runs_hints_used_check') });
              return;
            }
            for (const row of payload) {
              assert.equal(row.user_id ?? row.id, controls.owner, 'all writes belong to the authenticated owner');
              const keys = options.onConflict.split(',');
              const existing = database[table].find((candidate) => keys.every((key) => row[key] === candidate[key]));
              if (existing) {
                if (!options.ignoreDuplicates) Object.assign(existing, structuredClone(row));
              } else database[table].push(structuredClone(row));
            }
            resolve({ data: null, error: null });
          } catch (error) { reject(error); }
        },
      };
      return query;
    },
  };
  const auth = { onChange: () => () => {}, ensureSession: async () => ({ user: { id: controls.owner } }) };
  return { client, auth, controls, database };
}

test('local completion survives reload, unlocks next level, and preserves best run', async () => {
  const storage = memoryStorage();
  const service = localService(storage);
  await service.init();
  await service.setNickname('Тестер');
  const first = await service.completeLevel(runInput());
  assert.equal(first.stars, 3);
  assert.equal(service.isUnlocked(2), true);
  assert.equal(service.isUnlocked(3), false);
  await service.completeLevel(runInput({ durationMs: 22000, mistakes: 7, hintsUsed: 2 }));
  const restored = localService(storage);
  assert.equal(restored.getState().nickname, 'Тестер');
  assert.equal(restored.getState().progress[1].best_stars, 3);
  assert.equal(restored.getState().progress[1].best_time_ms, 18000);
  assert.equal(restored.getState().runs.length, 2);
  assert.equal(restored.getState().pendingCount, 2);
  assert.equal(restored.getState().status, 'local');
  assert.match(restored.getState().message, /локально/);
  service.dispose();
});

test('locked level, malformed result and unsafe nickname are rejected', async () => {
  const service = localService();
  await assert.rejects(service.completeLevel(runInput({ levelId: 3 })), /предыдущий/);
  await assert.rejects(service.completeLevel(runInput({ durationMs: -1 })), /Некорректное/);
  await assert.rejects(service.completeLevel(runInput({ hintsUsed: 7 })), /не более шести/);
  await assert.rejects(service.setNickname('<img>'), /буквы/);
  assert.equal(service.getState().runs.length, 0);
});

test('blocked storage stays playable and honestly warns about memory-only state', async () => {
  const blocked = createStorage({ setItem() { throw new Error('denied'); } });
  const service = localService(blocked);
  await service.completeLevel(runInput());
  assert.equal(service.getState().storagePersistent, false);
  assert.match(service.getState().message, /до закрытия вкладки/);
});

test('partial cloud failure retries UUIDs without duplicating immutable history', async () => {
  const cloud = fakeCloud();
  cloud.controls.failProgress = true;
  const service = new ProgressService({ ...cloud, configured: true, storage: memoryStorage(), configurationError: '' });
  await service.setNickname('Тестер');
  await service.sync();
  await service.completeLevel(runInput());
  await service.sync();
  assert.equal(cloud.database.runs.length, 1);
  assert.equal(service.getState().pendingCount, 1);
  assert.equal(service.getState().status, 'local');
  cloud.controls.failProgress = false;
  await service.sync();
  assert.equal(cloud.database.runs.length, 1);
  assert.equal(service.getState().pendingCount, 0);
  assert.equal(service.getState().status, 'cloud');
  assert.equal(cloud.database.level_progress[0].best_stars, 3);
});

test('offline guest is claimed once; replacing authenticated identity isolates all data', async () => {
  const storage = memoryStorage();
  const offline = localService(storage);
  await offline.setNickname('Гость');
  await offline.completeLevel(runInput());
  const cloud = fakeCloud();
  const service = new ProgressService({ ...cloud, configured: true, storage, configurationError: '' });
  await service.sync();
  assert.equal(cloud.database.runs[0].user_id, A);
  cloud.controls.owner = B;
  await service.sync();
  assert.equal(service.getState().runs.length, 0);
  assert.equal(service.getState().pendingCount, 0);
  assert.equal(service.isUnlocked(2), false);
  assert.equal(service.getState().nickname, '');
  assert.equal(cloud.database.runs.length, 1);
  assert.equal(storage.read(PROGRESS_STORAGE_KEY).buckets[A].runs.length, 1);
  assert.equal(storage.read(PROGRESS_STORAGE_KEY).buckets[B].runs.length, 0);
});

test('cloud progress is merged and a worse local replay cannot overwrite it', async () => {
  const cloud = fakeCloud();
  cloud.database.profiles.push({ id: A, nickname: 'Облако' });
  cloud.database.level_progress.push({ user_id: A, level_id: 1, best_time_ms: 5000, best_errors: 0, best_stars: 3, completed_at: '2026-01-01T00:00:00Z' });
  const service = new ProgressService({ ...cloud, configured: true, storage: memoryStorage(), configurationError: '' });
  await service.sync();
  assert.equal(service.getState().nickname, 'Облако');
  await service.completeLevel(runInput({ mistakes: 4, hintsUsed: 2 }));
  await service.sync();
  assert.equal(cloud.database.level_progress[0].best_stars, 3);
  assert.equal(cloud.database.level_progress[0].best_time_ms, 5000);
});


test('run UUID generation works without secure-context randomUUID', () => {
  const id = createRunId({ getRandomValues(bytes) { bytes.fill(7); return bytes; } });
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(createRunId(null), createRunId(null));
});

test('two offline tabs merge immutable runs instead of overwriting pending results', async () => {
  const storage = memoryStorage();
  const first = localService(storage);
  const second = localService(storage);
  await first.completeLevel(runInput());
  await second.completeLevel(runInput({ durationMs: 9000 }));
  const restored = localService(storage);
  assert.equal(restored.getState().runs.length, 2);
  assert.equal(restored.getState().pendingCount, 2);
  assert.equal(restored.getState().progress[1].best_time_ms, 9000);
});

test('acknowledged run IDs prevent stale tabs resurrecting already-synced queues', async () => {
  const storage = memoryStorage();
  const cloud = fakeCloud();
  const first = new ProgressService({ ...cloud, configured: true, storage, configurationError: '' });
  await first.setNickname('Тестер');
  await first.sync();
  await first.completeLevel(runInput());
  await first.sync();
  const stale = localService(storage);
  stale.bucket.pending = [stale.bucket.runs[0].id];
  stale.bucket.acknowledged = [];
  stale.persist();
  assert.equal(stale.getState().pendingCount, 0);
  assert.equal(localService(storage).getState().pendingCount, 0);
  assert.equal(cloud.database.runs.length, 1);
});

test('all cloud history pages are loaded and orphaned history repairs progress', async () => {
  const cloud = fakeCloud();
  cloud.database.profiles.push({ id: A, nickname: 'История' });
  for (let index = 0; index < 505; index += 1) {
    cloud.database.runs.push({ id: `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, '0')}`, user_id: A, level_id: 1, duration_ms: index + 1000, mistakes: 0, hints_used: 0, completed_at: '2026-01-01T00:00:00Z' });
  }
  const service = new ProgressService({ ...cloud, configured: true, storage: memoryStorage(), configurationError: '' });
  await service.sync();
  assert.equal(service.getState().runs.length, 505);
  assert.equal(service.getState().progress[1].best_time_ms, 1000);
  assert.equal(cloud.database.level_progress[0].best_stars, 3);
});

test('corrupt localStorage buckets and records do not prevent startup', () => {
  const storage = memoryStorage();
  storage.write(PROGRESS_STORAGE_KEY, { version: 2, activeOwner: 'guest', buckets: { guest: { nickname: 'Тестер', runs: [null, {}], progress: { 1: null, 2: {} } }, [A]: null } });
  const service = localService(storage);
  assert.equal(service.getState().nickname, 'Тестер');
  assert.equal(service.getState().runs.length, 0);
});

test('a stale guest tab cannot transfer a previously claimed guest history to a new identity', async () => {
  const storage = memoryStorage();
  const guest = localService(storage);
  await guest.setNickname('Гость');
  await guest.completeLevel(runInput());
  const staleGuest = localService(storage);
  const firstCloud = fakeCloud();
  const ownerA = new ProgressService({ ...firstCloud, configured: true, storage, configurationError: '' });
  await ownerA.sync();
  assert.equal(storage.read(PROGRESS_STORAGE_KEY).claimedGuestBy, A);
  staleGuest.persist();
  assert.equal(storage.read(PROGRESS_STORAGE_KEY).buckets.guest, undefined);
  const secondCloud = fakeCloud();
  secondCloud.controls.owner = B;
  const ownerB = new ProgressService({ ...secondCloud, configured: true, storage, configurationError: '' });
  await ownerB.sync();
  assert.equal(ownerB.getState().runs.length, 0);
  assert.equal(secondCloud.database.runs.length, 0);
  assert.equal(storage.read(PROGRESS_STORAGE_KEY).buckets[A].runs.length, 1);
});


test('concurrent auth requests create only one anonymous session', async () => {
  let created = 0;
  const session = { user: { id: A } };
  const auth = createAuthService({ auth: {
    async getSession() { return { data: { session: null }, error: null }; },
    async signInAnonymously() { created += 1; return { data: { session }, error: null }; },
  } });
  const results = await Promise.all([auth.ensureSession(), auth.ensureSession(), auth.ensureSession()]);
  assert.equal(created, 1);
  assert.ok(results.every((result) => result.user.id === A));
});


test('three terminals allow up to six hints and retain queued results after reload', async () => {
  const storage = memoryStorage();
  const offline = localService(storage);
  await offline.setNickname('ТриТерминала');
  const result = await offline.completeLevel(runInput({ hintsUsed: 6 }));
  assert.equal(result.stars, 1);
  const restored = localService(storage);
  assert.equal(restored.getState().runs[0].hints_used, 6);
  assert.equal(restored.getState().pendingCount, 1);
  const cloud = fakeCloud();
  const online = new ProgressService({ ...cloud, configured: true, storage, configurationError: '' });
  await online.sync();
  assert.equal(cloud.database.runs[0].hints_used, 6);
  assert.equal(online.getState().pendingCount, 0);
  assert.equal(online.getState().status, 'cloud');
});

test('three to six hints are valid but the seventh is rejected before saving', async () => {
  const service = localService();
  for (const hintsUsed of [3, 4, 5, 6]) {
    const run = await service.completeLevel(runInput({ hintsUsed }));
    assert.equal(run.hints_used, hintsUsed);
    assert.equal(run.stars, 1);
  }
  await assert.rejects(service.completeLevel(runInput({ hintsUsed: 7 })), /не более шести/);
  assert.equal(service.getState().runs.length, 4);
});


test('an old cloud hints constraint retains the run until the database upgrade succeeds', async () => {
  const storage = memoryStorage();
  const offline = localService(storage);
  await offline.setNickname('Миграция');
  await offline.completeLevel(runInput({ hintsUsed: 6 }));
  const cloud = fakeCloud();
  cloud.controls.maxHints = 2;
  const service = new ProgressService({ ...cloud, configured: true, storage, configurationError: '' });
  await service.sync();
  assert.equal(service.getState().status, 'local');
  assert.equal(service.getState().pendingCount, 1);
  assert.match(service.getState().message, /upgrade-three-puzzles\.sql/);
  cloud.controls.maxHints = 6;
  await service.sync();
  assert.equal(service.getState().status, 'cloud');
  assert.equal(service.getState().pendingCount, 0);
  assert.equal(cloud.database.runs.length, 1);
});
