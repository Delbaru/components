import { Children, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import type { Swiper as SwiperInstance } from 'swiper';
import { A11y, Autoplay, Mousewheel } from 'swiper/modules';

import { publishCarouselControlsSnapshot, resetCarouselControlsSnapshot } from './controls';
import { getBreakpointIndex, resolveResponsive, resolveResponsiveAtBreakpoint, useMergedRefs } from '../core';
import { useSharedMotion } from '../hooks/useSharedMotion';
import { DEFAULT_NAVIGATION_STATE, assignCarouselApiRef, buildLoopSlides, canEnableLoop, getLogicalSlideIndex, getPaginationState, getPeekOffsetPx, hasScrollableSlides } from './slides';
import type { CarouselApi, CarouselNavigationState, CarouselProps, SlidesPerViewValue } from './types';

export type CarouselConfig = Pick<
  CarouselProps,
  | 'children' | 'carouselId' | 'slidesPerView' | 'orientation' | 'effect' | 'navigation' | 'pagination'
  | 'autoplay' | 'mousewheel' | 'drag' | 'initialSlide' | 'loop' | 'centeredSlides' | 'offsetBefore'
  | 'offsetAfter' | 'peekStart' | 'peekEnd' | 'speed' | 'scrollBased' | 'perspective3d' | 'parallax'
  | 'apiRef' | 'onNavigationStateChange'
>;

/** Поведение Carousel: замер брейкпоинта и зазора, петля, навигация, API. Вид — в Carousel.tsx. */
export function useCarousel(ref: Ref<HTMLDivElement> | undefined, config: CarouselConfig) {
  'use no memo';

  const {
    children, carouselId: explicitCarouselId, slidesPerView, orientation, effect, navigation, pagination,
    autoplay, mousewheel, drag, initialSlide, loop, centeredSlides, offsetBefore, offsetAfter, peekStart,
    peekEnd, speed, scrollBased, perspective3d, parallax, apiRef, onNavigationStateChange,
  } = config;

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

  const slidesPerViewKey = useMemo(() => {
    const toKey = (value: number | 'auto') => {
      if (value === 'auto') return 'auto';
      const stringValue = String(value);
      return stringValue.includes('.') ? stringValue.replace('.', '-') : stringValue;
    };

    if (Array.isArray(slidesPerView)) {
      return slidesPerView.map((value) => (value === null || value === undefined ? null : toKey(value as number | 'auto')));
    }

    return toKey(slidesPerView as unknown as number | 'auto');
  }, [slidesPerView]);

  // Строка, а не массив: кортеж пропа литералом новый на каждом рендере родителя, и эффект
  // замера с ним в зависимостях переподписывал ResizeObserver на каждом рендере.
  const slidesPerViewSignature = String(slidesPerViewKey);

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
  }, [measureResponsiveValues, slidesPerViewSignature, slides.length]);

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

  const setRootRefs = useMergedRefs(rootRef, setMotionNode, ref);

  return {
    carouselId, setRootRefs, motionHandlers, motionStyle, slidesPerViewKey, swiperKey, modules,
    handleSwiper, handleSwiperUpdate, handleSwiperTransitionEnd, autoplayConfig, renderedSlides,
    currentDrag, currentOrientation, currentCenteredSlides, currentInitialSlide, loopEnabled,
    currentMousewheel, currentSlidesPerView, currentOffsetAfterPx, currentOffsetBeforePx,
    currentGapPx, currentSpeed,
  };
}
