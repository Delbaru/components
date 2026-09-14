'use client';

import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $createTextNode,
  $getNearestNodeFromDOMNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  TextNode,
  type LexicalEditor,
  type SerializedEditorState,
} from 'lexical';
import type { CSSProperties, MutableRefObject } from 'react';
import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { SharedMotionProps } from '../hooks/useSharedMotion';
import { Box } from '../Box';
import { Flex } from '../Flex';
import { Text } from '../Text';
import {
  cx,
  mergeComponentStates,
  type BorderStyleProps,
  type ComponentStateValue,
  type GrowProps,
  type LayoutSpaceProps,
  type RadiusPropsShort,
  type SizePropsShort,
  type StateLinkInput,
} from '../core';
import richTextStyles from '../RichText/RichText.module.scss';
import type { LexicalTextVariant } from '../RichText';
import { LexicalTextareaCounter, LexicalTextareaToolbar } from './LexicalTextareaToolbar';
import { $createVariableNode, $isVariableNode, VariableNode, type VariableNodePayload } from './lexical/VariableNode';
import styles from './RichTextarea.module.scss';
import type { WithRef } from '../core';

export type LexicalTextareaContent =
  | SerializedEditorState
  | {
      root?: {
        children?: unknown[];
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };

export interface LexicalTextareaVariable extends VariableNodePayload {}

export interface LexicalTextareaChangePayload {
  json: LexicalTextareaContent | null;
  plainText: string;
  characters: number;
  isEmpty: boolean;
}

export interface LexicalTextareaHandle {
  focus: () => void;
  reset: () => void;
  setContent: (content: LexicalTextareaContent | string | undefined) => void;
  insertVariable: (variable: string | LexicalTextareaVariable) => void;
  getValue: () => LexicalTextareaContent | null;
}

export interface LexicalTextareaProps
  extends LayoutSpaceProps,
    RadiusPropsShort,
    BorderStyleProps,
    GrowProps,
    SharedMotionProps,
    SizePropsShort {
  id?: string;
  className?: string;
  style?: CSSProperties;

  bg?: string;
  color?: string;
  placeholder?: string;
  placeholderColor?: string;
  label?: string;
  labelColor?: string;
  comment?: string;
  variant?: LexicalTextVariant;

  content?: LexicalTextareaContent | string;
  variables?: LexicalTextareaVariable[];
  // Показывать ли в тулбаре кнопку «Ссылка» (по умолчанию — да). На экзамене ссылки запрещены.
  allowLink?: boolean;
  onChange?: (payload: LexicalTextareaChangePayload) => void;

  minLength?: number;
  maxLength?: number;

  error?: string;
  state?: ComponentStateValue;

  required?: boolean;
  emptyMessage?: string;
  validate?: (payload: LexicalTextareaChangePayload) => string | undefined;

  linkState?: StateLinkInput;
  'data-point-events'?: string;
}

const DEFAULT_EMPTY_MESSAGE = 'Поле обязательно для заполнения';
const DEFAULT_MIN_LENGTH_MESSAGE = (minLength: number) => `Минимум ${minLength} символов`;
const DEFAULT_MAX_LENGTH_MESSAGE = (maxLength: number) => `Максимум ${maxLength} символов`;
const EMPTY_CHANGE_PAYLOAD: LexicalTextareaChangePayload = {
  json: null,
  plainText: '',
  characters: 0,
  isEmpty: true,
};

// Метка для программной подстановки контента (синхронизация пропа `content`,
// setContent, reset). Такие апдейты не должны прилетать в `onChange` как
// «правка пользователя» — иначе родитель ошибочно помечает значение кастомным.
const PROGRAMMATIC_CONTENT_TAG = 'socrat-programmatic-content';

type LexicalTextareaMetaState = {
  payload: LexicalTextareaChangePayload;
  error?: string;
};

function normalizeVariableToken(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function createVariableLookup(variables: LexicalTextareaVariable[]): Map<string, LexicalTextareaVariable> {
  const lookup = new Map<string, LexicalTextareaVariable>();

  variables.forEach((variable) => {
    lookup.set(normalizeVariableToken(variable.key), variable);
    lookup.set(normalizeVariableToken(variable.label), variable);
    variable.aliases?.forEach((alias) => {
      lookup.set(normalizeVariableToken(alias), variable);
    });
  });

  return lookup;
}

type VariableTokenCandidate = {
  token: string;
  normalizedToken: string;
  variable: LexicalTextareaVariable;
};

type VariableTokenMatch = {
  startOffset: number;
  endOffset: number;
  variable: LexicalTextareaVariable;
};

const VARIABLE_TOKEN_BODY_REGEXP = /[\p{L}\p{N}_]/u;

function isVariableTokenBoundary(value: string | undefined): boolean {
  return !value || !VARIABLE_TOKEN_BODY_REGEXP.test(value);
}

function createVariableTokenCandidates(variableLookup: Map<string, LexicalTextareaVariable>): VariableTokenCandidate[] {
  const candidates = new Map<string, VariableTokenCandidate>();

  variableLookup.forEach((variable) => {
    [variable.label, variable.key, ...(variable.aliases ?? [])].forEach((token) => {
      const normalizedToken = normalizeVariableToken(token);

      if (!normalizedToken || candidates.has(normalizedToken)) {
        return;
      }

      candidates.set(normalizedToken, { token, normalizedToken, variable });
    });
  });

  return Array.from(candidates.values()).sort((current, next) => next.token.length - current.token.length);
}

function findVariableTokenMatchAt(
  textContent: string,
  startOffset: number,
  variableLookup: Map<string, LexicalTextareaVariable>,
  candidates: VariableTokenCandidate[]
): VariableTokenMatch | undefined {
  const pairedTokenMatch = /^@([^@\n]+)@/u.exec(textContent.slice(startOffset));

  const pairedToken = pairedTokenMatch?.[1];

  if (pairedTokenMatch && pairedToken !== undefined && pairedToken === pairedToken.trim()) {
    const variable = variableLookup.get(normalizeVariableToken(pairedToken));

    if (variable) {
      return {
        startOffset,
        endOffset: startOffset + pairedTokenMatch[0].length,
        variable,
      };
    }
  }

  if (!isVariableTokenBoundary(textContent[startOffset - 1])) {
    return undefined;
  }

  for (const candidate of candidates) {
    const tokenStartOffset = startOffset + 1;
    const tokenEndOffset = tokenStartOffset + candidate.token.length;

    if (tokenEndOffset > textContent.length || !isVariableTokenBoundary(textContent[tokenEndOffset])) {
      continue;
    }

    const token = textContent.slice(tokenStartOffset, tokenEndOffset);

    if (normalizeVariableToken(token) !== candidate.normalizedToken) {
      continue;
    }

    return {
      startOffset,
      endOffset: tokenEndOffset,
      variable: candidate.variable,
    };
  }

  return undefined;
}

function findVariableTokenMatch(
  textContent: string,
  variableLookup: Map<string, LexicalTextareaVariable>,
  fromOffset = 0
): VariableTokenMatch | undefined {
  const candidates = createVariableTokenCandidates(variableLookup);

  for (let startOffset = textContent.indexOf('@', fromOffset); startOffset !== -1; startOffset = textContent.indexOf('@', startOffset + 1)) {
    const match = findVariableTokenMatchAt(textContent, startOffset, variableLookup, candidates);

    if (match) {
      return match;
    }
  }

  return undefined;
}

function resolveVariableDefinition(
  variable: string | LexicalTextareaVariable,
  lookup: Map<string, LexicalTextareaVariable>
): LexicalTextareaVariable {
  if (typeof variable !== 'string') {
    return variable;
  }

  return lookup.get(normalizeVariableToken(variable)) ?? { key: variable, label: variable };
}

function hasSerializedContent(
  content: LexicalTextareaContent | string | undefined
): content is LexicalTextareaContent {
  return Boolean(content && typeof content === 'object' && content.root?.children);
}

function buildChangePayload(
  editorState: ReturnType<LexicalEditor['getEditorState']>
): LexicalTextareaChangePayload {
  const json: LexicalTextareaContent = editorState.toJSON();
  const plainText = editorState.read(() => $getRoot().getTextContent()).replace(/\u00a0/g, ' ');
  const normalizedText = plainText.trim();

  return {
    json,
    plainText,
    characters: normalizedText.length,
    isEmpty: !normalizedText,
  };
}

function getEditorContentSignature(editor: LexicalEditor): string {
  return JSON.stringify(editor.getEditorState().toJSON());
}

function normalizeTemplateContent(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  return lines.length > 0 ? lines : [''];
}

function appendTemplateLine(line: string, variableLookup: Map<string, LexicalTextareaVariable>) {
  const paragraph = $createParagraphNode();
  let lastIndex = 0;
  let match = findVariableTokenMatch(line, variableLookup, lastIndex);

  while (match) {
    const leading = line.slice(lastIndex, match.startOffset);

    if (leading) {
      paragraph.append($createTextNode(leading));
    }

    paragraph.append($createVariableNode(match.variable));

    lastIndex = match.endOffset;
    match = findVariableTokenMatch(line, variableLookup, lastIndex);
  }

  const trailing = line.slice(lastIndex);

  if (trailing) {
    paragraph.append($createTextNode(trailing));
  }

  if (paragraph.getChildrenSize() === 0) {
    paragraph.append($createTextNode(''));
  }

  $getRoot().append(paragraph);
}

type TextFormats = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

function createFormattedTextNode(text: string, formats: TextFormats = {}) {
  const textNode = $createTextNode(text);

  if (formats.bold) {
    textNode.toggleFormat('bold');
  }

  if (formats.italic) {
    textNode.toggleFormat('italic');
  }

  if (formats.underline) {
    textNode.toggleFormat('underline');
  }

  return textNode;
}

function appendFormattedText(
  paragraph: ReturnType<typeof $createParagraphNode>,
  text: string,
  variableLookup: Map<string, LexicalTextareaVariable>,
  formats: TextFormats = {}
) {
  let lastIndex = 0;
  let match = findVariableTokenMatch(text, variableLookup, lastIndex);

  while (match) {
    const leading = text.slice(lastIndex, match.startOffset);

    if (leading) {
      paragraph.append(createFormattedTextNode(leading, formats));
    }

    paragraph.append($createVariableNode(match.variable));
    lastIndex = match.endOffset;
    match = findVariableTokenMatch(text, variableLookup, lastIndex);
  }

  const trailing = text.slice(lastIndex);

  if (trailing) {
    paragraph.append(createFormattedTextNode(trailing, formats));
  }
}

function isHtmlString(content: string) {
  return /<\s*\/?.+?>/.test(content);
}

function parseHtmlContent(content: string, variableLookup: Map<string, LexicalTextareaVariable>) {
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(`<div>${content}</div>`, 'text/html');
  const wrapper = parsedDocument.body.firstElementChild;
  const paragraphs: ReturnType<typeof $createParagraphNode>[] = [];

  if (!wrapper) {
    return paragraphs;
  }

  let currentParagraph = $createParagraphNode();

  const flushParagraph = () => {
    if (currentParagraph.getChildrenSize() === 0) {
      currentParagraph.append($createTextNode(''));
    }

    paragraphs.push(currentParagraph);
    currentParagraph = $createParagraphNode();
  };

  const walkNode = (node: Node, formats: TextFormats = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Перенос строки (\n) внутри текста — это отдельный абзац, а не мягкий
      // перенос. Так каждая строка инструкции становится своим <p>, и тройной
      // клик нативно выделяет одну строку, а не весь блок.
      const segments = (node.textContent ?? '').split('\n');

      segments.forEach((segment, index) => {
        if (index > 0) {
          flushParagraph();
        }

        if (segment) {
          appendFormattedText(currentParagraph, segment, variableLookup, formats);
        }
      });

      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const nextFormats = { ...formats };

    if (tagName === 'b' || tagName === 'strong') {
      nextFormats.bold = true;
    }

    if (tagName === 'i' || tagName === 'em') {
      nextFormats.italic = true;
    }

    if (tagName === 'u') {
      nextFormats.underline = true;
    }

    if (tagName === 'br') {
      flushParagraph();
      return;
    }

    if (tagName === 'p' || tagName === 'div') {
      if (currentParagraph.getChildrenSize() > 0) {
        flushParagraph();
      }

      element.childNodes.forEach((child) => walkNode(child, formats));
      flushParagraph();
      return;
    }

    element.childNodes.forEach((child) => walkNode(child, nextFormats));
  };

  wrapper.childNodes.forEach((child) => walkNode(child));

  if (currentParagraph.getChildrenSize() > 0 || paragraphs.length === 0) {
    flushParagraph();
  }

  return paragraphs;
}

function applyContentToEditor(
  editor: LexicalEditor,
  content: LexicalTextareaContent | string | undefined,
  variableLookup: Map<string, LexicalTextareaVariable>
) {
  if (typeof content === 'string') {
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();

        if (isHtmlString(content)) {
          const paragraphs = parseHtmlContent(content, variableLookup);

          if (paragraphs.length > 0) {
            paragraphs.forEach((paragraph) => root.append(paragraph));
          }
        } else {
          normalizeTemplateContent(content).forEach((line) => {
            appendTemplateLine(line, variableLookup);
          });
        }

        if (root.getChildrenSize() === 0) {
          root.append($createParagraphNode());
        }

        root.selectEnd();
      },
      { discrete: true, tag: PROGRAMMATIC_CONTENT_TAG }
    );

    return;
  }

  if (hasSerializedContent(content)) {
    const nextState = editor.parseEditorState(JSON.stringify(content));
    editor.setEditorState(nextState, { tag: PROGRAMMATIC_CONTENT_TAG });
    return;
  }

  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      root.append($createParagraphNode());
      root.selectEnd();
    },
    { discrete: true, tag: PROGRAMMATIC_CONTENT_TAG }
  );
}

