'use client';

import type React from 'react';

import styles from './Section.module.scss';

import { type CSSProperties } from 'react';
import { aspectRatioStyle, cx, createLayoutClasses, inlineAspectRatioClassName, inlineGrowClassName, inlineSpaceStyle, needsInlineAspectRatio, needsInlineGrow, sizeClasses, sizeInlineStyle, stateLinkProps, tokenStyles, growStyle, type StateLinkInput, type ResponsiveValue, type SpaceValue, type SizePropsShort, type AspectRatioProps, type GrowProps, type WithRef, useMergedRefs } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

const c = createLayoutClasses([styles, tokenStyles]);


export interface SectionProps extends React.HTMLAttributes<HTMLElement>, SizePropsShort, AspectRatioProps, GrowProps, SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;
  className?: string;

  mt?: ResponsiveValue<SpaceValue>;
  mb?: ResponsiveValue<SpaceValue>;
  pt?: ResponsiveValue<SpaceValue>;
  pb?: ResponsiveValue<SpaceValue>;

  bg?: string;
  linkState?: StateLinkInput;
}

export function Section({ ref, children, className = '', style, bg, mt, mb, pt, pb, w, minW, maxW, h, minH, maxH, aspectRatio, grow, perspective3d, parallax, linkState, onMouseEnter, onMouseLeave, ...props }: WithRef<SectionProps, HTMLElement>) {
  const bgClasses = c.literal('bg', bg);
  const hasBgClass = Boolean(bgClasses[0]);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const setRefs = useMergedRefs(setMotionNode, ref);

  return (
    <section
      ref={setRefs}
      {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
      className={cx(
        styles.Section,
        ...c.space('mt', mt),
        ...c.space('mb', mb),
        ...c.space('pt', pt),
        ...c.space('pb', pb),
        ...sizeClasses(c, { w, minW, maxW, h, minH, maxH }),
        ...bgClasses,
        needsInlineAspectRatio(aspectRatio) && inlineAspectRatioClassName(),
        needsInlineGrow(grow) && inlineGrowClassName(),
        className
      )}
      style={{
        ...(bg && !hasBgClass ? { background: bg } : null),
        ...inlineSpaceStyle({ mt, mb, pt, pb }),
        ...sizeInlineStyle({ w, minW, maxW, h, minH, maxH }),
        ...aspectRatioStyle(aspectRatio),
        ...growStyle(grow),
        ...(motionStyle ?? null),
        ...style,
      }}
      {...props}
    >
      {children}
    </section>
  );
}

