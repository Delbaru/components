import assert from 'node:assert/strict';
import test from 'node:test';

import { boxLayout, splitBoxLayout } from './box';
import { createLayoutClasses } from './layout-classes';

const c = createLayoutClasses(
    { height_56: 'Field__height_56', d_height_56: 'Field__d_height_56', m_height_56: 'Field__m_height_56', t_height_56: 'Field__t_height_56', variant_primary: 'Field__variant_primary' },
    { local: { h: 'height' } }
);

test('splitBoxLayout: пропсы коробки отделяются, остальное уходит на узел', () => {
    const { box, rest } = splitBoxLayout({ p: 8, bg: 'var(--white-100)', grow: 1, id: 'card', 'aria-label': 'Карточка' });
    assert.deepEqual(box, { p: 8, bg: 'var(--white-100)', grow: 1 });
    assert.deepEqual(rest, { id: 'card', 'aria-label': 'Карточка' });
});

test('boxLayout: пустая коробка не даёт классов', () => {
    assert.deepEqual(boxLayout(c, {}), []);
});

test('boxLayout: любое значение — классом утилиты, инлайна нет', () => {
    assert.deepEqual(boxLayout(c, { bg: 'var(--white-100)', grow: [1, 0, null], mt: -8, aspectRatio: '16 / 9' }), [
        'mt_-8',
        'bg_--white-100',
        'ratio_16/9',
        'grow_1',
        'm_grow_0',
    ]);
});

test('boxLayout: borderTLR — запасное имя, tlr важнее', () => {
    assert.deepEqual(boxLayout(c, { borderTLR: 12 }), ['tlr_12']);
    assert.deepEqual(boxLayout(c, { tlr: 8, borderTLR: 12 }), ['tlr_8']);
});

test('createLayoutClasses: число локального пропа — из модуля, строка — утилитой', () => {
    assert.deepEqual(c.value('h', 56), ['Field__height_56']);
    assert.deepEqual(c.value('h', [56]), ['Field__d_height_56', 'Field__m_height_56', 'Field__t_height_56']);
    assert.deepEqual(c.value('h', '100%'), ['h_100%']);
    assert.deepEqual(c.value('h', 46.5), ['h_46.5'], 'дробному числу класса модуля не бывает — утилита');
    assert.deepEqual(c.value('variant', 'primary'), ['Field__variant_primary']);
    assert.deepEqual(c.value('variant', 'missing'), []);
});
