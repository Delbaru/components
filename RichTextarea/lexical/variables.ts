import type { LexicalTextareaVariable } from '../types';

// Переменные шаблона в тексте: `@токен@` или `@Имя переменной` по границам слова, самый длинный — первым.

function normalizeVariableToken(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function createVariableLookup(variables: LexicalTextareaVariable[]): Map<string, LexicalTextareaVariable> {
  const lookup = new Map<string, LexicalTextareaVariable>();

  variables.forEach((variable) => {
    lookup.set(normalizeVariableToken(variable.key), variable);
    lookup.set(normalizeVariableToken(variable.label), variable);
    variable.aliases?.forEach((alias) => {
      lookup.set(normalizeVariableToken(alias), variable);
    });
  });

  return lookup;
}

type VariableTokenCandidate = {
  token: string;
  normalizedToken: string;
  variable: LexicalTextareaVariable;
};

type VariableTokenMatch = {
  startOffset: number;
  endOffset: number;
  variable: LexicalTextareaVariable;
};

const VARIABLE_TOKEN_BODY_REGEXP = /[\p{L}\p{N}_]/u;

function isVariableTokenBoundary(value: string | undefined): boolean {
  return !value || !VARIABLE_TOKEN_BODY_REGEXP.test(value);
}

function createVariableTokenCandidates(variableLookup: Map<string, LexicalTextareaVariable>): VariableTokenCandidate[] {
  const candidates = new Map<string, VariableTokenCandidate>();

  variableLookup.forEach((variable) => {
    [variable.label, variable.key, ...(variable.aliases ?? [])].forEach((token) => {
      const normalizedToken = normalizeVariableToken(token);

      if (!normalizedToken || candidates.has(normalizedToken)) {
        return;
      }

      candidates.set(normalizedToken, { token, normalizedToken, variable });
    });
  });

  return Array.from(candidates.values()).sort((current, next) => next.token.length - current.token.length);
}

function findVariableTokenMatchAt(
  textContent: string,
  startOffset: number,
  variableLookup: Map<string, LexicalTextareaVariable>,
  candidates: VariableTokenCandidate[]
): VariableTokenMatch | undefined {
  const pairedTokenMatch = /^@([^@\n]+)@/u.exec(textContent.slice(startOffset));

  const pairedToken = pairedTokenMatch?.[1];

  if (pairedTokenMatch && pairedToken !== undefined && pairedToken === pairedToken.trim()) {
    const variable = variableLookup.get(normalizeVariableToken(pairedToken));

    if (variable) {
      return {
        startOffset,
        endOffset: startOffset + pairedTokenMatch[0].length,
        variable,
      };
    }
  }

  if (!isVariableTokenBoundary(textContent[startOffset - 1])) {
    return undefined;
  }

  for (const candidate of candidates) {
    const tokenStartOffset = startOffset + 1;
    const tokenEndOffset = tokenStartOffset + candidate.token.length;

    if (tokenEndOffset > textContent.length || !isVariableTokenBoundary(textContent[tokenEndOffset])) {
      continue;
    }

    const token = textContent.slice(tokenStartOffset, tokenEndOffset);

    if (normalizeVariableToken(token) !== candidate.normalizedToken) {
      continue;
    }

    return {
      startOffset,
      endOffset: tokenEndOffset,
      variable: candidate.variable,
    };
  }

  return undefined;
}

export function findVariableTokenMatch(
  textContent: string,
  variableLookup: Map<string, LexicalTextareaVariable>,
  fromOffset = 0
): VariableTokenMatch | undefined {
  const candidates = createVariableTokenCandidates(variableLookup);

  for (let startOffset = textContent.indexOf('@', fromOffset); startOffset !== -1; startOffset = textContent.indexOf('@', startOffset + 1)) {
    const match = findVariableTokenMatchAt(textContent, startOffset, variableLookup, candidates);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function resolveVariableDefinition(
  variable: string | LexicalTextareaVariable,
  lookup: Map<string, LexicalTextareaVariable>
): LexicalTextareaVariable {
  if (typeof variable !== 'string') {
    return variable;
  }

  return lookup.get(normalizeVariableToken(variable)) ?? { key: variable, label: variable };
}
