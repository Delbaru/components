'use client';

import Link from 'next/link';
import { forwardRef, useCallback, useMemo, type CSSProperties, type SVGProps, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type React from 'react';
import styles from './Icon.module.scss';
import { cx, createLayoutClasses, growStyle, inlineGrowClassName, inlineSpaceStyle, needsInlineGrow, radiusClasses, resolveRadiusInput, sanitizeSvgMarkup, shouldUseNextLink, sizeClasses, sizeInlineStyle, splitRootDomProps, stateProps as buildStateProps, stateLinkProps, tokenStyles, type BorderStyleProps, type ComponentStateValue, type GrowProps, type RadiusInput, type ResponsiveSpaceValue, type ResponsiveValue, type SizeInput, type SizeValue, type StateLinkInput } from '../core';
import { resolveResponsive } from '../core/base/responsive';
import { Flex } from '../Flex';
import { useAnchoredFloating } from '../hooks/useAnchoredFloating';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import { useIconSwap, componentSwapKey, type IconAnimate } from './swap';

const c = createLayoutClasses([styles, tokenStyles]);

const SAFE_SVG_PAINT_PATTERNS = [
  /^(?:none|currentColor|transparent|inherit|context-fill|context-stroke)$/i,
  /^#[0-9a-f]{3,8}$/i,
  /^(?:rgb|rgba|hsl|hsla)\(\s*[-\d.%\s,]+\)$/i,
  /^var\(\s*--[\w-]+\s*(?:,\s*[^()]+)?\)$/i,
  /^url\(\s*['"]?#[-\w]+['"]?\s*\)$/i,
  /^[a-z]+$/i,
] as const;

const SAFE_SVG_STROKE_WIDTH_PATTERN = /^(?:\d+|\d*\.\d+)(?:px|em|rem|%)?$/i;

function sanitizeSvgPaintValue(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  return SAFE_SVG_PAINT_PATTERNS.some((pattern) => pattern.test(normalized)) ? normalized : undefined;
}

function sanitizeSvgStrokeWidthValue(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  return SAFE_SVG_STROKE_WIDTH_PATTERN.test(normalized) ? normalized : undefined;
}

function rewriteSvgPaintAttributes(content: string, normalizeContent = false): string {
  return content
    .replace(/\bstroke-width\s*=\s*["']([^"']*)["']/gi, (_match: string, value: string) => {
      const safeValue = sanitizeSvgStrokeWidthValue(value);

      if (normalizeContent) {
        return safeValue
          ? `stroke-width="var(--icon-stroke-width, ${safeValue})"`
          : 'stroke-width="var(--icon-stroke-width)"';
      }

      return safeValue ? `stroke-width="${safeValue}"` : '';
    })
    .replace(/\bstroke\s*=\s*["']([^"']*)["']/gi, (_match: string, value: string) => {
      if (value.trim().toLowerCase() === 'none') return 'stroke="none"';

      const safeValue = sanitizeSvgPaintValue(value);

      if (normalizeContent) {
        return safeValue
          ? `stroke="var(--icon-stroke, ${safeValue})"`
          : 'stroke="var(--icon-stroke)"';
      }

      return safeValue ? `stroke="${safeValue}"` : '';
    })
    .replace(/\bfill\s*=\s*["']([^"']*)["']/gi, (_match: string, value: string) => {
      if (value.trim().toLowerCase() === 'none') return 'fill="none"';

      const safeValue = sanitizeSvgPaintValue(value);

      if (normalizeContent) {
        return safeValue
          ? `fill="var(--icon-fill, ${safeValue})"`
          : 'fill="var(--icon-fill)"';
      }

      return safeValue ? `fill="${safeValue}"` : '';
    });
}

/** Подменяет stroke/fill в контенте на CSS-переменные, сохраняя исходный цвет как fallback. */
function normalizeSvgContent(content: string): string {
  return rewriteSvgPaintAttributes(content, true);
}

function parseSvg(text: string, normalizeContent = false): { content: string; viewBox?: string; rootFill?: string } {
  const sanitizedText = sanitizeSvgMarkup(text);
  const svgMatch = sanitizedText.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
  if (svgMatch) {
    const viewBoxMatch = svgMatch[1].match(/viewBox=["']([^"']+)["']/i);
    const fillMatch = svgMatch[1].match(/\bfill=["']([^"']+)["']/i);
    return {
      content: normalizeContent ? normalizeSvgContent(svgMatch[2]) : rewriteSvgPaintAttributes(svgMatch[2]),
      viewBox: viewBoxMatch ? viewBoxMatch[1] : undefined,
      rootFill: fillMatch ? sanitizeSvgPaintValue(fillMatch[1]) : undefined,
    };
  }

  throw new Error('Invalid SVG response');
}

type ParsedSvg = { content: string; viewBox?: string; rootFill?: string };

const svgFetchCache = new Map<string, Promise<ParsedSvg>>();
// Синхронный кэш уже разобранных SVG. Позволяет отрисовать иконку в первом же рендере
// (без вспышки null → content), если тот же файл уже грузился ранее на клиенте.
const svgResolvedCache = new Map<string, ParsedSvg>();
// Реестр инлайн-иконок: сырой <svg>-текст, впечённый в бандл на этапе сборки
// (см. tools/icons/generate-inline-manifest.mjs). Ключ — итоговый URL вида '/icons/...'.
// Даёт синхронную отрисовку в первом кадре и в SSR, без рантайм-fetch.
const inlineSvgRegistry = new Map<string, string>();

/**
 * Регистрирует инлайн-иконки (URL → сырой SVG-текст). Вызывается один раз при старте
 * приложения сгенерированным модулем. Идемпотентно — повторные ключи перезаписываются.
 */
export function registerInlineIcons(icons: Record<string, string>): void {
  for (const key in icons) {
    inlineSvgRegistry.set(key, icons[key]);
  }
}

function svgCacheKey(url: string, normalizeContent: boolean): string {
  return `${url}::${normalizeContent ? 'normalized' : 'raw'}`;
}

function getResolvedSvg(url: string | null, normalizeContent: boolean): ParsedSvg | null {
  if (!url) return null;

  const cacheKey = svgCacheKey(url, normalizeContent);
  const cached = svgResolvedCache.get(cacheKey);
  if (cached) return cached;

  // Инлайн-иконка из бандла: разбираем синхронно один раз и кладём в кэш.
  // Если запись битая — деградируем к обычному fetch-пути (ниже), не роняя рендер.
  const inlineRaw = inlineSvgRegistry.get(url);
  if (inlineRaw != null) {
    try {
      const parsed = parseSvg(inlineRaw, normalizeContent);
      svgResolvedCache.set(cacheKey, parsed);
      return parsed;
    } catch {
      /* fall through to fetch */
    }
  }

  return null;
}

function fetchSvgCached(url: string, normalizeContent = false): Promise<ParsedSvg> {
  const cacheKey = svgCacheKey(url, normalizeContent);

  if (!svgFetchCache.has(cacheKey)) {
    const request = fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load SVG: ${url}`);
        }

        return res.text();
      })
      .then((text) => {
        const parsed = parseSvg(text, normalizeContent);
        svgResolvedCache.set(cacheKey, parsed);
        return parsed;
      })
      .catch((error) => {
        svgFetchCache.delete(cacheKey);
        throw error;
      });

    svgFetchCache.set(cacheKey, request);
  }
  return svgFetchCache.get(cacheKey)!;
}

// Тип для SVG компонента, который возвращает SVGR
export type IconComponent = React.FC<React.SVGProps<SVGSVGElement>>;

export type IconSource = {
  src?: string | IconComponent;
  name?: string;
  component?: IconComponent;
};

type IconBaseSvgProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'color' | 'rotate' | 'strokeWidth'>;
type IconSourceInput = string | IconComponent | IconSource | undefined;
type FetchedSvgState = { content: string | null; viewBox?: string; rootFill?: string };
type ResolvedIconSource = { url: string | null; component?: IconComponent };
type IconElementProps = IconBaseSvgProps & Record<string, unknown>;

type IconRootSizeProps = {
  rootW?: ResponsiveValue<SizeValue>;
  rootMinW?: ResponsiveValue<SizeValue>;
  rootMaxW?: ResponsiveValue<SizeValue>;
  rootH?: ResponsiveValue<SizeValue>;
  rootMinH?: ResponsiveValue<SizeValue>;
  rootMaxH?: ResponsiveValue<SizeValue>;
};

type IconRootStyleProps = {
  rootR?: ResponsiveValue<number>;
  rootTLR?: ResponsiveValue<number>;
  rootTRR?: ResponsiveValue<number>;
  rootBRR?: ResponsiveValue<number>;
  rootBLR?: ResponsiveValue<number>;
  rootBg?: ResponsiveValue<string>;
  rootClassName?: string;
};

function isIconComponentSource(source: unknown): source is IconComponent {
  return typeof source === 'function'
    || (typeof source === 'object' && source !== null && '$$typeof' in source);
}

function resolveIconUrl(source: string): string {
  const value = source
    .trim()
    .replace(/^\.\//, '')
    .replace(/^public\//, '');

  if (!value) return value;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/')) return value;
  if (value.startsWith('icons/')) return `/${value}`;
  if (value.endsWith('.svg')) return `/icons/${value}`;

  return `/icons/${value}.svg`;
}

function resolveIconSource(source?: IconSourceInput): ResolvedIconSource {
  if (!source) return { url: null };
  if (typeof source === 'string') return { url: resolveIconUrl(source) };
  if (isIconComponentSource(source)) return { component: source, url: null };

  return {
    component: source.component ?? (isIconComponentSource(source.src) ? source.src : undefined),
    url: typeof source.src === 'string'
      ? resolveIconUrl(source.src)
      : (source.name ? `/icons/${source.name}.svg` : null),
  };
}

function hasIconSource(source: ResolvedIconSource): boolean {
  return Boolean(source.component || source.url);
}

function parseAspectRatio(viewBox?: string): CSSProperties['aspectRatio'] | undefined {
  if (!viewBox) return undefined;

  const [, , widthRaw, heightRaw] = viewBox.trim().split(/[\s,]+/);
  const width = Number(widthRaw);
  const height = Number(heightRaw);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return `${width} / ${height}`;
}

function useFetchedSvg(url: string | null, normalizeContent = false): FetchedSvgState {
  const [state, setState] = useState<FetchedSvgState>(
    () => getResolvedSvg(url, normalizeContent) ?? { content: null, viewBox: undefined, rootFill: undefined }
  );

  useEffect(() => {
    let cancelled = false;

    if (!url) {
      setState({ content: null, viewBox: undefined, rootFill: undefined });
      return () => { cancelled = true; };
    }

    // Уже разобранный SVG берём синхронно — без повторного fetch и без вспышки пустого состояния.
    const resolved = getResolvedSvg(url, normalizeContent);
    if (resolved) {
      setState(resolved);
      return () => { cancelled = true; };
    }

    setState({ content: null, viewBox: undefined, rootFill: undefined });

    fetchSvgCached(url, normalizeContent)
      .then(({ content, viewBox, rootFill }) => {
        if (!cancelled) {
          setState({ content, viewBox, rootFill });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ content: null, viewBox: undefined, rootFill: undefined });
        }
      });

    return () => { cancelled = true; };
  }, [url, normalizeContent]);

  return state;
}

type IconTooltipWithPortalProps = {
  children: React.ReactElement;
  tooltip: React.ReactNode;
  direction: NonNullable<IconProps['tooltipDirection']>;
  gap: number;
};

function IconTooltipWithPortal({ children, tooltip, direction, gap }: IconTooltipWithPortalProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const floatingRef = useRef<HTMLElement | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [isActive, setIsActive] = useState(false);
  const { placement, isPositioned, style: floatingStyle } = useAnchoredFloating({
    anchorRef,
    floatingRef,
    isActive,
    placement: direction,
    align: 'center',
    gap,
    viewportPadding: 8,
  });

  useEffect(() => {
    setPortalNode(document.body);
  }, []);

  const handleBlur = (event: React.FocusEvent<HTMLSpanElement>) => {
    const nextFocusedNode = event.relatedTarget as Node | null;
    if (!nextFocusedNode || !event.currentTarget.contains(nextFocusedNode)) {
      setIsActive(false);
    }
  };

  return (
    <>
      <span
        ref={anchorRef}
        className={styles.IconTooltipWrapper}
        style={{ '--tooltip-gap': `${gap}px` } as CSSProperties}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        onFocus={() => setIsActive(true)}
        onBlur={handleBlur}
      >
        {children}
      </span>
      {portalNode && createPortal(
        <span
          ref={floatingRef}
          className={styles.IconTooltip}
          style={floatingStyle}
          data-placement={placement}
          {...buildStateProps(isActive && isPositioned && 'active')}
        >
          {tooltip}
        </span>,
        portalNode
      )}
    </>
  );
}

export type IconProps = IconBaseSvgProps & SizeInput & RadiusInput & IconRootSizeProps & IconRootStyleProps & BorderStyleProps & GrowProps & SharedMotionProps & {
  'data-point-events'?: string;
  // URL иконки или импортированный SVG-компонент
  // Пример: src="https://example.com/icon.svg"
  // Пример: src={ArrowIcon}
  src?: string | IconComponent;
  
  // Имя иконки (загружается из public/icons/{name}.svg)
  // Пример: name="ui/arrows/arrow_bold" -> загружает /icons/ui/arrows/arrow_bold.svg
  name?: string;
  
  // hover-иконка. Поддерживает старую строку с именем файла, path string и object source.
  // Примеры:
  // hover="ui/favourite/favourite_white.svg"
  // hover="/icons/ui/favourite/favourite_white.svg"
  // hover={FavouriteHoverIcon}
  // hover={{ src: '/icons/ui/favourite/favourite_white.svg' }}
  // hover={{ name: 'ui/favourite/favourite_white' }}
  hover?: string | IconComponent | IconSource;
  
  // Или готовый SVG компонент (результат импорта через SVGR из src/assets/icons)
  // Пример: import ArrowIcon from '@/assets/icons/arrow-right.svg';
  component?: IconComponent;

  /** Если задан — иконка оборачивается в <a> */
  href?: string;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;

  style?: CSSProperties;

  // rotation (in degrees). Example: rotate={-135} or rotate={[-135, null, null]}
  rotate?: ResponsiveValue<number | string>;

  // layout props (tokens)
  m?: ResponsiveSpaceValue;
  mt?: ResponsiveValue<number>;
  mr?: ResponsiveValue<number>;
  mb?: ResponsiveValue<number>;
  ml?: ResponsiveValue<number>;

  // simple style overrides (single value)
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: ResponsiveValue<number | string>;
  state?: ComponentStateValue;
  tooltip?: React.ReactNode;
  tooltipDirection?: 'right' | 'left' | 'top' | 'bottom';
  tooltipGap?: number;

  linkState?: StateLinkInput;

  /**
   * Анимация смены иконки. 'swap' — плавная подмена при изменении src/name/component:
   * старая уходит (opacity+scale), затем въезжает новая из scale→1.
   * Опции: animate={['swap', { duration, scale }]}.
   */
  animate?: IconAnimate;
};

/**
 * Компонент Icon для отображения SVG иконок.
 * 
 * Использование:
 * 1. С готовым компонентом (SVGR):
 *    import ArrowIcon from '@/assets/icons/arrow-right.svg';
 *    <Icon component={ArrowIcon} w={24} h={24} />
 *    <Icon src={ArrowIcon} w={24} h={24} />
 * 
 * 2. С URL:
 *    <Icon src="https://example.com/icon.svg" w={24} h={24} />
 * 
 * 3. С именем иконки (из public/icons/{name}.svg):
 *    <Icon name="ui/arrows/arrow_bold" w={24} h={24} />
 * 
 * 4. С hover эффектом:
 *    <Icon name="ui/favourite/favourite_black" hover="ui/favourite/favourite_white.svg" w={28} h={28} />
 *    <Icon name="ui/favourite/favourite_black" hover={{ src: '/icons/ui/favourite/favourite_white.svg' }} w={28} h={28} />
 * 
 * Всегда рендерит inline SVG, не использует <img>.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(
  (
    {
      src,
      name,
      hover,
      component: IconComponent,
      href,
      target,
      rel,
      id,
      'aria-label': ariaLabel,
      'aria-disabled': ariaDisabled,
      'data-point-events': dataPointEvents,
      className = '',
      style,
      onClick,
      onMouseEnter,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      onFocus,
      onBlur,
      onKeyDown,
      onKeyUp,
      role,
      tabIndex,
      w,
      minW,
      maxW,
      h,
      minH,
      maxH,
      rotate,
      m,
      mt,
      mr,
      mb,
      ml,
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
      color,
      fill,
      stroke,
      strokeWidth,
      border,
      borderC,
      borderS,
      borderW,
      borderT,
      borderR,
      borderB,
      borderL,
      state,
      rootW,
      rootMinW,
      rootMaxW,
      rootH,
      rootMinH,
      rootMaxH,
      rootR,
      rootTLR,
      rootTRR,
      rootBRR,
      rootBLR,
      rootBg,
      rootClassName,
      tooltip,
      tooltipDirection = 'right',
      tooltipGap = 8,
      linkState,
      perspective3d,
      parallax,
      animate,
      ...props
    },
    ref
  ) => {
    const linkRel = rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined);
    const useNextLink = shouldUseNextLink(href, target);
    const linkProps = href
      ? { href, target, rel: linkRel, className: styles.IconLink, 'data-point-events': dataPointEvents }
      : null;
    const wrapLink = (content: React.ReactNode) =>
      linkProps ? (useNextLink ? <Link {...linkProps}>{content}</Link> : <a {...linkProps}>{content}</a>) : content;

    const baseSource = resolveIconSource({ src, name, component: IconComponent });
    const hoverSource = resolveIconSource(hover);
    const iconUrl = baseSource.url;
    const hoverUrl = hoverSource.url;
    const hasHoverIcon = hasIconSource(hoverSource);
    const iconSizeProps = {
      w,
      minW,
      maxW,
      h,
      minH,
      maxH,
    };
    const rootSizeProps = {
      w: rootW,
      minW: rootMinW,
      maxW: rootMaxW,
      h: rootH,
      minH: rootMinH,
      maxH: rootMaxH,
    };
    const resolvedRadiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR });
    const resolvedRootRadius = resolveRadiusInput({
      r: rootR ?? resolvedRadiusProps.r,
      tlr: rootTLR ?? resolvedRadiusProps.tlr,
      trr: rootTRR ?? resolvedRadiusProps.trr,
      brr: rootBRR ?? resolvedRadiusProps.brr,
      blr: rootBLR ?? resolvedRadiusProps.blr,
    });
    const resolvedRootBg = rootBg;
    const resolvedRootClassName = rootClassName;
    const { rootProps, elementProps: rawElementProps } = splitRootDomProps(props as IconElementProps);
    const {
      tooltip: _tooltip,
      tooltipDirection: _tooltipDirection,
      tooltipGap: _tooltipGap,
      ...elementProps
    } = rawElementProps;

    const rotateResolved = rotate ? resolveResponsive(rotate) : null;
    const strokeWidthResolved = strokeWidth ? resolveResponsive(strokeWidth) : null;
    const formatRotate = (value: string | number | null | undefined): string | undefined => {
      if (value === null || value === undefined) return undefined;
      return typeof value === 'number' ? `${value}deg` : value;
    };

    const rotateVars = rotateResolved
      ? {
          '--rotate-d': formatRotate(rotateResolved[0]),
          '--rotate-m': formatRotate(rotateResolved[1]),
          '--rotate-t': formatRotate(rotateResolved[2]),
        }
      : undefined;

    const formatStrokeWidth = (value: string | number | null | undefined): string | undefined => {
      if (value === null || value === undefined) return undefined;
      return typeof value === 'number' ? `${value}px` : value;
    };

    const strokeWidthVars = strokeWidthResolved
      ? {
          '--icon-stroke-width': formatStrokeWidth(strokeWidthResolved[0]) ?? undefined,
          '--icon-stroke-width-d': formatStrokeWidth(strokeWidthResolved[0]) ?? undefined,
          '--icon-stroke-width-m': formatStrokeWidth(strokeWidthResolved[1]) ?? undefined,
          '--icon-stroke-width-t': formatStrokeWidth(strokeWidthResolved[2]) ?? undefined,
        }
      : undefined;

    const shouldNormalizeFetchedSvg = fill != null || stroke != null || strokeWidth != null;
    const { content: svgContent, viewBox: svgViewBox, rootFill: svgRootFill } = useFetchedSvg(iconUrl, shouldNormalizeFetchedSvg);
    const { content: hoverSvgContent, viewBox: hoverSvgViewBox, rootFill: hoverSvgRootFill } = useFetchedSvg(hoverUrl, shouldNormalizeFetchedSvg);

    // Объект dangerouslySetInnerHTML МЕМОИЗИРУЕМ. React сравнивает этот проп по идентичности
    // объекта, а не по строке: свежий литерал `{ __html: content }` на каждом рендере заставляет
    // его переустанавливать innerHTML, то есть УНИЧТОЖАТЬ и создавать заново все path/circle внутри
    // глифа. Свежевставленный узел рисуется сразу финальным цветом — любой CSS-transition на нём
    // (перекраска активного пункта навигации) не запускается. См. Frontend.md §12.
    const svgHtml = useMemo(() => ({ __html: svgContent ?? '' }), [svgContent]);
    const hoverSvgHtml = useMemo(() => ({ __html: hoverSvgContent ?? '' }), [hoverSvgContent]);
    const rootStateProps = buildStateProps(state);
    const { hasMotion, motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
    const linkedHandlers = stateLinkProps(linkState, {
      ...motionHandlers,
      onClick,
      onMouseEnter,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      onFocus,
      onBlur,
      onKeyDown,
      onKeyUp,
    });
    const needsRootWrapper = [
      rootSizeProps.w,
      rootSizeProps.minW,
      rootSizeProps.maxW,
      rootSizeProps.h,
      rootSizeProps.minH,
      rootSizeProps.maxH,
      border,
      borderC,
      borderS,
      borderW,
      borderT,
      borderR,
      borderB,
      borderL,
      resolvedRootRadius.r,
      resolvedRootRadius.tlr,
      resolvedRootRadius.trr,
      resolvedRootRadius.brr,
      resolvedRootRadius.blr,
      resolvedRootBg,
      resolvedRootClassName,
    ].some((value) => value !== undefined);
    const contentHandlers = needsRootWrapper ? undefined : linkedHandlers;
    // motionStyle уже собран useSharedMotion (transform + preserve-3d + willChange) — когда есть
    // root-обёртка, моушен живёт на ней, иначе вешаем его прямо на контент.
    const contentMotionStyle = needsRootWrapper ? undefined : motionStyle;
    const contentRootProps = needsRootWrapper ? undefined : rootProps;
    const wrapperRootProps = needsRootWrapper ? rootProps : undefined;
    const contentInteractiveProps = !needsRootWrapper
      ? {
          id,
          role,
          tabIndex,
          'aria-label': ariaLabel,
          'aria-disabled': ariaDisabled,
        }
      : undefined;
    const rootInteractiveProps = needsRootWrapper
      ? {
          id,
          role,
          tabIndex,
          'aria-label': ariaLabel,
          'aria-disabled': ariaDisabled,
        }
      : undefined;

    // Общие props для SVG: при явных пропсах разрешаем прямое переопределение fill/stroke.
    const commonSvgStyle = {
      ...(color && { color }),
      ...(stroke != null && { '--icon-stroke': stroke, stroke } as CSSProperties),
      ...(fill != null && { '--icon-fill': fill, fill } as CSSProperties),
      ...(strokeWidthVars as CSSProperties),
    } as CSSProperties;

    // Общие классы и стили
    const commonClasses = [
      ...c.space('m', m),
      ...c.space('mt', mt),
      ...c.space('mr', mr),
      ...c.space('mb', mb),
      ...c.space('ml', ml),
      ...radiusClasses(c, resolvedRadiusProps),
      ...sizeClasses(c, iconSizeProps),
      !needsRootWrapper && needsInlineGrow(grow) && inlineGrowClassName(),
      className,
    ];

    const commonStyles = {
      ...inlineSpaceStyle({ m, mt, mr, mb, ml }),
      ...sizeInlineStyle(iconSizeProps),
      ...(!needsRootWrapper ? growStyle(grow) : null),
      ...(strokeWidthVars as CSSProperties),
      ...(rotateVars as CSSProperties),
      ...style,
    };

    const stackAspectRatio = parseAspectRatio(svgViewBox || elementProps.viewBox || hoverSvgViewBox);

    // useCallback обязателен: ref-колбэк со скачущей идентичностью React отцепляет и цепляет
    // заново каждый рендер, а это сбрасывает накопленный моушен в setMotionNode(null).
    const setSvgRefs = useCallback((node: SVGSVGElement | null) => {
      setMotionNode(node);

      if (typeof ref === 'function') {
        ref(node);
        return;
      }

      if (ref) {
        ref.current = node;
      }
    }, [ref, setMotionNode]);

    const renderStackLayer = (
      source: ResolvedIconSource,
      fetched: FetchedSvgState,
      html: { __html: string },
      layer: 'default' | 'hover'
    ): React.ReactElement | null => {
      const layerProps = layer === 'default' ? elementProps : { 'aria-hidden': true };

      if (source.component) {
        const LayerComponent = source.component;

        return (
          <LayerComponent
            ref={layer === 'default' ? setSvgRefs : undefined}
            data-icon-layer={layer}
            className={styles.Icon}
            style={commonSvgStyle}
            {...layerProps}
          />
        );
      }

      if (!fetched.content) return null;

      return (
        <svg
          ref={layer === 'default' ? setSvgRefs : undefined}
          data-icon-layer={layer}
          className={styles.Icon}
          style={commonSvgStyle}
          fill={fill == null ? fetched.rootFill : undefined}
          viewBox={fetched.viewBox || (layer === 'default' ? elementProps.viewBox : undefined)}
          dangerouslySetInnerHTML={html}
          {...layerProps}
        />
      );
    };

    let content: React.ReactElement | null = null;

    if (baseSource.component && !hasHoverIcon) {
      const BaseIconComponent = baseSource.component;

      content = (
        <BaseIconComponent
          ref={setSvgRefs}
          {...(contentInteractiveProps ?? null)}
          {...(contentRootProps as Record<string, unknown> ?? null)}
          data-point-events={dataPointEvents}
          data-icon-root="true"
          className={cx(
            styles.Icon,
            ...commonClasses,
            className
          )}
          style={{
            ...commonSvgStyle,
            ...commonStyles,
            ...(contentMotionStyle ?? null),
          } as CSSProperties}
          {...rootStateProps}
          {...contentHandlers}
          {...elementProps}
        />
      );
    } else if (hasHoverIcon) {
      const wrapperProps = {
        ...(contentInteractiveProps ?? null),
        ...(contentRootProps as Record<string, unknown> ?? null),
        'data-point-events': dataPointEvents,
        ...(rootStateProps ?? null),
        className: cx(styles.IconWrapper, ...commonClasses),
        style: {
          ...(stackAspectRatio ? { aspectRatio: stackAspectRatio } : null),
          ...commonStyles,
          ...(contentMotionStyle ?? null),
        } as CSSProperties,
      };

      content = (
        <span ref={setMotionNode} {...wrapperProps} {...contentHandlers} data-icon-root="true" data-icon-stack="true">
          {renderStackLayer(baseSource, { content: svgContent, viewBox: svgViewBox, rootFill: svgRootFill }, svgHtml, 'default')}
          {renderStackLayer(hoverSource, { content: hoverSvgContent, viewBox: hoverSvgViewBox, rootFill: hoverSvgRootFill }, hoverSvgHtml, 'hover')}
        </span>
      );
    } else {
      // Не возвращаем null во время загрузки: рендерим размеренный плейсхолдер, чтобы
      // коробка иконки занимала финальное место сразу и верстку не «шифтило».
      content = (
        <svg
          ref={setSvgRefs}
          {...(contentInteractiveProps ?? null)}
          {...(contentRootProps as Record<string, unknown> ?? null)}
          data-point-events={dataPointEvents}
          data-icon-root="true"
          data-icon-loading={svgContent ? undefined : 'true'}
          className={cx(styles.Icon, ...commonClasses)}
          style={{
            ...commonSvgStyle,
            ...commonStyles,
            ...(contentMotionStyle ?? null),
          }}
          {...rootStateProps}
          {...contentHandlers}
          fill={fill == null ? svgRootFill : undefined}
          viewBox={svgViewBox || elementProps.viewBox}
          dangerouslySetInnerHTML={svgHtml}
          {...elementProps}
        />
      );
    }

    // Идентичность источника для свопа + признак готовности контента (для инлайн-иконок — синхронно).
    const iconIdentity = baseSource.url ?? (baseSource.component ? componentSwapKey(baseSource.component) : null);
    const iconContentReady = svgContent != null || Boolean(baseSource.component);

    // Root-бокс (заливка/бордер/размер) — часть визуала иконки, поэтому собираем его ДО свопа, чтобы
    // анимировался весь отрисованный Icon целиком (кружок + глиф), а не только SVG внутри коробки.
    if (needsRootWrapper) {
      content = (
        <Flex
          ref={setMotionNode as React.Ref<HTMLDivElement>}
          {...(rootInteractiveProps ?? null)}
          {...(wrapperRootProps as Record<string, unknown> ?? null)}
          data-point-events={dataPointEvents}
          data-icon-root="true"
          className={cx(
            styles.IconRoot,
            resolvedRootClassName,
            ...c.bg('bg', resolvedRootBg),
          )}
          w={rootSizeProps.w}
          minW={rootSizeProps.minW}
          maxW={rootSizeProps.maxW}
          h={rootSizeProps.h}
          minH={rootSizeProps.minH}
          maxH={rootSizeProps.maxH}
          r={resolvedRootRadius.r}
          tlr={resolvedRootRadius.tlr}
          trr={resolvedRootRadius.trr}
          brr={resolvedRootRadius.brr}
          blr={resolvedRootRadius.blr}
          border={border}
          borderC={borderC}
          borderS={borderS}
          borderW={borderW}
          borderT={borderT}
          borderR={borderR}
          borderB={borderB}
          borderL={borderL}
          grow={grow}
          state={state}
          align="center"
          justify="center"
          style={hasMotion ? (motionStyle as CSSProperties) : undefined}
          {...linkedHandlers}
        >
          {content}
        </Flex>
      );
    }

    // Своп-анимация смены иконки (opt-in через animate="swap"): анимируем весь собранный Icon целиком.
    content = useIconSwap(animate, iconIdentity, iconContentReady, content) as React.ReactElement | null;

    if (!hasIconSource(baseSource) || !content) return null;

    let result = wrapLink(content) as React.ReactElement;

    if (tooltip) {
      result = (
        <IconTooltipWithPortal
          tooltip={tooltip}
          direction={tooltipDirection}
          gap={tooltipGap}
        >
          {result}
        </IconTooltipWithPortal>
      );
    }

    return result;
  }
);

Icon.displayName = 'Icon';
