'use client';
'use no memo';

import Link from 'next/link';
import type React from 'react';
import { forwardRef, useCallback, useRef, type CSSProperties } from 'react';

import styles from './Text.module.scss';

import { cx, createLayoutClasses, inlineGrowClassName, inlineSpaceStyle, growStyle, buildClampStyle, normalizeComponentState, layoutSpaceClasses, radiusClasses, resolveBorderClassResolution, resolveBorderStyles, resolveLinkProps, shouldUseNextLink, sizeClasses, sizeInlineStyle, stateLinkProps, tokenStyles, needsInlineGrow, resolveRadiusInput, responsiveValueHasFullClassCoverage, type BorderStyleProps, type ComponentStateValue, type StateLinkInput, type LayoutSpaceProps, type RadiusPropsShort, type SizePropsShort, type ResponsiveValue, type GrowProps } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import { resolveAnimation } from './animations/resolveAnimation';
import type { AnimationInput } from './animations/types';
import { resolveLetterSpacing, lineHeightKey, type LineHeightValue } from './typography';
import { resolveTextContent, type TextFormat } from './formatContent';
import { bindTextContent } from './nonBreaking';

/** 'inherit' — не навязывать типографику: для Text внутри Text (цветные куски чужого заголовка). */
type VariantKey = 'h1' | 'h2' | 'h3' | 'h4' | 'p1' | 'p2' | 'p3' | 'subtitle' | 'title' | 'p' | 'small' | 'dop' | 'inherit';
type FontFamilyKey = 'primary' | 'secondary' | 'inherit';
type TextAlignValue = 'left' | 'right' | 'center' | 'justify' | 'start' | 'end';
type WhiteSpaceValue = 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line' | 'break-spaces';

const c = createLayoutClasses([styles, tokenStyles]);

export interface TextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'color'>,
    Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'download'>,
    LayoutSpaceProps,
    RadiusPropsShort,
    BorderStyleProps,
    SizePropsShort,
    GrowProps,
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
  bg?: string;

  state?: ComponentStateValue;

  linkState?: StateLinkInput;
}

export const Text = forwardRef<HTMLElement, TextProps>(
  (
    {
      as = 'div',
      variant = 'p',
      animation,
      animate,
      fontSize,
      fontWeight,
      lineHeight,
      fontFamily,
      w,
      h,
      minW,
      maxW,
      minH,
      maxH,
      grow,
      perspective3d,
      parallax,
      color,
      textTransform,
      letterSpacing,
      textAlign,
      whiteSpace,
      rows,
      ellipsis,
      bg,
      state,
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
      border,
      borderC,
      borderS,
      borderW,
      borderT,
      borderR,
      borderB,
      borderL,
      r,
      tlr,
      trr,
      brr,
      blr,
      borderTLR,
      borderTRR,
      borderBRR,
      borderBLR,
      className = '',
      style,
      children,
      format = 'default',
      required = false,
      linkState,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    'use no memo';
    const aProps = props as React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      download?: string | boolean;
      newTab?: boolean;
      nofollow?: boolean;
      noreferrer?: boolean;
    };
    const { href, target, rel, download, newTab, nofollow, noreferrer, ...anchorRestProps } = aProps;

    const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });

    const internalRef = useRef<HTMLElement | null>(null);
    const setRef = useCallback(
      (el: HTMLElement | null) => {
        internalRef.current = el;
        setMotionNode(el);
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
      },
      [ref, setMotionNode]
    );

    // Контент и анимация: формат строки → плагин анимации из реестра (или контент как есть).
    const content = resolveTextContent(children, format);
    const anim = resolveAnimation(animation ?? animate, content);

    // Классы и inline-стиль host'а собираются из core-хелперов (как во Flex). Алгоритмика (letter-spacing,
    // формат, разбор анимации) вынесена в ./typography, ./formatContent, ./animations.
    const letterSpacingResolved = resolveLetterSpacing(c, letterSpacing);

    const clampStyle = buildClampStyle(rows);
    const hasRows = rows !== undefined;
    const hasSingleLineEllipsis = Boolean(ellipsis) && !hasRows;

    const radiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR });
    const bgClasses = c.literal('bg', bg);
    const colorClasses = c.literal('color', color);
    const borderClassResolution = resolveBorderClassResolution(c, { border, borderC, borderS, borderW, borderT, borderR, borderB, borderL });
    const hasBgClass = responsiveValueHasFullClassCoverage(bg, bgClasses);
    const hasColorClass = responsiveValueHasFullClassCoverage(color, colorClasses);

    const inline: CSSProperties = {
      ...(bg && !hasBgClass ? { background: bg } : null),
      ...(color && !hasColorClass ? { color } : null),
      ...letterSpacingResolved.style,
      ...inlineSpaceStyle({ p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
      ...sizeInlineStyle({ w, h, minW, maxW, minH, maxH }),
      ...growStyle(grow),
      ...resolveBorderStyles({ border, borderC, borderS, borderW, borderT, borderR, borderB, borderL }, borderClassResolution.styleSkips),
      ...clampStyle,
      ...(motionStyle ?? null),
    };

    const normalizedState = normalizeComponentState(state);
    const sharedHandlerProps = stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers });

    const effectiveAs = href ? 'a' : as;
    const isAnchor = effectiveAs === 'a';
    const Comp = (isAnchor && shouldUseNextLink(href, target, download) ? Link : effectiveAs) as React.ElementType;
    const linkProps = isAnchor ? resolveLinkProps({ href, target, rel, download, newTab, nofollow, noreferrer }) : {};
    const anchorProps = isAnchor ? { ...anchorRestProps, ...linkProps } : props;

    const coreClasses = [
      ...c.enum('variant', variant),
      ...c.num('fontSize', fontSize),
      ...c.num('fontWeight', fontWeight),
      ...c.key('lineHeight', lineHeight, lineHeightKey),
      ...c.enum('fontFamily', fontFamily),
      ...sizeClasses(c, { w, h, minW, maxW, minH, maxH }),
      ...c.enum('textTransform', textTransform),
      ...letterSpacingResolved.classes,
      ...c.enum('textAlign', textAlign),
      ...c.enum('whiteSpace', whiteSpace),
      ...bgClasses,
      ...colorClasses,
      ...borderClassResolution.classes,
      ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
      ...radiusClasses(c, radiusProps),
      needsInlineGrow(grow) && inlineGrowClassName(),
    ];

    // clamp/ellipsis/required не сочетаются с анимациями — добавляем их только в неанимированном пути.
    const classNames = anim.active
      ? cx(styles.Text, ...coreClasses, className)
      : cx(
          styles.Text,
          ...coreClasses,
          required && styles.required,
          hasRows && styles.clamp,
          hasSingleLineEllipsis && styles.ellipsis,
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
);

Text.displayName = 'Text';
