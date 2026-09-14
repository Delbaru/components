'use client';

import Link from 'next/link';
import { forwardRef, useCallback, useEffect, useState, type CSSProperties } from 'react';
import type React from 'react';
import styles from './Flex.module.scss';
import { 
  aspectRatioStyle,
  stateLinkProps,
  cx, createLayoutClasses,
  inlineAspectRatioClassName,
  inlineGrowClassName,
  inlineSpaceStyle,
  growStyle,
  layoutSpaceClasses,
  needsInlineAspectRatio,
  needsInlineGrow,
  sizeClasses,
  sizeInlineStyle,
  radiusClasses,
  resolveBorderClassResolution,
  resolveBorderStyles,
  resolveLinkProps,
  shouldUseNextLink,
  tokenStyles,
  stateProps,
  resolveRadiusInput,
  type ComponentStateValue,
  type StateLinkInput,
  type LayoutSpaceProps,
  type SizePropsShort,
  type RadiusPropsShort,
  type BorderStyleProps,
  type ResponsiveValue,
  type AspectRatioProps,
  type GrowProps } from '../core';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import { usePresence } from '../hooks/usePresence';
import { useSwapTransition } from '../hooks/useSwapTransition';
import { resolveResponsive } from '../core/base/responsive';

type DirectionKey = 'row' | 'row_reverse' | 'column' | 'column_reverse';
type WrapKey = 'nowrap' | 'wrap' | 'wrap_reverse';
type AlignItemsKey = 'stretch' | 'center' | 'flex_start' | 'flex_end' | 'start' | 'end' | 'baseline';
type JustifyContentKey = 'start' | 'end' | 'center' | 'space_between' | 'space_around' | 'space_evenly';
export type FlexEnterAnimation = 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'fadeInScale';
export type FlexAnimation = FlexEnterAnimation | 'fadeOut' | 'fadeOutUp' | 'fadeOutDown' | 'fadeOutScale';

const c = createLayoutClasses([styles, tokenStyles]);

// Реестр анимаций (CSS-keyframes в Flex.module.scss). Явная мапа вместо вычисляемого
// доступа к styles — типобезопасно и не зависит от того, как затипизирован CSS-модуль.
const animationClasses: Record<FlexAnimation, string | undefined> = {
  fadeIn: styles.anim_fadeIn,
  fadeInUp: styles.anim_fadeInUp,
  fadeInDown: styles.anim_fadeInDown,
  fadeInScale: styles.anim_fadeInScale,
  fadeOut: styles.anim_fadeOut,
  fadeOutUp: styles.anim_fadeOutUp,
  fadeOutDown: styles.anim_fadeOutDown,
  fadeOutScale: styles.anim_fadeOutScale,
};

// Exit — зеркало enter (для свопа через transitionKey): въезжает сверху → уходит вверх и т.д.
const exitAnimationOf: Partial<Record<FlexAnimation, FlexAnimation>> = {
  fadeIn: 'fadeOut',
  fadeInDown: 'fadeOutUp',
  fadeInUp: 'fadeOutDown',
  fadeInScale: 'fadeOutScale',
};

