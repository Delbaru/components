'use client';

import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type React from 'react';

import { clamp } from '../core/utils';

const MOTION_STYLE_PROPS = [
  '--perspective3d',
  '--perspective3d-rotate-x',
  '--perspective3d-rotate-y',
  '--perspective3d-translate-x',
  '--perspective3d-translate-y',
  '--perspective3d-scale',
  '--perspective3d-translate-z',
  '--perspective3d-transform',
] as const;

type MotionTarget = HTMLElement | SVGElement;

type MotionValues = {
  rotateX: number;
  rotateY: number;
  translateX: number;
  translateY: number;
  scale: number;
  translateZ: number;
};

function isPointInsideRect(rect: DOMRect, clientX: number, clientY: number): boolean {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

export type Perspective3dConfig = {
  perspective: number | string;
  follow?: 'element' | 'viewport';
  maxRotateX?: number;
  maxRotateY?: number;
  maxTranslateX?: number;
  maxTranslateY?: number;
  scale?: number;
  translateZ?: number;
  ease?: number;
  restEase?: number;
};

export type Perspective3dInput = number | string | Perspective3dConfig;

type NormalizedPerspective3dConfig = {
  perspective: string;
  follow: 'element' | 'viewport';
  maxRotateX: number;
  maxRotateY: number;
  maxTranslateX: number;
  maxTranslateY: number;
  scale: number;
  translateZ: number;
  ease: number;
  restEase: number;
};

const DEFAULT_CONFIG = {
  follow: 'element',
  maxRotateX: 10,
  maxRotateY: 12,
  maxTranslateX: 10,
  maxTranslateY: 10,
  scale: 1.02,
  translateZ: 0,
  ease: 0.16,
  restEase: 0.1,
} as const satisfies Omit<NormalizedPerspective3dConfig, 'perspective'>;

const INITIAL_VALUES: MotionValues = {
  rotateX: 0,
  rotateY: 0,
  translateX: 0,
  translateY: 0,
  scale: 1,
  translateZ: 0,
};

function formatPerspective(value: number | string): string {
  if (typeof value === 'number') {
    return `${value}px`;
  }

  const normalized = value.trim();
  return /^\d+(\.\d+)?$/.test(normalized) ? `${normalized}px` : normalized;
}

function normalizePerspective3dConfig(input: Perspective3dInput | undefined): NormalizedPerspective3dConfig | null {
  if (input === undefined || input === null || input === '') {
    return null;
  }

  if (typeof input === 'number' || typeof input === 'string') {
    return {
      perspective: formatPerspective(input),
      ...DEFAULT_CONFIG,
    };
  }

  return {
    perspective: formatPerspective(input.perspective),
    follow: input.follow ?? DEFAULT_CONFIG.follow,
    maxRotateX: input.maxRotateX ?? DEFAULT_CONFIG.maxRotateX,
    maxRotateY: input.maxRotateY ?? DEFAULT_CONFIG.maxRotateY,
    maxTranslateX: input.maxTranslateX ?? DEFAULT_CONFIG.maxTranslateX,
    maxTranslateY: input.maxTranslateY ?? DEFAULT_CONFIG.maxTranslateY,
    scale: input.scale ?? DEFAULT_CONFIG.scale,
    translateZ: input.translateZ ?? DEFAULT_CONFIG.translateZ,
    ease: input.ease ?? DEFAULT_CONFIG.ease,
    restEase: input.restEase ?? DEFAULT_CONFIG.restEase,
  };
}

function applyMotionValues(node: MotionTarget, values: MotionValues) {
  node.style.setProperty('--perspective3d-rotate-x', `${values.rotateX.toFixed(3)}deg`);
  node.style.setProperty('--perspective3d-rotate-y', `${values.rotateY.toFixed(3)}deg`);
  node.style.setProperty('--perspective3d-translate-x', `${values.translateX.toFixed(3)}px`);
  node.style.setProperty('--perspective3d-translate-y', `${values.translateY.toFixed(3)}px`);
  node.style.setProperty('--perspective3d-scale', values.scale.toFixed(4));
  node.style.setProperty('--perspective3d-translate-z', `${values.translateZ.toFixed(3)}px`);
}

function clearMotionStyles(node: MotionTarget | null) {
  if (!node) return;

  for (const prop of MOTION_STYLE_PROPS) {
    node.style.removeProperty(prop);
  }
}

export function usePerspective3dMotion(perspective3d: Perspective3dInput | undefined) {
  const config = useMemo(() => normalizePerspective3dConfig(perspective3d), [perspective3d]);
  const configRef = useRef(config);
  const nodeRef = useRef<MotionTarget | null>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const currentRef = useRef<MotionValues>({ ...INITIAL_VALUES });
  const targetRef = useRef<MotionValues>({ ...INITIAL_VALUES });
  const smoothedTargetRef = useRef<MotionValues>({ ...INITIAL_VALUES });
  const isVisibleRef = useRef(true);
  const isMobileRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedRef = useRef<MotionTarget | null>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
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
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mq = window.matchMedia('(pointer: coarse)');
    isMobileRef.current = mq.matches;
    const handler = () => { isMobileRef.current = mq.matches; };
    mq.addEventListener?.('change', handler);

    return () => {
      mq.removeEventListener?.('change', handler);
    };
  }, []);

  useEffect(() => {
    if (config) return undefined;

    activeRef.current = false;
    targetRef.current = { ...INITIAL_VALUES };
    smoothedTargetRef.current = { ...INITIAL_VALUES };
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

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotionRef.current || isMobileRef.current || !isVisibleRef.current) return;

      const node = nodeRef.current;
      const nextConfig = configRef.current;
      if (!node || !node.isConnected || !nextConfig) return;

      if (nextConfig.follow === 'viewport') {
        activeRef.current = true;
        updateTargetFromPointer(node, event.clientX, event.clientY, nextConfig.follow);
        scheduleAnimation();
        return;
      }

      const rect = node.getBoundingClientRect();
      const isInside = isPointInsideRect(rect, event.clientX, event.clientY);

      activeRef.current = isInside;

      if (isInside) {
        updateTargetFromPointer(node, event.clientX, event.clientY, nextConfig.follow);
      } else {
        targetRef.current = { ...INITIAL_VALUES };
      }

      scheduleAnimation();
    };

    const resetMotion = () => {
      activeRef.current = false;
      targetRef.current = { ...INITIAL_VALUES };
      scheduleAnimation();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', resetMotion);
    window.addEventListener('blur', resetMotion);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', resetMotion);
      window.removeEventListener('blur', resetMotion);
    };
  }, [config]);

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

      const targetEase = Math.min(nextConfig.ease * 3.5, 0.25);
      const smoothed = smoothedTargetRef.current;
      const raw = targetRef.current;
      smoothedTargetRef.current = {
        rotateX: smoothed.rotateX + (raw.rotateX - smoothed.rotateX) * targetEase,
        rotateY: smoothed.rotateY + (raw.rotateY - smoothed.rotateY) * targetEase,
        translateX: smoothed.translateX + (raw.translateX - smoothed.translateX) * targetEase,
        translateY: smoothed.translateY + (raw.translateY - smoothed.translateY) * targetEase,
        scale: smoothed.scale + (raw.scale - smoothed.scale) * targetEase,
        translateZ: smoothed.translateZ + (raw.translateZ - smoothed.translateZ) * targetEase,
      };

      const ease = activeRef.current ? nextConfig.ease : nextConfig.restEase;
      const st = smoothedTargetRef.current;
      const nextValues: MotionValues = {
        rotateX: currentRef.current.rotateX + (st.rotateX - currentRef.current.rotateX) * ease,
        rotateY: currentRef.current.rotateY + (st.rotateY - currentRef.current.rotateY) * ease,
        translateX: currentRef.current.translateX + (st.translateX - currentRef.current.translateX) * ease,
        translateY: currentRef.current.translateY + (st.translateY - currentRef.current.translateY) * ease,
        scale: currentRef.current.scale + (st.scale - currentRef.current.scale) * ease,
        translateZ: currentRef.current.translateZ + (st.translateZ - currentRef.current.translateZ) * ease,
      };

      currentRef.current = nextValues;
      applyMotionValues(node, nextValues);

      const isSettled =
        Math.abs(raw.rotateX - nextValues.rotateX) < 0.01 &&
        Math.abs(raw.rotateY - nextValues.rotateY) < 0.01 &&
        Math.abs(raw.translateX - nextValues.translateX) < 0.05 &&
        Math.abs(raw.translateY - nextValues.translateY) < 0.05 &&
        Math.abs(raw.scale - nextValues.scale) < 0.001 &&
        Math.abs(raw.translateZ - nextValues.translateZ) < 0.05;

      if (!isSettled) {
        scheduleAnimation();
      }
    });
  }, []);

  const updateTargetFromPointer = useCallback((
    node: MotionTarget,
    clientX: number,
    clientY: number,
    follow: 'element' | 'viewport',
  ) => {
    const nextConfig = configRef.current;
    if (!nextConfig) return;

    let ratioX = 0;
    let ratioY = 0;

    if (follow === 'viewport') {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      if (!viewportWidth || !viewportHeight) return;

      ratioX = (clientX / viewportWidth) * 2 - 1;
      ratioY = (clientY / viewportHeight) * 2 - 1;
    } else {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      ratioX = ((clientX - rect.left) / rect.width) * 2 - 1;
      ratioY = ((clientY - rect.top) / rect.height) * 2 - 1;
    }

    targetRef.current = {
      rotateX: clamp(-ratioY, -1, 1) * nextConfig.maxRotateX,
      rotateY: clamp(ratioX, -1, 1) * nextConfig.maxRotateY,
      translateX: clamp(ratioX, -1, 1) * nextConfig.maxTranslateX,
      translateY: clamp(ratioY, -1, 1) * nextConfig.maxTranslateY,
      scale: nextConfig.scale,
      translateZ: nextConfig.translateZ,
    };
  }, []);

  const motionHandlers = config && config.follow === 'element'
    ? {
        onMouseEnter: (event: React.MouseEvent<MotionTarget>) => {
          if (reducedMotionRef.current) return;

          nodeRef.current = event.currentTarget;
          activeRef.current = true;
          updateTargetFromPointer(event.currentTarget, event.clientX, event.clientY, 'element');
          scheduleAnimation();
        },
        onMouseMove: (event: React.MouseEvent<MotionTarget>) => {
          if (reducedMotionRef.current) return;

          nodeRef.current = event.currentTarget;
          updateTargetFromPointer(event.currentTarget, event.clientX, event.clientY, 'element');
          scheduleAnimation();
        },
        onMouseLeave: (event: React.MouseEvent<MotionTarget>) => {
          if (reducedMotionRef.current) return;

          nodeRef.current = event.currentTarget;
          activeRef.current = false;
          targetRef.current = { ...INITIAL_VALUES };
          scheduleAnimation();
        },
      }
    : undefined;

  const motionStyle = config
    ? ({
        '--perspective3d': config.perspective,
        '--perspective3d-rotate-x': '0deg',
        '--perspective3d-rotate-y': '0deg',
        '--perspective3d-translate-x': '0px',
        '--perspective3d-translate-y': '0px',
        '--perspective3d-scale': '1',
        '--perspective3d-translate-z': '0px',
        '--perspective3d-transform':
          'perspective(var(--perspective3d)) translate3d(var(--perspective3d-translate-x), var(--perspective3d-translate-y), var(--perspective3d-translate-z)) rotateX(var(--perspective3d-rotate-x)) rotateY(var(--perspective3d-rotate-y)) scale(var(--perspective3d-scale))',
      } as CSSProperties)
    : undefined;

  /**
   * Наблюдатель нужен ТОЛЬКО включённому моушену: `useSharedMotion` зовёт почти каждый примитив
   * ДС, и без этой проверки страница без единого 3D-узла держала наблюдатель на КАЖДЫЙ узел.
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
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) scheduleAnimation();
      },
      { rootMargin: '100px' }
    );
    observer.observe(wanted);
    observerRef.current = observer;
  }, [scheduleAnimation]);

  /**
   * ВАЖНО: идентичность обязана быть стабильной. Это ref-колбэк узла, и React на смену
   * идентичности отцепляет ref (зовёт с null) и цепляет заново — то есть на КАЖДЫЙ ре-рендер
   * потребителя обнулял бы накопленный наклон. Внутри — только ref'ы и стабильная `syncObserver`.
   */
  const setMotionNode = useCallback((node: MotionTarget | null) => {
    nodeRef.current = node;
    syncObserver();

    if (!node) {
      activeRef.current = false;
      targetRef.current = { ...INITIAL_VALUES };
      smoothedTargetRef.current = { ...INITIAL_VALUES };
      currentRef.current = { ...INITIAL_VALUES };
      isVisibleRef.current = false;
    }
  }, [syncObserver]);

  // Моушен могли включить пропом уже после монтирования — тогда наблюдатель заводится здесь.
  useEffect(() => {
    syncObserver();
  }, [config, syncObserver]);

  return {
    isEnabled: Boolean(config),
    motionHandlers,
    motionStyle,
    transformValue: config ? 'var(--perspective3d-transform)' : undefined,
    setMotionNode,
  };
}