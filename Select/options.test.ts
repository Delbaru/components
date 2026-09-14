import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultEqual, flattenSelectItems, getFocusedOptionIndex, visibleDropdownItems, type FlattenedSelectItem, type SelectItem, type SelectOption } from './options';

const items: SelectItem[] = [
    { value: 'a', label: 'A' },
    { label: 'Группа', options: [{ value: 'b', label: 'B' }, { value: 'c', label: 'C' }] },
];

const labels = (list: FlattenedSelectItem[]) => list.map((item) => (item.type === 'group' ? `#${item.label}` : item.option.value));
const option = (value: string): SelectOption => ({ value, label: value.toUpperCase() });

test('flattenSelectItems: группа разворачивается в заголовок и свои пункты, ключи не пересекаются', () => {
    const flat = flattenSelectItems(items);
    assert.deepEqual(labels(flat), ['a', '#Группа', 'b', 'c']);
    assert.equal(new Set(flat.map((item) => item.key)).size, flat.length);
});

test('defaultEqual: сравнение по строке, null равен только null', () => {
    assert.equal(defaultEqual<string | number>(1, '1'), true);
    assert.equal(defaultEqual<string>('a', null), false);
    assert.equal(defaultEqual<string>(null, null), true);
});

test('visibleDropdownItems: группа без видимых пунктов прячется вместе с заголовком', () => {
    const flat = flattenSelectItems(items);
    assert.deepEqual(labels(visibleDropdownItems(flat, [option('a')], false)), ['a']);
    assert.deepEqual(labels(visibleDropdownItems(flat, [option('c')], false)), ['#Группа', 'c']);
    assert.equal(visibleDropdownItems(flat, [option('a')], true), flat);
});

test('getFocusedOptionIndex: выбранный пункт, первый из выбранных, иначе первый', () => {
    const options = ['a', 'b', 'c'].map(option);
    assert.equal(getFocusedOptionIndex([], false, null, []), -1);
    assert.equal(getFocusedOptionIndex(options, false, option('c'), []), 2);
    assert.equal(getFocusedOptionIndex(options, true, null, [option('b'), option('c')]), 1);
    assert.equal(getFocusedOptionIndex(options, false, null, []), 0);
});
