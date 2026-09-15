'use client';

import Link from 'next/link';
import { useMemo, type CSSProperties, type SVGProps } from 'react';
import type React from 'react';
import { boxLayout, cx, createLayoutClasses, resolveRadiusInput, resolveResponsive, shouldUseNextLink, splitRootDomProps, stateProps as buildStateProps, stateLinkProps, type BorderStyleProps, type ComponentStateValue, type GrowProps, type RadiusInput, type ResponsiveSpaceValue, type ResponsiveValue, type SizeInput, type SizeValue, type StateLinkInput, type WithRef, useMergedRefs } from '../core';
import { Flex } from '../Flex';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import { IconTooltipWithPortal, type IconTooltipDirection } from './IconTooltip';
import { hasIconSource, parseAspectRatio, resolveIconSource, type IconComponent, type IconSource, type ResolvedIconSource } from './svg';
import { useIconSwap, componentSwapKey, type IconAnimate } from './swap';
import { useFetchedSvg, type FetchedSvgState } from './useFetchedSvg';

const c = createLayoutClasses();

// `r` у SVG — радиус окружности; у Icon это радиус коробки (кортежем), поэтому родной убран.
type IconBaseSvgProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'color' | 'rotate' | 'strokeWidth' | 'r'>;
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

export interface IconProps extends IconBaseSvgProps, SizeInput, RadiusInput, IconRootSizeProps, IconRootStyleProps, BorderStyleProps, GrowProps, SharedMotionProps {
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
  tooltipDirection?: IconTooltipDirection;
  tooltipGap?: number;

  linkState?: StateLinkInput;

  /**
   * Анимация смены иконки. 'swap' — плавная подмена при изменении src/name/component:
   * старая уходит (opacity+scale), затем въезжает новая из scale→1.
   * Опции: animate={['swap', { duration, scale }]}.
   */
  animate?: IconAnimate;
}

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
export function Icon({
  ref,
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
}: WithRef<IconProps, SVGSVGElement>) {
  const linkRel = rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined);
  const useNextLink = shouldUseNextLink(href, target);
  const linkProps = href
    ? { href, target, rel: linkRel, className: 'ui-icon-link', 'data-point-events': dataPointEvents }
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

  // Коробка глифа: поля, радиус, размер. grow — у глифа, только когда нет root-обёртки (иначе он у неё).
  const glyphLayout = boxLayout(c, { m, mt, mr, mb, ml, ...resolvedRadiusProps, ...iconSizeProps, grow: needsRootWrapper ? undefined : grow });
  const commonClasses = [...glyphLayout, className];

  const commonStyles = {
    ...(strokeWidthVars as CSSProperties),
    ...(rotateVars as CSSProperties),
    ...style,
  };

  const stackAspectRatio = parseAspectRatio(svgViewBox || elementProps.viewBox || hoverSvgViewBox);

  // useCallback обязателен: ref-колбэк со скачущей идентичностью React отцепляет и цепляет
  // заново каждый рендер, а это сбрасывает накопленный моушен в setMotionNode(null).
  const setSvgRefs = useMergedRefs(setMotionNode, ref);

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
          className={'ui-icon'}
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
        className={'ui-icon'}
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
        className={cx('ui-icon', ...commonClasses)}
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
      className: cx('ui-icon-wrapper', ...commonClasses),
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
        className={cx('ui-icon', ...commonClasses)}
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
          'ui-icon-root',
          resolvedRootClassName,
          ...c.value('bg', resolvedRootBg),
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
