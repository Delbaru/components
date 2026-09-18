/**
 * Логика календаря/даты для Input.
 *
 * Здесь лежат парсинг, форматирование, календарная сетка
 * и вспомогательные константы. JSX остаётся в Input.tsx.
 */

const DISPLAY_DATE_REGEX = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_ERROR = 'Введите дату в формате ДД.ММ.ГГГГ';
const CALENDAR_DAY_COUNT = 42;

export const WEEKDAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;
export const MONTH_LABELS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'] as const;
export const maxLength = 10;

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function createSafeDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseDisplayValue(raw: string): Date | null {
  const match = DISPLAY_DATE_REGEX.exec(raw.trim());
  if (!match) return null;

  return createSafeDate(Number(match[3]), Number(match[2]), Number(match[1]));
}

function parseIsoValue(raw: string): Date | null {
  const match = ISO_DATE_REGEX.exec(raw.trim());
  if (!match) return null;

  return createSafeDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export const parseValue = (raw: string): Date | null =>
  parseDisplayValue(raw) ?? parseIsoValue(raw);

export const formatDisplay = (value: Date): string =>
  `${padDatePart(value.getDate())}.${padDatePart(value.getMonth() + 1)}.${value.getFullYear()}`;

export const normalizeDisplayValue = (raw: string): string => {
  if (!raw.trim()) return '';

  const parsed = parseValue(raw);
  return parsed ? formatDisplay(parsed) : raw;
};

export const validate = (raw: string): string | undefined => {
  if (raw && !parseValue(raw)) return DEFAULT_ERROR;
  return undefined;
};

export const getMonthStart = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), 1);

export const resolveVisibleMonth = (raw?: string | null, fallback = new Date()): Date =>
  getMonthStart(parseValue(raw ?? '') ?? fallback);

export const addMonth = (value: Date, delta: number): Date =>
  new Date(value.getFullYear(), value.getMonth() + delta, 1);

export const isSameDay = (a: Date | null, b: Date): boolean =>
  Boolean(
    a
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );

export const compareDays = (a: Date, b: Date): number => {
  const yearDiff = a.getFullYear() - b.getFullYear();

  if (yearDiff !== 0) {
    return yearDiff;
  }

  const monthDiff = a.getMonth() - b.getMonth();

  if (monthDiff !== 0) {
    return monthDiff;
  }

  return a.getDate() - b.getDate();
};

export const isBeforeDay = (a: Date, b: Date): boolean => compareDays(a, b) < 0;

export const isAfterDay = (a: Date, b: Date): boolean => compareDays(a, b) > 0;

/**
 * Месяц, на котором календарь ОТКРЫВАЕТСЯ: месяц выбранного дня, а без него — сегодняшний, но не
 * раньше `min` и не позже `max`. Иначе «Дата окончания» при начале периода в декабре открывалась на
 * текущем месяце, где выбрать нельзя ни одного дня. Пустая строка — это «не выбрано», а не значение:
 * через `??` она проходила и заслоняла собой `min`.
 */
export const resolveOpeningMonth = (raw?: string, minRaw?: string, maxRaw?: string, today = new Date()): Date => {
  const selected = parseValue(raw ?? '');
  if (selected) return getMonthStart(selected);

  const min = parseValue(minRaw ?? '');
  if (min && isBeforeDay(today, min)) return getMonthStart(min);

  const max = parseValue(maxRaw ?? '');
  if (max && isAfterDay(today, max)) return getMonthStart(max);

  return getMonthStart(today);
};

export const isWeekend = (value: Date): boolean => {
  const day = value.getDay();
  return day === 0 || day === 6;
};

export const buildCalendarDays = (month: Date): Date[] => {
  const monthStart = getMonthStart(month);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const firstVisibleDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - startOffset);

  return Array.from({ length: CALENDAR_DAY_COUNT }, (_, index) => (
    new Date(firstVisibleDay.getFullYear(), firstVisibleDay.getMonth(), firstVisibleDay.getDate() + index)
  ));
};