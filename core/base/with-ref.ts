import type { Ref } from 'react';

/**
 * Пропсы компонента вместе с `ref` (React 19: `ref` — обычный проп, `forwardRef` не нужен).
 * Сам тип пропсов (`BoxProps` и т.п.) остаётся без `ref` — им удобно типизировать обёртки.
 */
export type WithRef<P, E> = P & { ref?: Ref<E> };
