/**
 * Маска телефона.
 *
 * Формат приезжает ПАРАМЕТРОМ, а не зашит: рядом с полем стоит выбор страны, и «+7» на десять
 * цифр верен ровно для одной из них. Дефолт остался российским, поэтому ни один call-site,
 * который формата не передаёт, не изменился.
 */

/** Что маска знает о номере выбранной страны. */
export interface PhoneFormat {
  /** Код страны с плюсом. Он же префикс, который поле рисует отдельным узлом слева. */
  dial: string;
  /**
   * Длина НАЦИОНАЛЬНОГО номера (без кода страны).
   *
   * Не задана — длина свободная: справочник стран у нас полный, а форматов мы знаем несколько,
   * и придуманная длина отвергала бы верные номера (§12 «не показывать факт, которого нет»).
   */
  digits?: number;
  /** Разбивка национального номера на группы; сумма равна `digits`. */
  groups?: number[];
  /** Образец номера для подсказки в пустом поле; длина равна `digits`. */
  sample?: string;
}

export const DEFAULT_PHONE_FORMAT: PhoneFormat = {
  dial: '+7',
  digits: 10,
  groups: [3, 3, 2, 2],
  sample: '9991234567',
};

// Предел E.164 — пятнадцать цифр вместе с кодом страны. Он и задаёт потолок у формата,
// длину которого мы не знаем.
const E164_DIGITS = 15;
// Самые короткие национальные номера в мире — четырёхзначные. Ниже этого «номер не дописан»
// верно для любой страны, выше — уже догадка о конкретной.
const MIN_UNKNOWN_DIGITS = 4;

const digitsOf = (value: string): string => (value.match(/\d/g) ?? []).join('');

const dialDigits = (format: PhoneFormat): string => digitsOf(format.dial);

/** Сколько цифр помещается в национальную часть: известная длина либо остаток от E.164. */
const capacity = (format: PhoneFormat): number => format.digits ?? E164_DIGITS - dialDigits(format).length;

const plural = (count: number): string => {
  const tail = count % 100;
  const last = count % 10;

  if (tail >= 11 && tail <= 14) return 'цифр';
  if (last >= 2 && last <= 4) return 'цифры';

  return last === 1 ? 'цифру' : 'цифр';
};

/** Извлекает «чистые» цифры национального номера. */
export const extractDigits = (raw: string, format: PhoneFormat = DEFAULT_PHONE_FORMAT): string => {
  const code = dialDigits(format);
  const national = capacity(format);
  // СВОЙ префикс маски снимаем явно и ДО подсчёта цифр. Контролируемое поле возвращает сюда
  // собственный отформатированный вывод (`+7 (916) 123 - 45 - 67`), и без этой строки «7» из
  // «+7» считалась бы первой цифрой локального номера у любого НЕДОнабранного значения:
  // «+7 (9» → цифры «79» → «+7 (79» → на каждый ввод в начало доклеивается ещё семёрка.
  const withoutOwnPrefix = raw.replace(new RegExp(`^\\s*\\+${code}`), '');
  const digits = digitsOf(withoutOwnPrefix);
  // Код страны БЕЗ «+» (79991234567 / 89991234567 — так приходит автозаполнение браузера)
  // отбрасываем только у ПЕРЕполненного номера. Национальный номер не трогаем, даже если он
  // начинается с тех же цифр, иначе теряется первая. Восьмёрка — междугородний префикс «+7»,
  // и знание это про одну страну: другим её приписывать нечего.
  const trunk = code === '7' && digits.startsWith('8') ? 1 : digits.startsWith(code) ? code.length : 0;
  const local = digits.length > national && trunk > 0 ? digits.slice(trunk) : digits;

  return local.slice(0, national);
};

