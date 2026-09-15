'use client';

import type React from 'react';
import { boxLayout, createLayoutClasses, cx, splitBoxLayout, stateLinkProps, useMergedRefs, type AspectRatioProps, type BoxLayoutProps, type GrowProps, type LayoutSpaceProps, type ResponsiveValue, type SizeValue, type StateLinkInput, type WithRef } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

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

const c = createLayoutClasses();

export interface GridProps extends React.HTMLAttributes<HTMLDivElement>, BoxLayoutProps, SharedMotionProps {
  children?: React.ReactNode;

  columns?: ResponsiveValue<Track>;
  rows?: ResponsiveValue<Track>;
  gap?: ResponsiveValue<number>;
  rowGap?: ResponsiveValue<number>;
  columnGap?: ResponsiveValue<number>;

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
  columns,
  rows,
  gap,
  rowGap,
  columnGap,
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
  const { box, rest } = splitBoxLayout(props);
  const layout = boxLayout(c, box);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const setRefs = useMergedRefs(setMotionNode, ref);

  return (
  <div
    ref={setRefs}
    {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
    className={cx(
      'ui-grid',
      ...layout,
      ...c.value('columns', columns),
      ...c.value('rows', rows),
      ...c.value('gap', gap),
      ...c.value('rowGap', rowGap),
      ...c.value('columnGap', columnGap),
      ...c.value('justifyItems', justifyItems),
      ...c.value('align', alignItems),
      ...c.value('alignContent', alignContent),
      ...c.value('autoFlow', autoFlow),
      className
    )}
    style={{
      ...(areas ? { gridTemplateAreas: areas.map((r) => `"${r}"`).join(' ') } : null),
      ...(motionStyle ?? null),
      ...style,
    }}
    {...rest}
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
  perspective3d,
  parallax,
  justifyContent,
  alignItems,
  onMouseEnter,
  onMouseLeave,
  ...props
}: WithRef<GridItemProps, HTMLDivElement>) {
  const { box, rest } = splitBoxLayout(props);
  const layout = boxLayout(c, box);
  const hasFlex = justifyContent !== undefined || alignItems !== undefined;
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const setRefs = useMergedRefs(setMotionNode, ref);

  return (
    <div
      ref={setRefs}
      {...stateLinkProps(undefined, { onMouseEnter, onMouseLeave, ...motionHandlers })}
      className={cx(
        hasFlex && 'ui-grid-item-flex',
        ...c.value('colSpan', colSpan),
        ...c.value('rowSpan', rowSpan),
        ...c.value('colStart', colStart),
        ...c.value('colEnd', colEnd),
        ...c.value('rowStart', rowStart),
        ...c.value('rowEnd', rowEnd),
        ...layout,
        ...c.value('justify', justifyContent),
        ...c.value('align', alignItems),
        className
      )}
      style={{
        ...(area ? { gridArea: area } : null),
        ...(motionStyle ?? null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
