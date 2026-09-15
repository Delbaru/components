import assert from 'node:assert/strict';
import test from 'node:test';

import { extractUtilityRules, type Source } from './extract';

const classesOf = (sources: Source[], options: Parameters<typeof extractUtilityRules>[1] = {}) =>
  new Set(extractUtilityRules(sources, options).map((rule) => rule.className));

test('литерал в пропе — ровно те классы, что выдаст рантайм', () => {
  const classes = classesOf([{ file: 'a.tsx', text: 'export const A = () => <Flex p={[8, 0, 0]} gap={[16]} />;' }]);
  assert.ok(classes.has('p_8') && classes.has('n_p_0') && classes.has('gap_16'));
  assert.ok(!classes.has('d_p_8'), 'схлопнутый кортеж не печатает брейкпоинт');
});

test('константа, её поле и арифметика вычисляются', () => {
  const classes = classesOf([
    {
      file: 'a.tsx',
      text: `
        const PANEL = 670;
        const COLUMNS = { group: 300 } as const;
        export const A = () => <><Flex w={[PANEL / 2, null, null]} /><Flex w={[COLUMNS.group, null, null]} /></>;
      `,
    },
  ]);
  assert.ok(classes.has('d_w_335') && classes.has('d_w_300'));
});

test('импорт константы из соседнего файла', () => {
  const sources = [
    { file: '/p/sizes.ts', text: 'export const RAIL = 72;' },
    { file: '/p/a.tsx', text: "import { RAIL } from './sizes'; export const A = () => <Flex h={RAIL} />;" },
  ];
  const classes = classesOf(sources, { resolveModule: (_from, spec) => (spec === './sizes' ? '/p/sizes.ts' : undefined) });
  assert.ok(classes.has('h_72'));
});

test('проброс пропа компонентом: size у Checkbox рождает w и h его Flex', () => {
  const classes = classesOf([
    { file: 'checkbox.tsx', text: 'export function Checkbox({ size }) { return <Flex w={size ?? 24} h={size ?? 24} />; }' },
    { file: 'page.tsx', text: 'export const Page = () => <Checkbox size={[20, null, null]} />;' },
  ]);
  assert.ok(classes.has('d_w_20') && classes.has('d_h_20'), 'значение с вызова');
  assert.ok(classes.has('w_24') && classes.has('h_24'), 'дефолт внутри компонента');
});

test('ключ данных: значение из объекта доходит до утилиты через поле', () => {
  const classes = classesOf([
    { file: 'data.ts', text: "export const STATS = [{ value: '∞', valueFontSize: [80, 44, 44] }];" },
    { file: 'stats.tsx', text: 'export const Stats = ({ items }) => items.map((item) => <Text fontSize={item.valueFontSize} />);' },
  ]);
  assert.ok(classes.has('fontSize_80') && classes.has('n_fontSize_44'));
});

test('ключ с большим набором значений — данные, а не токен: не берётся', () => {
  const items = Array.from({ length: 20 }, (_, i) => `{ width: ${100 + i} }`).join(', ');
  const classes = classesOf([
    { file: 'data.ts', text: `export const IMAGES = [${items}];` },
    { file: 'img.tsx', text: 'export const Pic = ({ image }) => <Flex w={image.width} />;' },
  ]);
  assert.ok(!classes.has('w_105'));
});

test('шаблонная строка с условием вычисляется в обе стороны', () => {
  const classes = classesOf([
    { file: 'a.tsx', text: "export const A = ({ on }) => <Flex border={[`calc(1.5 * var(--rpx)) solid ${on ? 'var(--primary)' : 'var(--gray-light)'}`, null, null]} />;" },
  ]);
  assert.equal([...classes].filter((name) => name.startsWith('d_border_')).length, 2);
});

test('поле конфига — база и все брейкпоинты', () => {
  const classes = classesOf([{ file: 'config.ts', text: 'export const PRESET = { gap: 12, p: [16, 32] };' }]);
  for (const name of ['gap_12', 'd_gap_12', 'n_gap_12', 'm_gap_12', 't_gap_12', 'p_16_32_16_32', 'n_p_16_32_16_32']) assert.ok(classes.has(name), name);
});

test('затравка и закрытые словари печатаются без поиска', () => {
  const classes = classesOf([], { seeds: { r: [24] } });
  assert.ok(classes.has('r_24') && classes.has('m_r_24'));
  assert.ok(classes.has('dir_column') && classes.has('n_text_h2') && classes.has('grow_1'));
});