function insertVariableAtSelection(variable: VariableNodePayload) {
  const selection = $getSelection();
  const variableNode = $createVariableNode(variable);
  const trailingSpace = $createTextNode(' ');

  if ($isRangeSelection(selection)) {
    selection.insertNodes([variableNode, trailingSpace]);
    return;
  }

  const paragraph = $createParagraphNode();
  paragraph.append(variableNode, trailingSpace);
  $getRoot().append(paragraph);
  paragraph.selectEnd();
}

function isAllowedLink(url: string): boolean {
  if (url.startsWith('/')) {
    return true;
  }

  try {
    const parsedUrl = new URL(url.includes('://') ? url : `https://${url}`);
    return ['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

function EditorRefPlugin({ editorRef }: { editorRef: MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editorRef.current = editor;

    return () => {
      if (editorRef.current === editor) {
        editorRef.current = null;
      }
    };
  }, [editor, editorRef]);

  return null;
}

function ContentSyncPlugin({
  content,
  contentSignature,
  variableLookup,
  onSync,
}: {
  content: LexicalTextareaContent | string | undefined;
  contentSignature: string;
  variableLookup: Map<string, LexicalTextareaVariable>;
  onSync: (payload: LexicalTextareaChangePayload) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const appliedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (appliedSignatureRef.current === contentSignature) {
      return () => {
        cancelled = true;
      };
    }

    // ⚠️ Подпись отмечается ПОСЛЕ применения, а не до. В dev React монтирует эффект дважды
    // (mount → cleanup → mount): первый заход помечал подпись применённой и планировал
    // микрозадачу, cleanup её отменял, а второй заход видел «уже применено» и выходил — контент
    // не попадал в редактор ВООБЩЕ. На экране это выглядело так, будто первый шаблон пустой и
    // «появляется, только когда нажмёшь на другой»: смена шаблона меняет подпись, и ветка
    // наконец срабатывает. Отметка после применения делает отменённый заход бесследным.
    queueMicrotask(() => {
      if (cancelled) return;

      if (contentSignature === getEditorContentSignature(editor)) {
        appliedSignatureRef.current = contentSignature;

        return;
      }

      applyContentToEditor(editor, content, variableLookup);
      appliedSignatureRef.current = contentSignature;
      onSync(buildChangePayload(editor.getEditorState()));
    });

    return () => {
      cancelled = true;
    };
  }, [content, contentSignature, editor, onSync, variableLookup]);

  return null;
}

function VariableSelectionPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        // Двойной/тройной клик отдаём нативному выделению слова/абзаца —
        // переменная-токен выделяется вместе с текстом без костылей.
        if (event.detail > 1) {
          return false;
        }

        const target = event.target instanceof HTMLElement ? event.target : null;
        const chip = target?.closest('[data-variable-key]');

        if (!(chip instanceof HTMLElement)) {
          return false;
        }

        // Крестик удаления нарисован псевдоэлементом ::after справа. Считаем
        // его зону по реальным размерам (padding-right + ширина + margin),
        // чтобы попадание не зависело от масштаба rpx.
        const rect = chip.getBoundingClientRect();
        const chipStyle = getComputedStyle(chip);
        const crossStyle = getComputedStyle(chip, '::after');
        const crossZone =
          (parseFloat(chipStyle.paddingRight) || 0) +
          (parseFloat(crossStyle.width) || 0) +
          (parseFloat(crossStyle.marginLeft) || 0) +
          2;
        const isCrossClick = rect.right - event.clientX <= crossZone;

        editor.update(() => {
          const node = $getNearestNodeFromDOMNode(chip);

          if (!$isVariableNode(node)) {
            return;
          }

          // Клик по крестику — удаляем переменную; иначе выделяем её целиком
          // (range по токену), чтобы сразу было видно выделение.
          if (isCrossClick) {
            node.remove();
            return;
          }

          node.select(0, node.getTextContentSize());
        });

        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  return null;
}

