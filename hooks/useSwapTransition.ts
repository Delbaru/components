'use client';

import { useCallback, useEffect, useRef, useState, type AnimationEvent, type ReactNode } from 'react';

type TransitionKey = string | number | undefined;
type Slot = { key: TransitionKey; children: ReactNode };

/** Складывает длительность+задержку animation узла в мс (берём максимум по списку). */
function readAnimationMs(node: HTMLElement): number {
  const style = getComputedStyle(node);

  const parse = (value: string): number =>
    value.split(',').reduce((max, part) => {
      const token = part.trim();
      const ms = token.endsWith('ms') ? parseFloat(token) : parseFloat(token) * 1000;

      return Number.isFinite(ms) ? Math.max(max, ms) : max;
    }, 0);

  return parse(style.animationDuration) + parse(style.animationDelay);
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Своп контента в стиле AnimatePresence mode='wait': при смене `key` старый контент проигрывает
 * exit и только потом подменяется новым (enter). Пока key не меняется — показываем «живой» контент.
 *
 * Анти-рывок при быстрых переключениях: идущую анимацию НЕ перебиваем (резкий обрыв убран). Быстрые
 * смены «склеиваются» — exit всегда коммитит ПОСЛЕДНИЙ ключ, а если ключ ушёл вперёд во время enter,
 * по его завершении догоняем (новый exit→enter к актуальному). reduced-motion свопает мгновенно;
 * таймер-страховка подменяет, если animationend не прилетит.
 */
export function useSwapTransition(key: TransitionKey, children: ReactNode) {
  const [committedKey, setCommittedKey] = useState<TransitionKey>(key);
  const [exiting, setExiting] = useState(false);

  const lastShown = useRef<Slot>({ key, children });
  const exitingRef = useRef(false);
  const enteringRef = useRef(false);
  const latestKey = useRef(key);
  const committedKeyRef = useRef(committedKey);
  const nodeRef = useRef<HTMLElement | null>(null);

  exitingRef.current = exiting;
  latestKey.current = key;
  committedKeyRef.current = committedKey;

  const synced = key === committedKey;
  // Пока контент синхронен и не уходит — запоминаем его как «последний показанный» (снимок для exit).
  if (synced && !exiting) lastShown.current = { key, children };

  const commit = useCallback(() => {
    setCommittedKey(latestKey.current);
  }, []);

  const finishExit = useCallback(() => {
    commit();
    setExiting(false);
    enteringRef.current = true; // дальше проигрывается enter нового контента
  }, [commit]);

  // key сменился → запускаем exit. НО не перебиваем идущий enter (enteringRef) — иначе резкий обрыв.
  useEffect(() => {
    if (synced || exiting || enteringRef.current) return;
    if (prefersReducedMotion()) {
      commit();
      return;
    }
    setExiting(true);
  }, [synced, exiting, commit]);

  // Страховка на случай, когда animationend не сработает (пропущен / нет анимации).
  useEffect(() => {
    if (!exiting) return undefined;
    const ms = nodeRef.current ? readAnimationMs(nodeRef.current) : 0;
    const timer = window.setTimeout(finishExit, ms + 50);

    return () => clearTimeout(timer);
  }, [exiting, finishExit]);

  const onAnimationEnd = useCallback((event: AnimationEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;

    if (exitingRef.current) {
      finishExit(); // exit завершён → коммитим последний ключ и запускаем enter
      return;
    }

    // enter завершён: если за время анимации ключ ушёл вперёд — догоняем (exit к актуальному).
    if (enteringRef.current) {
      enteringRef.current = false;
      if (latestKey.current !== committedKeyRef.current) setExiting(true);
    }
  }, [finishExit]);

  return {
    // Показываем committed-идентификатор: ремоунт/смена контента случается только при подмене.
    displayKey: committedKey,
    displayChildren: synced && !exiting ? children : lastShown.current.children,
    exiting,
    onAnimationEnd,
    ref: nodeRef,
  };
}
