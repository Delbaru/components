import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedLink } from './links';

test('isAllowedLink: относительный путь, http(s), mailto и голый домен — да', () => {
    assert.equal(isAllowedLink('/tests/1'), true);
    assert.equal(isAllowedLink('https://socrat.ru'), true);
    assert.equal(isAllowedLink('mailto:help@socrat.ru'), true);
    assert.equal(isAllowedLink('socrat.ru/docs'), true);
});

test('isAllowedLink: javascript:, data: и чужие схемы — нет', () => {
    assert.equal(isAllowedLink('javascript:alert(1)'), false);
    assert.equal(isAllowedLink('javascript://%0Aalert(1)'), false);
    assert.equal(isAllowedLink('data:text/html,<b>x</b>'), false);
    assert.equal(isAllowedLink('ftp://files.example'), false);
});
