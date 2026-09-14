/** Путь SVG-ассета к виду, который понимает `<img src>` и `Icon`: абсолютный, URL или data:. */
export function normalizeSvgAssetPath(path: string) {
  if (!path) {
    return path;
  }

  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('/')) {
    return path;
  }

  return `/${path.replace(/^\.\//, '')}`;
}

/** Статический импорт `.svg` (строка или объект `{ src }` от Next) → путь; иначе undefined. */
export function resolveSvgAssetSource(asset: unknown) {
  if (typeof asset === 'string') {
    return normalizeSvgAssetPath(asset);
  }

  if (asset && typeof asset === 'object' && 'src' in asset && typeof (asset as { src?: unknown }).src === 'string') {
    return normalizeSvgAssetPath((asset as { src: string }).src);
  }

  return undefined;
}
