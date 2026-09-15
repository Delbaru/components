import { entryKey, type UtilityEntry } from './keys';
import { utilityClassName, type Breakpoint, type Utility } from './registry';

/**
 * Значение пропа утилиты: скаляр, шорткат отступа или кортеж `[desktop, mobile, tablet]`.
 * `undefined` в кортеже наследует desktop, `null` пропускает брейкпоинт.
 */
export type ResponsiveUtilityValue = UtilityEntry | readonly (UtilityEntry | null | undefined)[];

export interface UtilitySlot {
  /** `null` — базовый класс без брейкпоинта. */
  readonly breakpoint: Breakpoint | null;
  readonly entry: UtilityEntry;
}

const isScalar = (value: unknown): value is number | string => typeof value === 'number' || typeof value === 'string';

const isBareShorthand = (utility: Utility, value: readonly unknown[]): boolean =>
  utility.shorthand === true && value.length === 4 && value.every(isScalar);

const usable = (utility: Utility, entry: UtilityEntry | null | undefined): UtilityEntry | null =>
  entry !== null && entry !== undefined && utilityClassName(utility, entry) !== null ? entry : null;

/**
 * Кортеж → минимальный набор классов. База — desktop, переопределения — только там, где значение
 * другое: `[8, 8, 8]` → `p_8`; `[8, 0, 0]` → `p_8 n_p_0`; `[24, 12, 24]` → `gap_24 m_gap_12`.
 * Пропуск (`null`) базы не даёт: `[null, 16, 16]` → `n_p_16`, `[40, null, null]` → `d_r_40`.
 */
export function utilitySlots(utility: Utility, value: ResponsiveUtilityValue | null | undefined): UtilitySlot[] {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value) || isBareShorthand(utility, value)) {
    const entry = usable(utility, value as UtilityEntry);
    return entry === null ? [] : [{ breakpoint: null, entry }];
  }

  const [d0, m0, t0] = value as readonly (UtilityEntry | null | undefined)[];
  const d = usable(utility, d0);
  const m = m0 === undefined ? d : usable(utility, m0);
  const t = t0 === undefined ? d : usable(utility, t0);
  const [kd, km, kt] = [d, m, t].map((entry) => (entry === null ? null : entryKey(entry)));

  const slots: UtilitySlot[] = [];

  if (d !== null && m !== null && t !== null) {
    slots.push({ breakpoint: null, entry: d });
    if (km === kd && kt === kd) return slots;
    if (km === kt) slots.push({ breakpoint: 'n', entry: m });
    else {
      if (km !== kd) slots.push({ breakpoint: 'm', entry: m });
      if (kt !== kd) slots.push({ breakpoint: 't', entry: t });
    }
    return slots;
  }

  if (d !== null) slots.push({ breakpoint: 'd', entry: d });
  if (m !== null && t !== null && km === kt) slots.push({ breakpoint: 'n', entry: m });
  else {
    if (m !== null) slots.push({ breakpoint: 'm', entry: m });
    if (t !== null) slots.push({ breakpoint: 't', entry: t });
  }
  return slots;
}

export const slotClassName = (utility: Utility, slot: UtilitySlot): string =>
  `${slot.breakpoint ? `${slot.breakpoint}_` : ''}${utility.name}_${entryKey(slot.entry)}`;

export function utilityClasses(utility: Utility, value: ResponsiveUtilityValue | null | undefined): string[] {
  return utilitySlots(utility, value).map((slot) => slotClassName(utility, slot));
}
