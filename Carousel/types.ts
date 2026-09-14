import type { AspectRatioValue, GrowProps, ResponsiveValue, SizeValue, StateLinkInput } from '../core';
import type { CSSProperties, ReactNode } from 'react';
import type { SharedMotionProps } from '../hooks/useSharedMotion';

export type OrientationKey = 'horizontal' | 'vertical';
export type CarouselOrientation = OrientationKey;
export type EffectKey = 'slide' | 'fade' | 'cube' | 'coverflow' | 'flip';
export type CarouselScrollEffect = EffectKey;
export type NavigationKey = 'dots' | 'arrows' | 'both' | 'none';
export type CarouselNavigation = NavigationKey;
export type SlidesPerViewValue = number | 'auto';
export type CarouselAutoplay = boolean | { delay?: number; disableOnInteraction?: boolean };
export type AlignItemsKey = 'stretch' | 'center' | 'flex_start' | 'flex_end' | 'start' | 'end' | 'baseline';
export type JustifyContentKey = 'flex_start' | 'flex_end' | 'start' | 'end' | 'center' | 'space_between' | 'space_around' | 'space_evenly';
export type CarouselPeekValue = number;

export interface CarouselNavigationState {
  isBeginning: boolean;
  isEnd: boolean;
  prevDisabled: boolean;
  nextDisabled: boolean;
}

export interface CarouselApi {
  prev: () => void;
  next: () => void;
  goTo: (index: number) => void;
  getNavigationState: () => CarouselNavigationState;
}

export type CarouselApiRef = { current: CarouselApi | null } | ((api: CarouselApi | null) => void);

export interface CarouselProps extends GrowProps, SharedMotionProps {
  children: ReactNode | ReactNode[];

  carouselId?: string;

  gap?: ResponsiveValue<number>;

  slidesPerView?: ResponsiveValue<SlidesPerViewValue>;

  w?: ResponsiveValue<SizeValue>;
  minW?: ResponsiveValue<SizeValue>;
  maxW?: ResponsiveValue<SizeValue>;
  h?: ResponsiveValue<SizeValue>;
  minH?: ResponsiveValue<SizeValue>;
  maxH?: ResponsiveValue<SizeValue>;
  aspectRatio?: ResponsiveValue<AspectRatioValue>;

  orientation?: ResponsiveValue<OrientationKey>;

  effect?: ResponsiveValue<EffectKey>;

  navigation?: ResponsiveValue<NavigationKey>;

  pagination?: ResponsiveValue<boolean>;

  autoplay?: boolean | { delay?: number; disableOnInteraction?: boolean };

  mousewheel?: ResponsiveValue<boolean>;

  drag?: ResponsiveValue<boolean>;

  initialSlide?: ResponsiveValue<number>;

  loop?: ResponsiveValue<boolean>;
  centeredSlides?: ResponsiveValue<boolean>;
  offsetBefore?: ResponsiveValue<number>;
  offsetAfter?: ResponsiveValue<number>;
  peekStart?: ResponsiveValue<CarouselPeekValue>;
  peekEnd?: ResponsiveValue<CarouselPeekValue>;

  speed?: ResponsiveValue<number>;
  inertia?: number;

  padding?: ResponsiveValue<number>;
  justify?: ResponsiveValue<JustifyContentKey>;
  align?: ResponsiveValue<AlignItemsKey>;

  slideClassName?: string;
  wrapperClassName?: string;
  paginationClassName?: string;
  navigationClassName?: string;
  className?: string;

  scrollBased?: boolean;
  scrollProgress?: number;

  style?: CSSProperties;

  linkState?: StateLinkInput;
  apiRef?: CarouselApiRef;
  onNavigationStateChange?: (state: CarouselNavigationState) => void;

  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}