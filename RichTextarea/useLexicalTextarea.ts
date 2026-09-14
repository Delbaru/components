import { useCallback, useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import type { LexicalEditor } from 'lexical';

import { PROGRAMMATIC_CONTENT_TAG, applyContentToEditor, buildChangePayload, insertVariableAtSelection } from './lexical/content';
import { createVariableLookup, resolveVariableDefinition } from './lexical/variables';
import type { LexicalTextareaChangePayload, LexicalTextareaContent, LexicalTextareaHandle, LexicalTextareaVariable } from './types';

const DEFAULT_MIN_LENGTH_MESSAGE = (minLength: number) => `Минимум ${minLength} символов`;
const DEFAULT_MAX_LENGTH_MESSAGE = (maxLength: number) => `Максимум ${maxLength} символов`;
const EMPTY_CHANGE_PAYLOAD: LexicalTextareaChangePayload = {
  json: null,
  plainText: '',
  characters: 0,
  isEmpty: true,
};

type LexicalTextareaMetaState = {
  payload: LexicalTextareaChangePayload;
  error?: string;
};

export interface LexicalTextareaConfig {
  id?: string;
  content?: LexicalTextareaContent | string;
  variables: LexicalTextareaVariable[];
  onChange?: (payload: LexicalTextareaChangePayload) => void;
  minLength?: number;
  maxLength?: number;
  error?: string;
  comment?: string;
  required?: boolean;
  emptyMessage: string;
  validate?: (payload: LexicalTextareaChangePayload) => string | undefined;
}

/** Состояние LexicalTextarea: значение, проверка, подсказка, императивный handle. Вид — в LexicalTextarea.tsx. */
export function useLexicalTextarea(ref: Ref<LexicalTextareaHandle> | undefined, config: LexicalTextareaConfig) {
  const {
    id: idProp, content, variables, onChange, minLength, maxLength, error, comment, required,
    emptyMessage, validate,
  } = config;

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

  const handleBlur = () => {
    setEditorMeta((currentMeta) => ({
      payload: currentMeta.payload,
      error: validatePayload(metaRef.current),
    }));
  };

  return {
    id, editorRef, variableLookup, contentSignature, editorMeta, helperError, helperText,
    helperTextColor, helperTextId, showCounter, hasVariables, handleEditorChange, handleContentSync,
    handleBlur,
  };
}
