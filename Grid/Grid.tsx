'use client';

import { useCallback } from 'react';
import type React from 'react';
import styles from './Grid.module.scss';
import { 
  aspectRatioStyle,
  cx,
  createLayoutClasses,
  inlineAspectRatioClassName,
  inlineGrowClassName,
  resolveBorderClassResolution,
  inlineSpaceStyle,
  growStyle,
  resolveBorderStyles,
  needsInlineAspectRatio,
  needsInlineGrow,
  radiusClasses,
  layoutSpaceClasses,
  sizeClasses,
  sizeInlineStyle,
  stateLinkProps,
  tokenStyles,
  resolveRadiusInput,
  type StateLinkInput,
  type LayoutSpaceProps,
  type SizePropsShort,
  type ResponsiveValue,
  type SizeValue,
  type RadiusPropsShort,
  type AspectRatioProps,
  type GrowProps,
  BorderStyleProps } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import type { WithRef } from '../core';

type Track =
1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12|
13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 |
23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 |
33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 |
43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 | 51 | 52;

type JustifyItemsKey = 'start' | 'end' | 'center' | 'stretch';
type AlignItemsKey = 'start' | 'end' | 'center' | 'stretch';

type ItemJustifyContentKey =
  | 'flex_start'
  | 'flex_end'
  | 'start'
  | 'end'
  | 'center'
  | 'space_between'
  | 'space_around'
  | 'space_evenly';

type ItemAlignItemsKey =
  | 'stretch'
  | 'center'
  | 'flex_start'
  | 'flex_end'
  | 'start'
  | 'end'
  | 'baseline';
type AlignContentKey = 'start' | 'end' | 'center' | 'stretch' | 'space_between' | 'space_around' | 'space_evenly';
type AutoFlowKey = 'row' | 'column' | 'dense' | 'row_dense' | 'column_dense';

const c = createLayoutClasses([styles, tokenStyles]);

export interface GridProps extends React.HTMLAttributes<HTMLDivElement>, LayoutSpaceProps, SizePropsShort, BorderStyleProps, RadiusPropsShort, AspectRatioProps, GrowProps, SharedMotionProps {
  children?: React.ReactNode;

  columns?: ResponsiveValue<Track>;
  rows?: ResponsiveValue<Track>;
  gap?: ResponsiveValue<number>;
  rowGap?: ResponsiveValue<number>;
  columnGap?: ResponsiveValue<number>;

  bg?: string;
  grow?: ResponsiveValue<number>;

  justifyItems?: ResponsiveValue<JustifyItemsKey>;
  alignItems?: ResponsiveValue<AlignItemsKey>;
  alignContent?: ResponsiveValue<AlignContentKey>;
  autoFlow?: ResponsiveValue<AutoFlowKey>;

  areas?: string[];
  items?: Array<GridItemLayout>;
  renderItem?: (item: GridItemLayout, index: number) => React.ReactNode;

  linkState?: StateLinkInput;
}

