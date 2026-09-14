import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLoopSlides, canEnableLoop, getPaginationState, getPeekOffsetPx, hasScrollableSlides } from './slides';

test('hasScrollableSlides: прокрутка есть, только когда слайдов больше, чем видно', () => {
    assert.equal(hasScrollableSlides(1, 1), false);
    assert.equal(hasScrollableSlides(3, 3), false);
    assert.equal(hasScrollableSlides(4, 3), true);
    assert.equal(hasScrollableSlides(2, 'auto'), true);
});

test('canEnableLoop: родной петле нужен хотя бы один слайд сверх видимых', () => {
    assert.equal(canEnableLoop(4, 3), true);
    assert.equal(canEnableLoop(4, 3.5), false);
    assert.equal(canEnableLoop(1, 'auto'), false);
});

test('getPeekOffsetPx: выглядывающая доля слайда плюс зазоры между целыми', () => {
    assert.equal(getPeekOffsetPx(1000, 2, 20, 0.5), 245);
    assert.equal(getPeekOffsetPx(1000, 2, 20, 1.5), 755);
    assert.equal(getPeekOffsetPx(1000, 'auto', 20, 1), 0);
    assert.equal(getPeekOffsetPx(1000, 2, 20, 0), 0);
});

test('buildLoopSlides: слайдов мало для петли — пять повторов, старт в среднем', () => {
    const padded = buildLoopSlides(['a', 'b', 'c'], 2);
    assert.equal(padded.usesPaddedLoop, true);
    assert.equal(padded.renderedSlides.length, 15);
    assert.equal(padded.initialSlideOffset, 6);

    assert.equal(buildLoopSlides(['a', 'b', 'c', 'd', 'e'], 2).usesPaddedLoop, false);
});

test('getPaginationState: без swiper — страницы по позициям, у петли — по слайдам', () => {
    assert.deepEqual(getPaginationState(null, 5, 2, false, false), { pageIndex: 0, pageCount: 4 });
    assert.deepEqual(getPaginationState(null, 5, 2, true, false), { pageIndex: 0, pageCount: 5 });
    assert.deepEqual(getPaginationState(null, 0, 2, false, false), { pageIndex: 0, pageCount: 0 });
});
