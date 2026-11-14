import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStars, formatTime, improveProgress } from '../src/utils/score.js';
import { validateNickname } from '../src/utils/validators.js';

test('stars follow visible mistakes and hints thresholds', () => {
  assert.equal(calculateStars(0, 0), 3);
  assert.equal(calculateStars(2, 1), 2);
  assert.equal(calculateStars(0, 1), 2);
  assert.equal(calculateStars(1, 0), 2);
  assert.equal(calculateStars(3, 0), 1);
  assert.equal(calculateStars(0, 2), 1);
  assert.equal(calculateStars(0, 6), 1);
});

test('time and counters improve independently and never regress', () => {
  const first = { level_id: 1, duration_ms: 8000, mistakes: 0, hints_used: 0, completed_at: '2026-01-01T00:00:00Z' };
  let progress = improveProgress(null, first);
  progress = improveProgress(progress, { ...first, duration_ms: 4000, mistakes: 8, hints_used: 2, completed_at: '2026-02-01T00:00:00Z' });
  assert.deepEqual(progress, { level_id: 1, best_time_ms: 4000, best_errors: 0, best_stars: 3, completed_at: first.completed_at });
});

test('time display and safe Unicode nicknames', () => {
  assert.equal(formatTime(65432), '01:05');
  assert.equal(formatTime(-1), '00:00');
  assert.equal(validateNickname('  Патч_404  ').value, 'Патч_404');
  assert.equal(validateNickname('Я').valid, false);
  assert.equal(validateNickname('<script>').valid, false);
  assert.equal(validateNickname('А'.repeat(17)).valid, false);
});
