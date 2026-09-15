/**
 * Сборщик значений утилит: разбирает исходники компилятором TypeScript (только синтаксис, без
 * проверки типов) и находит, какие значения каких пропов реально встречаются в коде.
 *
 * Что он видит:
 *   • литерал в пропе: `gap={[8, 0, 0]}`, `bg='var(--primary)'`, условие `a ? 8 : 16`;
 *   • константу и её поле: `w={[PANEL_WIDTH, null, null]}`, `w={COLUMNS.group}`, импорт из соседнего файла;
 *   • арифметику на литералах: `PANEL / 2`, `JOINT + 32`;
 *   • проброс пропа компонентом: `Checkbox` отдаёт свой `size` в `w`/`h` своего `Flex` — значит
 *     `<Checkbox size={20}>` рождает `w_20`/`h_20` без ручных списков алиасов;
 *   • поле объекта с именем утилиты (`{ p: [16, 32] }` в конфигах и пресетах).
 *
 * Значение, которое сразу уходит в проп как есть, даёт РОВНО те классы, что выдаст рантайм. Значение
 * без известного брейкпоинта (поле конфига, проброс с преобразованием) — базу и все брейкпоинты.
 */

import ts from 'typescript';

import { entryKey, type UtilityEntry } from '../../core/utilities/keys';
import { resolveUtility, type Utility } from '../../core/utilities/registry';
import { domainRules, exactRules, looseRules, type UtilityRule } from '../../core/utilities/rules';
import type { ResponsiveUtilityValue } from '../../core/utilities/classes';

export interface Source {
  readonly file: string;
  readonly text: string;
}

export interface ExtractOptions {
  /** Значения из словарей, которые на вызовах пишутся ИМЕНЕМ (`radius='md'`): `{ r: [8, 12, 16] }`. */
  readonly seeds?: Readonly<Record<string, readonly UtilityEntry[]>>;
  /** Путь модуля импорта → файл (относительные пути и алиасы проекта). */
  readonly resolveModule?: (fromFile: string, specifier: string) => string | undefined;
}

// ── Значения ────────────────────────────────────────────────────────────────

const UNKNOWN = Symbol('unknown');
type Value = number | string | null | undefined | typeof UNKNOWN | ObjectRef | Value[];
interface ObjectRef {
  readonly object: ts.ObjectLiteralExpression;
  readonly facts: FileFacts;
}

const MAX_VARIANTS = 32;
const MAX_DEPTH = 8;
/** Ключ данных с бо́льшим набором значений — не токен дизайна, а данные (`width` картинки, `id`): не берём. */
const DATA_KEY_LIMIT = 16;

const isObjectRef = (value: Value): value is ObjectRef => typeof value === 'object' && value !== null && !Array.isArray(value);

function product(lists: Value[][]): Value[][] {
  let out: Value[][] = [[]];
  for (const list of lists) {
    const next: Value[][] = [];
    for (const prefix of out) for (const item of list) if (next.length < MAX_VARIANTS) next.push([...prefix, item]);
    out = next;
  }
  return out;
}

// ── Факты файла ─────────────────────────────────────────────────────────────

interface Forward {
  readonly param: string;
  /** Проп тега (`tag` задан) или утилита объекта/построителя (`tag === null`). */
  readonly to: string;
  readonly tag: string | null;
  readonly direct: boolean;
}

interface Usage {
  readonly tag: string | null;
  readonly prop: string;
  readonly expr: ts.Expression;
  readonly facts: FileFacts;
}

interface FileFacts {
  readonly file: string;
  readonly sf: ts.SourceFile;
  readonly consts: Map<string, ts.Expression[]>;
  readonly imports: Map<string, { readonly specifier: string; readonly name: string }>;
  readonly reexports: { readonly specifier: string; readonly names: Set<string> | null }[];
  readonly components: Map<string, Forward[]>;
  readonly usages: Usage[];
  /** Ключ данных → куда он уходит: `fontSize={item.valueFontSize}` даёт `valueFontSize` → проп `fontSize` у `Text`. */
  readonly dataKeys: { readonly key: string; readonly tag: string | null; readonly prop: string }[];
}

const isComponentName = (name: string) => /^[A-Z]/.test(name);