export function Grid({
  ref,
  children,
  className = '',
  style,
  p,
  pt,
  pr,
  pb,
  pl,
  m,
  mt,
  mr,
  mb,
  ml,
  columns,
  rows,
  gap,
  rowGap,
  columnGap,
  bg,
  r,
  tlr,
  trr,
  brr,
  blr,
  border, borderC, borderS, borderW, borderT, borderR, borderB, borderL,
  borderTLR,
  borderTRR,
  borderBRR,
  borderBLR,
  h,
  minH,
  maxH,
  w,
  minW,
  maxW,
  aspectRatio,
  grow,
  perspective3d,
  parallax,
  justifyItems,
  alignItems,
  alignContent,
  autoFlow,
  areas,
  items,
  renderItem,
  linkState,
  onMouseEnter,
  onMouseLeave,
  ...props
}: WithRef<GridProps, HTMLDivElement>) {
  const radiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR });
  const bgClasses = c.literal('bg', bg);
  const borderClassResolution = resolveBorderClassResolution(c, { border, borderC, borderS, borderW, borderT, borderR, borderB, borderL });
  const hasBgClass = Boolean(bgClasses[0]);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setMotionNode(node);

    if (typeof ref === 'function') {
      ref(node);
      return;
    }

    if (ref) {
      ref.current = node;
    }
  }, [ref, setMotionNode]);

  return (
  <div
    ref={setRefs}
    {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
    className={cx(
      styles.Grid,
      ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
      ...c.num('columns', columns),
      ...c.num('rows', rows),
      ...c.num('gap', gap),
      ...c.num('rowGap', rowGap),
      ...c.num('columnGap', columnGap),
      ...sizeClasses(c, { w, h, minW, maxW, minH, maxH }),
      ...radiusClasses(c, radiusProps),
      ...c.enum('justifyItems', justifyItems),
      ...c.enum('alignItems', alignItems),
      ...c.enum('alignContent', alignContent),
      ...c.enum('autoFlow', autoFlow),
      ...bgClasses,
      ...borderClassResolution.classes,
      needsInlineAspectRatio(aspectRatio) && inlineAspectRatioClassName(),
      needsInlineGrow(grow) && inlineGrowClassName(),
      className
    )}
    style={{
      ...(areas ? { gridTemplateAreas: areas.map((r) => `"${r}"`).join(' ') } : null),
      ...(bg && !hasBgClass ? { background: bg } : null),
      ...inlineSpaceStyle({ p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
      ...sizeInlineStyle({ w, minW, maxW, h, minH, maxH }),
      ...aspectRatioStyle(aspectRatio),
      ...resolveBorderStyles({ border, borderC, borderS, borderW, borderT, borderR, borderB, borderL }, borderClassResolution.styleSkips),
      ...growStyle(grow),
      ...(motionStyle ?? null),
      ...style,
    }}
    {...props}
  >
    {renderItem && items
      ? items.map((item, index) => (
          <GridItem
            key={item.key ?? index}
            area={item.area}
            colSpan={item.colSpan}
            rowSpan={item.rowSpan}
            colStart={item.colStart}
            colEnd={item.colEnd}
            rowStart={item.rowStart}
            rowEnd={item.rowEnd}
            h={item.h}
            w={item.w}
            grow={item.grow}
            aspectRatio={item.aspectRatio}
            className={item.className}
            style={item.style}
          >
            {renderItem(item, index)}
          </GridItem>
        ))
      : children}
  </div>
  );
}

// 1..13 (13 is useful as "end line" for 12-column grid)
type Line = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12|
13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 |
23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 |
33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 |
43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 | 51 | 52;

export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement>, LayoutSpaceProps, AspectRatioProps, GrowProps, SharedMotionProps {
  children?: React.ReactNode;

  area?: string;

  colSpan?: ResponsiveValue<Track>;
  rowSpan?: ResponsiveValue<Track>;

  colStart?: ResponsiveValue<Line>;
  colEnd?: ResponsiveValue<Line>;
  rowStart?: ResponsiveValue<Line>;
  rowEnd?: ResponsiveValue<Line>;

  h?: ResponsiveValue<SizeValue>;
  w?: ResponsiveValue<SizeValue>;
  maxH?: ResponsiveValue<SizeValue>;
  maxW?: ResponsiveValue<SizeValue>;
  grow?: ResponsiveValue<number>;

  justifyContent?: ResponsiveValue<ItemJustifyContentKey>;
  alignItems?: ResponsiveValue<ItemAlignItemsKey>;
}

export interface GridItemLayout {
  key?: React.Key;
  className?: string;
  style?: React.CSSProperties;

  area?: string;

  colSpan?: ResponsiveValue<Track>;
  rowSpan?: ResponsiveValue<Track>;

  colStart?: ResponsiveValue<Line>;
  colEnd?: ResponsiveValue<Line>;
  rowStart?: ResponsiveValue<Line>;
  rowEnd?: ResponsiveValue<Line>;

  h?: ResponsiveValue<SizeValue>;
  w?: ResponsiveValue<SizeValue>;
  grow?: ResponsiveValue<number>;
  aspectRatio?: AspectRatioProps['aspectRatio'];

  justifyContent?: ResponsiveValue<ItemJustifyContentKey>;
  alignItems?: ResponsiveValue<ItemAlignItemsKey>;
}

export function GridItem({
  ref,
  children,
  className = '',
  style,
  area,
  colSpan,
  rowSpan,
  colStart,
  colEnd,
  rowStart,
  rowEnd,
  h,
  w,
  maxH,
  maxW,
  m,
  mt,
  mr,
  mb,
  ml,
  grow,
  aspectRatio,
  perspective3d,
  parallax,
  justifyContent,
  alignItems,
  onMouseEnter,
  onMouseLeave,
  ...props
}: WithRef<GridItemProps, HTMLDivElement>) {
  const hasFlex = justifyContent !== undefined || alignItems !== undefined;
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setMotionNode(node);

    if (typeof ref === 'function') {
      ref(node);
      return;
    }

    if (ref) {
      ref.current = node;
    }
  }, [ref, setMotionNode]);

  return (
    <div
      ref={setRefs}
      {...stateLinkProps(undefined, { onMouseEnter, onMouseLeave, ...motionHandlers })}
      className={cx(
        styles.GridItem,
        hasFlex && styles.GridItemFlex,
        ...c.num('colSpan', colSpan),
        ...c.num('rowSpan', rowSpan),
        ...c.num('colStart', colStart),
        ...c.num('colEnd', colEnd),
        ...c.num('rowStart', rowStart),
        ...c.num('rowEnd', rowEnd),
        ...c.size('height', h),
        ...c.size('width', w),
        ...c.size('maxHeight', maxH),
        ...c.size('maxWidth', maxW),
        ...layoutSpaceClasses(c, { m, mt, mr, mb, ml }),
        ...c.enum('itemJustifyContent', justifyContent),
        ...c.enum('itemAlignItems', alignItems),
        needsInlineAspectRatio(aspectRatio) && inlineAspectRatioClassName(),
        needsInlineGrow(grow) && inlineGrowClassName(),
        className
      )}
      style={{
        ...(area ? { gridArea: area } : null),
        ...sizeInlineStyle({ h, w, maxH, maxW }),
        ...inlineSpaceStyle({ m, mt, mr, mb, ml }),
        ...aspectRatioStyle(aspectRatio),
        ...growStyle(grow),
        ...(motionStyle ?? null),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
