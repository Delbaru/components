import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCountContent } from './parseContent';

test('parseCountContent: число с суффиксом и разрядами', () => {
    assert.deepEqual(parseCountContent('3 000+'), { to: 3000, grouped: true, prefix: '', suffix: '+' });
    assert.deepEqual(parseCountContent('500+'), { to: 500, grouped: false, prefix: '', suffix: '+' });
    assert.deepEqual(parseCountContent('70%'), { to: 70, grouped: false, prefix: '', suffix: '%' });
    assert.deepEqual(parseCountContent('24/7'), { to: 24, grouped: false, prefix: '', suffix: '/7' });
    assert.deepEqual(parseCountContent('20'), { to: 20, grouped: false, prefix: '', suffix: '' });
});

test('parseCountContent: префикс не теряется и приклеен к числу неразрывным пробелом', () => {
    assert.deepEqual(parseCountContent('до 50%'), { to: 50, grouped: false, prefix: 'до ', suffix: '%' });
    assert.deepEqual(parseCountContent('до 3 000+'), { to: 3000, grouped: true, prefix: 'до ', suffix: '+' });
});

test('parseCountContent: без цифр — null', () => {
    assert.equal(parseCountContent('∞'), null);
    assert.equal(parseCountContent(42), null);
});