function unwrap(expr: ts.Expression): ts.Expression {
  let node = expr;
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

function propName(name: ts.PropertyName | ts.JsxAttributeName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isJsxNamespacedName(name)) return undefined;
  return undefined;
}

function tagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

/** Функция компонента: объявление, стрелка, `forwardRef(function …)`, `memo(…)`. */
function componentFunction(expr: ts.Expression | undefined): ts.FunctionLikeDeclaration | undefined {
  if (!expr) return undefined;
  const node = unwrap(expr);
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return node;
  if (ts.isCallExpression(node)) return componentFunction(node.arguments[0]);
  return undefined;
}

/** Параметр-объект компонента: локальное имя → имя пропа. */
function paramBindings(fn: ts.SignatureDeclaration): Map<string, string> {
  const bindings = new Map<string, string>();
  const first = fn.parameters[0];
  if (!first || !ts.isObjectBindingPattern(first.name)) return bindings;
  for (const element of first.name.elements) {
    if (element.dotDotDotToken || !ts.isIdentifier(element.name)) continue;
    const prop = element.propertyName ? propName(element.propertyName) : element.name.text;
    if (prop) bindings.set(element.name.text, prop);
  }
  return bindings;
}

function collectFacts(source: Source): FileFacts {
  const kind = source.file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(source.file, source.text, ts.ScriptTarget.Latest, true, kind);
  const facts: FileFacts = { file: source.file, sf, consts: new Map(), imports: new Map(), reexports: [], components: new Map(), usages: [], dataKeys: [] };

  const visit = (node: ts.Node, jsxTag: string | null) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const list = facts.consts.get(node.name.text) ?? [];
      list.push(node.initializer);
      facts.consts.set(node.name.text, list);
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const element of node.importClause.namedBindings.elements) {
        facts.imports.set(element.name.text, { specifier: node.moduleSpecifier.text, name: (element.propertyName ?? element.name).text });
      }
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const names = node.exportClause && ts.isNamedExports(node.exportClause) ? new Set(node.exportClause.elements.map((e) => e.name.text)) : null;
      facts.reexports.push({ specifier: node.moduleSpecifier.text, names });
    }

    if (ts.isJsxAttribute(node)) {
      const prop = propName(node.name);
      const init = node.initializer;
      const expr = init && ts.isJsxExpression(init) ? init.expression : init && ts.isStringLiteral(init) ? init : undefined;
      if (prop && expr) facts.usages.push({ tag: jsxTag, prop, expr, facts });
    }

    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
      const prop = propName(node.name);
      if (prop) facts.usages.push({ tag: null, prop, expr: node.initializer, facts });
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === BUILDER_METHOD) {
      const [prefix, value] = node.arguments;
      const utility = prefix && ts.isStringLiteral(prefix) ? resolveUtility(prefix.text) : undefined;
      if (utility && value) facts.usages.push({ tag: BUILDER_TAG, prop: utility.name, expr: value, facts });
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      node.attributes.forEachChild((child) => visit(child, tag));
      return;
    }

    ts.forEachChild(node, (child) => visit(child, jsxTag));
  };

  visit(sf, null);
  collectDataKeys(facts);
  collectComponents(facts);
  return facts;
}

/** Вызов построителя классов (`c.value('gap', 8)`): значение уходит в утилиту как есть. */
const BUILDER_TAG = '#builder';

/**
 * Ключи данных в значении пропа утилиты: поле объекта (`x.valueFontSize`, `x['gap']`) и разобранное
 * имя (`({ valueFontSize }) =>`). Такой ключ в ЛЮБОМ объекте проекта отдаёт свои значения той же утилите.
 */
