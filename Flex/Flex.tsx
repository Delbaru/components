'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import type React from 'react';
import { boxLayout, createLayoutClasses, cx, resolveLinkProps, shouldUseNextLink, splitBoxLayout, stateLinkProps, stateProps, useMergedRefs, type BoxLayoutProps, type ComponentStateValue, type ResponsiveValue, type StateLinkInput, type WithRef } from '../core';
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

const c = createLayoutClasses();

// Реестр анимаций (keyframes в _flex.scss): значение пропа → глобальный класс.
const animationClasses: Record<FlexAnimation, string | undefined> = {
  fadeIn: 'ui-anim-fadeIn',
  fadeInUp: 'ui-anim-fadeInUp',
  fadeInDown: 'ui-anim-fadeInDown',
  fadeInScale: 'ui-anim-fadeInScale',
  fadeOut: 'ui-anim-fadeOut',
  fadeOutUp: 'ui-anim-fadeOutUp',
  fadeOutDown: 'ui-anim-fadeOutDown',
  fadeOutScale: 'ui-anim-fadeOutScale',
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
    BoxLayoutProps,
    SharedMotionProps {
  children?: React.ReactNode;
  style?: CSSProperties;
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

export function Flex({
  ref,
  children,
  className = '',
  style,
  gap, rowGap, columnGap,
  collapse, collapseGap, onCollapseEnd, collapseFade, collapseOverflowVisible, collapseAxis, collapseAppear,
  animation, transitionKey,
  dir, justify, align, wrap,
  scrollFade,
  perspective3d,
  parallax,
  container,
  state,
  onMouseEnter, onMouseLeave,
  href, target, rel, download, newTab, nofollow, noreferrer,
  linkState,
  ...props
}: WithRef<FlexProps, HTMLElement>) {
  const { box, rest } = splitBoxLayout(props);
  const layout = boxLayout(c, box);
  const isLink = Boolean(href);
  const Comp = (isLink ? (shouldUseNextLink(href, target, download) ? Link : 'a') : 'div') as React.ElementType;
  const resolved = resolveLinkProps({ href, target, rel, download, newTab, nofollow, noreferrer });
  const anchorProps = isLink ? { ...rest, ...resolved } : rest;
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  // Своп контента по transitionKey (exit→enter на самом узле). Без transitionKey — passthrough.
  const { displayChildren, exiting, onAnimationEnd: onSwapAnimationEnd, ref: swapNodeRef } = useSwapTransition(transitionKey, children);
  const swapping = transitionKey !== undefined;
  const activeAnimation = swapping && exiting && animation ? (exitAnimationOf[animation] ?? animation) : animation;
  const setRefs = useMergedRefs(setMotionNode, swapNodeRef, ref);

  const content = (
    <Comp
      ref={setRefs}
      {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
      className={cx(
        'ui-flex',
        container && 'ui-flex-container',
        ...layout,
        ...c.value('gap', gap),
        ...c.value('rowGap', rowGap),
        ...c.value('columnGap', columnGap),
        ...c.value('dir', dir),
        ...c.value('justify', justify),
        ...c.value('align', align),
        ...c.value('wrap', wrap),
        scrollFade && (scrollFade === 'x' ? 'scrollFadeX' : 'scrollFadeY'),
        activeAnimation && animationClasses[activeAnimation],
        className
      )}
      style={{
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
      className={cx('ui-collapse', fade && 'ui-collapse-fade')}
      data-axis={axis}
      data-open={visualOpen || undefined}
      inert={!visualOpen}
      onTransitionEnd={handleTransitionEnd}
      style={collapseStyle as CSSProperties}
    >
      <div className={cx('ui-collapse-inner', overflowVisibleWhenOpen && settledOpen && 'ui-collapse-visible')}>
        {children}
      </div>
    </div>
  );
}

