/**
 * Единственный источник брейкпоинтов. Числа отсюда берут и реестр утилит (медиазапросы
 * генерата), и раскладка (`getBreakpointIndex`), и компоненты, которым нужен рантайм-замер
 * ширины. Раньше те же 767/1023/1024 жили пятью независимыми копиями и расходились.
 */

export const BREAKPOINT = {
  /** Верх мобильной полосы. */
  mobileMax: 767,
  /** Низ планшетной полосы. */
  tabletMin: 768,
  /** Верх планшетной полосы — она же граница «ниже десктопа». */
  tabletMax: 1023,
  /** Низ десктопа. */
  desktopMin: 1024,
} as const;

/** Медиазапросы под те же полосы. `below` — «ниже 1024», одним запросом вместо пары. */
export const MEDIA_QUERY = {
  desktop: `(min-width: ${BREAKPOINT.desktopMin}px)`,
  below: `(max-width: ${BREAKPOINT.tabletMax}px)`,
  mobile: `(max-width: ${BREAKPOINT.mobileMax}px)`,
  tablet: `(min-width: ${BREAKPOINT.tabletMin}px) and (max-width: ${BREAKPOINT.tabletMax}px)`,
  /** Не размер, но живёт рядом: его спрашивают там же, где и ширину. */
  reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;
