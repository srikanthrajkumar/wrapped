// The row's accompanist line (the Maintainer, 2026-11-11, option B of three mockups; DESIGN.md
// "The row"): one line, as many whole names as fit, in Stage order, then "+N" for the rest. No
// name is ever cut and the line never wraps, so a list keeps one rhythm; the sheet has everyone.
// The same rule as What's on's search bar. Framework-free, so it is unit-tested
// (tests/screens/fit-names.test.ts).

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
