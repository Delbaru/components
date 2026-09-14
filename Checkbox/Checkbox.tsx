'use client';

import { useCallback, useEffect, useId, type CSSProperties } from 'react';
import type React from 'react';
import styles from './Checkbox.module.scss';
import {
    cx,
    createLayoutClasses,
    growStyle,
    inlineGrowClassName,
    inlineSpaceStyle,
    sizeClasses,
    sizeInlineStyle,
    needsInlineGrow,
    splitRootDomProps,
    stateProps,
    layoutSpaceClasses,
    resolveBorderClassResolution,
    resolveBorderStyles,
    stateLinkProps,
    tokenStyles,
    resolveRadiusInput,
    type BorderStyleProps,
    type ComponentStateValue,
    type StateLinkInput,
    type LayoutSpaceProps,
    type RadiusPropsShort,
    type ResponsiveValue,
    type SizePropsShort,
    type GrowProps,
    radiusClasses
} from '../core';
import { Icon } from '../Icon';
import { Flex } from '../Flex';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import type { WithRef } from '../core';

const c = createLayoutClasses([styles, tokenStyles]);

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, LayoutSpaceProps, SizePropsShort, BorderStyleProps, GrowProps, SharedMotionProps, RadiusPropsShort {
    style?: CSSProperties;
    bg?: string;
    children?: React.ReactNode;
    indeterminate?: boolean;
    /** Куда прижат квадрат относительно подписи. По умолчанию по центру; 'start' нужен карточке
     *  с двухстрочной подписью — там квадрат стоит вровень с ПЕРВОЙ строкой, а не с серединой. */
    alignItems?: 'center' | 'start';
    gap?: ResponsiveValue<number>;
    state?: ComponentStateValue;
    // Размер бокса в токенах (дефолт 24). Кортежем — когда квадрат живёт и ниже 1024: скаляр
    // печатает класс БЕЗ брейкпоинт-префикса, то есть один размер на все ширины.
    size?: ResponsiveValue<number>;
    // Размер галочки внутри бокса в токенах (дефолт 16).
    iconSize?: ResponsiveValue<number>;
    'data-error'?: string;
    'data-point-events'?: string;
    linkState?: StateLinkInput;
}

