import type { CSSProperties } from 'react';

import {
  aspectRatioStyle,
  growStyle,
  inlineAspectRatioClassName,
  inlineGrowClassName,
  layoutSpaceClasses,
  needsInlineAspectRatio,
  needsInlineGrow,
  radiusClasses,
  resolveBorderClassResolution,
  resolveBorderStyles,
  resolveRadiusInput,
  responsiveValueHasFullClassCoverage,
  sizeClasses,
  sizeInlineStyle,
  type AspectRatioProps,
  type BorderStyleProps,
  type ClassBuilder,
  type GrowProps,
  type LayoutSpaceProps,
  type RadiusPropsShort,
  type SizePropsShort,
} from '../base/shared-props';
import { inlineSpaceStyle } from './space';

/** Пропсы «коробки», которые одинаково понимает корень любого компонента. */
export interface BoxLayoutProps
  extends LayoutSpaceProps,
    SizePropsShort,
    RadiusPropsShort,
    BorderStyleProps,
    AspectRatioProps,
    GrowProps {
  bg?: string;
}

const BOX_LAYOUT_KEYS = [
  'bg',
  'p', 'pt', 'pr', 'pb', 'pl',
  'm', 'mt', 'mr', 'mb', 'ml',
  'w', 'minW', 'maxW', 'h', 'minH', 'maxH',
  'r', 'tlr', 'trr', 'brr', 'blr', 'borderTLR', 'borderTRR', 'borderBRR', 'borderBLR',
  'border', 'borderC', 'borderS', 'borderW', 'borderT', 'borderR', 'borderB', 'borderL',
  'aspectRatio', 'grow',
] as const satisfies readonly (keyof BoxLayoutProps)[];

export type BoxLayoutKey = (typeof BOX_LAYOUT_KEYS)[number];

const BOX_LAYOUT_KEY_SET: ReadonlySet<string> = new Set(BOX_LAYOUT_KEYS);

/**
 * Делит пропсы на «коробку» и остальное (остальное уходит на DOM-узел). Единственное место,
 * где нужны приведения: TypeScript не сужает тип ключа по членству в Set.
 */
export function splitBoxLayout<P extends BoxLayoutProps>(props: P): { box: BoxLayoutProps; rest: Omit<P, BoxLayoutKey> } {
  const box: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (BOX_LAYOUT_KEY_SET.has(key)) box[key] = value;
    else rest[key] = value;
  }

  return { box: box as BoxLayoutProps, rest: rest as Omit<P, BoxLayoutKey> };
}

/**
 * Как понимать «у фона есть класс» (иначе фон уходит инлайном):
 * - `'first'` — по первому брейкпоинту, как исторически считают Box, Flex, Grid, Button;
 * - `'full'`  — по всем брейкпоинтам, как Text: адаптивный фон без класса на телефоне не теряется.
 */
export type BgCoverage = 'first' | 'full';

export interface BoxLayout {
  classes: (string | false | undefined)[];
  style: CSSProperties;
}

/** Классы и инлайн-стиль корня из пропсов коробки. Не заданный проп ничего не добавляет. */
export function boxLayout(c: ClassBuilder, box: BoxLayoutProps, bgCoverage: BgCoverage = 'first'): BoxLayout {
  const space = { p: box.p, pt: box.pt, pr: box.pr, pb: box.pb, pl: box.pl, m: box.m, mt: box.mt, mr: box.mr, mb: box.mb, ml: box.ml };
  const size = { w: box.w, minW: box.minW, maxW: box.maxW, h: box.h, minH: box.minH, maxH: box.maxH };
  const border = {
    border: box.border, borderC: box.borderC, borderS: box.borderS, borderW: box.borderW,
    borderT: box.borderT, borderR: box.borderR, borderB: box.borderB, borderL: box.borderL,
  };

  const bgClasses = c.literal('bg', box.bg);
  const hasBgClass = bgCoverage === 'full' ? responsiveValueHasFullClassCoverage(box.bg, bgClasses) : Boolean(bgClasses[0]);
  const borderResolution = resolveBorderClassResolution(c, border);

  return {
    classes: [
      ...layoutSpaceClasses(c, space),
      ...radiusClasses(c, resolveRadiusInput(box)),
      ...sizeClasses(c, size),
      ...bgClasses,
      ...borderResolution.classes,
      needsInlineAspectRatio(box.aspectRatio) && inlineAspectRatioClassName(),
      needsInlineGrow(box.grow) && inlineGrowClassName(),
    ],
    style: {
      ...(box.bg && !hasBgClass ? { background: box.bg } : null),
      ...inlineSpaceStyle(space),
      ...sizeInlineStyle(size),
      ...aspectRatioStyle(box.aspectRatio),
      ...growStyle(box.grow),
      ...resolveBorderStyles(border, borderResolution.styleSkips),
    },
  };
}
