import type { ComponentType, ReactNode } from 'react';

import type { ResponsiveInput } from '../../core';
import { animationRegistry } from './registry';
import type { AnimationInput, AnimationKey, AnimationOptions, TextAnimationContext } from './types';

export interface ResolvedAnimation {
  active: boolean;
  Inner?: ComponentType<TextAnimationContext<AnimationOptions>>;
  options?: AnimationOptions;
}

// Разбор пропа `animate`/`animation` в пару (ключ, опции). responsive-форма [d, m, t] — берём desktop
// (рендер всё равно одноключевой); одиночное значение — ключ или [ключ, опции].
function parse(input: ResponsiveInput<AnimationInput> | undefined): { key?: AnimationKey; options?: AnimationOptions } {
  if (input == null) return {};

  const normalize = (v: AnimationInput): { key: AnimationKey; options?: AnimationOptions } =>
    Array.isArray(v)
      ? { key: v[0] as AnimationKey, options: v.length >= 2 ? (v[1] as AnimationOptions) : undefined }
      : { key: v as AnimationKey };

  if (Array.isArray(input) && input.length === 3) {
    const desktop = input[0];
    return desktop != null ? normalize(desktop as AnimationInput) : {};
  }

  return normalize(input as AnimationInput);
}

/**
 * Резолвит проп анимации в активный плагин из реестра: парсит ключ+опции, проверяет isActive плагина.
 * Pure (без хуков) — Text вызывает один раз и либо рендерит `Inner`, либо контент как есть.
 */
export function resolveAnimation(
  input: ResponsiveInput<AnimationInput> | undefined,
  content: ReactNode
): ResolvedAnimation {
  const { key, options } = parse(input);
  const plugin = key ? animationRegistry[key] : undefined;
  if (!plugin) return { active: false };

  const active = plugin.isActive ? plugin.isActive(options, content) : true;
  return active ? { active, Inner: plugin.Inner, options } : { active: false };
}
