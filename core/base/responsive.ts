// Респонсив-значение.
// Порядок массива ВАЖЕН: [desktop, mobile, tablet]
// (мы сознательно используем этот порядок во всём layout-ядре).

// Доп. правило: `null` внутри массива означает "не трогать этот брейкпоинт"
// (то есть не генерировать класс/стиль и оставить значение от базового стиля/variant).
export type ResponsiveValue<T> = T | [(T | null)?, (T | null)?, (T | null)?];

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
export const resolveResponsive = <T,>(value: ResponsiveValue<T>): [T | null, T | null, T | null] => {
  if (!Array.isArray(value)) return [value, value, value];

  const [d0, m0, t0] = value;

  // Desktop — источник правды: не наследует из мобильного/планшета.
  const desktop = d0 ?? null;

  // Mobile/Tablet: undefined наследует desktop, null остаётся explicit skip.
  const mobile = m0 === undefined ? desktop : m0;
  const tablet = t0 === undefined ? desktop : t0;

  return [desktop, mobile, tablet];
};