function collectDataKeys(facts: FileFacts): void {
  const bindings = new Map<string, string>();
  const scan = (node: ts.Node) => {
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && !node.dotDotDotToken) {
      const key = node.propertyName ? propName(node.propertyName) : node.name.text;
      if (key) bindings.set(node.name.text, key);
    }
    ts.forEachChild(node, scan);
  };
  scan(facts.sf);

  // Только ИСТОЧНИК значения: последнее поле цепочки и ветки условия, а не аргументы вызовов и не
  // промежуточные поля пути (`s.axes.gap` даёт `gap`, но не `axes`).
  const sourceKeys = (expr: ts.Expression, keys: Set<string>): void => {
    const node = unwrap(expr);
    if (ts.isPropertyAccessExpression(node)) keys.add(node.name.text);
    else if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) keys.add(node.argumentExpression.text);
    else if (ts.isIdentifier(node)) {
      const key = bindings.get(node.text);
      if (key) keys.add(key);
    } else if (ts.isConditionalExpression(node)) {
      sourceKeys(node.whenTrue, keys);
      sourceKeys(node.whenFalse, keys);
    } else if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
      sourceKeys(node.left, keys);
      sourceKeys(node.right, keys);
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) if (!ts.isSpreadElement(element)) sourceKeys(element, keys);
    }
  };

  for (const usage of facts.usages) {
    if (usage.tag === null && !resolveUtility(usage.prop)) continue;
    const keys = new Set<string>();
    sourceKeys(usage.expr, keys);
    keys.delete('length');
    for (const key of keys) facts.dataKeys.push({ key, tag: usage.tag, prop: usage.prop });
  }
}

// ── Проброс пропов компонентом ──────────────────────────────────────────────

const BUILDER_METHOD = 'value';

function collectComponents(facts: FileFacts): void {
  const register = (name: string, fn: ts.FunctionLikeDeclaration) => {
    const params = paramBindings(fn);
    if (!params.size || !fn.body) return;
    const forwards = facts.components.get(name) ?? [];
    facts.components.set(name, forwards);

    const localConsts = new Map<string, ts.Expression>();
    const scan = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) localConsts.set(node.name.text, node.initializer);
      ts.forEachChild(node, scan);
    };
    scan(fn.body);

    const refs = (expr: ts.Expression, target: string): Set<string> => {
      const found = new Set<string>();
      const seen = new Set<ts.Node>();
      const walk = (node: ts.Node, depth: number): void => {
        if (depth > MAX_DEPTH || seen.has(node)) return;
        seen.add(node);
        if (ts.isPropertyAccessExpression(node)) {
          const base = unwrap(node.expression);
          const init = ts.isIdentifier(base) ? localConsts.get(base.text) : undefined;
          const object = init ? unwrap(init) : undefined;
          if (object && ts.isObjectLiteralExpression(object)) {
            const property = object.properties.find((p) => p.name && propName(p.name) === node.name.text);
            if (property && ts.isPropertyAssignment(property)) walk(property.initializer, depth + 1);
            else if (property && ts.isShorthandPropertyAssignment(property)) walk(property.name, depth + 1);
            return;
          }
          walk(node.expression, depth + 1);
          return;
        }
        if (ts.isIdentifier(node)) {
          const param = params.get(node.text);
          if (param) found.add(param);
          const init = localConsts.get(node.text);
          if (!init) return;
          // Результат вызова непрозрачен: из его аргументов берём только одноимённый проп.
          if (ts.isCallExpression(unwrap(init))) {
            for (const [local, prop] of params) if (prop === target && local) found.add(prop);
            return;
          }
          walk(init, depth + 1);
          return;
        }
        ts.forEachChild(node, (child) => walk(child, depth + 1));
      };
      walk(expr, 0);
      return found;
    };

    const isDirect = (expr: ts.Expression): string | null => {
      const node = unwrap(expr);
      if (ts.isIdentifier(node)) return params.get(node.text) ?? null;
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return isDirect(node.left);
      return null;
    };

    const add = (expr: ts.Expression, to: string, tag: string | null) => {
      const direct = isDirect(expr);
      for (const param of refs(expr, to)) forwards.push({ param, to, tag, direct: direct === param });
    };

    const walkBody = (node: ts.Node, jsxTag: string | null): void => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = tagName(node);
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          const prop = propName(attr.name);
          const init = attr.initializer;
          if (prop && init && ts.isJsxExpression(init) && init.expression) add(init.expression, prop, tag);
        }
      } else if (ts.isPropertyAssignment(node)) {
        const prop = propName(node.name);
        if (prop) add(node.initializer, prop, null);
      } else if (ts.isShorthandPropertyAssignment(node)) {
        add(node.name, node.name.text, null);
      } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === BUILDER_METHOD) {
        const [prefix, value] = node.arguments;
        const utility = prefix && ts.isStringLiteral(prefix) ? resolveUtility(prefix.text) : undefined;
        if (utility && value) add(value, utility.name, null);
      }
      ts.forEachChild(node, (child) => walkBody(child, jsxTag));
    };
    walkBody(fn.body, null);
  };

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && isComponentName(node.name.text)) register(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isComponentName(node.name.text)) {
      const fn = componentFunction(node.initializer);
      if (fn) register(node.name.text, fn);
    }
    ts.forEachChild(node, visit);
  };
  visit(facts.sf);
}

