'use client';

import { useLenis } from 'lenis/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

/**
 * Контекст вертикального скролла приложения. scrollY — ЖИВОЙ геттер по ref (читается по требованию,
 * НЕ реактивен: чтение не вызывает ре-рендер). Живые значения тяни через registerScrollListener.
 *
 * Почему геттер, а не state: раньше провайдер дёргал setScrollY КАЖДЫЙ кадр скролла → memo-значение
 * контекста меняло identity покадрово → все потребители с [lenisCtx] в deps эффекта (напр.
 * useParallaxMotion) переподписывались каждый кадр = дикие лаги. Значение обязано быть стабильным.
 */
export type LenisScrollContextValue = {
  scrollY: number;
  registerScrollListener: (cb: (scrollY: number) => void) => () => void;
  stopScroll?: () => void;
  /**
   * Плавный перелёт к элементу или абсолютной позиции — тем же движком, что и обычный скролл.
   * Нужен якорным ссылкам: нативный переход по `#id` рвёт инерцию Lenis и прыгает мгновенно.
   *
   * `offset` — сдвиг конечной позиции в px, отрицательный поднимает цель ниже верхней кромки окна
   * (например, из-под фиксированной шапки). `scroll-margin-top` цели Lenis не читает, его значение
   * передают сюда явно.
   */
  scrollTo: (target: HTMLElement | number, options?: { offset?: number }) => void;
};

type LenisInstance = {
  scroll: number;
  stop: () => void;
  scrollTo: (target: HTMLElement | number, options?: { offset?: number }) => void;
};

const LenisScrollContext = createContext<LenisScrollContextValue | null>(null);

export function useLenisScroll(): LenisScrollContextValue {
  const ctx = useContext(LenisScrollContext);
  if (!ctx) {
    throw new Error('useLenisScroll must be used within LenisScrollProvider');
  }
  return ctx;
}

export function useLenisScrollOptional(): LenisScrollContextValue | null {
  return useContext(LenisScrollContext);
}

type LenisScrollProviderProps = {
  children: ReactNode;
};

/**
 * Нативный провайдер без Lenis: использует window.scroll для мобильных/планшетов.
 */
export function LenisScrollProviderNative({ children }: LenisScrollProviderProps) {
  const listenersRef = useRef<Set<(y: number) => void>>(new Set());
  const scrollYRef = useRef(0);
  const scrollTo = useCallback((target: HTMLElement | number, options?: { offset?: number }) => {
    const offset = options?.offset ?? 0;
    const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;

    window.scrollTo({ top: top + offset, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handle = () => {
      const y = typeof window !== 'undefined' ? window.scrollY : 0;
      scrollYRef.current = y;
      listenersRef.current.forEach((cb) => cb(y));
    };

    handle();
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handle, { passive: true });
      window.addEventListener('resize', handle);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', handle);
        window.removeEventListener('resize', handle);
      }
    };
  }, []);

  const registerScrollListener = useCallback((cb: (scrollY: number) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  // Стабильное значение (identity не меняется на скролл): scrollY — геттер по ref.
  const value = useMemo<LenisScrollContextValue>(
    () => ({
      get scrollY() {
        return scrollYRef.current;
      },
      registerScrollListener,
      scrollTo,
    }),
    [registerScrollListener, scrollTo]
  );

  return (
    <LenisScrollContext.Provider value={value}>
      {children}
    </LenisScrollContext.Provider>
  );
}

/**
 * Провайдер: прокидывает scrollY из Lenis (по ref) и раздаёт кадры подписчикам.
 * Должен быть внутри ReactLenis (root).
 */
export function LenisScrollProvider({ children }: LenisScrollProviderProps) {
  const listenersRef = useRef<Set<(y: number) => void>>(new Set());
  const lenisInstanceRef = useRef<LenisInstance | null>(null);
  const scrollYRef = useRef(0);

  // Колбэк для useLenis ОБЯЗАН быть стабильным: lenis/react держит callback в зависимостях эффекта
  // и синхронно зовёт callback(lenis) при регистрации; инлайн-стрелка с setState → new identity
  // каждый рендер → эффект перезапускается → setState → рендер → … (Maximum update depth).
  const handleFrame = useCallback((lenis: LenisInstance) => {
    lenisInstanceRef.current = lenis;
    const y = lenis.scroll;
    scrollYRef.current = y;
    listenersRef.current.forEach((cb) => cb(y));
  }, []);

  useLenis(handleFrame, [], -100);

  const registerScrollListener = useCallback((cb: (scrollY: number) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const stopScroll = useCallback(() => {
    lenisInstanceRef.current?.stop();
  }, []);

  // Фолбэк на нативный скролл нужен на первый кадр: инстанс появляется в ref только после первого
  // тика Lenis, а щёлкнуть по якорю можно и раньше.
  const scrollTo = useCallback((target: HTMLElement | number, options?: { offset?: number }) => {
    const lenis = lenisInstanceRef.current;

    if (lenis) {
      lenis.scrollTo(target, { offset: options?.offset ?? 0 });
      return;
    }

    const offset = options?.offset ?? 0;
    const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;

    window.scrollTo({ top: top + offset, behavior: 'smooth' });
  }, []);

  // Стабильное значение (identity не меняется на скролл): scrollY — геттер по ref.
  const value = useMemo<LenisScrollContextValue>(
    () => ({
      get scrollY() {
        return scrollYRef.current;
      },
      registerScrollListener,
      stopScroll,
      scrollTo,
    }),
    [registerScrollListener, scrollTo, stopScroll]
  );

  return (
    <LenisScrollContext.Provider value={value}>
      {children}
    </LenisScrollContext.Provider>
  );
}
