/**
 * Shared HTML / text helpers — used by Text, RichText and any component
 * that deals with HTML-string content.
 */

import type { CSSProperties } from 'react';
import type { ResponsiveInput } from './responsive';
import { resolveResponsive } from './responsive';

// ── HTML entity decoding ────────────────────────────────

export const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': '\'',
  '&nbsp;': '\u00A0',
};

export const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => HTML_ENTITY_MAP[entity] ?? entity);

export const stripHtmlTags = (value: string): string =>
  value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Лёгкий синхронный санитайзер для НАШИХ СОБСТВЕННЫХ SVG-иконок (build-ассеты из public/icons и
// инлайн-манифеста — не пользовательский ввод). Убирает то же, что прежний DOMPurify-профиль svg
// (script/foreignObject, обработчики событий, style, javascript:-ссылки), но БЕЗ зависимости DOMPurify.
// Важно для веса: Icon рендерится почти на каждом экране, поэтому DOMPurify тянулся в общий чанк.
// Пользовательский rich-text по-прежнему чистится DOMPurify — см. sanitizeRichTextHtml в ./html-sanitize.
const SVG_SCRIPT_BLOCK = /<script\b[\s\S]*?<\/script\s*>/gi;
const SVG_FOREIGNOBJECT_BLOCK = /<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi;
const SVG_STRAY_FORBIDDEN_TAG = /<\/?(?:script|foreignObject)\b[^>]*>/gi;
const SVG_EVENT_HANDLER_ATTR = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const SVG_STYLE_ATTR = /\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi;
const SVG_JS_HREF = /\s(?:xlink:href|href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi;

export const sanitizeSvgMarkup = (value: string): string =>
  value
    .replace(SVG_SCRIPT_BLOCK, '')
    .replace(SVG_FOREIGNOBJECT_BLOCK, '')
    .replace(SVG_STRAY_FORBIDDEN_TAG, '')
    .replace(SVG_EVENT_HANDLER_ATTR, '')
    .replace(SVG_STYLE_ATTR, '')
    .replace(SVG_JS_HREF, '');

// ── Row-clamp helpers ───────────────────────────────────

export const normalizeRowsValue = (value: number | null | undefined): string | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return String(Math.max(1, Math.round(value)));
};

type ClampStyle = CSSProperties & {
  '--text-rows-d'?: string;
  '--text-rows-m'?: string;
  '--text-rows-t'?: string;
};

export const buildClampStyle = (rows: ResponsiveInput<number> | undefined): ClampStyle => {
  if (rows === undefined) return {};
  const [desktop, mobile, tablet] = resolveResponsive(rows);
  return {
    ...(normalizeRowsValue(desktop) ? { '--text-rows-d': normalizeRowsValue(desktop) } : null),
    ...(normalizeRowsValue(mobile) ? { '--text-rows-m': normalizeRowsValue(mobile) } : null),
    ...(normalizeRowsValue(tablet) ? { '--text-rows-t': normalizeRowsValue(tablet) } : null),
  };
};