export function Checkbox({
    ref,
    className = '',
    style,
    bg,
    children,
    indeterminate = false,
    alignItems = 'center',
    gap,
    p, pt, pr, pb, pl,
    m, mt, mr, mb, ml,
    r, tlr, trr, brr, blr,
    grow,
    w, minW, maxW, h, minH, maxH,
    border, borderC, borderS, borderW, borderT, borderR, borderB, borderL,
    perspective3d,
    parallax,
    onMouseEnter,
    onMouseLeave,
    onClick,
    onFocus,
    onBlur,
    id: idProp,
    state, linkState,
    size,
    iconSize,
    'data-point-events': dataPointEvents,
    ...props
}: WithRef<CheckboxProps, HTMLInputElement>) {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const bgClasses = c.literal('bg', bg);
    const hasBgClass = Boolean(bgClasses[0]);
    const radiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr });
    const borderClassResolution = resolveBorderClassResolution(c, { border, borderC, borderS, borderW, borderT, borderR, borderB, borderL });
    // `size`/`iconSize` разобраны выше и в `props` их уже нет — но каст возвращал бы их в тип,
    // и после того, как они стали кортежами, `<input size={…}>` перестал сходиться с нативным
    // атрибутом. Убираем их из каста, а не из разбора: разбор и так верен.
    const { rootProps, elementProps } = splitRootDomProps(props as Omit<CheckboxProps, 'size' | 'iconSize'> & Record<string, unknown>);
    const { 'data-error': dataError, ...inputProps } = elementProps;
    const isDisabled = Boolean(inputProps.disabled);
    const isChecked = Boolean(inputProps.checked ?? inputProps.defaultChecked);
    const isPassiveReadOnly = Boolean(inputProps.readOnly)
        && !inputProps.onChange
        && !onClick
        && !onFocus
        && !onBlur
        && !onMouseEnter
        && !onMouseLeave
        && !linkState;
    const rootDataPointEvents = dataPointEvents ?? (isPassiveReadOnly ? 'none' : undefined);
    const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
    const setRootRef = useCallback((node: HTMLLabelElement | null) => {
        setMotionNode(node);
    }, [setMotionNode]);

    useEffect(() => {
        if (typeof ref !== 'function' && ref?.current) {
            ref.current.indeterminate = indeterminate;
        }
    }, [ref, indeterminate]);

    return (
        <label
            ref={setRootRef}
            htmlFor={id}
            data-point-events={rootDataPointEvents}
            {...(rootProps as React.LabelHTMLAttributes<HTMLLabelElement>)}
            {...(!isDisabled ? stateLinkProps(linkState, { onMouseEnter, onMouseLeave, onClick, onFocus, onBlur, ...motionHandlers }) : {})}
            className={cx(
                styles.Checkbox,
                ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
                ...sizeClasses(c, { w, minW, maxW, h, minH, maxH }),
                ...radiusClasses(c, radiusProps),
                ...borderClassResolution.classes,
                ...bgClasses,
                needsInlineGrow(grow) && inlineGrowClassName(),
                className
            )}
            style={{
                ...inlineSpaceStyle({ p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
                ...(bg && !hasBgClass ? { background: bg } : null),
                ...sizeInlineStyle({ w, minW, maxW, h, minH, maxH }),
                ...growStyle(grow),
                ...resolveBorderStyles({ border, borderC, borderS, borderW, borderT, borderR, borderB, borderL }, borderClassResolution.styleSkips),
                ...(motionStyle ?? null),
                ...style,
            }}
            {...stateProps(state, isChecked && 'active', dataError && 'error', isDisabled && 'disabled')}
        >
            {/* Ряд тянется на ширину <label>: `grow` + `minW:0`. Без них базовый размер ряда
                считается по КОНТЕНТУ, а у карточки с растущей подписью (`w:0 grow:1`) контент
                вносит ноль — ряд схлопывается, и подпись переносится по одному слову. У
                контентных вариантов (bare/tile) ширина метки и так равна контенту, поэтому
                рост ничего не меняет. */}
            {/* Геометрия квадрата и его ряда записана СКАЛЯРАМИ, а не `[N, null, null]`:
                скаляр печатает класс без брейкпоинт-префикса и потому действует на всех
                ширинах. С кортежем ниже 1024 не было ни ширины, ни высоты, ни радиуса — то
                есть квадрат схлопывался в точку (§12 «Экран, который живёт НИЖЕ 1024»). */}
            <Flex gap={gap ?? 8} align={alignItems} grow={1} minW={0}>
                <input ref={ref} id={id} type="checkbox" className={styles.Input} {...inputProps} />

                <Flex
                    className={styles.Box}
                    w={size ?? 24}
                    h={size ?? 24}
                    r={8}
                    align='center'
                    justify='center'
                    // Цвет нити — через переменную с ПРЕЖНИМ дефолтом: класс квадрата
                    // принадлежит этому модулю и хэшируется, то есть с call-site его не
                    // перебить ничем (§12 «отдай правило ПЕРЕМЕННОЙ, а не спорь
                    // специфичностью»). Публичной части нужен `hair` — там квадрат стоит в
                    // ряду с полями на такой же нити.
                    border='calc(1 * var(--rpx)) solid var(--checkbox-box-border, var(--gray))'
                    aria-hidden
                    {...stateProps(isChecked && 'active')}
                >
                    <Icon
                        src="/icons/ui/check/succsess_check_black.svg"
                        w={iconSize ?? 16}
                        h={iconSize ?? 16}
                        fill='var(--white-100)'
                        className={styles.icon}
                        aria-hidden
                    />
                </Flex>

                {children}
            </Flex>
        </label>
    );
}
