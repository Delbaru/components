'use client';

import { useId } from 'react';

import styles from './CarouselDots.module.scss';

import { useNearestCarouselControls } from '../../Carousel/controls';
import { Button } from '../../Button';
import { Flex } from '../../Flex';
import { cx } from '../../core';

export type CarouselDotsProps = {
  className?: string;
  carouselId?: string;
};

export function CarouselDots({ className, carouselId }: CarouselDotsProps) {
  const baseId = useId().replace(/:/g, '');
  const { setRootRef, snapshot } = useNearestCarouselControls(carouselId);
  const shouldRender = snapshot.showDots && snapshot.pageCount > 1;

  return (
    <Flex
      ref={setRootRef}
      dir={['row', null, null]}
      align={['center', null, null]}
      justify={['center', null, null]}
      gap={[8, null, null]}
      className={cx(styles.CarouselDots, className)}
      data-carousel-dots
    >
      {shouldRender
        ? Array.from({ length: snapshot.pageCount }, (_, index) => {
          const isActive = index === snapshot.pageIndex;
          const dotId = `${baseId}-dot-${index}`;

          return (
            <Button
              key={dotId}
              id={dotId}
              className={styles.dot}
              state={isActive ? 'active' : undefined}
              linkState={isActive ? undefined : dotId}
              aria-label={`Перейти к слайду ${index + 1}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => snapshot.api?.goTo(index)}
            />
          );
        })
        : null}
    </Flex>
  );
}