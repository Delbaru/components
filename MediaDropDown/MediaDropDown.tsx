'use client';

import styles from './MediaDropDown.module.scss';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { cx, stateProps, type WithRef, useMergedRefs } from '../core';
import { resolveSvgAssetSource } from '../core/base/svg-asset';
import { useOutsideDismiss } from '../hooks/useOutsideDismiss';
import { Flex } from '../Flex';
import { Text } from '../Text';
import { Icon } from '../Icon';
import SkipNextOutlineIconAsset from '../RichTextarea/assets/skip-next-outline.svg';

const SkipNextOutlineIcon = resolveSvgAssetSource(SkipNextOutlineIconAsset) ?? '';

export type MediaType = 'image' | 'video' | 'audio' | 'file';

export type MediaDropDownSelectionSource = 'file' | 'link';

export type MediaDropDownSelection = {
    type: MediaType;
    source: MediaDropDownSelectionSource;
    label: string;
    src?: string;
    fileName?: string;
    mimeType?: string;
    link?: string;
};

export interface MediaDropDownProps {
    className?: string;
    style?: CSSProperties;
    value?: MediaType;
    defaultValue?: MediaType;
    onChange?: (value: MediaType) => void;
    onFileSelect?: (files: FileList | null) => void;
    selectedItem?: MediaDropDownSelection | null;
    defaultSelectedItem?: MediaDropDownSelection | null;
    onSelectedItemChange?: (value: MediaDropDownSelection | null) => void;
    onPreview?: (value: MediaDropDownSelection) => void;
    linkValue?: string;
    onLinkChange?: (value: string) => void;
    onLinkSubmit?: (value: string) => void;
    disabled?: boolean;
}

type MediaTypeOption = { type: MediaType; label: string; icon: string; hint: string; accept?: string };

const MEDIA_TYPES: [MediaTypeOption, ...MediaTypeOption[]] = [
    {
        type: 'image',
        label: 'Изображение',
        icon: 'ui/image/style-1/image',
        hint: 'Ссылка должна вести на изображение (JPG, PNG, WEBP)',
        accept: 'image/*',
    },
    {
        type: 'video',
        label: 'Видео',
        icon: 'ui/video/style-1/video',
        hint: 'Ссылка должна вести на видео',
        accept: 'video/*',
    },
    {
        type: 'audio',
        label: 'Аудио',
        icon: 'ui/audio/style-1/audio',
        hint: 'Ссылка должна вести на аудиофайл',
        accept: 'audio/*',
    },
    {
        type: 'file',
        label: 'Файл',
        icon: 'ui/file/style-2/file',
        hint: 'Ссылка должна вести на файл',
    },
];

function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }

            reject(new Error('Unable to read media file'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read media file'));
        reader.readAsDataURL(file);
    });
}

function isPlayableMedia(type?: MediaType) {
    return type === 'video' || type === 'audio';
}