function VariablesPlugin({ variableLookup }: { variableLookup: Map<string, LexicalTextareaVariable> }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerNodeTransform(TextNode, (textNode) => {
      if ($isVariableNode(textNode)) {
        return;
      }

      const textContent = textNode.getTextContent();

      if (!textContent.includes('@')) {
        return;
      }

      const match = findVariableTokenMatch(textContent, variableLookup);

      if (!match) {
        return;
      }

      const { startOffset, endOffset, variable } = match;
      const splitNodes = textNode.splitText(startOffset, endOffset);
      const matchedNode = splitNodes[1] ?? splitNodes[0];

      if (!matchedNode || $isVariableNode(matchedNode)) {
        return;
      }

      matchedNode.replace($createVariableNode(variable));
    });
  }, [editor, variableLookup]);

  return null;
}

export function LexicalTextarea({
  ref,
  id: idProp,
  className = '',
  style,
  p,
  pt,
  pr,
  pb,
  pl,
  m,
  mt,
  mr,
  mb,
  ml,
  r,
  tlr,
  trr,
  brr,
  blr,
  borderTLR,
  borderTRR,
  borderBRR,
  borderBLR,
  border,
  borderC,
  borderS,
  borderW,
  borderT,
  borderR,
  borderB,
  borderL,
  grow,
  perspective3d,
  parallax,
  w,
  minW,
  maxW,
  h,
  minH,
  maxH,
  bg,
  color,
  placeholder,
  placeholderColor = 'var(--secondary-hover)',
  label,
  labelColor,
  comment,
  variant = 'style-1',
  content,
  variables = [],
  allowLink = true,
  onChange,
  minLength,
  maxLength,
  error,
  state,
  required,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  validate,
  linkState,
  'data-point-events': dataPointEvents,
}: WithRef<LexicalTextareaProps, LexicalTextareaHandle>) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const editorRef = useRef<LexicalEditor | null>(null);
  const valueRef = useRef<LexicalTextareaContent | null>(null);
  const metaRef = useRef<LexicalTextareaChangePayload>(EMPTY_CHANGE_PAYLOAD);
  const latestContentRef = useRef<LexicalTextareaContent | string | undefined>(content);
  const variableLookup = useMemo(() => createVariableLookup(variables), [variables]);
  const variableLookupRef = useRef(variableLookup);
  const contentSignature = useMemo(() => JSON.stringify(content ?? null), [content]);
  const didSyncRef = useRef(false);
  const [editorMeta, setEditorMeta] = useState<LexicalTextareaMetaState>({ payload: EMPTY_CHANGE_PAYLOAD, error: undefined });

  latestContentRef.current = content;
  variableLookupRef.current = variableLookup;

  const helperError = error ?? editorMeta.error;
  const helperText = helperError ?? comment;
  const helperTextColor = helperError ? 'var(--red)' : 'var(--gray)';
  const helperTextId = helperText ? `${id}-comment` : undefined;
  const showCounter = minLength != null || maxLength != null;
  const hasVariables = variables.length > 0;

  const validatePayload = useCallback(
    (payload: LexicalTextareaChangePayload): string | undefined => {
      if (required && payload.isEmpty) {
        return emptyMessage;
      }

      if (!payload.isEmpty && minLength != null && payload.characters < minLength) {
        return DEFAULT_MIN_LENGTH_MESSAGE(minLength);
      }

      if (maxLength != null && payload.characters > maxLength) {
        return DEFAULT_MAX_LENGTH_MESSAGE(maxLength);
      }

      return validate?.(payload);
    },
    [emptyMessage, maxLength, minLength, required, validate]
  );

  const handleEditorChange = useCallback(
    (editorState: ReturnType<LexicalEditor['getEditorState']>, _editor: LexicalEditor, tags: Set<string>) => {
      // Программная подстановка контента уже синхронизирует значение через
      // onSync/setContent — повторно дёргать onChange не нужно (и нельзя:
      // иначе родитель посчитает это правкой пользователя).
      if (tags.has(PROGRAMMATIC_CONTENT_TAG)) {
        return;
      }

      const payload = buildChangePayload(editorState);
      const nextError = didSyncRef.current ? validatePayload(payload) : undefined;

      valueRef.current = payload.json;
      metaRef.current = payload;
      setEditorMeta({ payload, error: nextError });
      onChange?.(payload);
      didSyncRef.current = true;
    },
    [onChange, validatePayload]
  );

  const handleInsertVariable = useCallback((variable: string | LexicalTextareaVariable) => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const resolvedVariable = resolveVariableDefinition(variable, variableLookupRef.current);

    editor.focus();
    editor.update(() => {
      insertVariableAtSelection(resolvedVariable);
    });
  }, []);

  const handleContentSync = useCallback((payload: LexicalTextareaChangePayload) => {
    valueRef.current = payload.json;
    metaRef.current = payload;
    setEditorMeta({ payload, error: undefined });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editorRef.current?.focus();
      },
      reset: () => {
        const editor = editorRef.current;

        if (!editor) {
          return;
        }

        applyContentToEditor(editor, latestContentRef.current, variableLookupRef.current);
        const payload = buildChangePayload(editor.getEditorState());

        valueRef.current = payload.json;
        metaRef.current = payload;
        setEditorMeta({ payload, error: undefined });
        onChange?.(payload);
        didSyncRef.current = false;
      },
      setContent: (nextContent) => {
        const editor = editorRef.current;

        if (!editor) {
          return;
        }

        applyContentToEditor(editor, nextContent, variableLookupRef.current);
        const payload = buildChangePayload(editor.getEditorState());

        latestContentRef.current = nextContent;
        valueRef.current = payload.json;
        metaRef.current = payload;
        setEditorMeta({ payload, error: undefined });
        onChange?.(payload);
        didSyncRef.current = false;
      },
      insertVariable: handleInsertVariable,
      getValue: () => valueRef.current,
    }),
    [handleInsertVariable, onChange]
  );

  const fieldState = mergeComponentStates(state, helperError && 'error');
  const fieldStyle = {
    ...(color ? { color } : null),
    ['--font-p1' as string]: 'var(--font-p)',
    ['--font-p2' as string]: 'var(--font-p)',
    ['--font-p3' as string]: 'var(--font-p)',
  } satisfies CSSProperties;
  const contentClassName = cx(styles.ContentEditable, richTextStyles.RichText, richTextStyles[variant]);

  return (
    <Box
      className={cx(styles.RichTextareaWrapper, className)}
      style={style}
      grow={grow}
      perspective3d={perspective3d}
      parallax={parallax}
      data-point-events={dataPointEvents}
      linkState={linkState}
    >
      {label && (
        <Text color={labelColor} mb={[8, 4, 8]}>
          {label}
        </Text>
      )}

      <Box
        className={styles.Field}
        style={fieldStyle}
        p={p}
        pt={pt}
        pr={pr}
        pb={pb}
        pl={pl}
        m={m}
        mt={mt}
        mr={mr}
        mb={mb}
        ml={ml}
        r={r}
        tlr={tlr}
        trr={trr}
        brr={brr}
        blr={blr}
        borderTLR={borderTLR}
        borderTRR={borderTRR}
        borderBRR={borderBRR}
        borderBLR={borderBLR}
        border={border}
        borderC={borderC}
        borderS={borderS}
        borderW={borderW}
        borderT={borderT}
        borderR={borderR}
        borderB={borderB}
        borderL={borderL}
        w={w}
        minW={minW}
        maxW={maxW}
        h={h}
        minH={minH ?? [220, null, null]}
        maxH={maxH}
        bg={bg}
        data-state={fieldState ?? undefined}
        role='presentation'
        onClick={() => editorRef.current?.focus()}
      >
        <LexicalComposer
          initialConfig={{
            namespace: 'SocratLexicalTextarea',
            onError: (nextError) => {
              throw nextError;
            },
            nodes: [VariableNode, ListNode, ListItemNode, LinkNode],
            theme: {
              text: {
                underline: styles.underline,
              },
            },
          }}
        >
          <EditorRefPlugin editorRef={editorRef} />
          <ContentSyncPlugin
            content={content}
            contentSignature={contentSignature}
            variableLookup={variableLookup}
            onSync={handleContentSync}
          />
          <VariablesPlugin variableLookup={variableLookup} />
          <VariableSelectionPlugin />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin validateUrl={isAllowedLink} />
          <OnChangePlugin ignoreSelectionChange onChange={handleEditorChange} />

          <Box className={styles.EditorShell} minH={[180, null, null]}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  id={id}
                  className={contentClassName}
                  aria-describedby={helperTextId}
                  aria-invalid={Boolean(helperError)}
                  onBlur={() => {
                    setEditorMeta((currentMeta) => ({
                      payload: currentMeta.payload,
                      error: validatePayload(metaRef.current),
                    }));
                  }}
                />
              }
              placeholder={placeholder ? (
                <Text as='div' variant={['p', null, null]} color={placeholderColor} className={styles.Placeholder}>
                  {placeholder}
                </Text>
              ) : null}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </Box>

          <Flex
            dir={['row', null, null]}
            justify={['space_between', null, null]}
            align={['center', null, null]}
            wrap={['wrap', 'wrap', 'wrap']}
            gap={[16, 8, 16]}
            mt={[16, 16, 16]}
            pt={[16, 16, 16]}
            borderT={['calc(1 * var(--rpx)) solid var(--gray-light)', null, null]}
          >
            <LexicalTextareaToolbar hasVariables={hasVariables} allowLink={allowLink} />
            {showCounter && <LexicalTextareaCounter characters={editorMeta.payload.characters} maxLength={maxLength} />}
          </Flex>
        </LexicalComposer>
      </Box>

      {helperText && (
        <Text
          as='div'
          variant={['small', 'small', 'small']}
          mt={[8, 4, 8]}
          id={helperTextId}
          color={helperTextColor}
          role={helperError ? 'alert' : undefined}
        >
          {helperText}
        </Text>
      )}
    </Box>
  );
}
