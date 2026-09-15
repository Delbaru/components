import type { ClassBuilder } from '../layout/layout-classes';
import type { ResponsiveSpaceValue, SpaceValue } from '../layout/space';
import type { ResponsiveValue } from './responsive';
import { borderClasses, layoutSpaceClasses, radiusClasses, sizeClasses, type BorderStyleProps, type LayoutSpaceProps, type RadiusPropsShort, type SizePropsShort } from './shared-props';

/**
 * Объединённый интерфейс layout-пропсов для field-компонентов
 * (Input, Textarea, Select и аналогичных).
 */
export interface FieldLayoutProps extends LayoutSpaceProps, RadiusPropsShort, SizePropsShort, BorderStyleProps {
    variant?: ResponsiveValue<string>;
    size?: ResponsiveValue<string>;
    bg?: string;
    color?: string;
    placeholderColor?: string;
}

/** Классы поля за один вызов: вариант и размер — из модуля поля, остальное — утилиты. */
export function fieldLayoutClasses(c: ClassBuilder, props: FieldLayoutProps): string[] {
    return [
        ...c.value('variant', props.variant),
        ...c.value('size', props.size),
        ...layoutSpaceClasses(c, props),
        ...radiusClasses(c, props),
        ...sizeClasses(c, props),
        ...c.value('bg', props.bg),
        ...c.value('color', props.color),
        ...c.value('placeholderColor', props.placeholderColor),
        ...borderClasses(c, props),
    ];
}

const isSpaceToken = (value: unknown): value is number | string =>
    typeof value === 'number' || typeof value === 'string';

const extractLeftFromEntry = (entry: unknown): number | string | null | undefined => {
    if (entry === null || entry === undefined) return entry;
    if (isSpaceToken(entry)) return entry;
    if (Array.isArray(entry) && entry.length === 4 && entry.every(isSpaceToken)) {
        return entry[3] as number | string;
    }
    return undefined;
};

/**
 * Возвращает `padding-left` для helper-текста (error/comment)
 * на основе `p`/`pl` пропсов field-компонента.
 *
 * Поддерживает:
 * - число / строку
 * - shorthand-массив `[top, right, bottom, left]`
 * - responsive-массив `[desktop, mobile, tablet]`, где каждый breakpoint
 *   может быть числом, строкой или shorthand-массивом.
 */
export function fieldHelperPaddingLeft(
    p: ResponsiveSpaceValue | undefined,
    pl: ResponsiveValue<SpaceValue> | undefined
): ResponsiveValue<SpaceValue> | undefined {
    if (pl !== undefined) return pl;
    if (p === undefined) return undefined;
    if (!Array.isArray(p)) return p as ResponsiveValue<SpaceValue>;

    // shorthand [top, right, bottom, left]
    if (p.length === 4 && p.every(isSpaceToken)) {
        return p[3] as SpaceValue;
    }

    // responsive array [desktop, mobile, tablet]
    const [d0, m0, t0] = p as [unknown, unknown, unknown];
    const d = extractLeftFromEntry(d0) ?? null;
    const mRaw = extractLeftFromEntry(m0);
    const tRaw = extractLeftFromEntry(t0);
    const m = mRaw === undefined ? d : (mRaw ?? null);
    const t = tRaw === undefined ? d : (tRaw ?? null);

    if (d === null && m === null && t === null) return undefined;
    return [d, m, t] as ResponsiveValue<SpaceValue>;
}
