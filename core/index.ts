// Публичная точка входа (barrel).
// Внутри UI-компонентов импортируем общие утилиты отсюда, например `import { ... } from '../core'`.

// base (общие утилиты — пригодятся любым компонентам)
export { getBreakpointIndex, resolveResponsive, resolveResponsiveAtBreakpoint } from './base/responsive';
export type { WithRef } from './base/with-ref';
export type { ResponsiveValue } from './base/responsive';
export { cx, css } from './base/cn';
export type { ClassValue } from './base/cn';

// layout (layout-DSL — пригодится Flex/Grid/Box/Section и будущим UI-компонентам)
export { responsiveClasses } from './layout/responsive-classes';
export type { StyleMaps } from './layout/responsive-classes';
export { sizeClassKey, inlineOnlySize, inlineSizeStyle } from './layout/size';
export type { SizeValue } from './layout/size';
export { inlineSpaceStyle, spaceClassKey } from './layout/space';
export type { ResponsiveSpaceValue, SpaceShorthandValue, SpaceValue } from './layout/space';
export { createLayoutClasses } from './layout/layout-classes';
export { applyLinkedComponentState, mergeComponentStates, normalizeComponentState, stateProps, stateLinkProps, toggleLinkedComponentState, useLinkedHoverState } from './component-state';
export type { ComponentStateName, ComponentStateValue, LinkedComponentState, StateLink, StateLinkInput, StateLinkTrigger } from './component-state';

// shared token styles: глобальный слой токенов + identity-прокси (см. token-classes.ts).
export { tokenStyles } from './token-classes';

// shared prop types & class/style helpers
export { layoutSpaceClasses, numericSpaceClasses, sizeClasses, radiusClasses, borderClasses, sizeInlineStyle, aspectRatioStyle, needsInlineAspectRatio, inlineAspectRatioClassName, needsInlineGrow, inlineGrowClassName, growStyle, resolveBorderClassResolution, resolveBorderStyles, resolveRadiusInput, responsiveValueHasFullClassCoverage } from './base/shared-props';
export type { ClassBuilder, LayoutSpaceProps, NumericSpaceProps, SizePropsShort, SizeInput, RadiusPropsShort, RadiusInput, BorderStyleProps, BorderClassResolution, BorderStyleSkipMap, AspectRatioProps, AspectRatioValue, GrowProps } from './base/shared-props';

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
export { fieldLayoutClasses, fieldLayoutStyles, resolveFieldLayoutClassResolution, fieldHelperPaddingLeft } from './base/field-layout';
export type { FieldLayoutClassResolution, FieldLayoutProps } from './base/field-layout';

// visibility hooks
export { useInView } from './useInView';
export type { UseInViewOptions } from './useInView';
