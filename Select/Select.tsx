'use client';

import styles from './Select.module.scss';

import { type CSSProperties } from 'react';
import type React from 'react';
import { cx, createLayoutClasses, stateProps, stateLinkProps, fieldHelperPaddingLeft, type BorderStyleProps, type ComponentStateValue, type StateLinkInput, type LayoutSpaceProps, type RadiusPropsShort, type SizePropsShort, type ResponsiveValue, type GrowProps, type WithRef, fieldLayoutClasses } from '../core';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { Skeleton } from '../Skeleton';
import { Flex } from '../Flex';
import type { SharedMotionProps } from '../hooks/useSharedMotion';
import type { SelectItem } from './options';
import { useSelect, type SelectRenderValuePayload } from './useSelect';

type VariantKey = 'primary' | 'primaryFill' | 'secondary';
type SizeKey = 'default' | 'fullWidth';

const c = createLayoutClasses(styles, { local: { h: 'height' } });

const DEFAULT_PLACEHOLDER = 'Выберите значение';
const DEFAULT_EMPTY_MESSAGE = 'Выберите значение';
const DEFAULT_VISIBLE_OPTIONS = 4;

export interface SelectProps<T = string>
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange' | 'dir' | 'rel'>,
        LayoutSpaceProps,
        RadiusPropsShort,
        BorderStyleProps,
        GrowProps,
        SharedMotionProps,
        SizePropsShort {
    className?: string;

    /** Класс на САМ триггер (внутренний .Select — тот, что несёт фон/рамку), а не на обёртку
     *  с label/comment, куда садится className. Нужен скин-обёрткам (SharedSelect), которые
     *  красят поле осями из components/system/_axes.scss: без этого класс-ось приземлился бы
     *  на обёртку и покрасил бы заодно подпись. */
    fieldClassName?: string;

    style?: CSSProperties;

    options: SelectItem<T>[];
    value?: T | null | T[];
    defaultValue?: T | null | T[];
    onChange?: (value: T | null | T[]) => void;
    multiple?: boolean;

    /**
     * Закрывать список сразу после выбора. У ОДИНОЧНОГО селекта так и так: выбор там один, и
     * список больше не нужен. Флаг нужен `multiple` — тот намеренно остаётся открытым, чтобы
     * отметить несколько подряд, но полю, где обычно выбирают одно («Тест» в приглашении),
     * открытый список только закрывает собой форму.
     *
     * Опт-ин: включить всем `multiple` нельзя — отметить три значения стало бы тремя заходами.
     */
    closeOnSelect?: boolean;

    /** Показывать уже выбранные значения в dropdown. */
    showSelected?: boolean;

    /**
     * Полностью кастомный рендер выбранного значения.
     * Удобно для multiple или сложной верстки в trigger.
     */
    renderValue?: (payload: SelectRenderValuePayload<T>) => React.ReactNode;

    placeholder?: string;
    placeholderColor?: string;
    /**
     * Значение ещё грузится — вместо подписи скелетон (см. `Skeleton`, §4).
     *
     * Шеврон при этом ОСТАЁТСЯ, а раскрытие выключается: убери шеврон — и на его приезде
     * подпись дёрнется вбок; оставь раскрытие — человек откроет пустой список и решит,
     * что вариантов нет.
     */
    loading?: boolean;
    label?: string;
    labelColor?: string;
    comment?: string;

    variant?: ResponsiveValue<VariantKey>;
    size?: ResponsiveValue<SizeKey>;

    bg?: string;
    color?: string;

    error?: string;

    disabled?: boolean;
    required?: boolean;
    emptyMessage?: string;
    visibleOptions?: number;
    validate?: (value: T | null | T[]) => string | undefined;

    state?: ComponentStateValue;

    linkState?: StateLinkInput;

    id?: string;
    'aria-label'?: string;
    'data-point-events'?: string;
}

function isPrimitiveNode(node: React.ReactNode): node is string | number {
    return typeof node === 'string' || typeof node === 'number';
}

function renderSelectNode(node: React.ReactNode, textClassName: string | undefined): React.ReactNode {
    if (isPrimitiveNode(node)) {
        return (
            <Text variant={['p', 'p', 'p']} className={textClassName} color="inherit">
                {node}
            </Text>
        );
    }

    return node;
}

