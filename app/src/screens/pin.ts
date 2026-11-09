// Holding Season where the rasika comes back to it (DESIGN.md "Season"): the page is put with
// its anchor (the day it was left at, or the header, or Now) `offset` px above the top of the
// screen, before the first paint, then held there while the days around draw at their real
// heights rather than their likely ones, until the rasika scrolls the page themself. A browser
// with no scroll anchoring, as Safari, would otherwise let the page slide under them.
//
// Each correction finds the anchor again (PR #30 review): a day redrawn under the same name is
// followed, and once no anchor is left the hold lets go, rather than creeping by its offset on a
// node no longer on the page. A page still too short to reach the hold's place, its days above
// at their likely heights, stops the scroll short: that is the page, not the rasika, so the hold
// keeps on and reaches its place as the days draw. Framework-free, so it is unit-tested
// (tests/screens/pin.test.ts).

export interface PinPage {
  readonly scrollY: number;
  /** The furthest the page scrolls as it stands. */
  readonly maxScrollY: number;
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
  // A scroll that isn't the hold's own, nor its own stopped short by a page not yet tall enough,
  // is the rasika's: the page is theirs from then on.
  const moved = () => {
    const reach = Math.max(0, Math.min(set, page.maxScrollY));
    if (Math.abs(page.scrollY - reach) >= 1) release();
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

/** The browser's own page. */
export const windowPage: PinPage = {
  get scrollY() {
    return window.scrollY;
  },
  get maxScrollY() {
    return document.documentElement.scrollHeight - window.innerHeight;
  },
  scrollTo: (x, y) => window.scrollTo(x, y),
  addEventListener: (type, listener, options) => window.addEventListener(type, listener, options),
  removeEventListener: (type, listener) => window.removeEventListener(type, listener),
};

/** Layout changes of the whole page, through a ResizeObserver on its body. */
export const watchBody: WatchSizes = (onChange) => {
  const sizes = new ResizeObserver(onChange);
  sizes.observe(document.body);
  return () => sizes.disconnect();
};
