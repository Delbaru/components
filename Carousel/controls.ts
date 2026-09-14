'use client';

import { useCallback, useEffect, useState, type RefCallback } from 'react';

import type { CarouselApi, CarouselNavigationState } from './types';

const CAROUSEL_CONTROLS_EVENT = 'carousel-controls-change';

const DEFAULT_NAVIGATION_STATE: CarouselNavigationState = {
  isBeginning: true,
  isEnd: true,
  prevDisabled: true,
  nextDisabled: true,
};

export type CarouselControlsSnapshot = {
  api: CarouselApi | null;
  navigationState: CarouselNavigationState;
  activeIndex: number;
  slideCount: number;
  pageIndex: number;
  pageCount: number;
  showNavigation: boolean;
  showDots: boolean;
};

export const DEFAULT_CAROUSEL_CONTROLS_SNAPSHOT: CarouselControlsSnapshot = {
  api: null,
  navigationState: DEFAULT_NAVIGATION_STATE,
  activeIndex: 0,
  slideCount: 0,
  pageIndex: 0,
  pageCount: 0,
  showNavigation: false,
  showDots: false,
};

type CarouselRootNode = HTMLElement & {
  __carouselControlsSnapshot?: CarouselControlsSnapshot;
};

function readCarouselControlsSnapshot(node: CarouselRootNode | null): CarouselControlsSnapshot {
  return node?.__carouselControlsSnapshot ?? DEFAULT_CAROUSEL_CONTROLS_SNAPSHOT;
}

export function publishCarouselControlsSnapshot(node: HTMLElement | null, snapshot: CarouselControlsSnapshot): void {
  if (!node) return;

  const carouselNode = node as CarouselRootNode;
  carouselNode.__carouselControlsSnapshot = snapshot;
  carouselNode.dispatchEvent(new CustomEvent(CAROUSEL_CONTROLS_EVENT));
}

export function resetCarouselControlsSnapshot(node: HTMLElement | null): void {
  publishCarouselControlsSnapshot(node, DEFAULT_CAROUSEL_CONTROLS_SNAPSHOT);
}

function resolveNearestCarouselNode(node: HTMLElement | null): CarouselRootNode | null {
  if (!node) return null;

  let currentNode: HTMLElement | null = node;

  while (currentNode) {
    const carouselNodes = currentNode.querySelectorAll<CarouselRootNode>('[data-carousel-root][data-carousel-id]');

    if (carouselNodes.length === 1) {
      return carouselNodes[0];
    }

    currentNode = currentNode.parentElement;
  }

  return node.ownerDocument.querySelector<CarouselRootNode>('[data-carousel-root][data-carousel-id]');
}

function resolveCarouselNodeById(node: HTMLElement | null, targetCarouselId: string): CarouselRootNode | null {
  if (!node) return null;

  const carouselNodes = node.ownerDocument.querySelectorAll<CarouselRootNode>('[data-carousel-root][data-carousel-id]');

  for (const carouselNode of Array.from(carouselNodes)) {
    if (carouselNode.dataset.carouselId === targetCarouselId) {
      return carouselNode;
    }
  }

  return null;
}

export function useNearestCarouselControls(targetCarouselId?: string): {
  carouselId: string | null;
  setRootRef: RefCallback<HTMLElement>;
  snapshot: CarouselControlsSnapshot;
} {
  const [rootNode, setRootNode] = useState<HTMLElement | null>(null);
  const [carouselNode, setCarouselNode] = useState<CarouselRootNode | null>(null);
  const [snapshot, setSnapshot] = useState<CarouselControlsSnapshot>(DEFAULT_CAROUSEL_CONTROLS_SNAPSHOT);

  const setRootRef = useCallback<RefCallback<HTMLElement>>((node) => {
    setRootNode(node);
  }, []);

  useEffect(() => {
    if (!rootNode || typeof document === 'undefined') {
      setCarouselNode(null);
      return;
    }

    const updateCarouselNode = (): CarouselRootNode | null => {
      const nextCarouselNode = targetCarouselId
        ? resolveCarouselNodeById(rootNode, targetCarouselId)
        : resolveNearestCarouselNode(rootNode);

      setCarouselNode((currentCarouselNode) => currentCarouselNode === nextCarouselNode ? currentCarouselNode : nextCarouselNode);
      return nextCarouselNode;
    };

    const resolvedCarouselNode = updateCarouselNode();
    if (resolvedCarouselNode || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => {
      if (updateCarouselNode()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-carousel-id'],
    });

    return () => {
      observer.disconnect();
    };
  }, [rootNode, targetCarouselId]);

  useEffect(() => {
    if (!carouselNode) {
      setSnapshot(DEFAULT_CAROUSEL_CONTROLS_SNAPSHOT);
      return;
    }

    const updateSnapshot = () => {
      setSnapshot(readCarouselControlsSnapshot(carouselNode));
    };

    updateSnapshot();
    carouselNode.addEventListener(CAROUSEL_CONTROLS_EVENT, updateSnapshot as EventListener);

    return () => {
      carouselNode.removeEventListener(CAROUSEL_CONTROLS_EVENT, updateSnapshot as EventListener);
    };
  }, [carouselNode]);

  return {
    carouselId: carouselNode?.dataset.carouselId ?? targetCarouselId ?? null,
    setRootRef,
    snapshot,
  };
}