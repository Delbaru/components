const STATE_ATTRIBUTE = 'state';

export type ComponentStateName = string;
export type ComponentStateValue = ComponentStateName | readonly ComponentStateName[] | null | undefined;
export type LinkedComponentState = readonly [targetId: string, state: ComponentStateValue];

// ---------------------------------------------------------------------------
// State-link API: universal linkState prop + stateLinkProps helper
// ---------------------------------------------------------------------------

/** Trigger that activates the link: hover, click (toggle), active (mousedown/up), focus. */
export type StateLinkTrigger = 'hover' | 'click' | 'active' | 'focus';

/** One rule: "on <trigger> of THIS element, set <state> on <target> element". */
export interface StateLink {
  target: string;
  on: StateLinkTrigger;
  set: ComponentStateValue;
}

/**
 * Universal input for `linkState` prop.
 * - `string` — shorthand → `{ target: id, on: 'hover', set: 'hover' }`
 * - `StateLink` — single rule
 * - `StateLink[]` — multiple rules
 */
export type StateLinkInput = string | StateLink | StateLink[];

// ---------------------------------------------------------------------------
// Internal tokenizer
// ---------------------------------------------------------------------------

function tokenizeComponentState(value: ComponentStateValue): string[] {
  if (!value) return [];

  const rawValues = Array.isArray(value) ? value : [value];
  const states: string[] = [];

  for (const item of rawValues) {
    if (!item) continue;

    for (const token of item.split(/\s+/)) {
      const normalizedToken = token.trim();

      if (!normalizedToken || states.includes(normalizedToken)) continue;
      states.push(normalizedToken);
    }
  }

  return states;
}

// ---------------------------------------------------------------------------
// Low-level helpers (kept exported for direct use where needed)
// ---------------------------------------------------------------------------

export function normalizeComponentState(value: ComponentStateValue): string | undefined {
  const states = tokenizeComponentState(value);
  return states.length > 0 ? states.join(' ') : undefined;
}

/**
 * Собирает state-атрибут из нескольких значений.
 * Falsy значения (false, null, undefined, '') автоматически отфильтровываются.
 *
 * Использование:
 *   {...stateProps(state, disabled && 'disabled', displayError && 'error')}
 */
export function stateProps(...values: (ComponentStateValue | false)[]): { state: string } | Record<string, never> {
  const filtered = values.filter(Boolean) as ComponentStateValue[];
  const s = mergeComponentStates(...filtered);
  return s ? { state: s } : {};
}

export function mergeComponentStates(...values: ComponentStateValue[]): string | undefined {
  const states: string[] = [];

  for (const value of values) {
    for (const token of tokenizeComponentState(value)) {
      if (!states.includes(token)) {
        states.push(token);
      }
    }
  }

  return states.length > 0 ? states.join(' ') : undefined;
}

function removeComponentStates(currentValue: string | null, valueToRemove: ComponentStateValue): string | undefined {
  const removableStates = tokenizeComponentState(valueToRemove);
  const nextStates = tokenizeComponentState(currentValue).filter((token) => !removableStates.includes(token));
  return nextStates.length > 0 ? nextStates.join(' ') : undefined;
}

export function applyLinkedComponentState(linkedState: LinkedComponentState | undefined, isActive: boolean): void {
  if (!linkedState || typeof document === 'undefined') return;

  const [targetId, stateValue] = linkedState;
  if (!targetId) return;

  const target = document.getElementById(targetId);
  if (!target) return;

  const nextState = isActive
    ? mergeComponentStates(target.getAttribute(STATE_ATTRIBUTE), stateValue)
    : removeComponentStates(target.getAttribute(STATE_ATTRIBUTE), stateValue);

  if (nextState) {
    target.setAttribute(STATE_ATTRIBUTE, nextState);
    return;
  }

  target.removeAttribute(STATE_ATTRIBUTE);
}

export function toggleLinkedComponentState(linkedState: LinkedComponentState | undefined): void {
  if (!linkedState || typeof document === 'undefined') return;

  const [targetId, stateValue] = linkedState;
  if (!targetId) return;

  const target = document.getElementById(targetId);
  if (!target) return;

  const currentTokens = tokenizeComponentState(target.getAttribute(STATE_ATTRIBUTE));
  const toggleTokens = tokenizeComponentState(stateValue);
  const allPresent = toggleTokens.length > 0 && toggleTokens.every((t) => currentTokens.includes(t));

  applyLinkedComponentState(linkedState, !allPresent);
}

