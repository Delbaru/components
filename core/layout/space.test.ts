import assert from 'node:assert/strict';
import test from 'node:test';

import { inlineSpaceStyle, isBareSpaceShorthand, needsInlineSpace, spaceClassKey } from './space';

test('spaceClassKey: число, auto и идентификатор — классом; отрицательное — инлайн', () => {
    assert.equal(spaceClassKey(24), '24');
    assert.equal(spaceClassKey('auto'), 'auto');
    assert.equal(spaceClassKey('headerOffset'), 'headeroffset');
    assert.equal(spaceClassKey(-8), undefined);
    assert.equal(spaceClassKey('1px'), undefined);
});

test('spaceClassKey: шорткат раскрывается по правилам CSS, одинаковые стороны схлопываются', () => {
    assert.equal(spaceClassKey([8, 16]), '8_16_8_16');
    assert.equal(spaceClassKey([8, 16, 4]), '8_16_4_16');
    assert.equal(spaceClassKey([8, 8, 8, 8]), '8');
    assert.equal(spaceClassKey([8, '1px']), undefined);
});

test('четыре значения подряд — голый шорткат, а не кортеж брейкпоинтов', () => {
    assert.equal(isBareSpaceShorthand([8, 16, 8, 16]), true);
    assert.equal(isBareSpaceShorthand([8, 16, 8]), false);
});

test('inlineSpaceStyle: отрицательное значение уходит переменными на все брейкпоинты', () => {
    assert.equal(needsInlineSpace(-8), true);
    assert.deepEqual(inlineSpaceStyle({ mt: -8 }), {
        '--inline-space-mt-d': 'calc(var(--rpx) * -8)',
        '--inline-space-mt-m': 'calc(var(--rpx) * -8)',
        '--inline-space-mt-t': 'calc(var(--rpx) * -8)',
    });
});

test('inlineSpaceStyle: классовые значения инлайн не пишутся', () => {
    assert.deepEqual(inlineSpaceStyle({ p: 24, m: [8, null, 16] }), {});
});
