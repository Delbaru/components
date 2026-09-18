'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import styles from './Toast.module.scss';

import { Flex } from '../Flex';
import { Icon } from '../Icon';
import { Text } from '../Text';

/** Тон — это ГЛИФ и цвет его кружка, больше ничего: карточка у тоста одна. */
export type ToastTone = 'success' | 'warning' | 'error';

export type ToastOptions = {
  title: string;
  /** Вторая строка — подробность («кому отправлено», «почему не подошёл»), а не пересказ. */
  description?: string;
  /** `success` — сделано (по умолчанию), `warning` — ход принят, но ничего не сделал, `error` — отказ. */
  tone?: ToastTone;
  /** Сколько висит до самоуборки. Меняют это редко, поэтому проп, а не ось. */
  durationMs?: number;
};

const TONE: Record<ToastTone, { glyph: string; fill: string }> = {
  success: { glyph: '/icons/ui/check/style-3/check.svg', fill: 'var(--green)' },
  // Жёлтый — ход принят, но ничего не сделал (действие ещё не подключено, недоступно на тарифе).
  // Зелёный чек на таком ходе врёт: человек читает его как выполненное.
  warning: { glyph: '/icons/ui/exclamation/style-1/exclamation.svg', fill: 'var(--yellow)' },
  // Красный тон — для отказа В ОТВЕТ НА ДЕЙСТВИЕ, у которого нет своего места для ошибки
  // (файл не прошёл проверку при загрузке). Ошибке ФОРМЫ место в поле, а не здесь.
  error: { glyph: '/icons/ui/cross/style-7/cross.svg', fill: 'var(--red)' },
};

/** Заливка кружка тоста — полным кортежем: проп респонсивный. */
const fillOf = (tone: ToastTone = 'success'): [string, string, string] => {
  const { fill } = TONE[tone];
  return [fill, fill, fill];
};

type ToastItem = ToastOptions & { id: string; open: boolean };

type ToastContextValue = { show: (options: ToastOptions) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

// Больше пяти тостов разом не читается, а частые клики иначе строят стопку до верха окна.
const MAX_VISIBLE = 5;

/**
 * Тост — короткий ответ на действие, у которого НЕТ своего экрана: «приглашение отправлено
 * повторно», «снимок не подошёл». Три тона (`success` по умолчанию, `warning` и `error`) — это
 * РОВНО глиф и цвет его кружка; ошибке ФОРМЫ здесь по-прежнему не место: её показывает поле, где
 * её и исправляют.
 *
 * Одновременно открыто не больше пяти: шестой уводит самый старый (верхний), не дожидаясь его
 * таймера.
 *
 * Провайдер поднимается в корневом layout рядом с `ModalProvider` и снаружи него: диалог тоже
 * вправе поднять тост, а портал модалки живёт внутри её провайдера.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const idRef = useRef(0);
  const baseId = useId();
  // Таймеры живут в ref, а не в состоянии: они не влияют на рендер, а размонтирование обязано
  // их погасить — иначе setState прилетит в снятое дерево.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Хост берём в эффекте: на сервере `document` нет (§12 «Порталы»).
  useEffect(() => {
    setHost(document.body);

    const pending = timers.current;

    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const hide = useCallback((id: string) => {
    timers.current.delete(id);
    // Сначала СВОРАЧИВАНИЕ, и только по его окончании — удаление из списка: снятый сразу тост
    // пропал бы кадром, а соседи прыгнули бы на его высоту (§12 «Удаление из списка»).
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, open: false } : item)));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = `${baseId}-${(idRef.current += 1)}`;

    setItems((prev) => {
      const next = [...prev, { ...options, id, open: true }];
      const open = next.filter((item) => item.open);
      const evicted = new Set(open.slice(0, Math.max(0, open.length - MAX_VISIBLE)).map((item) => item.id));

      return evicted.size > 0
        ? next.map((item) => (evicted.has(item.id) ? { ...item, open: false } : item))
        : next;
    });
    timers.current.set(id, setTimeout(() => hide(id), options.durationMs ?? DEFAULT_DURATION_MS));
  }, [baseId, hide]);

  const remove = useCallback((id: string) => {
    // Тост, уведённый лимитом, уходит раньше своего таймера — таймер гасится вместе с ним.
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const stack = items.length > 0 && host
    ? createPortal(
      <Flex
        dir={['column', null, null]}
        align={['center', null, null]}
        role='status'
        aria-live='polite'
        className={styles.Toast}
      >
        {items.map((item) => (
          // `collapseAppear` обязателен: узел монтируется УЖЕ раскрытым, и без опт-ина
          // enter-анимации не будет вовсе (§8.4).
          <Flex
            key={item.id}
            collapse={item.open}
            collapseAppear
            collapseGap={[12, null, null]}
            collapseFade
            dir={['column', null, null]}
            onCollapseEnd={item.open ? undefined : () => remove(item.id)}
          >
            <Flex align={['center', null, null]} gap={[12, null, null]} p={[[16, 20], null, null]} r={[16, null, null]} bg='var(--white-100)' className={styles.card}>
              <Icon
                src={TONE[item.tone ?? 'success'].glyph}
                w={[18, null, null]}
                h={[18, null, null]}
                rootW={[32, null, null]}
                rootH={[32, null, null]}
                rootMinW={[32, null, null]}
                rootR={[999, null, null]}
                rootBg={fillOf(item.tone)}
                stroke='var(--white-100)'
                aria-hidden
              />

              <Flex dir={['column', null, null]} gap={[4, null, null]}>
                <Text variant={['p', null, null]}>{item.title}</Text>

                {/* Подробность — вариант ВЫЗОВА (у одного тоста она либо есть, либо нет и
                    не появится), поэтому обычное условие, а не сворачивание. */}
                {item.description && (
                  <Text variant={['small', null, null]} color='var(--gray)'>{item.description}</Text>
                )}
              </Flex>
            </Flex>
          </Flex>
        ))}
      </Flex>,
      host
    )
    : null;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {stack}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);

  if (!value) throw new Error('useToast вызван вне ToastProvider — он поднимается в корневом layout');

  return value;
}
