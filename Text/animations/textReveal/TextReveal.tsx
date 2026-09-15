'use client';

import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';

import { cx } from '../../../core';
import { flattenAnimatableText } from '../flattenText';
import { useTextSwap, prefersReducedMotion, commonAffixes } from './useTextSwap';
import type { TextAnimationContext } from '../types';
import type { TextRevealOptions } from './types';

const DEFAULT_DURATION = 0.3;
const DEFAULT_STAGGER = 0.014;
const DEFAULT_SHIFT = 0.3;
const DEFAULT_MAX_WAVE = 0.5; // потолок суммарной длительности волны (сек), чтобы длинный текст не тянулся
// База задержки входящего слоя = доля от dur: на одной позиции старый/новый символ имеют ~равный --t, поэтому
// маленького сдвига хватает, чтобы новый проявлялся ПОСЛЕ ухода старого (без наложения), не удлиняя переход.
const IN_DELAY_FACTOR = 0.25;
// При схлопывании откладываем старт ресайза высоты (доля волны), чтобы уходящий текст успел погаснуть и его не
// срезало снизу (в нормальной волне сверху-слева нижние строки гаснут последними).
const COLLAPSE_SIZE_DELAY_FACTOR = 0.5;

// Разрывный пробел = любой whitespace, КРОМЕ nbsp ( ). По нему рвём строку на токены (между словами
// перенос допустим). nbsp — неразрывный: остаётся ВНУТРИ слова и склеивает соседей в один nowrap-сегмент,
// поэтому "к следующему" не переносится (в классе символов стоит именно nbsp, не обычный пробел).
const NBSP = String.fromCharCode(0xa0); // U+00A0, строим регэксп в рантайме — без литерала nbsp в исходнике
const SPLIT_WS = new RegExp('([^\\S' + NBSP + ']+)');
const IS_WS = new RegExp('^[^\\S' + NBSP + ']+$');

type LayerMode = 'in' | 'out' | 'idle';

// Бьём строку на слова и разрывные пробелы (через capture-split). Слово (в т.ч. склеенное nbsp) не переносится
// по буквам (inline-block + nowrap), разрывный пробел — отдельный токен, чтобы перенос был допустим между словами.
function toTokens(text: string): string[] {
  return text.split(SPLIT_WS).filter((part) => part.length > 0);
}

