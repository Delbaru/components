/**
 * Роли типографики форматированного текста.
 *
 * Семантический ТЕГ блока (`h2`, `p` — для DOM, SEO и скринридера) развязан с его
 * визуальной РОЛЬЮ — каким токеном шрифта блок выглядит. В макете заголовок бывает тегом
 * `h2`, а шрифтом — `h3`, и на мобилке вообще абзацем. Роль лежит на самом блоке в данных
 * (узлы `rich-paragraph` / `rich-heading` редактора CMS) и вешается классом при рендере.
 *
 * Словарь ОДИН на редактор и на рендер: роль, которой рендер не знает, редактор показывать
 * не должен, иначе человек выберет стиль, а на сайте его не будет.
 */
export const RICH_ROLES = ['h1', 'h2', 'h3', 'title', 'subtitle', 'p', 'small', 'dop'] as const;

export type RichRole = (typeof RICH_ROLES)[number];

/** Семантические теги блока. */
export type RichTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';

const TAG_DEFAULT_ROLE: Record<RichTag, RichRole> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'title',
  h5: 'subtitle',
  h6: 'small',
  p: 'p',
};

/**
 * Роль, которой тег выглядит сам по себе. Нужна РЕДАКТОРУ — показать, какой стиль у блока
 * без явной роли. Рендер её не подставляет: без роли блок красит вариант текста.
 */
export function tagDefaultRole(tag: RichTag): RichRole {
  return TAG_DEFAULT_ROLE[tag];
}

export function isRichRole(value: unknown): value is RichRole {
  return typeof value === 'string' && (RICH_ROLES as readonly string[]).includes(value);
}

/**
 * Ключи классов роли для блока — ТОЛЬКО то, что задано в данных.
 *
 * Блок без роли не получает класса вовсе, и это главное: его шрифт решает вариант текста
 * (`default`, `style-1`…), как решал до появления ролей. Подставь рендер роль «по тегу» —
 * и каждый абзац на сайте получил бы `--font-p`, перебив вариант, который проект выбрал
 * для этого блока.
 *
 * Мусор в данных молча пропускается: рендер не падает на роли, которой нет в словаре.
 */
export function roleClassKeys(role?: unknown, roleM?: unknown, roleT?: unknown): string[] {
  const keys: string[] = [];
  if (isRichRole(role)) keys.push(`role-${role}`);
  if (isRichRole(roleM)) keys.push(`role-m-${roleM}`);
  if (isRichRole(roleT)) keys.push(`role-t-${roleT}`);
  return keys;
}
