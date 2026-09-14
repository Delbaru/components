'use client';

import { Lenis as ReactLenis, useLenis } from 'lenis/react';
import { LenisScrollProvider, LenisScrollProviderNative } from './LenisScrollContext';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const LENIS_OPTIONS = {
  orientation: 'vertical' as const,
  autoRaf: true,
  duration: 3,           // длительность плавного скролла (сек)
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
  smoothWheel: true,      // плавное колёсико
  wheelMultiplier: 0.8,     // чувствительность колёсика
  touchMultiplier: 2,      // чувствительность тача
  syncTouch: true,        // синхронизация с тач-событиями
  lerp: 0.1,              // инерция (0–1: меньше = плавнее/медленнее)
};

/**
 * Stops any in-flight Lenis animation and resets scroll to top on route change.
 * Must live inside <ReactLenis> so useLenis() can grab the instance.
 */
function LenisResetOnNavigate() {
  const pathname = usePathname();
  const lenis = useLenis();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Skip the very first mount — only act on actual navigation
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;

    const reset = () => {
      if (lenis) {
        lenis.stop();
        lenis.scrollTo(0, { immediate: true });
        lenis.start();
      }
      window.scrollTo(0, 0);
    };

    // Multiple attempts: immediate, double-RAF, and a delayed fallback so navigation
    // before Lenis instantiation (or with delayed paint) still snaps to top.
    reset();
    requestAnimationFrame(() => requestAnimationFrame(reset));
    setTimeout(reset, 120);
  }, [pathname, lenis]);

  return null;
}

/**
 * Native (non-Lenis) scroll reset on route change for mobile/tablet.
 */
function NativeResetOnNavigate() {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

type LenisScrollProps = {
  children: ReactNode;
};

// Условия, при которых Lenis (а значит и фулпейдж поверх него) вообще уместен. Оба — МЕДИА-ЗАПРОСЫ,
// и это не стилистика: гейт брейкпоинта в JS обязан быть тем же ВЫРАЖЕНИЕМ, что в CSS, иначе на
// граничной ширине раскладка и пружина расходятся (§12 «Гейт брейкпоинта в JS и в CSS»). Со строгим
// `innerWidth <= 1024` тут уже была щель в один пиксель вьюпорта: фулпейдж-секции брали десктопную
// `height: 100dvh` из `min-width: 1024px`, а навигация была выключена — блоки в экран, колесо обычное.
// Теперь строка ОДНА И ТА ЖЕ, и разойтись ей не с чем.
//
// Ориентация в гейте — не перестраховка: планшет ≥1024 стоймя (1024×1366) получает десктопную
// раскладку, но экран у него ВЫШЕ композиции, и одноэкранный режим превращал каждую секцию в
// 1366px пустоты вокруг 309px контента. В портрете блоки идут натуральной высотой обычным потоком,
// поэтому и пружина фулпейджа там не нужна.
const DESKTOP_QUERY = '(min-width: 1024px) and (orientation: landscape)';
// Вечный rAF и smooth-lerp Lenis — ровно то, что reduced-motion просит выключить.
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function shouldUseLenis(): boolean {
  if (typeof window === 'undefined') return false;
  // Фолбэк для окружений без matchMedia: там нет и подписки, поведение остаётся прежним — один
  // замер на монтировании.
  if (typeof window.matchMedia !== 'function') return window.innerWidth >= 1024 && window.innerWidth > window.innerHeight;

  return window.matchMedia(DESKTOP_QUERY).matches && !window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function LenisScroll({ children }: LenisScrollProps) {
  // Default to native on SSR to avoid swapping Lenis → native on first paint (mobile jump)
  const [useLenis, setUseLenis] = useState<boolean>(shouldUseLenis);

  // Гейт ПЕРЕСЧИТЫВАЕТСЯ, пока страница живёт: раньше здесь стоял один замер на монтировании
  // («no resize toggling to prevent mid-scroll branch swaps»), и цена этого решения была не в
  // теории, а на экране. Замер до правки: открыть на 1440 → `html.class = 'lenis'` и секции 894
  // (кадр в экран), сузить окно до 390 → раскладка честно становится мобильной (секции
  // 1294/1432/981), а `html.class` ОСТАЁТСЯ `lenis` — то есть пружина фулпейджа продолжает
  // перехватывать колесо на телефонной вёрстке (400 колеса дают 451 позиции вместо 400).
  // Свежая загрузка на той же ширине даёт `html.class = ''`, то есть одна и та же ширина вела себя
  // двумя разными способами в зависимости от истории окна.
  //
  // Подписываемся на СМЕНУ медиа-запроса, а не на `resize`: событие приходит ровно на пересечении
  // порога (дребезг окна при перетаскивании края и смена высоты от адресной строки телефона его не
  // поднимают вовсе), гасить его дебаунсом не нужно, и оно же ловит переключение reduced-motion в
  // настройках ОС — прежний код про него узнавал только после перезагрузки.
  //
  // ⚠️ Пересечение 1024 перемонтирует поддерево (у веток разные корни: `ReactLenis` рисует свой
  // `div`, нативная — только провайдер), то есть страница начинается с чистого состояния. Это
  // осознанная плата: переход через порог — редкое и намеренное действие (поворот планшета,
  // перетаскивание края окна), а альтернатива — фулпейдж, который «залипает» на телефоне.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const queries = [window.matchMedia(DESKTOP_QUERY), window.matchMedia(REDUCED_MOTION_QUERY)];
    const sync = () => {
      const next = shouldUseLenis();
      setUseLenis((prev) => (prev === next ? prev : next));
    };

    sync();
    queries.forEach((query) => query.addEventListener('change', sync));

    return () => queries.forEach((query) => query.removeEventListener('change', sync));
  }, []);

  if (!useLenis) {
    return (
      <LenisScrollProviderNative>
        <NativeResetOnNavigate />
        {children}
      </LenisScrollProviderNative>
    );
  }

  return (
    <ReactLenis root options={LENIS_OPTIONS} style={{ height: '100%' }}>
      <LenisResetOnNavigate />
      <LenisScrollProvider>{children}</LenisScrollProvider>
    </ReactLenis>
  );
}