// ── Вычисление выражений ────────────────────────────────────────────────────

class Evaluator {
  private readonly byFile = new Map<string, FileFacts>();

  constructor(files: readonly FileFacts[], private readonly resolveModule?: ExtractOptions['resolveModule']) {
    for (const facts of files) this.byFile.set(facts.file, facts);
  }

  evaluate(expr: ts.Expression, facts: FileFacts, depth = 0, seen = new Set<ts.Node>()): Value[] {
    if (depth > MAX_DEPTH || seen.has(expr)) return [UNKNOWN];
    const node = unwrap(expr);
    const next = new Set(seen).add(expr);
    const again = (child: ts.Expression, at = facts) => this.evaluate(child, at, depth + 1, next);

    if (ts.isNumericLiteral(node)) return [Number(node.text)];
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (ts.isTemplateExpression(node)) {
      let parts: Value[] = [node.head.text];
      for (const span of node.templateSpans) {
        parts = product([parts, again(span.expression)]).map(([head, part]) =>
          typeof head === 'string' && (typeof part === 'string' || typeof part === 'number') ? `${head}${part}${span.literal.text}` : UNKNOWN,
        );
      }
      return parts.slice(0, MAX_VARIANTS);
    }
    if (node.kind === ts.SyntaxKind.NullKeyword) return [null];
    if (ts.isIdentifier(node) && node.text === 'undefined') return [undefined];
    if (ts.isPrefixUnaryExpression(node) && (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)) {
      return again(node.operand).map((v) => (typeof v === 'number' ? (node.operator === ts.SyntaxKind.MinusToken ? -v : v) : UNKNOWN));
    }
    if (ts.isArrayLiteralExpression(node)) {
      const lists: Value[][] = node.elements.map((element) => (ts.isSpreadElement(element) ? [UNKNOWN] : again(element)));
      return product(lists);
    }
    if (ts.isObjectLiteralExpression(node)) return [{ object: node, facts }];
    if (ts.isConditionalExpression(node)) return [...again(node.whenTrue), ...again(node.whenFalse)].slice(0, MAX_VARIANTS);
    if (ts.isBinaryExpression(node)) return this.binary(node, again);
    if (ts.isIdentifier(node)) return this.identifier(node.text, facts, depth, next);
    if (ts.isPropertyAccessExpression(node)) return this.member(again(node.expression), node.name.text, depth, next);
    if (ts.isElementAccessExpression(node)) {
      const keys = again(node.argumentExpression);
      const objects = again(node.expression);
      if (keys.every((k) => typeof k === 'string' || typeof k === 'number')) return keys.flatMap((k) => this.member(objects, String(k), depth, next));
      return objects.flatMap((o) => (isObjectRef(o) ? this.allMembers(o, depth, next) : [UNKNOWN]));
    }
    return [UNKNOWN];
  }

