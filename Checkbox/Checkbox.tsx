'use client';

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import type React from 'react';
import styles from './Checkbox.module.scss';
import { boxLayout, createLayoutClasses, cx, splitBoxLayout, splitRootDomProps, stateLinkProps, stateProps, useMergedRefs, type BoxLayoutProps, type ComponentStateValue, type ResponsiveValue, type StateLinkInput, type WithRef } from '../core';
import { Icon } from '../Icon';
import { Flex } from '../Flex';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

const c = createLayoutClasses(styles);

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, Omit<BoxLayoutProps, 'aspectRatio'>, SharedMotionProps {
    style?: CSSProperties;
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
    children,
    indeterminate = false,
    alignItems = 'center',
    gap,
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
    const { box, rest } = splitBoxLayout(props);
    const layout = boxLayout(c, box);
    const { rootProps, elementProps } = splitRootDomProps(rest as typeof rest & Record<string, unknown>);
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
    const inputRef = useRef<HTMLInputElement | null>(null);
    const setInputRef = useMergedRefs(inputRef, ref);

    useEffect(() => {
        if (inputRef.current) inputRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
        <label
            ref={setMotionNode}
            htmlFor={id}
            data-point-events={rootDataPointEvents}
            {...(rootProps as React.LabelHTMLAttributes<HTMLLabelElement>)}
            {...(!isDisabled ? stateLinkProps(linkState, { onMouseEnter, onMouseLeave, onClick, onFocus, onBlur, ...motionHandlers }) : {})}
            className={cx(styles.Checkbox, ...layout, className)}
            style={{ ...(motionStyle ?? null), ...style }}
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
                <input ref={setInputRef} id={id} type="checkbox" className={styles.Input} {...inputProps} />

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
