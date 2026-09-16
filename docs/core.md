# Ядро: что уже написано

Прежде чем заводить помощник — проверь здесь. Копия любой из этих вещей внутри компонента
считается ошибкой ревью: расхождение копий и есть источник «на планшете поехало».

---

## Раскладка

| Что | Где | Зачем |
|---|---|---|
| `splitBoxLayout`, `boxLayout` | `core/layout/box.ts` | пропы коробки (отступы, размеры, радиусы, рамка, фон, `grow`) одинаково у любого корня |
| `resolveResponsive`, `getBreakpointIndex`, `resolveResponsiveAtBreakpoint` | `core/base/responsive.ts` | кортеж `[desktop, mobile, tablet]` → значения; `null` — пропуск |
| `ResponsiveInput<T>`, `ResponsiveValue<T>` | там же | вход помощников против типа пропа; строгий режим включает проект через `UiRules` |
| `createLayoutClasses`, `utilityClasses`, `MEDIA`, `UTILITIES` | `core/layout`, `core/utilities` | имя класса утилиты = имя пропа; реестр — единственный источник правды |

## Полосы и медиазапросы

`core/base/breakpoints.ts` — `BREAKPOINT` (числа) и `MEDIA_QUERY` (строки запросов: `desktop`,
`below`, `mobile`, `tablet`, `reducedMotion`). **Единственный источник.** Раньше те же 767/1023/1024
жили пятью копиями и расходились. В SCSS то же самое даёт `core/_mixins.scss`.

## Движение

`core/base/motion.ts`:

- `prefersReducedMotion()` — одна проверка на всю библиотеку;
- `readMotionMs(node, kind)` — длительность transition или animation из вычисленных стилей;
- `MOTION_END_BUFFER_MS` — единый запас страховочного таймера (раньше рядом стояли +40, +50, +60, +80).

## Текст и числа

`core/base/text-format.ts` — `pluralize(value, [one, few, many])` и `pad(value, length = 2)`.
`core/utils.ts` — `clamp` и `clamp01`. `core/base/cn.ts` — `cx` (склейка КЛАССОВ; состояния,
идентификаторы для `aria-*` и значения `transform` ею не склеивают).

## Хуки

| Хук | Что делает |
|---|---|
| `useMediaQuery(query)` | подписка на медиазапрос, безопасная на сервере |
| `useOutsideDismiss(refs, onDismiss, { enabled, escape })` | закрытие по клику вне и по Escape |
| `usePresence(show, axis, appear)` | монтирование и размонтирование с анимацией |
| `useSwapTransition(key, children)` | подмена контента: exit старого, затем enter нового |
| `useAnchoredFloating` | позиционирование панели относительно якоря |
| `useSharedMotion`, `useParallaxMotion`, `usePerspective3dMotion` | параллакс и наклон |
| `useTextOverflow`, `useTooltip`, `useFancybox`, `useInView`, `useMergedRefs` | по названию |

## SCSS

`core/_mixins.scss` — `reduced-motion`, `truncate`, `line-clamp($n)`, `fill`, `hidden-control`,
`thin-scrollbar-track`, `thin-scrollbar-hover`, `hide-scrollbar`.
`core/tokens.global.scss` — классы примитивов `ui-*` и подключение генерата по слоям.
`core/scss-utils.scss` — `withBreakpoints` (остальные миксины там вытеснены генератором утилит).

## Договор темы

`theme/tokens.default.scss` — стартовые значения всего, что библиотека берёт у проекта, с нулевой
специфичностью. Добавил в код `var(--новый-токен)` — добавь его и сюда, иначе у потребителя молча
пропадёт цвет или отступ. Проверка — `tools/check-tokens.mjs`.
