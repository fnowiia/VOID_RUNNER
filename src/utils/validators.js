// Three terminals per level, with two educational hints each.
export const MAX_HINTS_PER_LEVEL = 6;

export function validateNickname(input) {
  const value = typeof input === 'string' ? input.trim().normalize('NFC') : '';
  const length = [...value].length;
  if (length < 2 || length > 16) return { valid: false, value, error: 'Ник должен содержать от 2 до 16 символов.' };
  if (!/^[\p{L}\p{N}_ -]+$/u.test(value)) return { valid: false, value, error: 'Используйте буквы, цифры, пробел, дефис или знак _.' };
  return { valid: true, value, error: '' };
}

export function validateRun({ levelId, durationMs, mistakes, hintsUsed }) {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > 5) throw new RangeError('Неизвестный уровень.');
  for (const [name, value] of Object.entries({ durationMs, mistakes, hintsUsed })) {
    if (!Number.isInteger(value) || value < 0 || value > 2147483647) throw new RangeError(`Некорректное значение ${name}.`);
  }
  if (hintsUsed > MAX_HINTS_PER_LEVEL) throw new RangeError('На уровне три терминала: по две подсказки в каждом, всего не более шести.');
  return true;
}
