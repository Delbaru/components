// Слой дизайн-токенов теперь ГЛОБАЛЬНЫЙ: tokens.module.scss эмитит классы под `:global`, поэтому
// CSS-Modules их не хеширует и имя класса в DOM совпадает с ключом (d_gap_16, width_p_100 и т.д.).
//
// Раньше здесь был default-экспорт CSS-модуля (карта ключ→хешированное-имя). Теперь локальных
// классов у модуля нет, поэтому его default пуст — вместо него отдаём identity-прокси: любой
// строковый ключ возвращается как есть. Это ровно то, что нужно `css(styles, key)` в responsive-classes:
// css(tokenStyles, 'd_gap_16') === 'd_gap_16' → класс совпадает с глобальным селектором из SCSS.
//
// Сам CSS токенов подключается глобально через styles/globals.scss (@use '../UI/core/tokens.global.scss'),
// поэтому здесь НЕ импортируем scss — только отдаём прокси имён классов.
export const tokenStyles: Record<string, string> = new Proxy(
  {},
  {
    get: (_target, key) => (typeof key === 'string' ? key : undefined),
  }
) as Record<string, string>;
