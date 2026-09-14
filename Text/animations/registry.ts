import type { AnimationKey, AnyTextAnimation } from './types';

import { counter } from './counter';
import { textSlide } from './textSlide';
import { textClip } from './textClip';
import { textReveal } from './textReveal';

/**
 * Реестр анимаций Text — единственный «манифест». Чтобы добавить фишку: создать ./<key>/ с плагином
 * и дописать его сюда одной строкой. Record<AnimationKey, …> гарантирует, что у каждого ключа карты
 * есть зарегистрированный плагин (забыл — ошибка типов).
 */
export const animationRegistry: Record<AnimationKey, AnyTextAnimation> = {
  counter,
  textSlide,
  textClip,
  textReveal,
};
