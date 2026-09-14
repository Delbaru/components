'use client';

import { useRef, useSyncExternalStore } from 'react';

import { clamp } from '../core/utils';

import type {
    UseVideoPlayerOptions,
    VideoPlayerController,
    VideoPlayerSnapshot,
} from './types';

// Мелкое сравнение snapshot — чтобы getSnapshot возвращал стабильную ссылку, пока состояние не менялось
// (требование useSyncExternalStore: без этого — бесконечный ре-рендер).
function isSameSnapshot(a: VideoPlayerSnapshot, b: VideoPlayerSnapshot): boolean {
    return (
        a.playing === b.playing
        && a.volume === b.volume
        && a.muted === b.muted
        && a.duration === b.duration
        && a.rate === b.rate
        && a.fullscreen === b.fullscreen
        && a.ready === b.ready
    );
}

// Фабрика «мозга» одного плеера. Framework-agnostic (замыкания, без React) — тестируется отдельно и
// переиспользуется будущим слоем синхронизации нескольких плееров.
export function createVideoPlayerController(options: UseVideoPlayerOptions = {}): VideoPlayerController {
    let video: HTMLVideoElement | null = null;
    let root: HTMLElement | null = null;
    let rafId = 0;

    let snapshot: VideoPlayerSnapshot = {
        playing: false,
        volume: options.initialVolume ?? 1,
        muted: options.initialMuted ?? false,
        duration: 0,
        rate: options.initialRate ?? 1,
        fullscreen: false,
        ready: false,
    };

    const listeners = new Set<() => void>();
    const timeListeners = new Set<(time: number) => void>();
    const seekListeners = new Set<(time: number) => void>();

    // Скраб-перемотка (драг каретки): гейтим по 'seeked' — следующую цель пускаем только когда предыдущая
    // перемотка завершилась, иначе браузер коалесит быстрые currentTime и кадр обновляется только на паузе.
    let scrubTarget: number | null = null;
    let scrubbing = false;

    function emit(): void {
        listeners.forEach((listener) => listener());
    }

    function setSnapshot(patch: Partial<VideoPlayerSnapshot>): void {
        const next = { ...snapshot, ...patch };

        if (isSameSnapshot(next, snapshot)) return;

        snapshot = next;
        emit();
    }

    // Разово протолкнуть текущее время слушателям (после seek/pause/loadedmetadata — когда rAF не крутится).
    function pushTime(): void {
        const time = video?.currentTime ?? 0;
        timeListeners.forEach((listener) => listener(time));
    }

    function tick(): void {
        if (!video) return;

        const time = video.currentTime;
        timeListeners.forEach((listener) => listener(time));
        rafId = requestAnimationFrame(tick);
    }

    function startTicking(): void {
        if (rafId || typeof requestAnimationFrame === 'undefined') return;

        rafId = requestAnimationFrame(tick);
    }

    function stopTicking(): void {
        if (!rafId) return;

        cancelAnimationFrame(rafId);
        rafId = 0;
    }

    function isFullscreen(): boolean {
        return typeof document !== 'undefined' && document.fullscreenElement != null;
    }

    //
    // Обработчики нативных событий <video> — единственный источник истины для дискретного состояния
    // (иконка/громкость идут за реальным событием, а не за оптимистичным флагом).
    //

    const handlePlay = (): void => {
        setSnapshot({ playing: true });
        startTicking();
    };

    const handlePause = (): void => {
        setSnapshot({ playing: false });
        stopTicking();
        pushTime();
    };

    const handleEnded = (): void => {
        setSnapshot({ playing: false });
        stopTicking();
    };

    const handleVolumeChange = (): void => {
        if (!video) return;

        setSnapshot({ volume: video.volume, muted: video.muted });
    };

    const handleDurationChange = (): void => {
        if (!video) return;

        setSnapshot({ duration: Number.isFinite(video.duration) ? video.duration : 0 });
    };

    const handleLoadedMetadata = (): void => {
        if (!video) return;

        setSnapshot({ duration: Number.isFinite(video.duration) ? video.duration : 0, ready: true });
        pushTime();
    };

    const handleSeeked = (): void => {
        pushTime();

        // Скраб: перемотка завершилась — пускаем следующую накопленную цель (если есть).
        if (scrubbing) {
            if (scrubTarget != null) {
                pumpScrub();
            } else {
                scrubbing = false;
            }
        }
    };

    const handleFullscreenChange = (): void => {
        setSnapshot({ fullscreen: isFullscreen() });
    };

    //
    // Команды
    //

    function play(): void {
        video?.play().catch(() => null);
    }

    function pause(): void {
        video?.pause();
    }

    function toggle(): void {
        if (!video) return;

        if (video.paused) {
            play();
        } else {
            pause();
        }
    }

    function seek(seconds: number): void {
        if (!video) return;

        // Явный (точный) seek отменяет незавершённый скраб.
        scrubTarget = null;
        scrubbing = false;

        const max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : seconds;
        const applied = clamp(seconds, 0, max);
        video.currentTime = applied;
        pushTime();

        // Явная перемотка (пользовательский скраб / ±сек) — сигнал для слоя синхронизации.
        seekListeners.forEach((listener) => listener(applied));
    }

    // Скраб-перемотка: копим последнюю цель и, если сейчас не идёт перемотка, пускаем её. Иначе следующую
    // пустит handleSeeked по завершении текущей — так частота кадров ограничена декодером, а не рендер-кадром.
    function scrubTo(seconds: number): void {
        if (!video) return;

        const max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : seconds;
        scrubTarget = clamp(seconds, 0, max);

        if (!scrubbing) {
            pumpScrub();
        }
    }

    function pumpScrub(): void {
        if (!video || scrubTarget == null) {
            scrubbing = false;

            return;
        }

        const target = scrubTarget;
        scrubTarget = null;

        // Цель совпала с текущим временем — seek не выстрелит 'seeked' и гейт «залипнет»: выходим,
        // следующий scrubTo пустит новую перемотку.
        if (Math.abs(target - video.currentTime) < 0.001) {
            scrubbing = false;

            return;
        }

        scrubbing = true;

        // fastSeek (FF/Safari) перематывает к ближайшему ключевому кадру — заметно быстрее, кадры при драге
        // сменяются чаще. Где нет (Chrome) — обычный currentTime, но всё равно с гейтингом по 'seeked'.
        if (typeof video.fastSeek === 'function') {
            video.fastSeek(target);
        } else {
            video.currentTime = target;
        }

        // Протягиваем на синхронные плееры (экран следует за камерой).
        seekListeners.forEach((listener) => listener(target));
    }

    function seekBy(deltaSeconds: number): void {
        if (!video) return;

        seek(video.currentTime + deltaSeconds);
    }

    function setVolume(value: number): void {
        if (!video) return;

        const next = clamp(value, 0, 1);
        video.volume = next;

        // Любое движение слайдера снимает mute (иначе ползаешь громкость, а звука нет).
        if (next > 0 && video.muted) {
            video.muted = false;
        }
    }

    function mute(): void {
        if (video) video.muted = true;
    }

    function unmute(): void {
        if (video) video.muted = false;
    }

    function toggleMute(): void {
        if (video) video.muted = !video.muted;
    }

    function setRate(rate: number): void {
        if (!video) return;

        video.playbackRate = rate;
        setSnapshot({ rate });
    }

    function enterFullscreen(): void {
        root?.requestFullscreen?.().catch(() => null);
    }

    function exitFullscreen(): void {
        if (isFullscreen()) {
            document.exitFullscreen?.().catch(() => null);
        }
    }

    function toggleFullscreen(): void {
        if (isFullscreen()) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    }

    function getTime(): number {
        return video?.currentTime ?? 0;
    }

    //
    // Проводка со скином
    //

    function _attach(nextVideo: HTMLVideoElement, nextRoot: HTMLElement | null): void {
        video = nextVideo;
        root = nextRoot;

        // Применяем стартовые значения на реальный элемент.
        video.volume = clamp(snapshot.volume, 0, 1);
        video.muted = snapshot.muted;
        video.playbackRate = snapshot.rate;

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('seeked', handleSeeked);

        if (typeof document !== 'undefined') {
            document.addEventListener('fullscreenchange', handleFullscreenChange);
        }

        setSnapshot({
            duration: Number.isFinite(video.duration) ? video.duration : 0,
            ready: video.readyState >= 1,
            playing: !video.paused && !video.ended,
        });

        if (options.autoPlay) {
            play();
        }

        pushTime();
    }

    function _detach(): void {
        stopTicking();

        if (video) {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('seeked', handleSeeked);
        }

        if (typeof document !== 'undefined') {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        }

        video = null;
        root = null;
    }

    const controller: VideoPlayerController = {
        play,
        pause,
        toggle,
        seek,
        scrubTo,
        seekBy,
        setVolume,
        mute,
        unmute,
        toggleMute,
        setRate,
        enterFullscreen,
        exitFullscreen,
        toggleFullscreen,

        getTime,
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        subscribeTime: (listener) => {
            timeListeners.add(listener);
            listener(getTime());
            return () => timeListeners.delete(listener);
        },
        subscribeSeek: (listener) => {
            seekListeners.add(listener);
            return () => seekListeners.delete(listener);
        },

        _attach,
        _detach,

        get playing() {
            return snapshot.playing;
        },
        get volume() {
            return snapshot.volume;
        },
        get muted() {
            return snapshot.muted;
        },
        get duration() {
            return snapshot.duration;
        },
        get rate() {
            return snapshot.rate;
        },
        get fullscreen() {
            return snapshot.fullscreen;
        },
        get ready() {
            return snapshot.ready;
        },
        get time() {
            return getTime();
        },
    };

    return controller;
}

// Хук-обёртка: создаёт контроллер один раз и подписывает держателя на дискретные изменения
// (чтобы camera.playing/volume/… читались свежими в разметке).
export function useVideoPlayer(options?: UseVideoPlayerOptions): VideoPlayerController {
    const controllerRef = useRef<VideoPlayerController | null>(null);

    if (controllerRef.current === null) {
        controllerRef.current = createVideoPlayerController(options);
    }

    const controller = controllerRef.current;

    useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

    return controller;
}
