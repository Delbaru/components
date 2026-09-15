import { entryKey, expandShorthand, type UtilityEntry, type UtilityScalar } from './keys';

/**
 * Реестр утилит — единственный источник правды для классов раскладки: из него рантайм берёт
 * имя класса, а генератор (`tools/utilities`) — CSS под него. Порядок массива — порядок в
 * таблице стилей: шорткат раньше своих полных свойств (`p` раньше `pt`, `r` раньше `tlr`,
 * `text` раньше `fontSize`), поэтому полное свойство побеждает шорткат на любом брейкпоинте.
 */

export type Breakpoint = 'd' | 'n' | 'm' | 't';

/** `n` — «ниже 1024», одним классом вместо пары одинаковых mobile + tablet. */
export const MEDIA: Readonly<Record<Breakpoint, string>> = {
  d: '(min-width: 1024px)',
  n: '(max-width: 1023px)',
  m: '(max-width: 767px)',
  t: '(min-width: 768px) and (max-width: 1023px)',
};

/** Внутри одной утилиты `n` идёт раньше `m` и `t`: у элемента они вместе не встречаются. */
export const BREAKPOINTS: readonly Breakpoint[] = ['d', 'n', 'm', 't'];

export interface Utility {
  /** Префикс класса — он же имя пропа на вызове, где это возможно. */
  readonly name: string;
  /** CSS-объявления под значение; `null` — значение этой утилите не подходит. */
  readonly declare: (value: UtilityEntry) => string | null;
  /** Закрытый словарь: генератор печатает его целиком, искать значения в коде не нужно. */
  readonly domain?: readonly UtilityScalar[];
  /** Принимает шорткат `[верх, право, низ, лево]` (у `p` и `m`). */
  readonly shorthand?: boolean;
}

const rpx = (value: number) => `calc(var(--rpx) * ${value})`;

const IMPORTANT = /\s*!important$/;
const LENGTH_UNIT = /^-?(\d+\.?\d*|\.\d+)(px|%|r?em|ch|ex|vw|vh|dvw|dvh|svw|svh|lvw|lvh|vmin|vmax|fr)$/;
const CSS_FUNCTION = /^(calc|min|max|clamp|var|env|fit-content)\(.*\)$/;

/**
 * Ключевые слова, которые свойство ПРИНИМАЕТ. Недопустимое (`max-height: auto`, `padding: auto`)
 * браузер выбрасывает, а в кортеже это опасно: переопределение брейкпоинта молча не срабатывает, и
 * база desktop протекает на телефон. Поэтому такое значение класса не получает вовсе.
 */
const keywords = (...words: string[]): ReadonlySet<string> => new Set(['inherit', 'initial', 'unset', ...words]);
const SIZE_WORDS = keywords('auto', 'fit-content', 'max-content', 'min-content', 'stretch');
const MAX_WORDS = keywords('none', 'fit-content', 'max-content', 'min-content', 'stretch');
const MARGIN_WORDS = keywords('auto');
const PLAIN_WORDS = keywords();

/** Похоже на длину CSS: `12rem`, `100%`, `calc(…)`, `var(--x)` и слово, которое свойство принимает. */
const isLength = (value: string, words: ReadonlySet<string>): boolean => {
  const bare = value.replace(IMPORTANT, '');
  return bare === '0' || LENGTH_UNIT.test(bare) || words.has(bare) || CSS_FUNCTION.test(bare);
};

/** Похоже на значение CSS (цвет, рамка, фон): только его алфавит — не путь, не почта, не текст. */
const isCssLiteral = (value: string): boolean => /^[#A-Za-z0-9.-][A-Za-z0-9#().,%\s/*+!'"-]*$/.test(value);

/** Длина: число — дизайн-пиксели, строка — только то, что похоже на длину CSS. */
const length = (value: UtilityScalar, words: ReadonlySet<string> = PLAIN_WORDS): string | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? rpx(value) : null;
  const trimmed = value.trim();
  return isLength(trimmed, words) ? trimmed : null;
};

const isScalar = (value: UtilityEntry): value is UtilityScalar => !Array.isArray(value);

