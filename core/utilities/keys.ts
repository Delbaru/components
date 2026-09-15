/**
 * Ключ значения в имени класса: `p_8`, `w_100%`, `bg_--primary`, `w_x1k9f3a2`.
 *
 * Читаемое значение идёт в имя как есть, `var(--токен)` — именем токена, всё остальное (calc,
 * min(), составные рамки) — хешем. Хеш один и тот же в рантайме и в генераторе, поэтому карта
 * «строка → ключ» не нужна, а совпадение двух разных строк генератор ловит при сборке.
 */

export type UtilityScalar = number | string;

/** Шорткат отступа: одна–четыре стороны по правилам CSS. */
export type UtilityShorthand = readonly UtilityScalar[];

export type UtilityEntry = UtilityScalar | UtilityShorthand;

const READABLE = /^[A-Za-z0-9.%/-]+$/;
const TOKEN = /^var\((--[A-Za-z0-9_-]+)\)$/;
const RATIO = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/;

/** FNV-1a (32 бита) в base36: короткий, стабильный между рантаймом и генератором. */
export function hashKey(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `x${(hash >>> 0).toString(36)}`;
}

/** Одно значение CSS — один ключ: пробелы у скобок и запятых не в счёт (`rgba(0, 0, 0, .8)` ≡ `rgba(0,0,0,.8)`). */
export function normalizeCss(value: string): string {
  return value.trim().replace(/\s*([(),])\s*/g, '$1').replace(/\s+/g, ' ');
}

export function scalarKey(value: UtilityScalar): string {
  if (typeof value === 'number') return String(value);

  const trimmed = normalizeCss(value);
  const ratio = RATIO.exec(trimmed);
  if (ratio) return `${ratio[1]}/${ratio[2]}`;
  if (READABLE.test(trimmed)) return trimmed;

  const token = TOKEN.exec(trimmed);
  if (token?.[1]) return token[1];

  return hashKey(trimmed);
}

/** Шорткат `[верх, право, низ, лево]` раскрывается по правилам CSS. */
export function expandShorthand(value: UtilityShorthand): [UtilityScalar, UtilityScalar, UtilityScalar, UtilityScalar] | null {
  const [top, right, bottom, left] = value;
  if (top === undefined || value.length > 4) return null;
  const x = right ?? top;
  return [top, x, bottom ?? top, left ?? x];
}

export function entryKey(value: UtilityEntry): string {
  if (!Array.isArray(value)) return scalarKey(value as UtilityScalar);

  const sides = expandShorthand(value);
  if (!sides) return hashKey(JSON.stringify(value));

  const keys = sides.map(scalarKey);
  return keys.every((key) => key === keys[0]) ? (keys[0] as string) : keys.join('_');
}

/** Имя класса в селекторе: всё, кроме букв, цифр, `_` и `-`, экранируется. */
export function escapeClassName(className: string): string {
  return className.replace(/[^A-Za-z0-9_-]/g, (char) => `\\${char}`);
}
