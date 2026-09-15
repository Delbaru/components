#!/usr/bin/env node
/**
 * Генератор таблицы утилит библиотеки. Запускается из корня проекта:
 *
 *   node --import tsx <UI>/tools/utilities/cli.ts build --config tools/ui/utilities.config.ts
 *   node --import tsx <UI>/tools/utilities/cli.ts watch --config tools/ui/utilities.config.ts
 *
 * Пишет два генерата библиотеки (в её .gitignore, у каждого проекта свои):
 *   core/_utilities.scss   — классы утилит под значения, найденные в коде проекта;
 *   core/_field-sizes.scss — числовые высоты для полей (`height_56` ставит ещё и `--input-height`).
 *
 * Конфиг проекта (default export): `{ scan: ['apps', 'libs'], seeds? }` — см. ExtractOptions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { normalizeCss } from '../../core/utilities/keys';
import { renderRules, type UtilityRule } from '../../core/utilities/rules';
import { extractUtilityRules, type ExtractOptions, type Source } from './extract';

interface UtilitiesConfig extends ExtractOptions {
  readonly scan: readonly string[];
}

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_CSS = path.join(LIB, 'core', '_utilities.scss');
const OUT_FIELDS = path.join(LIB, 'core', '_field-sizes.scss');
const OWN_SOURCES = [path.join(LIB, 'tools'), path.join(LIB, 'core', 'utilities')];
const SKIP = /(^|[\\/])(node_modules|\.next|dist|generated|\.git|public)([\\/]|$)|\.d\.ts$|\.(test|spec)\.tsx?$/;
const BANNER = '// AUTO-GENERATED: tools/utilities (npm run ui:build). Не править руками.\n';

const root = process.cwd();
const args = process.argv.slice(2);
const command = args[0] ?? 'build';
const configArg = args.includes('--config') ? args[args.indexOf('--config') + 1] : undefined;

let config: UtilitiesConfig = { scan: [] };

// ── Файлы ───────────────────────────────────────────────────────────────────

const isOwn = (file: string) => OWN_SOURCES.some((dir) => file.startsWith(dir + path.sep));

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (SKIP.test(full)) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !isOwn(full)) out.push(full);
  }
  return out;
}

const cache = new Map<string, { mtime: number; text: string }>();

function readSources(): Source[] {
  const files = config.scan.flatMap((dir) => walk(path.resolve(root, dir)));
  const alive = new Set(files);
  for (const file of cache.keys()) if (!alive.has(file)) cache.delete(file);
  return files.map((file) => {
    const mtime = fs.statSync(file).mtimeMs;
    const cached = cache.get(file);
    if (cached && cached.mtime === mtime) return { file, text: cached.text };
    const text = fs.readFileSync(file, 'utf8');
    cache.set(file, { mtime, text });
    return { file, text };
  });
}

// ── Импорты: относительные пути и алиасы tsconfig ──────────────────────────

const tsconfigPaths: Record<string, string[]> = (() => {
  const file = path.join(root, 'tsconfig.base.json');
  if (!fs.existsSync(file)) return {};
  try {
    return (JSON.parse(fs.readFileSync(file, 'utf8')) as { compilerOptions?: { paths?: Record<string, string[]> } }).compilerOptions?.paths ?? {};
  } catch {
    return {};
  }
})();

function candidates(base: string): string[] {
  return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
}

function makeResolver(known: Set<string>) {
  return (fromFile: string, specifier: string): string | undefined => {
    const bases: string[] = [];
    if (specifier.startsWith('.')) bases.push(path.resolve(path.dirname(fromFile), specifier));
    for (const [pattern, targets] of Object.entries(tsconfigPaths)) {
      const star = pattern.endsWith('*') ? pattern.slice(0, -1) : null;
      if (star !== null ? specifier.startsWith(star) : specifier === pattern) {
        const rest = star !== null ? specifier.slice(star.length) : '';
        for (const target of targets) bases.push(path.resolve(root, target.replace('*', rest)));
      }
    }
    for (const base of bases) for (const file of candidates(base)) if (known.has(file)) return file;
    return undefined;
  };
}

// ── Сборка ──────────────────────────────────────────────────────────────────

function writeIfChanged(file: string, content: string): boolean {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function build(): boolean {
  const started = performance.now();
  const sources = readSources();
  const rules = extractUtilityRules(sources, { ...config, resolveModule: makeResolver(new Set(sources.map((s) => s.file))) });

  const unique = new Map<string, UtilityRule>();
  const collisions: string[] = [];
  for (const rule of rules) {
    const existing = unique.get(rule.className);
    if (existing && normalizeCss(existing.declaration) !== normalizeCss(rule.declaration)) collisions.push(`${rule.className}: «${existing.declaration}» ≠ «${rule.declaration}»`);
    else unique.set(rule.className, rule);
  }

  if (collisions.length) {
    console.error(`[ui:utilities] ✗ разные значения дали одно имя класса (${collisions.length}):`);
    for (const line of collisions.slice(0, 20)) console.error(`    ${line}`);
    return false;
  }

  // Модуль поля печатает `.height_#{$t}`: имя класса выдерживает только целое неотрицательное число.
  const isFieldHeight = (entry: unknown): entry is number => typeof entry === 'number' && Number.isInteger(entry) && entry >= 0;
  const heights = [...new Set([...unique.values()].filter((r) => r.utility.name === 'h').map((r) => r.entry).filter(isFieldHeight))].sort((a, b) => a - b);

  const css = `${BANNER}\n${renderRules([...unique.values()])}\n`;
  const fields = `${BANNER}\n$height-values: (${heights.join(', ')}) !default;\n`;
  const changed = [writeIfChanged(OUT_CSS, css), writeIfChanged(OUT_FIELDS, fields)].some(Boolean);

  const ms = Math.round(performance.now() - started);
  console.log(`[ui:utilities] ${changed ? '✓ обновлено' : 'без изменений'}: ${unique.size} классов, ${(Buffer.byteLength(css) / 1024).toFixed(1)} КБ за ${ms} мс`);
  return true;
}

function watch(): void {
  // Правка самого генератора или реестра подхватывается только новым процессом: выходим, а
  // tools/dev.mjs поднимает watch заново уже с новым кодом.
  for (const dir of OWN_SOURCES) {
    fs.watch(dir, { recursive: true }, (_event, file) => {
      if (!file || !/\.(ts|mjs)$/.test(String(file))) return;
      console.log('[ui:utilities] генератор изменился — перезапуск');
      process.exit(0);
    });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(build, 200);
  };
  for (const dir of config.scan) {
    const full = path.resolve(root, dir);
    fs.watch(full, { recursive: true }, (_event, file) => {
      if (!file) return;
      const changed = path.join(full, String(file));
      if (/\.tsx?$/.test(changed) && !SKIP.test(changed) && !isOwn(changed)) schedule();
    });
  }
  build();
}

async function main(): Promise<void> {
  if (!configArg) {
    console.error('[ui:utilities] нужен --config <файл конфига проекта>');
    process.exit(1);
  }
  config = ((await import(pathToFileURL(path.resolve(root, configArg)).href)) as { default: UtilitiesConfig }).default;
  if (command === 'watch') watch();
  else process.exit(build() ? 0 : 1);
}

void main();
