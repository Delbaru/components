import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical';

import type { LexicalTextareaChangePayload, LexicalTextareaContent, LexicalTextareaVariable } from '../types';
import { $createVariableNode, type VariableNodePayload } from './VariableNode';
import { findVariableTokenMatch } from './variables';

// Метка для программной подстановки контента (синхронизация пропа `content`,
// setContent, reset). Такие апдейты не должны прилетать в `onChange` как
// «правка пользователя» — иначе родитель ошибочно помечает значение кастомным.
export const PROGRAMMATIC_CONTENT_TAG = 'socrat-programmatic-content';

function hasSerializedContent(
  content: LexicalTextareaContent | string | undefined
): content is LexicalTextareaContent {
  return Boolean(content && typeof content === 'object' && content.root?.children);
}

export function buildChangePayload(
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

export function getEditorContentSignature(editor: LexicalEditor): string {
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

export function applyContentToEditor(
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

export function insertVariableAtSelection(variable: VariableNodePayload) {
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
