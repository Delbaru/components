import type { ReactNode } from 'react';

/**
 * Сводит children к плоской строке для посимвольных анимаций (textReveal/textSlide-swap).
 * Строка → как есть; число → String(n); массив строк/чисел (например интерполяция `{value}%`
 * или `{a} из {b}`) → склейка. Любой React-элемент/непримитив внутри → null: значит контент
 * не чисто текстовый, посимвольно анимировать нельзя (плагин отдаст контент как есть).
 */
export function flattenAnimatableText(node: ReactNode): string | null {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);

  if (Array.isArray(node)) {
    let out = '';
    for (const child of node) {
      const part = flattenAnimatableText(child as ReactNode);
      if (part === null) return null;
      out += part;
    }
    return out;
  }

  return null;
}
