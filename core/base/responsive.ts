import { BREAKPOINT } from './breakpoints';

// Респонсив-значение.
// Порядок массива ВАЖЕН: [desktop, mobile, tablet]
// (мы сознательно используем этот порядок во всём layout-ядре).

// Доп. правило: `null` внутри массива означает "не трогать этот брейкпоинт"
// (то есть не генерировать класс/стиль и оставить значение от базового стиля/variant).
/** Значение на входе помощников ядра: скаляр, короткий или полный кортеж. */
export type ResponsiveInput<T> = T | [(T | null)?, (T | null)?, (T | null)?];

declare global {
  /**
   * Правила проекта. `{ strictTuple: true }` в его глобальной декларации требует полный кортеж
   * `[desktop, mobile, tablet]` на каждом респонсив-пропе: скаляр и короткий кортеж — ошибка типов.
   */
  interface UiRules {}
}

type StrictTuple = UiRules extends { strictTuple: true } ? true : false;

/** Значение респонсив-пропа. */
export type ResponsiveValue<T> = StrictTuple extends true ? [T | null, T | null, T | null] : ResponsiveInput<T>;

/**
 * Нормализует ResponsiveValue к тройке [desktop, mobile, tablet].
 *
 * Важно:
 * - `undefined` в массиве = "дырка" (мы стараемся заполнить фоллбэком)
 * - `null` в массиве = "skip" (оставляем null, чтобы потом НЕ генерировать класс/стиль)
 *
 * Примеры:
 * - resolveResponsive(12) -> [12, 12, 12]
 * - resolveResponsive([24, 12]) -> [24, 12, 24]
 * - resolveResponsive([null, 16, 16]) -> [null, 16, 16]  // desktop пропускаем
 */
export const resolveResponsive = <T,>(value: ResponsiveInput<T>): [T | null, T | null, T | null] => {
  if (!Array.isArray(value)) return [value, value, value];

  const [d0, m0, t0] = value;

  // Desktop — источник правды: не наследует из мобильного/планшета.
  const desktop = d0 ?? null;

  // Mobile/Tablet: undefined наследует desktop, null остаётся explicit skip.
  const mobile = m0 === undefined ? desktop : m0;
  const tablet = t0 === undefined ? desktop : t0;

  return [desktop, mobile, tablet];
};

/** Индекс брейкпоинта по ширине окна: 0 — desktop (≥1024), 1 — mobile (≤767), 2 — tablet. */
export const getBreakpointIndex = (viewportWidth: number): 0 | 1 | 2 => {
  if (viewportWidth <= BREAKPOINT.mobileMax) return 1;
  if (viewportWidth <= BREAKPOINT.tabletMax) return 2;
  return 0;
};

/** Значение на одном брейкпоинте (0 — desktop, 1 — mobile, 2 — tablet) с запасным вариантом. */
export const resolveResponsiveAtBreakpoint = <T,>(
  value: ResponsiveInput<T> | undefined,
  fallback: T,
  breakpointIndex: 0 | 1 | 2
): T => {
  if (value === undefined) return fallback;

  return resolveResponsive(value)[breakpointIndex] ?? fallback;
};

