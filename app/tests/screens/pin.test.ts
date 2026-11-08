// Season's opening hold (screens/pin.ts; PR #30 review): it keeps the anchor in place while the
// days around draw, follows an anchor redrawn under the same name, lets go once no anchor is
// left instead of creeping by its offset, and lets go at the rasika's own scroll.

import { describe, expect, it } from 'vitest';
import { pinScroll, type PinPage } from '../../src/screens/pin';

function fakePage() {
  const listeners = new Map<string, Set<() => void>>();
  const page = {
    scrollY: 0,
    scrollTo(_x: number, y: number) {
      page.scrollY = y;
      for (const listener of listeners.get('scroll') ?? []) listener();
    },
    addEventListener(type: string, listener: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener);
    },
    /** The rasika scrolls. */
    userScroll(y: number) {
      page.scrollY = y;
      for (const listener of listeners.get('scroll') ?? []) listener();
    },
  };
  return page satisfies PinPage & { userScroll(y: number): void };
}

/** An element at `top` px down the page; a detached one measures at 0, as in a browser. */
function anchorAt(page: { scrollY: number }, top: number) {
  const element = {
    top,
    isConnected: true,
    getBoundingClientRect: () =>
      ({ top: element.isConnected ? element.top - page.scrollY : 0 }) as DOMRect,
  };
  return element;
}

function sizes() {
  let onChange: (() => void) | null = null;
  return {
    watch: (callback: () => void) => {
      onChange = callback;
      return () => (onChange = null);
    },
    /** The days around redraw at their real heights. */
    change: () => onChange?.(),
    get watching() {
      return onChange !== null;
    },
  };
}

describe('the opening hold', () => {
  it('puts the anchor at its offset and keeps it there as the days above draw', () => {
    const page = fakePage();
    const anchor = anchorAt(page, 1000);
    const watched = sizes();
    pinScroll(() => anchor as unknown as Element, 120, page, watched.watch);
    expect(page.scrollY).toBe(1120);
    anchor.top = 1060;
    watched.change();
    expect(page.scrollY).toBe(1180);
  });

  it('follows the anchor redrawn under the same name', () => {
    const page = fakePage();
    let anchor = anchorAt(page, 1000);
    const watched = sizes();
    pinScroll(() => anchor as unknown as Element, 0, page, watched.watch);
    anchor.isConnected = false;
    anchor = anchorAt(page, 1300);
    watched.change();
    expect(page.scrollY).toBe(1300);
  });

  it('lets go, rather than creeping by its offset, once no anchor is left', () => {
    const page = fakePage();
    const anchor = anchorAt(page, 1000);
    let found: typeof anchor | null = anchor;
    const watched = sizes();
    pinScroll(() => found as unknown as Element | null, 120, page, watched.watch);
    expect(page.scrollY).toBe(1120);
    anchor.isConnected = false;
    found = null;
    watched.change();
    watched.change();
    expect(page.scrollY).toBe(1120);
    expect(watched.watching).toBe(false);
  });

  it('lets go at the rasika’s own scroll', () => {
    const page = fakePage();
    const anchor = anchorAt(page, 1000);
    const watched = sizes();
    pinScroll(() => anchor as unknown as Element, 0, page, watched.watch);
    page.userScroll(400);
    anchor.top = 1100;
    watched.change();
    expect(page.scrollY).toBe(400);
    expect(watched.watching).toBe(false);
  });
});
