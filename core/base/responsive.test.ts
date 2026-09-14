import assert from 'node:assert/strict';
import test from 'node:test';

import { getBreakpointIndex, resolveResponsive, resolveResponsiveAtBreakpoint } from './responsive';

test('getBreakpointIndex: границы 767 и 1023 включительно', () => {
    assert.equal(getBreakpointIndex(390), 1);
    assert.equal(getBreakpointIndex(767), 1);
    assert.equal(getBreakpointIndex(768), 2);
    assert.equal(getBreakpointIndex(1023), 2);
    assert.equal(getBreakpointIndex(1024), 0);
});

test('resolveResponsiveAtBreakpoint: значение брейкпоинта, иначе запасное', () => {
    assert.equal(resolveResponsiveAtBreakpoint(['row', 'column', null], 'none', 1), 'column');
    assert.equal(resolveResponsiveAtBreakpoint(['row', 'column', null], 'none', 2), 'none');
    assert.equal(resolveResponsiveAtBreakpoint(undefined, 'none', 0), 'none');
    assert.equal(resolveResponsiveAtBreakpoint('row', 'none', 2), 'row');
});

test('скаляр раскладывается на все три брейкпоинта', () => {
    assert.deepEqual(resolveResponsive(12), [12, 12, 12]);
});

test('пропущенная позиция наследует desktop', () => {
    assert.deepEqual(resolveResponsive([24, 12]), [24, 12, 24]);
    assert.deepEqual(resolveResponsive([24]), [24, 24, 24]);
});

test('null — «пропустить брейкпоинт», а не «унаследовать desktop»', () => {
    assert.deepEqual(resolveResponsive([16, null, null]), [16, null, null]);
    assert.deepEqual(resolveResponsive(['column', null, 'row']), ['column', null, 'row']);
});

test('desktop не наследует от мобильного и планшета', () => {
    assert.deepEqual(resolveResponsive([null, 16, 16]), [null, 16, 16]);
    assert.deepEqual(resolveResponsive([]), [null, null, null]);
});
