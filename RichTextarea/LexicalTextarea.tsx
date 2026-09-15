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
import type { CSSProperties } from 'react';

import type { SharedMotionProps } from '../hooks/useSharedMotion';
import { Box } from '../Box';
import { Flex } from '../Flex';
import { Text } from '../Text';
import { cx, mergeComponentStates, type BorderStyleProps, type ComponentStateValue, type GrowProps, type LayoutSpaceProps, type RadiusPropsShort, type SizePropsShort, type StateLinkInput, type WithRef } from '../core';
import richTextStyles from '../RichText/RichText.module.scss';
import type { LexicalTextVariant } from '../RichText';
import { LexicalTextareaCounter, LexicalTextareaToolbar } from './LexicalTextareaToolbar';
import { isAllowedLink } from './lexical/links';
import { ContentSyncPlugin, EditorRefPlugin, VariableSelectionPlugin, VariablesPlugin } from './lexical/plugins';
import { VariableNode } from './lexical/VariableNode';
import styles from './RichTextarea.module.scss';
import type { LexicalTextareaChangePayload, LexicalTextareaContent, LexicalTextareaHandle, LexicalTextareaVariable } from './types';
import { useLexicalTextarea } from './useLexicalTextarea';

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
// Общий пустой список: литерал `[]` по умолчанию новый на каждом рендере, и плагины с
// `variableLookup` в зависимостях перерегистрировались бы на каждом рендере.
const NO_VARIABLES: LexicalTextareaVariable[] = [];

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
  variables = NO_VARIABLES,
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
  const {
    id, editorRef, variableLookup, contentSignature, editorMeta, helperError, helperText,
    helperTextColor, helperTextId, showCounter, hasVariables, handleEditorChange, handleContentSync,
    handleBlur,
  } = useLexicalTextarea(ref, {
    id: idProp, content, variables, onChange, minLength, maxLength, error, comment, required,
    emptyMessage, validate,
  });

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

          <Box className={styles.EditorShell}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  id={id}
                  className={contentClassName}
                  aria-describedby={helperTextId}
                  aria-invalid={Boolean(helperError)}
                  onBlur={handleBlur}
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
