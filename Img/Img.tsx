"use client";

import Image, { type ImageProps } from 'next/image';
import { useMemo, useState, type CSSProperties } from 'react';
import type React from 'react';

import styles from './Img.module.scss';
import { boxLayout, createLayoutClasses, cx, resolveResponsive, sizeClasses, splitRootDomProps, stateLinkProps, useMergedRefs, type GrowProps, type RadiusInput, type ResponsiveValue, type SizeInput, type SizeValue, type StateLinkInput, type WithRef } from '../core';
import { useFancybox } from '../hooks/useFancybox';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

const c = createLayoutClasses(styles);

type ObjectFitKey = 'contain' | 'cover' | 'fill' | 'none' | 'scale_down';

type ObjectPositionKey =
  | 'center'
  | 'top' | 'bottom' | 'left' | 'right'
  | 'top_left' | 'top_center' | 'top_right'
  | 'center_left' | 'center_right'
  | 'bottom_left' | 'bottom_center' | 'bottom_right';

type ImgBaseProps = Omit<
  ImageProps,
  | 'width'
  | 'height'
  | 'fill'
  | 'objectFit'
  | 'objectPosition'
  | 'style'
  | 'className'
  | 'sizes'
  | 'alt'
  | 'onLoad'
  | 'onError'
>;

type ImgRootSizeProps = {
  rootW?: ResponsiveValue<SizeValue>;
  rootH?: ResponsiveValue<SizeValue>;
};

type ImgElementProps = ImgBaseProps & Record<string, unknown>;

export interface ImgProps extends ImgBaseProps, SizeInput, RadiusInput, ImgRootSizeProps, GrowProps, SharedMotionProps {
  className?: string;
  style?: CSSProperties;
  'data-point-events'?: string;

  alt: string;

  objectFit?: ResponsiveValue<ObjectFitKey>;
  objectPosition?: ResponsiveValue<ObjectPositionKey>;

  aspectRatio?: ResponsiveValue<string>;

  bg?: string;

  sizes?: string;

  /**
   * Опционально: использовать другое значение для расчёта `sizes`, чем реальный rendered width/height.
   * Полезно, если контейнер должен быть 100%, но хотим подсказать оптимизатору целевую ширину (например 1280px).
   */
  sizesWidth?: ResponsiveValue<SizeValue>;
  sizesHeight?: ResponsiveValue<SizeValue>;

  /** Размеры контейнера (wrapper). Полезно, если картинка должна рендериться на 100%, а intrinsic размеры другие. */
  blur?: boolean;

  quality?: number;

  onLoad?: React.ComponentPropsWithoutRef<'img'>['onLoad'];
  onError?: React.ComponentPropsWithoutRef<'img'>['onError'];

  linkState?: StateLinkInput;
  fancybox?: string;
}

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

const parseAspect = (value?: string | null): number | null => {
  if (!value) return null;

  const parts = value.split(/[/:]/);
  if (parts.length !== 2) throw new Error(`[Img] aspectRatio must be "w/h". Got: ${value}`);

  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) {
    throw new Error(`[Img] aspectRatio parts must be finite numbers. Got: ${value}`);
  }

  return w / h;
};

const toSizeString = (value: SizeValue | null | undefined, ctx: string): string => {
  if (value === null || value === undefined) {
    throw new Error(`[Img] width is required for ${ctx}`);
  }

  if (typeof value === 'number') {
    return `${value}px`;
  }

  const trimmed = value.toString().trim();
  if (trimmed.endsWith('%')) {
    const num = Number(trimmed.slice(0, -1));
    if (!Number.isFinite(num)) throw new Error(`[Img] invalid percent width for ${ctx}: ${value}`);
    return `${num}vw`;
  }

  throw new Error(`[Img] width must be number(px) or percent for ${ctx}. Got: ${value}`);
};

