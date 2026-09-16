'use client';

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { cx, MOTION_END_BUFFER_MS, prefersReducedMotion } from '../../core';
import type { IconAnimate, IconSwapOptions } from './types';

// Дефолты по стилю. 'spin' — быстрее и с доворотом: глиф уходит вращаясь+сжимаясь, новый
// доворачивает из того же угла в 0 (рецепт бейджа SolutionCard/BannerSlideCard как стиль Icon).
const SWAP_DEFAULTS = { duration: 0.3, scale: 0.8, rotate: 0 } as const;
const SPIN_DEFAULTS = { duration: 0.18, scale: 0.5, rotate: 45 } as const;

// Стабильный id для компонент-иконок (SVGR): key свопа должен быть string|number, а компонент — объект.
// WeakMap не держит ссылку и не течёт при размонтировании.
const componentKeys = new WeakMap<object, number>();
let nextComponentKey = 0;

/** Идентичность компонент-иконки для ключа свопа (разные компоненты → разный key → своп). */
export function componentSwapKey(component: object): number {
  let key = componentKeys.get(component);
  if (key === undefined) {
    key = nextComponentKey++;
    componentKeys.set(component, key);
  }
  return key;
}

function swapKindOf(animate: IconAnimate | undefined): 'swap' | 'spin' | null {
  const key = Array.isArray(animate) ? animate[0] : animate;
  return key === 'swap' || key === 'spin' ? key : null;
}

function swapOptionsOf(animate: IconAnimate | undefined): IconSwapOptions | undefined {
  return Array.isArray(animate) && animate.length >= 2 ? animate[1] : undefined;
}

interface SwapState {
  /** Снимок уходящей иконки во время фазы OUT; null — не-OUT фаза (показываем новую). */
  outgoing: ReactNode | null;
  /** Счётчик свопов: React-ключ слоёв, чтобы CSS-keyframes перезапускались на каждой смене. */
  generation: number;
  /** true сразу после завершения OUT — включает анимацию въезда у нового слоя. */
  entering: boolean;
}

/**
 * Последовательная смена иконки (режим `wait`): при смене идентичности сначала СТАРАЯ полностью уходит
 * (opacity→0 + scale вниз), и только ПОСЛЕ этого въезжает НОВАЯ (scale→1 + opacity→1). В любой момент
 * на экране один центрированный слой — наложения нет. Общая длительность = 2 × duration.
 *
 * Ключ продвигается только когда контент новой иконки готов (`ready`): до этого держим старую, поэтому
 * пустого кадра при async-загрузке SVG нет. Первый рендер не анимируется. reduced-motion → мгновенная
 * подмена. Стиль 'spin' — то же, но быстрее и с доворотом (rotate). Отключено (`animate` без
 * 'swap'/'spin') — passthrough: возвращает children как есть.
 */
export function useIconSwap(
  animate: IconAnimate | undefined,
  identity: string | number | null,
  ready: boolean,
  children: ReactNode
): ReactNode {
  const kind = swapKindOf(animate);
  const enabled = kind != null;
  const defaults = kind === 'spin' ? SPIN_DEFAULTS : SWAP_DEFAULTS;
  const options = swapOptionsOf(animate);
  const duration = options?.duration ?? defaults.duration;
  const scale = options?.scale ?? defaults.scale;
  const rotate = options?.rotate ?? defaults.rotate;

  const [swap, setSwap] = useState<SwapState>({ outgoing: null, generation: 0, entering: false });
  // Идентичность, которую сейчас показывает слой (двигается только когда контент готов).
  const committedRef = useRef<string | number | null>(identity);
  // Снимок последнего стабильно показанного контента — станет уходящим слоем при следующей смене.
  const stableChildrenRef = useRef<ReactNode>(children);

  const changePending = enabled && identity !== committedRef.current;
  if (!changePending) stableChildrenRef.current = children;

  // Смена идентичности + готовность контента → старт фазы OUT (snapshot старого → outgoing).
  useEffect(() => {
    if (!enabled || !ready || identity == null) return;
    if (identity === committedRef.current) return;

    const outgoing = stableChildrenRef.current;
    committedRef.current = identity;

    if (prefersReducedMotion()) {
      setSwap((s) => ({ outgoing: null, generation: s.generation, entering: false }));
      return;
    }

    setSwap((s) => ({ outgoing, generation: s.generation + 1, entering: false }));
  }, [enabled, ready, identity]);

  // Завершение OUT → фаза IN: снимаем уходящий слой и включаем въезд нового. Таймер детерминированный.
  useEffect(() => {
    if (swap.outgoing == null) return undefined;

    const timer = window.setTimeout(() => {
      setSwap((s) => (s.outgoing == null ? s : { ...s, outgoing: null, entering: true }));
    }, duration * 1000 + MOTION_END_BUFFER_MS);

    return () => clearTimeout(timer);
  }, [swap.generation, swap.outgoing, duration]);

  if (!enabled) return children;

  const vars = {
    '--icon-swap-dur': `${duration}s`,
    '--icon-swap-scale': String(scale),
    '--icon-swap-rotate': `${rotate}deg`,
  } as CSSProperties;

  // Фаза OUT: на экране только уходящая иконка, анимируется до полного исчезновения.
  if (swap.outgoing != null) {
    return createElement(
      'span',
      { className: 'ui-swap', style: vars },
      createElement(
        'span',
        { key: `out-${swap.generation}`, className: cx('ui-swap-layer', 'ui-swap-out'), 'aria-hidden': true },
        swap.outgoing
      )
    );
  }

  // Фаза IN / покой: только новая иконка. Пока новый контент грузится — держим снимок старого (без пустого
  // кадра). Анимацию въезда включаем лишь сразу после OUT (entering) — первый рендер не анимируется.
  const current = changePending ? stableChildrenRef.current : children;

  return createElement(
    'span',
    { className: 'ui-swap', style: vars },
    createElement(
      'span',
      { key: `in-${swap.generation}`, className: cx('ui-swap-layer', swap.entering && 'ui-swap-in') },
      current
    )
  );
}
