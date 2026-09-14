import { cloneElement, isValidElement } from 'react';
import type React from 'react';
import type { Swiper as SwiperInstance } from 'swiper';

import type { CarouselApi, CarouselApiRef, CarouselNavigationState, SlidesPerViewValue } from './types';

// Раскладка слайдов без состояния: видно ли прокрутку, нужен ли повтор для петли, какая страница активна.

export const DEFAULT_NAVIGATION_STATE: CarouselNavigationState = {
  isBeginning: true,
  isEnd: true,
  prevDisabled: true,
  nextDisabled: true,
};

export function assignCarouselApiRef(apiRef: CarouselApiRef | undefined, value: CarouselApi | null): void {
  if (!apiRef) return;

  if (typeof apiRef === 'function') {
    apiRef(value);
    return;
  }

  apiRef.current = value;
}

export function hasScrollableSlides(slideCount: number, slidesPerView: SlidesPerViewValue): boolean {
  if (slideCount <= 1) return false;
  if (slidesPerView === 'auto') return true;
  return slideCount > slidesPerView;
}

export function canEnableLoop(slideCount: number, slidesPerView: SlidesPerViewValue): boolean {
  if (!hasScrollableSlides(slideCount, slidesPerView)) return false;
  if (slidesPerView === 'auto') return slideCount > 1;
  return slideCount >= Math.ceil(slidesPerView) + 1;
}

function getMinimumLoopSlideCount(slidesPerView: SlidesPerViewValue): number {
  if (slidesPerView === 'auto') return 3;
  return Math.max(3, Math.ceil(slidesPerView) * 2 + 1);
}

function getSlideSpanPx(containerWidthPx: number, slidesPerView: SlidesPerViewValue, gapPx: number): number {
  if (containerWidthPx <= 0 || slidesPerView === 'auto' || slidesPerView <= 0) return 0;

  const totalGapPx = Math.max(slidesPerView - 1, 0) * gapPx;
  const slideWidthPx = (containerWidthPx - totalGapPx) / slidesPerView;

  return Number.isFinite(slideWidthPx) && slideWidthPx > 0 ? slideWidthPx : 0;
}

export function getPeekOffsetPx(containerWidthPx: number, slidesPerView: SlidesPerViewValue, gapPx: number, peekValue: number): number {
  if (peekValue <= 0) return 0;

  const slideSpanPx = getSlideSpanPx(containerWidthPx, slidesPerView, gapPx);
  if (slideSpanPx <= 0) return 0;

  const wholeSlides = Math.floor(peekValue);
  const hasFraction = peekValue - wholeSlides > 0;
  const gapCount = Math.max(wholeSlides + (hasFraction ? 1 : 0) - 1, 0);

  return slideSpanPx * peekValue + gapPx * gapCount;
}

function cloneLoopSlide(slide: React.ReactNode, originalIndex: number, isInteractive: boolean): React.ReactNode {
  if (!isValidElement(slide)) return slide;

  const nextProps: Record<string, unknown> = {};
  if (!isInteractive) {
    nextProps['data-carousel-loop-clone'] = 'true';

    const slideProps = slide.props as Record<string, unknown>;
    const fancyboxGroup = typeof slideProps.fancybox === 'string' ? slideProps.fancybox : null;

    if (fancyboxGroup) {
      nextProps['data-fancybox-delegate'] = fancyboxGroup;
      nextProps['data-fancybox-index'] = String(originalIndex);
      nextProps.fancybox = undefined;
    }
  }

  return cloneElement(slide, nextProps);
}

export function buildLoopSlides(
  slides: React.ReactNode[],
  slidesPerView: SlidesPerViewValue
): { renderedSlides: React.ReactNode[]; initialSlideOffset: number; middleCycleIndex: number; usesPaddedLoop: boolean } {
  if (!hasScrollableSlides(slides.length, slidesPerView)) {
    return {
      renderedSlides: slides,
      initialSlideOffset: 0,
      middleCycleIndex: 0,
      usesPaddedLoop: false,
    };
  }

  const minimumLoopSlideCount = getMinimumLoopSlideCount(slidesPerView);
  if (slides.length >= minimumLoopSlideCount) {
    return {
      renderedSlides: slides,
      initialSlideOffset: 0,
      middleCycleIndex: 0,
      usesPaddedLoop: false,
    };
  }

  const repeatCount = 5;
  const middleCycleIndex = Math.floor(repeatCount / 2);
  const renderedSlides = Array.from({ length: repeatCount }, (_, cycleIndex) => slides.map((slide, originalIndex) => cloneLoopSlide(slide, originalIndex, cycleIndex === middleCycleIndex))).flat();

  return {
    renderedSlides,
    initialSlideOffset: slides.length * middleCycleIndex,
    middleCycleIndex,
    usesPaddedLoop: true,
  };
}

export function getLogicalSlideIndex(swiper: SwiperInstance | null, slideCount: number, loopEnabled: boolean): number {
  if (!swiper || slideCount <= 0) return 0;

  const rawIndex = loopEnabled ? swiper.realIndex : swiper.activeIndex;
  return ((rawIndex % slideCount) + slideCount) % slideCount;
}

function getFallbackPageCount(slideCount: number, slidesPerView: SlidesPerViewValue): number {
  if (slideCount <= 0) return 0;
  if (slidesPerView === 'auto') return slideCount;

  return Math.max(slideCount - Math.ceil(slidesPerView) + 1, 1);
}

export function getPaginationState(
  swiper: SwiperInstance | null,
  slideCount: number,
  slidesPerView: SlidesPerViewValue,
  loopEnabled: boolean,
  usesPaddedLoop: boolean
): { pageIndex: number; pageCount: number } {
  if (slideCount <= 0) {
    return { pageIndex: 0, pageCount: 0 };
  }

  if (loopEnabled || usesPaddedLoop) {
    return {
      pageIndex: getLogicalSlideIndex(swiper, slideCount, loopEnabled),
      pageCount: slideCount,
    };
  }

  const fallbackPageCount = getFallbackPageCount(slideCount, slidesPerView);
  const rawPageCount = swiper?.snapGrid?.length ?? fallbackPageCount;
  const pageCount = Math.max(Math.min(rawPageCount, slideCount), 1);
  const rawPageIndex = typeof swiper?.snapIndex === 'number'
    ? swiper.snapIndex
    : Math.min(getLogicalSlideIndex(swiper, slideCount, false), pageCount - 1);

  return {
    pageIndex: Math.max(Math.min(rawPageIndex, pageCount - 1), 0),
    pageCount,
  };
}
