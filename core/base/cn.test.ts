import assert from 'node:assert/strict';
import test from 'node:test';

import { css, cx } from './cn';

test('cx склеивает классы и пропускает пустое', () => {
    assert.equal(cx('a', undefined, null, false, 'b', ''), 'a b');
    assert.equal(cx(), '');
});

test('css достаёт класс по ключу и молчит без ключа', () => {
    const styles = { d_gap_12: 'Flex_d_gap_12__x1' };
    assert.equal(css(styles, 'd_gap_12'), 'Flex_d_gap_12__x1');
    assert.equal(css(styles), undefined);
    assert.equal(css(styles, 'missing'), undefined);
});
