'use client';

import type React from 'react';

import styles from './Container.module.scss';

import { forwardRef, useCallback, type CSSProperties } from 'react';
import { aspectRatioStyle, cx, createLayoutClasses, inlineAspectRatioClassName, inlineGrowClassName, inlineSpaceStyle, needsInlineAspectRatio, needsInlineGrow, sizeClasses, sizeInlineStyle, radiusClasses, resolveBorderClassResolution, resolveBorderStyles, layoutSpaceClasses, stateLinkProps, tokenStyles, growStyle, resolveRadiusInput, type StateLinkInput, type LayoutSpaceProps, type SizePropsShort, type RadiusPropsShort, type BorderStyleProps, type AspectRatioProps, type GrowProps } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

const c = createLayoutClasses([styles, tokenStyles]);

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement>, LayoutSpaceProps, SizePropsShort, RadiusPropsShort, BorderStyleProps, AspectRatioProps, GrowProps, SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;
  className?: string;
  linkState?: StateLinkInput;
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({
    children,
    className = '',
    style,
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
    linkState,
    onMouseEnter,
    onMouseLeave,
    ...props
  }, ref) => {
    const radiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR });
    const borderClassResolution = resolveBorderClassResolution(c, { border, borderC, borderS, borderW, borderT, borderR, borderB, borderL });
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
        styles.Container,
        ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
        ...sizeClasses(c, { w, minW, maxW, h, minH, maxH }),
        ...radiusClasses(c, radiusProps),
        ...borderClassResolution.classes,
        needsInlineAspectRatio(aspectRatio) && inlineAspectRatioClassName(),
        needsInlineGrow(grow) && inlineGrowClassName(),
        className
      )}
      style={{
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
);

Container.displayName = 'Container';
