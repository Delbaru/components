'use client';
'use no memo';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { cx } from '../../../core';
import { Flex } from '../../../Flex';
import { flattenAnimatableText } from '../flattenText';
import { useTextSwap, prefersReducedMotion, commonAffixes } from '../textReveal/useTextSwap';
import type { TextAnimationContext } from '../types';
import type { TextSlideOptions } from './types';

type SequenceOptions = TextSlideOptions & { steps: string[]; currentStep: number };

const isSequence = (options: TextSlideOptions | undefined): options is SequenceOptions =>
  Array.isArray(options?.steps) && typeof options?.currentStep === 'number';

/**
 * Последовательный слайд по шагам: сцена сдвигается по вертикали к нужному шагу, высота — по шагу.
 * Сцена — Flex (высота пропом); position/overflow/transition — в scss на токенах, длительность — CSS-var.
 */
function TextSlideSequence({ options }: { options: SequenceOptions }) {
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [cumHeights, setCumHeights] = useState<number[]>([]);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (itemRefs.current.length === 0) return;

    const hs = itemRefs.current.map((el) => el?.offsetHeight || 0);
    const cum = hs.reduce((acc, h) => {
      const prev = acc[acc.length - 1] || 0;
      return [...acc, prev + h];
    }, [] as number[]);

    setCumHeights(cum);
    setContainerHeight(hs[options.currentStep] || 0);
  }, [options.steps, options.currentStep]);

  const translateY = cumHeights[options.currentStep - 1] || 0;
  // Измеренная высота — значение рантайма: класса утилиты под него нет, поэтому стилем.
  const stageStyle = {
    height: `${containerHeight}px`,
    transform: `translateY(-${translateY}px)`,
    '--slide-dur': options.duration ? `${options.duration}s` : undefined,
  } as CSSProperties;

  return (
    <Flex className={'ui-slide'} style={stageStyle}>
      {options.steps.map((step, index) => (
        <span
          key={step.slice(0, 60)}
          ref={(el) => { itemRefs.current[index] = el; }}
          className={'ui-slide-item'}
          style={{ top: cumHeights[index - 1] || 0 }}
        >
          {step}
        </span>
      ))}
    </Flex>
  );
}

/** Hover-слайд: два слоя (база + альт) разъезжаются по вертикали при наведении/фокусе. Полностью на CSS. */
function TextSlideHover({ content, options }: TextAnimationContext<TextSlideOptions>) {
  const hoverStyle = {
    '--text-slide-duration': `${options?.duration ?? 0.35}s`,
    '--text-slide-hover-color': options?.hoverColor ?? 'var(--primary)',
  } as CSSProperties;

  return (
    <span className={'ui-slide-hover'} style={hoverStyle}>
      <span className={'ui-slide-hover-viewport'}>
        <span className={cx('ui-slide-hover-layer', 'ui-slide-hover-base')}>{content}</span>

        <span aria-hidden="true" className={cx('ui-slide-hover-layer', 'ui-slide-hover-alt')}>{content}</span>
      </span>
    </span>
  );
}

/**
 * Своп-слайд значения ПОСИМВОЛЬНО: при смене контента диффим старую/новую строку по позициям и анимируем
 * (слайд вверх старого + въезд снизу нового) ТОЛЬКО изменившиеся символы; неизменные остаются статичными.
 * Так в «00:07:52» уезжают лишь тикающие цифры, а не всё табло. Стейт держит useTextSwap (общий с textReveal),
 * анимацию рисует CSS. Первый рендер не анимируется; reduced-motion → мгновенная подмена.
 */
