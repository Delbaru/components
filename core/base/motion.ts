import { MEDIA_QUERY } from './breakpoints';

/**
 * Запас к расчётной длительности анимации, мс. Страховочный таймер обязан срабатывать ПОЗЖЕ
 * события `transitionend`/`animationend`, а не раньше него, иначе анимацию обрывает на полкадра.
 * Одно число вместо шести разных запасов (+40/+50/+60/+80), которые раньше стояли по месту.
 */
export const MOTION_END_BUFFER_MS = 80;

/** Пользователь просил меньше движения: анимацию заменяем мгновенной подменой. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(MEDIA_QUERY.reducedMotion).matches;
}

/**
 * Длительность движения узла в мс: максимум по списку свойств плюс задержка. `transition` и
 * `animation` считаются одинаково, поэтому это один помощник с переключателем, а не два.
 */
export function readMotionMs(node: HTMLElement, kind: 'transition' | 'animation' = 'transition'): number {
  const style = getComputedStyle(node);

  const parse = (value: string): number =>
    value.split(',').reduce((max, part) => {
      const token = part.trim();
      const ms = token.endsWith('ms') ? parseFloat(token) : parseFloat(token) * 1000;

      return Number.isFinite(ms) ? Math.max(max, ms) : max;
    }, 0);

  return kind === 'animation'
    ? parse(style.animationDuration) + parse(style.animationDelay)
    : parse(style.transitionDuration) + parse(style.transitionDelay);
}
