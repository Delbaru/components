import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNearestNodeFromDOMNode, CLICK_COMMAND, COMMAND_PRIORITY_LOW, TextNode, type LexicalEditor } from 'lexical';
import { useEffect, useRef, type MutableRefObject } from 'react';

import type { LexicalTextareaChangePayload, LexicalTextareaContent, LexicalTextareaVariable } from '../types';
import { applyContentToEditor, buildChangePayload, getEditorContentSignature } from './content';
import { $createVariableNode, $isVariableNode } from './VariableNode';
import { findVariableTokenMatch } from './variables';

export function EditorRefPlugin({ editorRef }: { editorRef: MutableRefObject<LexicalEditor | null> }) {
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

export function ContentSyncPlugin({
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

export function VariableSelectionPlugin() {
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

export function VariablesPlugin({ variableLookup }: { variableLookup: Map<string, LexicalTextareaVariable> }) {
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
