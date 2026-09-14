'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';

import { useAnchoredFloating, type FloatingAlign, type FloatingPlacement } from './useAnchoredFloating';

export interface UseTooltipOptions {
  /** Пока false — тултип не показывается (позиционирование простаивает). Удобно гейтить, напр. «только при обрезке текста». */
  enabled?: boolean;
  /** Сторона относительно якоря. По умолчанию снизу. */
  direction?: FloatingPlacement;
  /** Выравнивание вдоль стороны. По умолчанию по центру. */
  align?: FloatingAlign;
  /** Отступ между якорем и тултипом, px. */
  gap?: number;
  /** Минимальный отступ от краёв вьюпорта, px. */
  viewportPadding?: number;
}

/** Пропы для presentational-компонента `<Tooltip>` — разворачиваются спредом. */
export interface TooltipBubbleProps {
  portalNode: HTMLElement | null;
  style: CSSProperties;
  placement: FloatingPlacement;
  active: boolean;
}

export interface UseTooltipResult<A extends HTMLElement = HTMLElement, F extends HTMLElement = HTMLElement> {
  /** Ref на якорь (элемент, относительно которого позиционируется тултип). Writable — можно мёржить с другими ref'ами. */
  anchorRef: MutableRefObject<A | null>;
  /** Ref на саму всплывашку (нужен для измерения её размера). */
  tooltipRef: MutableRefObject<F | null>;
  /** Активен ли тултип прямо сейчас (с учётом enabled). */
  isActive: boolean;
  show: () => void;
  hide: () => void;
  /** Хэндлеры наведения/фокуса для спреда на триггер. */
  anchorHandlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  };
  bubbleProps: TooltipBubbleProps;
}

/**
 * Поведение тултипа: видимость по наведению/фокусу + позиционирование через `useAnchoredFloating`
 * + портал в `document.body`. Вынесено из Button/Icon, чтобы не дублировать логику в каждом компоненте.
 * Рендер всплывашки — в общем компоненте `<Tooltip>` (см. UI/Tooltip).
 */
export function useTooltip<A extends HTMLElement = HTMLElement, F extends HTMLElement = HTMLElement>({
  enabled = true,
  direction = 'bottom',
  align = 'center',
  gap = 8,
  viewportPadding = 8,
}: UseTooltipOptions = {}): UseTooltipResult<A, F> {
  const anchorRef = useRef<A | null>(null);
  const tooltipRef = useRef<F | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const isActive = enabled && isHovered;

  const { placement, isPositioned, style } = useAnchoredFloating({
    anchorRef,
    floatingRef: tooltipRef,
    isActive,
    placement: direction,
    align,
    gap,
    viewportPadding,
    // Тултипы должны плавно исчезать — оставляем позицию на время fade-out.
    keepPositionWhenInactive: true,
  });

  useEffect(() => {
    setPortalNode(document.body);
  }, []);

  const show = useCallback(() => setIsHovered(true), []);
  const hide = useCallback(() => setIsHovered(false), []);

  const anchorHandlers = {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  };

  return {
    anchorRef,
    tooltipRef,
    isActive,
    show,
    hide,
    anchorHandlers,
    bubbleProps: {
      portalNode,
      style,
      placement,
      active: isActive && isPositioned,
    },
  };
}
