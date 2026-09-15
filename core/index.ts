// Публичная точка входа (barrel).
// Внутри UI-компонентов импортируем общие утилиты отсюда, например `import { ... } from '../core'`.

// base (общие утилиты — пригодятся любым компонентам)
export { getBreakpointIndex, resolveResponsive, resolveResponsiveAtBreakpoint } from './base/responsive';
export type { WithRef } from './base/with-ref';
export { assignRef, useMergedRefs } from './useMergedRefs';
export { boxLayout, splitBoxLayout } from './layout/box';
export type { BoxLayoutKey, BoxLayoutProps } from './layout/box';
export type { ResponsiveValue } from './base/responsive';
export { cx, css } from './base/cn';
export type { ClassValue } from './base/cn';

// layout: построитель классов компонента — утилиты из реестра, остальное из модуля
export { createLayoutClasses } from './layout/layout-classes';
export type { ClassBuilder, LayoutClassOptions } from './layout/layout-classes';
export { responsiveClasses } from './layout/responsive-classes';
export type { SizeValue } from './layout/size';
export type { ResponsiveSpaceValue, SpaceShorthandValue, SpaceValue } from './layout/space';
export { applyLinkedComponentState, mergeComponentStates, normalizeComponentState, stateProps, stateLinkProps, toggleLinkedComponentState, useLinkedHoverState } from './component-state';
export type { ComponentStateName, ComponentStateValue, LinkedComponentState, StateLink, StateLinkInput, StateLinkTrigger } from './component-state';

// утилиты раскладки: реестр (имя класса и CSS под него) и классы значения пропа
export { MEDIA, UTILITIES, resolveUtility } from './utilities/registry';
export type { Breakpoint, Utility } from './utilities/registry';
export { utilityClasses, utilitySlots } from './utilities/classes';
export type { ResponsiveUtilityValue, UtilitySlot } from './utilities/classes';

// shared prop types & class helpers
export { layoutSpaceClasses, numericSpaceClasses, sizeClasses, radiusClasses, borderClasses, resolveRadiusInput } from './base/shared-props';
export type { LayoutSpaceProps, NumericSpaceProps, SizePropsShort, SizeInput, RadiusPropsShort, RadiusInput, BorderStyleProps, AspectRatioProps, AspectRatioValue, GrowProps } from './base/shared-props';

// link utilities
export { buildRel, isInternalHref, resolveLinkProps, shouldUseNextLink } from './base/link-utils';
export { splitRootDomProps } from './base/root-dom-props';

// HTML / text utilities
export { decodeHtmlEntities, stripHtmlTags, sanitizeSvgMarkup, normalizeRowsValue, buildClampStyle } from './base/html-utils';
// rich-text sanitizer вынесен отдельно (DOMPurify): не тянется в общий чанк через html-utils/Text.
export { sanitizeRichTextHtml } from './base/html-sanitize';

// field control helpers
export { useFieldControl } from './useFieldControl';
export type { FieldControlConfig } from './useFieldControl';
export { fieldLayoutClasses, fieldHelperPaddingLeft } from './base/field-layout';
export type { FieldLayoutProps } from './base/field-layout';

// visibility hooks
export { useInView } from './useInView';
export type { UseInViewOptions } from './useInView';
