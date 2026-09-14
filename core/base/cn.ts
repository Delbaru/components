// Базовые утилиты для работы с CSS-классами.
// Важно: это НЕ "layout-утилиты". Это пригодится любым компонентам (Button/Input/Text и т.д.).

export type ClassValue = string | undefined | null | false;

/**
 * Склеивает классы в одну строку.
 * - Удобно, потому что можно передавать `false/null/undefined` (они будут проигнорированы).
 *
 * Пример:
 * `cx(styles.Button, isActive && styles.active, className)`
 */
export const cx = (...classes: ClassValue[]) => classes.filter(Boolean).join(' ');

/**
 * Достаёт класс из CSS Modules по ключу.
 * - Нужен, когда мы строим имя класса динамически (например `d_gap_12`).
 *
 * Пример:
 * `css(styles, 'd_gap_12')`
 */
export const css = (styles: Record<string, string>, key?: string) => (key ? styles[key] : undefined);

