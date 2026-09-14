'use client';

import { useEffect, useRef } from 'react';

import type { VideoPlayerController } from './types';

interface UseSyncedPlayersOptions {
    // Плеер — опорные часы для дрифт-коррекции. Обычно тот, где звук (камера). По умолчанию players[0].
    master?: VideoPlayerController;
    // Порог рассинхрона (сек), при котором ведомого жёстко подтягиваем к опорным часам.
    driftToleranceSec?: number;
}

const DEFAULT_DRIFT_TOLERANCE_SEC = 0.3;

// Двусторонняя синхронизация группы плееров: команда (play/pause/seek/скорость) с ЛЮБОГО плеера
// протягивается на остальные, плюс дрифт-коррекция по опорным часам (master). Управление источником
// (список плееров + master) читаем через ref — не переподписываемся на каждый рендер; identity
// контроллеров стабильна (useVideoPlayer). Петли гасим: play/pause — сверкой с групповым состоянием,
// seek — флагом «мы сейчас применяем синхро-seek».
export function useSyncedPlayers(players: VideoPlayerController[], options: UseSyncedPlayersOptions = {}): void {
    const { master = players[0], driftToleranceSec = DEFAULT_DRIFT_TOLERANCE_SEC } = options;

    const playersRef = useRef<VideoPlayerController[]>(players);
    playersRef.current = players;

    const masterRef = useRef<VideoPlayerController>(master);
    masterRef.current = master;

    // Групповое play/pause: если оно у плеера разошлось с групповым — значит пользователь его переключил,
    // тянем остальных. Эхо (плеер пришёл к уже групповому значению) игнорируем.
    const groupPlayingRef = useRef<boolean | null>(null);
    // Флаг «идёт применение синхро-seek» — чтобы протянутые seek не рассылались повторно (нет петли).
    const applyingSeekRef = useRef(false);

    // Зеркалим play/pause и скорость с любого плеера на остальные.
    useEffect(() => {
        const unsubscribes = playersRef.current.map((player) =>
            player.subscribe(() => {
                const { playing, rate } = player.getSnapshot();

                if (groupPlayingRef.current === null) {
                    groupPlayingRef.current = playing;
                }

                if (playing !== groupPlayingRef.current) {
                    groupPlayingRef.current = playing;

                    playersRef.current.forEach((other) => {
                        if (other === player) return;

                        if (playing) {
                            other.play();
                        } else {
                            other.pause();
                        }
                    });
                }

                playersRef.current.forEach((other) => {
                    if (other !== player && other.rate !== rate) {
                        other.setRate(rate);
                    }
                });
            })
        );

        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    }, [master]);

    // Явная перемотка любого плеера → протягиваем на остальные (кроме случаев, когда это уже синхро-seek).
    useEffect(() => {
        const unsubscribes = playersRef.current.map((player) =>
            player.subscribeSeek((time) => {
                if (applyingSeekRef.current) return;

                const previous = applyingSeekRef.current;
                applyingSeekRef.current = true;

                playersRef.current.forEach((other) => {
                    if (other !== player && Math.abs(other.getTime() - time) > 0.02) {
                        other.seek(time);
                    }
                });

                applyingSeekRef.current = previous;
            })
        );

        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    }, [master]);

    // Дрифт-коррекция: на тик опорных часов подтягиваем разошедшихся ведомых (seek помечаем синхро-флагом,
    // чтобы он не разослался обратно).
    useEffect(() => {
        return masterRef.current.subscribeTime((masterTime) => {
            const previous = applyingSeekRef.current;
            applyingSeekRef.current = true;

            playersRef.current.forEach((player) => {
                if (player !== masterRef.current && Math.abs(player.getTime() - masterTime) > driftToleranceSec) {
                    player.seek(masterTime);
                }
            });

            applyingSeekRef.current = previous;
        });
    }, [master, driftToleranceSec]);
}
