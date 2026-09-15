import type { ResponsiveValue } from '../base/responsive';

/**
 * Значение отступа: число — дизайн-пиксели (× `--rpx`, отрицательное тоже), строка — CSS как
 * есть (`'auto'`, `'calc(…)'`). Шорткат — массив сторон по правилам CSS; внутри кортежа
 * брейкпоинтов он вложенный: `m={[[24, 'auto'], 24, [24, 8, 12, 'auto']]}`.
 */
export type SpaceValue = number | string;

export type SpaceShorthandValue =
  | [SpaceValue]
  | [SpaceValue, SpaceValue]
  | [SpaceValue, SpaceValue, SpaceValue]
  | [SpaceValue, SpaceValue, SpaceValue, SpaceValue];

type SpaceEntry = SpaceValue | SpaceShorthandValue;

export type ResponsiveSpaceValue = ResponsiveValue<SpaceEntry> | SpaceShorthandValue;
