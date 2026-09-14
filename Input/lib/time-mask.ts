/**
 * Маска времени HH:MM в 24-часовом формате.
 *
 * Input.tsx хранит только состояние и JSX,
 * а нормализация и валидация изолированы здесь.
 */

const DEFAULT_PLACEHOLDER = '00:00';
const DEFAULT_ERROR = 'Введите время в формате 00:00';
const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MASK_TEMPLATE = '__:__';

function normalizeDigits(raw: string): string[] {
  const sourceDigits = raw.replace(/\D/g, '').slice(0, 4);
  const normalizedDigits: string[] = [];

  for (const digit of sourceDigits) {
    const position = normalizedDigits.length;

    if (position === 0) {
      if (digit > '2') {
        normalizedDigits.push('0');
        if (normalizedDigits.length < 4) normalizedDigits.push(digit);
        continue;
      }

      normalizedDigits.push(digit);
      continue;
    }

    if (position === 1) {
      if (normalizedDigits[0] === '2' && digit > '3') continue;
      normalizedDigits.push(digit);
      continue;
    }

    if (position === 2) {
      if (digit > '5') continue;
      normalizedDigits.push(digit);
      continue;
    }

    normalizedDigits.push(digit);
    if (normalizedDigits.length === 4) break;
  }

  return normalizedDigits;
}

function formatDigits(digits: string[]): string {
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits.join('');

  return `${digits.slice(0, 2).join('')}:${digits.slice(2).join('')}`;
}

export const normalize = (raw: string): string =>
  formatDigits(normalizeDigits(raw));

export const validate = (raw: string): string | undefined => {
  const value = normalize(raw);
  if (value && !TIME_REGEX.test(value)) return DEFAULT_ERROR;
  return undefined;
};

export const getMaskDisplay = (raw: string): string => {
  const value = normalize(raw);
  let pointer = 0;

  return Array.from(MASK_TEMPLATE, (templateChar) => {
    const nextValueChar = value[pointer];

    if (templateChar === ':') {
      if (nextValueChar === ':') pointer += 1;
      return templateChar;
    }

    if (nextValueChar && nextValueChar !== ':') {
      pointer += 1;
      return nextValueChar;
    }

    return templateChar;
  }).join('');
};

export const getMaskSuffix = (raw: string): string => {
  const value = normalize(raw);
  return getMaskDisplay(value).slice(value.length);
};

export const placeholder = DEFAULT_PLACEHOLDER;
export const maxLength = 5;