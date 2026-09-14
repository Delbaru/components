import type { GrowProps, RadiusInput, ResponsiveValue, SizeInput } from '../core';
import type { CSSProperties } from 'react';

// Источник медиа — как в примитиве Video: строка-URL либо объект с полем src (совместимо структурно).
export type MediaSource = string | { src: string };

export type VideoPlayerObjectFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale_down';

// Какие контролы показывать в баре. Управляет только видимостью, не расположением (порядок фиксирован макетом).
export type VideoPlayerControlKey = 'play' | 'timeline' | 'time' | 'volume' | 'fullscreen';

// Дискретное состояние плеера — реактивная часть (ре-рендеры редкие). Тикающее currentTime сюда НЕ входит.
export interface VideoPlayerSnapshot {
    playing: boolean;
    volume: number;
    muted: boolean;
    duration: number;
    rate: number;
    fullscreen: boolean;
    ready: boolean;
}

// Императивный API — «команды» плеера. Дёргаются откуда угодно (аналог CarouselApi).
export interface VideoPlayerApi {
    play(): void;
    pause(): void;
    toggle(): void;
    seek(seconds: number): void;
    // Скраб-перемотка: как seek, но с гейтингом по событию 'seeked' (следующая цель пускается только
    // когда предыдущая перемотка завершилась) + fastSeek, где есть. Для плавной покадровой перемотки при
    // драге каретки — не «долбит» currentTime быстрее, чем декодер успевает (иначе кадр замирает).
    scrubTo(seconds: number): void;
    seekBy(deltaSeconds: number): void;
    setVolume(value: number): void;
    mute(): void;
    unmute(): void;
    toggleMute(): void;
    setRate(rate: number): void;
    enterFullscreen(): void;
    exitFullscreen(): void;
    toggleFullscreen(): void;
}

// Контроллер = команды + читаемое состояние (геттеры) + подписки + внутренняя привязка к <video>.
// Создаётся хук'ом useVideoPlayer и передаётся в <VideoPlayer controller={...} />.
export interface VideoPlayerController extends VideoPlayerApi {
    // Реактивное дискретное состояние (геттеры поверх текущего snapshot).
    readonly playing: boolean;
    readonly volume: number;
    readonly muted: boolean;
    readonly duration: number;
    readonly rate: number;
    readonly fullscreen: boolean;
    readonly ready: boolean;

    // Быстрое время (не реактивно — чтение по запросу, без ре-рендера).
    readonly time: number;
    getTime(): number;

    // Подписки: discrete-состояние (для useSyncExternalStore), тикающее время (для скина) и явные
    // перемотки (для слоя синхронизации — чтобы отличить пользовательский seek от обычного тика).
    subscribe(listener: () => void): () => void;
    getSnapshot(): VideoPlayerSnapshot;
    subscribeTime(listener: (time: number) => void): () => void;
    subscribeSeek(listener: (time: number) => void): () => void;

    // Внутренняя проводка — вызывается скином VideoPlayer, вручную не трогаем.
    _attach(video: HTMLVideoElement, root: HTMLElement | null): void;
    _detach(): void;
}

export interface UseVideoPlayerOptions {
    initialVolume?: number;
    initialMuted?: boolean;
    initialRate?: number;
    autoPlay?: boolean;
}

// Escape-hatch для императивного доступа без хука (консистентно с CarouselApiRef).
export type VideoPlayerApiRef = { current: VideoPlayerApi | null } | ((api: VideoPlayerApi | null) => void);

export interface VideoPlayerProps extends SizeInput, RadiusInput, GrowProps {
    // Контроллер из useVideoPlayer(). Не передан — компонент создаёт внутренний (работает «из коробки»).
    controller?: VideoPlayerController;
    apiRef?: VideoPlayerApiRef;

    src?: MediaSource;
    poster?: MediaSource;

    // Лейбл источника (верх-слева): текст + иконка.
    label?: string;
    labelIcon?: string;

    objectFit?: ResponsiveValue<VideoPlayerObjectFit>;
    aspectRatio?: ResponsiveValue<string>;

    // Набор видимых контролов. По умолчанию — все.
    controls?: VideoPlayerControlKey[];
    autoPlay?: boolean;

    // false — «ведомый» режим: без бара управления и кликов по видео (только медиа + лейбл). Такой
    // плеер управляется снаружи через свой контроллер (например слоем синхронизации). По умолчанию true.
    interactive?: boolean;

    className?: string;
    style?: CSSProperties;
}
