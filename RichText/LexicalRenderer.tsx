import type { CSSProperties, ReactNode } from 'react';

import { cx } from '../core';

import styles from './RichText.module.scss';
import { roleClassKeys } from './roles';

type LexicalTextNode = {
  type: 'text';
  text: string;
  format?: number;
  mode?: string;
  style?: string;
  detail?: number;
  version?: number;
};

type LexicalVariableNode = {
  type: 'variable';
  text: string;
  label?: string;
  variableKey?: string;
  color?: string;
  format?: number;
  mode?: string;
  style?: string;
  detail?: number;
  version?: number;
};

/**
 * Визуальная роль блока, развязанная с его тегом (см. `roles.ts`). Пишет её редактор CMS
 * в свои узлы `rich-paragraph` / `rich-heading`; у обычных узлов Lexical её нет.
 */
type LexicalRoleFields = {
  role?: string;
  roleM?: string;
  roleT?: string;
};

type LexicalParagraphNode = LexicalRoleFields & {
  /**
   * `rich-paragraph` — абзац редактора CMS: тот же абзац, плюс роль. Пока рендер знал только
   * `paragraph`, всё, что человек набирал в админке, на сайте выходило пустым местом:
   * незнакомый узел молча отдаёт `null`.
   */
  type: 'paragraph' | 'rich-paragraph';
  children: LexicalNode[];
  format?: string;
  indent?: number;
  version?: number;
  direction?: string | null;
  textStyle?: string;
  textFormat?: number;
};

type LexicalHeadingNode = LexicalRoleFields & {
  type: 'heading' | 'rich-heading';
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: LexicalNode[];
  format?: string;
  indent?: number;
  version?: number;
  direction?: string | null;
};

type LexicalListNode = {
  type: 'list';
  listType: 'bullet' | 'number';
  children: LexicalNode[];
  start?: number;
  tag?: 'ul' | 'ol';
  version?: number;
};

type LexicalListItemNode = {
  type: 'listitem';
  children: LexicalNode[];
  value?: number;
  version?: number;
};

type LexicalQuoteNode = {
  type: 'quote';
  children: LexicalNode[];
  format?: string;
  indent?: number;
  version?: number;
  direction?: string | null;
};

type LexicalLinkFields = {
  url?: string;
  linkType?: 'custom' | 'internal';
  newTab?: boolean;
  doc?: {
    value?: {
      slug?: string | null;
    } | null;
  } | null;
};

type LexicalLinkNode = {
  type: 'link' | 'autolink';
  children: LexicalNode[];
  fields?: LexicalLinkFields;
  url?: string;
  rel?: string;
  target?: string;
  title?: string;
  version?: number;
};

/** Мягкий перенос строки (Shift+Enter): без него соседние куски текста слипаются. */
type LexicalLineBreakNode = {
  type: 'linebreak';
  version?: number;
};

type LexicalNode =
  | LexicalTextNode
  | LexicalLineBreakNode
  | LexicalVariableNode
  | LexicalParagraphNode
  | LexicalHeadingNode
  | LexicalListNode
  | LexicalListItemNode
  | LexicalQuoteNode
  | LexicalLinkNode;

type LexicalRoot = {
  root: {
    type: 'root';
    children: LexicalNode[];
    format?: string;
    indent?: number;
    version?: number;
    direction?: string | null;
  };
};

function parseInlineStyle(styleText?: string): CSSProperties | undefined {
  if (!styleText) {
    return undefined;
  }

  const styleEntries = styleText
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(':'))
    .filter((entry): entry is [string, string] => entry.length >= 2 && Boolean(entry[0]?.trim()) && Boolean(entry[1]?.trim()));

  if (styleEntries.length === 0) {
    return undefined;
  }

  return styleEntries.reduce<CSSProperties>((accumulator, [rawProperty, rawValue]) => {
    const propertyName = rawProperty
      .trim()
      .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    const propertyValue = rawValue.trim();

    if (!propertyName || !propertyValue) {
      return accumulator;
    }

    return {
      ...accumulator,
      [propertyName]: propertyValue,
    };
  }, {});
}

