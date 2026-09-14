'use client';

import styles from './RichText.module.scss';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx, createLayoutClasses, getBreakpointIndex, resolveResponsiveAtBreakpoint, buildClampStyle, decodeHtmlEntities, growStyle, inlineGrowClassName, needsInlineGrow, radiusClasses, responsiveValueHasFullClassCoverage, sanitizeRichTextHtml, stripHtmlTags, sizeClasses, sizeInlineStyle, stateLinkProps, tokenStyles, resolveRadiusInput, type GrowProps, type RadiusPropsShort, type StateLinkInput, type ResponsiveValue, type SizeValue } from '../core';
import { renderLexicalContent } from './LexicalRenderer';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

const c = createLayoutClasses([styles, tokenStyles]);

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type Block =
  | { type: 'heading'; level: HeadingLevel; content: string }
  | { type: 'paragraph'; parts: string[] }
  | { type: 'list'; tag: 'ul' | 'ol'; items: string[] };

type LexicalNode = {
  type?: string;
  text?: string;
  children?: LexicalNode[];
};

const BR_REGEX = /<br\s*\/?>/gi;
const BLOCK_TAG_REGEX = /<(h[1-6]|p|ul|ol)>([\s\S]*?)<\/\1>/gi;

export type AnimationKey = 'counter' | 'textSlide' | 'textClip';

export interface TextSlideOptions {
  steps: string[];
  currentStep: number;
  duration?: number;
  lineHeight?: string;
}

export interface TextClipOptions {
  steps: string[];
  currentStep: number;
  duration?: number;
  clipHeight?: string;
}

export type AnimationInput =
  | AnimationKey
  | [AnimationKey]
  | [AnimationKey, TextSlideOptions | TextClipOptions];

function parseAnimation(animation: ResponsiveValue<AnimationInput> | undefined): {
  animation: ResponsiveValue<AnimationKey> | undefined;
  textSlideOptions: ResponsiveValue<TextSlideOptions | undefined> | undefined;
  textClipOptions: ResponsiveValue<TextClipOptions | undefined> | undefined;
} {
  if (animation === undefined) {
    return { animation: undefined, textSlideOptions: undefined, textClipOptions: undefined };
  }

  const normalize = (v: AnimationInput): { key: AnimationKey; options?: TextSlideOptions | TextClipOptions } => {
    if (Array.isArray(v) && v.length >= 1) {
      const key = v[0] as AnimationKey;
      const options = v.length >= 2 ? (v[1] as TextSlideOptions | TextClipOptions) : undefined;
      return { key, options };
    }
    return { key: v as AnimationKey };
  };

  if (!Array.isArray(animation)) {
    const { key, options } = normalize(animation as AnimationInput);
    return {
      animation: key,
      textSlideOptions: key === 'textSlide' ? options as TextSlideOptions : undefined,
      textClipOptions: key === 'textClip' ? options as TextClipOptions : undefined,
    };
  }

  if (animation.length === 3) {
    const keys = animation.map((x) => (x != null ? normalize(x as AnimationInput).key : null)) as [
      AnimationKey | null,
      AnimationKey | null,
      AnimationKey | null,
    ];
    const options = animation.map((x) =>
      x != null && Array.isArray(x) && x.length >= 2 ? (x[1] as TextSlideOptions | TextClipOptions) : undefined
    ) as [TextSlideOptions | TextClipOptions | undefined, TextSlideOptions | TextClipOptions | undefined, TextSlideOptions | TextClipOptions | undefined];
    return {
      animation: keys as ResponsiveValue<AnimationKey>,
      textSlideOptions: options.map(o => o && (o as TextSlideOptions)) as ResponsiveValue<TextSlideOptions | undefined>,
      textClipOptions: options.map(o => o && (o as TextClipOptions)) as ResponsiveValue<TextClipOptions | undefined>,
    };
  }

  const { key, options } = normalize(animation as AnimationInput);
  return {
    animation: key,
    textSlideOptions: key === 'textSlide' ? options as TextSlideOptions : undefined,
    textClipOptions: key === 'textClip' ? options as TextClipOptions : undefined,
  };
}

function parseListContent(content: string): string[] {
  const items: string[] = [];
  const liRegex = /<li>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(content)) !== null) {
    items.push((match[1] ?? '').trim());
  }
  return items;
}