export function MediaDropDown({
    ref,
    className = '',
    style,
    value: valueProp,
    defaultValue = 'image',
    onChange,
    onFileSelect,
    selectedItem: selectedItemProp,
    defaultSelectedItem = null,
    onSelectedItemChange,
    onPreview,
    linkValue = '',
    onLinkChange,
    onLinkSubmit,
    disabled,
}: WithRef<MediaDropDownProps, HTMLDivElement>) {
    const [uncontrolledValue, setUncontrolledValue] = useState<MediaType>(defaultValue);
    const [uncontrolledSelectedItem, setUncontrolledSelectedItem] = useState<MediaDropDownSelection | null>(
        defaultSelectedItem
    );
    const [open, setOpen] = useState(false);
    const [link, setLink] = useState(linkValue);
    const rootRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const value = valueProp !== undefined ? valueProp : uncontrolledValue;
    const selectedItem = selectedItemProp !== undefined ? selectedItemProp : uncontrolledSelectedItem;

    const updateSelectedItem = useCallback(
        (nextValue: MediaDropDownSelection | null) => {
            if (selectedItemProp === undefined) {
                setUncontrolledSelectedItem(nextValue);
            }

            onSelectedItemChange?.(nextValue);
        },
        [onSelectedItemChange, selectedItemProp]
    );

    const handleToggle = useCallback(() => {
        if (disabled) return;
        setOpen((prev) => !prev);
    }, [disabled]);

    const handleClose = useCallback(() => {
        setOpen(false);
    }, []);

    const handleSelect = useCallback(
        (type: MediaType) => {
            if (valueProp === undefined) setUncontrolledValue(type);

            if (selectedItem?.type !== undefined && selectedItem.type !== type) {
                updateSelectedItem(null);
                setLink('');
                onLinkChange?.('');
            }

            onChange?.(type);
        },
        [onChange, onLinkChange, selectedItem, updateSelectedItem, valueProp]
    );

    const handleFileClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const nextFiles = e.target.files;
            const nextFile = nextFiles?.[0];

            onFileSelect?.(nextFiles);

            if (nextFile) {
                let src: string | undefined;

                try {
                    src = await readFileAsDataUrl(nextFile);
                } catch {
                    src = undefined;
                }

                updateSelectedItem({
                    type: value,
                    source: 'file',
                    label: nextFile.name,
                    src,
                    fileName: nextFile.name,
                    mimeType: nextFile.type,
                });
                setLink('');
                onLinkChange?.('');
                setOpen(false);
            }

            if (e.target) e.target.value = '';
        },
        [onFileSelect, onLinkChange, updateSelectedItem, value]
    );

    const handleLinkChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setLink(e.target.value);
            onLinkChange?.(e.target.value);
        },
        [onLinkChange]
    );

    const handleLinkKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.preventDefault();

                const normalizedLink = link.trim();

                if (!normalizedLink) {
                    return;
                }

                setLink(normalizedLink);
                updateSelectedItem({
                    type: value,
                    source: 'link',
                    label: normalizedLink,
                    src: normalizedLink,
                    link: normalizedLink,
                });
                onLinkSubmit?.(normalizedLink);
                setOpen(false);
            }
        },
        [link, onLinkSubmit, updateSelectedItem, value]
    );

    const handleClearSelection = useCallback(
        (e: ReactMouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            updateSelectedItem(null);
            setLink('');
            onLinkChange?.('');

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        },
        [onLinkChange, updateSelectedItem]
    );

    const handlePreviewSelection = useCallback(
        (e: ReactMouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();

            if (!selectedItem) {
                return;
            }

            onPreview?.(selectedItem);
        },
        [onPreview, selectedItem]
    );

    useEffect(() => {
        setLink(linkValue);
    }, [linkValue]);

    // Escape не слушаем: до этой правки его здесь не было, и добавлять поведение молча нельзя.
    useOutsideDismiss(rootRef, handleClose, { enabled: open, escape: false });

    const selectedMedia = MEDIA_TYPES.find((m) => m.type === value) ?? MEDIA_TYPES[0];
    const triggerLabel = selectedItem?.label ?? 'Добавить медиа';
    const canPreview = Boolean(selectedItem && onPreview && (selectedItem.src || selectedItem.link));
    const previewIsPlay = isPlayableMedia(selectedItem?.type);

    const setRefs = useMergedRefs(rootRef, ref);

    return (
        <div
            ref={setRefs}
            className={cx(styles.MediaDropDown, className)}
            style={style}
            data-open={open}
            {...stateProps(disabled && 'disabled')}
        >
            <Flex
                align={['center', 'center', 'center']}
                justify={['space_between', 'space_between', 'space_between']}
                className={styles.Trigger}
                onClick={handleToggle}
            >
                <Flex
                    align={['center', 'center', 'center']}
                    justify={['center', 'center', 'center']}
                    gap={[12, 12, 12]}
                    className={styles.TriggerContent}
                >
                    <Flex
                        align={['center', 'center', 'center']}
                        justify={['center', 'center', 'center']}
                        className={styles.TriggerIconRoot}
                    >
                        <Icon
                            name={selectedMedia.icon}
                            w={[20, 20, 20]}
                            h={[20, 20, 20]}
                            className={styles.TriggerIcon}
                        />
                    </Flex>
                    <Text variant={['small', 'small', 'small']} className={styles.TriggerLabel}>
                        {triggerLabel}
                    </Text>
                </Flex>
                <Flex
                    dir={['row', 'row', 'row']}
                    align={['center', 'center', 'center']}
                    justify={['center', 'center', 'center']}
                    gap={[8, 8, 8]}
                    className={styles.TriggerActions}
                >
                    {canPreview ? (
                        <button
                            type="button"
                            className={styles.PreviewButton}
                            aria-label={previewIsPlay ? 'Воспроизвести медиа' : 'Предпросмотр медиа'}
                            onClick={handlePreviewSelection}
                        >
                            {previewIsPlay ? (
                                <Icon
                                    src={SkipNextOutlineIcon}
                                    w={[16, 16, 16]}
                                    h={[16, 16, 16]}
                                    fill="currentColor"
                                    className={styles.PlayIcon}
                                />
                            ) : (
                                <Icon
                                    src="/icons/ui/eye/style-1/eye.svg"
                                    w={[20, 20, 20]}
                                    h={[20, 20, 20]}
                                    fill="currentColor"
                                    className={styles.PreviewIcon}
                                />
                            )}
                        </button>
                    ) : null}
                    {selectedItem ? (
                        <button
                            type="button"
                            className={styles.ClearButton}
                            aria-label="Удалить медиа"
                            onClick={handleClearSelection}
                        >
                            <Icon
                                src="/icons/ui/delete/style-1/delete.svg"
                                w={[20, 20, 20]}
                                h={[20, 20, 20]}
                                stroke="currentColor"
                                className={styles.ClearIcon}
                            />
                        </button>
                    ) : null}
                    <Icon
                        name="ui/arrows/arrow-2/arrow"
                        w={[16, 16, 16]}
                        h={[16, 16, 16]}
                        className={styles.Arrow}
                    />
                </Flex>
            </Flex>

            <div className={styles.DropdownWrapper} aria-hidden={!open}>
                <div className={styles.DropdownInner}>
                    <Flex dir={['column', 'column', 'column']} gap={[8, 8, 8]} className={styles.Dropdown}>
                        <div className={styles.TypeGrid}>
                            {MEDIA_TYPES.map((media) => {
                                const isActive = value === media.type;
                                return (
                                    <Flex
                                        key={media.type}
                                        align={['center', 'center', 'center']}
                                        justify={['center', 'center', 'center']}
                                        gap={[6, 6, 6]}
                                        className={cx(styles.TypeButton, isActive && styles.TypeButtonActive)}
                                        onClick={() => handleSelect(media.type)}
                                    >
                                        <Icon
                                            name={media.icon}
                                            w={[16, 16, 16]}
                                            h={[16, 16, 16]}
                                            className={styles.TypeIcon}
                                        />
                                        <Text variant={['dop', 'dop', 'dop']} className={styles.TypeLabel}>
                                            {media.label}
                                        </Text>
                                    </Flex>
                                );
                            })}
                        </div>

                        <Flex dir={['column', 'column', 'column']} gap={[12, 12, 12]} className={styles.UploadSection}>
                            <button type="button" className={styles.FileButton} onClick={handleFileClick}>
                                <Icon
                                    name="ui/upload/style-2/upload"
                                    w={[16, 16, 16]}
                                    h={[16, 16, 16]}
                                    className={styles.UploadIcon}
                                />
                                <Text variant={['dop', 'dop', 'dop']} className={styles.UploadLabel}>
                                    Выбрать файл
                                </Text>
                            </button>

                            <Flex
                                align={['center', 'center', 'center']}
                                justify={['center', 'center', 'center']}
                                gap={[8, 8, 8]}
                                className={styles.Divider}
                            >
                                <span className={styles.DividerLine} />
                                <Text variant={['dop', 'dop', 'dop']} className={styles.DividerText}>
                                    или
                                </Text>
                                <span className={styles.DividerLine} />
                            </Flex>

                            <div className={styles.LinkInputWrapper}>
                                <input
                                    type="text"
                                    value={link}
                                    onChange={handleLinkChange}
                                    onKeyDown={handleLinkKeyDown}
                                    placeholder="Вставьте ссылку"
                                    className={styles.LinkInput}
                                />
                            </div>
                            <Text variant={['dop', 'dop', 'dop']} className={styles.LinkHint}>
                                {selectedMedia.hint}
                            </Text>
                        </Flex>
                    </Flex>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept={selectedMedia.accept}
                className={styles.HiddenInput}
                onChange={handleFileChange}
            />
        </div>
    );
}
