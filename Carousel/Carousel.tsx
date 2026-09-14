'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type React from 'react';
import type { Swiper as SwiperInstance } from 'swiper';
import { A11y, Autoplay, Mousewheel } from 'swiper/modules';
import { Swiper as SwiperRoot, SwiperSlide } from 'swiper/react';

import styles from './Carousel.module.scss';
import { publishCarouselControlsSnapshot, resetCarouselControlsSnapshot } from './controls';
import {
  aspectRatioStyle,
  createLayoutClasses,
  cx,
  getBreakpointIndex,
  growStyle,
  inlineAspectRatioClassName,
  inlineGrowClassName,
  inlineSizeStyle,
  needsInlineAspectRatio,
  needsInlineGrow,
  resolveResponsive,
  resolveResponsiveAtBreakpoint,
  stateLinkProps,
  tokenStyles,
  type ResponsiveValue,
} from '../core';
import { useSharedMotion } from '../hooks/useSharedMotion';
import type {
  CarouselApi,
  CarouselApiRef,
  CarouselNavigationState,
  CarouselProps,
  SlidesPerViewValue,
} from './types';
import type { WithRef } from '../core';

const DRAG_START_THRESHOLD_PX = 6;
const DEFAULT_NAVIGATION_STATE: CarouselNavigationState = {
  isBeginning: true,
  isEnd: true,
  prevDisabled: true,
  nextDisabled: true,
};

function assignCarouselApiRef(apiRef: CarouselApiRef | undefined, value: CarouselApi | null): void {
  if (!apiRef) return;

  if (typeof apiRef === 'function') {
    apiRef(value);
    return;
  }

  apiRef.current = value;
}

function hasScrollableSlides(slideCount: number, slidesPerView: SlidesPerViewValue): boolean {
  if (slideCount <= 1) return false;
  if (slidesPerView === 'auto') return true;
  return slideCount > slidesPerView;
}

