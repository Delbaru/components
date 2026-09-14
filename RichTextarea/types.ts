import type { SerializedEditorState } from 'lexical';

import type { VariableNodePayload } from './lexical/VariableNode';

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
