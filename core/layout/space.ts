import type { CSSProperties } from 'react';
import { resolveResponsive, type ResponsiveValue } from '../base/responsive';
import { CALC_STRING_MAP } from '../_calc-string-map';

/**
 * Значение для space-пропсов (padding, margin):
 * - number     -> токен (будет классом и умножится на var(--rpx) в SCSS)
 * - string     -> keyword / calc / raw CSS string
 *
 * Для строковых shorthand без двусмысленности используйте вложенные массивы.
 * Пример: `m={[[24, 'auto'], 24, [24, 8, 12, 'auto']]}`.
 */
export type SpaceValue = number | string;

export type SpaceShorthandValue =
  | [SpaceValue]
  | [SpaceValue, SpaceValue]
  | [SpaceValue, SpaceValue, SpaceValue]
  | [SpaceValue, SpaceValue, SpaceValue, SpaceValue];

type SpaceEntry = SpaceValue | SpaceShorthandValue;

export type ResponsiveSpaceValue = ResponsiveValue<SpaceEntry> | SpaceShorthandValue;

type InlineSpaceProp = 'p' | 'pt' | 'pr' | 'pb' | 'pl' | 'm' | 'mt' | 'mr' | 'mb' | 'ml';
type InlineSpaceBreakpoint = 'd' | 'm' | 't';
type InlineSpaceCssVar = `--inline-space-${InlineSpaceProp}-${InlineSpaceBreakpoint}`;
type InlineSpaceStyle = CSSProperties & Partial<Record<InlineSpaceCssVar, string>>;

const inlineSpaceClassMap: Record<InlineSpaceProp, string> = {
  p: 'inlineP',
  pt: 'inlinePt',
  pr: 'inlinePr',
  pb: 'inlinePb',
  pl: 'inlinePl',
  m: 'inlineM',
  mt: 'inlineMt',
  mr: 'inlineMr',
  mb: 'inlineMb',
  ml: 'inlineMl',
};

export const inlineSpaceClassName = (prop: InlineSpaceProp): string => inlineSpaceClassMap[prop];

const calcStringKey = (value: string): string => value.replace(/[^\w\-]/g, '').toLowerCase().substring(0, 32);

const spaceValueKey = (value: SpaceValue): string | undefined => {
  if (typeof value === 'number') return value < 0 ? undefined : String(value);

  const normalizedValue = value.trim();

  if (normalizedValue.includes('calc(')) {
    return CALC_STRING_MAP[normalizedValue] ?? calcStringKey(normalizedValue);
  }

  if (normalizedValue === 'auto') return 'auto';

  if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(normalizedValue)) {
    return normalizedValue.toLowerCase();
  }

  return undefined;
};

/**
 * Превращает значение space в "ключ класса" (suffix после `_`).
 * Если вернуть `undefined` — значит значение нужно ставить inline-стилем.
 *
 * Примеры:
 * - 24                                      => "24"                           -> класс `mt_24`
 * - "calc(var(--header-height) * 2)"       => "calcvar--header-height2"      -> класс `mt_calcvar--header-height2`
 * - "calc(var(--footer-height) + var(--s-56))" => "calcvar--footer-heightvar--s-56" -> класс `mt_calcvar--footer-heightvar--s-56`
 * - "auto"                                 => "auto"                         -> класс `mt_auto`
 */
export const spaceClassKey = (v: SpaceValue | SpaceShorthandValue): string | undefined => {
  if (Array.isArray(v)) {
    const expanded = expandSpaceShorthand(v);
    const keys = expanded.map(spaceValueKey);

    if (keys.some((key) => !key)) return undefined;

    // Uniform sides → collapse to single token/class
    if (expanded[0] === expanded[1] && expanded[1] === expanded[2] && expanded[2] === expanded[3]) {
      return keys[0];
    }

    return keys.join('_');
  }

  return spaceValueKey(v);
};

const isSpaceToken = (value: unknown): value is SpaceValue => typeof value === 'number' || typeof value === 'string';

export const isBareSpaceShorthand = (value: unknown): value is SpaceShorthandValue =>
  Array.isArray(value) && value.length === 4 && value.every(isSpaceToken);

const expandSpaceShorthand = (value: SpaceShorthandValue): [SpaceValue, SpaceValue, SpaceValue, SpaceValue] => {
  const [top, right, bottom, left] = value;

  if (right === undefined) return [top, top, top, top];
  if (bottom === undefined) return [top, right, top, right];
  if (left === undefined) return [top, right, bottom, right];

  return [top, right, bottom, left];
};

const formatSpaceToken = (value: SpaceValue): string => (typeof value === 'number' ? `calc(var(--rpx) * ${value})` : value);

const formatSpaceEntry = (value: SpaceEntry | null | undefined): string | undefined => {
  if (value === null || value === undefined) return undefined;

  if (!Array.isArray(value)) return formatSpaceToken(value);

  return expandSpaceShorthand(value).map(formatSpaceToken).join(' ');
};

const resolveResponsiveSpace = (
  value: ResponsiveSpaceValue
): [SpaceValue | SpaceShorthandValue | null, SpaceValue | SpaceShorthandValue | null, SpaceValue | SpaceShorthandValue | null] => {
  if (!Array.isArray(value)) return [value, value, value];
  if (isBareSpaceShorthand(value)) return [value, value, value];

  const [desktop, mobile, tablet] = resolveResponsive(value as ResponsiveValue<SpaceEntry>);

  return [desktop ?? null, mobile ?? null, tablet ?? null];
};

const needsInlineSpaceEntry = (value: SpaceEntry | null | undefined): boolean => {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return spaceClassKey(value) === undefined;
  if (typeof value === 'number') return value < 0;

  return spaceClassKey(value) === undefined;
};

export const needsInlineSpace = (value: ResponsiveSpaceValue | undefined): boolean => {
  if (value === undefined) return false;
  if (!Array.isArray(value)) return needsInlineSpaceEntry(value);
  if (isBareSpaceShorthand(value)) return spaceClassKey(value) === undefined;

  return value.some((entry) => needsInlineSpaceEntry(entry));
};

const setInlineSpaceVariables = (style: InlineSpaceStyle, prop: InlineSpaceProp, value: ResponsiveSpaceValue | undefined) => {
  if (!value || !needsInlineSpace(value)) return;

  const [desktop, mobile, tablet] = resolveResponsiveSpace(value);
  const values: Array<[InlineSpaceBreakpoint, SpaceValue | SpaceShorthandValue | null]> = [
    ['d', desktop],
    ['m', mobile],
    ['t', tablet],
  ];

  for (const [breakpoint, entry] of values) {
    const formattedEntry = formatSpaceEntry(entry);

    if (!formattedEntry) continue;

    style[`--inline-space-${prop}-${breakpoint}`] = formattedEntry;
  }
};

export const inlineSpaceStyle = (values: Partial<Record<InlineSpaceProp, ResponsiveSpaceValue | undefined>>): CSSProperties => {
  const style: InlineSpaceStyle = {};

  setInlineSpaceVariables(style, 'p', values.p);
  setInlineSpaceVariables(style, 'pt', values.pt);
  setInlineSpaceVariables(style, 'pr', values.pr);
  setInlineSpaceVariables(style, 'pb', values.pb);
  setInlineSpaceVariables(style, 'pl', values.pl);
  setInlineSpaceVariables(style, 'm', values.m);
  setInlineSpaceVariables(style, 'mt', values.mt);
  setInlineSpaceVariables(style, 'mr', values.mr);
  setInlineSpaceVariables(style, 'mb', values.mb);
  setInlineSpaceVariables(style, 'ml', values.ml);

  return style;
};
