'use client';

import styles from './Skeleton.module.scss';

import { Flex } from '../Flex';
import { cx, type ResponsiveValue } from '../core';

export interface SkeletonProps {
    /** Ширина полосы. По умолчанию во всю доступную. */
    w?: ResponsiveValue<number | string>;
    /** Высота ОДНОЙ полосы. Дефолт 16 — строка текста, а не пустая коробка. */
    h?: ResponsiveValue<number | string>;
    r?: ResponsiveValue<number>;
    /**
     * Сколько полос. Больше одной — это абзац: последняя короче остальных.
     *
     * Укорочение не украшение: ровный прямоугольник из трёх одинаковых полос читается как
     * ЭЛЕМЕНТ интерфейса (панель, картинка), а рваный правый край — как текст, который сейчас
     * приедет. Ожидание тем и отличается от поломки, что видно, ЧЕГО ждут.
     */
    rows?: number;
    gap?: ResponsiveValue<number>;
    className?: string;
}

/**
 * Заглушка на месте того, что ещё грузится.
 *
 * Отдельный примитив, а не «серый `Flex`», по двум причинам. Первая — блик: он и делает разницу
 * между «здесь пусто» и «здесь сейчас появится», а выражается только кадрами и псевдоэлементом,
 * то есть пропсами не задаётся (§9.1). Вторая — место: скелетон обязан занимать РОВНО столько,
 * сколько займёт контент, иначе на его приезде экран прыгает, и лечение оказывается хуже болезни.
 *
 * Поэтому геометрию у него всегда задаёт СОСЕД по разметке (высота строки поля, высота карточки),
 * а не сам скелетон «на глаз».
 */
export function Skeleton({ w = ['100%', null, null], h = [16, null, null], r = [8, null, null], rows = 1, gap = [8, null, null], className }: SkeletonProps) {
    if (rows === 1) {
        return <Flex w={w} h={h} r={r} bg='var(--gray-light)' className={cx(styles.Skeleton, className)} />;
    }

    return (
        <Flex dir={['column', null, null]} gap={gap} w={w} className={className}>
            {Array.from({ length: rows }, (_row, index) => (
                <Flex
                    key={index}
                    // 70, а не «на глаз» 60: процентные классы генерятся только для значений,
                    // попавших в сейфлист ($unit-values), и 60 там нет — класс был бы мёртвым
                    // (§12 «Мёртвые классы»). Проверка: grep '^\$unit-values' _safelist.scss.
                    w={index === rows - 1 ? ['70%', null, null] : ['100%', null, null]}
                    h={h}
                    r={r}
                    bg='var(--gray-light)'
                    className={styles.Skeleton}
                />
            ))}
        </Flex>
    );
}
