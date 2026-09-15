import {
  borderClasses,
  layoutSpaceClasses,
  radiusClasses,
  sizeClasses,
  type AspectRatioProps,
  type BorderStyleProps,
  type GrowProps,
  type LayoutSpaceProps,
  type RadiusPropsShort,
  type SizePropsShort,
} from '../base/shared-props';
import type { ClassBuilder } from './layout-classes';

/** Пропсы «коробки», которые одинаково понимает корень любого компонента. */
export interface BoxLayoutProps
  extends LayoutSpaceProps,
    SizePropsShort,
    RadiusPropsShort,
    BorderStyleProps,
    AspectRatioProps,
    GrowProps {
  bg?: string;
}

const BOX_LAYOUT_KEYS = [
  'bg',
  'p', 'pt', 'pr', 'pb', 'pl',
  'm', 'mt', 'mr', 'mb', 'ml',
  'w', 'minW', 'maxW', 'h', 'minH', 'maxH',
  'r', 'tlr', 'trr', 'brr', 'blr', 'borderTLR', 'borderTRR', 'borderBRR', 'borderBLR',
  'border', 'borderC', 'borderS', 'borderW', 'borderT', 'borderR', 'borderB', 'borderL',
  'aspectRatio', 'grow',
] as const satisfies readonly (keyof BoxLayoutProps)[];

export type BoxLayoutKey = (typeof BOX_LAYOUT_KEYS)[number];

const BOX_LAYOUT_KEY_SET: ReadonlySet<string> = new Set(BOX_LAYOUT_KEYS);

/**
 * Делит пропсы на «коробку» и остальное (остальное уходит на DOM-узел). Единственное место,
 * где нужны приведения: TypeScript не сужает тип ключа по членству в Set.
 */
export function splitBoxLayout<P extends BoxLayoutProps>(props: P): { box: BoxLayoutProps; rest: Omit<P, BoxLayoutKey> } {
  const box: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (BOX_LAYOUT_KEY_SET.has(key)) box[key] = value;
    else rest[key] = value;
  }

  return { box: box as BoxLayoutProps, rest: rest as Omit<P, BoxLayoutKey> };
}

/** Классы утилит корня из пропсов коробки. Не заданный проп ничего не добавляет. */
export function boxLayout(c: ClassBuilder, box: BoxLayoutProps): string[] {
  return [
    ...layoutSpaceClasses(c, box),
    ...radiusClasses(c, box),
    ...sizeClasses(c, box),
    ...c.value('bg', box.bg),
    ...borderClasses(c, box),
    ...c.value('ratio', box.aspectRatio),
    ...c.value('grow', box.grow),
  ];
}
