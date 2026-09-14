'use client';

import styles from './Select.module.scss';

import {
    forwardRef,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
} from 'react';
import type React from 'react';
import {
    cx,
    createLayoutClasses,
    inlineGrowClassName,
    growStyle,
    needsInlineGrow,
    stateProps,
    stateLinkProps,
    tokenStyles,
    useFieldControl,
    fieldLayoutStyles,
    resolveFieldLayoutClassResolution,
    fieldHelperPaddingLeft,
    type BorderStyleProps,
    type ComponentStateValue,
    type StateLinkInput,
    type LayoutSpaceProps,
    type RadiusPropsShort,
    type SizePropsShort,
    type ResponsiveValue,
    type GrowProps,
} from '../core';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { Skeleton } from '../Skeleton';
import { Flex } from '../Flex';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

type VariantKey = 'primary' | 'primaryFill' | 'secondary';
type SizeKey = 'default' | 'fullWidth';

const c = createLayoutClasses([styles, tokenStyles]);

const DEFAULT_PLACEHOLDER = 'Выберите значение';
const DEFAULT_EMPTY_MESSAGE = 'Выберите значение';
const DEFAULT_VISIBLE_OPTIONS = 4;

export interface SelectOption<T = string> {
    value: T;

    /**
     * Текстовое название опции.
     * Используется для aria-label, fallback и простого текстового отображения.
     */
    label: string;

    /**
     * Кастомное содержимое опции в dropdown.
     * Можно передать Text, Icon, Img, Flex и любой другой JSX.
     */
    children?: React.ReactNode;

    /**
     * Кастомное содержимое выбранного значения в trigger.
     * Если не передать, будет использован children, затем label.
     */
    selectedChildren?: React.ReactNode;
}

export interface SelectOptionGroup<T = string> {
    label: string;
    options: SelectOption<T>[];
}

type SelectItem<T = string> = SelectOption<T> | SelectOptionGroup<T>;

type FlattenedSelectItem<T = string> =
    | { type: 'group'; label: string; key: string }
    | { type: 'option'; option: SelectOption<T>; key: string };

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
    renderValue?: (payload: {
        selectedOption: SelectOption<T> | null;
        selectedOptions: SelectOption<T>[];
        multiple: boolean;
        placeholder: string;
        hasSelectedValue: boolean;
    }) => React.ReactNode;

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

function defaultEqual<T>(a: T | null, b: T | null): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

function isValueArray<T>(v: T | null | T[]): v is T[] {
    return Array.isArray(v);
}

function isPrimitiveNode(node: React.ReactNode): node is string | number {
    return typeof node === 'string' || typeof node === 'number';
}

function renderSelectNode(node: React.ReactNode, textClassName: string): React.ReactNode {
    if (isPrimitiveNode(node)) {
        return (
            <Text variant={['p', 'p', 'p']} className={textClassName} color="inherit">
                {node}
            </Text>
        );
    }

    return node;
}

function isSelectOptionGroup<T>(item: SelectItem<T>): item is SelectOptionGroup<T> {
    return 'options' in item;
}

function flattenSelectItems<T>(items: SelectItem<T>[]): FlattenedSelectItem<T>[] {
    return items.flatMap((item, groupIndex) => {
        if (!isSelectOptionGroup(item)) {
            return [{ type: 'option', option: item, key: `option-${String(item.value)}` }];
        }

        return [
            { type: 'group', label: item.label, key: `group-${groupIndex}-${item.label}` },
            ...item.options.map((option) => ({
                type: 'option' as const,
                option,
                key: `group-${groupIndex}-option-${String(option.value)}`,
            })),
        ];
    });
}

function getFocusedOptionIndex(
    options: SelectOption<string>[],
    multiple: boolean,
    selectedOption: SelectOption<string> | null,
    selectedOptions: SelectOption<string>[]
): number {
    if (options.length === 0) return -1;

    if (multiple && selectedOptions.length > 0) {
        const firstSelectedIndex = options.findIndex((option) => defaultEqual(option.value, selectedOptions[0].value));
        return firstSelectedIndex >= 0 ? firstSelectedIndex : 0;
    }

    if (!multiple && selectedOption) {
        const selectedIndex = options.findIndex((option) => defaultEqual(option.value, selectedOption.value));
        return selectedIndex >= 0 ? selectedIndex : 0;
    }

    return 0;
}

