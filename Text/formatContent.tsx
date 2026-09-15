import type React from 'react';

import { decodeHtmlEntities, stripHtmlTags, resolveResponsive, type ResponsiveValue } from '../core';

export type TextFormat = 'default' | 'plain' | 'breaks';

const splitByBr = (value: string): (string | React.ReactElement)[] => {
  const parts = value.split(/<br\s*\/?\s*>/i);
  return parts.flatMap((part, idx) => (idx < parts.length - 1 ? [part, <br key={`br-${idx}`} />] : [part]));
};

/**
 * Форматирует строковый children по пропу `format`: 'plain' декодирует сущности и срезает теги,
 * 'breaks' заменяет <br> на реальные переносы, 'default' — как есть. Не-строки отдаются без изменений.
 */
export function resolveTextContent(
  children: React.ReactNode,
  format: ResponsiveValue<TextFormat> = ['default', 'default', 'default']
): React.ReactNode {
  if (typeof children !== 'string') return children;

  const resolvedFormat = Array.isArray(format) ? resolveResponsive(format)[0] ?? 'default' : format;
  const decoded = decodeHtmlEntities(children);

  if (resolvedFormat === 'plain') return stripHtmlTags(decoded);
  if (resolvedFormat === 'breaks') return splitByBr(decoded);
  return children;
}
