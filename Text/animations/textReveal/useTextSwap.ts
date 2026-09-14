'use client';

import { useEffect, useRef, useState } from 'react';

export interface TextSwapState {
  /** Актуальная строка (въезжающий слой). */
  current: string;
  /** Уходящая строка во время свопа; null — когда анимации нет. */
  previous: string | null;
  /** Счётчик свопов: служит React-ключом слоёв, чтобы CSS-keyframes перезапускались на каждой смене. */
  generation: number;
}

export interface UseTextSwapOptions {
  /** Длительность анимации одной буквы, мс. */
  durationMs: number;
  /** Задержка между соседними буквами (волна), мс. */
  staggerMs: number;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Длина общего префикса и суффикса двух строк (в символах, surrogate-safe). Совпадающие края НЕ трогаем —
 * анимируется только изменившаяся середина. Иначе при смене длины («3»→«18», «секунды»→«секунду») позиционный
 * диф разъезжается: всё после точки различия считается «изменившимся» и рендерится вкривь (лишние пробелы,
 * задвоение). Общий для textReveal (кроссфейд краёв) и textSlide-swap (выравнивание ячеек).
 */
export function commonAffixes(a: string, b: string): { prefix: number; suffix: number } {
  const A = Array.from(a);
  const B = Array.from(b);
  const min = Math.min(A.length, B.length);
  let prefix = 0;
  while (prefix < min && A[prefix] === B[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < min - prefix && A[A.length - 1 - suffix] === B[B.length - 1 - suffix]) suffix += 1;
  return { prefix, suffix };
}

/**
 * Своп строки в стиле «split text» (брат useSwapTransition, но для текста): при смене value старый текст
 * уезжает (exit), новый въезжает (enter), оба слоя живут одновременно (overlap), по завершении старый
 * отбрасывается. Саму анимацию рисует CSS (per-char keyframes со stagger) — хук лишь держит стейт-машину:
 * что уходит, что приходит и когда убрать ушедшее. reduced-motion → мгновенная подмена без анимации.
 * Высоту/ширину держит grid-стек в разметке, поэтому ни измерений, ни rAF здесь нет.
 */
export function useTextSwap(value: string, { durationMs, staggerMs }: UseTextSwapOptions): TextSwapState {
  const [state, setState] = useState<TextSwapState>({ current: value, previous: null, generation: 0 });
  // Последний показанный current — чтобы effect срабатывал только на реальную смену value, а не на свои setState.
  const currentRef = useRef(value);
  currentRef.current = state.current;

  useEffect(() => {
    if (value === currentRef.current) return;
    if (prefersReducedMotion()) {
      setState((s) => ({ current: value, previous: null, generation: s.generation }));
      return;
    }
    setState((s) => ({ current: value, previous: s.current, generation: s.generation + 1 }));
  }, [value]);

  // Сброс ушедшего слоя по завершении анимации. Таймер детерминирован (вместо подсчёта animationend по
  // каждой букве): длительность = duration + stagger по самой длинной из двух строк + буфер.
  useEffect(() => {
    if (state.previous === null) return undefined;

    const chars = Math.max(state.current.length, state.previous.length);
    const totalMs = durationMs + Math.max(0, chars - 1) * staggerMs + 60;
    const timer = window.setTimeout(() => {
      setState((s) => (s.previous === null ? s : { ...s, previous: null }));
    }, totalMs);

    return () => clearTimeout(timer);
  }, [state.generation, state.previous, state.current, durationMs, staggerMs]);

  return state;
}
