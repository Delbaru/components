import { defineAnimation } from '../types';
import { flattenAnimatableText } from '../flattenText';
import { TextReveal } from './TextReveal';

export const textReveal = defineAnimation<'textReveal'>({
  key: 'textReveal',
  // Анимируем текстовый контент (строка/число/интерполяция примитивов); React-элементы — отдаём как есть.
  isActive: (_options, content) => flattenAnimatableText(content) !== null,
  Inner: TextReveal,
});

export type { TextRevealOptions } from './types';
