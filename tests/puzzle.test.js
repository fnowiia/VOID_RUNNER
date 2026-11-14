import test from 'node:test';
import assert from 'node:assert/strict';
import { PuzzleEngine } from '../src/core/PuzzleEngine.js';
import { getLesson, getLevelLessons, lessons, levelLessons, puzzleIds } from '../src/data/lessons.js';

const expected = {
  '1-main': { speed: 220 },
  '1-jump': { strength: 460 },
  '1-laser': { maintenance: 'true' },
  '2-main': { gravity: 700 },
  '2-lift': { operator: '/' },
  '2-shield': { operator: '+', divisor: 2 },
  '3-main': { operator: '>=' },
  '3-route': { index: 1 },
  '3-permission': { logical: '&&' },
  '4-main': { count: 3 },
  '4-step': { limit: 4, step: 1 },
  '4-power': { operator: '+=' },
  '5-main': { comparison: '>=', logical: '&&' },
  '5-reactor': { negation: '!', logical: '&&' },
  '5-checksum': { operator: '===' }
};
const effects = {
  '1-main': { type: 'speed', value: 220 },
  '1-jump': { type: 'jump', value: 460 },
  '1-laser': { type: 'laser', target: 'boot' },
  '2-main': { type: 'gravity', value: 700 },
  '2-lift': { type: 'platforms', target: 'lift', count: 3 },
  '2-shield': { type: 'laser', target: 'unstable' },
  '3-main': { type: 'door', target: 'security' },
  '3-route': { type: 'gate', target: 'vault' },
  '3-permission': { type: 'gate', target: 'firewall' },
  '4-main': { type: 'bridge', target: 'bridge', count: 3 },
  '4-step': { type: 'platforms', target: 'stairs', count: 4 },
  '4-power': { type: 'gate', target: 'constructor' },
  '5-main': { type: 'portal' },
  '5-reactor': { type: 'gate', target: 'power' },
  '5-checksum': { type: 'laser', target: 'core-heat' }
};

function candidates(fields, position = 0, value = {}) {
  if (position === fields.length) return [value];
  const field = fields[position];
  return field.options.flatMap(option => candidates(fields, position + 1, { ...value, [field.name]: option }));
}

for (const id of puzzleIds) {
  test(`${id}: exact repair returns its authored world effect`, () => {
    const lesson = getLesson(id);
    const result = PuzzleEngine.check(id, expected[id]);
    assert.equal(result.correct, true);
    assert.equal(result.puzzleId, id);
    assert.deepEqual(result.effect, effects[id]);
    assert.equal(result.message, lesson.success);
    assert.equal(lesson.hints.length, 2);
    assert.notEqual(lesson.hints[0], lesson.hints[1]);
    assert.ok(lesson.concept.length > 50);
    assert.ok(lesson.description.length > 60);
    assert.ok(lesson.summary.length > 30);
    assert.notEqual(lesson.codeBefore, lesson.codeAfter);
    for (const field of lesson.fields) assert.ok(lesson.codeTemplate.includes(`{{${field.name}}}`));
  });
  test(`${id}: all offered combinations are checked without trapping a later correct answer`, () => {
    for (const value of candidates(getLesson(id).fields)) {
      const shouldPass = Object.entries(expected[id]).every(([key, expectedValue]) => value[key] === expectedValue);
      const result = PuzzleEngine.check(id, value);
      assert.equal(result.correct, shouldPass, JSON.stringify(value));
      assert.ok(result.message.length > 25);
      if (!shouldPass) assert.equal(result.effect, undefined);
      assert.equal(PuzzleEngine.check(id, expected[id]).correct, true);
    }
  });
}

