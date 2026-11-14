import { getLesson } from '../data/lessons.js';

const definitions = {
  '1-main': { answer: { speed: 220 }, effect: { type: 'speed', value: 220 } },
  '1-jump': { answer: { strength: 460 }, effect: { type: 'jump', value: 460 } },
  '1-laser': { answer: { maintenance: 'true' }, effect: { type: 'laser', target: 'boot' } },
  '2-main': { answer: { gravity: 700 }, effect: { type: 'gravity', value: 700 } },
  '2-lift': { answer: { operator: '/' }, effect: { type: 'platforms', target: 'lift', count: 3 } },
  '2-shield': { answer: { operator: '+', divisor: 2 }, effect: { type: 'laser', target: 'unstable' } },
  '3-main': { answer: { operator: '>=' }, effect: { type: 'door', target: 'security' } },
  '3-route': { answer: { index: 1 }, effect: { type: 'gate', target: 'vault' } },
  '3-permission': { answer: { logical: '&&' }, effect: { type: 'gate', target: 'firewall' } },
  '4-main': { answer: { count: 3 }, effect: { type: 'bridge', target: 'bridge', count: 3 } },
  '4-step': { answer: { limit: 4, step: 1 }, effect: { type: 'platforms', target: 'stairs', count: 4 } },
  '4-power': { answer: { operator: '+=' }, effect: { type: 'gate', target: 'constructor' } },
  '5-main': { answer: { comparison: '>=', logical: '&&' }, effect: { type: 'portal' } },
  '5-reactor': { answer: { negation: '!', logical: '&&' }, effect: { type: 'gate', target: 'power' } },
  '5-checksum': { answer: { operator: '===' }, effect: { type: 'laser', target: 'core-heat' } }
};

