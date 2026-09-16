'use client';

import { useEffect, useRef, type RefObject } from 'react';

export type DismissRef = RefObject<HTMLElement | null>;

export interface UseOutsideDismissOptions {
  /** Пока false — подписки нет (обычно сюда идёт «панель открыта»). */
  enabled?: boolean;
  /** Закрывать по Escape. У поля со своим обработчиком клавиш — выключить, иначе закроют оба. */
  escape?: boolean;
}

/**
 * Закрытие по клику вне — одним хуком на всё, что раскрывается: меню, поповер, календарь,
 * выпадающий список.
 *
 * Слушаем `mousedown`, а не `click`: `click` приходит уже после того, как React снял панель, и
 * повторное открытие «проглатывается». Узлы из `refs` (триггер и сама панель) из проверки
 * исключены — иначе триггер закрывал бы то, что только что открыл.
 *
 * Обработчик читается через ref, поэтому подписка не пересоздаётся на каждый рендер и
 * `onDismiss` можно передавать стрелкой прямо на вызове.
 */
export function useOutsideDismiss(
  refs: DismissRef | readonly DismissRef[],
  onDismiss: () => void,
  { enabled = true, escape = true }: UseOutsideDismissOptions = {},
): void {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const nodesRef = useRef<readonly DismissRef[]>([]);
  nodesRef.current = Array.isArray(refs) ? refs : [refs as DismissRef];

  useEffect(() => {
    if (!enabled) return undefined;

    const isInside = (target: Node) => nodesRef.current.some((ref) => ref.current?.contains(target));

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || isInside(target)) return;

      dismissRef.current();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissRef.current();
    };

    document.addEventListener('mousedown', handlePointerDown);
    if (escape) document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      if (escape) document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, escape]);
}
