'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import * as datePicker from './date-picker';

interface UseDatePickerOptions {
  enabled: boolean;
  disabled?: boolean;
  value?: string;
  minValue?: string;
  maxValue?: string;
  rootRef: RefObject<HTMLElement | null>;
  validateValue: (value: string) => string | undefined;
  setInternalError: (value: string | undefined) => void;
  focusField: () => void;
  onCommit: (value: string) => void;
}

export function useDatePicker({
  enabled,
  disabled,
  value,
  minValue,
  maxValue,
  rootRef,
  validateValue,
  setInternalError,
  focusField,
  onCommit,
}: UseDatePickerOptions) {
  const [isActive, setIsActive] = useState(false);
  const floatingRef = useRef<HTMLElement | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => (
    enabled
      ? datePicker.resolveVisibleMonth(value ?? minValue ?? maxValue)
      : datePicker.getMonthStart(new Date())
  ));

  const selectedDate = enabled ? datePicker.parseValue(value ?? '') : null;
  const minDate = enabled ? datePicker.parseValue(minValue ?? '') : null;
  const maxDate = enabled ? datePicker.parseValue(maxValue ?? '') : null;
  const calendarDays = enabled ? datePicker.buildCalendarDays(visibleMonth) : [];

  useEffect(() => {
    if (!enabled || !value) return;

    const parsedDate = datePicker.parseValue(value);
    if (!parsedDate) return;

    const nextMonth = datePicker.getMonthStart(parsedDate);
    setVisibleMonth((currentMonth) => (
      currentMonth.getFullYear() === nextMonth.getFullYear()
      && currentMonth.getMonth() === nextMonth.getMonth()
        ? currentMonth
        : nextMonth
    ));
  }, [enabled, value]);

  const isDateDisabled = useCallback((day: Date) => {
    if (minDate && datePicker.isBeforeDay(day, minDate)) {
      return true;
    }

    if (maxDate && datePicker.isAfterDay(day, maxDate)) {
      return true;
    }

    return false;
  }, [maxDate, minDate]);

  useEffect(() => {
    if (!enabled || !isActive) return;

    const handleClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node;
      const isInsideRoot = Boolean(rootRef.current?.contains(targetNode));
      const isInsideFloating = Boolean(floatingRef.current?.contains(targetNode));

      if (!isInsideRoot && !isInsideFloating) {
        setIsActive(false);
        setInternalError(validateValue(value ?? ''));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [enabled, isActive, rootRef, setInternalError, validateValue, value]);

  const deactivateDatePicker = useCallback((shouldValidate = true) => {
    setIsActive(false);
    if (shouldValidate) setInternalError(validateValue(value ?? ''));
  }, [setInternalError, validateValue, value]);

  const activateDatePicker = useCallback(() => {
    if (disabled || !enabled) return;

    setVisibleMonth(datePicker.resolveVisibleMonth(value ?? minValue ?? maxValue));
    setIsActive(true);
    focusField();
  }, [disabled, enabled, focusField, maxValue, minValue, value]);

  const toggleDatePickerActive = useCallback(() => {
    if (isActive) {
      deactivateDatePicker();
      return;
    }

    activateDatePicker();
  }, [activateDatePicker, deactivateDatePicker, isActive]);

  const handleDateSelect = useCallback((nextDate: Date) => {
    if (isDateDisabled(nextDate)) {
      return;
    }

    const nextValue = datePicker.formatDisplay(nextDate);
    onCommit(nextValue);
    setVisibleMonth(datePicker.getMonthStart(nextDate));
    setIsActive(false);
  }, [isDateDisabled, onCommit]);

  return {
    isDatePickerActive: isActive,
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
  };
}
