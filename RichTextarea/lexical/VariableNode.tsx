'use client';

import {
    $applyNodeReplacement,
    TextNode,
    type EditorConfig,
    type LexicalNode,
    type NodeKey,
    type SerializedTextNode,
    type Spread,
} from 'lexical';

import { resolveSvgAssetSource } from '../../core/base/svg-asset';
import styles from '../RichTextarea.module.scss';

export interface VariableNodePayload {
    key: string;
    label: string;
    color?: string;
    icon?: string;
    aliases?: string[];
}

export type SerializedVariableNode = Spread<
    {
        type: 'variable';
        version: 1;
        variableKey: string;
        label: string;
        color?: string;
        icon?: string;
    },
    SerializedTextNode
>;

// Переменная рендерится как обычный инлайн-текст (TextNode), поэтому нативное
// выделение, двойной/тройной клик и drag работают «из коробки». Вид «пилюли»
// (фон, скругление, иконка) навешиваем CSS-классом и data-атрибутом — их Lexical
// при обновлении DOM не трогает, поэтому переприменяем и в createDOM, и в updateDOM.
function decorateVariableElement(element: HTMLElement, node: VariableNode): void {
    element.classList.add(styles.VariableChip);
    element.setAttribute('data-variable-key', node.getVariableKey());

    const iconSource = resolveSvgAssetSource(node.getIcon());

    if (iconSource) {
        element.style.setProperty('--chip-icon', `url("${iconSource}")`);
    }

    const color = node.getColor();

    if (color) {
        element.style.color = color;
    }
}

export class VariableNode extends TextNode {
    __variableKey: string;
    __label: string;
    __color?: string;
    __icon?: string;

    static getType(): string {
        return 'variable';
    }

    static clone(node: VariableNode): VariableNode {
        return new VariableNode(node.__label, node.__variableKey, node.__color, node.__icon, node.__key);
    }

    static importJSON(serializedNode: SerializedVariableNode): VariableNode {
        const node = $createVariableNode({
            key: serializedNode.variableKey,
            label: serializedNode.label ?? serializedNode.text,
            color: serializedNode.color,
            icon: serializedNode.icon,
        });

        node.setFormat(serializedNode.format ?? 0);
        node.setDetail(serializedNode.detail ?? 0);
        node.setStyle(serializedNode.style ?? '');

        return node;
    }

    constructor(label: string, variableKey: string, color?: string, icon?: string, key?: NodeKey) {
        super(label, key);
        this.__variableKey = variableKey;
        this.__label = label;
        this.__color = color;
        this.__icon = icon;
    }

    createDOM(config: EditorConfig): HTMLElement {
        const element = super.createDOM(config);
        decorateVariableElement(element, this);

        return element;
    }

    updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
        const isUpdated = super.updateDOM(prevNode, dom, config);
        decorateVariableElement(dom, this);

        return isUpdated;
    }

    exportJSON(): SerializedVariableNode {
        return {
            ...super.exportJSON(),
            type: 'variable',
            version: 1,
            variableKey: this.__variableKey,
            label: this.__label,
            color: this.__color,
            icon: this.__icon,
        };
    }

    // Атомарность токена: курсор не встаёт внутрь, ввод рядом не «прилипает»
    // к переменной, а Backspace/Delete удаляют её целиком (режим token).
    canInsertTextBefore(): boolean {
        return false;
    }

    canInsertTextAfter(): boolean {
        return false;
    }

    getVariableKey(): string {
        return this.getLatest().__variableKey;
    }

    getLabel(): string {
        return this.getLatest().__label;
    }

    getColor(): string | undefined {
        return this.getLatest().__color;
    }

    getIcon(): string | undefined {
        return this.getLatest().__icon;
    }
}

export function $createVariableNode(payload: VariableNodePayload): VariableNode {
    const node = new VariableNode(payload.label, payload.key, payload.color, payload.icon);
    node.setMode('token');

    return $applyNodeReplacement(node);
}

export function $isVariableNode(node: LexicalNode | null | undefined): node is VariableNode {
    return node instanceof VariableNode;
}
