import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClassBuilder } from '../base/shared-props';
import { boxLayout, splitBoxLayout } from './box';

// Словарь-заглушка: класс есть у любого значения, а у литерала — только у токена из набора.
const TOKEN_LITERALS = new Set(['var(--white-100)']);

const classesFor = (prefix: string, value: unknown, hasClass: (v: unknown) => boolean = () => true) => {
    if (value === undefined) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.map((v) => (v === null || !hasClass(v) ? undefined : `${prefix}_${String(v)}`));
};

const c: ClassBuilder = {
    num: (prefix, value) => classesFor(prefix, value),
    enum: (prefix, value) => classesFor(prefix, value),
    size: (prefix, value) => classesFor(prefix, value),
    space: (prefix, value) => classesFor(prefix, value),
    bg: (prefix, value) => classesFor(prefix, value),
    literal: (prefix, value) => classesFor(prefix, value, (v) => TOKEN_LITERALS.has(String(v))),
    key: (prefix, value) => classesFor(prefix, value),
};

test('splitBoxLayout: пропсы коробки отделяются, остальное уходит на узел', () => {
    const { box, rest } = splitBoxLayout({ p: 8, bg: 'var(--white-100)', grow: 1, id: 'card', 'aria-label': 'Карточка' });
    assert.deepEqual(box, { p: 8, bg: 'var(--white-100)', grow: 1 });
    assert.deepEqual(rest, { id: 'card', 'aria-label': 'Карточка' });
});

test('boxLayout: пустая коробка не даёт ни классов, ни стиля', () => {
    const layout = boxLayout(c, {});
    assert.deepEqual(layout.classes.filter(Boolean), []);
    assert.deepEqual(layout.style, {});
});

test('boxLayout: фон со словарным классом — классом, без класса — инлайном', () => {
    const token = boxLayout(c, { bg: 'var(--white-100)' });
    assert.ok(token.classes.includes('bg_var(--white-100)'));
    assert.equal(token.style.background, undefined);

    assert.equal(boxLayout(c, { bg: '#fafafa' }).style.background, '#fafafa');
});

test('boxLayout: borderTLR — запасное имя, tlr важнее', () => {
    assert.ok(boxLayout(c, { borderTLR: 12 }).classes.includes('borderTopLeftRadius_12'));
    assert.ok(boxLayout(c, { tlr: 8, borderTLR: 12 }).classes.includes('borderTopLeftRadius_8'));
});

test('boxLayout: адаптивный grow — служебный класс и переменные брейкпоинтов', () => {
    const layout = boxLayout(c, { grow: [1, 0, null] });
    assert.ok(layout.classes.includes('inlineFlexGrow'));
    assert.deepEqual(layout.style, { '--inline-flex-grow-d': '1', '--inline-flex-grow-m': '0' });
});

test('boxLayout: рамка с классом на всех брейкпоинтах инлайн не дублируется', () => {
    const layout = boxLayout(c, { borderW: 2, borderC: '#ddd' });
    assert.ok(layout.classes.includes('borderWidth_2'));
    assert.equal(layout.style.borderWidth, undefined);
    assert.equal(layout.style.borderColor, '#ddd');
});
