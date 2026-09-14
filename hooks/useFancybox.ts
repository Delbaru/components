'use client';

import { useEffect } from 'react';

let bindPromise: Promise<void> | null = null;

function ensureFancyboxBound() {
  if (bindPromise) {
    return bindPromise;
  }

  bindPromise = import('@fancyapps/ui').then(({ Fancybox }) => {
    Fancybox.bind('[data-fancybox]');
  });

  return bindPromise;
}

export function useFancybox(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void ensureFancyboxBound();
  }, [enabled]);
}