export const Select = forwardRef<HTMLDivElement, SelectProps<string>>(
    function Select(
        {
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
        },
        ref
    ) {
        const [uncontrolledValue, setUncontrolledValue] = useState<string | null | string[]>(
            defaultValue ?? (multiple ? [] : null)
        );

        const value = valueProp !== undefined ? valueProp : uncontrolledValue;

        const valueArray = multiple ? (isValueArray(value) ? value : []) : null;
        const valueSingle = !multiple && !isValueArray(value) ? (value as string | null) : null;
        const flatItems = useMemo(() => flattenSelectItems(options), [options]);
        const flatOptions = useMemo(
            () => flatItems.flatMap((item) => (item.type === 'option' ? [item.option] : [])),
            [flatItems]
        );

        const selectedOptions = useMemo(
            () => (multiple && valueArray ? flatOptions.filter((opt) => valueArray.includes(opt.value)) : []),
            [multiple, valueArray, flatOptions]
        );

        const selectedOption = useMemo(
            () => (!multiple ? flatOptions.find((opt) => defaultEqual(opt.value, valueSingle)) ?? null : null),
            [multiple, flatOptions, valueSingle]
        );

        const hasSelectedValue = multiple ? selectedOptions.length > 0 : selectedOption != null;

        const dropdownOptions = useMemo(
            () => showSelected
                ? flatOptions
                : flatOptions.filter((option) => multiple
                    ? !(valueArray?.includes(option.value) ?? false)
                    : !defaultEqual(option.value, valueSingle)),
            [multiple, flatOptions, showSelected, valueArray, valueSingle]
        );

        const dropdownItems = useMemo(() => {
            if (showSelected) {
                return flatItems;
            }

            const visibleValues = new Set(dropdownOptions.map((option) => String(option.value)));
            let currentGroupHasVisibleOptions = false;

            return flatItems.filter((item, index) => {
                if (item.type === 'group') {
                    currentGroupHasVisibleOptions = false;

                    for (let nextIndex = index + 1; nextIndex < flatItems.length; nextIndex += 1) {
                        const nextItem = flatItems[nextIndex];

                        if (nextItem.type === 'group') {
                            break;
                        }

                        if (visibleValues.has(String(nextItem.option.value))) {
                            currentGroupHasVisibleOptions = true;
                            break;
                        }
                    }

                    return currentGroupHasVisibleOptions;
                }

                return visibleValues.has(String(item.option.value));
            });
        }, [dropdownOptions, flatItems, showSelected]);

        const defaultDisplayContent = hasSelectedValue
            ? multiple
                ? `Выбрано (${selectedOptions.length})`
                : selectedOption?.selectedChildren ?? selectedOption?.children ?? selectedOption?.label
            : placeholder;

        const displayContent = renderValue
            ? renderValue({
                  selectedOption,
                  selectedOptions,
                  multiple,
                  placeholder,
                  hasSelectedValue,
              })
            : defaultDisplayContent;

        const {
            id,
            innerRef,
            displayError,
            errorId,
            setInternalError,
            focusField,
        } = useFieldControl<HTMLDivElement>(ref, {
            id: idProp,
            error: errorProp,
        });

        const listboxId = `${id}-listbox`;
        const commentId = !displayError && comment ? `${id}-comment` : undefined;
        const helperTextId = displayError ? errorId : commentId;

        const [open, setOpen] = useState(false);
        const [focusedIndex, setFocusedIndex] = useState(-1);
        const showInlineError = Boolean(displayError) && !open;

        const rootRef = useRef<HTMLElement>(null);
        const dropdownRef = useRef<HTMLDivElement>(null);
        const optionRefs = useRef<Array<HTMLElement | null>>([]);

        const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });

        const normalizedVisibleOptions = Math.max(1, Math.floor(visibleOptions));
        // Прокрутка нужна, только если строк БОЛЬШЕ, чем помещается в окно списка. Без этого
        // условия `scrollbar-gutter: stable` резервировал полосу всегда — у списка из одной строки
        // справа зияла пустая колонка, которую читают как «тут что-то прокручивается».
        const dropdownScrolls = dropdownItems.length > normalizedVisibleOptions;

        const triggerAccessibilityProps = {
            'aria-label': ariaLabel ?? label ?? placeholder,
            'aria-haspopup': 'listbox' as const,
            'aria-expanded': open,
            'aria-controls': listboxId,
            'aria-describedby': helperTextId,
            'aria-invalid': !!displayError,
            'aria-disabled': disabled || undefined,
            'aria-required': required || undefined,
        };

        const validateValue = useCallback(
            (v: string | null | string[]): string | undefined => {
                if (required) {
                    if (multiple) {
                        if (!Array.isArray(v) || v.length === 0) return emptyMessage;
                    } else if (v == null || (typeof v === 'string' && !v.trim())) {
                        return emptyMessage;
                    }
                }

                return validateProp?.(v);
            },
            [required, emptyMessage, validateProp, multiple]
        );

        const openDropdown = useCallback(() => {
            // `loading` держит список закрытым: варианты ещё едут, и раскрытый пустой список
            // человек прочитает как «выбирать не из чего», а не как «подожди».
            if (disabled || loading || dropdownOptions.length === 0) return;

            setOpen(true);
            setFocusedIndex(getFocusedOptionIndex(dropdownOptions, multiple, selectedOption, selectedOptions));
        }, [disabled, loading, dropdownOptions, multiple, selectedOption, selectedOptions]);

        const closeDropdown = useCallback(
            (shouldValidate = true) => {
                setOpen(false);
                setFocusedIndex(-1);

                if (shouldValidate) {
                    setInternalError(validateValue(value));
                }
            },
            [setInternalError, validateValue, value]
        );

        const commitValue = useCallback(
            (nextValue: string | null | string[]) => {
                if (valueProp === undefined) setUncontrolledValue(nextValue);

                onChange?.(nextValue);
                setInternalError(validateValue(nextValue));
            },
            [onChange, setInternalError, validateValue, valueProp]
        );

        useEffect(() => {
            if (!open) return;

            const handleClickOutside = (e: MouseEvent) => {
                if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                    closeDropdown();
                }
            };

            document.addEventListener('mousedown', handleClickOutside);

            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [open, closeDropdown]);

        useEffect(() => {
            if (!open || focusedIndex < 0) return;

            const dropdownElement = dropdownRef.current;
            const optionElement = optionRefs.current[focusedIndex];

            if (!dropdownElement || !optionElement) return;

            const optionTop = optionElement.offsetTop;
            const optionBottom = optionTop + optionElement.offsetHeight;
            const visibleTop = dropdownElement.scrollTop;
            const visibleBottom = visibleTop + dropdownElement.clientHeight;

            if (optionTop < visibleTop) {
                dropdownElement.scrollTop = optionTop;
                return;
            }

            if (optionBottom > visibleBottom) {
                dropdownElement.scrollTop = optionBottom - dropdownElement.clientHeight;
            }
        }, [open, focusedIndex]);

        useEffect(() => {
            if (!open) return;

            if (dropdownOptions.length === 0) {
                setOpen(false);
                setFocusedIndex(-1);
                return;
            }

            setFocusedIndex((currentIndex) => {
                if (currentIndex < 0) return 0;
                return Math.min(currentIndex, dropdownOptions.length - 1);
            });
        }, [dropdownOptions.length, open]);

        const handleContainerClick = useCallback(
            (e: React.MouseEvent<HTMLElement>) => {
                if (disabled) return;
                if ((e.target as HTMLElement).closest?.('[role="listbox"]')) return;

                focusField();

                if (open) closeDropdown();
                else openDropdown();
            },
            [disabled, focusField, open, closeDropdown, openDropdown]
        );

        const handleDropdownWheelCapture = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
            event.stopPropagation();
        }, []);

        const handleDropdownTouchMoveCapture = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
            event.stopPropagation();
        }, []);

        const setWrapperRef = useCallback(
            (node: HTMLElement | null) => {
                rootRef.current = node;
                setMotionNode(node);
            },
            [setMotionNode]
        );

        const handleSelect = useCallback(
            (option: SelectOption<string>) => {
                const optionIndex = dropdownOptions.findIndex((currentOption) => defaultEqual(currentOption.value, option.value));

                if (multiple) {
                    const previousValue = valueArray ?? [];

                    const nextValue = previousValue.includes(option.value)
                        ? previousValue.filter((currentValue) => currentValue !== option.value)
                        : [...previousValue, option.value];

                    commitValue(nextValue);

                    // Закрываем НЕ через `closeDropdown`: тот проверяет значение из замыкания, то
                    // есть ещё старое, и зажёг бы ошибку на только что выбранном пункте. Новое
                    // значение уже проверил `commitValue` — как и в одиночной ветке ниже.
                    if (closeOnSelect) {
                        setOpen(false);
                        setFocusedIndex(-1);
                    } else {
                        setFocusedIndex(optionIndex);
                    }
                } else {
                    commitValue(option.value);
                    setOpen(false);
                    setFocusedIndex(-1);
                }
            },
            [closeOnSelect, commitValue, dropdownOptions, multiple, valueArray]
        );

        const handleKeyDown = useCallback(
            (e: KeyboardEvent<HTMLDivElement>) => {
                if (disabled) return;

                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();

                    if (!open) {
                        openDropdown();
                        return;
                    }

                    if (focusedIndex >= 0 && dropdownOptions[focusedIndex]) {
                        handleSelect(dropdownOptions[focusedIndex]);
                    }

                    return;
                }

                if (e.key === 'ArrowDown') {
                    e.preventDefault();

                    if (!open) {
                        openDropdown();
                        return;
                    }

                    setFocusedIndex((currentIndex) => (currentIndex < dropdownOptions.length - 1 ? currentIndex + 1 : 0));
                    return;
                }

                if (e.key === 'ArrowUp') {
                    e.preventDefault();

                    if (!open) {
                        openDropdown();
                        return;
                    }

                    setFocusedIndex((currentIndex) => (currentIndex > 0 ? currentIndex - 1 : dropdownOptions.length - 1));
                    return;
                }

                if (!open) {
                    if (e.key === 'Home') {
                        e.preventDefault();
                        openDropdown();
                    }

                    return;
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeDropdown();
                    return;
                }

                if (e.key === 'Home') {
                    e.preventDefault();
                    setFocusedIndex(0);
                    return;
                }

                if (e.key === 'End') {
                    e.preventDefault();
                    setFocusedIndex(dropdownOptions.length - 1);
                    return;
                }

                if (e.key === 'Tab') {
                    closeDropdown();
                }
            },
            [disabled, open, closeDropdown, dropdownOptions, focusedIndex, openDropdown, handleSelect]
        );

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

        const fieldLayoutResolution = resolveFieldLayoutClassResolution(c, layoutProps);

        return (
            <Flex
                href={undefined}
                dir={['column', 'column', 'column']}
                gap={[8, 8, 8]}
                className={cx(styles.SelectWrapper, needsInlineGrow(grow) && inlineGrowClassName(), className)}
                style={{ ...growStyle(grow), ...(motionStyle ?? null), ...style }}
                ref={setWrapperRef}
                data-point-events={dataPointEvents}
                {...stateLinkProps(linkState, { ...motionHandlers })}
                {...restProps}
            >
                {label && (
                    <Flex dir={['row', 'row', 'row']} gap={required ? 4 : 0}>
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
                    className={cx(styles.Select, ...fieldLayoutResolution.classes, fieldClassName)}
                    style={
                        {
                            ...fieldLayoutStyles(layoutProps, fieldLayoutResolution.styleSkips),
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
                                        const optionIndex = dropdownOptions.findIndex((option) => defaultEqual(option.value, opt.value));
                                        const isSelected = multiple
                                            ? valueArray?.includes(opt.value) ?? false
                                            : defaultEqual(opt.value, valueSingle);
                                        const isFocused = optionIndex === focusedIndex;
                                        const optionContent = opt.children ?? opt.label;

                                        return (
                                            <Flex
                                                key={item.key}
                                                ref={(element) => {
                                                    optionRefs.current[optionIndex] = element;
                                                }}
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
);

Select.displayName = 'Select';
