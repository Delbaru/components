'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
} from 'lexical';
import { $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import { Button } from '../Button';
import { Flex } from '../Flex';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { resolveSvgAssetSource } from '../core/base/svg-asset';
import styles from './RichTextarea.module.scss';
import BoldIconAsset from './assets/b.svg';
import ItalicIconAsset from './assets/i.svg';
import LinkIconAsset from './assets/link.svg';
import OrderedListIconAsset from './assets/ol.svg';
import UnderlineIconAsset from './assets/u.svg';
import UnorderedListIconAsset from './assets/ul.svg';

type ActiveFormats = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  listType: 'bullet' | 'number' | null;
  isLink: boolean;
};

function findMatchingParent(node: any, matcher: (currentNode: any) => boolean) {
  let currentNode = node;

  while (currentNode) {
    if (matcher(currentNode)) {
      return currentNode;
    }

    currentNode = currentNode.getParent();
  }

  return null;
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

function normalizeLink(url: string): string {
  const trimmedUrl = url.trim();

  if (!trimmedUrl || trimmedUrl.startsWith('/') || trimmedUrl.startsWith('mailto:') || trimmedUrl.includes('://')) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}

const toolbarBoldIconSrc = resolveSvgAssetSource(BoldIconAsset) ?? '';
const toolbarItalicIconSrc = resolveSvgAssetSource(ItalicIconAsset) ?? '';
const toolbarUnderlineIconSrc = resolveSvgAssetSource(UnderlineIconAsset) ?? '';
const toolbarUnorderedListIconSrc = resolveSvgAssetSource(UnorderedListIconAsset) ?? '';
const toolbarOrderedListIconSrc = resolveSvgAssetSource(OrderedListIconAsset) ?? '';
const toolbarLinkIconSrc = resolveSvgAssetSource(LinkIconAsset) ?? '';

function ToolbarIconButton({
  iconSrc,
  isActive,
  onClick,
  ariaLabel,
  size = 20,
}: {
  iconSrc: string;
  isActive?: boolean;
  onClick: () => void;
  ariaLabel: string;
  size?: 20 | 24;
}) {
  return (
    <Button
      type='button'
      className={styles.ToolbarIconButton}
      state={isActive ? 'active' : undefined}
      p={[0, null, null]}
      w={[size, null, null]}
      h={[size, null, null]}
      bg='transparent'
      justifyContent={['center', null, null]}
      alignItems={['center', null, null]}
      tooltip={
        <Text
          variant={['dop', null, null]}
          bg='rgba(43,47,51,0.8)'
          color='var(--white-100)'
          p={[4, 8, 4, 8]}
          r={[8, null, null]}
        >
          {ariaLabel}
        </Text>
      }
      tooltipDirection='bottom'
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isActive}
    >
      <Icon src={iconSrc} w={[size, null, null]} h={[size, null, null]} />
    </Button>
  );
}

export function LexicalTextareaCounter({
  characters,
  maxLength,
}: {
  characters: number;
  maxLength?: number;
}) {
  return (
    <Text
      variant={['small', null, null]}
      color='var(--secondary)'
      style={{ whiteSpace: 'nowrap', lineHeight: 1 }}
    >
      {maxLength != null ? `${characters} / ${maxLength}` : `${characters}`}
    </Text>
  );
}