function renderTextNode(node: LexicalTextNode, key: string): ReactNode {
  const { text, format = 0 } = node;

  // Lexical format flags: 1=bold, 2=italic, 4=strikethrough, 8=underline, etc.
  const isBold = (format & 1) !== 0;
  const isItalic = (format & 2) !== 0;
  const isStrikethrough = (format & 4) !== 0;
  const isUnderline = (format & 8) !== 0;
  const isCode = (format & 16) !== 0;
  const inlineStyle = parseInlineStyle(node.style);

  let content: ReactNode = inlineStyle ? <span key={`${key}-text`} style={inlineStyle}>{text}</span> : text;

  if (isCode) content = <code key={key}>{content}</code>;
  if (isUnderline) content = <u key={key}>{content}</u>;
  if (isStrikethrough) content = <s key={key}>{content}</s>;
  if (isItalic) content = <em key={key}>{content}</em>;
  if (isBold) content = <strong key={key}>{content}</strong>;

  return content;
}

function renderVariableNode(node: LexicalVariableNode, key: string): ReactNode {
  return (
    <span
      key={key}
      className={styles.variableChip}
      style={node.color ? ({ ['--rich-text-variable-color' as string]: node.color } as CSSProperties) : undefined}
      data-variable-key={node.variableKey}
    >
      {node.label ?? node.text}
    </span>
  );
}

function resolveLinkHref(node: LexicalLinkNode): string | undefined {
  if (node.fields?.linkType === 'internal') {
    const slug = node.fields.doc?.value?.slug;

    if (slug) {
      return `/${slug}`;
    }
  }

  return node.fields?.url || node.url;
}

/** Классы роли блока — только те, что заданы в данных; блок без роли красит вариант текста. */
function roleClass(node: LexicalRoleFields): string | undefined {
  const keys = roleClassKeys(node.role, node.roleM, node.roleT);
  return keys.length > 0 ? cx(...keys.map((key) => styles[key])) : undefined;
}

function renderNode(node: LexicalNode, index: number): ReactNode {
  const key = `node-${index}`;

  if (node.type === 'variable') {
    return renderVariableNode(node, key);
  }

  if (node.type === 'text') {
    return renderTextNode(node, key);
  }

  if (node.type === 'linebreak') {
    return <br key={key} />;
  }

  if (node.type === 'paragraph' || node.type === 'rich-paragraph') {
    return (
      <p key={key} className={roleClass(node)}>
        {node.children?.map((child, i) => renderNode(child, i))}
      </p>
    );
  }

  if (node.type === 'heading' || node.type === 'rich-heading') {
    const Tag = node.tag || 'h2';
    return (
      <Tag key={key} className={roleClass(node)}>
        {node.children?.map((child, i) => renderNode(child, i))}
      </Tag>
    );
  }

  if (node.type === 'list') {
    const Tag = node.listType === 'number' || node.tag === 'ol' ? 'ol' : 'ul';
    return (
      <Tag key={key}>
        {node.children?.map((child, i) => renderNode(child, i))}
      </Tag>
    );
  }

  if (node.type === 'listitem') {
    return (
      <li key={key}>
        {node.children?.map((child, i) => renderNode(child, i))}
      </li>
    );
  }

  if (node.type === 'quote') {
    return (
      <blockquote key={key}>
        {node.children?.map((child, i) => renderNode(child, i))}
      </blockquote>
    );
  }

  if (node.type === 'link' || node.type === 'autolink') {
    const href = resolveLinkHref(node);

    if (!href) {
      return node.children?.map((child, i) => renderNode(child, i));
    }

    const target = node.fields?.newTab ? '_blank' : node.target;
    const rel = target === '_blank' ? 'noopener noreferrer' : node.rel;

    return (
      <a key={key} href={href} target={target} rel={rel} title={node.title}>
        {node.children?.map((child, i) => renderNode(child, i))}
      </a>
    );
  }

  return null;
}

export function renderLexicalContent(content: LexicalRoot | null | undefined): ReactNode {
  if (!content?.root?.children) return null;
  
  return (
    <>
      {content.root.children.map((node, index) => renderNode(node, index))}
    </>
  );
}