function normalizeListTags(content: string): string {
  return content
    .replace(/<ul[^>]*>/gi, '<ul>')
    .replace(/<ol[^>]*>/gi, '<ol>')
    .replace(/<li[^>]*>/gi, '<li>');
}

function parseRichText(content: string): Block[] {
  if (!content.trim()) return [];
  content = sanitizeRichTextHtml(normalizeListTags(content));

  const blocks: Block[] = [];
  let lastIndex = 0;
  const re = new RegExp(BLOCK_TAG_REGEX.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index).trim();
    if (before) {
      const parts = before.split(BR_REGEX).map((s) => s.trim()).filter(Boolean);
      if (parts.length) blocks.push({ type: 'paragraph', parts });
    }
    const [, tag = '', body = ''] = match;
    if (tag.startsWith('h')) {
      const level = parseInt(tag.slice(1)) as HeadingLevel;
      blocks.push({ type: 'heading', level, content: body.trim() });
    } else if (tag === 'p') {
      const parts = body.split(BR_REGEX).map((s) => s.trim()).filter(Boolean);
      if (parts.length) blocks.push({ type: 'paragraph', parts });
    } else if (tag === 'ul' || tag === 'ol') {
      const items = parseListContent(body);
      blocks.push({ type: 'list', tag, items });
    }
    lastIndex = re.lastIndex;
  }

  const after = content.slice(lastIndex).trim();
  if (after) {
    const parts = after.split(BR_REGEX).map((s) => s.trim()).filter(Boolean);
    if (parts.length) blocks.push({ type: 'paragraph', parts });
  }

  return blocks;
}

