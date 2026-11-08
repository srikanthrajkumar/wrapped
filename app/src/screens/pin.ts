// Holding Season where it opens (DESIGN.md "Season"): the page is put with its anchor (the
// header, or the day it was left at) `offset` px above the top of the screen, before the first
// paint, then held there while the days around draw at their real heights rather than their
// likely ones, until the rasika scrolls the page themself. A browser with no scroll anchoring,
// as Safari, would otherwise let the page slide under them.
//
// Each correction finds the anchor again (PR #30 review): a day redrawn under the same name is
// followed, and once no anchor is left the hold lets go, rather than creeping by its offset on a
// node no longer on the page. Framework-free, so it is unit-tested (tests/screens/pin.test.ts).

export interface PinPage {
  readonly scrollY: number;
  scrollTo(x: number, y: number): void;
  addEventListener(type: string, listener: () => void, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** Calls `onChange` after each layout change, before paint; returns how to stop. */
export type WatchSizes = (onChange: () => void) => () => void;

const INPUTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/**
 * Put the page at the anchor `find` returns and hold it there; returns the release, which a
 * scroll of the rasika's or any input also calls.
 */
export function pinScroll(
  find: () => Element | null,
  offset: number,
  page: PinPage,
  watchSizes: WatchSizes,
): () => void {
  let anchor = find();
  let set = page.scrollY;
  let released = false;
  let unwatch = () => {};

  const release = () => {
    if (released) return;
    released = true;
    unwatch();
    page.removeEventListener('scroll', moved);
    for (const name of INPUTS) page.removeEventListener(name, release);
  };
  // A scroll that isn't the hold's own is the rasika's: the page is theirs from then on.
  const moved = () => {
    if (Math.abs(page.scrollY - set) >= 1) release();
  };
  const hold = () => {
    if (!anchor?.isConnected) anchor = find();
    if (!anchor) {
      release();
      return;
    }
    set = Math.max(0, anchor.getBoundingClientRect().top + page.scrollY + offset);
    if (Math.abs(page.scrollY - set) >= 1) page.scrollTo(0, set);
  };

  hold();
  if (released) return release;
  unwatch = watchSizes(hold);
  page.addEventListener('scroll', moved, { passive: true });
  for (const name of INPUTS) page.addEventListener(name, release, { passive: true });
  return release;
}

/** Layout changes of the whole page, through a ResizeObserver on its body. */
export const watchBody: WatchSizes = (onChange) => {
  const sizes = new ResizeObserver(onChange);
  sizes.observe(document.body);
  return () => sizes.disconnect();
};
