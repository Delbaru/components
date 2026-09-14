import assert from 'node:assert/strict';
import test from 'node:test';

import { assignRef } from './useMergedRefs';

test('assignRef: объектный ref получает узел', () => {
    const ref: { current: string | null } = { current: null };
    assignRef(ref, 'node');
    assert.equal(ref.current, 'node');
});

test('assignRef: функциональный ref вызывается с узлом и с null при размонтировании', () => {
    const calls: Array<string | null> = [];
    const ref = (node: string | null) => {
        calls.push(node);
    };
    assignRef(ref, 'node');
    assignRef(ref, null);
    assert.deepEqual(calls, ['node', null]);
});

test('assignRef: пустой ref ничего не ломает', () => {
    assert.doesNotThrow(() => assignRef(undefined, 'node'));
    assert.doesNotThrow(() => assignRef(null, 'node'));
});
