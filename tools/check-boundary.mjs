#!/usr/bin/env node
// Сторож границы библиотеки: ни один её файл не импортирует ничего снаружи этой папки.
// Разрешены относительные пути внутри папки и npm-пакеты; алиасы проекта (`@/…`, `@socrat/…`)
// и выход через `../` за корень — нарушение.
//
//   node <путь до UI>/tools/check-boundary.mjs          → код 1 и список нарушений
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_EXT = /\.(ts|tsx|scss)$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'tools', 'public']);
const SPECIFIER_RE =
  /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]|@(?:use|forward|import)\s+['"]([^'"]+)['"]/gm;
const PROJECT_ALIAS_RE = /^(@\/|~\/|@socrat\/|@d4y\/|src\/|apps\/|libs\/)/;

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const violations = [];

for (const file of walk(ROOT)) {
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  for (const match of code.matchAll(SPECIFIER_RE)) {
    const spec = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (!spec || spec.startsWith('sass:')) continue;

    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (spec.startsWith('.')) {
      const target = path.resolve(path.dirname(file), spec);
      if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
        violations.push(`${rel}  →  ${spec}  (выход за папку библиотеки)`);
      }
    } else if (PROJECT_ALIAS_RE.test(spec)) {
      violations.push(`${rel}  →  ${spec}  (алиас проекта)`);
    }
  }
}

if (violations.length) {
  console.error(`[ui:boundary] ✗ библиотека импортирует снаружи своей папки (${violations.length}):`);
  for (const line of violations) console.error(`  ${line}`);
  process.exit(1);
}

console.log('[ui:boundary] ✓ библиотека самодостаточна: импортов наружу нет');
