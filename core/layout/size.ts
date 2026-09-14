import type { CSSProperties } from 'react';
import { resolveResponsive, type ResponsiveValue } from '../base/responsive';
import { CALC_STRING_MAP } from '../_calc-string-map';

// Значение для width/height/min/max:
// - number     -> токен (будет классом и умножится на var(--rpx) в SCSS)
// - string     -> либо тоже класс (например "100%", "100vw"), либо inline (например "auto", "fit-content")
export type SizeValue = number | (CSSProperties['width'] & string);

// CSS-keyword значения, которые поддерживаются как классы (синхронизировано с $sizeKeywords в scss-utils.scss).
// Ключ — CSS-значение, значение — суффикс класса.
const sizeKeywordMap: Record<string, string> = {
  auto: 'auto',
  'fit-content': 'fit_content',
  'max-content': 'max_content',
  'min-content': 'min_content',
};

/**
 * Превращает значение размера в "ключ класса" (suffix после `_`).
 * Если вернуть `undefined` — значит значение нужно ставить inline-стилем.
 *
 * Примеры:
 * - 200            => "200"           -> класс `width_200`
 * - "100vw"        => "vw_100"        -> класс `width_vw_100`
 * - "50%"          => "p_50"          -> класс `width_p_50`
 * - "auto"         => "auto"          -> класс `width_auto`
 * - "fit-content"  => "fit_content"   -> класс `width_fit_content`
 * - "calc(...)"    => undefined       -> будет inline
 */
export const sizeClassKey = (v: SizeValue): string | undefined => {
  if (typeof v === 'number') return String(v);

  // CSS-keyword (auto, fit-content, max-content, min-content)
  const kw = sizeKeywordMap[v];
  if (kw) return kw;

  // calc(...) -> class по карте
  if (v.includes('calc(')) {
    const key = CALC_STRING_MAP[v];
    if (key) return key;
    return undefined;
  }

  // 100vw / 100vh / 100dvw / 100dvh
  const m1 = v.match(/^(\d+)(vw|vh|dvw|dvh)$/);
  if (m1) return `${m1[2]}_${m1[1]}`;

  // 50%
  const m2 = v.match(/^(\d+)%$/);
  if (m2) return `p_${m2[1]}`;

  // Любые остальные строки ("calc(...)" и т.д.) идут inline.
  return undefined;
};

/**
 * true, если значение нужно ставить inline (а не классом).
 * Важно: это только про СТРОКИ. Числа считаются токенами и идут через классы.
 */
export const inlineOnlySize = (v: unknown): v is string =>
  typeof v === 'string' && !Array.isArray(v) && sizeClassKey(v) === undefined;

type InlineSizeProp = 'width' | 'minWidth' | 'maxWidth' | 'height' | 'minHeight' | 'maxHeight';
type InlineSizeBreakpoint = 'd' | 'm' | 't';
type InlineSizeCssVar = `--inline-size-${InlineSizeProp}-${InlineSizeBreakpoint}`;
type InlineSizeStyle = CSSProperties & Partial<Record<InlineSizeCssVar, string>>;

type InlineSizeInput = Partial<Record<InlineSizeProp, ResponsiveValue<SizeValue> | undefined>>;

const inlineSizeClassMap: Record<InlineSizeProp, string> = {
  width: 'inlineWidth',
  minWidth: 'inlineMinWidth',
  maxWidth: 'inlineMaxWidth',
  height: 'inlineHeight',
  minHeight: 'inlineMinHeight',
  maxHeight: 'inlineMaxHeight',
};

const formatSizeValue = (value: SizeValue | null | undefined): string | undefined => {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'number' ? `calc(var(--rpx) * ${value})` : value;
};

const needsInlineSizeEntry = (value: SizeValue | null | undefined): boolean =>
  typeof value === 'string' && sizeClassKey(value) === undefined;

export const needsInlineSize = (value: ResponsiveValue<SizeValue> | undefined): boolean => {
  if (value === undefined) return false;
  if (!Array.isArray(value)) return inlineOnlySize(value);

  return resolveResponsive(value).some((entry) => needsInlineSizeEntry(entry));
};

export const inlineSizeClassName = (prop: InlineSizeProp): string => inlineSizeClassMap[prop];

const setInlineSizeVariables = (style: InlineSizeStyle, prop: InlineSizeProp, value: ResponsiveValue<SizeValue> | undefined) => {
  if (!value || !Array.isArray(value) || !needsInlineSize(value)) return;

  const [desktop, mobile, tablet] = resolveResponsive(value);
  const values: Array<[InlineSizeBreakpoint, SizeValue | null]> = [
    ['d', desktop],
    ['m', mobile],
    ['t', tablet],
  ];

  for (const [breakpoint, entry] of values) {
    const formattedValue = formatSizeValue(entry);

    if (!formattedValue) continue;

    style[`--inline-size-${prop}-${breakpoint}`] = formattedValue;
  }
};

/**
 * Ставит inline-стили только для тех size-пропсов, которые не представлены классами.
 * Это позволяет спокойно смешивать:
 * - `w={200}` (класс)
 * - `w="100%"` (класс)
 * - `w="fit-content"` (inline)
 */
export const inlineSizeStyle = (sizes: InlineSizeInput): CSSProperties => {
  const out: InlineSizeStyle = {};
  ([
    'width',
    'minWidth',
    'maxWidth',
    'height',
    'minHeight',
    'maxHeight',
  ] as const).forEach((k) => {
    const v = sizes[k];
    if (v === undefined) return;

    if (!Array.isArray(v) && inlineOnlySize(v)) {
      // CSSProperties не даёт индексировать ключами строго типобезопасно, поэтому делаем точечный cast без `any`.
      (out as Record<typeof k, string>)[k] = v;
      return;
    }

    setInlineSizeVariables(out, k, v);
  });
  return out;
};

