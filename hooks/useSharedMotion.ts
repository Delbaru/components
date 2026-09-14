'use client';

import { useCallback, type CSSProperties } from 'react';

import { useParallaxMotion, type ParallaxInput } from './useParallaxMotion';
import { usePerspective3dMotion, type Perspective3dInput } from './usePerspective3dMotion';

type MotionTarget = HTMLElement | SVGElement;

export interface SharedMotionProps {
  perspective3d?: Perspective3dInput;
  parallax?: ParallaxInput;
}

export function useSharedMotion({ perspective3d, parallax }: SharedMotionProps) {
  const {
    isEnabled: hasPerspective3d,
    motionHandlers,
    motionStyle: perspectiveStyle,
    setMotionNode: setPerspectiveNode,
    transformValue: perspectiveTransform,
  } = usePerspective3dMotion(perspective3d);

  const {
    isEnabled: hasParallax,
    motionStyle: parallaxStyle,
    setMotionNode: setParallaxNode,
    transformValue: parallaxTransform,
  } = useParallaxMotion(parallax);

  const motionTransform = [parallaxTransform, perspectiveTransform].filter(Boolean).join(' ');
  const hasMotion = hasPerspective3d || hasParallax;

  const motionStyle = hasMotion
    ? ({
        ...(perspectiveStyle ?? null),
        ...(parallaxStyle ?? null),
        ...(motionTransform
          ? {
              transform: motionTransform,
              ...(hasPerspective3d ? { transformStyle: 'preserve-3d' } : null),
              willChange: 'transform',
            }
          : null),
      } as CSSProperties)
    : undefined;

  // Оба вложенных setter'а стабильны, поэтому стабилен и общий — иначе ref-колбэк потребителя
  // менял бы идентичность каждый рендер и React передёргивал бы ref, сбрасывая моушен в ноль.
  const setMotionNode = useCallback((node: MotionTarget | null) => {
    setPerspectiveNode(node);
    setParallaxNode(node);
  }, [setPerspectiveNode, setParallaxNode]);

  return {
    hasMotion,
    motionHandlers,
    motionStyle,
    setMotionNode,
  };
}