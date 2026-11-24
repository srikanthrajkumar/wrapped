// The row's accompanist line (the Maintainer, 2026-11-11, option B of three mockups; DESIGN.md
// "The row"): one line, as many whole names as fit, in Stage order, then "+N" for the rest. No
// name is ever cut and the line never wraps, so a list keeps one rhythm; the sheet has everyone.
// The same rule as What's on's search bar. Framework-free, so it is unit-tested
// (tests/screens/fit-names.test.ts).
//
// A Lecdem's or a Harikatha's presenters, where a row or the hub's hero names it (the user,
// 2026-11-24, ADR 0013): from 4 up, the first 2 whole names, then "+N", spoken "and N more".
// Up to 3 read in full, as before. The Event's Stage lists everyone.

import type { EventKind } from '../model';
import { joinNames } from '../store/stage';

/** The line as shown: the first `shown` names, then "+N" when some are left out. */
export const namesLine = (names: readonly string[], shown: number) =>
  names.slice(0, shown).join(' · ') + (shown < names.length ? ` +${names.length - shown}` : '');

/**
 * How many of `names` the line shows in `width`, measured by `measure`: all of them if they
 * fit, else the most that fit with their "+N". At least one always shows, even where its own
 * width is more than the line's (the line then clips, never wraps).
 */
export function fitNames(
  names: readonly string[],
  width: number,
  measure: (text: string) => number,
): number {
  for (let shown = names.length; shown > 1; shown -= 1) {
    if (measure(namesLine(names, shown)) <= width) return shown;
  }
  return Math.min(1, names.length);
}

/** The most presenters a row or the hero names in full. */
export const PRESENTERS_IN_FULL = 3;
/** How many it names, past that, before "+N". */
export const PRESENTERS_SHOWN = 2;

/**
 * The names an Event is known by, as a row and the hub's hero show them: `lead`, then "+`more`".
 * Presenters (a Lecdem's, a Harikatha's) from 4 up read "A, B +2"; up to 3, and any other
 * names, read in full ("A & B", "A, B & C").
 */
export function leadNames(
  kind: EventKind,
  names: readonly string[],
): { lead: string; more: number } {
  if ((kind === 'lecdem' || kind === 'harikatha') && names.length > PRESENTERS_IN_FULL) {
    return {
      lead: names.slice(0, PRESENTERS_SHOWN).join(', '),
      more: names.length - PRESENTERS_SHOWN,
    };
  }
  return { lead: joinNames(names), more: 0 };
}