// Единый волновой фронт по диагонали: задержку буквы задаём как нормализованное расстояние от ВЕРХНЕГО-ЛЕВОГО
// угла (0 — стартует первой) к НИЖНЕМУ-ПРАВОМУ (1 — последней). Меряем offset-координаты ПОСЛЕ раскладки
// (перенос уже случился), поэтому знаем реальные позиции букв. Один метод для всех: на одной строке y постоянна
// → диагональ вырождается в обычное слева-направо. Задержку в секундах даёт CSS-var --reveal-span (капнут).
function applyWaveOrder(layer: Element) {
  const chars = layer.querySelectorAll<HTMLElement>('[data-reveal-char]');
  if (chars.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const items: { el: HTMLElement; x: number; y: number }[] = [];

  chars.forEach((el) => {
    const x = el.offsetLeft;
    const y = el.offsetTop;
    items.push({ el, x, y });
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const range = maxX - minX + (maxY - minY) || 1;
  items.forEach(({ el, x, y }) => {
    const t = (x - minX + (y - minY)) / range;
    el.style.setProperty('--t', `${t}`);
  });
}

interface LayerProps {
  text: string;
  mode: LayerMode;
  /** Сколько ведущих/замыкающих символов — общие с соседним слоем (рендерим статично, без анимации). */
  staticPrefix: number;
  staticSuffix: number;
}

function Layer({ text, mode, staticPrefix, staticSuffix }: LayerProps) {
  // Токены + глобальный старт-индекс каждого (символ считаем и в пробелах) — чтобы сопоставить с prefix/suffix.
  const { tokens, starts, total } = useMemo(() => {
    const tks = toTokens(text);
    let acc = 0;
    const st = tks.map((t) => {
      const s = acc;
      acc += Array.from(t).length;
      return s;
    });
    return { tokens: tks, starts: st, total: acc };
  }, [text]);

  return (
    <span
      data-reveal-layer=""
      data-reveal-mode={mode}
      className={cx('ui-reveal-layer', mode === 'in' && 'ui-reveal-in', mode === 'out' && 'ui-reveal-out')}
      aria-hidden={mode === 'out' ? true : undefined}
    >
      {tokens.map((token, tokenIdx) => {
        if (IS_WS.test(token)) {
          return (
            <span key={`s-${tokenIdx}`} className={'ui-reveal-space'}>
              {token}
            </span>
          );
        }

        const start = starts[tokenIdx] ?? 0;
        return (
          <span key={`w-${tokenIdx}`} className={'ui-reveal-word'}>
            {Array.from(token).map((ch, i) => {
              const gi = start + i;
              // Статичный символ (общий край) не несёт data-reveal-char → не анимируется и не участвует в волне.
              const isStatic = gi < staticPrefix || gi >= total - staticSuffix;
              return (
                <span key={i} {...(isStatic ? null : { 'data-reveal-char': '' })} className={'ui-reveal-char'}>
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Плавная смена текста по-буквенно: при изменении контента старые буквы уезжают вверх с затуханием, новые
 * приходят снизу — со stagger-волной. Стейт свопа держит useTextSwap. Задержки букв раскладываются по
 * диагонали верх-лево → низ-право (на одной строке = слева-направо) и капаются по длине (--reveal-span).
 *
 * Размеры: в ПОКОЕ вьюпорт всегда `width/height: auto` — grid-стек сам сайзится по входящему слою (уходящий
 * абсолютен и в расчёт не идёт), перенос наследуется от host-Text. Это делает вёрстку нативной и устойчивой
 * к ресайзу/смене брейкпоинта/догрузке шрифта — без ResizeObserver и замеров-зеркал. Чтобы контейнер при
 * смене текста НЕ щёлкал, на время свопа делаем transient-FLIP: пиним старый размер → транзишеним к новому
 * (в такт волне) → по завершении РЕЛИЗИМ обратно в auto. Пин живёт только 0.37s, поэтому вне свопа (и при
 * любом ресайзе) размер честно нативный. Первый рендер и reduced-motion — без анимации размера.
 */
export function TextReveal({ content, options }: TextAnimationContext<TextRevealOptions>) {
  const text = flattenAnimatableText(content) ?? '';
  const duration = options?.duration ?? DEFAULT_DURATION;
  const stagger = options?.stagger ?? DEFAULT_STAGGER;
  const shift = options?.shift ?? DEFAULT_SHIFT;
  const maxDuration = options?.maxDuration ?? DEFAULT_MAX_WAVE;

  // Капнутый разброс задержек: базовый разброс = stagger·(N−1), но не длиннее (maxDuration − duration).
  // Эффективный stagger отдаём в useTextSwap, чтобы его таймер снятия ушедшего слоя совпал с реальной волной.
  const capSpan = (chars: number) => Math.min(Math.max(0, chars - 1) * stagger, Math.max(0, maxDuration - duration));
  const effStagger = text.length > 1 ? capSpan(text.length) / (text.length - 1) : stagger;

  const { current, previous, generation } = useTextSwap(text, {
    durationMs: duration * 1000,
    staggerMs: effStagger * 1000,
  });

  const viewportRef = useRef<HTMLSpanElement | null>(null);
  // Последний натуральный размер вьюпорта (для старта FLIP при следующем свопе). Обновляется на каждом коммите.
  const lastSizeRef = useRef<{ w: number; h: number } | null>(null);

  // Размеры гоним столько же, сколько живёт волна (dur + капнутый разброс по самой длинной строке), иначе
  // контейнер садится раньше, чем догорают буквы, и уходящий текст торчит за краем.
  const span = capSpan(Math.max(current.length, previous?.length ?? 0));

  // Смена текста → раскладываем задержки букв по диагонали (оба слоя) и, если это реальный своп, плавно
  // ведём размер контейнера от старого к новому (transient-FLIP c релизом в auto — см. док компонента).
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;

    // Снимаем возможный остаточный пин от прошлого свопа и меряем два натуральных размера БЕЗ анимации:
    //   natural — как текст ляжет по родителю (наследуя white-space: перенос → высота растёт);
    //   line    — принудительно в одну строку (nowrap).
    // Многострочный, только если натуральная высота заметно выше однострочной (текст реально переносится).
    //
    // Меряем getComputedStyle, а НЕ getBoundingClientRect: замеренное мы пишем обратно как вёрсточные
    // пиксели (vp.style.width/height), а rect отдаёт бокс ПОСЛЕ трансформов предков. Под живым
    // 3D-трансформом (perspective3d с follow:'viewport' пересчитывается на каждое движение мыши) это
    // разные системы координат: from/to снимались бы при разной проекции → FLIP срабатывал бы на
    // неизменившейся вёрстке (дёрганье по высоте), а сохранённый nowrap-замер однострочного текста
    // пиньтся на следующем свопе и раскладывает многострочный текст в одну строку.
    // Computed-значения — вёрсточные: трансформ на них не влияет, поэтому БЕЗ трансформа у предка
    // результат побайтово тот же, что у rect (у .viewport нет padding/border → content box = border box),
    // и дробность сохраняется — offsetWidth не подходит, он округляет до целого и давал рывок на релизе.
    // Соседний applyWaveOrder тоже меряет вёрстку (offsetLeft/offsetTop) — теперь весь файл в одной системе.
    // `|| 0` — у скрытого узла (display:none) computed width = 'auto' → NaN; нули повторяют то, что в
    // этом случае отдавал rect, поэтому FLIP просто не запускается, как и раньше.
    const rect = () => {
      const cs = getComputedStyle(vp);
      return { w: parseFloat(cs.width) || 0, h: parseFloat(cs.height) || 0 };
    };
    vp.style.transition = 'none';
    vp.style.width = '';
    vp.style.height = '';
    vp.style.whiteSpace = '';

    // Свопа нет (первый рендер / уборка ушедшего слоя): анимации в дереве не осталось, `--t` не
    // читает никто, а замеры упираются в ранний возврат ниже. Оставляем один — он нужен как `from`
    // следующему свопу (Frontend.md §12 «Скролл главной»).
    if (previous === null) {
        lastSizeRef.current = rect();
        vp.style.transition = '';
        return undefined;
    }

    const natural = rect();
    vp.style.whiteSpace = 'nowrap';
    const line = rect();
    vp.style.whiteSpace = '';
    // Многострочный, если переносится ТЕКУЩИЙ текст ИЛИ переносился предыдущий (from выше одной строки). Второе
    // важно для схлопывания многострочный→короткий: цель однострочная, но пин-nowrap развернул бы уходящий
    // многострочный слой в одну строку (и обрезал по ширине). При многострочном ширину не трогаем (width: auto).
    const wasMultiline = lastSizeRef.current !== null && lastSizeRef.current.h > line.h * 1.5;
    const multiline = natural.h > line.h * 1.5 || wasMultiline;

    // Однострочный лейбл: цель — ширина одной строки, height ≈ 1 строка. Многострочный: ширину не трогаем
    // (течёт по родителю, width: auto), плавно ведём только высоту (смена числа строк).
    const to = multiline ? natural : line;
    const from = lastSizeRef.current;
    lastSizeRef.current = to;

    const collapsing = from !== null && to.h < from.h - 2;
    const sizeDelay = collapsing ? span * COLLAPSE_SIZE_DELAY_FACTOR : 0;
    // Старт ресайза откладываем только при схлопывании (чтобы уходящий текст успел погаснуть и его не срезало
    // снизу); при росте — сразу (delay=0). Ставим до глайда, т.к. delay читается из CSS-переменной транзишеном.
    vp.style.setProperty('--reveal-size-delay', `${sizeDelay}s`);

    // Уходящий МНОГОСТРОЧНЫЙ слой фиксируем на его старую ширину (from.w) с собственным переносом. Он абсолютен
    // и в покое ширину контейнера не задаёт (её ведёт входящий слой), поэтому при схлопывании контейнер
    // мгновенно сужается, а уходящий длинный текст рефлоу-ится в узкое (много коротких строк) — тот самый
    // «резкий сдвиг влево поверх нового текста». Пин ширины держит его прежнюю раскладку, пока он затухает
    // (слой всё равно размонтируется после свопа). Ставим ДО applyWaveOrder — чтобы диагональ волны считалась
    // по реальным позициям букв старой раскладки, а не по схлопнутой.
    if (from !== null && multiline) {
      const outLayer = vp.querySelector<HTMLElement>('[data-reveal-mode="out"]');
      if (outLayer) {
        outLayer.style.width = `${from.w}px`;
        outLayer.style.whiteSpace = 'normal';
      }
    }

    // Раскладываем задержки букв по диагонали НА НАТУРАЛЬНОЙ раскладке (пины сняты выше). Волна ВСЕГДА
    // сверху-слева → низ-право (для обоих слоёв): уходящий текст исчезает в порядке чтения. Наложение старого
    // и нового снято смещением прозрачности (in-delay + форма keyframes), а не обратной волной; срез снизу при
    // схлопывании гасится отложенным стартом ресайза (--reveal-size-delay).
    vp.querySelectorAll<HTMLElement>('[data-reveal-layer]').forEach((layer) => {
      applyWaveOrder(layer);
    });

    vp.style.transition = '';

    // Первый своп в жизни узла (мерить `from` было не с чего) / reduced-motion → оставляем нативный
    // auto, без анимации размера.
    if (from === null || prefersReducedMotion()) return undefined;

    // Ширину пиним и глайдим: однострочному — всегда (с nowrap на миг, чтобы длинный текст не переносился на
    // промежуточной ширине); многострочному — ТОЛЬКО при схлопывании (collapse), чтобы контейнер плавно
    // сужался вместе с зафиксированным уходящим слоем, а не прыгал в узкое рывком. Многострочный РОСТ ширину
    // не трогает — входящий слой сам течёт и переносится по родителю.
    const animW = Math.abs(from.w - to.w) > 0.5 && (!multiline || collapsing);
    const animH = Math.abs(from.h - to.h) > 0.5;
    const useNowrap = animW && !multiline; // nowrap только для однострочного глайда
    if (!animW && !animH) return undefined;

    // FLIP: старт со старого размера (без транзишена) → следующий кадр к новому (транзишен из таблицы стилей).
    vp.style.transition = 'none';
    if (useNowrap) vp.style.whiteSpace = 'nowrap';
    if (animW) vp.style.width = `${from.w}px`;
    if (animH) vp.style.height = `${from.h}px`;
    void vp.offsetWidth;
    vp.style.transition = '';
    if (animW) vp.style.width = `${to.w}px`;
    if (animH) vp.style.height = `${to.h}px`;

    // По завершении волны (с учётом отложенного ресайза и сдвига входящего слоя) РЕЛИЗИМ размер и перенос в
    // auto/inherit — в покое вёрстка снова нативная. size-delay ставим на элемент ЗДЕСЬ (до глайда, где знаем
    // collapsing): при схлопывании откладываем старт ресайза, чтобы уходящий текст успел погаснуть.
    const releaseMs = (Math.max(sizeDelay, duration * IN_DELAY_FACTOR) + duration + span) * 1000 + 80;
    const timer = window.setTimeout(() => {
      vp.style.transition = 'none';
      vp.style.width = '';
      vp.style.height = '';
      vp.style.whiteSpace = '';
      void vp.offsetWidth;
      vp.style.transition = '';
    }, releaseMs);

    return () => window.clearTimeout(timer);
  }, [current, previous, duration, span]);

  const vars = {
    '--reveal-dur': `${duration}s`,
    '--reveal-span': `${span}s`,
    '--reveal-shift': `${shift}em`,
    '--reveal-width-dur': `${duration + span}s`,
    // Сдвиг входящей волны (снятие наложения). Размерный delay (--reveal-size-delay) ставит эффект — он зависит
    // от collapsing, который известен только после замера.
    '--reveal-in-delay': `${duration * IN_DELAY_FACTOR}s`,
  } as CSSProperties;

  // Общие края previous/current не анимируем — иначе неизменная часть текста перерисовывается заново (задвоение).
  const affixes = previous !== null ? commonAffixes(previous, current) : { prefix: 0, suffix: 0 };

  return (
    <span ref={viewportRef} className={'ui-reveal'} style={vars}>
      {previous !== null && (
        <Layer key={`out-${generation}`} text={previous} mode="out" staticPrefix={affixes.prefix} staticSuffix={affixes.suffix} />
      )}

      <Layer
        key={`in-${generation}`}
        text={current}
        mode={previous === null ? 'idle' : 'in'}
        staticPrefix={affixes.prefix}
        staticSuffix={affixes.suffix}
      />
    </span>
  );
}
