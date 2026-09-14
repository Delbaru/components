import type { CSSProperties } from 'react';
import type { ResponsiveValue } from './responsive';
import type { ResponsiveSpaceValue, SpaceValue } from '../layout/space';
import type { SizeValue } from '../layout/size';
import { resolveResponsive } from './responsive';
import { inlineSizeStyle } from '../layout/size';
import { tokenStyles } from '../token-classes';

// ── Class builder interface (matches createLayoutClasses return) ──

type SizePrefix = 'width' | 'minWidth' | 'maxWidth' | 'height' | 'minHeight' | 'maxHeight';

export interface ClassBuilder {
  num(prefix: string, value: ResponsiveValue<number> | undefined): (string | undefined)[];
  enum(prefix: string, value: ResponsiveValue<string> | undefined): (string | undefined)[];
  size(prefix: SizePrefix, value: ResponsiveValue<SizeValue> | undefined): (string | undefined)[];
  space(prefix: string, value: ResponsiveSpaceValue | undefined): (string | undefined)[];
  bg(prefix: string, value: ResponsiveValue<string> | undefined): (string | undefined)[];
  literal(prefix: string, value: ResponsiveValue<string> | undefined): (string | undefined)[];
  key<T>(prefix: string, value: ResponsiveValue<T> | undefined, toKey: (v: T) => string | undefined): (string | undefined)[];
}

// ── Prop interfaces ─────────────────────────────────────

/** Space props for layout components (SpaceValue = number | string for directional). */
export interface LayoutSpaceProps {
  p?: ResponsiveSpaceValue;
  pt?: ResponsiveValue<SpaceValue>;
  pr?: ResponsiveValue<SpaceValue>;
  pb?: ResponsiveValue<SpaceValue>;
  pl?: ResponsiveValue<SpaceValue>;
  m?: ResponsiveSpaceValue;
  mt?: ResponsiveValue<SpaceValue>;
  mr?: ResponsiveValue<SpaceValue>;
  mb?: ResponsiveValue<SpaceValue>;
  ml?: ResponsiveValue<SpaceValue>;
}

/** @deprecated Use LayoutSpaceProps. Kept as a compatibility alias while consumers migrate. */
export type NumericSpaceProps = LayoutSpaceProps;

/** Canonical size props. */
export interface SizePropsShort {
  w?: ResponsiveValue<SizeValue>;
  minW?: ResponsiveValue<SizeValue>;
  maxW?: ResponsiveValue<SizeValue>;
  h?: ResponsiveValue<SizeValue>;
  minH?: ResponsiveValue<SizeValue>;
  maxH?: ResponsiveValue<SizeValue>;
}

export type SizeInput = SizePropsShort;

/** Canonical radius props. */
export interface RadiusPropsLegacy {
  borderTLR?: ResponsiveValue<number>;
  borderTRR?: ResponsiveValue<number>;
  borderBRR?: ResponsiveValue<number>;
  borderBLR?: ResponsiveValue<number>;
}

export interface RadiusPropsShort extends RadiusPropsLegacy {
  r?: ResponsiveValue<number>;
  tlr?: ResponsiveValue<number>;
  trr?: ResponsiveValue<number>;
  brr?: ResponsiveValue<number>;
  blr?: ResponsiveValue<number>;
}

export type RadiusInput = RadiusPropsShort;

export const resolveRadiusInput = (radius: RadiusInput): RadiusInput => ({
  r: radius.r,
  tlr: radius.tlr ?? radius.borderTLR,
  trr: radius.trr ?? radius.borderTRR,
  brr: radius.brr ?? radius.borderBRR,
  blr: radius.blr ?? radius.borderBLR,
});

/** Border style props (inline CSS). */
export interface BorderStyleProps {
  border?: ResponsiveValue<string>;
  borderC?: ResponsiveValue<string>;
  borderS?: ResponsiveValue<string>;
  borderW?: ResponsiveValue<string | number>;
  borderT?: ResponsiveValue<string>;
  borderR?: ResponsiveValue<string>;
  borderB?: ResponsiveValue<string>;
  borderL?: ResponsiveValue<string>;
}

/** Aspect ratio props (inline CSS). */
export type AspectRatioValue = Exclude<CSSProperties['aspectRatio'], undefined>;

export interface AspectRatioProps {
  aspectRatio?: ResponsiveValue<AspectRatioValue>;
}

export interface GrowProps {
  grow?: ResponsiveValue<number>;
}

export interface BorderStyleSkipMap {
  border?: boolean;
  borderC?: boolean;
  borderS?: boolean;
  borderW?: boolean;
  borderT?: boolean;
  borderR?: boolean;
  borderB?: boolean;
  borderL?: boolean;
}

export interface BorderClassResolution {
  classes: (string | undefined)[];
  styleSkips: BorderStyleSkipMap;
}

