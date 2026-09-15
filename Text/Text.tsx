'use client';
'use no memo';

import Link from 'next/link';
import type React from 'react';
import { useRef, type CSSProperties } from 'react';

import { boxLayout, buildClampStyle, createLayoutClasses, cx, normalizeComponentState, resolveLinkProps, shouldUseNextLink, splitBoxLayout, stateLinkProps, useMergedRefs, type BoxLayoutProps, type ComponentStateValue, type ResponsiveValue, type StateLinkInput, type WithRef } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import { resolveAnimation } from './animations/resolveAnimation';
import type { AnimationInput } from './animations/types';
import type { LineHeightValue } from './typography';
import { resolveTextContent, type TextFormat } from './formatContent';
import { bindTextContent } from './nonBreaking';

/** 'inherit' — не навязывать типографику: для Text внутри Text (цветные куски чужого заголовка). */
type VariantKey = 'h1' | 'h2' | 'h3' | 'h4' | 'p1' | 'p2' | 'p3' | 'subtitle' | 'title' | 'p' | 'small' | 'dop' | 'inherit';
type FontFamilyKey = 'primary' | 'secondary' | 'inherit';
type TextAlignValue = 'left' | 'right' | 'center' | 'justify' | 'start' | 'end';
type WhiteSpaceValue = 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line' | 'break-spaces';

const c = createLayoutClasses();

export interface TextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'color'>,
    Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'download'>,
    Omit<BoxLayoutProps, 'aspectRatio'>,
    SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;
  format?: ResponsiveValue<TextFormat>;
  animate?: ResponsiveValue<AnimationInput>;
  required?: boolean;

  newTab?: boolean;
  nofollow?: boolean;
  noreferrer?: boolean;

  as?: keyof React.JSX.IntrinsicElements;
  variant?: ResponsiveValue<VariantKey>;
  animation?: ResponsiveValue<AnimationInput>;

  fontSize?: ResponsiveValue<number>;
  fontWeight?: ResponsiveValue<number>;
  lineHeight?: ResponsiveValue<LineHeightValue>;
  fontFamily?: ResponsiveValue<FontFamilyKey>;

  color?: string;
  textTransform?: ResponsiveValue<string>;
  letterSpacing?: ResponsiveValue<number>;
  textAlign?: ResponsiveValue<TextAlignValue>;
  whiteSpace?: ResponsiveValue<WhiteSpaceValue>;
  rows?: ResponsiveValue<number>;
  ellipsis?: boolean;

  state?: ComponentStateValue;

  linkState?: StateLinkInput;
}

export function Text({
  ref,
  as = 'div',
  variant = 'p',
  animation,
  animate,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
  perspective3d,
  parallax,
  color,
  textTransform,
  letterSpacing,
  textAlign,
  whiteSpace,
  rows,
  ellipsis,
  state,
  className = '',
  style,
  children,
  format = 'default',
  required = false,
  linkState,
  onMouseEnter,
  onMouseLeave,
  ...props
}: WithRef<TextProps, HTMLElement>) {
  'use no memo';
  const { box, rest } = splitBoxLayout(props);
  const layout = boxLayout(c, box);
  const aProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    download?: string | boolean;
    newTab?: boolean;
    nofollow?: boolean;
    noreferrer?: boolean;
  };
  const { href, target, rel, download, newTab, nofollow, noreferrer, ...anchorRestProps } = aProps;

  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });

  const internalRef = useRef<HTMLElement | null>(null);
  const setRef = useMergedRefs(internalRef, setMotionNode, ref);

  // Контент и анимация: формат строки → плагин анимации из реестра (или контент как есть).
  const content = resolveTextContent(children, format);
  const anim = resolveAnimation(animation ?? animate, content);

  // Классы и inline-стиль host'а — коробка из ядра (boxLayout), типографика здесь. Алгоритмика (letter-spacing,
  // формат, разбор анимации) вынесена в ./typography, ./formatContent, ./animations.
  const clampStyle = buildClampStyle(rows);
  const hasRows = rows !== undefined;
  const hasSingleLineEllipsis = Boolean(ellipsis) && !hasRows;

  const inline: CSSProperties = {
    ...clampStyle,
    ...(motionStyle ?? null),
  };

  const normalizedState = normalizeComponentState(state);
  const sharedHandlerProps = stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers });

  const effectiveAs = href ? 'a' : as;
  const isAnchor = effectiveAs === 'a';
  const Comp = (isAnchor && shouldUseNextLink(href, target, download) ? Link : effectiveAs) as React.ElementType;
  const linkProps = isAnchor ? resolveLinkProps({ href, target, rel, download, newTab, nofollow, noreferrer }) : {};
  const anchorProps = isAnchor ? { ...anchorRestProps, ...linkProps } : rest;

  const coreClasses = [
    ...c.value('text', variant),
    ...c.value('fontSize', fontSize),
    ...c.value('fontWeight', fontWeight),
    ...c.value('lineHeight', lineHeight),
    ...c.value('fontFamily', fontFamily),
    ...c.value('textTransform', textTransform),
    ...c.value('letterSpacing', letterSpacing),
    ...c.value('textAlign', textAlign),
    ...c.value('whiteSpace', whiteSpace),
    ...layout,
    ...c.value('color', color),
  ];

  // clamp/ellipsis/required не сочетаются с анимациями — добавляем их только в неанимированном пути.
  const classNames = anim.active
    ? cx('ui-text', ...coreClasses, className)
    : cx(
        'ui-text',
        ...coreClasses,
        required && 'ui-text-required',
        hasRows && 'ui-text-clamp',
        hasSingleLineEllipsis && 'ui-text-ellipsis',
        className
      );

  return (
    <Comp
      ref={setRef}
      {...sharedHandlerProps}
      {...(normalizedState ? { state: normalizedState } : undefined)}
      className={classNames}
      style={{ ...inline, ...style }}
      {...anchorProps}
    >
      {anim.active && anim.Inner ? <anim.Inner content={content} options={anim.options} /> : bindTextContent(content)}
    </Comp>
  );
}
