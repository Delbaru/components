// Объявления ассетов для самостоятельной проверки библиотеки (`tsconfig.json` рядом).
// В приложении их даёт сборщик; здесь — минимальный честный контракт.

declare module '*.module.scss' {
  const classes: { readonly [className: string]: string };
  export default classes;
}

declare module '*.svg' {
  const content: string | { src: string; width: number; height: number };
  export default content;
}
