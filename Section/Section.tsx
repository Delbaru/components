'use client';

import type React from 'react';

import styles from './Section.module.scss';

import { type CSSProperties } from 'react';
import { boxLayout, createLayoutClasses, cx, splitBoxLayout, stateLinkProps, tokenStyles, useMergedRefs, type BoxLayoutProps, type StateLinkInput, type WithRef } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

const c = createLayoutClasses([styles, tokenStyles]);

/** Коробка секции — подмножество общей: из отступов только вертикальные. */
type SectionBoxKey = 'bg' | 'mt' | 'mb' | 'pt' | 'pb' | 'w' | 'minW' | 'maxW' | 'h' | 'minH' | 'maxH' | 'aspectRatio' | 'grow';

export interface SectionProps extends React.HTMLAttributes<HTMLElement>, Pick<BoxLayoutProps, SectionBoxKey>, SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;
  className?: string;
  linkState?: StateLinkInput;
}

export function Section({ ref, children, className = '', style, perspective3d, parallax, linkState, onMouseEnter, onMouseLeave, ...props }: WithRef<SectionProps, HTMLElement>) {
  const { box, rest } = splitBoxLayout(props);
  const layout = boxLayout(c, box);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const setRefs = useMergedRefs(setMotionNode, ref);

  return (
    <section
      ref={setRefs}
      {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
      className={cx(styles.Section, ...layout.classes, className)}
      style={{ ...layout.style, ...(motionStyle ?? null), ...style }}
      {...rest}
    >
      {children}
    </section>
  );
}
