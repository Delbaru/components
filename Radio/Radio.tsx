'use client';

import { forwardRef, useCallback, useId, type CSSProperties } from 'react';
import type React from 'react';
import styles from './Radio.module.scss';
import { cx, createLayoutClasses, growStyle, inlineGrowClassName, inlineSpaceStyle, stateProps, needsInlineGrow, layoutSpaceClasses, radiusClasses, stateLinkProps, tokenStyles, type ComponentStateValue, type StateLinkInput, type LayoutSpaceProps, type RadiusPropsShort, type ResponsiveValue, type GrowProps } from '../core';
import { Flex } from '../Flex';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

const c = createLayoutClasses([styles, tokenStyles]);

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, LayoutSpaceProps, RadiusPropsShort, GrowProps, SharedMotionProps {
    style?: CSSProperties;
    children?: React.ReactNode;
    gap?: ResponsiveValue<number>;
    state?: ComponentStateValue;
    // Цвет отмеченного состояния: success (зелёный, дефолт — «правильный ответ») / primary (синий — «выбран»).
    tone?: 'success' | 'primary';
    // Размер бокса в токенах (дефолт 20).
    size?: number;
    // Размер точки в токенах (дефолт 12).
    dotSize?: number;
    'data-point-events'?: string;
    linkState?: StateLinkInput;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
    (
        {
            className = '',
            style,
            children,
            gap,
            p,
            pt,
            pr,
            pb,
            pl,
            m,
            mt,
            mr,
            mb,
            ml,
            r,
            tlr,
            trr,
            brr,
            blr,
            borderTLR,
            borderTRR,
            borderBRR,
            borderBLR,
            grow,
            perspective3d,
            parallax,
            id: idProp,
            state,
            tone,
            size,
            dotSize,
            linkState,
            'data-point-events': dataPointEvents,
            ...props
        },
        ref
    ) => {
        const generatedId = useId();
        const id = idProp ?? generatedId;
        const isDisabled = Boolean(props.disabled);
        const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
        const setRootRef = useCallback((node: HTMLLabelElement | null) => {
            setMotionNode(node);
        }, [setMotionNode]);

        return (
            <label
                ref={setRootRef}
                htmlFor={id}
                data-point-events={dataPointEvents}
                data-tone={tone}
                {...(!isDisabled ? stateLinkProps(linkState, { ...motionHandlers }) : {})}
                className={cx(
                    styles.Radio,
                    ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
                    ...radiusClasses(c, { r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR }),
                    needsInlineGrow(grow) && inlineGrowClassName(),
                    className
                )}
                style={{ ...inlineSpaceStyle({ p, pt, pr, pb, pl, m, mt, mr, mb, ml }), ...growStyle(grow), ...(motionStyle ?? null), ...(size != null ? { ['--radio-box']: size } : null), ...(dotSize != null ? { ['--radio-dot']: dotSize } : null), ...style }}
                {...stateProps(state, isDisabled && 'disabled')}
            >
                <Flex gap={gap ?? [8, null, null]} align={["center", null, null]}>
                    <input ref={ref} id={id} type="radio" className={styles.Input} {...props} />
                    <div className={styles.Box}>
                        <span className={styles.Dot} aria-hidden />
                    </div>
                    {children}
                </Flex>
            </label>
        );
    }
);

Radio.displayName = 'Radio';
