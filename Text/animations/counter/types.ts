export type CounterTrigger = 'onLoad' | 'onView';

export interface CounterOptions {
  to: number;
  duration?: number;
  start?: number;
  suffix?: string;
  trigger?: CounterTrigger;
  /** Группировать разряды пробелом (3000 → «3 000»). Для крупных метрик. */
  grouped?: boolean;
}
