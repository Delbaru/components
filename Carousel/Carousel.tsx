'use client';

import { Swiper as SwiperRoot, SwiperSlide } from 'swiper/react';

import styles from './Carousel.module.scss';
import { createLayoutClasses, cx, stateLinkProps, type ResponsiveValue, type WithRef } from '../core';
import type { CarouselProps } from './types';
import { useCarousel } from './useCarousel';

const DRAG_START_THRESHOLD_PX = 6;

const c = createLayoutClasses(styles);

/**
 * Swiper adapter that preserves the current shared Carousel API and markup hooks.
 *
 * Live call sites currently use `gap`, `slidesPerView`, `loop`, `apiRef` and
 * `onNavigationStateChange`, so the adapter keeps that contract and removes the
 * custom drag/inertia implementation.
 */
export function Carousel({
  ref,
  children,
  carouselId: explicitCarouselId,
  gap,
  slidesPerView = [1, 1, 1],
  aspectRatio,
  w,
  minW,
  maxW,
  h,
  minH,
  maxH,
  grow,
  orientation = ['horizontal', 'horizontal', 'horizontal'],
  effect = ['slide', 'slide', 'slide'],
  navigation,
  pagination,
  autoplay,
  mousewheel = [false, false, false],
  drag = [true, true, true],
  initialSlide = [0, 0, 0],
  loop = [false, false, false],
  centeredSlides = [false, false, false],
  offsetBefore,
  offsetAfter,
  peekStart,
  peekEnd,
  speed = [300, 300, 300],
  inertia,
  padding,
  justify,
  align,
  slideClassName,
  wrapperClassName,
  paginationClassName,
  navigationClassName,
  className,
  style,
  scrollBased = false,
  scrollProgress,
  linkState,
  perspective3d,
  parallax,
  apiRef,
  onNavigationStateChange,
  onMouseEnter,
  onMouseLeave,
  ...props
}: WithRef<CarouselProps, HTMLDivElement>) {
  'use no memo';

  const {
    carouselId, setRootRefs, motionHandlers, motionStyle, slidesPerViewKey, swiperKey, modules,
    handleSwiper, handleSwiperUpdate, handleSwiperTransitionEnd, autoplayConfig, renderedSlides,
    currentDrag, currentOrientation, currentCenteredSlides, currentInitialSlide, loopEnabled,
    currentMousewheel, currentSlidesPerView, currentOffsetAfterPx, currentOffsetBeforePx,
    currentGapPx, currentSpeed,
  } = useCarousel(ref, {
    children, carouselId: explicitCarouselId, slidesPerView, orientation, effect, navigation, pagination,
    autoplay, mousewheel, drag, initialSlide, loop, centeredSlides, offsetBefore, offsetAfter, peekStart,
    peekEnd, speed, scrollBased, perspective3d, parallax, apiRef, onNavigationStateChange,
  });

  void scrollProgress;
  void inertia;
  void paginationClassName;
  void navigationClassName;

  const slidesPerViewClasses = c.key('slides-per-view', slidesPerViewKey as ResponsiveValue<string>, (key) => key);

  return (
    <div
      ref={setRootRefs}
      data-carousel-root
      data-carousel-id={carouselId}
      data-scroll-based={scrollBased ? 'true' : 'false'}
      {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
      className={cx(
        styles.Root,
        ...c.value('gap', gap),
        ...c.value('p', padding),
        ...c.value('w', w),
        ...c.value('minW', minW),
        ...c.value('maxW', maxW),
        ...c.value('h', h),
        ...c.value('minH', minH),
        ...c.value('maxH', maxH),
        ...c.value('ratio', aspectRatio),
        ...c.value('grow', grow),
        ...slidesPerViewClasses,
        className
      )}
      style={{
        ...(motionStyle ?? null),
        ...style,
      }}
      {...props}
    >
      <SwiperRoot
        key={swiperKey}
        modules={modules}
        className={cx(styles.wrapper, wrapperClassName)}
        onSwiper={handleSwiper}
        onSlideChange={handleSwiperUpdate}
        onResize={handleSwiperUpdate}
        onBreakpoint={handleSwiperUpdate}
        onLock={handleSwiperUpdate}
        onUnlock={handleSwiperUpdate}
        onReachBeginning={handleSwiperUpdate}
        onReachEnd={handleSwiperUpdate}
        onFromEdge={handleSwiperUpdate}
        onSlideChangeTransitionEnd={handleSwiperTransitionEnd}
        a11y={{
          enabled: true,
          prevSlideMessage: 'Предыдущий слайд',
          nextSlideMessage: 'Следующий слайд',
        }}
        allowTouchMove={currentDrag}
        autoplay={autoplayConfig}
        direction={currentOrientation}
        grabCursor={false}
        centeredSlides={currentCenteredSlides}
        initialSlide={currentInitialSlide}
        loop={loopEnabled}
        mousewheel={currentMousewheel ? { forceToAxis: true, releaseOnEdges: !loopEnabled } : false}
        noSwipingSelector='button, input, textarea, select, option, label, summary, [role="button"], [data-carousel-no-drag]'
        observeParents
        observer
        preventClicks
        preventClicksPropagation
        resizeObserver
        simulateTouch={currentDrag}
        slidesPerView={currentSlidesPerView}
        slidesOffsetAfter={currentOffsetAfterPx}
        slidesOffsetBefore={currentOffsetBeforePx}
        spaceBetween={currentGapPx}
        speed={currentSpeed}
        threshold={DRAG_START_THRESHOLD_PX}
        touchStartPreventDefault={currentDrag}
        watchOverflow
      >
        {renderedSlides.map((slide, index) => (
          <SwiperSlide
            key={`slide-${index}`}
            className={cx(
              styles.slide,
              ...c.value('justify', justify),
              ...c.value('align', align),
              slideClassName
            )}
          >
            {slide}
          </SwiperSlide>
        ))}
      </SwiperRoot>
    </div>
  );
}