const deriveWidthFromHeight = (
  height: SizeValue | null | undefined,
  aspect: number | null,
  ctx: string
): SizeValue => {
  if (height === null || height === undefined) {
    throw new Error(`[Img] cannot derive width for ${ctx}: height is missing`);
  }
  if (!Number.isFinite(aspect ?? NaN)) {
    throw new Error(`[Img] cannot derive width for ${ctx}: aspectRatio is missing or invalid`);
  }

  if (typeof height === 'number') {
    return height * (aspect as number);
  }

  const trimmed = height.toString().trim();
  if (trimmed.endsWith('%')) {
    // deriving px from % height is ambiguous → forbid
    throw new Error(`[Img] cannot derive width from percent height for ${ctx}. Use explicit width.`);
  }

  throw new Error(`[Img] unsupported height unit for deriving width (${ctx}): ${height}`);
};

const buildSizes = (
  width: ResponsiveValue<SizeValue> | undefined,
  height: ResponsiveValue<SizeValue> | undefined,
  aspectRatio: ResponsiveValue<string> | undefined
): string => {
  const [wd, wm, wt] = resolveResponsive(width ?? null);
  const [hd, hm, ht] = resolveResponsive(height ?? null);
  const [ad, am, at] = resolveResponsive(aspectRatio ?? null);

  const widthDesktop = wd ?? deriveWidthFromHeight(hd, parseAspect(ad ?? undefined), 'desktop');
  const widthMobile = wm ?? deriveWidthFromHeight(hm, parseAspect(am ?? ad ?? undefined), 'mobile');
  const widthTablet = wt ?? deriveWidthFromHeight(ht, parseAspect(at ?? ad ?? undefined), 'tablet');

  const d = toSizeString(widthDesktop, 'desktop');
  const m = toSizeString(widthMobile, 'mobile');
  const t = toSizeString(widthTablet, 'tablet');

  return `(max-width: ${MOBILE_MAX}px) ${m}, (max-width: ${TABLET_MAX}px) ${t}, ${d}`;
};

function resolveFancyboxHref(src: ImageProps['src']): string | null {
  if (typeof src === 'string') {
    return src;
  }

  if (src && typeof src === 'object' && 'src' in src && typeof src.src === 'string') {
    return src.src;
  }

  return null;
}

