#!/usr/bin/env node
// Красные линии дизайн-системы как проверка с храповиком: сколько нарушений в каждом файле
// сейчас — записано в планку, и сборка падает, только если где-то их стало БОЛЬШЕ. Старое
// не ломает сборку, новое не проходит; починил — `--update` опускает планку.
//
//   node <UI>/tools/check-rules.mjs --baseline <file.json> [--update] <папки проекта…>
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'generated', 'public', 'UI']);
const GRID_PROPS = 'w|h|minW|maxW|minH|maxH|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|r';

export const RULES = {
  'raw-button': { ext: /\.tsx$/, test: (line) => /<button[\s>]/.test(line), hint: 'SharedButton*' },
  'raw-input': { ext: /\.tsx$/, test: (line) => /<input[\s/>]/.test(line), hint: 'SharedInput / SharedCheckbox / SharedRadio' },
  'raw-anchor': { ext: /\.tsx$/, test: (line) => /<a[\s>]/.test(line), hint: "Text as='a' или Button href" },
  'inline-svg': { ext: /\.tsx$/, test: (line) => /<svg[\s>]/.test(line), hint: 'файл в public/icons + Icon' },
  'unanimated-conditional': { ext: /\.tsx$/, test: (line) => /(&&|\?)\s*\($/.test(line.trimEnd()), hint: 'collapse / transitionKey' },
  'off-grid-number': {
    ext: /\.tsx$/,
    // Одно место — одно нарушение: полный кортеж `[6, 6, 6]` — это одно число, а не три.
    count: (line) => [...line.matchAll(new RegExp(`\\b(?:${GRID_PROPS})=\\{(\\[[^\\]]*\\]|-?\\d+)\\}`, 'g'))]
      .reduce((total, m) => total + new Set((m[1].replace(/'[^']*'|"[^"]*"/g, '').match(/-?\d+/g) ?? []).filter((n) => Math.abs(Number(n)) % 4 !== 0)).size, 0),
    hint: 'размер кратный 4',
  },
  'raw-transition': {
    ext: /\.scss$/,
    test: (line) => /transition[\w-]*\s*:/.test(line) && /\b\d*\.?\d+m?s\b/.test(line) && !line.includes('var(--t'),
    hint: 'var(--t-fast|--t-normal|--t-slow)',
  },
  'media-query': { ext: /\.scss$/, test: (line) => /@media\b/.test(line), hint: 'кортеж пропа или data-hide-*' },
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(abs, out);
    } else if (/\.(tsx|scss)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

export function countViolations(dirs) {
  const counts = {};
  const places = {};
  for (const rule of Object.keys(RULES)) {
    counts[rule] = {};
    places[rule] = {};
  }
  for (const file of dirs.flatMap((dir) => walk(path.resolve(dir)))) {
    const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const [rule, def] of Object.entries(RULES)) {
      if (!def.ext.test(file)) continue;
      lines.forEach((line, index) => {
        if (isComment(line)) return;
        const n = def.count ? def.count(line) : def.test(line) ? 1 : 0;
        if (!n) return;
        counts[rule][rel] = (counts[rule][rel] ?? 0) + n;
        (places[rule][rel] ??= []).push(index + 1);
      });
    }
  }
  return { counts, places };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('tools', 'check-rules.mjs'));

if (isMain) {
  const args = process.argv.slice(2);
  const baselineFile = args[args.indexOf('--baseline') + 1];
  const update = args.includes('--update');
  const dirs = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--baseline');
  if (!baselineFile || !dirs.length) {
    console.error('Usage: node check-rules.mjs --baseline <file.json> [--update] <dirs…>');
    process.exit(1);
  }

  const { counts, places } = countViolations(dirs);
  const total = (rule, data) => Object.values(data[rule] ?? {}).reduce((a, b) => a + b, 0);

  if (update || !fs.existsSync(baselineFile)) {
    fs.writeFileSync(baselineFile, `${JSON.stringify(counts, null, 2)}\n`);
    const summary = Object.keys(RULES).map((rule) => `${rule} ${total(rule, counts)}`).join(', ');
    console.log(`[ui:rules] планка записана: ${summary}`);
    process.exit(0);
  }

  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  let grew = 0;
  for (const [rule, def] of Object.entries(RULES)) {
    for (const [file, n] of Object.entries(counts[rule])) {
      const allowed = baseline[rule]?.[file] ?? 0;
      if (n > allowed) {
        grew += n - allowed;
        console.error(`[ui:rules] ✗ ${rule}: ${file} — было ${allowed}, стало ${n} (строки ${places[rule][file].join(', ')}) → ${def.hint}`);
      }
    }
  }
  const lowered = Object.keys(RULES).filter((rule) => total(rule, counts) < total(rule, baseline));
  const summary = Object.keys(RULES).map((rule) => `${rule} ${total(rule, counts)}`).join(', ');
  if (grew) {
    console.error(`[ui:rules] ✗ новых нарушений красных линий: ${grew}`);
    process.exit(1);
  }
  console.log(`[ui:rules] ✓ новых нарушений нет (${summary})` + (lowered.length ? `; планку можно опустить: ${lowered.join(', ')} → --update` : ''));
}
