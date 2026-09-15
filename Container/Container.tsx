'use client';

import type React from 'react';

import styles from './Container.module.scss';

import { type CSSProperties } from 'react';
import { boxLayout, createLayoutClasses, cx, splitBoxLayout, stateLinkProps, useMergedRefs, type AspectRatioProps, type BorderStyleProps, type GrowProps, type LayoutSpaceProps, type RadiusPropsShort, type SizePropsShort, type StateLinkInput, type WithRef } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

const c = createLayoutClasses(styles);

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement>, LayoutSpaceProps, SizePropsShort, RadiusPropsShort, BorderStyleProps, AspectRatioProps, GrowProps, SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;
  className?: string;
  linkState?: StateLinkInput;
}

export function Container({
  ref,
  children,
  className = '',
  style,
  perspective3d,
  parallax,
  linkState,
  onMouseEnter,
  onMouseLeave,
  ...props
}: WithRef<ContainerProps, HTMLDivElement>) {
  const { box, rest } = splitBoxLayout(props);
  const layout = boxLayout(c, box);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const setRefs = useMergedRefs(setMotionNode, ref);

  return (
    <div
      ref={setRefs}
      {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
      className={cx(styles.Container, ...layout, className)}
      style={{ ...(motionStyle ?? null), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
