'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type React from 'react';

import styles from './Button.module.scss';

import { boxLayout, createLayoutClasses, cx, resolveLinkProps, shouldUseNextLink, splitBoxLayout, stateLinkProps, stateProps, tokenStyles, useMergedRefs, type BoxLayoutProps, type ComponentStateValue, type ResponsiveValue, type StateLinkInput, type WithRef } from '../core';
import { useAnchoredFloating } from '../hooks/useAnchoredFloating';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

export type ButtonVariant = 'primary' | 'secondary' | 'secondaryFill' | 'tertiary';
export type ButtonSize = 'small' | 'medium' | 'large';

type AlignItemsKey = 'stretch' | 'center' | 'flex_start' | 'flex_end' | 'start' | 'end' | 'baseline';
type JustifyContentKey = 'start' | 'end' | 'center' | 'space_between' | 'space_around' | 'space_evenly';

const c = createLayoutClasses([styles, tokenStyles]);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'href' | 'target' | 'rel'>,
    Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'download'>,
    Omit<BoxLayoutProps, 'aspectRatio'>,
    SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;

  newTab?: boolean;
  nofollow?: boolean;
  noreferrer?: boolean;

  variant?: ResponsiveValue<ButtonVariant>;
  size?: ResponsiveValue<ButtonSize>;

  justifyContent?: ResponsiveValue<JustifyContentKey>;
  alignItems?: ResponsiveValue<AlignItemsKey>;

  gap?: ResponsiveValue<number>;
  color?: string;
  state?: ComponentStateValue;

  linkState?: StateLinkInput;

  /** Tooltip content rendered next to the button on hover */
  tooltip?: React.ReactNode;
  /** Tooltip position relative to the button: right, left, top, bottom. Default: right */
  tooltipDirection?: 'right' | 'left' | 'top' | 'bottom';
  /** Gap between button and tooltip in px. Default: 8 */
  tooltipGap?: number;
}

export function Button({
  ref,
  children,
  className = '',
  style,
  variant,
  size,
  justifyContent,
  alignItems,
  gap,
  perspective3d,
  parallax,
  color,
  state,
  type,
  href,
  target,
  rel,
  download,
  newTab,
  nofollow,
  noreferrer,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  linkState,
  tooltip,
  tooltipDirection = 'right',
  tooltipGap = 8,
  ...props
}: WithRef<ButtonProps, HTMLElement>) {
  const { box, rest } = splitBoxLayout(props);
  const layout = boxLayout(c, box);
  const colorClasses = c.literal('color', color);
  const hasColorClass = Boolean(colorClasses[0]);
  const isLink = Boolean(href);
  const Comp = (isLink ? (shouldUseNextLink(href, target, download) ? Link : 'a') : 'button') as React.ElementType;
  const linkProps = resolveLinkProps({ href, target, rel, download, newTab, nofollow, noreferrer });
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const anchorRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLElement | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const isTooltipActive = Boolean(tooltip) && isTooltipVisible;
  const { placement: tooltipPlacement, isPositioned: isTooltipPositioned, style: tooltipStyle } = useAnchoredFloating({
    anchorRef,
    floatingRef: tooltipRef,
    isActive: isTooltipActive,
    placement: tooltipDirection,
    align: 'center',
    gap: tooltipGap,
    viewportPadding: 8,
  });
  const setRefs = useMergedRefs(anchorRef, setMotionNode, ref);
  const handleMouseEnter = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setIsTooltipVisible(true);
    motionHandlers?.onMouseEnter?.(event);
    onMouseEnter?.(event as React.MouseEvent<HTMLButtonElement>);
  }, [motionHandlers, onMouseEnter]);
  const handleMouseLeave = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setIsTooltipVisible(false);
    motionHandlers?.onMouseLeave?.(event);
    onMouseLeave?.(event as React.MouseEvent<HTMLButtonElement>);
  }, [motionHandlers, onMouseLeave]);
  const handleFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    setIsTooltipVisible(true);
    onFocus?.(event as React.FocusEvent<HTMLButtonElement>);
  }, [onFocus]);
  const handleBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
    setIsTooltipVisible(false);
    onBlur?.(event as React.FocusEvent<HTMLButtonElement>);
  }, [onBlur]);

  useEffect(() => {
    setPortalNode(document.body);
  }, []);

  const anchorProps = isLink
    ? { ...rest, ...linkProps }
    : { ...rest, type: type ?? 'button' };

  let result = (
    <Comp
      ref={setRefs}
      {...stateLinkProps(linkState, {
        onMouseEnter: handleMouseEnter,
        onMouseMove: motionHandlers?.onMouseMove,
        onMouseLeave: handleMouseLeave,
        onFocus: handleFocus,
        onBlur: handleBlur,
      })}
      className={cx(
        styles.Button,
        ...c.enum('variant', variant),
        ...c.enum('size', size),
        ...c.enum('justifyContent', justifyContent),
        ...c.enum('alignItems', alignItems),
        ...c.num('gap', gap),
        ...layout.classes,
        ...colorClasses,
        className
      )}
      style={{
        ...layout.style,
        ...(color && !hasColorClass ? { color } : null),
        ...(motionStyle ?? null),
        ...style,
      }}
      {...stateProps(state)}
      {...anchorProps}
    >
      {children}
    </Comp>
  );

  if (tooltip) {
    const tooltipNode = portalNode ? createPortal(
      <span
        ref={tooltipRef}
        className={styles.ButtonTooltip}
        style={tooltipStyle}
        role='tooltip'
        aria-hidden={!isTooltipActive || !isTooltipPositioned}
        data-placement={tooltipPlacement}
        {...stateProps(isTooltipActive && isTooltipPositioned && 'active')}
      >
        {tooltip}
      </span>,
      portalNode
    ) : null;

    result = (
      <span
        className={styles.ButtonTooltipWrapper}
      >
        {result}
        {tooltipNode}
      </span>
    );
  }

  return result;
}