/** Форматирует строку по группам формата: `+7 (916) 123 - 45 - 67`. */
export const formatPhone = (raw: string, format: PhoneFormat = DEFAULT_PHONE_FORMAT): string => {
  const d = extractDigits(raw, format);

  if (d.length === 0) return `${format.dial} `;

  const groups = format.groups ?? [];

  // Групп не знаем — показываем цифры сплошь. Расставить скобки «как обычно» значило бы
  // придумать формат чужой страны.
  if (groups.length === 0) return `${format.dial} ${d}`;

  let result = format.dial;
  let start = 0;

  groups.forEach((length, index) => {
    if (d.length <= start) return;

    const chunk = d.slice(start, start + length);

    if (index === 0) {
      // Скобка закрывается, только когда за группой пошли следующие цифры: пока набирают
      // первую, номер стоит незакрытым — так каретка не перепрыгивает через символ.
      result += ` (${chunk}${d.length > start + length ? ')' : ''}`;
    } else {
      result += (index === 1 ? ' ' : ' - ') + chunk;
    }

    start += length;
  });

  return result;
};

/** Убирает префикс кода страны — его поле рисует отдельным узлом. */
export const stripPrefix = (formatted: string, format: PhoneFormat = DEFAULT_PHONE_FORMAT): string =>
  formatted.replace(new RegExp(`^\\+${dialDigits(format)}\\s?`), '');

/** true если пользователь не ввёл ни одной цифры. */
export const isEmpty = (raw: string, format: PhoneFormat = DEFAULT_PHONE_FORMAT): boolean =>
  extractDigits(raw, format).length === 0;

/** Валидация: undefined = ок, строка = сообщение об ошибке. */
export const validate = (raw: string, format: PhoneFormat = DEFAULT_PHONE_FORMAT): string | undefined => {
  const d = extractDigits(raw, format);

  if (d.length === 0) return undefined;

  if (format.digits === undefined) {
    return d.length >= MIN_UNKNOWN_DIGITS ? undefined : 'Введите номер полностью';
  }

  if (d.length === format.digits) return undefined;

  const total = dialDigits(format).length + format.digits;

  return `Введите ${total} ${plural(total)} номера`;
};

/** Пустое значение поля — один префикс. */
export const emptyValue = (format: PhoneFormat = DEFAULT_PHONE_FORMAT): string => `${format.dial} `;

/**
 * Подсказка для нативного `placeholder`.
 *
 * У `type='tel'` её гасит слой-маска (он же рисует части разным цветом и весом), но фолбэк
 * обязан совпадать с ним по символам — иначе в одном поле живут два вида одной подсказки.
 */
export const placeholderText = (format: PhoneFormat = DEFAULT_PHONE_FORMAT): string =>
  format.sample ? stripPrefix(formatPhone(format.sample, format), format) : '';

/** Потолок длины для `<input>`: полностью набранный номер плюс его разделители. */
export const maxLengthOf = (format: PhoneFormat = DEFAULT_PHONE_FORMAT): number =>
  formatPhone(format.sample ?? '9'.repeat(capacity(format)), format).length;

/**
 * Подсказка ЧАСТЯМИ для слоя-маски: `dim` — группы цифр (серые, с разрядкой), остальное —
 * скобки и тире (чёрные, тире ДЛИННОЕ).
 *
 * Разложено ГРУППАМИ, а не плоским списком с пробелами внутри строк: в макете зазор между
 * группами ровно 4, а ширина пробела зависит от гарнитуры и кегля — то есть плоский список
 * давал бы «почти то» на каждом размере. Внутри группы «(999)» зазора нет вовсе.
 */
export const maskGroups = (format: PhoneFormat = DEFAULT_PHONE_FORMAT): { text: string; dim?: boolean }[][] => {
  const { sample, groups } = format;

  if (!sample || !groups?.length) return [];

  const parts: { text: string; dim?: boolean }[][] = [];
  let start = 0;

  groups.forEach((length, index) => {
    const chunk = sample.slice(start, start + length);
    start += length;

    if (!chunk) return;

    if (index === 0) {
      parts.push([{ text: '(' }, { text: chunk, dim: true }, { text: ')' }]);

      return;
    }

    if (index > 1) parts.push([{ text: '–' }]);

    parts.push([{ text: chunk, dim: true }]);
  });

  return parts;
};