for (const levelId of [1, 2, 3, 4, 5]) {
  test(`level ${levelId}: exactly three discoverable lessons retain its numeric main alias`, () => {
    assert.equal(levelLessons[levelId].length, 3);
    assert.equal(new Set(levelLessons[levelId].map(lesson => lesson.id)).size, 3);
    assert.deepEqual(getLevelLessons(levelId), levelLessons[levelId]);
    assert.ok(levelLessons[levelId].every(lesson => lesson.levelId === levelId));
    assert.deepEqual(levelLessons[levelId].map(lesson => lesson.order), [1, 2, 3]);
    assert.equal(getLesson(levelId), lessons[`${levelId}-main`]);
    assert.equal(PuzzleEngine.check(levelId, expected[`${levelId}-main`]).correct, true);
  });
}

test('the campaign defines fifteen unique repairs and no unknown lesson aliases', () => {
  assert.equal(puzzleIds.length, 15);
  assert.equal(new Set(puzzleIds).size, 15);
  for (const id of [99, 'unknown', '__proto__', 'constructor', 'toString', null, undefined, {}, [], Symbol('x')]) {
    assert.equal(getLesson(id), undefined);
    assert.equal(PuzzleEngine.check(id, {}).correct, false);
  }
  assert.deepEqual(getLevelLessons(99), []);
});

test('HTML numeric selection spellings are accepted for every numeric field', () => {
  for (const id of puzzleIds) {
    const values = Object.fromEntries(Object.entries(expected[id]).map(([key, value]) => [key, String(value)]));
    assert.equal(PuzzleEngine.check(id, values).correct, true);
  }
});

test('malformed, executable, inherited and hidden unknown fields are rejected', () => {
  const hidden = Object.defineProperty({ speed: 220 }, 'extra', { value: 1 });
  const symbol = { speed: 220, [Symbol('extra')]: true };
  const inherited = Object.create({ speed: 220 });
  const polluted = JSON.parse('{"speed":220,"__proto__":{"admin":true}}');
  const invalid = [null, undefined, [], 'player.speed=220', 220, true,
    { speed: 220, extra: 1 }, { speed: 999 }, { speed: '220;alert(1)' },
    {}, { speed: true }, { speed: '0220' }, hidden, symbol, inherited, polluted];
  for (const value of invalid) assert.equal(PuzzleEngine.check('1-main', value).correct, false);
  const plain = Object.assign(Object.create(null), { speed: 220 });
  assert.equal(PuzzleEngine.check('1-main', plain).correct, true);
});

test('accessor properties are rejected without invoking their executable getter', () => {
  let called = false;
  const value = Object.defineProperty({}, 'speed', { enumerable: true, get() { called = true; throw new Error('must never execute'); } });
  assert.equal(PuzzleEngine.check('1-main', value).correct, false);
  assert.equal(called, false);
});

test('both operators of the final patch and both reactor controls are mandatory', () => {
  assert.equal(PuzzleEngine.check('5-main', { comparison: '>=', logical: '||' }).correct, false);
  assert.equal(PuzzleEngine.check('5-main', { comparison: '>', logical: '&&' }).correct, false);
  assert.equal(PuzzleEngine.check('5-main', expected['5-main']).correct, true);
  assert.equal(PuzzleEngine.check('5-reactor', { negation: '!!', logical: '&&' }).correct, false);
  assert.equal(PuzzleEngine.check('5-reactor', { negation: '!', logical: '||' }).correct, false);
});

test('zero and negative loop steps return finite explanatory rejection', () => {
  assert.match(PuzzleEngine.check('4-step', { limit: 4, step: 0 }).message, /не завершится/);
  assert.match(PuzzleEngine.check('4-step', { limit: 4, step: -1 }).message, /уводит/);
  assert.equal(PuzzleEngine.check('4-step', { limit: 4, step: 2 }).correct, false);
  assert.equal(PuzzleEngine.check('4-step', expected['4-step']).correct, true);
});

test('fresh effect objects cannot mutate future repairs', () => {
  const first = PuzzleEngine.check('4-main', { count: 3 });
  first.effect.count = 1000;
  first.effect.target = 'untrusted';
  assert.deepEqual(PuzzleEngine.check('4-main', { count: 3 }).effect, effects['4-main']);
  assert.equal(new PuzzleEngine().check('1-main', { speed: 220 }).correct, true);
});
