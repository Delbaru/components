import { css } from '../base/cn';
import { resolveResponsive, type ResponsiveValue } from '../base/responsive';

type BpPrefix = '' | 'd_' | 'm_' | 't_';

export type StyleMaps = Record<string, string> | Record<string, string>[];

export const lookup = (maps: StyleMaps, key: string): string | undefined => {
  if (Array.isArray(maps)) {
    for (const m of maps) {
      const v = css(m, key);
      if (v) return v;
    }
    return undefined;
  }
  return css(maps, key);
};

/**
 * Превращает responsive-проп в список CSS-Module классов.
 *
 * Идея:
 * - value = 12              -> класс `gap_12`
 * - value = [24, 12, 16]    -> классы `d_gap_24`, `m_gap_12`, `t_gap_16`
 *
 * Важно:
 * - Если `toKey(v)` вернул `undefined`, класс не будет добавлен (это используется для inline-only значений).
 */
export const responsiveClasses = <T,>(
  styles: StyleMaps,
  prefix: string,
  value: ResponsiveValue<T> | undefined,
  toKey: (v: T) => string | undefined
): Array<string | undefined> => {
  if (value === undefined) return [];

  const one = (bp: BpPrefix, v: T | null) => {
    if (v === null) return undefined;
    const k = toKey(v);
    return k ? lookup(styles, `${bp}${prefix}_${k}`) : undefined;
  };

  if (!Array.isArray(value)) return [one('', value)];

  const [d, m, t] = resolveResponsive(value);
  return [one('d_', d), one('m_', m), one('t_', t)];
};

