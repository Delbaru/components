'use client';

import { useId, useState, useRef, useImperativeHandle, useCallback, type Ref } from 'react';

const DEFAULT_EMPTY_MESSAGE = 'Поле обязательно для заполнения';

export interface FieldControlConfig {
    id?: string;
    value?: string | number | readonly string[];
    required?: boolean;
    emptyMessage?: string;
    error?: string;
    validate?: (value: string) => string | undefined;
    isEmpty?: (value: string) => boolean;
}

export function useFieldControl<E extends HTMLElement>(
    ref: Ref<E | null> | undefined,
    config: FieldControlConfig
) {
    const {
        id: idProp,
        value: valueProp,
        required,
        emptyMessage = DEFAULT_EMPTY_MESSAGE,
        error: errorProp,
        validate: validateProp,
        isEmpty: isEmptyProp,
    } = config;

    const generatedId = useId();
    const id = idProp ?? generatedId;

    const innerRef = useRef<E>(null);
    useImperativeHandle<E | null, E | null>(ref, () => innerRef.current, []);

    const isControlled = valueProp !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState('');
    const currentValue = isControlled ? String(valueProp) : uncontrolledValue;

    const [internalError, setInternalError] = useState<string | undefined>(undefined);
    const displayError = errorProp ?? internalError;
    const errorId = displayError ? `${id}-error` : undefined;

    const isEmpty = useCallback(
        (value: string) => isEmptyProp ? isEmptyProp(value) : !value.trim(),
        [isEmptyProp]
    );

    const validateValue = useCallback(
        (value: string): string | undefined => {
            if (required && isEmpty(value)) return emptyMessage;
            return validateProp?.(value);
        },
        [required, emptyMessage, isEmpty, validateProp]
    );

    const focusField = useCallback(() => {
        innerRef.current?.focus();
    }, []);

    const hasValue = currentValue.length > 0;

    return {
        id,
        innerRef,
        isControlled,
        currentValue,
        hasValue,
        setUncontrolledValue,
        displayError,
        errorId,
        isEmpty,
        validateValue,
        setInternalError,
        focusField,
    };
}
