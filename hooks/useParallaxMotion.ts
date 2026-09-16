'use client';

import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';

import { useLenisScrollOptional } from '../LenisScroll';
import { MEDIA_QUERY } from '../core/base/breakpoints';
import { clamp } from '../core/utils';

const PARALLAX_STYLE_PROPS = [
  '--parallax-translate-x',
  '--parallax-translate-y',
  '--parallax-transform',
] as const;

type MotionTarget = HTMLElement | SVGElement;

type MotionValues = {
  translateX: number;
  translateY: number;
};

export type ParallaxDirection = 'up' | 'down' | 'left' | 'right';
export type ParallaxScrollSource = 'auto' | 'lenis' | 'native';

export type ParallaxConfig = {
  direction?: ParallaxDirection;
  distance?: number;
  scroll?: ParallaxScrollSource;
  ease?: number;
};

export type ParallaxInput = number | ParallaxConfig;

type NormalizedParallaxConfig = {
  direction: ParallaxDirection;
  distance: number;
  scroll: ParallaxScrollSource;
  ease: number;
};

const DEFAULT_CONFIG: NormalizedParallaxConfig = {
  direction: 'up',
  distance: 72,
  scroll: 'auto',
  ease: 0.14,
};

const INITIAL_VALUES: MotionValues = {
  translateX: 0,
  translateY: 0,
};

function normalizeParallaxConfig(input: ParallaxInput | undefined): NormalizedParallaxConfig | null {
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input === 'number') {
    return {
      ...DEFAULT_CONFIG,
      distance: Math.abs(input),
    };
  }

  return {
    direction: input.direction ?? DEFAULT_CONFIG.direction,
    distance: Math.abs(input.distance ?? DEFAULT_CONFIG.distance),
    scroll: input.scroll ?? DEFAULT_CONFIG.scroll,
    ease: input.ease ?? DEFAULT_CONFIG.ease,
  };
}

function clearMotionStyles(node: MotionTarget | null) {
  if (!node) return;

  for (const prop of PARALLAX_STYLE_PROPS) {
    node.style.removeProperty(prop);
  }
}

function applyMotionValues(node: MotionTarget, values: MotionValues) {
  node.style.setProperty('--parallax-translate-x', `${values.translateX.toFixed(3)}px`);
  node.style.setProperty('--parallax-translate-y', `${values.translateY.toFixed(3)}px`);
}

function getDirectionAxis(direction: ParallaxDirection): 'x' | 'y' {
  return direction === 'left' || direction === 'right' ? 'x' : 'y';
}

function getDirectionSign(direction: ParallaxDirection): number {
  return direction === 'down' || direction === 'right' ? 1 : -1;
}

