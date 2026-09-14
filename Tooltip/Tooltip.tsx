'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import styles from './Tooltip.module.scss';

import { cx, stateProps } from '../core';
import type { TooltipBubbleProps } from '../hooks/useTooltip';
import type { WithRef } from '../core';

export interface TooltipProps extends TooltipBubbleProps {
  children: ReactNode;
  className?: string;
  /** id всплывашки — чтобы на неё ссылался `aria-describedby` триггера. */
  id?: string;
  /**
   * Встроенная тёмная плашка (фон/паддинг/радиус/типографика). По умолчанию включена (как у Input).
   * Выключи (`false`), когда контент сам рисует поверхность — карточка, кастомный блок и т.п.
   */
  surface?: boolean;
}

/**
 * Общая всплывашка-тултип: портал в body + плавное появление/исчезновение + позиционирование из `useTooltip`.
 * Фундамент один на все тултипы (Input, ChoiceButtons, …); различается только контент/скин.
 * Логика (видимость/координаты/fade) живёт в `useTooltip` + `useAnchoredFloating`, здесь — только отрисовка.
 */
export function Tooltip({ ref, portalNode, style, placement, active, className, id, surface = true, children }: WithRef<TooltipProps, HTMLDivElement>) {
  if (!portalNode) return null;

  return createPortal(
    <div
      ref={ref}
      id={id}
      className={cx(styles.Tooltip, surface && styles.surface, className)}
      style={style}
      role='tooltip'
      aria-hidden={!active}
      data-placement={placement}
      {...stateProps(active && 'active')}
    >
      {children}
    </div>,
    portalNode
  );
}
