'use client';

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import styles from './Modal.module.scss';
import {
  cx,
  createLayoutClasses,
  growStyle,
  inlineGrowClassName,
  inlineSpaceStyle,
  layoutSpaceClasses,
  needsInlineGrow,
  radiusClasses,
  resolveRadiusInput,
  sizeClasses,
  sizeInlineStyle,
  tokenStyles,
  type StateLinkInput,
  type LayoutSpaceProps,
  type RadiusPropsShort,
  type SizePropsShort,
  type ResponsiveValue,
  type SpaceValue,
  type GrowProps,
} from '../core';
import { Flex } from '../Flex';
import { useModalRuntime } from './ModalProvider';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import type { WithRef } from '../core';

type PresetKey = 'default' | 'fullWidth';

const c = createLayoutClasses([styles, tokenStyles]);


type ModalSurfaceProps = LayoutSpaceProps & RadiusPropsShort & SizePropsShort & GrowProps & SharedMotionProps & {
  id?: string;
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
  rootClassName?: string;
  overlayClassName?: string;
  style?: CSSProperties;
  rootStyle?: CSSProperties;
  overlayStyle?: CSSProperties;

  preset?: ResponsiveValue<PresetKey>;
  animation?: ResponsiveValue<'fadeInUp' | 'fadeInDown'>;

  closeOnOverlayClick?: boolean;

  /** Снять клип с панели: выпадашка `Select` живёт абсолютом ВНУТРИ поля, и `overflow: hidden`
   *  панели режет её список по нижней кромке диалога. Опт-ин, потому что клип нужен всем
   *  модалкам с внутренним скроллом и со скруглением поверх контента. */
  overflowVisible?: boolean;

  rootP?: LayoutSpaceProps['p'];
  rootPt?: ResponsiveValue<SpaceValue>;
  rootPr?: ResponsiveValue<SpaceValue>;
  rootPb?: ResponsiveValue<SpaceValue>;
  rootPl?: ResponsiveValue<SpaceValue>;
  rootM?: LayoutSpaceProps['m'];
  rootMt?: ResponsiveValue<SpaceValue>;
  rootMr?: ResponsiveValue<SpaceValue>;
  rootMb?: ResponsiveValue<SpaceValue>;
  rootMl?: ResponsiveValue<SpaceValue>;

  alignItems?: ResponsiveValue<
    'stretch' | 'center' | 'flex_start' | 'flex_end' | 'start' | 'end' | 'baseline'
  >;
  justifyContent?: ResponsiveValue<
    'start' | 'end' | 'center' | 'space_between' | 'space_around' | 'space_evenly'
  >;

  bg?: string;
  color?: string;

  'aria-label'?: string;
  'aria-labelledby'?: string;
  'data-point-events'?: string;

  linkState?: StateLinkInput;
};

export type ModalProps = Omit<ModalSurfaceProps, 'open' | 'onClose'>;

function ModalSurface({
  ref,
  id,
  open,
  onClose,
  children,
  className = '',
  rootClassName,
  overlayClassName,
  style: panelStyle,
  rootStyle,
  overlayStyle,
  preset = 'default',
  animation,
  closeOnOverlayClick = true,
  overflowVisible = false,
  p,
  pt,
  pr,
  pb,
  pl,
  m,
  mt,
  mr,
  mb,
  ml,
  rootP,
  rootPt,
  rootPr,
  rootPb,
  rootPl,
  rootM,
  rootMt,
  rootMr,
  rootMb,
  rootMl,
  r,
  tlr,
  trr,
  brr,
  blr,
  borderTLR,
  borderTRR,
  borderBRR,
  borderBLR,
  w,
  minW,
  maxW,
  h,
  minH,
  maxH,
  grow,
  perspective3d,
  parallax,
  alignItems,
  justifyContent,
  bg,
  color,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'data-point-events': dataPointEvents,
  linkState,
}: WithRef<ModalSurfaceProps, HTMLDivElement>) {
  const radiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR });
  const bgClasses = c.literal('bg', bg);
  const colorClasses = c.literal('color', color);
  const hasBgClass = Boolean(bgClasses[0]);
  const hasColorClass = Boolean(colorClasses[0]);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [entered, setEntered] = useState(false);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(t);
    }
    const t = requestAnimationFrame(() => setEntered(false));
    return () => cancelAnimationFrame(t);
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      panel.focus();
    }
    return () => {
      previousActiveElement.current?.focus();
    };
  }, [open]);

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) onClose();
  };

  const setPanelNode = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setMotionNode(node);
  }, [setMotionNode]);

  const mergedRootStyle = {
    ...inlineSpaceStyle({ p: rootP, pt: rootPt, pr: rootPr, pb: rootPb, pl: rootPl, m: rootM, mt: rootMt, mr: rootMr, mb: rootMb, ml: rootMl }),
    ...growStyle(grow),
    ...rootStyle,
  };

  return (
    <Flex
      ref={ref}
      linkState={linkState}
      data-point-events={dataPointEvents}
      className={cx(
        styles.Modal,
        rootClassName,
        ...c.enum('animation', animation),
        ...layoutSpaceClasses(c, { p: rootP, pt: rootPt, pr: rootPr, pb: rootPb, pl: rootPl, m: rootM, mt: rootMt, mr: rootMr, mb: rootMb, ml: rootMl }),
        needsInlineGrow(grow) && inlineGrowClassName()
      )}
      data-open={open}
      data-entered={entered}
      role="presentation"
      aria-hidden={!open}
      align={alignItems ?? 'center'}
      justify={justifyContent ?? 'center'}
      style={mergedRootStyle}
    >
      <div
        className={cx(styles.Overlay, overlayClassName)}
        style={overlayStyle}
        onClick={handleOverlayClick}
        onKeyDown={handleKeyDown}
        role="presentation"
      />
      <div
        id={id}
        ref={setPanelNode}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        data-lenis-prevent
        data-lenis-prevent-wheel
        data-lenis-prevent-touch
        tabIndex={-1}
        className={cx(
          styles.Panel,
          overflowVisible && styles.overflowVisible,
          ...c.enum('preset', preset),
          ...layoutSpaceClasses(c, { p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
          ...radiusClasses(c, radiusProps),
          ...sizeClasses(c, { w, minW, maxW, h, minH, maxH }),
          ...bgClasses,
          ...colorClasses,
          className
        )}
        style={{
          ...(bg && !hasBgClass ? { background: bg } : null),
          ...(color && !hasColorClass ? { color } : null),
          ...inlineSpaceStyle({ p, pt, pr, pb, pl, m, mt, mr, mb, ml }),
          ...sizeInlineStyle({ w, minW, maxW, h, minH, maxH }),
          ...(motionStyle ?? null),
          ...panelStyle,
        }}
        {...motionHandlers}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={cx(styles.inner, overflowVisible && styles.innerOverflowVisible)}>{children}</div>
      </div>
    </Flex>
  );
}

export function Modal({ ref, ...props }: WithRef<ModalProps, HTMLDivElement>) {
  const { open, dismiss } = useModalRuntime();

  return <ModalSurface {...props} ref={ref} open={open} onClose={dismiss} />;
}