const lengthOf = (property: string, words: ReadonlySet<string> = PLAIN_WORDS) => (value: UtilityEntry) => {
  if (!isScalar(value)) return null;
  const css = length(value, words);
  return css === null ? null : `${property}: ${css}`;
};

const numberOf = (property: string, format: (value: number) => string = String) => (value: UtilityEntry) =>
  typeof value === 'number' && Number.isFinite(value) ? `${property}: ${format(value)}` : null;

const literalOf = (property: string) => (value: UtilityEntry) =>
  typeof value === 'string' && isCssLiteral(value.trim()) ? `${property}: ${value.trim()}` : null;

const spaceOf = (property: string, words: ReadonlySet<string> = PLAIN_WORDS) => (value: UtilityEntry) => {
  if (isScalar(value)) return lengthOf(property, words)(value);
  const sides = expandShorthand(value);
  if (!sides) return null;
  const css = sides.map((side) => length(side, words));
  if (!css.every((side): side is string => side !== null)) return null;
  return `${property}: ${css.every((side) => side === css[0]) ? css[0] : css.join(' ')}`;
};

const enumOf = (property: string, map: Readonly<Record<string, string>>) => ({
  declare: (value: UtilityEntry) => (typeof value === 'string' && value in map ? `${property}: ${map[value]}` : null),
  domain: Object.keys(map),
});

const ALIGN_ITEMS = { stretch: 'stretch', center: 'center', flex_start: 'flex-start', flex_end: 'flex-end', start: 'start', end: 'end', baseline: 'baseline' };
const JUSTIFY_CONTENT = { flex_start: 'flex-start', flex_end: 'flex-end', start: 'start', end: 'end', center: 'center', space_between: 'space-between', space_around: 'space-around', space_evenly: 'space-evenly' };

/** Имя варианта типографики → суффикс токенов темы (`--font-*`, `--tt-*`, `--ls-*`). */
const TEXT_VARIANTS: Readonly<Record<string, string>> = {
  numbers: 'numbers', numbersPlus: 'numbers-plus', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4',
  p1: 'p1', p2: 'p2', p3: 'p3', subtitle: 'subtitle', title: 'title', p: 'p', small: 'small', dop: 'dop',
};

const textVariant = (value: UtilityEntry) => {
  if (value === 'inherit') return 'font: inherit; text-transform: inherit; letter-spacing: inherit';
  const token = typeof value === 'string' ? TEXT_VARIANTS[value] : undefined;
  return token ? `font: var(--font-${token}); text-transform: var(--tt-${token}); letter-spacing: var(--ls-${token})` : null;
};

