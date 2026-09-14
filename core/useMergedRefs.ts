import { useCallback, type Ref, type RefCallback } from 'react';

/** Присваивает узел ref'у любого вида: функции, объекту `{ current }` или пустоте. */
export function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') {
    ref(node);
    return;
  }

  if (ref) {
    (ref as { current: T | null }).current = node;
  }
}

/**
 * Склеивает ref'ы в один колбэк: ref снаружи (проп `ref`), свой внутренний и сеттер анимации
 * получают один и тот же узел. Колбэк стабилен, пока не сменились сами ref'ы.
 */
export function useMergedRefs<T>(a: Ref<T> | undefined, b: Ref<T> | undefined, c?: Ref<T>): RefCallback<T> {
  return useCallback((node: T | null) => {
    assignRef(a, node);
    assignRef(b, node);
    assignRef(c, node);
  }, [a, b, c]);
}