export function Img({
  ref,
  id,
  className = '',
  style,
  'data-point-events': dataPointEvents,
  alt,
  w,
  minW,
  maxW,
  h,
  minH,
  maxH,
  rootW,
  rootH,
  grow,
  r,
  tlr,
  trr,
  brr,
  blr,
  borderTLR,
  borderTRR,
  borderBRR,
  borderBLR,
  objectFit,
  objectPosition,
  aspectRatio,
  bg,
  sizes,
  sizesWidth,
  sizesHeight,
  blur = false,
  quality,
  onLoad,
  onError,
  linkState,
  perspective3d,
  parallax,
  fancybox,
  ...props
}: WithRef<ImgProps, HTMLSpanElement>) {
  // Размеры обёртки — не из коробки: `rootW`/`rootH` перекрывают размеры картинки.
  const layout = boxLayout(c, { r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR, bg, aspectRatio, grow });
  const [isLoaded, setIsLoaded] = useState(false);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const imageSizeProps = {
    w,
    minW,
    maxW,
    h,
    minH,
    maxH,
  };
  const wrapperSizeProps = {
    w: rootW ?? imageSizeProps.w,
    minW: imageSizeProps.minW,
    maxW: imageSizeProps.maxW,
    h: rootH ?? imageSizeProps.h,
    minH: imageSizeProps.minH,
    maxH: imageSizeProps.maxH,
  };
  const { rootProps, elementProps } = splitRootDomProps(props as ImgElementProps);

  // Картинку по адресу НАШЕГО API оптимизатор `next/image` собрать не может, и это не настройка,
  // а его устройство: он идёт за исходником со СВОЕГО сервера, отдельным запросом и без cookie
  // человека. Ответ такому запросу — 401/404, то есть на экране битая картинка, а не «чуть хуже
  // качеством». Поэтому всё под `/api/` отдаётся как есть — ровно так же, как Next сам поступает
  // с `blob:` и `data:`.
  //
  // Правилом, а не пропом на call-site: иначе про него забудут ровно там, где картинка личная,
  // и поймается это уже глазами на живых данных.
  const unoptimized = String(elementProps.src ?? '').startsWith('/api/');
  const imageProps = { ...elementProps, unoptimized };

  const fancyboxGroup = fancybox?.trim();
  const fancyboxHref = useMemo(() => resolveFancyboxHref(elementProps.src), [elementProps.src]);
  const hasFancybox = Boolean(fancyboxGroup && fancyboxHref);

  useFancybox(hasFancybox);

  // useCallback обязателен: ref-колбэк со скачущей идентичностью React отцепляет и цепляет
  // заново каждый рендер, а это сбрасывает накопленный моушен в setMotionNode(null).
  const setRefs = useMergedRefs(setMotionNode, ref);

  const computedSizes = useMemo(() => {
    if (sizes) return sizes;
    const widthForSizes = sizesWidth ?? imageSizeProps.w;
    const heightForSizes = sizesHeight ?? imageSizeProps.h;
    return buildSizes(widthForSizes, heightForSizes, aspectRatio);
  }, [aspectRatio, imageSizeProps.h, imageSizeProps.w, sizes, sizesHeight, sizesWidth]);
  const normalizedAlt = typeof alt === 'string' ? alt : '';
  const fancyboxAriaLabel = normalizedAlt || 'Изображение';

  if (quality !== undefined && (quality < 1 || quality > 100)) {
    throw new Error(`[Img] quality must be between 1 and 100. Got: ${quality}`);
  }
  const normalizedQuality = quality === undefined ? undefined : Math.max(1, Math.min(100, quality));

  const handleLoad: React.ComponentPropsWithoutRef<'img'>['onLoad'] = (event) => {
    setIsLoaded(true);
    onLoad?.(event);
  };

  return (
    <span
      ref={setRefs}
      id={id}
      data-point-events={dataPointEvents}
      {...(rootProps as React.HTMLAttributes<HTMLSpanElement>)}
      {...stateLinkProps(linkState, motionHandlers)}
      className={cx(styles.Img, ...sizeClasses(c, wrapperSizeProps), ...layout, className)}
      style={{
        ...(motionStyle ?? null),
        ...style,
      }}
    >
      {hasFancybox ? (
        <a
          href={fancyboxHref ?? undefined}
          data-fancybox={fancyboxGroup}
          data-caption={normalizedAlt || undefined}
          className={styles.Link}
          draggable={false}
          aria-label={fancyboxAriaLabel}
        >
          {blur && (
            <Image
              {...imageProps}
              alt=""
              aria-hidden
              draggable={false}
              fill
              sizes="5vw"
              quality={normalizedQuality}
              className={cx(
                styles.Image,
                styles.Blur,
                isLoaded && styles.BlurHidden,
                ...c.value('objectFit', objectFit ?? 'cover'),
                ...c.value('objectPosition', objectPosition ?? 'center'),
              )}
            />
          )}
          <Image
            {...imageProps}
            alt={normalizedAlt}
            draggable={false}
            fill
            sizes={computedSizes}
            quality={normalizedQuality}
            className={cx(
              styles.Image,
              ...c.value('objectFit', objectFit ?? 'cover'),
              ...c.value('objectPosition', objectPosition ?? 'center'),
            )}
            onLoad={handleLoad}
            onError={onError}
          />
        </a>
      ) : (
        <>
          {blur && (
            <Image
              {...imageProps}
              alt=""
              aria-hidden
              draggable={false}
              fill
              sizes="5vw"
              quality={normalizedQuality}
              className={cx(
                styles.Image,
                styles.Blur,
                isLoaded && styles.BlurHidden,
                ...c.value('objectFit', objectFit ?? 'cover'),
                ...c.value('objectPosition', objectPosition ?? 'center'),
              )}
            />
          )}
          <Image
            {...imageProps}
            alt={normalizedAlt}
            draggable={false}
            fill
            sizes={computedSizes}
            quality={normalizedQuality}
            className={cx(
              styles.Image,
              ...c.value('objectFit', objectFit ?? 'cover'),
              ...c.value('objectPosition', objectPosition ?? 'center'),
            )}
            onLoad={handleLoad}
            onError={onError}
          />
        </>
      )}
    </span>
  );
}
