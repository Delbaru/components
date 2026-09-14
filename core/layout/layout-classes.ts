import { type ResponsiveValue } from '../base/responsive';
import { responsiveClasses, lookup, type StyleMaps } from './responsive-classes';
import { inlineSizeClassName, needsInlineSize, sizeClassKey, type SizeValue } from './size';
import { inlineSpaceClassName, needsInlineSpace, isBareSpaceShorthand, spaceClassKey, type ResponsiveSpaceValue, type SpaceValue, type SpaceShorthandValue } from './space';

type SizePrefix = 'width' | 'minWidth' | 'maxWidth' | 'height' | 'minHeight' | 'maxHeight';

const literalValueKey = (value: string): string | undefined => {
  const normalizedValue = value.trim();

  if (!normalizedValue) return undefined;

  return normalizedValue.replace(/[^a-zA-Z0-9\-]/g, '') || undefined;
};

/**
 * Мини-конструктор, который "привязывает" генерацию классов к конкретному CSS-module `styles`.
 * В компонентах это сильно уменьшает шум:
 *
 * Пример:
 * `const c = createLayoutClasses(styles);`
 * `...c.num('gap', gap)`
 * `...c.enum('flexDirection', flexDirection)`
 * `...c.size('width', width)`
 * `...c.space('mt', mt)`
 */
export const createLayoutClasses = (styles: StyleMaps) => {
  return {
    // Для числовых токенов (gap, radius...).
    num: <T extends number>(prefix: string, value: ResponsiveValue<T> | undefined) =>
      responsiveClasses(styles, prefix, value, (v) => String(v)),

    // Для enum-значений (flexDirection, justifyContent...).
    enum: <T extends string>(prefix: string, value: ResponsiveValue<T> | undefined) =>
      responsiveClasses(styles, prefix, value, (v) => v),

    // Для size-значений: number -> класс, "100%" -> класс, "calc(...)" -> класс, "auto" -> inline (через inlineSizeStyle).
    size: (prefix: SizePrefix, value: ResponsiveValue<SizeValue> | undefined) => {
      if (value === undefined) return [];

      if (Array.isArray(value) && needsInlineSize(value)) {
        const inlineClass = lookup(styles, inlineSizeClassName(prefix));
        return inlineClass ? [inlineClass] : [];
      }

      return responsiveClasses(styles, prefix, value, sizeClassKey);
    },

    // Для space-значений (padding, margin).
    // Shorthand [top, right, bottom, left] → один составной класс p_16_40_16_40.
    // Responsive shorthand [[16,40,16,40], 24, [8,24]] → d_p_16_40_16_40 m_p_24 t_p_8_24_8_24.
    space: (prefix: string, value: ResponsiveSpaceValue | undefined) => {
      if (value === undefined) return [];
      if (needsInlineSpace(value)) {
        const inlineClass = lookup(styles, inlineSpaceClassName(prefix as Parameters<typeof inlineSpaceClassName>[0]));
        return inlineClass ? [inlineClass] : [];
      }

      const isBlockSpace = prefix === 'p' || prefix === 'm';

      if (!isBlockSpace) {
        return responsiveClasses(styles, prefix, value as ResponsiveValue<SpaceValue> | undefined, spaceClassKey);
      }

      // Bare 4-element shorthand like [16, 40, 16, 40] — same for all breakpoints, one class
      if (isBareSpaceShorthand(value)) {
        const key = spaceClassKey(value);
        return key ? [lookup(styles, `${prefix}_${key}`)] : [];
      }
      // Responsive with shorthand entries: [[16,40,16,40], 24, [8,24]] → 3 classes
      return responsiveClasses(styles, prefix, value as ResponsiveValue<SpaceValue | SpaceShorthandValue>, spaceClassKey);
    },

    // Для background-значений: "var(--primary)" → класс bg_var--primary.
    bg: (prefix: string, value: ResponsiveValue<string> | undefined) =>
      responsiveClasses(styles, prefix, value, literalValueKey),

    // Для произвольных literal-значений: "var(--gray)" → color_var--gray,
    // "calc(...) solid var(--gray)" → border_calc... .
    literal: (prefix: string, value: ResponsiveValue<string> | undefined) =>
      responsiveClasses(styles, prefix, value, literalValueKey),

    // Общая версия, если нужен кастомный toKey().
    key: <T,>(prefix: string, value: ResponsiveValue<T> | undefined, toKey: (v: T) => string | undefined) =>
      responsiveClasses(styles, prefix, value, toKey),
  };
};

