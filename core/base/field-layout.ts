import type { CSSProperties } from 'react';
import type { BorderStyleProps, BorderStyleSkipMap, ClassBuilder, LayoutSpaceProps, RadiusPropsShort, SizePropsShort } from './shared-props';
import type { ResponsiveValue } from './responsive';
import { layoutSpaceClasses, radiusClasses, resolveBorderClassResolution, resolveBorderStyles, resolveRadiusInput, responsiveValueHasFullClassCoverage, sizeClasses, sizeInlineStyle } from './shared-props';
import { inlineSpaceStyle, type ResponsiveSpaceValue, type SpaceValue } from '../layout/space';

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

export interface FieldLayoutClassResolution {
    classes: (string | undefined)[];
    styleSkips: {
        bg?: boolean;
        color?: boolean;
        placeholderColor?: boolean;
        border: BorderStyleSkipMap;
    };
}

export function resolveFieldLayoutClassResolution(
    c: ClassBuilder,
    props: FieldLayoutProps
): FieldLayoutClassResolution {
    const {
        variant, size,
        p, pt, pr, pb, pl, m, mt, mr, mb, ml,
        r, tlr, trr, brr, blr,
        borderTLR, borderTRR, borderBRR, borderBLR,
        border, borderC, borderS, borderW, borderT, borderR, borderB, borderL,
        w, minW, maxW, h, minH, maxH,
        bg, color, placeholderColor,
    } = props;

    const radiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR });
    const bgClasses = c.literal('bg', bg);
    const colorClasses = c.literal('color', color);
    const placeholderColorClasses = c.literal('placeholderColor', placeholderColor);
    const borderClassResolution = resolveBorderClassResolution(c, { border, borderC, borderS, borderW, borderT, borderR, borderB, borderL });

    return {
        classes: [
            ...c.enum('variant', variant),
            ...c.enum('size', size),
            ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
            ...radiusClasses(c, radiusProps),
            ...sizeClasses(c, { w, minW, maxW, h, minH, maxH }),
            ...bgClasses,
            ...colorClasses,
            ...placeholderColorClasses,
            ...borderClassResolution.classes,
        ],
        styleSkips: {
            bg: responsiveValueHasFullClassCoverage(bg, bgClasses),
            color: responsiveValueHasFullClassCoverage(color, colorClasses),
            placeholderColor: responsiveValueHasFullClassCoverage(placeholderColor, placeholderColorClasses),
            border: borderClassResolution.styleSkips,
        },
    };
}

/**
 * Генерирует массив CSS Module классов для field-компонента за один вызов.
 * Заменяет 5 отдельных spread-вызовов (variant, preset, space, radius, size).
 */
export function fieldLayoutClasses(
    c: ClassBuilder,
    props: FieldLayoutProps
): (string | undefined)[] {
    return resolveFieldLayoutClassResolution(c, props).classes;
}

/**
 * Генерирует inline-стили для field-компонента за один вызов.
 * Заменяет ручную склейку bg, color, placeholderColor, inlineSpaceStyle, sizeInlineStyle.
 */
export function fieldLayoutStyles(
    props: FieldLayoutProps,
    styleSkips?: FieldLayoutClassResolution['styleSkips']
): CSSProperties {
    const {
        bg, color, placeholderColor,
        p, pt, pr, pb, pl, m, mt, mr, mb, ml,
        border, borderC, borderS, borderW, borderT, borderR, borderB, borderL,
        w, minW, maxW, h, minH, maxH,
    } = props;
    const resolvedStyleSkips = styleSkips ?? { border: {} };

    return {
        ...(bg && !resolvedStyleSkips.bg ? { background: bg } : null),
        ...(color && !resolvedStyleSkips.color ? { color } : null),
        ...(placeholderColor && !resolvedStyleSkips.placeholderColor
            ? { ['--field-placeholder-color' as string]: placeholderColor } as CSSProperties
            : null),
        ...inlineSpaceStyle({ p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
        ...resolveBorderStyles({ border, borderC, borderS, borderW, borderT, borderR, borderB, borderL }, resolvedStyleSkips.border),
        ...sizeInlineStyle({ w, minW, maxW, h, minH, maxH }),
    };
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