export interface FlexProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'dir' | 'href' | 'target' | 'rel' | 'download'>,
    Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'download'>,
    LayoutSpaceProps,
    SizePropsShort,
    RadiusPropsShort,
    BorderStyleProps,
    AspectRatioProps,
    GrowProps,
    SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;
  bg?: string;
  state?: ComponentStateValue;

  gap?: ResponsiveValue<number>;
  rowGap?: ResponsiveValue<number>;
  columnGap?: ResponsiveValue<number>;

  /** Опт-ин сворачивание по высоте (grid-rows) с presence: true — контент монтируется и плавно
   *  раскрывается, false — плавно сворачивается и УДАЛЯЕТСЯ из DOM по завершении анимации.
   *  Состояние держите снаружи (Redux/вью-модель) — размонтирование его не теряет. */
  collapse?: boolean;
  /** Верхний отступ сворачиваемого блока (дизайн-единицы, responsive — [d, m, t]).
   *  Анимируется вместе с высотой, поэтому заменяет родительский gap. Работает с collapse. */
  collapseGap?: ResponsiveValue<number>;
  /** Колбэк по завершении анимации сворачивания/раскрытия (transitionend по grid-template-rows).
   *  Нужен потребителям, которым важен момент «анимация завершилась» (доизмерение SVG-коннекторов,
   *  скролл/фокус после раскрытия, размонтирование контента после сворачивания). Работает с collapse. */
  onCollapseEnd?: (event: React.TransitionEvent<HTMLDivElement>) => void;
  /** Плавное затухание содержимого (opacity 0↔1) синхронно с высотой. Работает с collapse. */
  collapseFade?: boolean;
  /** После завершения раскрытия снять overflow:hidden с клипа (для выпадающих меню/дропдаунов
   *  внутри сворачиваемого блока). Во время анимации overflow остаётся скрытым. Работает с collapse. */
  collapseOverflowVisible?: boolean;
  /** Узел, ПОЯВИВШИЙСЯ от действия (новая строка списка), выезжает вместо появления кадром.
   *  Опт-ин: иначе первый кадр списка стал бы парадом раскрытий. Читается при монтировании. */
  collapseAppear?: boolean;
  /** Ось сворачивания: 'row' — по высоте (grid-template-rows, по умолчанию), 'column' — по ширине
   *  (grid-template-columns). collapseGap при этом анимирует padding-left вместо padding-top. Работает с collapse. */
  collapseAxis?: 'row' | 'column';

  /** Enter-анимация. Без transitionKey — играет один раз при монтировании (появление контента).
   *  С transitionKey — служит enter'ом свопа (exit берётся зеркально). reduced-motion гасит. */
  animation?: FlexAnimation;
  /** Идентификатор контента для свопа в стиле AnimatePresence mode='wait' БЕЗ библиотеки: при его смене
   *  старый контент проигрывает exit (зеркало animation), затем подменяется новым с enter. Анимация идёт
   *  на самом узле Flex (без обёрток и ремоунта). Состояние держите снаружи — своп его не теряет. */
  transitionKey?: string | number;

  dir?: ResponsiveValue<DirectionKey>;
  justify?: ResponsiveValue<JustifyContentKey>;
  align?: ResponsiveValue<AlignItemsKey>;
  wrap?: ResponsiveValue<WrapKey>;

  /** Краевой fade скролл-контейнера: вешает глобальную утилиту .scrollFadeY (ось Y — при scrollFade или
   *  scrollFade='y') либо .scrollFadeX (scrollFade='x') — mask + scroll-driven animations, без JS
   *  (см. tokens.global.scss). Ставится на сам скроллящийся Flex; overflow задаёте как обычно. ВАЖНО:
   *  mask создаёт stacking context — плавающие оверлеи держите на элементе-обёртке, не на самом скролле. */
  scrollFade?: boolean | 'x' | 'y';

  container?: boolean;
  linkState?: StateLinkInput;
  newTab?: boolean;
  nofollow?: boolean;
  noreferrer?: boolean;
}

