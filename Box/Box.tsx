'use client';

import { type CSSProperties } from 'react';
import type React from 'react';
import styles from './Box.module.scss';
import { boxLayout, createLayoutClasses, cx, splitBoxLayout, stateLinkProps, useMergedRefs, type BoxLayoutProps, type ResponsiveValue, type StateLinkInput, type WithRef } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

type JustifyContentKey = 'start' | 'end' | 'center' | 'space_between' | 'space_around' | 'space_evenly';

const c = createLayoutClasses(styles);

export interface BoxProps extends React.HTMLAttributes<HTMLDivElement>, BoxLayoutProps, SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;

  justify?: ResponsiveValue<JustifyContentKey>;
  linkState?: StateLinkInput;
}

export function Box({
  ref,
  children,
  className = '',
  style,
  perspective3d,
  parallax,
  justify,
  onMouseEnter,
  onMouseLeave,
  linkState,
  ...props
}: WithRef<BoxProps, HTMLDivElement>) {
  const { box, rest } = splitBoxLayout(props);
  const layout = boxLayout(c, box);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const setRefs = useMergedRefs(setMotionNode, ref);

  return (
    <div
      ref={setRefs}
      {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
      className={cx(styles.Box, ...layout, ...c.value('justify', justify), className)}
      style={{ ...(motionStyle ?? null), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