export function useLinkedHoverState(state: ComponentStateValue, isHovered: boolean): string | undefined {
  return mergeComponentStates(state, isHovered ? 'hover' : undefined);
}

// ---------------------------------------------------------------------------
// stateLinkProps — universal handler builder for linkState prop
// ---------------------------------------------------------------------------

type EventHandler = ((...args: any[]) => void) | undefined;

function mergeHandlers(...fns: EventHandler[]): EventHandler {
  const defined = fns.filter(Boolean) as ((...args: any[]) => void)[];
  if (defined.length === 0) return undefined;
  if (defined.length === 1) return defined[0];
  return (...args: any[]) => { for (const fn of defined) fn(...args); };
}

function normalizeLinks(input: StateLinkInput): StateLink[] {
  if (typeof input === 'string') return [{ target: input, on: 'hover', set: 'hover' }];
  if (Array.isArray(input)) return input;
  return [input];
}

/**
 * Build spread-ready props (data-attr + merged event handlers) for a linkState config.
 *
 * @example
 * ```tsx
 * const { linkState, onMouseEnter, onMouseLeave, ...rest } = props;
 * <div {...stateLinkProps(linkState, { onMouseEnter, onMouseLeave })} {...rest} />
 * ```
 */
export function stateLinkProps(
  input: StateLinkInput | undefined,
  userHandlers?: Record<string, EventHandler>,
): Record<string, any> {
  const uh = userHandlers ?? {};

  // No links — just pass user handlers through
  if (!input) {
    const result: Record<string, any> = {};
    for (const [key, handler] of Object.entries(uh)) {
      if (handler) result[key] = handler;
    }
    return result;
  }

  const links = normalizeLinks(input);
  const byTrigger = (t: StateLinkTrigger) => links.filter((l) => l.on === t);

  const hoverLinks = byTrigger('hover');
  const clickLinks = byTrigger('click');
  const activeLinks = byTrigger('active');
  const focusLinks = byTrigger('focus');

  const result: Record<string, any> = {};

  // data attribute with all target IDs (useful for CSS / debugging)
  const targetIds = [...new Set(links.map((l) => l.target))].join(' ');
  if (targetIds) result['data-link-targets'] = targetIds;

  // --- build link-only handlers per event ---
  const lh: Record<string, EventHandler> = {};

  if (hoverLinks.length > 0) {
    lh.onMouseEnter = () => { for (const l of hoverLinks) applyLinkedComponentState([l.target, l.set], true); };
    lh.onMouseLeave = () => { for (const l of hoverLinks) applyLinkedComponentState([l.target, l.set], false); };
  }

  if (activeLinks.length > 0) {
    lh.onMouseDown = () => { for (const l of activeLinks) applyLinkedComponentState([l.target, l.set], true); };
    lh.onMouseUp = () => { for (const l of activeLinks) applyLinkedComponentState([l.target, l.set], false); };
    // also clean active state on mouse leave (safety — mouseup may fire outside)
    lh.onMouseLeave = mergeHandlers(lh.onMouseLeave, () => {
      for (const l of activeLinks) applyLinkedComponentState([l.target, l.set], false);
    });
  }

  if (clickLinks.length > 0) {
    lh.onClick = () => { for (const l of clickLinks) toggleLinkedComponentState([l.target, l.set]); };
  }

  if (focusLinks.length > 0) {
    lh.onFocus = () => { for (const l of focusLinks) applyLinkedComponentState([l.target, l.set], true); };
    lh.onBlur = () => { for (const l of focusLinks) applyLinkedComponentState([l.target, l.set], false); };
  }

  // --- merge link handlers with user handlers ---
  const allKeys = new Set([...Object.keys(lh), ...Object.keys(uh)]);
  for (const key of allKeys) {
    const merged = mergeHandlers(lh[key], uh[key]);
    if (merged) result[key] = merged;
  }

  return result;
}