  private binary(node: ts.BinaryExpression, again: (e: ts.Expression) => Value[]): Value[] {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) return [...again(node.left), ...again(node.right)].slice(0, MAX_VARIANTS);
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return again(node.right);
    const math: Partial<Record<ts.SyntaxKind, (a: number, b: number) => number>> = {
      [ts.SyntaxKind.PlusToken]: (a, b) => a + b,
      [ts.SyntaxKind.MinusToken]: (a, b) => a - b,
      [ts.SyntaxKind.AsteriskToken]: (a, b) => a * b,
      [ts.SyntaxKind.SlashToken]: (a, b) => a / b,
    };
    const fn = math[op];
    if (!fn) return [UNKNOWN];
    return product([again(node.left), again(node.right)]).map(([a, b]) => {
      if (typeof a === 'number' && typeof b === 'number') return fn(a, b);
      if (op === ts.SyntaxKind.PlusToken && typeof a === 'string' && typeof b === 'string') return a + b;
      return UNKNOWN;
    });
  }

  private identifier(name: string, facts: FileFacts, depth: number, seen: Set<ts.Node>): Value[] {
    const local = facts.consts.get(name);
    if (local) return local.flatMap((init) => this.evaluate(init, facts, depth + 1, seen)).slice(0, MAX_VARIANTS);
    const imported = facts.imports.get(name);
    if (imported) {
      const target = this.exportedConst(facts.file, imported.specifier, imported.name, 0);
      if (target) return target.inits.flatMap((init) => this.evaluate(init, target.facts, depth + 1, seen)).slice(0, MAX_VARIANTS);
    }
    return [UNKNOWN];
  }

  private exportedConst(fromFile: string, specifier: string, name: string, hops: number): { facts: FileFacts; inits: ts.Expression[] } | undefined {
    if (hops > 4) return undefined;
    const file = this.resolveModule?.(fromFile, specifier);
    const facts = file ? this.byFile.get(file) : undefined;
    if (!facts) return undefined;
    const inits = facts.consts.get(name);
    if (inits) return { facts, inits };
    for (const reexport of facts.reexports) {
      if (reexport.names && !reexport.names.has(name)) continue;
      const found = this.exportedConst(facts.file, reexport.specifier, name, hops + 1);
      if (found) return found;
    }
    return undefined;
  }

  private member(objects: Value[], name: string, depth: number, seen: Set<ts.Node>): Value[] {
    return objects.flatMap((object) => {
      if (!isObjectRef(object)) return [UNKNOWN];
      const property = object.object.properties.find((p) => p.name && propName(p.name) === name);
      if (property && ts.isPropertyAssignment(property)) return this.evaluate(property.initializer, object.facts, depth + 1, seen);
      if (property && ts.isShorthandPropertyAssignment(property)) return this.identifier(property.name.text, object.facts, depth + 1, seen);
      return [UNKNOWN];
    });
  }

  private allMembers(object: ObjectRef, depth: number, seen: Set<ts.Node>): Value[] {
    return object.object.properties.flatMap((p) => (ts.isPropertyAssignment(p) ? this.evaluate(p.initializer, object.facts, depth + 1, seen) : [UNKNOWN]));
  }
}

// ── Сборка правил ───────────────────────────────────────────────────────────

const hasUnknown = (value: Value): boolean => value === UNKNOWN || isObjectRef(value) || (Array.isArray(value) && value.some(hasUnknown));

const isEntry = (value: Value): value is number | string => typeof value === 'number' || typeof value === 'string';

/**
 * Значения без брейкпоинта: скаляры и шорткаты кортежа по отдельности. Плоский массив у отступа
 * в поле конфига неоднозначен (`p: [16, 32]` — кортеж брейкпоинтов или «вертикаль, горизонталь»),
 * поэтому печатаются оба прочтения.
 */
function looseEntries(utility: Utility, value: Value): UtilityEntry[] {
  if (isEntry(value)) return [value];
  if (!Array.isArray(value)) return [];
  const flat = value.every(isEntry);
  if (utility.shorthand && flat && value.length === 4) return [value as UtilityEntry];
  const shorthand = utility.shorthand && flat && value.length >= 2 ? [value as UtilityEntry] : [];
  return [
    ...shorthand,
    ...value.flatMap((item) => {
      if (isEntry(item)) return [item];
      if (Array.isArray(item) && utility.shorthand && item.every(isEntry)) return [item as UtilityEntry];
      return [];
    }),
  ];
}

interface Target {
  readonly utility: Utility;
  readonly direct: boolean;
}

