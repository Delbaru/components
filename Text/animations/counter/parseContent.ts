export interface ParsedCount {
    to: number;
    suffix: string;
    grouped: boolean;
}

// Достаём число + суффикс из текстового контента counter'а: «3 000+» → { to: 3000, suffix: '+', grouped: true },
// «70%» → { to: 70, suffix: '%' }, «24/7» → { to: 24, suffix: '/7' }. Нет цифр («∞») → null, тогда counter
// неактивен и Text рисует контент как есть. Явный `to` в опциях имеет приоритет над разбором (см. Counter).
export function parseCountContent(content: unknown): ParsedCount | null {
    if (typeof content !== 'string' || !/\d/.test(content)) return null;

    const match = content.match(/[\d\s]+/);
    if (!match) return null;

    const digits = match[0];
    const to = Number(digits.replace(/\s/g, ''));
    if (!Number.isFinite(to)) return null;

    return {
        to,
        grouped: /\s/.test(digits.trim()),
        suffix: content.slice((match.index ?? 0) + digits.length).trim(),
    };
}
