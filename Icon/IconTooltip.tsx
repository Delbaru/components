'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type React from 'react';

import { stateProps as buildStateProps } from '../core';
import { useAnchoredFloating } from '../hooks/useAnchoredFloating';

export type IconTooltipDirection = 'right' | 'left' | 'top' | 'bottom';

type IconTooltipWithPortalProps = {
  children: React.ReactElement;
  tooltip: React.ReactNode;
  direction: IconTooltipDirection;
  gap: number;
};

export function IconTooltipWithPortal({ children, tooltip, direction, gap }: IconTooltipWithPortalProps) {
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
    // Без этого всплывашка на mouseleave мгновенно уезжает за экран, и уход не виден вовсе.
    keepPositionWhenInactive: true,
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
        className={'ui-icon-tooltip-wrapper'}
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
          className={'ui-icon-tooltip'}
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
