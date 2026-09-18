'use client';

import { useCallback, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type MouseEvent, type Ref } from 'react';
import type React from 'react';

import { useFieldControl } from '../../core';
import * as phoneMask from './phone-mask';
import * as datePicker from './date-picker';
import * as timeMask from './time-mask';
import { useDatePicker } from './use-date-picker';

const EMAIL_PATTERN = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';
// Экспортируется намеренно: тот же формат проверяют формы ЗА пределами атома (кнопка «Продолжить»
// в окне входа гаснет, пока адрес неполон). Своя копия регулярки на call-site была бы вторым
// источником правды — поле и кнопка расходились бы во мнении о том, что такое верный адрес.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_EMAIL_ERROR = 'Неверный формат email';
const DEFAULT_DATE_MIN_ERROR = 'Дата не может быть раньше';
const DEFAULT_DATE_MAX_ERROR = 'Дата не может быть позже';
const DEFAULT_TIME_MIN_ERROR = 'Время не может быть раньше';
const DEFAULT_TIME_MAX_ERROR = 'Время не может быть позже';

function normalizeConstraintValue(value: React.InputHTMLAttributes<HTMLInputElement>['min' | 'max']) {
  return typeof value === 'string' ? value : undefined;
}

function parseTimeValue(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());

  if (!match) {
    return null;
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

function compareTimeValues(left: string, right: string) {
  const parsedLeft = parseTimeValue(left);
  const parsedRight = parseTimeValue(right);

  if (!parsedLeft || !parsedRight) {
    return 0;
  }

  return parsedLeft.hours * 60 + parsedLeft.minutes - (parsedRight.hours * 60 + parsedRight.minutes);
}

function validateDateBounds(value: string, minValue?: string, maxValue?: string) {
  const parsedValue = datePicker.parseValue(value);

  if (!parsedValue) {
    return undefined;
  }

  const parsedMin = minValue ? datePicker.parseValue(minValue) : null;

  if (parsedMin && datePicker.isBeforeDay(parsedValue, parsedMin)) {
    return `${DEFAULT_DATE_MIN_ERROR} ${datePicker.formatDisplay(parsedMin)}`;
  }

  const parsedMax = maxValue ? datePicker.parseValue(maxValue) : null;

  if (parsedMax && datePicker.isAfterDay(parsedValue, parsedMax)) {
    return `${DEFAULT_DATE_MAX_ERROR} ${datePicker.formatDisplay(parsedMax)}`;
  }

  return undefined;
}

function validateTimeBounds(value: string, minValue?: string, maxValue?: string) {
  if (!parseTimeValue(value)) {
    return undefined;
  }

  const normalizedMin = minValue ? timeMask.normalize(minValue) : '';

  if (normalizedMin && parseTimeValue(normalizedMin) && compareTimeValues(value, normalizedMin) < 0) {
    return `${DEFAULT_TIME_MIN_ERROR} ${normalizedMin}`;
  }

  const normalizedMax = maxValue ? timeMask.normalize(maxValue) : '';

  if (normalizedMax && parseTimeValue(normalizedMax) && compareTimeValues(value, normalizedMax) > 0) {
    return `${DEFAULT_TIME_MAX_ERROR} ${normalizedMax}`;
  }

  return undefined;
}

function getTimeDigitCountBeforeCursor(value: string, cursor: number) {
  return value.slice(0, cursor).replace(/\D/g, '').length;
}

function mapTimeCursorPosition(normalizedValue: string, digitCount: number) {
  return digitCount <= 2
    ? digitCount
    : Math.min(normalizedValue.length, digitCount + 1);
}

function normalizeTimeValue(raw: string, cursor: number | null, selectionEnd: number | null) {
  const normalizedValue = timeMask.normalize(raw);
  const start = cursor !== null ? mapTimeCursorPosition(normalizedValue, getTimeDigitCountBeforeCursor(raw, cursor)) : null;
  const end = selectionEnd !== null ? mapTimeCursorPosition(normalizedValue, getTimeDigitCountBeforeCursor(raw, selectionEnd)) : null;

  return {
    normalizedValue,
    selectionStart: start,
    selectionEnd: end,
  };
}

interface UseInputBehaviorOptions {
  ref: Ref<HTMLInputElement> | undefined;
  typeProp?: React.HTMLInputTypeAttribute;
  valueProp?: React.InputHTMLAttributes<HTMLInputElement>['value'];
  defaultValueProp?: React.InputHTMLAttributes<HTMLInputElement>['defaultValue'];
  error?: string;
  idProp?: string;
  disabled?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onInputKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  required?: boolean;
  emptyMessage?: string;
  validateProp?: (value: string) => string | undefined;
  comment?: string;
  placeholder?: string;
  length?: { min?: number; max?: number };
  numberOptions?: number[];
  phoneFormat?: phoneMask.PhoneFormat;
  restInputProps: React.InputHTMLAttributes<HTMLInputElement>;
}

export function useInputBehavior({
  ref,
  typeProp,
  valueProp,
  defaultValueProp,
  error,
  idProp,
  disabled,
  onChange,
  onFocus,
  onBlur,
  onInputKeyDown,
  required,
  emptyMessage,
  validateProp,
  comment,
  placeholder,
  length,
  numberOptions,
  phoneFormat = phoneMask.DEFAULT_PHONE_FORMAT,
  restInputProps,
}: UseInputBehaviorOptions) {
  const inputType = typeProp ?? 'text';
  // Только для чтения ПО ЗАМЫСЛУ call-site. Вычисленный ниже `readOnly` для этого не годится:
  // он бывает true и у даты, и у анти-автозаполнения — там поле обычное, просто заперто на миг.
  const isReadOnly = Boolean(restInputProps.readOnly);
  const isPhone = inputType === 'tel';
  const isTime = inputType === 'time';
  const isDate = inputType === 'data' || inputType === 'date';
  const isNumber = inputType === 'number';
  const isEmail = inputType === 'email';
  // «Жёсткое» подавление автозаполнения приёмом «readonly до фокуса» включаем ТОЛЬКО там, где
  // разработчик явно попросил autoComplete='off' (формы входа с autoComplete='email' и т.п. при
  // этом сохраняют автозаполнение). Пока поле readonly — Chrome не показывает выпадашку; на фокусе
  // снимаем readonly. type у нас уже не семантический (text), так что autoComplete='off' + readonly
  // вместе надёжно убирают подсказки, не ломая маску (автозаполнения, с которым была гонка, больше нет).
  const lockAutofill =
    (inputType === 'text' || inputType === 'email' || inputType === 'tel' || inputType === 'search') &&
    restInputProps.autoComplete === 'off';
  const minConstraint = normalizeConstraintValue(restInputProps.min);
  const maxConstraint = normalizeConstraintValue(restInputProps.max);
  // Телефон и email рендерим нативно как text (клавиатуру держим через inputMode): нативные
  // type='tel'/'email' — сильный сигнал автозаполнения для Chrome. Само автозаполнение остаётся
  // управляемым через autoComplete: форме входа оно нужно (autoComplete='email'), а где не нужно —
  // достаточно autoComplete='off'. Наша JS-валидация завязана на проп type, а не на DOM-тип.
  const resolvedInputType = isTime || isDate || isPhone || isEmail ? 'text' : inputType;
  const defaultValueString = defaultValueProp == null ? '' : String(defaultValueProp);
  const resolvedNumberOptions = useMemo(() => {
    if (!numberOptions?.length) {
      return [];
    }

    return Array.from(
      new Set(
        numberOptions
          .filter((value) => Number.isFinite(value))
          .map((value) => Number(value))
      )
    ).sort((left, right) => left - right);
  }, [numberOptions]);

  const typeValidate = useCallback(
    (value: string): string | undefined => {
      if (inputType === 'email' && value && !EMAIL_REGEX.test(value)) return DEFAULT_EMAIL_ERROR;
      if (inputType === 'tel' && value) return phoneMask.validate(value, phoneFormat);
      if (inputType === 'time') {
        const timeError = timeMask.validate(value);

        if (timeError) {
          return timeError;
        }

        return validateTimeBounds(value, minConstraint, maxConstraint) ?? validateProp?.(value);
      }

      if (inputType === 'data' || inputType === 'date') {
        const dateError = datePicker.validate(value);

        if (dateError) {
          return dateError;
        }

        return validateDateBounds(value, minConstraint, maxConstraint) ?? validateProp?.(value);
      }

      return validateProp?.(value);
    },
    [inputType, maxConstraint, minConstraint, phoneFormat, validateProp]
  );

  const {
    id,
    innerRef,
    currentValue,
    displayError,
    validateValue,
    setInternalError,
    setUncontrolledValue,
    focusField,
  } = useFieldControl<HTMLInputElement>(ref, {
    id: idProp,
    value: isPhone || isTime || isDate ? undefined : valueProp,
    // Обязательность у поля только для чтения не ПРОВЕРЯЕТСЯ (звёздочку она рисует по-прежнему):
    // значение туда кладёт кто-то другой, и «Поле обязательно» на blur обвиняло бы пользователя
    // в том, чего он в этом поле сделать не может.
    required: required && !isReadOnly,
    emptyMessage,
    error,
    validate: typeValidate,
    isEmpty: isPhone ? (value: string) => phoneMask.isEmpty(value, phoneFormat) : undefined,
  });

  const helperText = displayError ?? comment;
  const helperTextColor = displayError ? 'var(--red)' : 'var(--gray)';

  const [phoneUncontrolled, setPhoneUncontrolled] = useState(() => {
    if (!isPhone || valueProp !== undefined || !defaultValueString) return phoneMask.emptyValue(phoneFormat);
    return phoneMask.formatPhone(defaultValueString, phoneFormat) || phoneMask.emptyValue(phoneFormat);
  });
  const [timeUncontrolled, setTimeUncontrolled] = useState(() => (
    isTime && valueProp === undefined ? timeMask.normalize(defaultValueString) : ''
  ));
  const [dateUncontrolled, setDateUncontrolled] = useState(() => (
    isDate && valueProp === undefined ? datePicker.normalizeDisplayValue(defaultValueString) : ''
  ));
  const [isFieldFocused, setIsFieldFocused] = useState(false);
  // true = поле сейчас readonly, чтобы Chrome не предлагал автозаполнение (только когда lockAutofill).
  const [isAutofillLocked, setIsAutofillLocked] = useState(true);

  const rootRef = useRef<HTMLElement | null>(null);

  const isPhoneControlled = isPhone && valueProp !== undefined;
  const isTimeControlled = isTime && valueProp !== undefined;
  const isDateControlled = isDate && valueProp !== undefined;
  const phoneDisplayValue = isPhone
    ? (isPhoneControlled ? phoneMask.formatPhone(String(valueProp), phoneFormat) || phoneMask.emptyValue(phoneFormat) : phoneUncontrolled)
    : undefined;
  const phoneDisplayValueWithoutPrefix = isPhone
    ? phoneMask.stripPrefix(phoneDisplayValue ?? '', phoneFormat)
    : undefined;
  const timeDisplayValue = isTime
    ? (isTimeControlled ? timeMask.normalize(String(valueProp)) : timeUncontrolled)
    : undefined;
  const dateDisplayValue = isDate
    ? (isDateControlled ? datePicker.normalizeDisplayValue(String(valueProp)) : dateUncontrolled)
    : undefined;
  const showTimeMask = isTime && (isFieldFocused || Boolean(timeDisplayValue));
  const timeMaskValue = isTime ? (timeDisplayValue ?? '') : '';
  const timeMaskSuffix = showTimeMask ? timeMask.getMaskSuffix(timeMaskValue) : '';

  const createSyntheticEvent = <T extends ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>>(value: string, baseEvent?: T): T => {
    const fallbackTarget = innerRef.current as HTMLInputElement | null;
    const sourceTarget = (baseEvent?.target as HTMLInputElement | null) ?? fallbackTarget;
    const sourceCurrentTarget = (baseEvent?.currentTarget as HTMLInputElement | null) ?? sourceTarget ?? fallbackTarget;

    return {
      ...(baseEvent ?? {}),
      target: { ...(sourceTarget ?? {}), value },
      currentTarget: { ...(sourceCurrentTarget ?? {}), value },
    } as T;
  };

  const commitDateValue = useCallback((nextValue: string) => {
    if (!isDateControlled) setDateUncontrolled(nextValue);
    setInternalError(validateValue(nextValue));
    onChange?.(createSyntheticEvent<ChangeEvent<HTMLInputElement>>(nextValue));
  }, [isDateControlled, onChange, setInternalError, validateValue]);

  const {
    isDatePickerActive,
    floatingRef,
    visibleMonth,
    setVisibleMonth,
    selectedDate,
    minDate,
    maxDate,
    calendarDays,
    deactivateDatePicker,
    activateDatePicker,
    toggleDatePickerActive,
    isDateDisabled,
    handleDateSelect,
  } = useDatePicker({
    enabled: isDate,
    disabled,
    value: dateDisplayValue,
    minValue: minConstraint,
    maxValue: maxConstraint,
    rootRef,
    validateValue,
    setInternalError,
    focusField,
    onCommit: commitDateValue,
  });

  const isFieldActive = isFieldFocused || isDatePickerActive;

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      setIsFieldFocused(true);
      // Снимаем readonly-замок автозаполнения. Дополнительно убираем атрибут напрямую из DOM, чтобы
      // поле стало редактируемым в этот же тик (до ре-рендера) — на случай мгновенного ввода после фокуса.
      // Только для полей с включённым режимом, чтобы не трогать readonly у date-пикера и т.п.
      if (lockAutofill && isAutofillLocked) {
        setIsAutofillLocked(false);
        event.currentTarget.removeAttribute('readonly');
      }
      onFocus?.(event);
    },
    [lockAutofill, isAutofillLocked, onFocus]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const relatedTarget = event.relatedTarget as Node | null;
      const isFocusInside = Boolean(relatedTarget && rootRef.current?.contains(relatedTarget));

      if (!isFocusInside) {
        setIsFieldFocused(false);
        // Поле покинуто — снова запираем от автозаполнения до следующего фокуса (если режим включён).
        if (lockAutofill) setIsAutofillLocked(true);
      }

      if (isPhone) {
        const formatted = phoneMask.formatPhone(event.target.value, phoneFormat);
        const synthetic = createSyntheticEvent<FocusEvent<HTMLInputElement>>(formatted, event);
        setInternalError(validateValue(formatted));
        onBlur?.(synthetic);
        return;
      }

      if (isTime) {
        const nextValue = timeMask.normalize(event.target.value);
        if (!isTimeControlled) setTimeUncontrolled(nextValue);
        const synthetic = createSyntheticEvent<FocusEvent<HTMLInputElement>>(nextValue, event);
        setInternalError(validateValue(nextValue));
        onBlur?.(synthetic);
        return;
      }

      if (isDate) {
        if (!isFocusInside) {
          if (isDatePickerActive) deactivateDatePicker();
          else setInternalError(validateValue(dateDisplayValue ?? ''));
        }

        onBlur?.(createSyntheticEvent<FocusEvent<HTMLInputElement>>(dateDisplayValue ?? '', event));
        return;
      }

      setInternalError(validateValue(event.target.value));
      onBlur?.(event);
    },
    [createSyntheticEvent, dateDisplayValue, deactivateDatePicker, isDate, isDatePickerActive, isPhone, isTime, isTimeControlled, lockAutofill, onBlur, phoneFormat, setInternalError, validateValue]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (isPhone) {
        const formatted = phoneMask.formatPhone(event.target.value, phoneFormat);
        if (!isPhoneControlled) setPhoneUncontrolled(formatted);
        const synthetic = createSyntheticEvent<ChangeEvent<HTMLInputElement>>(formatted, event);
        onChange?.(synthetic);
        // Пока номер НАБИРАЮТ, ошибку только гасим, а не поднимаем: «Введите 11 цифр номера»
        // на третьей цифре — претензия к незаконченному действию. Полную проверку ведёт blur
        // (handleBlur ниже), а здесь уже показанная ошибка пересчитывается и уходит сама.
        const nextError = validateValue(formatted);
        setInternalError((currentError) => (currentError ? nextError : undefined));
        return;
      }

      if (isTime) {
        const rawValue = event.target.value;
        const { normalizedValue, selectionStart, selectionEnd } = normalizeTimeValue(
          rawValue,
          event.target.selectionStart,
          event.target.selectionEnd
        );

        if (!isTimeControlled) setTimeUncontrolled(normalizedValue);
        onChange?.(createSyntheticEvent<ChangeEvent<HTMLInputElement>>(normalizedValue, event));
        setInternalError(validateValue(normalizedValue));

        if (innerRef.current && selectionStart !== null && selectionEnd !== null) {
          requestAnimationFrame(() => {
            innerRef.current?.setSelectionRange(selectionStart, selectionEnd);
          });
        }

        return;
      }

      if (isNumber) {
        const min = restInputProps.min !== undefined ? Number(restInputProps.min) : undefined;
        if (min !== undefined && !Number.isNaN(min) && min >= 0 && event.target.value.trim().startsWith('-')) {
          const sanitizedValue = event.target.value.replace(/^-+/, '');
          const normalizedValue = sanitizedValue === '-' ? '' : sanitizedValue;
          if (valueProp === undefined) setUncontrolledValue(normalizedValue);
          const synthetic = createSyntheticEvent<ChangeEvent<HTMLInputElement>>(normalizedValue, event);
          onChange?.(synthetic);
          setInternalError(validateValue(normalizedValue));
          return;
        }
      }

      if (isDate) {
        activateDatePicker();
        return;
      }

      if (valueProp === undefined) setUncontrolledValue(event.target.value);
      onChange?.(event);
      // Пока НАБИРАЮТ, ошибку только гасим, а не поднимаем — то же правило, что у телефона выше.
      // Без этого «Введите корректный email» выскакивает на первой же букве, то есть претензией
      // к незаконченному действию; поднимает ошибку blur (`handleBlur`).
      const nextError = validateValue(event.target.value);
      setInternalError((currentError) => (currentError ? nextError : undefined));
    },
    [activateDatePicker, createSyntheticEvent, isDate, isPhone, isPhoneControlled, isTime, isTimeControlled, onChange, phoneFormat, setInternalError, setUncontrolledValue, validateValue, valueProp]
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      onInputKeyDown?.(event);
      if (event.defaultPrevented || disabled) return;

      if (isNumber) {
        const min = restInputProps.min !== undefined ? Number(restInputProps.min) : undefined;
        const minIsNonNegative = min !== undefined && !Number.isNaN(min) && min >= 0;

        // type=number в Firefox и Safari (в т.ч. на macOS) пропускает буквы прямо в поле —
        // символы видны, а .value при этом пустеет, поэтому отфильтровать их в onChange нельзя.
        // Блокируем непечатные символы на нажатии: разрешаем только цифры, разделитель дробной
        // части, допустимый минус и сочетания с Ctrl/Cmd/Alt (копировать/вставить/выделить/навигация).
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const isDigit = event.key >= '0' && event.key <= '9';
          const isDecimalSeparator = event.key === '.' || event.key === ',';
          const isAllowedMinus = event.key === '-' && !minIsNonNegative;

          if (!isDigit && !isDecimalSeparator && !isAllowedMinus) {
            event.preventDefault();
            return;
          }
        }
      }

      if (!isDate) return;

      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        activateDatePicker();
        return;
      }

      // Escape гасит только ОТКРЫТЫЙ календарь и забирает клавишу себе: закрытый отпускает её
      // наружу — поповеру или окну, внутри которых стоит поле (как у Select).
      if (event.key === 'Escape' && isDatePickerActive) {
        event.preventDefault();
        deactivateDatePicker(false);
      }
    },
    [activateDatePicker, deactivateDatePicker, disabled, isDate, isDatePickerActive, isNumber, onInputKeyDown, restInputProps.min]
  );

  const handleNumberStep = useCallback(
    (delta: number) => {
      if (!isNumber || disabled) return;

      const min = restInputProps.min !== undefined ? Number(restInputProps.min) : undefined;
      const max = restInputProps.max !== undefined ? Number(restInputProps.max) : undefined;
      const rawValue = innerRef.current?.value ?? currentValue ?? '';
      const numericValue = rawValue === '' ? Number.NaN : Number(rawValue);
      const boundedOptions = resolvedNumberOptions.filter((option) => (
        (min === undefined || option >= min) &&
        (max === undefined || option <= max)
      ));

      let nextValue: number;

      const firstOption = boundedOptions[0];
      const lastOption = boundedOptions[boundedOptions.length - 1];

      if (firstOption !== undefined && lastOption !== undefined) {
        if (!Number.isFinite(numericValue)) {
          nextValue = delta > 0 ? firstOption : lastOption;
        } else {
          const exactIndex = boundedOptions.indexOf(numericValue);

          if (exactIndex >= 0) {
            const nextIndex = Math.min(Math.max(exactIndex + delta, 0), boundedOptions.length - 1);
            nextValue = boundedOptions[nextIndex] ?? lastOption;
          } else if (delta > 0) {
            nextValue = boundedOptions.find((option) => option > numericValue) ?? lastOption;
          } else {
            const reversedOptions = [...boundedOptions].reverse();
            nextValue = reversedOptions.find((option) => option < numericValue) ?? firstOption;
          }
        }
      } else {
        const step = Number((restInputProps.step as string | number | undefined) ?? 1);
        let numValue = Number.isFinite(numericValue) ? numericValue : 0;

        nextValue = numValue + delta * step;

        if (min !== undefined) nextValue = Math.max(nextValue, min);
        if (max !== undefined) nextValue = Math.min(nextValue, max);

        const stepDecimals = step.toString().split('.')[1]?.length ?? 0;
        nextValue = Number(nextValue.toFixed(stepDecimals));
      }

      const nextValueStr = String(nextValue);

      if (innerRef.current) {
        innerRef.current.value = nextValueStr;
      }

      if (valueProp === undefined) {
        setUncontrolledValue(nextValueStr);
      }

      const synthetic = createSyntheticEvent<ChangeEvent<HTMLInputElement>>(nextValueStr);
      onChange?.(synthetic);
      setInternalError(validateValue(nextValueStr));
    },
    [isNumber, disabled, restInputProps.step, restInputProps.min, restInputProps.max, innerRef, currentValue, resolvedNumberOptions, valueProp, setUncontrolledValue, createSyntheticEvent, onChange, setInternalError, validateValue]
  );

  const handleInvalid = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      restInputProps.onInvalid?.(event);
      // Глушим нативный пузырёк-подсказку браузера (текст с точкой на конце генерирует сам браузер):
      // у поля своя валидация и свой вывод ошибки, дублировать нативной валидацией не нужно.
      if (!event.defaultPrevented) event.preventDefault();
    },
    [restInputProps.onInvalid]
  );

  const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
    ...restInputProps,
    id,
    type: resolvedInputType,
    disabled,
    // Нативный `required` в DOM не ставим: именно он заставляет браузер показывать свой
    // пузырёк-валидатор («Заполните это поле.»). Обязательность проверяем своим слоем
    // (useFieldControl → свой текст ошибки), для скринридеров оставляем aria-required.
    'aria-required': required || undefined,
    // Отключаем автоподсказки/автозаполнение браузера (сохранённые почты и т.п.) по умолчанию;
    // конкретное поле может вернуть автозаполнение, явно передав свой autoComplete.
    autoComplete: restInputProps.autoComplete ?? 'off',
    // Подавляем нативную валидацию-подсказку браузера для всех полей.
    onInvalid: handleInvalid,
    defaultValue: isPhone || isTime || isDate ? undefined : defaultValueProp,
    placeholder: isPhone
      ? (placeholder ?? phoneMask.placeholderText(phoneFormat))
      : isTime
          ? (showTimeMask ? '' : (placeholder ?? timeMask.placeholder))
          : placeholder,
    'aria-invalid': restInputProps['aria-invalid'] ?? (displayError ? true : undefined),
    minLength: isTime ? 5 : length?.min,
    maxLength: isPhone ? (length?.max ?? phoneMask.maxLengthOf(phoneFormat)) : isTime ? timeMask.maxLength : isDate ? datePicker.maxLength : length?.max,
    inputMode: isTime ? 'numeric' : isPhone ? 'tel' : isEmail ? 'email' : restInputProps.inputMode,
    readOnly: isDate || restInputProps.readOnly || (lockAutofill && isAutofillLocked),
    value: isPhone
      ? phoneDisplayValueWithoutPrefix
      : isTime
          ? timeDisplayValue
          : isDate
              ? dateDisplayValue
              : valueProp,
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleInputKeyDown,
    ...(inputType === 'email' && { pattern: restInputProps.pattern ?? EMAIL_PATTERN }),
  };

  const handleFieldClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (disabled) return;

    const target = event.target as HTMLElement;
    if (target.closest('[data-input-action="true"]')) return;

    if (isDate) {
      toggleDatePickerActive();
      return;
    }

    focusField();
  }, [disabled, focusField, isDate, toggleDatePickerActive]);

  const hasValue = useMemo(
    () =>
      isPhone
        ? (phoneDisplayValue ?? '').length > 0 && phoneDisplayValue !== phoneMask.emptyValue(phoneFormat)
        : isTime
          ? (timeDisplayValue ?? '').length > 0
          : isDate
            ? (dateDisplayValue ?? '').length > 0
            : currentValue.length > 0,
    [isPhone, isTime, isDate, phoneDisplayValue, phoneFormat, timeDisplayValue, dateDisplayValue, currentValue]
  );

  return {
    id,
    innerRef,
    inputType,
    isPhone,
    isTime,
    isDate,
    isNumber,
    isReadOnly,
    hasError: Boolean(displayError),
    helperText,
    helperTextColor,
    rootRef,
    isFieldActive,
    hasValue,
    inputProps,
    handleFieldClick,
    handleNumberStep,
    timeField: {
      showMask: showTimeMask,
      value: timeMaskValue,
      suffix: timeMaskSuffix,
    },
    datePicker: {
      isActive: isDatePickerActive,
      floatingRef,
      visibleMonth,
      setVisibleMonth,
      selectedDate,
      minDate,
      maxDate,
      calendarDays,
      onToggle: toggleDatePickerActive,
      isDateDisabled,
      onDateSelect: handleDateSelect,
    },
  };
}
