'use client';

import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface UsePointerRatioOptions {
    // 'x' — слева-направо (таймлайн); 'y' — снизу-вверх (вертикальная громкость).
    orientation?: 'x' | 'y';
    onChange: (ratio: number) => void;
    onStart?: () => void;
    onEnd?: () => void;
    // Наведение (любое движение над треком, независимо от драга) — для превью таймлайна.
    onHover?: (ratio: number) => void;
    onLeave?: () => void;
}

function clampRatio(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

// Драг по треку → доля 0..1. Общий механизм для таймлайна и слайдера громкости. isDragging отдаём
// наружу, чтобы rAF-обновление таймлайна не перебивало позицию курсора во время перетаскивания.
export function usePointerRatio({ orientation = 'x', onChange, onStart, onEnd, onHover, onLeave }: UsePointerRatioOptions) {
    const isDragging = useRef(false);

    function computeRatio(event: ReactPointerEvent<HTMLElement>): number {
        const rect = event.currentTarget.getBoundingClientRect();

        if (orientation === 'y') {
            return clampRatio(1 - (event.clientY - rect.top) / rect.height);
        }

        return clampRatio((event.clientX - rect.left) / rect.width);
    }

    const bind = {
        onPointerDown(event: ReactPointerEvent<HTMLElement>) {
            isDragging.current = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            onStart?.();
            onChange(computeRatio(event));
        },
        onPointerMove(event: ReactPointerEvent<HTMLElement>) {
            const ratio = computeRatio(event);

            onHover?.(ratio);

            if (isDragging.current) {
                onChange(ratio);
            }
        },
        onPointerUp(event: ReactPointerEvent<HTMLElement>) {
            if (!isDragging.current) return;

            isDragging.current = false;

            try {
                event.currentTarget.releasePointerCapture?.(event.pointerId);
            } catch {
                // pointer уже отпущен — игнорируем.
            }

            onEnd?.();
        },
        onPointerCancel() {
            if (isDragging.current) {
                isDragging.current = false;
                onEnd?.();
            }

            onLeave?.();
        },
        onPointerLeave() {
            if (!isDragging.current) {
                onLeave?.();
            }
        },
    };

    return { isDragging, bind };
}
