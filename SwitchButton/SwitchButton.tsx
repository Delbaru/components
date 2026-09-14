'use client';

import { forwardRef, useCallback, useId, type CSSProperties } from 'react';
import type React from 'react';
import styles from './SwitchButton.module.scss';
import { cx, createLayoutClasses, growStyle, inlineGrowClassName, inlineSpaceStyle, stateProps, needsInlineGrow, layoutSpaceClasses, stateLinkProps, tokenStyles, type ComponentStateValue, type StateLinkInput, type LayoutSpaceProps, type ResponsiveValue, type GrowProps } from '../core';
import { Flex } from '../Flex';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

const c = createLayoutClasses([styles, tokenStyles]);

export interface SwitchButtonProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>, LayoutSpaceProps, GrowProps, SharedMotionProps {
  style?: CSSProperties;
  children?: React.ReactNode;
  gap?: ResponsiveValue<number>;
  state?: ComponentStateValue;
  'data-point-events'?: string;
  linkState?: StateLinkInput;
}

export const SwitchButton = forwardRef<HTMLInputElement, SwitchButtonProps>(
  (
    {
      className = '',
      style,
      children,
      gap,
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
      grow,
      perspective3d,
      parallax,
      id: idProp,
      state,
      linkState,
      'data-point-events': dataPointEvents,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const isDisabled = Boolean(props.disabled);
    const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
    const setRootRef = useCallback((node: HTMLLabelElement | null) => {
      setMotionNode(node);
    }, [setMotionNode]);

    return (
      <label
        ref={setRootRef}
        htmlFor={id}
        data-point-events={dataPointEvents}
        {...(!isDisabled ? stateLinkProps(linkState, { ...motionHandlers }) : {})}
        className={cx(
          styles.SwitchButton,
          ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
          needsInlineGrow(grow) && inlineGrowClassName(),
          className
        )}
        style={{ ...inlineSpaceStyle({ p, pt, pr, pb, pl, m, mt, mr, mb, ml }), ...growStyle(grow), ...(motionStyle ?? null), ...style }}
        {...stateProps(state, isDisabled && 'disabled')}
      >
        <Flex gap={gap ?? 8} align="center">
          <input ref={ref} id={id} type="checkbox" className={styles.Input} {...props} />
          <Flex align="center" className={styles.Track} aria-hidden>
            <span className={styles.Thumb} />
          </Flex>
          {children}
        </Flex>
      </label>
    );
  }
);

SwitchButton.displayName = 'SwitchButton';
