'use client';

import {
    useCallback,
    useState,
    type ChangeEvent,
    type CSSProperties,
    type FocusEvent,
} from 'react';
import type React from 'react';
import styles from './Textarea.module.scss';
import { cx, createLayoutClasses, stateProps, stateLinkProps, useFieldControl, fieldHelperPaddingLeft, type BorderStyleProps, type ComponentStateValue, type StateLinkInput, type LayoutSpaceProps, type RadiusPropsShort, type SizePropsShort, type ResponsiveValue, type GrowProps, type WithRef, fieldLayoutClasses } from '../core';
import { Text } from '../Text';
import { Flex } from '../Flex';
import { Skeleton } from '../Skeleton';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

type VariantKey = 'primary' | 'secondary';
type SizeKey = 'default' | 'fullWidth';

const c = createLayoutClasses(styles, { local: { h: 'height' } });

const DEFAULT_MIN_LENGTH_MESSAGE = (min: number) => `Минимум ${min} символов`;
const DEFAULT_MAX_LENGTH_MESSAGE = (max: number) => `Максимум ${max} символов`;

export interface TextareaProps
    extends Omit<
        React.TextareaHTMLAttributes<HTMLTextAreaElement>,
        'color' | 'placeholder' | 'width' | 'minWidth' | 'maxWidth' | 'height' | 'minHeight' | 'maxHeight'
    >,
    LayoutSpaceProps,
    RadiusPropsShort,
    BorderStyleProps,
    GrowProps,
    SharedMotionProps,
    SizePropsShort {
    style?: CSSProperties;

    variant?: ResponsiveValue<VariantKey>;
    size?: ResponsiveValue<SizeKey>;

    bg?: string;
    color?: string;

    placeholder?: string;
    placeholderColor?: string;
    /**
     * Значение ещё грузится — вместо него скелетон (см. `Skeleton`, §4).
     *
     * У текстового поля он в НЕСКОЛЬКО строк: заглушка обязана занимать столько же места,
     * сколько займёт контент, а у textarea это абзац, а не строка.
     */
    loading?: boolean;
    label?: string;
    labelColor?: string;
    comment?: string;

    rows?: number;
    length?: { min?: number; max?: number };
    showCount?: boolean;
    /**
     * Где рисовать счётчик символов.
     *
     * `inside` (по умолчанию) — абсолютом в правом нижнем углу САМОГО поля: так он нарисован в
     * макете у многострочных редакторов, и вид тех полей менять нельзя.
     * `below` — строкой под полем, справа, как в редакторе шаблонов (`LexicalTextarea` держит
     * счётчик в тулбаре). Нужен там, где значение доходит до правого края и внутренний счётчик
     * ложится поверх текста: у однострочного авторесайза его из-за этого выключали совсем
     * (Roadmap D-122).
     */
    countPlacement?: 'inside' | 'below';

    error?: string;

    state?: ComponentStateValue;

    required?: boolean;
    emptyMessage?: string;
    validate?: (value: string) => string | undefined;

    linkState?: StateLinkInput;
    'data-point-events'?: string;

    /** Класс на САМО поле (внутренний .Textarea — тот, что несёт фон/рамку), а не на обёртку
     *  с label/comment, куда садится className. Нужен скин-обёрткам (SharedTextarea), которые
     *  красят поле осями из components/system/_axes.scss: без этого класс-ось приземлился бы
     *  на обёртку и покрасил бы заодно подпись. */
    fieldClassName?: string;
}

