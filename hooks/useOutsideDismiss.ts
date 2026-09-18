'use client';

import { useCallback, useEffect, useRef, type RefObject, type SyntheticEvent } from 'react';

export type DismissRef = RefObject<HTMLElement | null>;

export interface UseOutsideDismissOptions {
  /** Пока false — подписки нет (обычно сюда идёт «панель открыта»). */
  enabled?: boolean;
  /** Закрывать по Escape. У поля со своим обработчиком клавиш — выключить, иначе закроют оба. */
  escape?: boolean;
}

/**
 * Пропсы для корня панели. Нужны, когда из панели открывается ВЛОЖЕННЫЙ плавающий слой в своём
 * портале (календарь поля даты внутри поповера): по DOM он снаружи, по дереву React — внутри.
 */
export interface OutsideDismissInsideProps {
  onMouseDownCapture: (event: SyntheticEvent) => void;
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
 *
 * Вложенные слои в своих порталах: проверка по DOM их не видит, и клик в календаре, открытом из
 * поповера, закрывал поповер. Возвращённые пропсы вешаются на корень панели — React ведёт событие
 * через порталы по СВОЕМУ дереву, и захват на корне отмечает клик как внутренний раньше, чем до
 * документа дойдёт всплытие. Escape, который уже погасил внутренний слой (`preventDefault`), наружу
 * тоже не закрывает — сперва уходит верхний слой, потом следующий.
 */
export function useOutsideDismiss(
  refs: DismissRef | readonly DismissRef[],
  onDismiss: () => void,
  { enabled = true, escape = true }: UseOutsideDismissOptions = {},
): OutsideDismissInsideProps {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const insideEventRef = useRef<Event | null>(null);
  const onMouseDownCapture = useCallback((event: SyntheticEvent) => {
    insideEventRef.current = event.nativeEvent;
  }, []);

  const nodesRef = useRef<readonly DismissRef[]>([]);
  nodesRef.current = Array.isArray(refs) ? refs : [refs as DismissRef];

  useEffect(() => {
    if (!enabled) return undefined;

    const isInside = (target: Node) => nodesRef.current.some((ref) => ref.current?.contains(target));

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || event === insideEventRef.current || isInside(target)) return;

      dismissRef.current();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) dismissRef.current();
    };

    document.addEventListener('mousedown', handlePointerDown);
    if (escape) document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      if (escape) document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, escape]);

  return { onMouseDownCapture };
}
