#!/usr/bin/env node
// Договор темы: какие CSS-переменные и атрибутные правила библиотека берёт у проекта и чего
// проект не дал. typecheck такое не ловит — без токена молча пропадает цвет или отступ.
//
//   node <UI>/tools/check-tokens.mjs <папки или файлы стилей проекта…> [--with-defaults] [--strict]
//   node <UI>/tools/check-tokens.mjs --list          → договор списком
//
// В договор входит:
//   • токен, который читается как `var(--x)` без запасного значения и не задаётся самой
//     библиотекой (её `--collapse-gap-*`, `--inline-*` и т.п. — внутренние, не в счёт);
//   • семейство, которое читается через интерполяцию (`var(--font-#{$variant})`) — хватает
//     хотя бы одного токена с таким префиксом;
//   • атрибутное правило (`[data-hide-mobile]`), которое ставят компоненты библиотеки.
// `--with-defaults` засчитывает стартовую тему `theme/tokens.default.scss`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED = new Set(['_utilities.scss', '_field-sizes.scss']);
// Заглушки в тестах — не потребители темы: их значения в договор токенов не идут.
const TEST_FILE = /\.test\.tsx?$/;
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'tools', 'theme', 'public']);
const PROP_PREFIX_LIST = /ROOT_DATA_PROP_PREFIXES/;

function walk(target, ext, out = []) {
  if (!fs.existsSync(target)) return out;
  if (fs.statSync(target).isFile()) {
    if (ext.test(target)) out.push(target);
    return out;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(target, entry.name), ext, out);
    } else if (ext.test(entry.name) && !GENERATED.has(entry.name) && !TEST_FILE.test(entry.name)) {
      out.push(path.join(target, entry.name));
    }
  }
  return out;
}

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function add(map, key, user) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(user);
}

export function readContract() {
  const required = new Map();
  const families = new Map();
  const attributes = new Map();
  const internal = new Set();
  const internalPrefixes = new Set();

  for (const file of walk(ROOT, /\.(ts|tsx|scss)$/)) {
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    const user = path.relative(ROOT, file).split(path.sep)[0];

    for (const m of code.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)(#\{|\$\{)?\s*(,)?/g)) {
      if (m[2]) add(families, m[1], user);
      else if (!m[3]) add(required, m[1], user);
    }
    for (const m of code.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) internal.add(m[1]);
    for (const m of code.matchAll(/['"`](--[A-Za-z0-9_-]+)['"`]/g)) internal.add(m[1]);
    for (const m of code.matchAll(/['"`](--[A-Za-z0-9_-]+?)\$\{/g)) internalPrefixes.add(m[1]);
    if (!PROP_PREFIX_LIST.test(code)) {
      for (const m of code.matchAll(/\b(data-(?:hide|order)-(?:mobile|tablet|pc))\b/g)) add(attributes, m[1], user);
    }
  }

  const ownPrefix = (name) => [...internalPrefixes].some((prefix) => name.startsWith(prefix));
  const tokens = [...required]
    .filter(([name]) => !internal.has(name) && !ownPrefix(name))
    .sort(([a], [b]) => a.localeCompare(b));
  const tokenFamilies = [...families]
    .filter(([prefix]) => ![...internal].some((name) => name.startsWith(prefix)) && !ownPrefix(prefix))
    .sort(([a], [b]) => a.localeCompare(b));

  return {
    tokens: new Map(tokens.map(([name, users]) => [name, [...users].sort()])),
    families: new Map(tokenFamilies.map(([prefix, users]) => [prefix, [...users].sort()])),
    attributes: new Map([...attributes].sort(([a], [b]) => a.localeCompare(b)).map(([name, users]) => [name, [...users].sort()])),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const contract = readContract();

  if (args.includes('--list')) {
    for (const name of contract.tokens.keys()) console.log(name);
    for (const prefix of contract.families.keys()) console.log(`${prefix}*`);
    for (const attr of contract.attributes.keys()) console.log(`[${attr}]`);
    process.exit(0);
  }

  const files = args.filter((arg) => !arg.startsWith('--')).flatMap((target) => walk(path.resolve(target), /\.(scss|css)$/));
  if (args.includes('--with-defaults')) files.push(path.join(ROOT, 'theme', 'tokens.default.scss'));
  const styles = files.map((file) => stripComments(fs.readFileSync(file, 'utf8'))).join('\n');
  const declared = new Set([...styles.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]));

  const missing = [
    ...[...contract.tokens].filter(([name]) => !declared.has(name)).map(([name, users]) => [name, users]),
    ...[...contract.families].filter(([prefix]) => ![...declared].some((name) => name.startsWith(prefix))).map(([prefix, users]) => [`${prefix}*`, users]),
    ...[...contract.attributes].filter(([attr]) => !styles.includes(`[${attr}`)).map(([attr, users]) => [`[${attr}]`, users]),
  ];
  const total = contract.tokens.size + contract.families.size + contract.attributes.size;

  if (!missing.length) {
    console.log(`[ui:tokens] ✓ договор темы выполнен: ${total} из ${total}`);
    process.exit(0);
  }

  console.warn(`[ui:tokens] ⚠ договор темы: ${total - missing.length} из ${total}; нет:`);
  for (const [name, users] of missing) console.warn(`  ${name.padEnd(28)} ← ${users.join(', ')}`);
  process.exit(args.includes('--strict') ? 1 : 0);
}
