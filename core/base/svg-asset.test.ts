import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSvgAssetPath, resolveSvgAssetSource } from './svg-asset';

test('normalizeSvgAssetPath: относительный путь становится абсолютным', () => {
    assert.equal(normalizeSvgAssetPath('icons/ui/eye.svg'), '/icons/ui/eye.svg');
    assert.equal(normalizeSvgAssetPath('./a.svg'), '/a.svg');
});

test('normalizeSvgAssetPath: абсолютный путь, URL и data: не трогает', () => {
    assert.equal(normalizeSvgAssetPath('/icons/x.svg'), '/icons/x.svg');
    assert.equal(normalizeSvgAssetPath('https://cdn.example/x.svg'), 'https://cdn.example/x.svg');
    assert.equal(normalizeSvgAssetPath('//cdn.example/x.svg'), '//cdn.example/x.svg');
    assert.equal(normalizeSvgAssetPath('data:image/svg+xml;base64,AAA'), 'data:image/svg+xml;base64,AAA');
    assert.equal(normalizeSvgAssetPath(''), '');
});

test('resolveSvgAssetSource: строка или статический импорт Next ({ src }) → путь', () => {
    assert.equal(resolveSvgAssetSource('icons/a.svg'), '/icons/a.svg');
    assert.equal(resolveSvgAssetSource({ src: '/_next/static/media/a.1x.svg', width: 24 }), '/_next/static/media/a.1x.svg');
});

test('resolveSvgAssetSource: всё остальное → undefined', () => {
    assert.equal(resolveSvgAssetSource(undefined), undefined);
    assert.equal(resolveSvgAssetSource(42), undefined);
    assert.equal(resolveSvgAssetSource({ href: '/a.svg' }), undefined);
});