export function Select({
    ref,
    className = '',
    fieldClassName,
    style,
    options,
    value: valueProp,
    defaultValue = null,
    onChange,
    multiple = false,
    closeOnSelect = false,
    showSelected = true,
    renderValue,
    placeholder = DEFAULT_PLACEHOLDER,
    placeholderColor,
    loading = false,
    label,
    labelColor,
    comment,
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
    error: errorProp,
    disabled,
    required,
    emptyMessage = DEFAULT_EMPTY_MESSAGE,
    visibleOptions = DEFAULT_VISIBLE_OPTIONS,
    validate: validateProp,
    id: idProp,
    state,
    linkState,
    'aria-label': ariaLabel,
    'data-point-events': dataPointEvents,
    ...restProps
}: WithRef<SelectProps<string>, HTMLDivElement>) {
    const {
        id, innerRef, errorId, displayError, commentId, listboxId, open, focusedIndex, setFocusedIndex,
        showInlineError, hasSelectedValue, displayContent, dropdownItems, dropdownOptions,
        dropdownScrolls, normalizedVisibleOptions, triggerAccessibilityProps, dropdownRef,
        setWrapperRef, setOptionRef, motionHandlers, motionStyle, handleContainerClick, handleKeyDown,
        handleSelect, handleDropdownWheelCapture, handleDropdownTouchMoveCapture, optionIndexOf,
        isOptionSelected,
    } = useSelect(ref, {
        options, value: valueProp, defaultValue, onChange, multiple, closeOnSelect, showSelected, renderValue,
        placeholder, loading, disabled, required, emptyMessage, visibleOptions, validate: validateProp,
        id: idProp, error: errorProp, label, comment, ariaLabel, perspective3d, parallax,
    });

    const hasExplicitSize =
        w !== undefined ||
        minW !== undefined ||
        maxW !== undefined ||
        h !== undefined ||
        minH !== undefined ||
        maxH !== undefined;

    const resolvedVariant = variant ?? 'primary';
    const resolvedSize = size ?? (hasExplicitSize ? undefined : 'default');

    const layoutProps = {
        variant: resolvedVariant,
        size: resolvedSize,
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
        w,
        minW,
        maxW,
        h,
        minH,
        maxH,
        bg,
        color,
        placeholderColor,
    };

    const fieldClasses = fieldLayoutClasses(c, layoutProps);

    return (
        <Flex
            href={undefined}
            dir={['column', 'column', 'column']}
            gap={[8, 8, 8]}
            className={cx(styles.SelectWrapper, ...c.value('grow', grow), className)}
            style={{ ...(motionStyle ?? null), ...style }}
            ref={setWrapperRef}
            data-point-events={dataPointEvents}
            {...stateLinkProps(linkState, { ...motionHandlers })}
            {...restProps}
        >
            {label && (
                <Flex dir={['row', 'row', 'row']} gap={required ? [4, 4, 4] : [0, 0, 0]}>
                    <Text variant={['small', 'small', 'small']} color={labelColor}>
                        {label}
                    </Text>

                    {required && (
                        <Text variant={['small', 'small', 'small']} color="var(--red)">
                            *
                        </Text>
                    )}
                </Flex>
            )}

            <Flex
                className={cx(styles.Select, ...fieldClasses, fieldClassName)}
                style={
                    {
                        ['--select-visible-options' as string]: String(normalizedVisibleOptions),
                    } as CSSProperties
                }
                {...stateProps(state, displayError && 'error', disabled && 'disabled', open && 'open')}
                role="presentation"
                onClick={handleContainerClick}
            >
                <Flex
                    ref={innerRef}
                    align={['center', 'center', 'center']}
                    justify={['space_between', 'space_between', 'space_between']}
                    gap={[8, 8, 8]}
                    className={styles.SelectTrigger}
                    w={['100%', '100%', '100%']}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    id={id}
                    onKeyDown={handleKeyDown}
                    {...triggerAccessibilityProps}
                >
                    <div
                        className={styles.TriggerContent}
                        style={{
                            color: showInlineError
                                ? 'var(--red)'
                                : !hasSelectedValue
                                    ? placeholderColor ?? 'var(--secondary)'
                                    : undefined,
                        }}
                    >
                        {/* Скелетон и значение подменяют друг друга на одном месте — значит
                            `transitionKey` (§8.4), а не голое условие: иначе полоса исчезает
                            кадром. Шеврон при этом снаружи обёртки и не мигает. */}
                        <Flex
                            transitionKey={loading ? 'skeleton' : 'value'}
                            animation='fadeIn'
                            w={['100%', null, null]}
                        >
                        {loading ? (
                            <Skeleton h={[16, null, null]} />
                        ) : showInlineError ? (
                            <Text
                                as="div"
                                id={errorId}
                                role="alert"
                                variant={['p', 'p', 'p']}
                                color="inherit"
                                className={styles.TriggerText}
                            >
                                {displayError}
                            </Text>
                        ) : (
                            renderSelectNode(displayContent, styles.TriggerText)
                        )}
                        </Flex>
                    </div>

                    <Icon
                        aria-hidden
                        src="/icons/ui/arrows/arrow-2/arrow.svg"
                        fill="transparent"
                        w={[20, 20, 20]}
                        h={[20, 20, 20]}
                        className={styles.Chevron}
                    />
                </Flex>

                <div className={styles.DropdownWrapper} role="presentation" aria-hidden={!open}>
                    <div className={styles.DropdownInner} role="presentation">
                        <div className={styles.Dropdown}>
                            <Flex
                                ref={dropdownRef}
                                dir={['column', 'column', 'column']}
                                id={listboxId}
                                role="listbox"
                                scrollFade
                                className={styles.DropdownScroll}
                                data-scrolls={dropdownScrolls || undefined}
                                aria-hidden={!open}
                                aria-multiselectable={multiple || undefined}
                                aria-activedescendant={
                                    open && focusedIndex >= 0 && dropdownOptions[focusedIndex]
                                        ? `${id}-option-${focusedIndex}`
                                        : undefined
                                }
                                data-lenis-prevent
                                data-lenis-prevent-wheel
                                data-lenis-prevent-touch
                                onWheelCapture={handleDropdownWheelCapture}
                                onTouchMoveCapture={handleDropdownTouchMoveCapture}
                            >
                                {dropdownItems.map((item) => {
                                    if (item.type === 'group') {
                                        return (
                                            <Text
                                                key={item.key}
                                                as="div"
                                                variant={['small', 'small', 'small']}
                                                className={styles.GroupLabel}
                                                color="var(--secondary)"
                                            >
                                                {item.label}
                                            </Text>
                                        );
                                    }

                                    const opt = item.option;
                                    const optionIndex = optionIndexOf(opt);
                                    const isSelected = isOptionSelected(opt);
                                    const isFocused = optionIndex === focusedIndex;
                                    const optionContent = opt.children ?? opt.label;

                                    return (
                                        <Flex
                                            key={item.key}
                                            ref={setOptionRef(optionIndex)}
                                            align={['center', 'center', 'center']}
                                            justify={['space_between', 'space_between', 'space_between']}
                                            // Зазор маркер↔подпись. 8, а не 16: подпись опции
                                            // переносится по словам, и каждый лишний пиксель
                                            // отступа — это слово, уехавшее на вторую строку.
                                            // У одиночного селекта ребёнок один и зазор мёртв.
                                            gap={[8, 8, 8]}
                                            id={`${id}-option-${optionIndex}`}
                                            role="option"
                                            aria-label={opt.label}
                                            aria-selected={isSelected}
                                            className={styles.Option}
                                            {...stateProps(isSelected && 'selected', isFocused && 'focused')}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => handleSelect(opt)}
                                            onMouseEnter={() => setFocusedIndex(optionIndex)}
                                        >
                                            {/* Множественный выбор помечается КВАДРАТОМ-галочкой, а не одной
                                                подложкой строки: подложка у отмеченной и у наведённой опции
                                                одна и та же, и без маркера «отметил два» читается как
                                                «навёл на два». Слева — как у галочек колоночного фильтра,
                                                единственного другого места, где в кабинете выбирают несколько.

                                                Это РИСУНОК (`aria-hidden`), а не атом `Checkbox`: контрол здесь
                                                сама строка (`role='option'` + `aria-selected`), и вложенный в неё
                                                настоящий <input> стал бы вторым контролом в дереве доступности.
                                                Цвета — в модуле на дочернем классе, а не пропом: проп даёт инлайн,
                                                который состояние потом не перебьёт без `!important` (§9.3).

                                                Условие тут НЕ требует анимации (§8.4): `multiple` — настройка поля,
                                                а не состояние. Маркер либо есть у списка всегда, либо нет никогда;
                                                едет по нажатию сама галочка внутри него, а не он. */}
                                            {multiple && (
                                                <Flex
                                                    aria-hidden
                                                    className={styles.OptionCheck}
                                                    align={['center', 'center', 'center']}
                                                    justify={['center', 'center', 'center']}
                                                    w={[24, 24, 24]}
                                                    h={[24, 24, 24]}
                                                    r={[8, 8, 8]}
                                                >
                                                    <Icon
                                                        aria-hidden
                                                        src="/icons/ui/check/succsess_check_black.svg"
                                                        fill="var(--white-100)"
                                                        w={[16, 16, 16]}
                                                        h={[16, 16, 16]}
                                                        className={styles.OptionCheckIcon}
                                                    />
                                                </Flex>
                                            )}

                                            <div className={styles.OptionContent}>
                                                {renderSelectNode(optionContent, styles.OptionLabel)}
                                            </div>
                                        </Flex>
                                    );
                                })}
                            </Flex>
                        </div>
                    </div>
                </div>
            </Flex>

            {!displayError && comment && (
                <Text
                    as="div"
                    variant={['small', 'small', 'small']}
                    id={commentId}
                    color="var(--gray)"
                    pl={fieldHelperPaddingLeft(layoutProps.p, layoutProps.pl)}
                >
                    {comment}
                </Text>
            )}
        </Flex>
    );
}
