'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type PresentModalOptions = {
  onClose?: () => void;
  stackBehavior?: 'stack' | 'replace';
};

type StackItem = {
  id: string;
  node: ReactNode;
  options: PresentModalOptions;
  open: boolean;
};

type ModalContextValue = {
  present: (node: ReactNode, options?: PresentModalOptions) => () => void;
  dismiss: () => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

const ModalRuntimeContext = createContext<{ open: boolean; dismiss: () => void } | null>(null);

const CLOSE_DELAY_MS = 500;

export function ModalProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<StackItem[]>([]);
  const idRef = useRef(0);
  const baseId = useId();

  const dismissById = useCallback((id: string) => {
    setStack((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const item = prev[index];
      item.options.onClose?.();
      setTimeout(() => {
        setStack((p) => p.filter((x) => x.id !== id));
      }, CLOSE_DELAY_MS);
      return prev.map((x) => (x.id === id ? { ...x, open: false } : x));
    });
  }, []);

  const present = useCallback(
    (node: ReactNode, options: PresentModalOptions = {}) => {
      const id = `${baseId}-${(idRef.current += 1)}`;
      setStack((prev) => {
        if (options.stackBehavior === 'replace') {
          return [{ id, node, options, open: false }];
        }
        return [...prev, { id, node, options, open: false }];
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStack((prev) =>
            prev.map((item) => (item.id === id ? { ...item, open: true } : item))
          );
        });
      });

      return () => dismissById(id);
    },
    [baseId, dismissById]
  );

  const dismiss = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const top = prev[prev.length - 1];
      top.options.onClose?.();
      const idToRemove = top.id;
      setTimeout(() => {
        setStack((p) => p.filter((x) => x.id !== idToRemove));
      }, CLOSE_DELAY_MS);
      return prev.map((item, i) =>
        i === prev.length - 1 ? { ...item, open: false } : item
      );
    });
  }, []);

  const value: ModalContextValue = { present, dismiss };

  const portalContent =
    stack.length > 0 &&
    (typeof document !== 'undefined'
      ? createPortal(
          <>
            {stack.map((item) => (
              <ModalRuntimeContext.Provider
                key={item.id}
                value={{ open: item.open, dismiss: () => dismissById(item.id) }}
              >
                {item.node}
              </ModalRuntimeContext.Provider>
            ))}
          </>,
          document.body
        )
      : null);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {portalContent}
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}

export function useModalAction(): { dismiss: () => void } {
  const ctx = useContext(ModalRuntimeContext);
  if (!ctx)
    throw new Error('useModalAction must be used within modal content');
  return { dismiss: ctx.dismiss };
}

export function useModalRuntime(): { open: boolean; dismiss: () => void } {
  const ctx = useContext(ModalRuntimeContext);
  if (!ctx)
    throw new Error('Modal must be rendered within presented modal content');
  return ctx;
}
