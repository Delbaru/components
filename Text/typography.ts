import type { CSSProperties } from 'react';

import styles from './Text.module.scss';

import { resolveResponsive, type ClassBuilder, type ResponsiveValue } from '../core';

export type LineHeightValue = 'normal' | number;

type Breakpoint = 'd' | 'm' | 't';
type InlineLetterSpacingCssVar = `--inline-letter-spacing-${Breakpoint}`;
type InlineLetterSpacingStyle = CSSProperties & Partial<Record<InlineLetterSpacingCssVar, string>>;

const inlineLetterSpacingClassMap: Record<Breakpoint, string> = {
  d: styles.inlineLetterSpacingD,
  m: styles.inlineLetterSpacingM,
  t: styles.inlineLetterSpacingT,
};

const inlineLetterSpacingVarMap: Record<Breakpoint, InlineLetterSpacingCssVar> = {
  d: '--inline-letter-spacing-d',
  m: '--inline-letter-spacing-m',
  t: '--inline-letter-spacing-t',
};

// Значение на 4-шаговой шкале (0..400, кратно 4) имеет токен-класс; иначе — inline CSS-var фолбэк.
export const letterSpacingClassKey = (value: number): string | undefined => {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return undefined;
  if (value < 0 || value > 400 || value % 4 !== 0) return undefined;
  return String(value);
};

export const lineHeightKey = (v: LineHeightValue): string | undefined => {
  if (v === 'normal') return 'normal';
  if (typeof v !== 'number' || Number.isNaN(v)) return undefined;
  const n = Math.round(v * 100);
  if (Math.abs(v * 100 - n) > 1e-6) return undefined;
  if (n < 0 || n > 250) return undefined;
  return String(n);
};

/**
 * letter-spacing: токен-классы для значений на шкале + inline-фолбэк (CSS-var + media-класс) для
 * произвольных px на каждом брейкпоинте. Возвращает классы и inline-стиль для подмешивания в host.
 */
export function resolveLetterSpacing(
  c: ClassBuilder,
  letterSpacing: ResponsiveValue<number> | undefined
): { classes: (string | undefined)[]; style: CSSProperties } {
  const classes: (string | undefined)[] = c.key('letterSpacing', letterSpacing, letterSpacingClassKey);
  if (letterSpacing === undefined) return { classes, style: {} };

  const resolved = resolveResponsive(letterSpacing);
  const style: InlineLetterSpacingStyle = {};

  ([
    ['d', resolved[0]],
    ['m', resolved[1]],
    ['t', resolved[2]],
  ] as const).forEach(([breakpoint, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || letterSpacingClassKey(value)) return;

    classes.push(inlineLetterSpacingClassMap[breakpoint]);
    style[inlineLetterSpacingVarMap[breakpoint]] = `calc(${value} * var(--rpx))`;
  });

  return { classes, style };
}
