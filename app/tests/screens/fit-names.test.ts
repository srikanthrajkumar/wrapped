// The row's accompanist line (screens/fit-names.ts; DESIGN.md "The row"): whole names, in
// order, then "+N"; one name at least.

import { describe, expect, it } from 'vitest';
import { fitNames, namesLine } from '../../src/screens/fit-names';
import { nameBreaks } from '../../src/screens/format';

/** A fixed-width type: ten to the character. */
const measure = (text: string) => text.length * 10;

describe('namesLine', () => {
  it('joins every name when all are shown', () => {
    expect(namesLine(['A', 'B', 'C'], 3)).toBe('A · B · C');
  });

  it('counts the ones left out', () => {
    expect(namesLine(['A', 'B', 'C'], 2)).toBe('A · B +1');
    expect(namesLine(['A', 'B', 'C', 'D'], 1)).toBe('A +3');
  });

  it('says one name with no count', () => {
    expect(namesLine(['A'], 1)).toBe('A');
  });
});

describe('fitNames', () => {
  const names = ['Embar Kannan', 'Neyveli Narayanan', 'Anirudh Athreya'];

  it('shows them all where they fit', () => {
    const all = measure(namesLine(names, 3));
    expect(fitNames(names, all, measure)).toBe(3);
  });

  it('drops the last when the line is a pixel short', () => {
    const all = measure(namesLine(names, 3));
    expect(fitNames(names, all - 1, measure)).toBe(2);
  });

  it('counts the "+N" in what must fit', () => {
    // Two names fit bare, but not with their "+1".
    const two = measure('Embar Kannan · Neyveli Narayanan');
    expect(fitNames(names, two, measure)).toBe(1);
    expect(fitNames(names, two + measure(' +1'), measure)).toBe(2);
  });

  it('keeps the Stage order: it never skips a long name for a short one', () => {
    const order = ['Aanayampatti G. Venkatasubramanian', 'Sai', 'Ram'];
    expect(fitNames(order, measure('Sai · Ram') + 50, measure)).toBe(1);
  });

  it('always shows one, even where it is wider than the line', () => {
    expect(fitNames(names, 10, measure)).toBe(1);
    expect(fitNames(['Embar Kannan'], 0, measure)).toBe(1);
  });

  it('shows none of none', () => {
    expect(fitNames([], 100, measure)).toBe(0);
  });
});

// A lead or a hero's name, as a heading wraps it (the council, 2026-11-13).
describe('where a name may break', () => {
  const NBSP = '\u00A0';
  it('never after an "&" or an initial, so a pair breaks before its "&"', () => {
    expect(nameBreaks('Charulatha Chandrashekar & C. S. Keshav Chandra')).toBe(
      `Charulatha Chandrashekar &${NBSP}C.${NBSP}S.${NBSP}Keshav Chandra`,
    );
    expect(nameBreaks('T. M. Krishna')).toBe(`T.${NBSP}M.${NBSP}Krishna`);
    expect(nameBreaks('Ranjani & Gayatri')).toBe(`Ranjani &${NBSP}Gayatri`);
  });

  it('leaves a name with neither as it is, and a last initial where it stands', () => {
    expect(nameBreaks('Sid Sriram')).toBe('Sid Sriram');
    expect(nameBreaks('Thiruvizha Sri. Viju')).toBe('Thiruvizha Sri. Viju');
    expect(nameBreaks('Nagai R. Muralidharan & Badrinarayanan. D')).toBe(
      `Nagai R.${NBSP}Muralidharan &${NBSP}Badrinarayanan. D`,
    );
  });
});
