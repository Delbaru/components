import { resolveResponsive, type ResponsiveInput } from '../base/responsive';

/**
 * Классы из CSS-модуля КОМПОНЕНТА (варианты кнопки, пресеты модалки, размеры полей): модуль
 * печатает базу и по классу на брейкпоинт — `size_md`, `d_size_md`, `m_size_md`, `t_size_md`.
 * Утилиты раскладки сюда не ходят — у них свой глобальный слой (`core/utilities`).
 */
export const responsiveClasses = <T,>(
  styles: Readonly<Record<string, string>>,
  prefix: string,
  value: ResponsiveInput<T> | undefined,
  toKey: (v: T) => string | undefined
): string[] => {
  if (value === undefined) return [];

  const one = (breakpoint: '' | 'd_' | 'm_' | 't_', v: T | null): string | undefined => {
    if (v === null) return undefined;
    const key = toKey(v);
    return key ? styles[`${breakpoint}${prefix}_${key}`] : undefined;
  };

  const classes = Array.isArray(value)
    ? (() => {
        const [d, m, t] = resolveResponsive(value);
        return [one('d_', d), one('m_', m), one('t_', t)];
      })()
    : [one('', value as T)];

  return classes.filter((name): name is string => Boolean(name));
};
