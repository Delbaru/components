'use client';

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type CSSProperties,
} from 'react';

import styles from './VideoPlayer.module.scss';

import { clamp01 } from '../core/utils';
import {
    aspectRatioStyle,
    createLayoutClasses,
    cx,
    growStyle,
    inlineAspectRatioClassName,
    inlineGrowClassName,
    needsInlineAspectRatio,
    needsInlineGrow,
    radiusClasses,
    resolveRadiusInput,
    sizeClasses,
    sizeInlineStyle,
    tokenStyles,
} from '../core';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { Video } from '../Video';

import { usePointerRatio } from './usePointerRatio';
import { useVideoPlayer } from './useVideoPlayer';
import type { MediaSource, VideoPlayerApi, VideoPlayerApiRef, VideoPlayerControlKey, VideoPlayerProps } from './types';

const c = createLayoutClasses([tokenStyles, styles]);

const DEFAULT_CONTROLS: VideoPlayerControlKey[] = ['play', 'timeline', 'time', 'volume', 'fullscreen'];

// Иконки бара — Solar bold, как в макете (node 3284:22814).
const ICON = {
    play: '/icons/ui/play/style-2/play.svg',
    pause: '/icons/ui/pause/style-1/pause.svg',
    volume: '/icons/ui/volume/style-1/volume.svg',
    volumeMuted: '/icons/ui/volume/style-1/volume-muted.svg',
    fullscreen: '/icons/ui/fullscreen/style-1/fullscreen.svg',
    fullscreenQuit: '/icons/ui/fullscreen/style-1/fullscreen-quit.svg',
};

// Через сколько мс простоя прятать управление во время воспроизведения.
const AUTO_HIDE_MS = 2000;
// Окно ожидания второго клика (одиночный = play/pause, двойной = фуллскрин).
const DOUBLE_CLICK_MS = 220;
// Шаг громкости колесом мыши.
const WHEEL_VOLUME_STEP = 0.05;

