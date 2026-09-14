'use client';

import { useCallback, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';

export interface UseTextOverflowResult<E extends HTMLElement = HTMLElement> {
  /** Ref на элемент, чьё переполнение по горизонтали отслеживаем (input / текстовый узел). Writable — можно мёржить. */
  ref: MutableRefObject<E | null>;
  /** true, когда контент не влезает и обрезается (`text-overflow: ellipsis`). */
  isOverflowing: boolean;
  /** Полный текст элемента (value для полей ввода, иначе textContent) — для показа в тултипе. */
  text: string;
}

// Допуск против субпиксельных округлений scrollWidth/clientWidth.
const OVERFLOW_TOLERANCE = 1;

function readText(el: HTMLElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value;
  }

  return el.textContent ?? '';
}

/**
 * Определяет, обрезается ли текст элемента по ширине, и отдаёт его полный текст.
 * Перемеряет после каждого рендера (значение/типографика могли поменяться) и при ресайзе контейнера.
 */
export function useTextOverflow<E extends HTMLElement = HTMLElement>(): UseTextOverflowResult<E> {
  const ref = useRef<E | null>(null);
  const [state, setState] = useState<{ isOverflowing: boolean; text: string }>({
    isOverflowing: false,
    text: '',
  });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const isOverflowing = el.scrollWidth - el.clientWidth > OVERFLOW_TOLERANCE;
    const text = readText(el);

    setState((prev) => (
      prev.isOverflowing === isOverflowing && prev.text === text ? prev : { isOverflowing, text }
    ));
  }, []);

  // Контент мог измениться вместе с рендером (контролируемое значение, смена типографики и т.п.).
  useLayoutEffect(() => {
    measure();
  });

  // Изменение ширины контейнера может произойти без ре-рендера этого компонента.
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;

    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(el);

    return () => observer.disconnect();
  }, [measure]);

  return { ref, isOverflowing: state.isOverflowing, text: state.text };
}
