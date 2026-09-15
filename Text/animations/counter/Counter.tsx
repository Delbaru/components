'use client';

import { useRef } from 'react';

import { useInView } from '../../../core/useInView';
import { useCountUp } from './useCountUp';
import { parseCountContent } from './parseContent';
import type { TextAnimationContext } from '../types';
import type { CounterOptions } from './types';

/**
 * Анимация счётчика: число едет от start к to. trigger='onView' (по умолчанию) запускает анимацию,
 * когда элемент попадает в зону видимости (и сбрасывает при уходе из неё), 'onLoad' — сразу.
 * inView наблюдается на собственном span'е плагина — Text про это ничего не знает.
 *
 * `to`/`suffix`/`grouped` можно не задавать: их достанет parseCountContent из текстового контента
 * (`70%` → 70 + «%»). Явные опции имеют приоритет над разбором.
 *
 * Ширину коробки держит НЕВИДИМЫЙ близнец с ИТОГОВЫМ значением: он один остаётся в потоке (значит
 * и базовая линия, и перенос — его), а бегущее число лежит поверх абсолютом. Поэтому сосед справа
 * не дёргается, пока счётчик тикает, а в покое размер тот же, что и без анимации.
 */
export function Counter({ options, content }: TextAnimationContext<CounterOptions>) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const { isInView } = useInView(ref, { threshold: 0.1 });

  const parsed = options?.to == null ? parseCountContent(content) : null;
  const to = options?.to ?? parsed?.to ?? 0;
  const suffix = options?.suffix ?? parsed?.suffix ?? '';
  const grouped = options?.grouped ?? parsed?.grouped ?? false;
  const trigger = options?.trigger ?? 'onView';
  const shouldStart = trigger === 'onLoad' || (trigger === 'onView' && isInView);

  const count = useCountUp(
    to,
    { duration: options?.duration, start: options?.start },
    shouldStart,
    !isInView
  );

  const format = (value: number) => (grouped ? value.toLocaleString('ru-RU') : String(value));

  return (
    <span ref={ref} className={'ui-counter'}>
      <span aria-hidden className={'ui-counter-reserve'}>
        {format(to)}
        {suffix}
      </span>

      <span className={'ui-counter-value'}>
        {format(count)}
        {suffix}
      </span>
    </span>
  );
}