export function LexicalTextareaToolbar({ hasVariables, allowLink = true }: { hasVariables: boolean; allowLink?: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    underline: false,
    listType: null,
    isLink: false,
  });

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          setActiveFormats({ bold: false, italic: false, underline: false, listType: null, isLink: false });
          return;
        }

        const anchorNode = selection.anchor.getNode();
        const linkNode = findMatchingParent(anchorNode, (node) => $isLinkNode(node));
        const listNode = findMatchingParent(anchorNode, (node) => $isListNode(node));
        const currentListType = $isListNode(listNode) ? listNode.getListType() : null;

        setActiveFormats({
          bold: selection.hasFormat('bold'),
          italic: selection.hasFormat('italic'),
          underline: selection.hasFormat('underline'),
          listType: currentListType === 'bullet' || currentListType === 'number' ? currentListType : null,
          isLink: Boolean(linkNode),
        });
      });
    });
  }, [editor]);

  const toggleTextFormat = useCallback(
    (format: 'bold' | 'italic' | 'underline') => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    },
    [editor]
  );

  const toggleList = useCallback(
    (listType: 'bullet' | 'number') => {
      if (activeFormats.listType === listType) {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        return;
      }

      editor.dispatchCommand(
        listType === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
        undefined
      );
    },
    [activeFormats.listType, editor]
  );

  const handleLinkClick = useCallback(() => {
    const nextUrl = window.prompt('Укажите ссылку');

    if (!nextUrl) {
      if (activeFormats.isLink) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      }

      return;
    }

    const normalizedUrl = normalizeLink(nextUrl);

    if (!isAllowedLink(normalizedUrl)) {
      window.alert('Допустимы только ссылки http, https, mailto или относительные пути.');
      return;
    }

    const hasCollapsedSelection = editor.getEditorState().read(() => {
      const selection = $getSelection();
      return $isRangeSelection(selection) ? selection.isCollapsed() : true;
    });

    if (hasCollapsedSelection) {
      const linkLabel = window.prompt('Текст ссылки', normalizedUrl) ?? normalizedUrl;

      editor.update(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return;
        }

        const linkNode = $createLinkNode(normalizedUrl, {
          target: '_blank',
          rel: 'noopener noreferrer',
        });

        linkNode.append($createTextNode(linkLabel.trim() || normalizedUrl));
        selection.insertNodes([linkNode, $createTextNode(' ')]);
      });

      return;
    }

    editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
      url: normalizedUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  }, [activeFormats.isLink, editor]);

  const toolbarGroups = [
    [
      { ariaLabel: 'Жирный', iconSrc: toolbarBoldIconSrc, isActive: activeFormats.bold, onClick: () => toggleTextFormat('bold') },
      { ariaLabel: 'Курсив', iconSrc: toolbarItalicIconSrc, isActive: activeFormats.italic, onClick: () => toggleTextFormat('italic') },
      { ariaLabel: 'Подчеркнутый', iconSrc: toolbarUnderlineIconSrc, isActive: activeFormats.underline, onClick: () => toggleTextFormat('underline') },
    ],
    [
      { ariaLabel: 'Маркированный список', iconSrc: toolbarUnorderedListIconSrc, isActive: activeFormats.listType === 'bullet', onClick: () => toggleList('bullet') },
      { ariaLabel: 'Нумерованный список', iconSrc: toolbarOrderedListIconSrc, isActive: activeFormats.listType === 'number', onClick: () => toggleList('number') },
    ],
    // Группа «Ссылка» — опциональна (на экзамене ссылки запрещены).
    ...(allowLink ? [[{ ariaLabel: 'Ссылка', iconSrc: toolbarLinkIconSrc, isActive: activeFormats.isLink, onClick: handleLinkClick }]] : []),
  ] as const;

  return (
    <Flex
      dir={['row', null, null]}
      wrap={['wrap', 'wrap', 'wrap']}
      align={['center', null, null]}
      gap={[16, null, null]}
      grow={[1, null, null]}
    >
      {toolbarGroups.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {group.map((action) => (
            <ToolbarIconButton
              key={action.ariaLabel}
              iconSrc={action.iconSrc}
              isActive={action.isActive}
              onClick={action.onClick}
              ariaLabel={action.ariaLabel}
            />
          ))}

          {groupIndex < toolbarGroups.length - 1 && <Flex w={[1, null, null]} h={[20, null, null]} bg='var(--gray-light)' />}
        </Fragment>
      ))}

      {hasVariables && (
        <Text variant={['dop', null, null]} color='var(--gray)'>
          Введите @ для вставки переменной
        </Text>
      )}
    </Flex>
  );
}
