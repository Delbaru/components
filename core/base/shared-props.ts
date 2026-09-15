import type { CSSProperties } from 'react';
import type { ClassBuilder } from '../layout/layout-classes';
import type { SizeValue } from '../layout/size';
import type { ResponsiveSpaceValue, SpaceValue } from '../layout/space';
import type { ResponsiveValue } from './responsive';

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

/** Border props: each value becomes a utility class. */
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

export type AspectRatioValue = Exclude<CSSProperties['aspectRatio'], undefined>;

export interface AspectRatioProps {
  aspectRatio?: ResponsiveValue<AspectRatioValue>;
}

export interface GrowProps {
  grow?: ResponsiveValue<number>;
}

// ── Class helpers ───────────────────────────────────────

export const layoutSpaceClasses = (c: ClassBuilder, s: LayoutSpaceProps): string[] => [
  ...c.value('p', s.p), ...c.value('pt', s.pt), ...c.value('pr', s.pr), ...c.value('pb', s.pb), ...c.value('pl', s.pl),
  ...c.value('m', s.m), ...c.value('mt', s.mt), ...c.value('mr', s.mr), ...c.value('mb', s.mb), ...c.value('ml', s.ml),
];

/** @deprecated Use layoutSpaceClasses. Kept as a compatibility alias while consumers migrate. */
export const numericSpaceClasses = layoutSpaceClasses;

export const sizeClasses = (c: ClassBuilder, s: SizeInput): string[] => [
  ...c.value('w', s.w), ...c.value('minW', s.minW), ...c.value('maxW', s.maxW),
  ...c.value('h', s.h), ...c.value('minH', s.minH), ...c.value('maxH', s.maxH),
];

export const radiusClasses = (c: ClassBuilder, r: RadiusInput): string[] => {
  const radius = resolveRadiusInput(r);
  return [
    ...c.value('r', radius.r),
    ...c.value('tlr', radius.tlr),
    ...c.value('trr', radius.trr),
    ...c.value('brr', radius.brr),
    ...c.value('blr', radius.blr),
  ];
};

export const borderClasses = (c: ClassBuilder, b: BorderStyleProps): string[] => [
  ...c.value('borderW', b.borderW),
  ...c.value('borderS', b.borderS),
  ...c.value('borderC', b.borderC),
  ...c.value('border', b.border),
  ...c.value('borderT', b.borderT),
  ...c.value('borderR', b.borderR),
  ...c.value('borderB', b.borderB),
  ...c.value('borderL', b.borderL),
];
