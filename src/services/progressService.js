import { supabase, supabaseConfigured, supabaseConfigurationError } from './supabaseClient.js';
import { authService } from './authService.js';
import { localStorageService } from './localStorageService.js';
import { calculateStars, improveProgress } from '../utils/score.js';
import { validateNickname, validateRun } from '../utils/validators.js';

export const PROGRESS_STORAGE_KEY = 'error404.progress.v2';
const clone = (value) => JSON.parse(JSON.stringify(value));
const newBucket = () => ({ nickname: '', profileDirty: false, nicknameUpdatedAt: 0, nicknameSyncedAt: 0, progress: {}, runs: [], pending: [], acknowledged: [] });
const newStore = () => ({ version: 2, activeOwner: 'guest', claimedGuestBy: null, buckets: { guest: newBucket() } });
const isUUID = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
export function createRunId(cryptoProvider = globalThis.crypto) {
  if (typeof cryptoProvider?.randomUUID === 'function') return cryptoProvider.randomUUID();
  // getRandomValues also works on HTTP LAN previews, where randomUUID may be absent.
  const bytes = new Uint8Array(16);
  if (typeof cryptoProvider?.getRandomValues === 'function') cryptoProvider.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validStoredRun(run) {
  try {
    validateRun({ levelId: run.level_id, durationMs: run.duration_ms, mistakes: run.mistakes, hintsUsed: run.hints_used });
    return isUUID(run.id) && Number.isFinite(Date.parse(run.completed_at));
  } catch { return false; }
}

function restoreStore(input) {
  if (input?.version !== 2 || !input.buckets || typeof input.buckets !== 'object' || !Object.hasOwn(input.buckets, input.activeOwner)) return newStore();
  const result = newStore();
  result.buckets = {};
  result.claimedGuestBy = isUUID(input.claimedGuestBy) ? input.claimedGuestBy : null;
  for (const [owner, source] of Object.entries(input.buckets)) {
    if (owner !== 'guest' && !isUUID(owner)) continue;
    if (!source || typeof source !== 'object') continue;
    const bucket = newBucket();
    const nickname = validateNickname(source.nickname);
    bucket.nickname = nickname.valid ? nickname.value : '';
    bucket.nicknameUpdatedAt = Number.isFinite(source.nicknameUpdatedAt) ? source.nicknameUpdatedAt : (source.profileDirty ? 1 : 0);
    bucket.nicknameSyncedAt = Number.isFinite(source.nicknameSyncedAt) ? source.nicknameSyncedAt : 0;
    bucket.profileDirty = bucket.nicknameUpdatedAt > bucket.nicknameSyncedAt;
    bucket.acknowledged = Array.isArray(source.acknowledged) ? [...new Set(source.acknowledged.filter(isUUID))] : [];
    bucket.runs = Array.isArray(source.runs) ? source.runs.filter(validStoredRun) : [];
    bucket.pending = Array.isArray(source.pending) ? source.pending.filter((id) => bucket.runs.some((run) => run.id === id) && !bucket.acknowledged.includes(id)) : [];
    for (const run of bucket.runs) bucket.progress[run.level_id] = improveProgress(bucket.progress[run.level_id], run);
    for (const [level, progress] of Object.entries(source.progress || {})) {
      if (!progress || typeof progress !== 'object') continue;
      if (+level < 1 || +level > 5 || !Number.isInteger(+level)) continue;
      if (![progress.best_time_ms, progress.best_errors, progress.best_stars].every(Number.isInteger)) continue;
      if (progress.best_time_ms < 0 || progress.best_errors < 0 || progress.best_stars < 1 || progress.best_stars > 3) continue;
      bucket.progress[level] = mergeProgress(bucket.progress[level], { ...progress, level_id: +level });
    }
    result.buckets[owner] = bucket;
  }
  result.activeOwner = Object.hasOwn(result.buckets, input.activeOwner) ? input.activeOwner : 'guest';
  result.buckets[result.activeOwner] ||= newBucket();
  return result;
}

function mergeBuckets(target, source) {
  if (source.nicknameUpdatedAt > target.nicknameUpdatedAt || (!target.nickname && source.nickname)) {
    target.nickname = source.nickname;
    target.nicknameUpdatedAt = source.nicknameUpdatedAt;
  }
  target.nicknameSyncedAt = Math.max(target.nicknameSyncedAt, source.nicknameSyncedAt);
  target.profileDirty = target.nicknameUpdatedAt > target.nicknameSyncedAt;
  const runs = new Map(target.runs.map((run) => [run.id, run]));
  for (const run of source.runs) if (!runs.has(run.id)) runs.set(run.id, run);
  target.runs = [...runs.values()].sort((a, b) => b.completed_at.localeCompare(a.completed_at) || b.id.localeCompare(a.id));
  target.acknowledged = [...new Set([...target.acknowledged, ...source.acknowledged])];
  const acknowledged = new Set(target.acknowledged);
  target.pending = [...new Set([...target.pending, ...source.pending])].filter((id) => !acknowledged.has(id));
  for (const [level, progress] of Object.entries(source.progress)) target.progress[level] = mergeProgress(target.progress[level], progress);
}

export function mergeProgress(a, b) {
  if (!a) return { ...b };
  if (!b) return { ...a };
  return {
    level_id: b.level_id ?? a.level_id,
    best_time_ms: Math.min(a.best_time_ms, b.best_time_ms),
    best_errors: Math.min(a.best_errors, b.best_errors),
    best_stars: Math.max(a.best_stars, b.best_stars),
    completed_at: a.completed_at < b.completed_at ? a.completed_at : b.completed_at,
  };
}

function failureMessage(error) {
  const raw = String(error?.message || error || 'неизвестная ошибка');
  if (/captcha|turnstile|hcaptcha/i.test(raw)) return 'Supabase требует CAPTCHA для анонимного входа. Настройте CAPTCHA в Authentication либо отключите её для закрытого тестового проекта.';
  if (/runs_hints_used_check|hints_used.*constraint|constraint.*hints_used/i.test(raw)) return 'Обновите ограничение подсказок: выполните supabase/upgrade-three-puzzles.sql в SQL Editor.';
  if (/rate.limit|too many|429/i.test(raw)) return 'Достигнут лимит анонимных входов Supabase. Результаты сохранены локально; повторите синхронизацию позже.';
  if (/anonymous|sign.?up.*disabled/i.test(raw)) return 'Включите Anonymous Sign-Ins в настройках Authentication вашего Supabase.';
  if (/relation.*does not exist|schema cache|Could not find the table/i.test(raw)) return 'Выполните supabase/setup.sql в SQL Editor вашего Supabase.';
  if (/row.level|permission denied|42501/i.test(raw)) return 'Проверьте SQL-политики RLS и принадлежность записей текущей сессии.';
  if (/fetch|network|abort|timeout/i.test(raw)) return 'Нет связи с Supabase. Повторная синхронизация произойдёт при следующем сохранении или восстановлении сети.';
  return `Облачное сохранение недоступно: ${raw.slice(0, 180)}`;
}

export class ProgressService {
  constructor({ client = supabase, auth = authService, storage = localStorageService, configured = supabaseConfigured, configurationError = supabaseConfigurationError } = {}) {
    this.client = client;
    this.auth = auth;
    this.storage = storage;
    this.configured = configured;
    this.configurationError = configurationError;
    this.data = restoreStore(storage.read(PROGRESS_STORAGE_KEY));
    this.status = 'local';
    this.detail = configurationError || (configured ? '' : 'Демо-режим: Supabase не настроен.');
    this.listeners = new Set();
    this.syncPromise = null;
    this.syncAgain = false;
    this.initialized = false;
    this.ownerGeneration = 0;
  }

  get bucket() { return this.data.buckets[this.data.activeOwner]; }

  getState() {
    let message;
    if (!this.storage.persistent && this.status !== 'cloud') message = 'Хранилище браузера недоступно: прогресс останется только до закрытия вкладки.';
    else if (this.status === 'syncing') message = 'Синхронизация...';
    else if (this.status === 'cloud') message = 'Прогресс сохранён в облаке';
    else message = `Прогресс сохранён локально${this.detail ? ` · ${this.detail}` : ''}`;
    return clone({
      nickname: this.bucket.nickname,
      progress: this.bucket.progress,
      runs: this.bucket.runs.map((run) => ({ ...run, stars: calculateStars(run.mistakes, run.hints_used) })),
      status: this.status,
      message,
      cloudConfigured: this.configured,
      pendingCount: this.bucket.pending.length,
      storagePersistent: this.storage.persistent,
    });
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try { listener(state); } catch (error) { console.error('Ошибка интерфейса сохранения', error); }
    }
  }

  mergeStored() {
    // Another offline tab may have completed a run since this instance last read.
    // Union immutable UUIDs before writing; acknowledged UUIDs prevent stale
    // snapshots from resurrecting successfully synchronized queue entries.
    const latest = restoreStore(this.storage.read(PROGRESS_STORAGE_KEY));
    const guestOwner = this.data.claimedGuestBy || latest.claimedGuestBy;
    this.data.claimedGuestBy = guestOwner;
    if (guestOwner && this.data.buckets.guest) {
      const target = this.data.buckets[guestOwner] ||= newBucket();
      mergeBuckets(target, this.data.buckets.guest);
      target.runs = target.runs.map((run) => ({ ...run, user_id: guestOwner }));
      delete this.data.buckets.guest;
      if (this.data.activeOwner === 'guest') {
        this.data.activeOwner = guestOwner;
        this.ownerGeneration += 1;
      }
    }
    for (const [owner, source] of Object.entries(latest.buckets)) {
      const targetOwner = owner === 'guest' && guestOwner ? guestOwner : owner;
      const target = this.data.buckets[targetOwner] ||= newBucket();
      mergeBuckets(target, source);
      if (owner === 'guest' && guestOwner) target.runs = target.runs.map((run) => ({ ...run, user_id: guestOwner }));
    }
  }

  persist() {
    this.mergeStored();
    this.storage.write(PROGRESS_STORAGE_KEY, this.data);
  }

  async init() {
    if (this.initialized) return this.getState();
    this.initialized = true;
    this.onlineListener = () => { void this.sync(); };
    this.storageListener = (event) => {
      if (event.key === PROGRESS_STORAGE_KEY && event.newValue) {
        this.mergeStored();
        this.notify();
      }
    };
    globalThis.addEventListener?.('storage', this.storageListener);
    globalThis.addEventListener?.('online', this.onlineListener);
    this.unsubscribeAuth = this.auth.onChange?.((session) => {
      if (session?.user?.id && session.user.id !== this.data.activeOwner) this.adoptOwner(session.user.id);
    });
    this.persist();
    this.notify();
    // Start in the background so an unavailable network never blocks the title screen.
    if (this.configured) void this.sync();
    return this.getState();
  }

  dispose() {
    globalThis.removeEventListener?.('online', this.onlineListener);
    globalThis.removeEventListener?.('storage', this.storageListener);
    this.unsubscribeAuth?.();
    this.listeners.clear();
    this.initialized = false;
  }

  adoptOwner(owner) {
    this.mergeStored();
    if (!isUUID(owner)) throw new Error('Supabase вернул некорректный идентификатор пользователя.');
    if (this.data.activeOwner === owner) return;
    const previous = this.data.activeOwner;
    if (previous === 'guest') {
      // A never-authenticated local guest may be claimed exactly once. A bucket
      // already tied to any UUID is never transferred to another identity.
      const guest = this.bucket;
      const target = this.data.buckets[owner] || newBucket();
      for (const run of guest.runs) {
        if (!target.runs.some((existing) => existing.id === run.id)) target.runs.push({ ...run, user_id: owner });
      }
      target.pending = [...new Set([...target.pending, ...guest.pending])];
      for (const [level, value] of Object.entries(guest.progress)) target.progress[level] = mergeProgress(target.progress[level], value);
      if (guest.nickname) { target.nickname = guest.nickname; target.nicknameUpdatedAt = Math.max(Date.now(), target.nicknameUpdatedAt + 1); target.profileDirty = true; }
      this.data.buckets[owner] = target;
      this.data.claimedGuestBy = owner;
      delete this.data.buckets.guest;
    } else this.data.buckets[owner] ||= newBucket();
    this.data.activeOwner = owner;
    this.ownerGeneration += 1;
    this.status = 'local';
    this.detail = previous === 'guest' ? '' : 'Обнаружена другая анонимная сессия. Её прогресс хранится отдельно.';
    this.persist();
    this.notify();
  }

  async setNickname(input) {
    const result = validateNickname(input);
    if (!result.valid) throw new Error(result.error);
    this.bucket.nickname = result.value;
    this.bucket.nicknameUpdatedAt = Math.max(Date.now(), this.bucket.nicknameUpdatedAt + 1);
    this.bucket.profileDirty = true;
    this.status = 'local';
    this.persist();
    this.notify();
    // Deliberately don't make nickname entry wait for network access.
    void this.sync();
    return this.getState();
  }

  isUnlocked(levelId) {
    return Number.isInteger(levelId) && levelId >= 1 && levelId <= 5 && (levelId === 1 || Boolean(this.bucket.progress[levelId - 1]));
  }

  async completeLevel(input) {
    validateRun(input);
    if (!this.isUnlocked(input.levelId)) throw new Error('Сначала восстановите предыдущий модуль.');
    const run = {
      id: createRunId(),
      user_id: this.data.activeOwner === 'guest' ? null : this.data.activeOwner,
      level_id: input.levelId,
      duration_ms: input.durationMs,
      mistakes: input.mistakes,
      hints_used: input.hintsUsed,
      completed_at: new Date().toISOString(),
    };
    this.bucket.runs.unshift(run);
    this.bucket.pending.push(run.id);
    this.bucket.progress[run.level_id] = improveProgress(this.bucket.progress[run.level_id], run);
    this.status = 'local';
    this.persist();
    this.notify();
    void this.sync();
    return { ...run, stars: calculateStars(run.mistakes, run.hints_used), ...input };
  }

  async sync() {
    if (!this.configured || !this.client) {
      this.status = 'local';
      this.notify();
      return this.getState();
    }
    if (this.syncPromise) {
      this.syncAgain = true;
      return this.syncPromise;
    }
    this.syncPromise = (async () => {
      do {
        this.syncAgain = false;
        try { await this.performSync(); }
        catch (error) {
          this.status = 'local';
          this.detail = failureMessage(error);
          this.persist();
          this.notify();
          // Explicit events trigger retries; failures never spin in a retry loop.
          this.syncAgain = false;
        }
      } while (this.syncAgain);
      return this.getState();
    })();
    try { return await this.syncPromise; }
    finally { this.syncPromise = null; }
  }

  async performSync() {
    this.status = 'syncing';
    this.detail = '';
    this.notify();
    const session = await this.auth.ensureSession();
    if (!session?.user?.id) throw new Error('Не удалось восстановить анонимную сессию.');
    this.adoptOwner(session.user.id);
    const owner = session.user.id;
    const generation = this.ownerGeneration;
    const bucket = this.bucket;
    const assertOwner = () => {
      if (this.data.activeOwner !== owner || generation !== this.ownerGeneration) throw new Error('Сессия изменилась; результаты другого пользователя не синхронизируются.');
    };
    const profile = await this.client.from('profiles').select('nickname').eq('id', owner).maybeSingle();
    assertOwner();
    if (profile.error) throw profile.error;
    if ((!bucket.nickname || !bucket.profileDirty) && profile.data?.nickname) bucket.nickname = profile.data.nickname;
    if (!bucket.nickname) {
      this.status = 'local';
      this.detail = 'Введите ник, чтобы создать профиль.';
      this.persist();
      this.notify();
      return;
    }
    if (bucket.profileDirty || !profile.data) {
      const nickname = bucket.nickname;
      const saved = await this.client.from('profiles').upsert({ id: owner, nickname }, { onConflict: 'id' });
      assertOwner();
      if (saved.error) throw saved.error;
      if (bucket.nickname === nickname) { bucket.nicknameSyncedAt = bucket.nicknameUpdatedAt; bucket.profileDirty = false; }
    }
    const cloudProgress = await this.client.from('level_progress').select('*').eq('user_id', owner);
    assertOwner();
    if (cloudProgress.error) throw cloudProgress.error;
    for (const row of cloudProgress.data || []) bucket.progress[row.level_id] = mergeProgress(bucket.progress[row.level_id], row);
    this.persist();

    const pendingIds = [...bucket.pending];
    const pendingRuns = bucket.runs.filter((run) => pendingIds.includes(run.id));
    for (let offset = 0; offset < pendingRuns.length; offset += 100) {
      const batch = pendingRuns.slice(offset, offset + 100).map(({ id, level_id, duration_ms, mistakes, hints_used, completed_at }) => ({ id, user_id: owner, level_id, duration_ms, mistakes, hints_used, completed_at }));
      // Retried UUIDs use ON CONFLICT DO NOTHING: immutable runs need no UPDATE grant.
      const inserted = await this.client.from('runs').upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
      assertOwner();
      if (inserted.error) throw inserted.error;
      // Do not remove queue entries yet. Progress must also succeed first.
    }
    const historyRows = [];
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
      const history = await this.client.from('runs').select('*').eq('user_id', owner)
        .order('completed_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + pageSize - 1);
      assertOwner();
      if (history.error) throw history.error;
      const page = history.data || [];
      historyRows.push(...page);
      if (page.length < pageSize) break;
    }
    const runMap = new Map(bucket.runs.map((run) => [run.id, run]));
    for (const run of historyRows) {
      runMap.set(run.id, run);
      // Recover a run whose insert succeeded in another tab before its progress write failed.
      bucket.progress[run.level_id] = improveProgress(bucket.progress[run.level_id], run);
    }
    bucket.runs = [...runMap.values()].sort((a, b) => b.completed_at.localeCompare(a.completed_at) || b.id.localeCompare(a.id));
    const progressRows = Object.values(bucket.progress).map(({ level_id, best_time_ms, best_errors, best_stars, completed_at }) => ({ user_id: owner, level_id, best_time_ms, best_errors, best_stars, completed_at }));
    if (progressRows.length) {
      const updated = await this.client.from('level_progress').upsert(progressRows, { onConflict: 'user_id,level_id' });
      assertOwner();
      if (updated.error) throw updated.error;
    }
    bucket.acknowledged = [...new Set([...bucket.acknowledged, ...pendingIds])];
    bucket.pending = bucket.pending.filter((id) => !pendingIds.includes(id));
    this.detail = '';
    this.persist();
    const needsAnotherPass = bucket.pending.length > 0 || bucket.profileDirty;
    this.status = needsAnotherPass ? 'local' : 'cloud';
    if (needsAnotherPass) this.syncAgain = true;
    this.notify();
  }
}

export const progressService = new ProgressService();
