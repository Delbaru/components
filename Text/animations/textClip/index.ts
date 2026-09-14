import { defineAnimation } from '../types';
import { TextClip } from './TextClip';

export const textClip = defineAnimation<'textClip'>({
  key: 'textClip',
  // Без шагов клипать нечего — отдаём контент как есть.
  isActive: (options) => options?.steps != null,
  Inner: TextClip,
});

export type { TextClipOptions } from './types';