/** Высота строки: число — доля (`1.2` → класс `lineHeight_1.2`) или `normal`. */
const lineHeight = (value: UtilityEntry) => {
  if (value === 'normal') return 'line-height: normal';
  return typeof value === 'number' && Number.isFinite(value) ? `line-height: ${value}` : null;
};

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export const UTILITIES: readonly Utility[] = [
  { name: 'w', declare: lengthOf('width', SIZE_WORDS) },
  { name: 'minW', declare: lengthOf('min-width', SIZE_WORDS) },
  { name: 'maxW', declare: lengthOf('max-width', MAX_WORDS) },
  { name: 'h', declare: lengthOf('height', SIZE_WORDS) },
  { name: 'minH', declare: lengthOf('min-height', SIZE_WORDS) },
  { name: 'maxH', declare: lengthOf('max-height', MAX_WORDS) },

  { name: 'p', declare: spaceOf('padding'), shorthand: true },
  { name: 'pt', declare: spaceOf('padding-top') },
  { name: 'pr', declare: spaceOf('padding-right') },
  { name: 'pb', declare: spaceOf('padding-bottom') },
  { name: 'pl', declare: spaceOf('padding-left') },
  { name: 'm', declare: spaceOf('margin', MARGIN_WORDS), shorthand: true },
  { name: 'mt', declare: spaceOf('margin-top', MARGIN_WORDS) },
  { name: 'mr', declare: spaceOf('margin-right', MARGIN_WORDS) },
  { name: 'mb', declare: spaceOf('margin-bottom', MARGIN_WORDS) },
  { name: 'ml', declare: spaceOf('margin-left', MARGIN_WORDS) },

  { name: 'r', declare: lengthOf('border-radius') },
  { name: 'tlr', declare: lengthOf('border-top-left-radius') },
  { name: 'trr', declare: lengthOf('border-top-right-radius') },
  { name: 'brr', declare: lengthOf('border-bottom-right-radius') },
  { name: 'blr', declare: lengthOf('border-bottom-left-radius') },

  { name: 'bg', declare: literalOf('background') },
  { name: 'color', declare: literalOf('color') },
  { name: 'placeholderColor', declare: literalOf('--field-placeholder-color') },

  { name: 'gap', declare: lengthOf('gap') },
  { name: 'rowGap', declare: lengthOf('row-gap') },
  { name: 'columnGap', declare: lengthOf('column-gap') },

  { name: 'borderW', declare: lengthOf('border-width') },
  { name: 'borderS', ...enumOf('border-style', { solid: 'solid', dashed: 'dashed', dotted: 'dotted', double: 'double', none: 'none' }) },
  { name: 'borderC', declare: literalOf('border-color') },
  { name: 'border', declare: literalOf('border') },
  { name: 'borderT', declare: literalOf('border-top') },
  { name: 'borderR', declare: literalOf('border-right') },
  { name: 'borderB', declare: literalOf('border-bottom') },
  { name: 'borderL', declare: literalOf('border-left') },

  { name: 'dir', ...enumOf('flex-direction', { row: 'row', row_reverse: 'row-reverse', column: 'column', column_reverse: 'column-reverse' }) },
  { name: 'wrap', ...enumOf('flex-wrap', { nowrap: 'nowrap', wrap: 'wrap', wrap_reverse: 'wrap-reverse' }) },
  { name: 'align', ...enumOf('align-items', ALIGN_ITEMS) },
  { name: 'justify', ...enumOf('justify-content', JUSTIFY_CONTENT) },
  { name: 'justifyItems', ...enumOf('justify-items', { start: 'start', end: 'end', center: 'center', stretch: 'stretch' }) },
  { name: 'alignContent', ...enumOf('align-content', { start: 'start', end: 'end', center: 'center', stretch: 'stretch', space_between: 'space-between', space_around: 'space-around', space_evenly: 'space-evenly' }) },
  { name: 'autoFlow', ...enumOf('grid-auto-flow', { row: 'row', column: 'column', dense: 'dense', row_dense: 'row dense', column_dense: 'column dense' }) },

  { name: 'columns', declare: numberOf('grid-template-columns', (n) => `repeat(${n}, minmax(0, 1fr))`) },
  { name: 'rows', declare: numberOf('grid-template-rows', (n) => `repeat(${n}, minmax(0, 1fr))`) },
  { name: 'colSpan', declare: numberOf('grid-column-end', (n) => `span ${n}`) },
  { name: 'rowSpan', declare: numberOf('grid-row-end', (n) => `span ${n}`) },
  { name: 'colStart', declare: numberOf('grid-column-start') },
  { name: 'colEnd', declare: numberOf('grid-column-end') },
  { name: 'rowStart', declare: numberOf('grid-row-start') },
  { name: 'rowEnd', declare: numberOf('grid-row-end') },

  { name: 'text', declare: textVariant, domain: [...Object.keys(TEXT_VARIANTS), 'inherit'] },
  { name: 'fontSize', declare: numberOf('font-size', rpx) },
  { name: 'fontWeight', declare: numberOf('font-weight'), domain: range(100, 900, 100) },
  { name: 'lineHeight', declare: lineHeight },
  { name: 'fontFamily', ...enumOf('font-family', { primary: 'var(--font-primary)', secondary: 'var(--font-secondary)', inherit: 'inherit' }) },
  { name: 'textTransform', ...enumOf('text-transform', { none: 'none', uppercase: 'uppercase', lowercase: 'lowercase', capitalize: 'capitalize' }) },
  { name: 'letterSpacing', declare: numberOf('letter-spacing', rpx) },
  { name: 'textAlign', ...enumOf('text-align', { left: 'left', right: 'right', center: 'center', justify: 'justify', start: 'start', end: 'end' }) },
  { name: 'whiteSpace', ...enumOf('white-space', { normal: 'normal', nowrap: 'nowrap', pre: 'pre', 'pre-wrap': 'pre-wrap', 'pre-line': 'pre-line', 'break-spaces': 'break-spaces' }) },

  { name: 'objectFit', ...enumOf('object-fit', { contain: 'contain', cover: 'cover', fill: 'fill', none: 'none', scale_down: 'scale-down' }) },
  {
    name: 'objectPosition',
    ...enumOf('object-position', {
      center: 'center', top: 'top', bottom: 'bottom', left: 'left', right: 'right',
      top_left: 'top left', top_center: 'top center', top_right: 'top right', center_left: 'center left',
      center_right: 'center right', bottom_left: 'bottom left', bottom_center: 'bottom center', bottom_right: 'bottom right',
    }),
  },

  { name: 'grow', declare: numberOf('flex-grow'), domain: range(0, 12) },
  {
    name: 'ratio',
    declare: (value) => {
      if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? `aspect-ratio: ${value}` : null;
      if (typeof value !== 'string') return null;
      const ratio = value.trim();
      return ratio === 'auto' || /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(ratio) ? `aspect-ratio: ${ratio}` : null;
    },
  },
];

