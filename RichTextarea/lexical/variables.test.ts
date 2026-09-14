import assert from 'node:assert/strict';
import test from 'node:test';

import { createVariableLookup, findVariableTokenMatch, resolveVariableDefinition } from './variables';

const lookup = createVariableLookup([
    { key: 'student_name', label: 'Имя ученика', aliases: ['ФИО'] },
    { key: 'date', label: 'Дата' },
]);

test('findVariableTokenMatch: парный @токен@ находится по ключу, метке или синониму', () => {
    assert.deepEqual(findVariableTokenMatch('до @date@ включительно', lookup), { startOffset: 3, endOffset: 9, variable: lookup.get('date') });
    assert.equal(findVariableTokenMatch('@ФИО@', lookup)?.variable.key, 'student_name');
});

test('findVariableTokenMatch: одиночный @ берёт самую длинную метку по границе слова', () => {
    const match = findVariableTokenMatch('Здравствуйте, @Имя ученика!', lookup);
    assert.equal(match?.variable.key, 'student_name');
    assert.equal(match?.endOffset, 'Здравствуйте, @Имя ученика'.length);
});

test('findVariableTokenMatch: @ посреди слова и незаконченный токен — не переменная', () => {
    assert.equal(findVariableTokenMatch('mail@date', lookup), undefined);
    assert.equal(findVariableTokenMatch('@Датами', lookup), undefined);
});

test('resolveVariableDefinition: строка ищется в словаре, незнакомая становится своей меткой', () => {
    assert.equal(resolveVariableDefinition('дата', lookup).key, 'date');
    assert.deepEqual(resolveVariableDefinition('x', lookup), { key: 'x', label: 'x' });
});
