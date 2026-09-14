/**
 * Санитайзер пользовательского rich-text (HTML из Lexical-редактора). Вынесен из html-utils в
 * отдельный модуль, чтобы тяжёлый DOMPurify (isomorphic-dompurify → jsdom на SSR) НЕ попадал в
 * общий чанк через html-utils, который тянет вездесущий Text (decode/clamp-хелперы). Теперь DOMPurify
 * подтягивается только там, где реально рендерится rich-text (RichText), а не на каждом экране.
 *
 * isomorphic-dompurify оставлен намеренно: rich-text может рендериться на сервере, и он безопасен в SSR.
 */
import DOMPurify from 'isomorphic-dompurify';

const RICH_TEXT_ALLOWED_TAGS = [
  'a',
  'b',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'mark',
  'ol',
  'p',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
  'ul',
] as const;

const RICH_TEXT_ALLOWED_ATTR = ['href', 'rel', 'target', 'title'] as const;

export const sanitizeRichTextHtml = (value: string): string =>
  DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...RICH_TEXT_ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
  });
