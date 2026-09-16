'use client';

import { useLayoutEffect, useRef, type ComponentProps, type ReactElement } from 'react';

import { Flex } from '../Flex';
import { cx } from '../core';

import styles from './TabTrack.module.scss';

/** Чем бегунок рисует выбор: сплошной `primary`, белая пилюля на серой дорожке или линия под вкладкой. */
export type TabTrackThumb = 'primary' | 'white' | 'line';

export type TabTrackProps = Omit<ComponentProps<typeof Flex>, 'ref'> & {
    /**
     * Выбранная вкладка. Бегунок едет к узлу с `state~='active'` внутри дорожки, а значение нужно,
     * только чтобы знать, КОГДА мерить заново. `null` — не выбрана ни одна, бегунок гаснет.
     */
    value: string | null;
    thumb: TabTrackThumb;
};

const ACTIVE = "[state~='active']";

const THUMB_BG: Record<TabTrackThumb, string | undefined> = {
    primary: 'var(--primary)',
    white: 'var(--white-100)',
    line: undefined,
};

// Середина бегунка — брусок этой ширины, растянутый `scaleX` до нужной. Число любое: важно только,
// чтобы JS и стиль бруска говорили одно и то же, поэтому ширину ставит сам JS.
const BODY_WIDTH = 100;

// Колпачки заходят на середину на пиксель: на дробных сдвигах стык двух узлов сглаживается, и между
// ними просвечивала бы волосяная щель. Цвет у частей один, нахлёст не виден.
const SEAM = 1;

// Смещение узла внутри дорожки — суммой offsetLeft/Top по цепочке offsetParent, а не разницей
// getBoundingClientRect: та включает transform, и дорожка в окне, въезжающем со scale, намерила бы
// бегунок не того размера. Дорожка позиционирована (модуль), поэтому цепочка кончается на ней, даже
// если пилюля лежит в своей позиционированной обёртке.
function offsetWithin(node: HTMLElement, track: HTMLElement) {
    let x = 0;
    let y = 0;
    let el: HTMLElement | null = node;

    while (el && el !== track) {
        x += el.offsetLeft;
        y += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
    }

    return { x, y };
}

/**
 * Дорожка переключателя с ОДНИМ бегунком выбора: он переезжает с прежней вкладки на новую, а не
 * гаснет на одной и загорается на другой. Пилюли внутри — обычные (`SharedButtonText` с `active`,
 * `Button` со `state='active'`); свою заливку выбора они отдают бегунку, подпись красят сами.
 *
 * Бегунок едет ТОЛЬКО трансформами — их ведёт композитор, и езда не дёргается, даже когда главный
 * поток занят. Поэтому он собран из трёх частей: два скруглённых колпачка просто сдвигаются, а
 * середина между ними сдвигается и тянется `scaleX`. Растянуть целиком нельзя — `scaleX` сплющил бы
 * скругления; анимировать `width` нельзя — это раскладка на главном потоке, и правый край отставал
 * бы от левого рывками.
 *
 * Пока бегунок не намерен (серверный HTML, первый кадр до гидрации), выбранная пилюля красит себя
 * сама — поэтому при загрузке не мигает «ничего не выбрано». Первая постановка и появление после
 * `null` — без езды; едет только смена выбора и смена размеров (шрифт догрузился, окно сузилось).
 *
 * Все пропсы — это пропсы `Flex`: дорожка сохраняет свою раскладку, подложку, поле и радиус.
 */
export function TabTrack({ value, thumb, className, children, ...props }: TabTrackProps): ReactElement {
    const trackRef = useRef<HTMLElement>(null);
    const thumbRef = useRef<HTMLElement>(null);
    const placedRef = useRef(false);

    useLayoutEffect(() => {
        const track = trackRef.current;
        const knob = thumbRef.current;
        if (!track || !knob) return;

        const [start, body, end] = Array.from(knob.children) as HTMLElement[];
        // Три части бегунка рисуются тут же в разметке, но строгий режим библиотеки требует сказать
        // это вслух: индексация массива даёт `T | undefined`, и молчаливого `!` в UI/ быть не должно.
        if (!start || !body || !end) return;

        const active = track.querySelector<HTMLElement>(ACTIVE);

        const place = () => {
            if (!active || active.offsetWidth === 0) {
                track.removeAttribute('data-thumb-ready');
                placedRef.current = false;
                return;
            }

            const instant = !placedRef.current;
            const { x, y } = offsetWithin(active, track);
            const w = active.offsetWidth;
            const h = active.offsetHeight;
            const corner = thumb === 'line' ? 0 : parseFloat(getComputedStyle(active).borderTopLeftRadius) || 0;
            const r = Math.min(corner, h / 2, w / 2);

            if (instant) track.setAttribute('data-thumb-instant', '');

            for (const part of [start, body, end]) part.style.height = `${h}px`;

            start.style.width = `${r + SEAM}px`;
            start.style.borderRadius = `${r}px 0 0 ${r}px`;
            start.style.transform = `translate(${x}px, ${y}px)`;

            end.style.width = `${r + SEAM}px`;
            end.style.borderRadius = `0 ${r}px ${r}px 0`;
            end.style.transform = `translate(${x + w - r - SEAM}px, ${y}px)`;

            body.style.width = `${BODY_WIDTH}px`;
            body.style.transform = `translate(${x + r}px, ${y}px) scaleX(${(w - 2 * r) / BODY_WIDTH})`;

            track.setAttribute('data-thumb-ready', '');

            if (instant) {
                track.getBoundingClientRect();
                track.removeAttribute('data-thumb-instant');
            }

            placedRef.current = true;
        };

        place();

        // Первое уведомление наблюдатель шлёт сразу после `observe` — посреди только что начатой езды.
        // Оно безвредно: цель та же, и повторная постановка в неё переход не сбивает.
        const observer = new ResizeObserver(place);
        observer.observe(track);
        if (active) observer.observe(active);

        return () => observer.disconnect();
    }, [value, thumb]);

    const bg = THUMB_BG[thumb];

    return (
        <Flex ref={trackRef} className={cx(styles.TabTrack, className)} data-thumb={thumb} {...props}>
            {children}
            <Flex ref={thumbRef} aria-hidden className={styles.thumb}>
                <Flex bg={bg} className={cx(styles.part, styles.cap)} />
                <Flex bg={bg} className={cx(styles.part, styles.body)} />
                <Flex bg={bg} className={cx(styles.part, styles.cap)} />
            </Flex>
        </Flex>
    );
}
