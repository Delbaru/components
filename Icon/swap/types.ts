export interface IconSwapOptions {
  /** Длительность одной фазы (exit или enter), сек. */
  duration?: number;
  /** Стартовый масштаб въезжающей иконки (и финишный у уходящей). 0..1. */
  scale?: number;
  /** Доворот (град): уходящая вращается на +rotate, въезжающая доворачивает из него в 0. 0 = без вращения. */
  rotate?: number;
}

/** Стили смены иконки: 'swap' — fade+scale; 'spin' — то же + доворот, быстрее (рецепт бейджа сайта). */
export type IconSwapKey = 'swap' | 'spin';

/**
 * Значение пропа `animate` у Icon: ключ, [ключ] или [ключ, опции].
 * Форма-зеркало `AnimationInput` из Text. Оба ключа делят один движок (useIconSwap) —
 * различие только в дефолтах и keyframes (доворот через --icon-swap-rotate).
 * Добавление новой фишки = расширить union здесь + ветку в useIconSwap.
 */
export type IconAnimate = IconSwapKey | [IconSwapKey] | [IconSwapKey, IconSwapOptions];
