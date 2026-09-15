import { slotClassName, utilitySlots, type ResponsiveUtilityValue } from './classes';
import { escapeClassName, type UtilityEntry } from './keys';
import { BREAKPOINTS, MEDIA, UTILITIES, type Breakpoint, type Utility } from './registry';

/**
 * Правила таблицы утилит для генератора. В бандл приложения этот модуль не попадает: рантайму
 * нужны только имена классов (`classes.ts`), CSS под них собирает `tools/utilities`.
 */

export interface UtilityRule {
  readonly utility: Utility;
  readonly breakpoint: Breakpoint | null;
  readonly entry: UtilityEntry;
  readonly className: string;
  readonly declaration: string;
}

const rule = (utility: Utility, breakpoint: Breakpoint | null, entry: UtilityEntry): UtilityRule | null => {
  const declaration = utility.declare(entry);
  return declaration === null ? null : { utility, breakpoint, entry, className: slotClassName(utility, { breakpoint, entry }), declaration };
};

/** Ровно те классы, которые рантайм выдаст на это значение пропа. */
export function exactRules(utility: Utility, value: ResponsiveUtilityValue): UtilityRule[] {
  return utilitySlots(utility, value).flatMap((slot) => rule(utility, slot.breakpoint, slot.entry) ?? []);
}

/** Значение без известного брейкпоинта (конфиг, пресет, проброс пропа): база и все брейкпоинты. */
export function looseRules(utility: Utility, entry: UtilityEntry): UtilityRule[] {
  return [null, ...BREAKPOINTS].flatMap((breakpoint) => rule(utility, breakpoint, entry) ?? []);
}

/** Закрытые словари печатаются целиком — искать их значения в коде не нужно. */
export function domainRules(): UtilityRule[] {
  return UTILITIES.flatMap((utility) => (utility.domain ?? []).flatMap((entry) => looseRules(utility, entry)));
}

/**
 * Таблица стилей: по утилите в порядке реестра, внутри — база, затем брейкпоинты. Полное
 * свойство поэтому всегда позже своего шортката, а переопределение брейкпоинта позже базы.
 */
export function renderRules(rules: readonly UtilityRule[]): string {
  const byUtility = new Map<Utility, Map<Breakpoint | 'base', Map<string, string>>>();

  for (const item of rules) {
    const groups = byUtility.get(item.utility) ?? new Map<Breakpoint | 'base', Map<string, string>>();
    byUtility.set(item.utility, groups);
    const group = groups.get(item.breakpoint ?? 'base') ?? new Map<string, string>();
    groups.set(item.breakpoint ?? 'base', group);
    group.set(item.className, item.declaration);
  }

  const lines: string[] = [];
  const print = (group: Map<string, string> | undefined, indent: string) => {
    for (const [className, declaration] of [...(group ?? [])].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
      lines.push(`${indent}.${escapeClassName(className)} { ${declaration}; }`);
    }
  };

  for (const utility of UTILITIES) {
    const groups = byUtility.get(utility);
    if (!groups) continue;
    print(groups.get('base'), '');
    for (const breakpoint of BREAKPOINTS) {
      const group = groups.get(breakpoint);
      if (!group?.size) continue;
      lines.push(`@media ${MEDIA[breakpoint]} {`);
      print(group, '  ');
      lines.push('}');
    }
  }
  return lines.join('\n');
}
