import { useEffect, useState } from 'react';

import { parseSvg, type ParsedSvg } from './svg';

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
  for (const [key, svg] of Object.entries(icons)) {
    inlineSvgRegistry.set(key, svg);
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

  const cached = svgFetchCache.get(cacheKey);
  if (cached) return cached;

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
  return request;
}

export interface FetchedSvgState {
  content: string | null;
  viewBox?: string;
  rootFill?: string;
}

export function useFetchedSvg(url: string | null, normalizeContent = false): FetchedSvgState {
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
