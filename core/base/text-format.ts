/** Формы слова для счётного ряда: одна, две, пять. */
export type PluralForms = readonly [one: string, few: string, many: string];

/**
 * Русское склонение по числу: `pluralize(3, ['день', 'дня', 'дней'])` → «дня».
 *
 * Правило одно на весь репозиторий: копий было пять, и каждая писала «11–14» по-своему.
 */
export function pluralize(value: number, [one, few, many]: PluralForms): string {
  const abs = Math.abs(value);
  const tail100 = abs % 100;
  const tail10 = abs % 10;

  if (tail100 >= 11 && tail100 <= 14) return many;
  if (tail10 === 1) return one;
  if (tail10 >= 2 && tail10 <= 4) return few;

  return many;
}

/** Число с ведущими нулями: `pad(7)` → «07». Часы, минуты, секунды. */
export const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
