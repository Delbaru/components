import assert from 'node:assert/strict';
import test from 'node:test';

import { RICH_ROLES, isRichRole, roleClassKeys, tagDefaultRole } from './roles';

test('блок без роли класса не получает — его красит вариант текста', () => {
  assert.deepEqual(roleClassKeys(), []);
  assert.deepEqual(roleClassKeys(undefined, undefined, undefined), []);
});

test('заданная роль даёт свой класс, по ширинам — свои', () => {
  assert.deepEqual(roleClassKeys('h3'), ['role-h3']);
  assert.deepEqual(roleClassKeys('h3', 'p', 'subtitle'), ['role-h3', 'role-m-p', 'role-t-subtitle']);
  // Роль только на мобилке: на остальных ширинах блок остаётся за вариантом.
  assert.deepEqual(roleClassKeys(undefined, 'small'), ['role-m-small']);
});

test('мусор в данных пропускается, рендер на нём не падает', () => {
  assert.deepEqual(roleClassKeys('huge', 42, null), []);
  assert.deepEqual(roleClassKeys('p', 'nope'), ['role-p']);
  assert.equal(isRichRole('title'), true);
  assert.equal(isRichRole('h4'), false);
});

test('у каждого тега есть роль по умолчанию из словаря', () => {
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'] as const) {
    assert.ok((RICH_ROLES as readonly string[]).includes(tagDefaultRole(tag)), tag);
  }
});