const UTILITY_BY_NAME: ReadonlyMap<string, Utility> = new Map(UTILITIES.map((utility) => [utility.name, utility]));

/** Синонимы, которые компоненты принимают пропом. */
const PROP_ALIASES: Readonly<Record<string, string>> = {
  aspectRatio: 'ratio', borderTLR: 'tlr', borderTRR: 'trr', borderBRR: 'brr', borderBLR: 'blr',
};

/** Утилита по имени пропа, поля объекта или префикса построителя (`c.value('gap', gap)`). */
export const resolveUtility = (name: string): Utility | undefined => UTILITY_BY_NAME.get(PROP_ALIASES[name] ?? name);

const SPACE_UTILITIES = new Set(['p', 'pt', 'pr', 'pb', 'pl', 'm', 'mt', 'mr', 'mb', 'ml']);
const SIZE_UTILITIES = new Set(['w', 'minW', 'maxW', 'h', 'minH', 'maxH']);
const SIZE_KEYWORDS = new Set(['auto', 'fit-content', 'max-content', 'min-content']);

const wasInlineSpace = (entry: unknown): boolean => {
  if (typeof entry === 'number') return entry < 0;
  if (Array.isArray(entry)) return entry.some(wasInlineSpace);
  if (typeof entry !== 'string') return false;
  const value = entry.trim();
  return !(value.includes('calc(') || value === 'auto' || /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value));
};

const wasInlineSize = (entry: unknown): boolean =>
  typeof entry === 'string' && !(SIZE_KEYWORDS.has(entry) || /^\d+%$/.test(entry) || /^\d+(vw|vh|dvw|dvh)$/.test(entry) || entry.includes('calc('));

/**
 * Кортеж, у которого `null` на mobile/tablet НАСЛЕДУЕТ desktop, а не пропускает брейкпоинт. Так
 * вели себя значения, уходившие раньше инлайн-переменными с запасным значением
 * (`var(--m, var(--d))`): любой `grow` и `aspectRatio`, отрицательный отступ, строка размера мимо
 * классов (`'12rem'`, `min()`). Поведение сохранено, чтобы переезд на классы не менял вид экранов.
 */
export function inheritsNull(utility: Utility, tuple: readonly unknown[]): boolean {
  if (utility.name === 'grow' || utility.name === 'ratio') return true;
  if (SPACE_UTILITIES.has(utility.name)) return tuple.some(wasInlineSpace);
  if (SIZE_UTILITIES.has(utility.name)) return tuple.some(wasInlineSize);
  return false;
}

/** Пропущенный desktop у наследующего кортежа: запасное значение прежней переменной (`flex-grow: var(--d, 0)`). */
export const NULL_DESKTOP: Readonly<Record<string, UtilityEntry>> = { grow: 0 };

/** Класс утилиты без брейкпоинта; `null` — значение не подходит. */
export function utilityClassName(utility: Utility, value: UtilityEntry): string | null {
  if (utility.declare(value) === null) return null;
  if (!utility.shorthand && Array.isArray(value)) return null;
  return `${utility.name}_${entryKey(value)}`;
}