export function useParallaxMotion(parallax: ParallaxInput | undefined) {
  const lenisCtx = useLenisScrollOptional();
  const config = useMemo(() => normalizeParallaxConfig(parallax), [parallax]);
  const configRef = useRef(config);
  const nodeRef = useRef<MotionTarget | null>(null);
  const frameRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const currentRef = useRef<MotionValues>({ ...INITIAL_VALUES });
  const targetRef = useRef<MotionValues>({ ...INITIAL_VALUES });
  const isVisibleRef = useRef(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedRef = useRef<MotionTarget | null>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MEDIA_QUERY.reducedMotion);
    const updatePreference = () => {
      reducedMotionRef.current = mediaQuery.matches;
    };

    updatePreference();
    mediaQuery.addEventListener?.('change', updatePreference);

    return () => {
      mediaQuery.removeEventListener?.('change', updatePreference);
    };
  }, []);

  useEffect(() => {
    if (config) return undefined;

    targetRef.current = { ...INITIAL_VALUES };
    currentRef.current = { ...INITIAL_VALUES };

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    clearMotionStyles(nodeRef.current);
    return undefined;
  }, [config]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }

      observerRef.current?.disconnect();
      clearMotionStyles(nodeRef.current);
    };
  }, []);

  useEffect(() => {
    if (!config || typeof window === 'undefined') return undefined;

    const syncTargetFromViewport = () => {
      const node = nodeRef.current;
      const nextConfig = configRef.current;
      if (!node || !node.isConnected || !nextConfig) return;

      if (reducedMotionRef.current) {
        targetRef.current = { ...INITIAL_VALUES };
        scheduleAnimation();
        return;
      }

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (!viewportHeight || !rect.height) {
        targetRef.current = { ...INITIAL_VALUES };
        scheduleAnimation();
        return;
      }

      const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height), 0, 1);
      const centeredProgress = progress * 2 - 1;
      const offset = centeredProgress * nextConfig.distance * getDirectionSign(nextConfig.direction);

      targetRef.current = getDirectionAxis(nextConfig.direction) === 'x'
        ? { translateX: offset, translateY: 0 }
        : { translateX: 0, translateY: offset };

      scheduleAnimation();
    };

    const handleViewportChange = () => {
      syncTargetFromViewport();
    };

    window.addEventListener('resize', handleViewportChange);
    syncTargetFromViewport();

    const shouldUseLenis = config.scroll !== 'native' && Boolean(lenisCtx);

    if (shouldUseLenis && lenisCtx) {
      const unregister = lenisCtx.registerScrollListener(() => {
        syncTargetFromViewport();
      });

      return () => {
        unregister();
        window.removeEventListener('resize', handleViewportChange);
      };
    }

    window.addEventListener('scroll', handleViewportChange, { passive: true });

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange);
    };
  }, [config, lenisCtx]);

  // Стабильна по идентичности (deps: []) — работает только через ref'ы. От этого зависит
  // стабильность setMotionNode, см. комментарий там.
  const scheduleAnimation = useCallback(() => {
    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;

      const node = nodeRef.current;
      const nextConfig = configRef.current;
      if (!node || !nextConfig) return;

      if (!isVisibleRef.current) return;

      const nextValues: MotionValues = {
        translateX:
          currentRef.current.translateX + (targetRef.current.translateX - currentRef.current.translateX) * nextConfig.ease,
        translateY:
          currentRef.current.translateY + (targetRef.current.translateY - currentRef.current.translateY) * nextConfig.ease,
      };

      currentRef.current = nextValues;
      applyMotionValues(node, nextValues);

      const isSettled =
        Math.abs(targetRef.current.translateX - nextValues.translateX) < 0.05 &&
        Math.abs(targetRef.current.translateY - nextValues.translateY) < 0.05;

      if (!isSettled) {
        scheduleAnimation();
      }
    });
  }, []);

  /**
   * Наблюдатель нужен ТОЛЬКО включённому моушену: `useSharedMotion` зовёт почти каждый примитив
   * ДС, и без этой проверки страница без единого параллакса держала наблюдатель на КАЖДЫЙ узел.
   * Идемпотентна — повторный вызов с той же парой «узел + состояние конфига» ничего не пересоздаёт.
   */
  const syncObserver = useCallback(() => {
    const node = nodeRef.current;
    const wanted = node && configRef.current ? node : null;
    if (observedRef.current === wanted) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    observedRef.current = wanted;
    if (!wanted || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) scheduleAnimation();
      },
      { rootMargin: '100px' }
    );
    observer.observe(wanted);
    observerRef.current = observer;
  }, [scheduleAnimation]);

  /**
   * ВАЖНО: идентичность обязана быть стабильной — это ref-колбэк узла. React на смену идентичности
   * отцепляет ref (зовёт с null), то есть на КАЖДЫЙ ре-рендер потребителя сбрасывал бы накопленное
   * смещение. Внутри — только ref'ы и стабильная `syncObserver`.
   */
  const setMotionNode = useCallback((node: MotionTarget | null) => {
    nodeRef.current = node;
    syncObserver();

    if (!node) {
      targetRef.current = { ...INITIAL_VALUES };
      currentRef.current = { ...INITIAL_VALUES };
      isVisibleRef.current = false;
      return;
    }

    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const currentNode = nodeRef.current;
        if (!currentNode || currentNode !== node) return;

        const rect = currentNode.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        if (!viewportHeight || !rect.height) return;

        const nextConfig = configRef.current;
        if (!nextConfig) return;

        const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height), 0, 1);
        const centeredProgress = progress * 2 - 1;
        const offset = centeredProgress * nextConfig.distance * getDirectionSign(nextConfig.direction);

        targetRef.current = getDirectionAxis(nextConfig.direction) === 'x'
          ? { translateX: offset, translateY: 0 }
          : { translateX: 0, translateY: offset };

        scheduleAnimation();
      });
    }
  }, [syncObserver]);

  // Моушен могли включить пропом уже после монтирования — тогда наблюдатель заводится здесь.
  useEffect(() => {
    syncObserver();
  }, [config, syncObserver]);

  return {
    isEnabled: Boolean(config),
    motionStyle: config
      ? ({
          '--parallax-translate-x': '0px',
          '--parallax-translate-y': '0px',
          '--parallax-transform':
            'translate3d(var(--parallax-translate-x), var(--parallax-translate-y), 0px)',
        } as CSSProperties)
      : undefined,
    transformValue: config ? 'var(--parallax-transform)' : undefined,
    setMotionNode,
  };
}