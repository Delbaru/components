import type { CSSProperties } from 'react';

/**
 * Значение width/height/min/max: число — дизайн-пиксели (× `--rpx`), строка — CSS как есть
 * (`'100%'`, `'fit-content'`, `'calc(…)'`). Любое значение становится классом утилиты.
 */
export type SizeValue = number | (CSSProperties['width'] & string);
