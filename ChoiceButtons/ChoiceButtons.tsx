'use client';

import { useId, useState } from 'react';

import { Button } from '../Button';
import { Flex } from '../Flex';
import { Icon } from '../Icon';
import { Select } from '../Select';
import { TabTrack } from '../TabTrack';
import { Text } from '../Text';
import { Tooltip } from '../Tooltip';
import { cx } from '../core';
import { resolveSvgAssetSource } from '../core/base/svg-asset';
import { useTooltip } from '../hooks/useTooltip';

import styles from './ChoiceButtons.module.scss';
import UpIcon from './assets/up.svg';

const tooltipArrowIconSrc = resolveSvgAssetSource(UpIcon);

type ChoiceInfoTooltipProps = {
    id: string;
    description: string;
    infoClassName: string;
    tooltipClassName: string;
};

function ChoiceInfoTooltip({
    id,
    description,
    infoClassName,
    tooltipClassName,
}: ChoiceInfoTooltipProps) {
    // Тот же фундамент, что у Input/Button: видимость по наведению + позиционирование + портал + fade.
    // Свой только скин — карточка с описанием и хвост-указатель (surface={false}).
    const tooltip = useTooltip<HTMLElement, HTMLDivElement>({
        direction: 'bottom',
        align: 'center',
        gap: 8,
    });

    return (
        <Flex
            ref={tooltip.anchorRef}
            dir={['row', null, null]}
            align={['center', null, null]}
            justify={['center', null, null]}
            onMouseEnter={tooltip.show}
            onMouseLeave={tooltip.hide}
            className={styles.tooltipWrapper}
        >
            <Icon
                src='/icons/ui/info/style-1/info.svg'
                w={[20, null, null]}
                h={[20, null, null]}
                strokeWidth={[1.25, null, null]}
                aria-hidden='true'
                className={cx(styles.info, infoClassName)}
            />

            <Tooltip
                ref={tooltip.tooltipRef}
                id={id}
                surface={false}
                className={cx(styles.tooltip, tooltipClassName)}
                {...tooltip.bubbleProps}
            >
                <Flex
                    p={[16, null, null]}
                    r={[16, null, null]}
                    bg='var(--white-100)'
                    maxW={[400, null, null]}
                    minW={[264, null, null]}
                    border={['calc(1 * var(--rpx)) solid var(--gray-light)', null, null]}
                    className={styles.card}
                >
                    <Text variant={['small', null, null]}>{description}</Text>
                </Flex>

                <Icon
                    src={tooltipArrowIconSrc}
                    w={[24, null, null]}
                    h={[24, null, null]}
                    aria-hidden='true'
                    className={styles.tail}
                />
            </Tooltip>
        </Flex>
    );
}

export interface ChoiceButtonsItem {
    value: string;
    label: string;
    description?: string;
    onSelect?: (value: string) => void;
}

export interface ChoiceButtonsProps {
    items: ChoiceButtonsItem[];
    value?: string | null;
    defaultValue?: string | null;
    onChange?: (value: string, item: ChoiceButtonsItem) => void;
    className?: string;
    itemClassName?: string;
    buttonClassName?: string;
    textClassName?: string;
    infoClassName?: string;
    tooltipClassName?: string;
}

export function ChoiceButtons({
    items,
    value,
    defaultValue = null,
    onChange,
    className = '',
    itemClassName = '',
    buttonClassName = '',
    textClassName = '',
    infoClassName = '',
    tooltipClassName = '',
}: ChoiceButtonsProps) {
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<string | null>(defaultValue);
    const [hoveredValue, setHoveredValue] = useState<string | null>(null);
    const baseId = useId().replace(/:/g, '');

    const selectedValue = isControlled ? value ?? null : internalValue;

    const handleSelectValue = (nextValue: string | null) => {
        if (!isControlled) {
            setInternalValue(nextValue);
        }

        if (nextValue == null) {
            return;
        }

        const selectedItem = items.find((item) => item.value === nextValue);

        if (!selectedItem) {
            return;
        }

        selectedItem.onSelect?.(nextValue);
        onChange?.(nextValue, selectedItem);
    };

    const handleMobileTabletSelectChange = (nextValue: string | null | string[]) => {
        handleSelectValue(Array.isArray(nextValue) ? nextValue[0] ?? null : nextValue);
    };

    return (
        <>
            <TabTrack
                value={selectedValue}
                thumb='primary'
                dir={['row', null, null]}
                align={['center', null, null]}
                p={[4, null, null]}
                r={[12, null, null]}
                bg='var(--background)'
                className={cx(styles.ChoiceButtons, className)}
                data-hide-mobile
                data-hide-tablet
            >
                {items.map((item) => {
                    const description = item.description;
                    const isSelected = item.value === selectedValue;
                    const isHovered = item.value === hoveredValue;
                    const buttonState = isSelected
                        ? (isHovered ? ['active', 'hover'] : 'active')
                        : (isHovered ? 'hover' : undefined);
                    const hoverHandlers = {
                        onMouseEnter: () => setHoveredValue(item.value),
                        onMouseLeave: () => setHoveredValue((currentValue) => currentValue === item.value ? null : currentValue),
                    };

                    const tooltipId = `${baseId}-${item.value}-tooltip`;

                    return (
                        <Flex
                            key={item.value}
                            w={['100%', null, null]}
                            className={cx(styles.item, itemClassName)}
                        >
                            <Button
                                h={[48, null, null]}
                                w={['100%', null, null]}
                                r={[12, null, null]}
                                type='button'
                                state={buttonState}
                                aria-pressed={isSelected}
                                aria-describedby={description ? tooltipId : undefined}
                                {...hoverHandlers}
                                onClick={() => handleSelectValue(item.value)}
                                className={cx(styles.button, buttonClassName)}
                            >
                                <Flex dir={['row', null, null]} align={['center', null, null]} gap={[8, null, null]}>
                                    <Text variant={['p', null, null]} color='var(--gray)' className={cx(styles.label, textClassName)}>
                                        {item.label}
                                    </Text>

                                    {description && (
                                        <ChoiceInfoTooltip
                                            id={tooltipId}
                                            description={description}
                                            infoClassName={infoClassName}
                                            tooltipClassName={tooltipClassName}
                                        />
                                    )}
                                </Flex>
                            </Button>
                        </Flex>
                    );
                })}
            </TabTrack>

            <Select
                multiple={false}
                options={items.map(({ value: itemValue, label }) => ({ value: itemValue, label }))}
                value={selectedValue}
                onChange={handleMobileTabletSelectChange}
                visibleOptions={Math.min(items.length, 3)}
                data-hide-pc
            />
        </>
    );
}
