import assert from 'node:assert/strict';
import test from 'node:test';

import { utilityClasses } from './classes';
import { entryKey, hashKey } from './keys';
import { resolveUtility, type Utility } from './registry';
import { exactRules, looseRules, renderRules } from './rules';

const u = (name: string): Utility => {
  const utility = resolveUtility(name);
  assert.ok(utility, `нет утилиты ${name}`);
  return utility;
};

test('одинаковое значение на всех брейкпоинтах — один базовый класс', () => {
  assert.deepEqual(utilityClasses(u('gap'), [8, 8, 8]), ['gap_8']);
  assert.deepEqual(utilityClasses(u('gap'), [8]), ['gap_8']);
  assert.deepEqual(utilityClasses(u('gap'), 8), ['gap_8']);
});

test('одинаковые mobile и tablet — один класс «ниже 1024»', () => {
  assert.deepEqual(utilityClasses(u('p'), [8, 0, 0]), ['p_8', 'n_p_0']);
  assert.deepEqual(utilityClasses(u('w'), [1328, '100%', '100%']), ['w_1328', 'n_w_100%']);
});

test('разные брейкпоинты — база desktop и точечные переопределения', () => {
  assert.deepEqual(utilityClasses(u('columns'), [4, 1, 2]), ['columns_4', 'm_columns_1', 't_columns_2']);
  assert.deepEqual(utilityClasses(u('gap'), [24, 12]), ['gap_24', 'm_gap_12']);
  assert.deepEqual(utilityClasses(u('gap'), [24, 24, 12]), ['gap_24', 't_gap_12']);
});

test('null — пропуск брейкпоинта: базы нет, только свои классы', () => {
  assert.deepEqual(utilityClasses(u('r'), [40, null, null]), ['d_r_40']);
  assert.deepEqual(utilityClasses(u('p'), [null, 16, 16]), ['n_p_16']);
  assert.deepEqual(utilityClasses(u('p'), [8, null, 0]), ['d_p_8', 't_p_0']);
});

test('шорткат отступа: голые четыре значения — одно значение на все брейкпоинты', () => {
  assert.deepEqual(utilityClasses(u('p'), [16, 40, 16, 40]), ['p_16_40_16_40']);
  assert.deepEqual(utilityClasses(u('p'), [[16, 40], 24, [8, 24]]), ['p_16_40_16_40', 'm_p_24', 't_p_8_24_8_24']);
  assert.deepEqual(utilityClasses(u('p'), [[8, 8, 8, 8]]), ['p_8']);
});

test('ключи: число, CSS как есть, токен по имени, остальное хешем', () => {
  assert.equal(entryKey(-8), '-8');
  assert.equal(entryKey('fit-content'), 'fit-content');
  assert.equal(entryKey('var(--primary)'), '--primary');
  assert.equal(entryKey('16 / 9'), '16/9');
  assert.equal(entryKey('calc(100% - var(--s-80))'), hashKey('calc(100% - var(--s-80))'));
  assert.notEqual(hashKey('calc(var(--header-height) - var(--s-container))'), hashKey('calc(var(--header-height) - var(--s-container) - 1px)'));
});

test('null — пропуск у любой утилиты: grow, отрицательный отступ и строка размера не исключение', () => {
  assert.deepEqual(utilityClasses(u('grow'), [1, null, null]), ['d_grow_1']);
  assert.deepEqual(utilityClasses(u('grow'), [1, 1, 1]), ['grow_1']);
  assert.deepEqual(utilityClasses(u('mt'), [-8, null, null]), ['d_mt_-8']);
  assert.deepEqual(utilityClasses(u('w'), ['12rem', null, null]), ['d_w_12rem']);
});

test('строка, не похожая на значение CSS, класса не даёт — таблица стилей не ломается', () => {
  assert.deepEqual(utilityClasses(u('w'), '/icons/ui/check.svg'), []);
  assert.deepEqual(utilityClasses(u('color'), 'Заголовок'), []);
  assert.deepEqual(utilityClasses(u('bg'), 'red; } body { color: red'), []);
  assert.deepEqual(utilityClasses(u('w'), 'min(100%, 400px)'), [`w_${hashKey('min(100%,400px)')}`]);
  assert.deepEqual(utilityClasses(u('h'), '12rem'), ['h_12rem']);
});

test('слово, которое свойство не принимает, класса не даёт — база desktop не протекает на телефон', () => {
  const maxH = utilityClasses(u('maxH'), ['calc(var(--rpx) * 464)', 'auto', 'auto']);
  assert.equal(maxH.length, 1);
  assert.ok(maxH[0]?.startsWith('d_maxH_'), 'max-height: auto невалиден — остаётся только desktop');
  assert.deepEqual(utilityClasses(u('p'), [16, 'auto', 'auto']), ['d_p_16']);
  assert.deepEqual(utilityClasses(u('m'), [16, 'auto', 'auto']), ['m_16', 'n_m_auto']);
  assert.deepEqual(utilityClasses(u('maxW'), 'none'), ['maxW_none']);
  assert.deepEqual(utilityClasses(u('w'), 'none'), []);
});

test('пробелы у скобок и запятых ключ не меняют', () => {
  assert.equal(entryKey('rgba(43, 47, 51, 0.8)'), entryKey('rgba(43,47,51,0.8)'));
  assert.notEqual(entryKey('calc(100% - 8px)'), entryKey('calc(100%-8px)'));
});

test('значение не своего типа класса не даёт', () => {
  assert.deepEqual(utilityClasses(u('columns'), 'wide' as unknown as number), []);
  assert.deepEqual(utilityClasses(u('dir'), 'diagonal'), []);
  assert.deepEqual(utilityClasses(u('w'), [16, 40]), ['w_16', 'm_w_40']);
});

test('синонимы пропов ведут к тем же утилитам, атрибуты HTML — нет', () => {
  assert.equal(resolveUtility('aspectRatio')?.name, 'ratio');
  assert.equal(resolveUtility('borderTLR')?.name, 'tlr');
  assert.equal(resolveUtility('width'), undefined);
  assert.equal(resolveUtility('variant'), undefined);
});

test('генератор печатает ровно те классы, что выдаёт рантайм', () => {
  const rules = exactRules(u('p'), [8, 0, 0]);
  assert.deepEqual(rules.map((rule) => rule.className), utilityClasses(u('p'), [8, 0, 0]));
  assert.deepEqual(rules.map((rule) => rule.declaration), ['padding: calc(var(--rpx) * 8)', 'padding: calc(var(--rpx) * 0)']);
});

test('таблица: полное свойство после шортката, брейкпоинт после базы', () => {
  const css = renderRules([...looseRules(u('pt'), 4), ...looseRules(u('p'), 8)]);
  assert.ok(css.indexOf('.p_8 ') < css.indexOf('.pt_4 '));
  assert.ok(css.lastIndexOf('.t_p_8 ') < css.indexOf('.pt_4 '));
  assert.match(renderRules(exactRules(u('w'), '100%')), /\.w_100\\% \{ width: 100%; \}/);
});
