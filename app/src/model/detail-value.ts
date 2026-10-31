// A Detail value keeps how the rasika entered a Detail, not just its text (ADR 0005,
// data-model.md "Detail value").

export const DETAIL_STATES = ['catalog', 'override', 'unknown', 'na', 'unresolved'] as const;
export type DetailState = (typeof DETAIL_STATES)[number];

export interface DetailValue {
  state: DetailState;
  /** Catalog natural key. Required for `catalog` and `override`, null otherwise. */
  key: string | null;
  /** The text as typed or picked, always kept: `"?"` for `unknown`, `""` for `na`. */
  text: string;
  /** Marked not sure (a Guess). Allowed with `catalog`, `override` and `unresolved`. */
  guess: boolean;
}

const KEYED: readonly DetailState[] = ['catalog', 'override'];
const GUESSABLE: readonly DetailState[] = ['catalog', 'override', 'unresolved'];

/** Every way `value` breaks the Detail value rules; empty when it is valid. */
export function detailValueProblems(value: DetailValue): string[] {
  const problems: string[] = [];
  if (!DETAIL_STATES.includes(value.state)) {
    return [`unknown state ${JSON.stringify(value.state)}`];
  }
  if (KEYED.includes(value.state)) {
    if (typeof value.key !== 'string' || value.key === '') {
      problems.push(`a ${value.state} value needs a key`);
    }
  } else if (value.key !== null) {
    problems.push(`a ${value.state} value must have a null key`);
  }
  if (typeof value.text !== 'string') problems.push('text must be a string');
  if (value.state === 'unknown' && value.text !== '?') problems.push('an unknown value reads "?"');
  if (value.state === 'na' && value.text !== '') problems.push('a not-applicable value is ""');
  if (typeof value.guess !== 'boolean') problems.push('guess must be true or false');
  else if (value.guess && !GUESSABLE.includes(value.state)) {
    problems.push(`a ${value.state} value cannot be a guess`);
  }
  return problems;
}

export function isValidDetailValue(value: DetailValue): boolean {
  return detailValueProblems(value).length === 0;
}

export const unknownValue = (): DetailValue => ({
  state: 'unknown',
  key: null,
  text: '?',
  guess: false,
});

export const notApplicableValue = (): DetailValue => ({
  state: 'na',
  key: null,
  text: '',
  guess: false,
});

export const unresolvedValue = (text: string, guess = false): DetailValue => ({
  state: 'unresolved',
  key: null,
  text,
  guess,
});

export const catalogValue = (key: string, text: string): DetailValue => ({
  state: 'catalog',
  key,
  text,
  guess: false,
});
