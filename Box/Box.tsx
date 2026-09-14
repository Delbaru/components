'use client';

import { useCallback, type CSSProperties } from 'react';
import type React from 'react';
import styles from './Box.module.scss';
import { aspectRatioStyle, stateLinkProps, cx, createLayoutClasses, inlineAspectRatioClassName, inlineGrowClassName, inlineSpaceStyle, growStyle, layoutSpaceClasses, needsInlineAspectRatio, needsInlineGrow, sizeClasses, sizeInlineStyle, radiusClasses, resolveBorderClassResolution, resolveBorderStyles, tokenStyles, resolveRadiusInput, type StateLinkInput, type LayoutSpaceProps, type SizePropsShort, type RadiusPropsShort, type BorderStyleProps, type ResponsiveValue, type AspectRatioProps, type GrowProps } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import type { WithRef } from '../core';

type JustifyContentKey = 'start' | 'end' | 'center' | 'space_between' | 'space_around' | 'space_evenly';

const c = createLayoutClasses([styles, tokenStyles]);

export interface BoxProps extends React.HTMLAttributes<HTMLDivElement>, LayoutSpaceProps, SizePropsShort, RadiusPropsShort, BorderStyleProps, AspectRatioProps, GrowProps, SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;

  justify?: ResponsiveValue<JustifyContentKey>;
  bg?: string;
  linkState?: StateLinkInput;
}

export function Box({
  ref,
  children,
  className = '',
  style,
  bg,
  p, pt, pr, pb, pl,
  m, mt, mr, mb, ml,
  border, borderC, borderS, borderW, borderT, borderR, borderB, borderL,
  r, tlr, trr, brr, blr,
  borderTLR, borderTRR, borderBRR, borderBLR,
  w, minW, maxW, h, minH, maxH,
  aspectRatio,
  grow,
  perspective3d,
  parallax,
  justify,
  onMouseEnter,
  onMouseLeave,
  linkState,
  ...props
}: WithRef<BoxProps, HTMLDivElement>) {
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
        styles.Box,
        ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
        ...radiusClasses(c, radiusProps),
        ...sizeClasses(c, { w, minW, maxW, h, minH, maxH }),
        ...c.enum('justifyContent', justify),
        ...bgClasses,
        ...borderClassResolution.classes,
        needsInlineAspectRatio(aspectRatio) && inlineAspectRatioClassName(),
        needsInlineGrow(grow) && inlineGrowClassName(),
        className
      )}
      style={{
        ...(bg && !hasBgClass ? { background: bg } : null),
        ...inlineSpaceStyle({ p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
        ...sizeInlineStyle({ w, minW, maxW, h, minH, maxH }),
        ...aspectRatioStyle(aspectRatio),
        ...growStyle(grow),
        ...resolveBorderStyles({ border, borderC, borderS, borderW, borderT, borderR, borderB, borderL }, borderClassResolution.styleSkips),
        ...(motionStyle ?? null),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