function renderBlocks(blocks: Block[]): ReactNode[] {
  return blocks.flatMap((block, blockIndex) => {
    if (block.type === 'heading') {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return [<Tag key={`heading-${block.level}-${blockIndex}`} dangerouslySetInnerHTML={{ __html: block.content }} />];
    }

    if (block.type === 'list') {
      const Tag = block.tag;
      return [
        <Tag key={`list-${block.tag}-${blockIndex}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`list-item-${blockIndex}-${itemIndex}`} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </Tag>,
      ];
    }

    // Строки внутри одного абзаца (split по <br>) рендерим единым <p> с <br/> между ними:
    // перенос строки остаётся «тесным», а отступ между абзацами даёт margin самого <p>.
    return [
      <p key={`paragraph-${blockIndex}`} dangerouslySetInnerHTML={{ __html: block.parts.join('<br/>') }} />,
    ];
  });
}

function flattenBlocksToText(blocks: Block[]): string {
  return blocks
    .flatMap((block) => {
      if (block.type === 'heading') return [block.content];
      if (block.type === 'list') return block.items;
      return block.parts;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLexicalPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';

  const lexicalNode = node as LexicalNode & { root?: LexicalNode };

  if (typeof lexicalNode.text === 'string') {
    return lexicalNode.text;
  }

  if (Array.isArray(lexicalNode.children)) {
    return lexicalNode.children.map((child) => extractLexicalPlainText(child)).join(' ');
  }

  if (lexicalNode.root) {
    return extractLexicalPlainText(lexicalNode.root);
  }

  return '';
}

export type LexicalTextVariant = 'default' | 'style-1' | 'style-2' | 'style-3' | 'style-4' | 'style-5';

export interface LexicalTextProps extends Omit<HTMLAttributes<HTMLDivElement>, 'color'>, RadiusPropsShort, GrowProps, SharedMotionProps {
  content?: string | any; // string for HTML, object for Lexical JSON
  variant?: ResponsiveValue<LexicalTextVariant>;
  w?: ResponsiveValue<SizeValue>;
  h?: ResponsiveValue<SizeValue>;
  animation?: ResponsiveValue<AnimationInput>;
  rows?: ResponsiveValue<number>;
  ellipsis?: boolean;
  bg?: string;
  color?: string;
  className?: string;
  style?: CSSProperties;

  linkState?: StateLinkInput;
}

export function LexicalText({ content, variant = 'default', w, h, animation, rows, ellipsis, bg, color, r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR, grow, perspective3d, parallax, className = '', style, linkState, onMouseEnter, onMouseLeave, ...props }: LexicalTextProps) {
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
  const radiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR });
  const bgClasses = c.literal('bg', bg);
  const colorClasses = c.literal('color', color);
  const hasBgClass = responsiveValueHasFullClassCoverage(bg, bgClasses);
  const hasColorClass = responsiveValueHasFullClassCoverage(color, colorClasses);
  const setRootRef = useCallback((node: HTMLDivElement | null) => {
    setMotionNode(node);
  }, [setMotionNode]);
  const linkedHandlers = stateLinkProps(linkState, { onMouseEnter, onMouseLeave, ...motionHandlers });
  const hasRows = rows !== undefined;
  const hasSingleLineEllipsis = Boolean(ellipsis) && !hasRows;
  const clampStyle = buildClampStyle(rows);
  const [breakpointIndex, setBreakpointIndex] = useState<0 | 1 | 2>(0);
  const rootClassName = cx(
    styles.RichText,
    ...radiusClasses(c, radiusProps),
    ...sizeClasses(c, { w, h }),
    ...bgClasses,
    ...colorClasses,
    needsInlineGrow(grow) && inlineGrowClassName(),
    className
  );
  const rootStyle = {
    ...(bg && !hasBgClass ? { background: bg } : null),
    ...(color && !hasColorClass ? { color } : null),
    ...sizeInlineStyle({ w, h }),
    ...growStyle(grow),
    ...(motionStyle ?? null),
    ...style,
  } satisfies CSSProperties;
  const resolvedVariant = resolveResponsiveAtBreakpoint(variant, 'default', breakpointIndex);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateBreakpoint = () => {
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      setBreakpointIndex(getBreakpointIndex(viewportWidth));
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);

    return () => {
      window.removeEventListener('resize', updateBreakpoint);
    };
  }, []);
  
  // Detect if content is Lexical JSON (object with root.children) vs HTML string
  const isLexicalJSON = content && typeof content === 'object' && content.root?.children;
  
  // If Lexical JSON, render it directly without animation support
  if (isLexicalJSON) {
    const previewText = extractLexicalPlainText(content).replace(/\s+/g, ' ').trim();

    if ((hasRows || hasSingleLineEllipsis) && previewText) {
      return (
        <div
          ref={setRootRef}
          className={cx(rootClassName, styles[resolvedVariant])}
          style={rootStyle}
          {...linkedHandlers}
          {...props}
        >
          <p className={cx(styles.previewText, hasRows && styles.clamp, hasSingleLineEllipsis && styles.ellipsis)} style={clampStyle}>
            {previewText}
          </p>
        </div>
      );
    }
    
    return (
      <div
        ref={setRootRef}
        className={cx(rootClassName, styles[resolvedVariant])}
        style={rootStyle}
        {...linkedHandlers}
        {...props}
      >
        {renderLexicalContent(content)}
      </div>
    );
  }
  
  // Otherwise, treat as HTML string (legacy behavior)
  const htmlContent = typeof content === 'string' ? content : '';

  const parsed = parseAnimation(animation);
  const resolvedAnim = resolveResponsiveAtBreakpoint(parsed.animation, undefined, breakpointIndex);
  const resolvedTextSlideOpts = resolveResponsiveAtBreakpoint(parsed.textSlideOptions, undefined, breakpointIndex);
  const resolvedTextClipOpts = resolveResponsiveAtBreakpoint(parsed.textClipOptions, undefined, breakpointIndex);
  const isTextSlide = resolvedAnim === 'textSlide' && resolvedTextSlideOpts?.steps != null;
  const isTextClip = resolvedAnim === 'textClip' && resolvedTextClipOpts?.steps != null;

  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [heights, setHeights] = useState<number[]>([]);
  const [cumHeights, setCumHeights] = useState<number[]>([]);
  const [containerHeight, setContainerHeight] = useState(0);

  const [displayedStep, setDisplayedStep] = useState(resolvedTextClipOpts?.currentStep ?? 0);
  const [clipPath, setClipPath] = useState('inset(0 0 0 0)');

  useEffect(() => {
    if ((isTextSlide || isTextClip) && itemRefs.current.length > 0) {
      const hs = itemRefs.current.map(el => el?.offsetHeight || 0);
      setHeights(hs);
      if (isTextSlide) {
        const cum = hs.reduce((acc, h) => {
          const prev = acc[acc.length - 1] || 0;
          return [...acc, prev + h];
        }, [] as number[]);
        setCumHeights(cum);
        setContainerHeight(hs[resolvedTextSlideOpts?.currentStep ?? 0] || 0);
      }
    }
  }, [isTextSlide, isTextClip, resolvedTextSlideOpts?.steps, resolvedTextSlideOpts?.currentStep, resolvedTextClipOpts?.steps]);

  useEffect(() => {
    if (resolvedTextClipOpts && displayedStep !== resolvedTextClipOpts.currentStep) {
      const duration = resolvedTextClipOpts.duration || 1;
      const durationMs = duration * 1000;
      const opts = resolvedTextClipOpts;
      const t = setTimeout(() => {
        setClipPath('inset(0 0 100% 0)');
        setTimeout(() => {
          setDisplayedStep(opts.currentStep);
          setClipPath('inset(100% 0 0 0)');
          setTimeout(() => {
            setClipPath('inset(0 0 0 0)');
          }, 0);
        }, durationMs);
      }, 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [resolvedTextClipOpts?.currentStep, displayedStep, resolvedTextClipOpts]);

  if (isTextSlide) {
    const translateY = cumHeights[(resolvedTextSlideOpts?.currentStep ?? 0) - 1] || 0;
    return (
      <div
        ref={setRootRef}
        className={cx(rootClassName, styles[resolvedVariant], styles.animation_textSlide)}
        style={rootStyle}
        {...linkedHandlers}
      >
        <div
          className={styles.textContainer}
          style={{
            height: containerHeight,
            position: 'relative',
            transform: `translateY(-${translateY}px)`,
            transition: `height ${resolvedTextSlideOpts.duration || 1}s ease, transform ${resolvedTextSlideOpts.duration || 1}s ease`,
          }}
        >
          {resolvedTextSlideOpts.steps.map((stepContent, index) => {
            const blocks = parseRichText(decodeHtmlEntities(stepContent));
            return (
              <div
                key={stepContent.slice(0, 50)}
                ref={(el) => { itemRefs.current[index] = el; }}
                className={styles.textItem}
                style={{
                  position: 'absolute',
                  top: cumHeights[index - 1] || 0,
                  left: 0,
                  width: '100%',
                }}
              >
                {renderBlocks(blocks)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (isTextClip) {
    const maxHeight = heights.length > 0 ? Math.max(...heights) : 0;
    return (
      <div
        ref={setRootRef}
        className={cx(rootClassName, styles[resolvedVariant], styles.animation_textClip)}
        style={rootStyle}
        {...linkedHandlers}
      >
        <div
          className={styles.clipContainer}
          style={{
            height: maxHeight || resolvedTextClipOpts.clipHeight || 'auto',
            clipPath,
            transition: `clip-path ${(resolvedTextClipOpts.duration || 1)}s ease`,
          }}
        >
          {resolvedTextClipOpts.steps.map((stepContent, index) => {
            const blocks = parseRichText(decodeHtmlEntities(stepContent));
            return (
              <div
                key={stepContent.slice(0, 50)}
                ref={(el) => { itemRefs.current[index] = el; }}
                className={styles.clipItem}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  opacity: index === displayedStep ? 1 : 0,
                }}
              >
                {renderBlocks(blocks)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const blocks = htmlContent ? parseRichText(decodeHtmlEntities(htmlContent)) : [];
  if (blocks.length === 0) return null;

  if (hasRows || hasSingleLineEllipsis) {
    const previewText = stripHtmlTags(flattenBlocksToText(blocks)) || stripHtmlTags(decodeHtmlEntities(htmlContent));

    return (
      <div
        ref={setRootRef}
        className={cx(rootClassName, styles[resolvedVariant])}
        style={rootStyle}
        {...linkedHandlers}
        {...props}
      >
        <p className={cx(styles.previewText, hasRows && styles.clamp, hasSingleLineEllipsis && styles.ellipsis)} style={clampStyle}>
          {previewText}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={setRootRef}
      className={cx(rootClassName, styles[resolvedVariant])}
      style={rootStyle}
      {...linkedHandlers}
      {...props}
    >
      {renderBlocks(blocks)}
    </div>
  );
}

LexicalText.displayName = 'LexicalText';
