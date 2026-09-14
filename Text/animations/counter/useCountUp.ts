'use client';

import { useEffect, useState } from 'react';

export interface UseCountUpOptions {
  duration?: number;
  start?: number;
}

function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useCountUp(
  to: number,
  options: UseCountUpOptions = {},
  enabled = true,
  resetOnDisable = false // новый параметр
): number {
  const { duration = 2500, start = 0 } = options;
  const [value, setValue] = useState(start);

  useEffect(() => {
    if (!enabled) {
      if (resetOnDisable) {
        setTimeout(() => setValue(start), 0);
      }
      return;
    }

    if (to === start) {
      setTimeout(() => setValue(to), 0);
      return;
    }

    // Уважаем prefers-reduced-motion: без анимации сразу показываем итоговое значение.
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }

    const startTime = performance.now();
    const diff = to - start;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);
      setValue(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [enabled, to, start, duration, resetOnDisable]);

  return value;
}
