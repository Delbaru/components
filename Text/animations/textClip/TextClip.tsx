'use client';
'use no memo';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import styles from './textClip.module.scss';

import { Flex } from '../../../Flex';
import type { TextAnimationContext } from '../types';
import type { TextClipOptions } from './types';

/**
 * Клип-смена шага: текущий шаг «срезается» сверху clip-path'ом, подменяется на новый и «открывается»
 * снизу. Высота сцены держится по самому высокому шагу (измеряется), шаги наложены через absolute.
 * Сцена — Flex (высота пропом); position/overflow/transition — в scss на токенах, длительность — CSS-var.
 */
export function TextClip({ options }: TextAnimationContext<TextClipOptions>) {
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [heights, setHeights] = useState<number[]>([]);
  const [displayedStep, setDisplayedStep] = useState(options?.currentStep ?? 0);
  const [clipPath, setClipPath] = useState('inset(0 0 0 0)');

  useEffect(() => {
    if (itemRefs.current.length === 0) return;
    setHeights(itemRefs.current.map((el) => el?.offsetHeight || 0));
  }, [options?.steps]);

  useEffect(() => {
    if (!options || displayedStep === options.currentStep) return undefined;

    const durationMs = (options.duration || 1) * 1000;
    const opts = options;
    const t = setTimeout(() => {
      setClipPath('inset(0 0 100% 0)');
      setTimeout(() => {
        setDisplayedStep(opts.currentStep);
        setClipPath('inset(100% 0 0 0)');
        setTimeout(() => {
          setClipPath('inset(0 0 0 0)');
        }, 0);
      }, durationMs);
    }, 0);

    return () => clearTimeout(t);
  }, [options?.currentStep, displayedStep, options]);

  if (!options) return null;

  const maxHeight = heights.length > 0 ? Math.max(...heights) : 0;
  // Измеренная высота — реальные px (h={число} ушёл бы в calc(N*rpx)), поэтому строкой.
  const height = maxHeight ? `${maxHeight}px` : options.clipHeight ?? 'auto';
  const stageStyle = {
    clipPath,
    '--clip-dur': options.duration ? `${options.duration}s` : undefined,
  } as CSSProperties;

  return (
    <Flex className={styles.clipStage} h={height} style={stageStyle}>
      {options.steps.map((step, index) => (
        <span
          key={step.slice(0, 60)}
          ref={(el) => { itemRefs.current[index] = el; }}
          className={styles.clipItem}
          style={{ opacity: index === displayedStep ? 1 : 0 }}
        >
          {step}
        </span>
      ))}
    </Flex>
  );
}
