import { defineAnimation } from '../types';
import { flattenAnimatableText } from '../flattenText';
import { TextSlide } from './TextSlide';

export const textSlide = defineAnimation<'textSlide'>({
  key: 'textSlide',
  // Своп-режим анимирует посимвольно → нужен текстовый контент (строка/число/интерполяция примитивов);
  // иначе (React-элемент) отдаём как есть. Hover/sequence-режимы к контенту нетребовательны.
  isActive: (options, content) =>
    options?.mode === 'swap' ? flattenAnimatableText(content) !== null : true,
  Inner: TextSlide,
});

export type { TextSlideOptions } from './types';
