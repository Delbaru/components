import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveOpeningMonth } from './date-picker';

const TODAY = new Date(2026, 8, 18);
const month = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}`;

test('выбранный день решает месяц, даже если он раньше min', () => {
    assert.equal(month(resolveOpeningMonth('05.03.2026', '01.06.2026', undefined, TODAY)), '2026-3');
});

test('пустое значение — это «не выбрано»: открываемся на сегодня', () => {
    assert.equal(month(resolveOpeningMonth('', undefined, undefined, TODAY)), '2026-9');
});

test('min в будущем двигает открытие вперёд — «Дата окончания» после декабрьского начала', () => {
    assert.equal(month(resolveOpeningMonth('', '14.12.2026', undefined, TODAY)), '2026-12');
});

test('min в прошлом открытие НЕ тянет назад', () => {
    assert.equal(month(resolveOpeningMonth('', '01.01.2020', undefined, TODAY)), '2026-9');
});

test('max в прошлом двигает открытие назад', () => {
    assert.equal(month(resolveOpeningMonth(undefined, undefined, '10.02.2026', TODAY)), '2026-2');
});
