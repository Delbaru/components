'use client';

import { useEffect, useRef, useState, type RefObject, type TransitionEvent } from 'react';

import { MOTION_END_BUFFER_MS, readMotionMs } from '../core';

/**
 * Presence-анимация монтирования/размонтирования (A+B+C):
 *  - show:false→true → монтируем ЗАКРЫТЫМ (rows:0) и на следующем кадре flip в open.
 *    double-rAF обязателен: иначе браузеру не от чего анимировать enter — элемент появится мгновенно.
 *  - show:true→false → setOpen(false), анимируем в закрытое, по transitionend (grid-template-rows)
 *    размонтируем. Safety-net по таймеру на случай, когда transition нет (prefers-reduced-motion).
 *
 * Изначально показанный блок монтируется сразу открытым, без enter-анимации, — иначе первый кадр
 * любого списка превращался бы в парад раскрытий. Но узел, ПОЯВИВШИЙСЯ от действия (приглашённый
 * пользователь в справочнике), обязан выехать: для него есть опт-ин `appear` — блок монтируется
 * закрытым и раскрывается тем же движением, что и обычное раскрытие.
 *
 * ⚠️ `appear` читается ОДИН раз, при монтировании: сделать его `true` позже уже нечему.
 *
 * axis выбирает свойство, по завершении transition которого закрытый блок размонтируется:
 * 'row' → grid-template-rows (сворачивание по высоте), 'column' → grid-template-columns (по ширине).
 */
export function usePresence<T extends HTMLElement = HTMLElement>(show: boolean, axis: 'row' | 'column' = 'row', appear = false) {
  const property = axis === 'column' ? 'grid-template-columns' : 'grid-template-rows';
  const [mounted, setMounted] = useState(show);
  const [open, setOpen] = useState(show && !appear);
  const nodeRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (show) setMounted(true);
    else setOpen(false);
  }, [show]);

  // Смонтирован, но ещё закрыт, а показать хотим → enter на следующих кадрах.
  useEffect(() => {
    if (!show || !mounted || open) return undefined;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setOpen(true));
    });

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [show, mounted, open]);

  // Закрытие: страховка на случай, когда transitionend не прилетит (reduced-motion / нулевой transition).
  useEffect(() => {
    if (show || !mounted || open) return undefined;

    const durationMs = nodeRef.current ? readMotionMs(nodeRef.current) : 0;
    const timer = window.setTimeout(() => setMounted(false), durationMs + MOTION_END_BUFFER_MS);

    return () => clearTimeout(timer);
  }, [show, mounted, open]);

  const onTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.propertyName !== property) return;
    if (!show && !open) setMounted(false);
  };

  return { mounted, open, onTransitionEnd, property, ref: nodeRef as RefObject<T | null> };
}