type InlineAspectRatioBreakpoint = 'd' | 'm' | 't';
type InlineAspectRatioCssVar = `--inline-aspect-ratio-${InlineAspectRatioBreakpoint}`;
type InlineAspectRatioStyle = CSSProperties & Partial<Record<InlineAspectRatioCssVar, string>>;
type InlineGrowBreakpoint = 'd' | 'm' | 't';
type InlineGrowCssVar = `--inline-flex-grow-${InlineGrowBreakpoint}`;
type InlineGrowStyle = CSSProperties & Partial<Record<InlineGrowCssVar, string>>;

// ── Class generation helpers ────────────────────────────

export const layoutSpaceClasses = (c: ClassBuilder, s: LayoutSpaceProps): (string | undefined)[] => [
  ...c.space('p', s.p), ...c.space('pt', s.pt), ...c.space('pr', s.pr), ...c.space('pb', s.pb), ...c.space('pl', s.pl),
  ...c.space('m', s.m), ...c.space('mt', s.mt), ...c.space('mr', s.mr), ...c.space('mb', s.mb), ...c.space('ml', s.ml),
];

/** @deprecated Use layoutSpaceClasses. Kept as a compatibility alias while consumers migrate. */
export const numericSpaceClasses = layoutSpaceClasses;

export const sizeClasses = (c: ClassBuilder, s: SizeInput): (string | undefined)[] => [
  ...c.size('width', s.w), ...c.size('minWidth', s.minW), ...c.size('maxWidth', s.maxW),
  ...c.size('height', s.h), ...c.size('minHeight', s.minH), ...c.size('maxHeight', s.maxH),
];

export const radiusClasses = (c: ClassBuilder, r: RadiusInput): (string | undefined)[] => {
  const normalizedRadius = resolveRadiusInput(r);

  return [
    ...c.num('borderRadius', normalizedRadius.r),
    ...c.num('borderTopLeftRadius', normalizedRadius.tlr),
    ...c.num('borderTopRightRadius', normalizedRadius.trr),
    ...c.num('borderBottomRightRadius', normalizedRadius.brr),
    ...c.num('borderBottomLeftRadius', normalizedRadius.blr),
  ];
};

export const borderClasses = (c: ClassBuilder, b: BorderStyleProps): (string | undefined)[] => [
  ...c.num('borderWidth', b.borderW as ResponsiveValue<number> | undefined),
  ...c.enum('borderStyle', b.borderS),
  ...c.literal('borderColor', b.borderC as ResponsiveValue<string> | undefined),
];

export const literalClassKey = (value: string): string | undefined => {
  const normalizedValue = value.trim();

  if (!normalizedValue) return undefined;

  return normalizedValue.replace(/[^a-zA-Z0-9\-]/g, '') || undefined;
};

export const responsiveValueHasFullClassCoverage = <T,>(
  value: ResponsiveValue<T> | undefined,
  classes: (string | undefined)[]
): boolean => {
  if (value === undefined) return false;

  if (!Array.isArray(value)) {
    return Boolean(classes[0]);
  }

  const resolved = resolveResponsive(value);

  return resolved.every((entry, index) => entry === null || Boolean(classes[index]));
};

export const resolveBorderClassResolution = (c: ClassBuilder, b: BorderStyleProps): BorderClassResolution => {
  const borderWidthTokenClasses = c.num('borderWidth', b.borderW as ResponsiveValue<number> | undefined);
  const borderStyleTokenClasses = c.enum('borderStyle', b.borderS);
  const borderColorTokenClasses = c.literal('borderColor', b.borderC as ResponsiveValue<string> | undefined);
  const borderLiteralClasses = c.literal('border', b.border as ResponsiveValue<string> | undefined);
  const borderTopLiteralClasses = c.literal('borderTop', b.borderT as ResponsiveValue<string> | undefined);
  const borderRightLiteralClasses = c.literal('borderRight', b.borderR as ResponsiveValue<string> | undefined);
  const borderBottomLiteralClasses = c.literal('borderBottom', b.borderB as ResponsiveValue<string> | undefined);
  const borderLeftLiteralClasses = c.literal('borderLeft', b.borderL as ResponsiveValue<string> | undefined);

  return {
    classes: [
      ...borderWidthTokenClasses,
      ...borderStyleTokenClasses,
      ...borderColorTokenClasses,
      ...borderLiteralClasses,
      ...borderTopLiteralClasses,
      ...borderRightLiteralClasses,
      ...borderBottomLiteralClasses,
      ...borderLeftLiteralClasses,
    ],
    styleSkips: {
      borderW: responsiveValueHasFullClassCoverage(b.borderW, borderWidthTokenClasses),
      borderS: responsiveValueHasFullClassCoverage(b.borderS, borderStyleTokenClasses),
      borderC: responsiveValueHasFullClassCoverage(b.borderC, borderColorTokenClasses),
      border: responsiveValueHasFullClassCoverage(b.border, borderLiteralClasses),
      borderT: responsiveValueHasFullClassCoverage(b.borderT, borderTopLiteralClasses),
      borderR: responsiveValueHasFullClassCoverage(b.borderR, borderRightLiteralClasses),
      borderB: responsiveValueHasFullClassCoverage(b.borderB, borderBottomLiteralClasses),
      borderL: responsiveValueHasFullClassCoverage(b.borderL, borderLeftLiteralClasses),
    },
  };
};