function TextSlideSwap({ content, options }: TextAnimationContext<TextSlideOptions>) {
  const text = flattenAnimatableText(content) ?? '';
  const duration = options?.duration ?? 0.4;

  const { current, previous, generation } = useTextSwap(text, { durationMs: duration * 1000, staggerMs: 0 });

  const viewportRef = useRef<HTMLSpanElement | null>(null);
  // Последняя натуральная высота вьюпорта (для FLIP высоты при переносе). Ширину ведут сами ячейки-одометры.
  const lastHeightRef = useRef<number | null>(null);

  // Ширину меняющегося значения ведём ОДОМЕТРОМ: каждая свопящаяся ячейка плавно едет от ширины старого
  // символа к ширине нового (пин old → глайд к new → релиз в auto). Старый символ (out) — абсолют, из раскладки
  // выключен, поэтому ширина ячейки в покое = новый символ: соседи не прыгают, и нет гонки/рывка на
  // размонтировании старого слоя. Высоту (смена числа строк при переносе «N из M») ведём на уровне вьюпорта.
  // Одинаковые по ширине значения (тикающий таймер на tabular-nums) глайд не триггерят. reduced-motion /
  // первый рендер — без анимации.
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;

    // Сброс пина высоты и замер натуральной высоты покоя (out абсолютен → на высоту/ширину раскладки не влияет).
    vp.style.transition = 'none';
    vp.style.height = '';
    const curH = vp.getBoundingClientRect().height;
    const fromH = lastHeightRef.current;
    lastHeightRef.current = curH;

    // Для каждой свопящейся ячейки берём ширину старого (out) и нового (in) символов напрямую по их bounding-box
    // (out абсолютен, но его собственная ширина = ширина контента). Это план глайда ширины ячейки.
    const plan = Array.from(vp.querySelectorAll<HTMLElement>('[data-swap-cell]')).map((cell) => {
      const outEl = cell.querySelector<HTMLElement>('[data-swap-out]');
      const inEl = cell.querySelector<HTMLElement>('[data-swap-in]');
      return {
        cell,
        outW: outEl ? outEl.getBoundingClientRect().width : 0,
        inW: inEl ? inEl.getBoundingClientRect().width : 0,
      };
    });

    vp.style.transition = '';

    if (previous === null || fromH === null || prefersReducedMotion()) return undefined;

    const animH = Math.abs(fromH - curH) > 0.5;
    const animW = plan.some((p) => Math.abs(p.outW - p.inW) > 0.5);
    if (!animH && !animW) return undefined;

    // FLIP: старт со старых размеров (без транзишена) → следующий кадр к новым (транзишен из таблицы стилей).
    plan.forEach((p) => { p.cell.style.transition = 'none'; p.cell.style.width = `${p.outW}px`; });
    if (animH) { vp.style.transition = 'none'; vp.style.height = `${fromH}px`; }
    void vp.offsetWidth;
    plan.forEach((p) => { p.cell.style.transition = ''; p.cell.style.width = `${p.inW}px`; });
    if (animH) { vp.style.transition = ''; vp.style.height = `${curH}px`; }

    // Релиз в auto: ячейка → ширина нового символа (in в потоке), вьюпорт → натуральная высота. out абсолютен и
    // в размер не входит — поэтому гонки с его размонтированием нет, релиз бесшовный без всяких костылей.
    const timer = window.setTimeout(() => {
      plan.forEach((p) => { p.cell.style.transition = 'none'; p.cell.style.width = ''; });
      vp.style.transition = 'none';
      vp.style.height = '';
      void vp.offsetWidth;
      plan.forEach((p) => { p.cell.style.transition = ''; });
      vp.style.transition = '';
    }, duration * 1000 + 60);

    return () => window.clearTimeout(timer);
  }, [current, previous, duration]);

  const vars = { '--slide-swap-dur': `${duration}s` } as CSSProperties;

  const currentChars = Array.from(current);
  const previousChars = previous === null ? null : Array.from(previous);
  const nbsp = (ch: string) => (ch === ' ' ? ' ' : ch);

  // Диф краёв: общий префикс/суффикс не анимируем — свопим только изменившуюся середину. Позиционный диф
  // разъезжается при смене длины («3»→«18», «секунды»→«секунду»): всё после точки различия считается
  // «изменившимся» и рендерится вкривь (лишние пробелы, задвоение). Поэтому при РАЗНОЙ длине середину отдаём
  // одной блок-ячейкой (весь сегмент уезжает/въезжает целиком), а при РАВНОЙ — посимвольно (цифры тикают
  // независимо, как в таймере). Края статичны и выровнены.
  const { prefix, suffix } = commonAffixes(previous ?? '', current);
  const prevLen = previousChars?.length ?? 0;
  const curMidEnd = currentChars.length - suffix;
  const sameLen = previousChars !== null && prevLen === currentChars.length;

  const staticCell = (key: string, ch: string): ReactNode => (
    <span key={key} className={'ui-slide-swap-static'}>{nbsp(ch)}</span>
  );
  // Ячейка свопа-одометра: новый символ (in) — в потоке, задаёт ширину покоя ячейки; старый (out) — абсолют
  // (data-swap-out, из раскладки выключен), уезжает вверх под клип. data-swap-cell/-in читает плагин, чтобы
  // измерить старую/новую ширину и вести ячейку между ними. Ключи слоёв на generation — чтобы CSS-keyframes
  // перезапускались на каждом свопе (сама ячейка по позиции переиспользуется).
  const swapCellNode = (key: string, outStr: string, inStr: string): ReactNode => (
    <span key={key} data-swap-cell="" className={'ui-slide-swap-cell'}>
      <span key={`out-${generation}`} data-swap-out="" className={'ui-slide-swap-out'} aria-hidden="true">{nbsp(outStr)}</span>

      <span key={`in-${generation}`} data-swap-in="" className={'ui-slide-swap-in'}>{nbsp(inStr)}</span>
    </span>
  );

  // Ячейки по порядку текущего текста: [префикс-статика][изменившаяся середина][суффикс-статика].
  const cells: { node: ReactNode; space: boolean }[] = [];
  const pushStatic = (key: string, i: number) =>
    cells.push({ node: staticCell(key, currentChars[i] ?? ''), space: currentChars[i] === ' ' });

  for (let i = 0; i < prefix; i++) pushStatic(`p${i}`, i);
  if (previousChars === null) {
    for (let i = 0; i < currentChars.length; i++) pushStatic(`i${i}`, i);
  } else if (sameLen) {
    for (let i = prefix; i < curMidEnd; i++) {
      if (previousChars[i] === currentChars[i]) pushStatic(`m${i}`, i);
      else cells.push({ node: swapCellNode(`m${i}`, previousChars[i] ?? '', currentChars[i] ?? ''), space: currentChars[i] === ' ' });
    }
    for (let i = curMidEnd; i < currentChars.length; i++) pushStatic(`s${i}`, i);
  } else {
    const prevMid = previousChars.slice(prefix, prevLen - suffix).join('');
    const curMid = currentChars.slice(prefix, curMidEnd).join('');
    cells.push({ node: swapCellNode('mid', prevMid, curMid), space: false });
    for (let i = curMidEnd; i < currentChars.length; i++) pushStatic(`s${i}`, i);
  }

  // Группируем НЕпробельные ячейки в слова (.swapWord, nowrap — слово не рвётся по буквам), пробелы — точки
  // переноса между словами (иначе в узком контейнере строка ломается посреди слова, «вопрос/ов»).
  const groups: ReactNode[] = [];
  let word: ReactNode[] = [];
  let wordKey = 0;
  const flushWord = () => {
    if (word.length === 0) return;
    groups.push(<span key={`w${wordKey++}`} className={'ui-slide-swap-word'}>{word}</span>);
    word = [];
  };
  cells.forEach((c) => {
    if (c.space) { flushWord(); groups.push(c.node); }
    else word.push(c.node);
  });
  flushWord();

  return (
    <span ref={viewportRef} className={'ui-slide-swap'} style={vars}>
      {groups}
    </span>
  );
}

/** Диспетчер textSlide: steps+currentStep → последовательный слайд; mode='swap' → своп значения; иначе → hover. */
export function TextSlide({ content, options }: TextAnimationContext<TextSlideOptions>) {
  if (isSequence(options)) {
    return <TextSlideSequence options={options} />;
  }

  if (options?.mode === 'swap') {
    return <TextSlideSwap content={content} options={options} />;
  }

  return <TextSlideHover content={content} options={options} />;
}
