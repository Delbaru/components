import type { ResponsiveValue } from '../base/responsive';
import { utilityClasses, type ResponsiveUtilityValue } from '../utilities/classes';
import { resolveUtility } from '../utilities/registry';
import { responsiveClasses } from './responsive-classes';

export interface LayoutClassOptions {
  /**
   * Утилиты, числа которых компонент берёт из СВОЕГО модуля (утилита → префикс класса модуля):
   * у полей `{ h: 'height' }` — класс `height_56` заодно ставит переменную высоты
   * (`--input-height`), по которой выровнены иконки и подпись. Нечисловое значение такого
   * пропа (`'100%'`) по-прежнему уходит в утилиту.
   */
  readonly local?: Readonly<Record<string, string>>;
}

export interface ClassBuilder {
  /** Проп утилиты (`gap`, `columns`, `w`, `p`…) или класс модуля компонента (`variant`, `size`). */
  value: (prefix: string, value: ResponsiveValue<unknown> | undefined) => string[];
  /** Класс модуля со своим ключом значения (`slides-per-view_1-5`). */
  key: <T>(prefix: string, value: ResponsiveValue<T> | undefined, toKey: (v: T) => string | undefined) => string[];
}

/** Класс модуля есть только у целого неотрицательного числа (`height_56`); остальное — утилите. */
const moduleNumber = (entry: unknown): boolean => typeof entry === 'number' && Number.isInteger(entry) && entry >= 0;

const onlyNumbers = (value: unknown): boolean =>
  Array.isArray(value) ? value.every((entry) => entry === null || entry === undefined || moduleNumber(entry)) : moduleNumber(value);

/**
 * Построитель классов компонента. Проп из реестра утилит превращается в глобальный класс
 * (`gap_16`, `n_p_0`), всё остальное ищется в CSS-модуле компонента.
 *
 * `const c = createLayoutClasses(styles);` → `...c.value('gap', gap)`, `...c.value('variant', variant)`
 */
const moduleKey = (v: unknown) => (typeof v === 'number' || typeof v === 'string' ? String(v) : undefined);

export const createLayoutClasses = (styles: Readonly<Record<string, string>> = {}, options: LayoutClassOptions = {}): ClassBuilder => {
  const local = options.local ?? {};

  return {
    value: (prefix, value) => {
      if (value === undefined) return [];
      const localPrefix = local[prefix];
      if (localPrefix && onlyNumbers(value)) return responsiveClasses(styles, localPrefix, value, moduleKey);
      const utility = resolveUtility(prefix);
      if (utility) return utilityClasses(utility, value as ResponsiveUtilityValue);
      return responsiveClasses(styles, prefix, value, moduleKey);
    },
    key: (prefix, value, toKey) => responsiveClasses(styles, prefix, value, toKey),
  };
};