// ── Inline style helpers ────────────────────────────────

export const sizeInlineStyle = (s: SizeInput): CSSProperties =>
  inlineSizeStyle({
    width: s.w,
    minWidth: s.minW,
    maxWidth: s.maxW,
    height: s.h,
    minHeight: s.minH,
    maxHeight: s.maxH,
  });

export const aspectRatioStyle = <T extends AspectRatioValue>(
  aspectRatio: ResponsiveValue<T> | undefined
): CSSProperties => {
  if (aspectRatio === undefined) return {};

  if (!Array.isArray(aspectRatio)) {
    return { aspectRatio } as CSSProperties;
  }

  const [desktop, mobile, tablet] = resolveResponsive(aspectRatio);
  const result: InlineAspectRatioStyle = {};

  if (desktop !== null) result['--inline-aspect-ratio-d'] = String(desktop);
  if (mobile !== null && mobile !== desktop) result['--inline-aspect-ratio-m'] = String(mobile);
  if (tablet !== null && tablet !== desktop) result['--inline-aspect-ratio-t'] = String(tablet);
  if (desktop !== null) result.aspectRatio = 'var(--inline-aspect-ratio-d)';

  return result as CSSProperties;
};

export const needsInlineAspectRatio = <T extends AspectRatioValue>(
  aspectRatio: ResponsiveValue<T> | undefined
): boolean => Array.isArray(aspectRatio);

export const inlineAspectRatioClassName = (): string | undefined => tokenStyles.inlineAspectRatio;

export const needsInlineGrow = (grow: ResponsiveValue<number> | undefined): boolean => Array.isArray(grow);

export const inlineGrowClassName = (): string | undefined => tokenStyles.inlineFlexGrow;

export const growStyle = (grow: ResponsiveValue<number> | undefined): CSSProperties => {
  if (grow === undefined) return {};

  if (!Array.isArray(grow)) {
    return { flexGrow: grow } as CSSProperties;
  }

  const [desktop, mobile, tablet] = resolveResponsive(grow);
  const style: InlineGrowStyle = {};

  if (desktop !== null) style['--inline-flex-grow-d'] = String(desktop);
  if (mobile !== null && mobile !== desktop) style['--inline-flex-grow-m'] = String(mobile);
  if (tablet !== null && tablet !== desktop) style['--inline-flex-grow-t'] = String(tablet);

  return style as CSSProperties;
};

export const resolveBorderStyles = (b: BorderStyleProps, skip: BorderStyleSkipMap = {}): CSSProperties => {
  const result: Record<string, unknown> = {};

  const entries: [keyof BorderStyleSkipMap, ResponsiveValue<string | number> | undefined, string, string][] = [
    ['borderC', b.borderC, 'borderColor', '--border-color'], ['borderS', b.borderS, 'borderStyle', '--border-style'],
    ['borderW', b.borderW, 'borderWidth', '--border-width'], ['border', b.border, 'border', '--border'],
    ['borderT', b.borderT, 'borderTop', '--border-top'], ['borderR', b.borderR, 'borderRight', '--border-right'],
    ['borderB', b.borderB, 'borderBottom', '--border-bottom'], ['borderL', b.borderL, 'borderLeft', '--border-left'],
  ];

  for (const [propName, prop, cssKey, cssVar] of entries) {
    if (skip[propName]) continue;
    if (!prop) continue;
    const [d, m, t] = resolveResponsive(prop);
    const fmt = (v: string | number | null) => (v === null ? undefined : typeof v === 'number' ? `${v}px` : v);

    const dVal = fmt(d);
    const mVal = fmt(m);
    const tVal = fmt(t);

    if (!Array.isArray(prop)) {
      // Non-responsive — direct CSS property (backwards-compatible)
      if (dVal !== undefined) result[cssKey] = dVal;
    } else {
      // Responsive — use CSS variables with media-query cascade
      if (dVal !== undefined) result[`${cssVar}-d`] = dVal;
      if (mVal !== undefined && mVal !== dVal) result[`${cssVar}-m`] = mVal;
      if (tVal !== undefined && tVal !== dVal) result[`${cssVar}-t`] = tVal;
      result[cssKey] = `var(${cssVar}-d)`;
    }
  }
  return result as CSSProperties;
};
