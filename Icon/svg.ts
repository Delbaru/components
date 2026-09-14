import type React from 'react';

import { sanitizeSvgMarkup } from '../core';

// Чистый конвейер SVG-иконки: безопасная перекраска, разбор файла, источник по пропсам.

const SAFE_SVG_PAINT_PATTERNS = [
  /^(?:none|currentColor|transparent|inherit|context-fill|context-stroke)$/i,
  /^#[0-9a-f]{3,8}$/i,
  /^(?:rgb|rgba|hsl|hsla)\(\s*[-\d.%\s,]+\)$/i,
  /^var\(\s*--[\w-]+\s*(?:,\s*[^()]+)?\)$/i,
  /^url\(\s*['"]?#[-\w]+['"]?\s*\)$/i,
  /^[a-z]+$/i,
] as const;

const SAFE_SVG_STROKE_WIDTH_PATTERN = /^(?:\d+|\d*\.\d+)(?:px|em|rem|%)?$/i;

function sanitizeSvgPaintValue(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  return SAFE_SVG_PAINT_PATTERNS.some((pattern) => pattern.test(normalized)) ? normalized : undefined;
}

function sanitizeSvgStrokeWidthValue(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  return SAFE_SVG_STROKE_WIDTH_PATTERN.test(normalized) ? normalized : undefined;
}

function rewriteSvgPaintAttributes(content: string, normalizeContent = false): string {
  return content
    .replace(/\bstroke-width\s*=\s*["']([^"']*)["']/gi, (_match: string, value: string) => {
      const safeValue = sanitizeSvgStrokeWidthValue(value);

      if (normalizeContent) {
        return safeValue
          ? `stroke-width="var(--icon-stroke-width, ${safeValue})"`
          : 'stroke-width="var(--icon-stroke-width)"';
      }

      return safeValue ? `stroke-width="${safeValue}"` : '';
    })
    .replace(/\bstroke\s*=\s*["']([^"']*)["']/gi, (_match: string, value: string) => {
      if (value.trim().toLowerCase() === 'none') return 'stroke="none"';

      const safeValue = sanitizeSvgPaintValue(value);

      if (normalizeContent) {
        return safeValue
          ? `stroke="var(--icon-stroke, ${safeValue})"`
          : 'stroke="var(--icon-stroke)"';
      }

      return safeValue ? `stroke="${safeValue}"` : '';
    })
    .replace(/\bfill\s*=\s*["']([^"']*)["']/gi, (_match: string, value: string) => {
      if (value.trim().toLowerCase() === 'none') return 'fill="none"';

      const safeValue = sanitizeSvgPaintValue(value);

      if (normalizeContent) {
        return safeValue
          ? `fill="var(--icon-fill, ${safeValue})"`
          : 'fill="var(--icon-fill)"';
      }

      return safeValue ? `fill="${safeValue}"` : '';
    });
}

/** Подменяет stroke/fill в контенте на CSS-переменные, сохраняя исходный цвет как fallback. */
function normalizeSvgContent(content: string): string {
  return rewriteSvgPaintAttributes(content, true);
}

export function parseSvg(text: string, normalizeContent = false): { content: string; viewBox?: string; rootFill?: string } {
  const sanitizedText = sanitizeSvgMarkup(text);
  const svgMatch = sanitizedText.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
  if (svgMatch) {
    const [, attributes = '', inner = ''] = svgMatch;
    const viewBox = attributes.match(/viewBox=["']([^"']+)["']/i)?.[1];
    const fill = attributes.match(/\bfill=["']([^"']+)["']/i)?.[1];
    return {
      content: normalizeContent ? normalizeSvgContent(inner) : rewriteSvgPaintAttributes(inner),
      viewBox,
      rootFill: fill ? sanitizeSvgPaintValue(fill) : undefined,
    };
  }

  throw new Error('Invalid SVG response');
}

export interface ParsedSvg {
  content: string;
  viewBox?: string;
  rootFill?: string;
}

// Тип для SVG компонента, который возвращает SVGR
export type IconComponent = React.FC<React.SVGProps<SVGSVGElement>>;

export interface IconSource {
  src?: string | IconComponent;
  name?: string;
  component?: IconComponent;
}

export type IconSourceInput = string | IconComponent | IconSource | undefined;
export interface ResolvedIconSource {
  url: string | null;
  component?: IconComponent;
}

function isIconComponentSource(source: unknown): source is IconComponent {
  return typeof source === 'function'
    || (typeof source === 'object' && source !== null && '$$typeof' in source);
}

function resolveIconUrl(source: string): string {
  const value = source
    .trim()
    .replace(/^\.\//, '')
    .replace(/^public\//, '');

  if (!value) return value;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/')) return value;
  if (value.startsWith('icons/')) return `/${value}`;
  if (value.endsWith('.svg')) return `/icons/${value}`;

  return `/icons/${value}.svg`;
}

export function resolveIconSource(source?: IconSourceInput): ResolvedIconSource {
  if (!source) return { url: null };
  if (typeof source === 'string') return { url: resolveIconUrl(source) };
  if (isIconComponentSource(source)) return { component: source, url: null };

  return {
    component: source.component ?? (isIconComponentSource(source.src) ? source.src : undefined),
    url: typeof source.src === 'string'
      ? resolveIconUrl(source.src)
      : (source.name ? `/icons/${source.name}.svg` : null),
  };
}

export function hasIconSource(source: ResolvedIconSource): boolean {
  return Boolean(source.component || source.url);
}

export function parseAspectRatio(viewBox?: string): React.CSSProperties['aspectRatio'] | undefined {
  if (!viewBox) return undefined;

  const [, , widthRaw, heightRaw] = viewBox.trim().split(/[\s,]+/);
  const width = Number(widthRaw);
  const height = Number(heightRaw);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return `${width} / ${height}`;
}