export const Flex = forwardRef<HTMLElement, FlexProps>(
  ({
    children,
    className = '',
    style,
    bg,
    p, pt, pr, pb, pl,
    m, mt, mr, mb, ml,
    border, borderC, borderS, borderW, borderT, borderR, borderB, borderL,
    gap, rowGap, columnGap,
    collapse, collapseGap, onCollapseEnd, collapseFade, collapseOverflowVisible, collapseAxis, collapseAppear,
    animation, transitionKey,
    dir, justify, align, wrap,
    scrollFade,
    r, tlr, trr, brr, blr,
    borderTLR, borderTRR, borderBRR, borderBLR,
    w, minW, maxW, h, minH, maxH,
    aspectRatio,
    grow,
    perspective3d,
    parallax,
    container,
    state,
    onMouseEnter, onMouseLeave,
    href, target, rel, download, newTab, nofollow, noreferrer,
    linkState,
    ...props
  }, ref) => {
    const radiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR });
    const bgClasses = c.literal('bg', bg);
    const borderClassResolution = resolveBorderClassResolution(c, { border, borderC, borderS, borderW, borderT, borderR, borderB, borderL });
    const hasBgClass = Boolean(bgClasses[0]);
    const isLink = Boolean(href);
    const Comp = (isLink ? (shouldUseNextLink(href, target, download) ? Link : 'a') : 'div') as React.ElementType;
    const resolved = resolveLinkProps({ href, target, rel, download, newTab, nofollow, noreferrer });
    const anchorProps = isLink ? { ...props, ...resolved } : props;
    const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
    // Своп контента по transitionKey (exit→enter на самом узле). Без transitionKey — passthrough.
    const { displayChildren, exiting, onAnimationEnd: onSwapAnimationEnd, ref: swapNodeRef } = useSwapTransition(transitionKey, children);
    const swapping = transitionKey !== undefined;
    const activeAnimation = swapping && exiting && animation ? (exitAnimationOf[animation] ?? animation) : animation;
    const setRefs = useCallback((node: HTMLElement | null) => {
      setMotionNode(node);
      swapNodeRef.current = node;

      if (typeof ref === 'function') {
        ref(node);
        return;
      }

      if (ref) {
        ref.current = node;
      }
    }, [ref, setMotionNode, swapNodeRef]);

    const content = (
      <Comp
        ref={setRefs}
        {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
        className={cx(
          styles.Flex,
          container && styles.container,
          ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
          ...radiusClasses(c, radiusProps),
          ...c.num('gap', gap),
          ...c.num('rowGap', rowGap),
          ...c.num('columnGap', columnGap),
          ...sizeClasses(c, { w, minW, maxW, h, minH, maxH }),
          ...c.enum('flexDirection', dir),
          ...c.enum('justifyContent', justify),
          ...c.enum('alignItems', align),
          ...c.enum('flexWrap', wrap),
          scrollFade && (scrollFade === 'x' ? 'scrollFadeX' : 'scrollFadeY'),
          activeAnimation && animationClasses[activeAnimation],
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
        {...stateProps(state)}
        {...anchorProps}
        {...(swapping ? { onAnimationEnd: onSwapAnimationEnd } : null)}
      >
        {displayChildren}
      </Comp>
    );

    if (collapse === undefined) {
      return content;
    }

    // Опт-ин сворачивание: оборачиваем во внешний grid (анимирует высоту + верхний отступ)
    // и внутренний clip (overflow:hidden). Стили самого Flex (включая minH) остаются на нём
    // внутри клипа, поэтому min-height блока не мешает схлопыванию до нуля.
    return (
      <CollapseWrap
        open={collapse}
        axis={collapseAxis}
        collapseGap={collapseGap}
        fade={collapseFade}
        overflowVisibleWhenOpen={collapseOverflowVisible}
        appear={collapseAppear}
        onCollapseEnd={onCollapseEnd}
      >
        {content}
      </CollapseWrap>
    );
  }
);

Flex.displayName = 'Flex';

interface CollapseWrapProps {
  open: boolean;
  axis?: 'row' | 'column';
  collapseGap?: ResponsiveValue<number>;
  fade?: boolean;
  overflowVisibleWhenOpen?: boolean;
  appear?: boolean;
  onCollapseEnd?: (event: React.TransitionEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

// Обёртка сворачивания на presence-движке (usePresence): контент монтируется при раскрытии и
// УДАЛЯЕТСЯ из DOM по завершении сворачивания. Внешний grid анимирует grid-template-rows (0fr↔1fr) +
// padding-top, внутренний div клипает (overflow:hidden, min-height:0). visualOpen — текущее визуальное
// состояние (с учётом mount-закрытым→flip-в-open), settledOpen нужен только для overflowVisibleWhenOpen:
// overflow снимаем лишь ПОСЛЕ окончания раскрытия (иначе во время анимации содержимое «вылезет» из клипа),
// и возвращаем сразу при начале сворачивания.
function CollapseWrap({ open, axis = 'row', collapseGap, fade, overflowVisibleWhenOpen, appear, onCollapseEnd, children }: CollapseWrapProps) {
  const { mounted, open: visualOpen, onTransitionEnd: onPresenceTransitionEnd, property, ref } = usePresence<HTMLDivElement>(open, axis, appear);
  const [settledOpen, setSettledOpen] = useState(open);

  useEffect(() => {
    if (!visualOpen) setSettledOpen(false);
  }, [visualOpen]);

  if (!mounted) return null;

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    // Жизненный цикл presence (размонтирование по окончании сворачивания).
    onPresenceTransitionEnd(event);
    // Игнорируем всплывшие transitionend дочерних узлов (напр. opacity-fade) и не-осевые свойства.
    if (event.target !== event.currentTarget) return;
    if (event.propertyName !== property) return;
    if (visualOpen) setSettledOpen(true);
    onCollapseEnd?.(event);
  };

  // collapseGap → responsive CSS-переменные (--collapse-gap-d/-m/-t); null-брейкпоинты
  // наследуют desktop в SCSS. Padding-top на обёртке анимируется вместе с высотой.
  const collapseStyle: Record<string, string> = {};
  if (collapseGap != null) {
    const [gapD, gapM, gapT] = resolveResponsive(collapseGap);
    if (gapD != null) collapseStyle['--collapse-gap-d'] = `calc(${gapD} * var(--rpx))`;
    if (gapM != null) collapseStyle['--collapse-gap-m'] = `calc(${gapM} * var(--rpx))`;
    if (gapT != null) collapseStyle['--collapse-gap-t'] = `calc(${gapT} * var(--rpx))`;
  }

  return (
    <div
      ref={ref}
      className={cx(styles.collapseWrap, fade && styles.collapseFade)}
      data-axis={axis}
      data-open={visualOpen || undefined}
      inert={!visualOpen}
      onTransitionEnd={handleTransitionEnd}
      style={collapseStyle as CSSProperties}
    >
      <div className={cx(styles.collapseInner, overflowVisibleWhenOpen && settledOpen && styles.collapseOverflowVisible)}>
        {children}
      </div>
    </div>
  );
}

