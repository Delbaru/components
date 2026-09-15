'use client';

import { useCallback, useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredFloating } from '../../hooks/useAnchoredFloating';
import { Button } from '../../Button';
import { Flex } from '../../Flex';
import { Grid } from '../../Grid';
import { Icon } from '../../Icon';
import { Text } from '../../Text';
import { cx, stateProps } from '../../core';
import styles from './Calendar.module.scss';
import * as datePicker from '../lib/date-picker';

interface CalendarProps {
  id: string;
  anchorRef: RefObject<HTMLElement | null>;
  floatingRef: RefObject<HTMLElement | null>;
  isActive: boolean;
  visibleMonth: Date;
  setVisibleMonth: Dispatch<SetStateAction<Date>>;
  selectedDate: Date | null;
  calendarDays: Date[];
  isDateDisabled: (day: Date) => boolean;
  onDateSelect: (day: Date) => void;
}

export function Calendar({
  id,
  anchorRef,
  floatingRef,
  isActive,
  visibleMonth,
  setVisibleMonth,
  selectedDate,
  calendarDays,
  isDateDisabled,
  onDateSelect,
}: CalendarProps) {
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [isMonthPickerActive, setIsMonthPickerActive] = useState(false);
  const { placement, isPositioned, style: floatingStyle } = useAnchoredFloating({
    anchorRef,
    floatingRef,
    isActive,
    placement: 'bottom',
    align: 'start',
    gap: 8,
    viewportPadding: 8,
  });
  const visibleMonthIndex = visibleMonth.getMonth();
  const visibleMonthLabel = datePicker.MONTH_LABELS[visibleMonthIndex];
  const visibleYear = visibleMonth.getFullYear();

  useEffect(() => {
    setPortalNode(document.body);
  }, []);

  useEffect(() => {
    if (!isActive) setIsMonthPickerActive(false);
  }, [isActive]);

  const toggleMonthPickerActive = useCallback(() => {
    setIsMonthPickerActive((currentValue) => !currentValue);
  }, []);

  const handleMonthSelect = useCallback((monthIndex: number) => {
    setVisibleMonth((currentMonth) => new Date(currentMonth.getFullYear(), monthIndex, 1));
    setIsMonthPickerActive(false);
  }, [setVisibleMonth]);

  const changeVisibleYear = useCallback((delta: number) => {
    setVisibleMonth((currentMonth) => new Date(currentMonth.getFullYear() + delta, currentMonth.getMonth(), 1));
  }, [setVisibleMonth]);

  const calendar = (
    <Flex
      ref={floatingRef}
      dir={['column', 'column', 'column']}
      gap={[8, null, null]}
      p={[16, null, null]}
      r={[16, null, null]}
      w={[336, null, null]}
      border={[`calc(1 * var(--rpx)) solid var(--gray-light)`, null, null]}
      bg='var(--white-100)'
      className={styles.Calendar}
      style={floatingStyle}
      onMouseDownCapture={(event) => event.preventDefault()}
      {...stateProps(isActive && isPositioned && 'active')}
      data-placement={placement}
    >
      <Flex
        dir={['row', 'row', 'row']}
        align={['center', 'center', 'center']}
        justify={['space_between', 'space_between', 'space_between']}
        gap={[8, null, null]}
      >
        <Icon
          src='/icons/ui/arrows/style-2/arrow.svg'
          rootW={[40, null, null]}
          rootH={[40, null, null]}
          w={[18, null, null]}
          h={[18, null, null]}
          rootR={[8, null, null]}
          rootBg={['var(--white-100)', 'var(--white-100)', 'var(--white-100)']}
          border={['calc(1 * var(--rpx)) solid var(--gray-light)', null, null]}
          onClick={() => setVisibleMonth((currentMonth) => datePicker.addMonth(currentMonth, -1))}
          rootClassName={cx(styles.btn, styles.prev)}
        />

        <Flex dir={['row', 'row', 'row']} align={['center', 'center', 'center']} gap={[16, null, null]}>
          <Flex
            dir={['row', 'row', 'row']}
            align={['center', 'center', 'center']}
            gap={[4, null, null]}
            className={styles.monthPick}
            onClick={toggleMonthPickerActive}
            {...stateProps(isMonthPickerActive && 'active')}
          >
            <Text variant={['subtitle', null, null]}>{visibleMonthLabel}</Text>

            <Icon
              src='/icons/ui/arrows/style-3/arrow.svg'
              w={[20, null, null]}
              h={[20, null, null]}
              rootClassName={cx(styles.btn, styles.prev)}
            />
          </Flex>

          <Flex dir={['row', 'row', 'row']} align={['center', 'center', 'center']} gap={[4, null, null]} className={styles.yearPick}>
            <Text variant={['subtitle', null, null]}>{visibleYear}</Text>

            <Flex dir={['column', 'column', 'column']} align={['center', 'center', 'center']} gap={[4, null, null]}>
              <Icon
                src='/icons/ui/arrows/style-3/arrow.svg'
                rootW={[12, null, null]}
                rootH={[8, null, null]}
                w={[16, null, null]}
                h={['auto', null, null]}
                rootClassName={cx(styles.btn, styles.prev)}
                onClick={() => changeVisibleYear(1)}
              />

              <Icon
                src='/icons/ui/arrows/style-3/arrow.svg'
                rootW={[12, null, null]}
                rootH={[8, null, null]}
                w={[16, null, null]}
                h={['auto', null, null]}
                rootClassName={cx(styles.btn, styles.next)}
                onClick={() => changeVisibleYear(-1)}
              />
            </Flex>
          </Flex>
        </Flex>

        <Icon
          src='/icons/ui/arrows/style-2/arrow.svg'
          rootW={[40, null, null]}
          rootH={[40, null, null]}
          w={[18, null, null]}
          h={[18, null, null]}
          rootR={[8, null, null]}
          rootBg={['var(--white-100)', 'var(--white-100)', 'var(--white-100)']}
          border={['calc(1 * var(--rpx)) solid var(--gray-light)', null, null]}
          onClick={() => setVisibleMonth((currentMonth) => datePicker.addMonth(currentMonth, 1))}
          rootClassName={cx(styles.btn, styles.next)}
        />
      </Flex>

      {isMonthPickerActive ? (
        <Grid columns={[3, 3, 3]} gap={[8, 8, 8]}>
          {datePicker.MONTH_LABELS.map((monthLabel, monthIndex) => {
            const isCurrentVisibleMonth = monthIndex === visibleMonthIndex;

            return (
              <Button
                key={monthLabel}
                type='button'
                h={[40, null, null]}
                r={[8, null, null]}
                border={['calc(1 * var(--rpx)) solid var(--gray-light)', null, null]}
                bg={isCurrentVisibleMonth ? 'var(--primary)' : 'var(--background)'}
                onClick={() => handleMonthSelect(monthIndex)}
              >
                <Text
                  variant={['small', 'small', 'small']}
                  color={isCurrentVisibleMonth ? 'var(--white-100)' : undefined}
                >
                  {monthLabel.slice(0, 3)}
                </Text>
              </Button>
            );
          })}
        </Grid>
      ) : (
        <>
          <Grid columns={[7, 7, 7]}>
            {datePicker.WEEKDAY_LABELS.map((weekday) => (
              <Flex
                key={weekday}
                align={['center', 'center', 'center']}
                justify={['center', 'center', 'center']}
                w={[40, null, null]}
                h={[40, null, null]}
              >
                <Text variant={['small', 'small', 'small']} color='#AAA'>{weekday}</Text>
              </Flex>
            ))}
          </Grid>

          <Grid columns={[7, 7, 7]} gap={[4, 4, 4]}>
            {calendarDays.map((day) => {
              const isCurrentMonthDay = day.getMonth() === visibleMonth.getMonth();
              const isDisabledDay = isDateDisabled(day);
              const isSelectedDay = !isDisabledDay && datePicker.isSameDay(selectedDate, day);
              const isWeekendDay = datePicker.isWeekend(day);
              const dayButtonId = `${id}-day-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
              const dayState = cx(
                isCurrentMonthDay ? '' : 'muted',
                isWeekendDay ? 'weekend' : '',
                isDisabledDay ? 'disabled' : '',
                isSelectedDay ? 'selected' : ''
              );
              const dayBackground = isSelectedDay
                ? 'var(--primary)'
                : 'var(--background)';
              const dayTextColor = isSelectedDay
                ? 'var(--white-100)'
                : isDisabledDay
                    ? '#C5C6CC'
                    : isWeekendDay && isCurrentMonthDay
                        ? 'var(--red)'
                        : undefined;

              return (
                <Button
                  id={dayButtonId}
                  key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                  type='button'
                  w={[40, null, null]}
                  h={[40, null, null]}
                  r={[8, null, null]}
                  className={styles.day}
                  bg={dayBackground}
                  state={dayState}
                  disabled={isDisabledDay}
                  linkState={[
                    { target: dayButtonId, on: 'hover', set: 'hover' },
                    { target: dayButtonId, on: 'active', set: 'active' },
                  ]}
                  onClick={() => onDateSelect(day)}
                >
                  <Text
                    className={styles.dayText}
                    variant={['small', 'small', 'small']}
                    color={dayTextColor}
                  >
                    {day.getDate()}
                  </Text>
                </Button>
              );
            })}
          </Grid>
        </>
      )}
    </Flex>
  );

  return portalNode ? createPortal(calendar, portalNode) : null;
}
