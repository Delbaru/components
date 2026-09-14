import { defineAnimation } from '../types';
import { Counter } from './Counter';
import { parseCountContent } from './parseContent';

export const counter = defineAnimation<'counter'>({
  key: 'counter',
  // Нужно число: либо явный `to`, либо распознанное в контенте («70%» → 70). Иначе («∞») — контент как есть.
  isActive: (options, content) => options?.to != null || parseCountContent(content) != null,
  Inner: Counter,
});

export type { CounterOptions, CounterTrigger } from './types';
export { useCountUp, type UseCountUpOptions } from './useCountUp';