export function extractUtilityRules(sources: readonly Source[], options: ExtractOptions = {}): UtilityRule[] {
  const files = sources.map(collectFacts);
  const evaluator = new Evaluator(files, options.resolveModule);

  const components = new Map<string, Forward[]>();
  for (const facts of files) {
    for (const [name, forwards] of facts.components) components.set(name, [...(components.get(name) ?? []), ...forwards]);
  }

  const memo = new Map<string, Target[]>();
  const targetsOf = (tag: string | null, prop: string, depth = 0): Target[] => {
    const key = `${tag ?? ''} ${prop}`;
    const cached = memo.get(key);
    if (cached) return cached;
    memo.set(key, []);
    // Строчный тег — элемент DOM или SVG (`div`, `rect`, `motion.div`): классов утилит он не получает.
    if (tag && /^[a-z]/.test(tag)) return [];

    const forwards = tag ? (components.get(tag) ?? []).filter((f) => f.param === prop) : [];
    const out: Target[] = [];
    if (forwards.length && depth < MAX_DEPTH) {
      for (const forward of forwards) {
        if (forward.tag === null) {
          const utility = resolveUtility(forward.to);
          if (utility) out.push({ utility, direct: forward.direct });
          continue;
        }
        for (const inner of targetsOf(forward.tag, forward.to, depth + 1)) out.push({ utility: inner.utility, direct: forward.direct && inner.direct });
      }
    } else {
      const utility = resolveUtility(prop);
      if (utility) out.push({ utility, direct: true });
    }

    memo.set(key, out);
    return out;
  };

  const dataKeys = new Map<string, { readonly tag: string | null; readonly prop: string }[]>();
  for (const facts of files) for (const item of facts.dataKeys) dataKeys.set(item.key, [...(dataKeys.get(item.key) ?? []), item]);
  const dataMemo = new Map<string, Target[]>();
  const dataTargets = (key: string): Target[] => {
    const cached = dataMemo.get(key);
    if (cached) return cached;
    const out = (dataKeys.get(key) ?? []).flatMap(({ tag, prop }) => {
      const utility = resolveUtility(prop);
      const targets = tag === null ? (utility ? [{ utility, direct: false }] : []) : targetsOf(tag, prop);
      return targets.map((target) => ({ utility: target.utility, direct: false }));
    });
    dataMemo.set(key, out);
    return out;
  };

  const rules: UtilityRule[] = [...domainRules()];
  const dataEntries = new Map<string, { readonly utility: Utility; readonly entries: Map<string, UtilityEntry> }>();

  for (const facts of files) {
    for (const usage of facts.usages) {
      const own = usage.tag === null ? resolveUtility(usage.prop) : undefined;
      const targets = usage.tag === null ? (own ? [{ utility: own, direct: false }] : []) : targetsOf(usage.tag, usage.prop);
      const live = targets.filter((t) => !t.utility.domain);
      const viaData = usage.tag === null ? dataTargets(usage.prop).filter((t) => !t.utility.domain) : [];
      if (!live.length && !viaData.length) continue;

      const values = evaluator.evaluate(usage.expr, facts);

      for (const { utility, direct } of live) {
        for (const value of values) {
          if (value === UNKNOWN || value === undefined || value === null || isObjectRef(value)) continue;
          if (direct && !hasUnknown(value)) rules.push(...exactRules(utility, value as ResponsiveUtilityValue));
          else for (const entry of looseEntries(utility, value)) rules.push(...looseRules(utility, entry));
        }
      }

      for (const { utility } of viaData) {
        const id = `${usage.prop} ${utility.name}`;
        const group = dataEntries.get(id) ?? { utility, entries: new Map<string, UtilityEntry>() };
        dataEntries.set(id, group);
        for (const value of values) {
          if (value === UNKNOWN || value === undefined || value === null || isObjectRef(value)) continue;
          for (const entry of looseEntries(utility, value)) if (utility.declare(entry) !== null) group.entries.set(entryKey(entry), entry);
        }
      }
    }
  }

  for (const group of dataEntries.values()) {
    if (group.entries.size <= DATA_KEY_LIMIT) for (const entry of group.entries.values()) rules.push(...looseRules(group.utility, entry));
  }

  for (const [name, entries] of Object.entries(options.seeds ?? {})) {
    const utility = resolveUtility(name);
    if (!utility) continue;
    for (const entry of entries) rules.push(...looseRules(utility, entry));
  }

  return rules;
}