// Часы записи HH:MM:SS с ведущими нулями (нижний бар: «00:32:12 / 01:32:23»).
function formatClock(totalSeconds: number): string {
    const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${pad(Math.floor(safe / 3600))}:${pad(Math.floor((safe % 3600) / 60))}:${pad(safe % 60)}`;
}

function nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : 0;
}

function resolveSrc(source?: MediaSource): string | undefined {
    if (!source) return undefined;

    return typeof source === 'string' ? source : source.src;
}

function assignApiRef(apiRef: VideoPlayerApiRef | undefined, value: VideoPlayerApi | null): void {
    if (!apiRef) return;

    if (typeof apiRef === 'function') {
        apiRef(value);
        return;
    }

    apiRef.current = value;
}

// Иконка бара. Solar-глифы залиты (fill), поэтому по умолчанию красим только fill; линейным иконкам
// (лейбл источника) нужен ещё stroke — включается флагом withStroke.
function BarIcon({ src, withStroke }: { src: string; withStroke?: boolean }) {
    return (
        <Icon
            src={src}
            w={[24, null, null]}
            h={[24, null, null]}
            fill='var(--white-100)'
            stroke={withStroke ? 'var(--white-100)' : undefined}
        />
    );
}

// Плавная смена двух иконок (crossfade + scale) в фикс-боксе 24×24 — ширина не скачет.
function IconSwap({ active, a, b }: { active: boolean; a: string; b: string }) {
    return (
        <span className={styles.iconSwap} data-active={active ? 'b' : 'a'}>
            <span className={cx(styles.iconSwapItem, styles.iconSwapA)}><BarIcon src={a} /></span>

            <span className={cx(styles.iconSwapItem, styles.iconSwapB)}><BarIcon src={b} /></span>
        </span>
    );
}

export interface TimelinePreviewHandle {
    show(ratio: number, trackWidth: number, time: number): void;
    hide(): void;
}

// Превью таймлайна: кадр (скрытое <video>, сикаем throttle-ом через rAF) + время (через Text — родная
// типографика) + каретка, указывающая на курсор. Позиция бокса и каретки — императивно (без ре-рендера);
// в state только видимость и целая секунда (ре-рендер лишь при смене секунды).
const TimelinePreview = forwardRef<TimelinePreviewHandle, { src?: string }>(function TimelinePreview({ src }, ref) {
    const boxRef = useRef<HTMLDivElement | null>(null);
    const caretRef = useRef<HTMLSpanElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const pendingRef = useRef<number | null>(null);
    const rafRef = useRef(0);

    const [visible, setVisible] = useState(false);
    const [sec, setSec] = useState(0);

    useImperativeHandle(ref, () => ({
        show(ratio, trackWidth, time) {
            const box = boxRef.current;

            if (box) {
                const half = box.offsetWidth / 2;
                const cursorPx = ratio * trackWidth;
                const leftPx = Math.min(Math.max(cursorPx, half), Math.max(trackWidth - half, half));

                box.style.left = `${leftPx}px`;

                if (caretRef.current) {
                    caretRef.current.style.left = `calc(50% + ${cursorPx - leftPx}px)`;
                }
            }

            pendingRef.current = time;

            if (!rafRef.current && typeof requestAnimationFrame !== 'undefined') {
                rafRef.current = requestAnimationFrame(() => {
                    rafRef.current = 0;

                    const node = videoRef.current;
                    const pending = pendingRef.current;

                    if (node && pending != null) {
                        const nodeDuration = node.duration;
                        node.currentTime = Number.isFinite(nodeDuration) ? Math.min(pending, Math.max(nodeDuration - 0.05, 0)) : pending;
                    }
                });
            }

            const flooredSec = Math.floor(time);
            setVisible(true);
            setSec((prev) => (prev === flooredSec ? prev : flooredSec));
        },
        hide() {
            setVisible(false);
        },
    }), []);

    useEffect(() => () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }, []);

    return (
        <div ref={boxRef} className={styles.preview} data-visible={visible ? 'true' : 'false'} aria-hidden='true'>
            {src ? <video ref={videoRef} className={styles.previewVideo} src={src} muted preload='metadata' playsInline /> : null}

            <Text variant={['dop', null, null]} color='var(--white-100)' whiteSpace={['nowrap', null, null]}>{formatClock(sec)}</Text>

            <span ref={caretRef} className={styles.previewCaret} aria-hidden='true' />
        </div>
    );
});

// Скин плеера: примитив Video подложкой + оверлеи (лейбл сверху-слева, бар управления снизу).
// Логика — в контроллере (useVideoPlayer). Тикающее время двигает заливку императивно; таймкод — раз
// в секунду. YouTube-поведение: автоскрытие (при простое во время игры и при уходе мыши), клик =
// play/pause, двойной = фуллскрин, превью кадра + время над курсором. interactive=false — ведомый режим.
export const VideoPlayer = forwardRef<HTMLDivElement, VideoPlayerProps>(
    (
        {
            controller,
            apiRef,
            src,
            poster,
            label,
            labelIcon,
            objectFit,
            aspectRatio,
            controls,
            autoPlay,
            interactive = true,
            className,
            style,
            w,
            minW,
            maxW,
            h,
            minH,
            maxH,
            r,
            tlr,
            trr,
            brr,
            blr,
            borderTLR,
            borderTRR,
            borderBRR,
            borderBLR,
            grow,
        },
        ref
    ) => {
        const fallbackController = useVideoPlayer(autoPlay ? { autoPlay } : undefined);
        const player = controller ?? fallbackController;

        const state = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);

        const rootRef = useRef<HTMLDivElement | null>(null);
        const videoNodeRef = useRef<HTMLVideoElement | null>(null);
        const fillRef = useRef<HTMLDivElement | null>(null);
        const volumeRef = useRef<HTMLDivElement | null>(null);
        const volumeFillRef = useRef<HTMLDivElement | null>(null);
        const hoverFillRef = useRef<HTMLDivElement | null>(null);
        const timelineElRef = useRef<HTMLDivElement | null>(null);
        const dotRef = useRef<HTMLDivElement | null>(null);
        const previewApiRef = useRef<TimelinePreviewHandle | null>(null);

        const [currentSec, setCurrentSec] = useState(0);
        const [controlsVisible, setControlsVisible] = useState(true);
        const lastActivityRef = useRef(0);
        const hoveringControlsRef = useRef(false);
        const clickTimerRef = useRef<number | null>(null);

        const visibleControls = useMemo(() => new Set(controls ?? DEFAULT_CONTROLS), [controls]);
        const show = (key: VideoPlayerControlKey) => visibleControls.has(key);
        const resolvedSrc = resolveSrc(src);

        // --- Таймлайн: заливка + точка-playhead императивно, seek — на контроллер, таймкод — currentSec ---
        const scrub = useCallback((ratio: number) => {
            const duration = player.duration || 0;
            const pct = clamp01(ratio) * 100;

            if (fillRef.current) fillRef.current.style.width = `${pct}%`;
            if (dotRef.current) dotRef.current.style.left = `${pct}%`;

            setCurrentSec(Math.floor(ratio * duration));
            player.seek(ratio * duration);
        }, [player]);

        // Наведение на таймлайн → hover-заливка до курсора (другой цвет — куда перематываешь) + превью.
        const previewAt = useCallback((ratio: number) => {
            if (hoverFillRef.current) {
                hoverFillRef.current.style.width = `${clamp01(ratio) * 100}%`;
            }

            const track = timelineElRef.current;
            previewApiRef.current?.show(ratio, track ? track.clientWidth : 0, ratio * (player.duration || 0));
        }, [player]);

        const hidePreview = useCallback(() => previewApiRef.current?.hide(), []);

        const timeline = usePointerRatio({ orientation: 'x', onChange: scrub, onHover: previewAt, onLeave: hidePreview });

        // --- Громкость: заливку двигаем сразу (императивно), чтобы drag был плавным ---
        const applyVolume = useCallback((next: number) => {
            const value = clamp01(next);

            if (volumeFillRef.current) {
                volumeFillRef.current.style.height = `${value * 100}%`;
            }

            player.setVolume(value);
        }, [player]);

        const volume = usePointerRatio({ orientation: 'y', onChange: applyVolume });

        // --- refs-проводка ---
        const setRootRef = useCallback((node: HTMLDivElement | null) => {
            rootRef.current = node;

            if (typeof ref === 'function') {
                ref(node);
                return;
            }

            if (ref) {
                ref.current = node;
            }
        }, [ref]);

        const setVideoNode = useCallback((node: HTMLVideoElement | null) => {
            videoNodeRef.current = node;
        }, []);

        // Привязка контроллера к реальному <video> (+ корень для фуллскрина).
        useEffect(() => {
            const node = videoNodeRef.current;

            if (!node) return;

            player._attach(node, rootRef.current);

            return () => player._detach();
        }, [player]);

        // Escape-hatch apiRef.
        useEffect(() => {
            assignApiRef(apiRef, player);

            return () => assignApiRef(apiRef, null);
        }, [apiRef, player]);

        // Тикающее время: заливка таймлайна — императивно каждый кадр; таймкод — раз в секунду.
        useEffect(() => {
            return player.subscribeTime((time) => {
                const duration = player.duration || 0;
                const pct = duration ? clamp01(time / duration) * 100 : 0;

                if (!timeline.isDragging.current) {
                    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
                    if (dotRef.current) dotRef.current.style.left = `${pct}%`;
                }

                const sec = Math.floor(time);
                setCurrentSec((prev) => (prev === sec ? prev : sec));
            });
        }, [player, timeline.isDragging]);

        // Заливка громкости при внешних изменениях/mute (drag/wheel обновляют её сами).
        const volumeLevel = state.muted ? 0 : state.volume;
        useEffect(() => {
            if (volumeFillRef.current) {
                volumeFillRef.current.style.height = `${clamp01(volumeLevel) * 100}%`;
            }
        }, [volumeLevel]);

        // Колесо мыши над громкостью → шаг громкости. Native listener с passive:false, чтобы гасить
        // прокрутку страницы.
        useEffect(() => {
            const node = volumeRef.current;

            if (!node) return;

            const handleWheel = (event: WheelEvent) => {
                event.preventDefault();
                const base = player.muted ? 0 : player.volume;
                applyVolume(base + (event.deltaY < 0 ? WHEEL_VOLUME_STEP : -WHEEL_VOLUME_STEP));
            };

            node.addEventListener('wheel', handleWheel, { passive: false });

            return () => node.removeEventListener('wheel', handleWheel);
        }, [player, applyVolume]);

        // Показать управление и продлить таймер (движение/вход мыши).
        const revealControls = useCallback(() => {
            lastActivityRef.current = nowMs();
            setControlsVisible(true);
        }, []);

        // Уход мыши — прячем (и на паузе тоже), но не во время перетаскивания трека/громкости.
        const handleRootLeave = useCallback(() => {
            if (timeline.isDragging.current || volume.isDragging.current) return;

            setControlsVisible(false);
        }, [timeline.isDragging, volume.isDragging]);

        // Автоскрытие во время воспроизведения: прячем через AUTO_HIDE_MS простоя (если курсор не на баре).
        // На паузе таймером не прячем — прячет только уход мыши (handleRootLeave).
        useEffect(() => {
            if (!state.playing) return;

            lastActivityRef.current = nowMs();

            const intervalId = window.setInterval(() => {
                if (!hoveringControlsRef.current && nowMs() - lastActivityRef.current >= AUTO_HIDE_MS) {
                    setControlsVisible(false);
                }
            }, 300);

            return () => window.clearInterval(intervalId);
        }, [state.playing]);

        // Клик по видео = play/pause; двойной = фуллскрин (окно DOUBLE_CLICK_MS разводит их).
        const handleMediaClick = useCallback(() => {
            revealControls();

            if (clickTimerRef.current !== null) return;

            clickTimerRef.current = window.setTimeout(() => {
                clickTimerRef.current = null;
                player.toggle();
            }, DOUBLE_CLICK_MS);
        }, [player, revealControls]);

        const handleMediaDoubleClick = useCallback(() => {
            if (clickTimerRef.current !== null) {
                window.clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
            }

            player.toggleFullscreen();
        }, [player]);

        // Чистим отложенный клик-таймер на размонтировании.
        useEffect(() => () => {
            if (clickTimerRef.current !== null) {
                window.clearTimeout(clickTimerRef.current);
            }
        }, []);

        const isMuted = state.muted || state.volume === 0;

        const rootClassName = cx(
            styles.Root,
            !controlsVisible && interactive && styles.hidden,
            ...sizeClasses(c, { w, minW, maxW, h, minH, maxH }),
            ...radiusClasses(c, resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR })),
            needsInlineAspectRatio(aspectRatio) && inlineAspectRatioClassName(),
            needsInlineGrow(grow) && inlineGrowClassName(),
            className
        );

        const rootStyle: CSSProperties = {
            ...sizeInlineStyle({ w: w ?? '100%', minW, maxW, h, minH, maxH }),
            ...aspectRatioStyle(aspectRatio),
            ...growStyle(grow),
            ...style,
        };

        return (
            <div
                ref={setRootRef}
                className={rootClassName}
                style={rootStyle}
                onPointerMove={interactive ? revealControls : undefined}
                onPointerEnter={interactive ? revealControls : undefined}
                onPointerLeave={interactive ? handleRootLeave : undefined}
            >
                <Video ref={setVideoNode} src={src} poster={poster} objectFit={objectFit} className={styles.media} />

                {/* Захват кликов по видео: одиночный = play/pause, двойной = фуллскрин */}
                {interactive ? (
                    <div className={styles.clickLayer} onClick={handleMediaClick} onDoubleClick={handleMediaDoubleClick} aria-hidden='true' />
                ) : null}

                {label ? (
                    <div className={cx(styles.overlay, styles.labelBar)}>
                        {labelIcon ? <BarIcon src={labelIcon} withStroke /> : null}

                        <Text variant={['p', null, null]} color='var(--white-100)' whiteSpace={['nowrap', null, null]}>{label}</Text>
                    </div>
                ) : null}

                {interactive ? (
                    <div
                        className={cx(styles.overlay, styles.controlBar)}
                        onMouseEnter={() => { hoveringControlsRef.current = true; revealControls(); }}
                        onMouseLeave={() => { hoveringControlsRef.current = false; }}
                    >
                        {show('play') ? (
                            <button type='button' className={styles.button} aria-label={state.playing ? 'Пауза' : 'Воспроизвести'} onClick={() => player.toggle()}>
                                <IconSwap active={state.playing} a={ICON.play} b={ICON.pause} />
                            </button>
                        ) : null}

                        {show('timeline') ? (
                            <div
                                ref={timelineElRef}
                                className={styles.timeline}
                                role='slider'
                                aria-label='Перемотка'
                                aria-valuemin={0}
                                aria-valuemax={Math.floor(state.duration)}
                                aria-valuenow={currentSec}
                                {...timeline.bind}
                            >
                                <TimelinePreview ref={previewApiRef} src={resolvedSrc} />

                                <div className={styles.track}>
                                    {/* Hover-заливка до курсора (другой цвет) — куда перематываешь */}
                                    <div ref={hoverFillRef} className={styles.hoverFill} />

                                    {/* Проигранная часть */}
                                    <div ref={fillRef} className={styles.fill} />
                                </div>

                                {/* Точка-playhead на текущей позиции */}
                                <div ref={dotRef} className={styles.timelineDot} aria-hidden='true' />
                            </div>
                        ) : null}

                        {show('time') ? (
                            <Text variant={['dop', null, null]} color='var(--white-100)' whiteSpace={['nowrap', null, null]}>
                                {formatClock(currentSec)} / {formatClock(Math.floor(state.duration))}
                            </Text>
                        ) : null}

                        {show('volume') ? (
                            <div ref={volumeRef} className={styles.volume}>
                                <div className={styles.volumePopover}>
                                    <div className={styles.volumeTrack} {...volume.bind}>
                                        <div ref={volumeFillRef} className={styles.volumeFill} />
                                    </div>
                                </div>

                                <button type='button' className={styles.button} aria-label={isMuted ? 'Включить звук' : 'Выключить звук'} onClick={() => player.toggleMute()}>
                                    <IconSwap active={isMuted} a={ICON.volume} b={ICON.volumeMuted} />
                                </button>
                            </div>
                        ) : null}

                        {show('fullscreen') ? (
                            <button type='button' className={styles.button} aria-label={state.fullscreen ? 'Выйти из полного экрана' : 'Полный экран'} onClick={() => player.toggleFullscreen()}>
                                <IconSwap active={state.fullscreen} a={ICON.fullscreen} b={ICON.fullscreenQuit} />
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