const feedback = {
  '1-main': ({ speed }) => speed === 40
    ? '40 — исходная неисправность: персонаж останется слишком медленным. Измени сохранённое значение.'
    : speed === 120 ? '120 ускорит движение, но останется ниже штатного режима 220. Сверь значение с паспортом сектора.'
      : '500 превышает штатную скорость: на узких площадках она небезопасна. Восстанови указанный в задаче режим.',
  '1-jump': ({ strength }) => strength === 700
    ? '700 превышает штатный импульс башни. Нужен управляемый прыжок с величиной из её паспорта.'
    : `${strength} даёт слишком слабый толчок для верхнего маршрута. Минус уже направляет прыжок вверх; увеличь величину до штатного режима.`,
  '1-laser': () => 'Если maintenanceMode = false, выражение !maintenanceMode даст true: лазер останется активным. Включи обслуживание, чтобы выключить опасность.',
  '2-main': ({ gravity }) => gravity === -450
    ? 'Отрицательное ускорение продолжит тянуть объекты к потолку. Нужен знак, направляющий их к полу.'
    : gravity === 0 ? 'Ноль отключит притяжение: объекты не вернутся на пол как обычно. Нужен положительный штатный параметр.'
      : '1500 создаёт слишком сильное притяжение для штатного маршрута. Выбери умеренный положительный режим.',
  '2-lift': ({ operator }) => ({
    '+': '384 + 128 = 512. Это увеличивает запас, а не вычисляет число опор. Нужен результат 3.',
    '-': '384 − 128 = 256. Это оставшийся ресурс после одной опоры, а не количество всех опор.',
    '*': '384 × 128 = 49152. Умножение считает запас для множества деталей, но здесь нужно узнать число деталей в уже известном запасе.'
  })[operator],
  '2-shield': ({ operator, divisor }) => {
    const reasons = [];
    if (operator !== '+') reasons.push('Для среднего сначала нужна сумма показаний: 14 + 20. Вычитание, умножение и деление не собирают их общий запас.');
    if (divisor !== 2) reasons.push(`Показаний два, поэтому их сумма делится на 2, а не на ${divisor}.`);
    return reasons.join(' ');
  },
  '3-main': ({ operator }) => operator === '>'
    ? 'При двух ключах 2 > 2 — ложь. «Строго больше» не включает границу, и дверь останется закрытой.'
    : operator === '==' ? '== разрешает только ровно два ключа. По условию два ИЛИ больше должны подходить: при трёх ключах равенство снова запретит доступ.'
      : '< разрешает запас меньше необходимого. Нужно проверить, что ключей достаточно, включая саму границу.',
  '3-route': ({ index }) => index === 3
    ? 'В массиве три элемента с индексами 0, 1, 2. Позиция 3 отсутствует и вернула бы undefined — нужного маршрута там нет.'
    : index === 0 ? 'routes[0] — это "TRAP". Нумерация начинается с нуля; нужная запись расположена дальше.'
      : 'routes[2] — это "DEAD_END". Найди позицию VAULT, начиная отсчёт с нуля.',
  '3-permission': () => '|| достаточно одной верной проверки. Тогда подтверждённый пропуск разрешил бы проход даже при карантине. Здесь обязательны оба требования.',
  '4-main': ({ count }) => count === 0
    ? 'Перед первым повторением i = 0, а 0 < 0 ложно. Ни одна секция моста не появится.'
    : count === 1 ? 'Счётчик примет только i = 0: получится одна платформа. Для этого моста нужно три.'
      : 'Граница 10 дала бы десять повторений. Контроллер рассчитан ровно на три секции; ограничь их число.',
  '4-step': ({ limit, step }) => {
    const reasons = [];
    if (step === 0) reasons.push('При шаге 0 счётчик не меняется. Для положительной границы цикл не завершится; контроллер не запускает такой патч.');
    else if (step < 0) reasons.push('Отрицательный шаг уводит счётчик от положительной границы. Условие не станет ложным, поэтому такой патч заблокирован.');
    else if (step === 2) reasons.push('Шаг 2 пропускает соседние значения: при границе 4 останутся только 0 и 2, то есть две ступени.');
    if (limit !== 4) reasons.push(limit === 0 ? 'Граница 0 запрещает даже первое повторение.' : `При штатном шаге 1 граница ${limit} создаст ${limit} ступени вместо четырёх.`);
    return reasons.join(' ');
  },
  '4-power': ({ operator }) => ({
    '=': 'Присваивание = каждый раз заменяет запас числом 2. После трёх повторений останется 2 вместо 6; нужно прибавлять к предыдущему значению.',
    '-=': 'Оператор -= вычитает: 0 → −2 → −4 → −6. Генератор должен накапливать положительную энергию.',
    '*=': 'Умножение *= не поможет: начальный ноль, умноженный на 2, останется нулём во всех трёх повторениях.'
  })[operator],
  '5-main': ({ comparison, logical }) => {
    const reasons = [];
    if (comparison !== '>=') reasons.push(comparison === '=='
      ? '== принимает только ровно два предохранителя, но требование допускает и большее количество. Нужна проверка достаточного запаса.'
      : comparison === '<' ? '< допускает нехватку предохранителей. Нужно проверить достаточный запас.'
        : 'При двух предохранителях 2 > 2 ложно. Сравнение должно включать равенство.');
    if (logical !== '&&') reasons.push('|| означает «ИЛИ»: портал мог бы запуститься без одного из требований. Нужны и запас, и включённый рубильник.');
    return reasons.join(' ');
  },
  '5-reactor': ({ negation, logical }) => {
    const reasons = [];
    if (negation !== '!') reasons.push('!! оставляет исходный смысл датчика: !!false равно false. Чтобы проверить отсутствие перегрева, нужно одно отрицание.');
    if (logical !== '&&') reasons.push('|| разрешает проход при одной готовой проверке, даже если другая сообщает об опасности. Потребуй оба условия одновременно.');
    return reasons.join(' ');
  },
  '5-checksum': ({ operator }) => operator === '!=='
    ? '404 !== 404 — ложь: одинаковые значения не различаются. Охлаждение должно включаться при точном совпадении.'
    : '404 не меньше и не больше 404. Сравнение величин не проверяет нужное точное совпадение.'
};

function validInput(values, fields) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return null;
  const prototype = Object.getPrototypeOf(values);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(values);
  const names = fields.map(field => field.name);
  if (Reflect.ownKeys(values).some(key => typeof key !== 'string' || !names.includes(key))) return null;
  const normalized = Object.create(null);
  for (const field of fields) {
    const descriptor = descriptors[field.name];
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    const supplied = descriptor.value;
    const selected = field.options.find(option => supplied === option || (typeof option === 'number' && supplied === String(option)));
    if (selected === undefined) return null;
    normalized[field.name] = selected;
  }
  return normalized;
}

/** Validates finite patch selections; it never interprets source code. */
export class PuzzleEngine {
  static check(puzzleId, values) {
    const lesson = getLesson(puzzleId);
    const definition = lesson && Object.hasOwn(definitions, lesson.id) ? definitions[lesson.id] : undefined;
    if (!definition) return { correct: false, message: 'Неизвестный узел. Найди терминал доступного уровня.' };
    const normalized = validInput(values, lesson.fields);
    if (!normalized) return { correct: false, message: 'Выбери разрешённые значения во всех выделенных полях. Другие параметры и исполняемый текст не принимаются.' };
    const correct = Object.entries(definition.answer).every(([key, value]) => normalized[key] === value);
    if (correct) return { correct: true, puzzleId: lesson.id, message: lesson.success, effect: { ...definition.effect } };
    return { correct: false, puzzleId: lesson.id, message: feedback[lesson.id](normalized) || 'Этот вариант не восстанавливает узел. Проверь требование и попробуй снова.' };
  }
  check(puzzleId, values) { return PuzzleEngine.check(puzzleId, values); }
}
export default PuzzleEngine;