export function Textarea({
    ref,
    className = '',
    style,
    variant,
    size,
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
    border,
    borderC,
    borderS,
    borderW,
    borderT,
    borderR,
    borderB,
    borderL,
    grow,
    perspective3d,
    parallax,
    w,
    minW,
    maxW,
    h,
    minH,
    maxH,
    bg,
    color,
    placeholder,
    placeholderColor,
    loading = false,
    label,
    labelColor,
    comment,
    rows = 3,
    length,
    showCount,
    countPlacement = 'inside',
    error,
    id: idProp,
    onChange,
    onFocus,
    onBlur,
    required,
    emptyMessage,
    validate: validateProp,
    value: _value,
    state,
    linkState,
    'data-point-events': dataPointEvents,
    fieldClassName,
    ...rest
}: WithRef<TextareaProps, HTMLTextAreaElement>) {
    const lengthValidate = useCallback(
        (value: string): string | undefined => {
            if (length?.min != null && value.length > 0 && value.length < length.min)
                return DEFAULT_MIN_LENGTH_MESSAGE(length.min);
            if (length?.max != null && value.length > length.max)
                return DEFAULT_MAX_LENGTH_MESSAGE(length.max);
            return validateProp?.(value);
        },
        [length, validateProp]
    );

    const {
        id, innerRef, currentValue, isControlled, displayError, errorId,
        validateValue, setInternalError, setUncontrolledValue, focusField,
        hasValue,
    } = useFieldControl<HTMLTextAreaElement>(ref, {
        id: idProp,
        value: _value,
        required,
        emptyMessage,
        error,
        validate: lengthValidate,
    });

    const showCounter = showCount ?? (length?.max != null);
    // Подпись одна на оба места: разъехаться формату «сколько/из скольких» негде.
    const counterLabel = `${currentValue.length}/${length?.max ?? 1000}`;
    const [isFieldFocused, setIsFieldFocused] = useState(false);
    const commentId = !displayError && comment ? `${id}-comment` : undefined;
    const helperTextId = displayError ? errorId : commentId;
    const textareaDescribedBy = [rest['aria-describedby'], helperTextId].filter(Boolean).join(' ') || undefined;
    const inlineError = displayError && !isFieldFocused ? displayError : undefined;

    const handleFocus = useCallback(
        (e: FocusEvent<HTMLTextAreaElement>) => {
            setIsFieldFocused(true);
            onFocus?.(e);
        },
        [onFocus]
    );

    const handleBlur = useCallback(
        (e: FocusEvent<HTMLTextAreaElement>) => {
            setIsFieldFocused(false);
            setInternalError(validateValue(e.target.value));
            onBlur?.(e);
        },
        [validateValue, setInternalError, onBlur]
    );

    const handleChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement>) => {
            if (!isControlled) setUncontrolledValue(e.target.value);
            setInternalError(validateValue(e.target.value));
            onChange?.(e);
        },
        [onChange, validateValue, setInternalError, setUncontrolledValue, isControlled]
    );

    const handleInvalid = useCallback(
        (event: React.FormEvent<HTMLTextAreaElement>) => {
            rest.onInvalid?.(event);
            // Глушим нативный пузырёк-подсказку браузера (текст с точкой на конце генерирует сам браузер):
            // у поля своя валидация и свой вывод ошибки, дублировать нативной валидацией не нужно.
            if (!event.defaultPrevented) event.preventDefault();
        },
        [rest.onInvalid]
    );

    const textareaProps: React.TextareaHTMLAttributes<HTMLTextAreaElement> = {
        ...rest,
        id,
        required,
        placeholder,
        rows,
        // Отключаем автоподсказки/автозаполнение браузера по умолчанию; поле может вернуть его явным autoComplete.
        autoComplete: rest.autoComplete ?? 'off',
        // Подавляем нативную валидацию-подсказку браузера.
        onInvalid: handleInvalid,
        minLength: length?.min,
        maxLength: length?.max,
        'aria-invalid': !!displayError,
        'aria-describedby': textareaDescribedBy,
        onChange: handleChange,
        onFocus: handleFocus,
        onBlur: handleBlur,
        ...(isControlled ? { value: _value } : {}),
    };
    const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
    const setWrapperRef = useCallback((node: HTMLElement | null) => {
        setMotionNode(node);
    }, [setMotionNode]);

    const hasExplicitSize = w !== undefined || minW !== undefined || maxW !== undefined || h !== undefined || minH !== undefined || maxH !== undefined;
    const resolvedVariant = variant ?? 'primary';
    const resolvedSize = size ?? (hasExplicitSize ? undefined : 'default');

    const layoutProps = {
        variant: resolvedVariant, size: resolvedSize,
        p, pt, pr, pb, pl, m, mt, mr, mb, ml,
        r, tlr, trr, brr, blr,
        borderTLR, borderTRR, borderBRR, borderBLR,
        border, borderC, borderS, borderW, borderT, borderR, borderB, borderL,
        w, minW, maxW, h, minH, maxH,
        bg, color, placeholderColor,
    };
    const fieldClasses = fieldLayoutClasses(c, layoutProps);

    return (
        <Flex
            ref={setWrapperRef}
            dir={["column", null, null]}
            gap={[8, 4, 8]}
            className={cx(styles.TextareaWrapper, ...c.value('grow', grow), className)}
            style={{ ...(motionStyle ?? null), ...style }}
            data-point-events={dataPointEvents}
            {...stateLinkProps(linkState, { ...motionHandlers })}
        >
            {label && (
                // Звёздочка обязательного поля — как у Input: `required` уже принимался, но
                // рисовался только в Input, из-за чего textarea-поле в той же форме теряло метку.
                <Flex dir={['row', 'row', 'row']} gap={[4, null, null]}>
                    <Text className={styles.Label} color={labelColor}>{label}</Text>
                    {required && ( <Text className={styles.Label} color="var(--red)">*</Text> )}
                </Flex>
            )}
            <div
                className={cx(styles.Textarea, ...fieldClasses, ...c.value('grow', grow), fieldClassName)}
                data-has-counter={(showCounter && countPlacement === 'inside') || undefined}
                data-inline-error={inlineError ? 'true' : undefined}
                {...stateProps(state, displayError && 'error', isFieldFocused && 'active', hasValue && 'filled')}
                role="presentation"
                onClick={focusField}
                onKeyDown={() => {}}
            >
                {/* Подмена «скелетон ↔ значение» ЕДЕТ: `transitionKey` — тот самый ответ §8.4
                    для узла, который меняется другим узлом на том же месте. Голое условие
                    гасило скелетон кадром. */}
                <Flex
                    transitionKey={loading ? 'skeleton' : 'value'}
                    animation='fadeIn'
                    w={['100%', null, null]}
                >
                {loading ? (
                    // Сам `<textarea>` не рендерим: печатать в поле, значение которого ещё
                    // едет, значит потерять набранное на первом же ответе.
                    //
                    // Полос столько же, сколько строк у САМОГО поля: заглушка обязана занимать
                    // ровно то место, которое займёт контент (§4 «Геометрию задаёт сосед»).
                    // Зашитая тройка врала однострочному авторесайзу — «Краткое название»
                    // ждало тремя полосами в поле высотой в одну.
                    <Skeleton rows={rows} h={[16, null, null]} />
                ) : (
                    <textarea
                        ref={innerRef}
                        className={styles.TextareaField}
                        {...textareaProps}
                    />
                )}
                </Flex>
                {inlineError && (
                    <Text
                        as='div'
                        id={errorId}
                        role='alert'
                        variant={['p', 'p', 'p']}
                        color='var(--red)'
                        className={styles.InlineError}
                    >
                        {inlineError}
                    </Text>
                )}
                {showCounter && countPlacement === 'inside' && (
                    <Text
                        variant={["small", null, null]}
                        fontSize={[8, null, null]}
                        className={styles.Counter}
                        color="var(--gray)"
                        aria-live="polite"
                    >
                        {counterLabel}
                    </Text>
                )}
            </div>

            {/* Счётчик ПОД полем — тот же приём, что у редактора шаблонов (`LexicalTextarea`
                держит его строкой в тулбаре). Нужен там, где значение доходит до правого края:
                внутренний счётчик рисуется абсолютом в углу САМОГО поля и ложится поверх текста,
                из-за чего у однострочного «Краткого названия» его пришлось выключить вовсе
                (Roadmap D-122). Кегль и цвет — как у подписи-комментария под полем: это строка
                того же ряда, а не украшение внутри рамки. */}
            {showCounter && countPlacement === 'below' && (
                <Text
                    as='div'
                    variant={['small', null, null]}
                    color='var(--gray)'
                    textAlign={['right', null, null]}
                    w={['100%', null, null]}
                    aria-live='polite'
                >
                    {counterLabel}
                </Text>
            )}
            {!displayError && comment && (
                <Text
                    as='div'
                    variant={['small', 'small', 'small']}
                    id={commentId}
                    color='var(--gray)'
                    pl={fieldHelperPaddingLeft(layoutProps.p, layoutProps.pl)}
                >
                    {comment}
                </Text>
            )}
        </Flex>
    );
}