function canEnableLoop(slideCount: number, slidesPerView: SlidesPerViewValue): boolean {
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

function getPeekOffsetPx(containerWidthPx: number, slidesPerView: SlidesPerViewValue, gapPx: number, peekValue: number): number {
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

function buildLoopSlides(
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

function getLogicalSlideIndex(swiper: SwiperInstance | null, slideCount: number, loopEnabled: boolean): number {
  if (!swiper || slideCount <= 0) return 0;

  const rawIndex = loopEnabled ? swiper.realIndex : swiper.activeIndex;
  return ((rawIndex % slideCount) + slideCount) % slideCount;
}

function getFallbackPageCount(slideCount: number, slidesPerView: SlidesPerViewValue): number {
  if (slideCount <= 0) return 0;
  if (slidesPerView === 'auto') return slideCount;

  return Math.max(slideCount - Math.ceil(slidesPerView) + 1, 1);
}

function getPaginationState(
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
  slidesPerView = 1,
  aspectRatio,
  w,
  minW,
  maxW,
  h,
  minH,
  maxH,
  grow,
  orientation = 'horizontal',
  effect = 'slide',
  navigation,
  pagination,
  autoplay,
  mousewheel = false,
  drag = true,
  initialSlide = 0,
  loop = false,
  centeredSlides = false,
  offsetBefore,
  offsetAfter,
  peekStart,
  peekEnd,
  speed = 300,
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

  const c = createLayoutClasses([styles, tokenStyles]);
  const slides = useMemo(() => Children.toArray(children), [children]);
  const generatedCarouselId = useId().replace(/:/g, '');
  const carouselId = explicitCarouselId ?? generatedCarouselId;

  const [breakpointIndex, setBreakpointIndex] = useState<0 | 1 | 2>(0);
  const [currentGapPx, setCurrentGapPx] = useState(0);
  const [currentContainerWidthPx, setCurrentContainerWidthPx] = useState(0);
  const [currentSlidesPerView, setCurrentSlidesPerView] = useState<SlidesPerViewValue>(() => {
    if (slidesPerView === undefined) return 1;
    return (resolveResponsive(slidesPerView)[0] ?? 1) as SlidesPerViewValue;
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const swiperRef = useRef<SwiperInstance | null>(null);
  const lastNavigationStateRef = useRef<CarouselNavigationState | null>(null);
  const lastActiveIndexRef = useRef(0);
  const carouselApiInternalRef = useRef<CarouselApi>({
    prev: () => undefined,
    next: () => undefined,
    goTo: () => undefined,
    getNavigationState: () => DEFAULT_NAVIGATION_STATE,
  });
  const onNavigationStateChangeRef = useRef(onNavigationStateChange);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });

  onNavigationStateChangeRef.current = onNavigationStateChange;

  void scrollProgress;
  void inertia;
  void paginationClassName;
  void navigationClassName;

  const slidesPerViewKey = useMemo(() => {
    const toKey = (value: number | 'auto') => {
      if (value === 'auto') return 'auto';
      const stringValue = String(value);
      return stringValue.includes('.') ? stringValue.replace('.', '-') : stringValue;
    };

    if (Array.isArray(slidesPerView)) {
      return slidesPerView.map((value) => (value === null || value === undefined ? null : toKey(value as number | 'auto')));
    }

    return toKey(slidesPerView as number | 'auto');
  }, [slidesPerView]);

  const slidesPerViewClasses = useMemo(() => {
    const keyFn = (key: string) => key;
    return c.key('slides-per-view', slidesPerViewKey as ResponsiveValue<string>, keyFn);
  }, [c, slidesPerViewKey]);

  const measureResponsiveValues = useCallback(() => {
    if (typeof window === 'undefined') return;
    const rootNode = rootRef.current;
    if (!rootNode) return;

    const layoutViewportWidth = rootNode.ownerDocument.documentElement.clientWidth || window.innerWidth;

    setBreakpointIndex(getBreakpointIndex(layoutViewportWidth));

    const computed = window.getComputedStyle(rootNode);
    const gapPx = parseFloat(computed.gap || '0');
    setCurrentGapPx(Number.isFinite(gapPx) ? gapPx : 0);
    setCurrentContainerWidthPx(rootNode.clientWidth);

    const rawSlidesPerView = (computed.getPropertyValue('--slides-per-view') || '1').trim();
    if (rawSlidesPerView === 'auto') {
      setCurrentSlidesPerView('auto');
      return;
    }

    const parsedSlidesPerView = Number(rawSlidesPerView.replace('-', '.'));
    setCurrentSlidesPerView(Number.isFinite(parsedSlidesPerView) && parsedSlidesPerView > 0 ? parsedSlidesPerView : 1);
  }, []);

  useLayoutEffect(() => {
    measureResponsiveValues();

    const node = rootRef.current;
    if (!node || typeof window === 'undefined') return;

    const resizeObserver = new ResizeObserver(measureResponsiveValues);
    resizeObserver.observe(node);
    window.addEventListener('resize', measureResponsiveValues);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureResponsiveValues);
    };
  }, [measureResponsiveValues, slidesPerViewClasses, slides.length]);

  const currentOrientation = resolveResponsiveAtBreakpoint(orientation, 'horizontal', breakpointIndex);
  const currentMousewheel = resolveResponsiveAtBreakpoint(mousewheel, false, breakpointIndex);
  const currentDrag = !scrollBased && resolveResponsiveAtBreakpoint(drag, true, breakpointIndex);
  const requestedInitialSlide = resolveResponsiveAtBreakpoint(initialSlide, 0, breakpointIndex);
  const currentSpeed = resolveResponsiveAtBreakpoint(speed, 300, breakpointIndex);
  const requestedLoop = resolveResponsiveAtBreakpoint(loop, false, breakpointIndex);
  const currentCenteredSlides = resolveResponsiveAtBreakpoint(centeredSlides, false, breakpointIndex);
  const currentOffsetBefore = resolveResponsiveAtBreakpoint(offsetBefore, 0, breakpointIndex);
  const currentOffsetAfter = resolveResponsiveAtBreakpoint(offsetAfter, 0, breakpointIndex);
  const currentPeekStart = resolveResponsiveAtBreakpoint(peekStart, 0, breakpointIndex);
  const currentPeekEnd = resolveResponsiveAtBreakpoint(peekEnd, 0, breakpointIndex);
  const requestedEffect = resolveResponsiveAtBreakpoint(effect, 'slide', breakpointIndex);
  const currentNavigation = resolveResponsiveAtBreakpoint(navigation, 'none', breakpointIndex);
  const currentPagination = resolveResponsiveAtBreakpoint(pagination, false, breakpointIndex);
  const currentOffsetBeforePx = currentOffsetBefore + getPeekOffsetPx(currentContainerWidthPx, currentSlidesPerView, currentGapPx, currentPeekStart);
  const currentOffsetAfterPx = currentOffsetAfter + getPeekOffsetPx(currentContainerWidthPx, currentSlidesPerView, currentGapPx, currentPeekEnd);
  const swiperEffect = requestedEffect === 'slide' ? 'slide' : 'slide';
  const { renderedSlides, initialSlideOffset, middleCycleIndex, usesPaddedLoop } = useMemo(() => {
    if (!requestedLoop) {
      return {
        renderedSlides: slides,
        initialSlideOffset: 0,
        middleCycleIndex: 0,
        usesPaddedLoop: false,
      };
    }

    return buildLoopSlides(slides, currentSlidesPerView);
  }, [currentSlidesPerView, requestedLoop, slides]);
  const currentInitialSlide = renderedSlides.length > 0
    ? Math.min(
      Math.max(requestedInitialSlide, 0) + initialSlideOffset,
      renderedSlides.length - 1
    )
    : 0;
  const loopEnabled = requestedLoop && !usesPaddedLoop && canEnableLoop(renderedSlides.length, currentSlidesPerView);
  const hasScrollableContent = hasScrollableSlides(slides.length, currentSlidesPerView);
  const showNavigation = hasScrollableContent && (currentNavigation === 'arrows' || currentNavigation === 'both');
  const showDots = hasScrollableContent && (currentPagination || currentNavigation === 'dots' || currentNavigation === 'both');
  const [navigationState, setNavigationState] = useState<CarouselNavigationState>(DEFAULT_NAVIGATION_STATE);
  const [activeIndex, setActiveIndex] = useState(() => {
    if (slides.length <= 0) return 0;
    return ((requestedInitialSlide % slides.length) + slides.length) % slides.length;
  });

  const autoplayConfig = useMemo(() => {
    if (!autoplay) return false;
    if (autoplay === true) {
      return {
        delay: 3000,
        disableOnInteraction: true,
        pauseOnMouseEnter: true,
      };
    }

    return {
      delay: autoplay.delay ?? 3000,
      disableOnInteraction: autoplay.disableOnInteraction ?? true,
      pauseOnMouseEnter: true,
    };
  }, [autoplay]);

  const modules = useMemo(() => {
    const activeModules = [A11y];

    if (autoplayConfig) activeModules.push(Autoplay);
    if (currentMousewheel) activeModules.push(Mousewheel);

    return activeModules;
  }, [autoplayConfig, currentMousewheel]);

  const getNavigationState = useCallback((swiper: SwiperInstance | null): CarouselNavigationState => {
    if (!swiper || !hasScrollableSlides(slides.length, currentSlidesPerView)) {
      return DEFAULT_NAVIGATION_STATE;
    }

    if (loopEnabled || usesPaddedLoop) {
      return {
        isBeginning: false,
        isEnd: false,
        prevDisabled: false,
        nextDisabled: false,
      };
    }

    return {
      isBeginning: swiper.isBeginning,
      isEnd: swiper.isEnd,
      prevDisabled: swiper.isBeginning,
      nextDisabled: swiper.isEnd,
    };
  }, [currentSlidesPerView, loopEnabled, slides.length, usesPaddedLoop]);

  const publishActiveIndex = useCallback((swiper: SwiperInstance | null, force = false) => {
    const nextIndex = getLogicalSlideIndex(swiper, slides.length, loopEnabled);

    if (!force && lastActiveIndexRef.current === nextIndex) return;

    lastActiveIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }, [loopEnabled, slides.length]);

  const normalizePaddedLoopPosition = useCallback((swiper: SwiperInstance | null) => {
    if (!swiper || !usesPaddedLoop || slides.length === 0) return;

    const leftBoundary = slides.length * middleCycleIndex;
    const rightBoundary = slides.length * (middleCycleIndex + 1);

    if (swiper.activeIndex < leftBoundary) {
      swiper.slideTo(swiper.activeIndex + slides.length, 0, false);
      return;
    }

    if (swiper.activeIndex >= rightBoundary) {
      swiper.slideTo(swiper.activeIndex - slides.length, 0, false);
    }
  }, [middleCycleIndex, slides.length, usesPaddedLoop]);

  const publishNavigationState = useCallback((swiper: SwiperInstance | null, force = false) => {
    const nextState = getNavigationState(swiper);
    const previousState = lastNavigationStateRef.current;
    const isSameState = previousState
      && previousState.isBeginning === nextState.isBeginning
      && previousState.isEnd === nextState.isEnd
      && previousState.prevDisabled === nextState.prevDisabled
      && previousState.nextDisabled === nextState.nextDisabled;

    if (!force && isSameState) return;

    lastNavigationStateRef.current = nextState;
    setNavigationState(nextState);
    onNavigationStateChangeRef.current?.(nextState);
  }, [getNavigationState]);

  const prev = useCallback(() => {
    swiperRef.current?.slidePrev(currentSpeed);
  }, [currentSpeed]);

  const next = useCallback(() => {
    swiperRef.current?.slideNext(currentSpeed);
  }, [currentSpeed]);

  const goTo = useCallback((index: number) => {
    const swiper = swiperRef.current;
    if (!swiper || slides.length === 0) return;

    if (loopEnabled && typeof swiper.slideToLoop === 'function') {
      swiper.slideToLoop(index, currentSpeed);
      return;
    }

    const targetIndex = usesPaddedLoop
      ? index + slides.length * middleCycleIndex
      : index;

    swiper.slideTo(targetIndex, currentSpeed);
  }, [currentSpeed, loopEnabled, middleCycleIndex, slides.length, usesPaddedLoop]);

  carouselApiInternalRef.current.prev = prev;
  carouselApiInternalRef.current.next = next;
  carouselApiInternalRef.current.goTo = goTo;
  carouselApiInternalRef.current.getNavigationState = () => getNavigationState(swiperRef.current);

  useEffect(() => {
    const paginationState = getPaginationState(
      swiperRef.current,
      slides.length,
      currentSlidesPerView,
      loopEnabled,
      usesPaddedLoop,
    );

    publishCarouselControlsSnapshot(rootRef.current, {
      api: carouselApiInternalRef.current,
      navigationState,
      activeIndex,
      slideCount: slides.length,
      pageIndex: paginationState.pageIndex,
      pageCount: paginationState.pageCount,
      showNavigation,
      showDots,
    });
  }, [
    activeIndex,
    currentSlidesPerView,
    loopEnabled,
    navigationState,
    showDots,
    showNavigation,
    slides.length,
    usesPaddedLoop,
  ]);

  useEffect(() => {
    const rootNode = rootRef.current;

    return () => {
      resetCarouselControlsSnapshot(rootNode);
    };
  }, []);

  const handleSwiper = useCallback((instance: SwiperInstance) => {
    swiperRef.current = instance;
    publishActiveIndex(instance, true);
    publishNavigationState(instance, true);
  }, [publishActiveIndex, publishNavigationState]);

  const handleSwiperUpdate = useCallback((instance: SwiperInstance) => {
    swiperRef.current = instance;
    publishActiveIndex(instance);
    publishNavigationState(instance);
  }, [publishActiveIndex, publishNavigationState]);

  const handleSwiperTransitionEnd = useCallback((instance: SwiperInstance) => {
    swiperRef.current = instance;
    normalizePaddedLoopPosition(instance);
    publishActiveIndex(instance, true);
    publishNavigationState(instance, true);
  }, [normalizePaddedLoopPosition, publishActiveIndex, publishNavigationState]);

  useEffect(() => {
    publishActiveIndex(swiperRef.current, true);
    publishNavigationState(swiperRef.current, true);
  }, [currentGapPx, currentSlidesPerView, loopEnabled, publishActiveIndex, publishNavigationState, renderedSlides.length, slides.length, usesPaddedLoop]);

  useEffect(() => {
    const instance = swiperRef.current;
    if (!instance) return;

    instance.params.centeredSlides = currentCenteredSlides;
    instance.params.slidesOffsetBefore = currentOffsetBeforePx;
    instance.params.slidesOffsetAfter = currentOffsetAfterPx;
    instance.originalParams.centeredSlides = currentCenteredSlides;
    instance.originalParams.slidesOffsetBefore = currentOffsetBeforePx;
    instance.originalParams.slidesOffsetAfter = currentOffsetAfterPx;
    instance.update();
    instance.slideTo(instance.activeIndex, 0, false);
    publishActiveIndex(instance, true);
    publishNavigationState(instance, true);
  }, [
    currentCenteredSlides,
    currentGapPx,
    currentOffsetAfterPx,
    currentOffsetBeforePx,
    currentSlidesPerView,
    currentSpeed,
    publishActiveIndex,
    publishNavigationState,
  ]);

  useEffect(() => {
    assignCarouselApiRef(apiRef, carouselApiInternalRef.current);

    return () => {
      assignCarouselApiRef(apiRef, null);
    };
  }, [apiRef]);

  const swiperKey = `${currentOrientation}-${swiperEffect}-${loopEnabled}-${usesPaddedLoop}-${String(currentSlidesPerView)}-${currentInitialSlide}-${renderedSlides.length}-${currentCenteredSlides}`;

  const setRootRefs = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    setMotionNode(node);

    if (typeof ref === 'function') {
      ref(node);
      return;
    }

    if (ref) {
      ref.current = node;
    }
  }, [ref, setMotionNode]);

  return (
    <div
      ref={setRootRefs}
      data-carousel-root
      data-carousel-id={carouselId}
      data-scroll-based={scrollBased ? 'true' : 'false'}
      {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers })}
      className={cx(
        styles.Root,
        ...c.num('gap', gap),
        ...c.num('padding', padding),
        ...c.size('width', w),
        ...c.size('minWidth', minW),
        ...c.size('maxWidth', maxW),
        ...slidesPerViewClasses,
        needsInlineAspectRatio(aspectRatio) && inlineAspectRatioClassName(),
        needsInlineGrow(grow) && inlineGrowClassName(),
        className
      )}
      style={{
        ...inlineSizeStyle({
          width: w,
          minWidth: minW,
          maxWidth: maxW,
          height: h,
          minHeight: minH,
          maxHeight: maxH,
        }),
        ...aspectRatioStyle(aspectRatio),
        ...growStyle(grow),
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
              ...c.enum('justifyContent', justify),
              ...c.enum('alignItems', align),
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
