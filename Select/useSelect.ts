import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import type React from 'react';

import { useFieldControl, useMergedRefs } from '../core';
import { useOutsideDismiss } from '../hooks/useOutsideDismiss';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import { defaultEqual, flattenSelectItems, getFocusedOptionIndex, isValueArray, visibleDropdownItems, type SelectItem, type SelectOption } from './options';

export interface SelectRenderValuePayload<T = string> {
    selectedOption: SelectOption<T> | null;
    selectedOptions: SelectOption<T>[];
    multiple: boolean;
    placeholder: string;
    hasSelectedValue: boolean;
}

export interface SelectConfig extends SharedMotionProps {
    options: SelectItem<string>[];
    value?: string | null | string[];
    defaultValue: string | null | string[];
    onChange?: (value: string | null | string[]) => void;
    multiple: boolean;
    closeOnSelect: boolean;
    showSelected: boolean;
    renderValue?: (payload: SelectRenderValuePayload<string>) => React.ReactNode;
    placeholder: string;
    loading: boolean;
    disabled?: boolean;
    required?: boolean;
    emptyMessage: string;
    visibleOptions: number;
    validate?: (value: string | null | string[]) => string | undefined;
    id?: string;
    error?: string;
    label?: string;
    comment?: string;
    ariaLabel?: string;
}

/** Поведение Select: значение, раскрытие, пункт в фокусе, клавиатура, проверка. Вид — в Select.tsx. */
export function useSelect(ref: Ref<HTMLDivElement> | undefined, config: SelectConfig) {
    const {
        options, value: valueProp, defaultValue, onChange, multiple, closeOnSelect, showSelected, renderValue,
        placeholder, loading, disabled, required, emptyMessage, visibleOptions, validate: validateProp,
        id: idProp, error: errorProp, label, comment, ariaLabel, perspective3d, parallax,
    } = config;

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

    const dropdownItems = useMemo(
        () => visibleDropdownItems(flatItems, dropdownOptions, showSelected),
        [dropdownOptions, flatItems, showSelected]
    );

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

    // Escape выключен: у списка свой обработчик клавиш, и два закрытия подряд гасили бы заодно
    // модалку, в которой список открыт.
    useOutsideDismiss(rootRef, closeDropdown, { enabled: open, escape: false });

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

    const setWrapperRef = useMergedRefs(rootRef, setMotionNode);

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
                // Escape открытого списка закрывает только его: всплыв до окна-модалки, он закрывал
                // окно целиком вместе с введённой формой. Закрытый список Escape окну отпускает.
                e.preventDefault();
                e.stopPropagation();
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

    const optionIndexOf = (option: SelectOption<string>) =>
        dropdownOptions.findIndex((currentOption) => defaultEqual(currentOption.value, option.value));

    const isOptionSelected = (option: SelectOption<string>) =>
        multiple ? valueArray?.includes(option.value) ?? false : defaultEqual(option.value, valueSingle);

    const setOptionRef = (index: number) => (element: HTMLElement | null) => {
        optionRefs.current[index] = element;
    };

    return {
        id, innerRef, errorId, displayError, commentId, listboxId, open, focusedIndex, setFocusedIndex,
        showInlineError, hasSelectedValue, displayContent, dropdownItems, dropdownOptions,
        dropdownScrolls, normalizedVisibleOptions, triggerAccessibilityProps, dropdownRef,
        setWrapperRef, setOptionRef, motionHandlers, motionStyle, handleContainerClick, handleKeyDown,
        handleSelect, handleDropdownWheelCapture, handleDropdownTouchMoveCapture, optionIndexOf,
        isOptionSelected,
    };
}
