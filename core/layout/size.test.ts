import assert from 'node:assert/strict';
import test from 'node:test';

import { inlineOnlySize, inlineSizeStyle, sizeClassKey } from './size';

test('sizeClassKey: числа, проценты, viewport и ключевые слова — классом', () => {
    assert.equal(sizeClassKey(200), '200');
    assert.equal(sizeClassKey('50%'), 'p_50');
    assert.equal(sizeClassKey('100vw'), 'vw_100');
    assert.equal(sizeClassKey('100dvh'), 'dvh_100');
    assert.equal(sizeClassKey('auto'), 'auto');
    assert.equal(sizeClassKey('fit-content'), 'fit_content');
});

test('sizeClassKey: произвольная строка уходит инлайн', () => {
    assert.equal(sizeClassKey('12rem'), undefined);
    assert.equal(sizeClassKey('calc(1px + 7rem + 3px)'), undefined);
    assert.equal(inlineOnlySize('12rem'), true);
    assert.equal(inlineOnlySize(12), false);
});

test('inlineSizeStyle: скаляр-строка — прямым свойством, классы не трогает', () => {
    assert.deepEqual(inlineSizeStyle({ width: '12rem', height: 40, maxWidth: '100%' }), { width: '12rem' });
});

test('inlineSizeStyle: кортеж с инлайн-значением — переменные по брейкпоинтам, null пропущен', () => {
    assert.deepEqual(inlineSizeStyle({ width: ['12rem', 24, null] }), {
        '--inline-size-width-d': '12rem',
        '--inline-size-width-m': 'calc(var(--rpx) * 24)',
    });
});
