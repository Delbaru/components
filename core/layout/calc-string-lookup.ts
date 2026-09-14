import { CALC_STRING_MAP } from '../_calc-string-map';
import { css } from '../base/cn';
import { type StyleMaps } from './responsive-classes';

/**
 * Преобразует calc-строку в CSS-класс через lookup в CALC_STRING_MAP.
 * Возвращает имя класса или undefined, если строка не найдена в map.
 *
 * Пример:
 * - calcStringToClass(styles, 'pt', 'calc(var(--header-height) * 2)')
 *   -> 'pt_header2' (если найдена в styles)
 */
export const calcStringToClass = (
  stylesMap: StyleMaps,
  prefix: string,
  calcStr: string
): string | undefined => {
  const key = CALC_STRING_MAP[calcStr];
  if (!key) return undefined;

  const className = `${prefix}_${key}`;

  if (Array.isArray(stylesMap)) {
    for (const m of stylesMap) {
      const v = css(m, className);
      if (v) return v;
    }
    return undefined;
  }
  return css(stylesMap, className);
};

/**
 * Преобразует массив calc-строк (по брейкпоинтам) в массив CSS-классов.
 * Используется для responsive calc-значений.
 *
 * Пример:
 * - calcStringsToClasses(styles, 'pt', ['calc(var(--header-height) * 2)', null, 'calc(var(--header-height) * 2)'])
 *   -> ['pt_header2', undefined, 't_pt_header2']
 */
export const calcStringsToClasses = (
  stylesMap: StyleMaps,
  prefix: string,
  values: [string | null, string | null, string | null]
): Array<string | undefined> => {
  const [d, m, t] = values;
  return [
    d ? calcStringToClass(stylesMap, `d_${prefix}`, d) : undefined,
    m ? calcStringToClass(stylesMap, `m_${prefix}`, m) : undefined,
    t ? calcStringToClass(stylesMap, `t_${prefix}`, t) : undefined,
  ];
};
