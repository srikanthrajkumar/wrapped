// Where the rasika is in the app (the Maintainer, 2026-11-11 and 2026-11-13; DESIGN.md
// "Navigation"): four tabs, Season, Shortlist, Diary and Settings, each with its own back stack. What's on, then Shortlist,
// then Season again finds What's on where it was left; an Event opened from the Diary goes back
// to the Diary; the tab that is on, tapped, returns to its top. The URL stays the page's own
// (`/event/:id` whichever tab opened it), so the stacks are kept here, in memory and in
// sessionStorage, so a reload keeps them. Framework-free, so the rules are unit-tested
// (tests/screens/nav.test.ts).

import type { BrowserStorage } from '../browser-storage';

export type Tab = 'season' | 'shortlist' | 'diary' | 'settings';

export const TAB_ROOT: Record<Tab, string> = {
  season: '/',
  shortlist: '/shortlist',
  diary: '/diary',
  settings: '/settings',
};

export const WHATS_ON = '/whats-on';

/** The tab a page belongs to by itself; null for one any tab can hold (an Event, an Item). */
export function homeTab(path: string): Tab | null {
  if (path.startsWith('/event/')) return null;
  if (path === TAB_ROOT.shortlist) return 'shortlist';
  if (path === TAB_ROOT.diary) return 'diary';
  // Settings, and the Maintainer's review under it.
  if (path === TAB_ROOT.settings || path === '/admin') return 'settings';
  return 'season';
}

/** How deep a page sits in a tab: its root, a page under it, an Event, an Item. */
export function level(path: string): number {
  if (path.startsWith('/event/')) return path.includes('/item/') ? 4 : 3;
  if (Object.values(TAB_ROOT).includes(path)) return 0;
  return path === '/admin' ? 2 : 1;
}

export interface NavState {
  tab: Tab;
  stacks: Record<Tab, string[]>;
}

export const startState = (): NavState => ({
  tab: 'season',
  stacks: { season: ['/'], shortlist: ['/shortlist'], diary: ['/diary'], settings: ['/settings'] },
});

/** Which way the rasika went: into a page, back to one, across to another tab, or nowhere. */
export type Move = 'forward' | 'back' | 'tab' | 'same';

/**
 * The stacks after the rasika reaches `path`. A page already in its tab's stack is gone back to,
 * and what was above it is left; a new one goes on top, in place of any page as deep or deeper
 * (the next Item replaces the last). A page no tab owns stays in
 * the tab that is on.
 */
export function visit(state: NavState, path: string): { state: NavState; move: Move } {
  const tab = homeTab(path) ?? state.tab;
  const stack = state.stacks[tab];
  const at = stack.lastIndexOf(path);
  const top = stack.at(-1);
  if (tab === state.tab && top === path) return { state, move: 'same' };
  const next =
    at >= 0 ? stack.slice(0, at + 1) : [...stack.filter((page) => level(page) < level(path)), path];
  if (next[0] !== TAB_ROOT[tab]) next.unshift(TAB_ROOT[tab]);
  const move: Move = tab !== state.tab ? 'tab' : at >= 0 ? 'back' : 'forward';
  return { state: { tab, stacks: { ...state.stacks, [tab]: next } }, move };
}

/** The page under the one on show, in its tab: where its back chevron goes. */
export function under(state: NavState, path: string): string {
  const stack = state.stacks[state.tab];
  const at = stack.lastIndexOf(path);
  return (at > 0 ? stack[at - 1] : undefined) ?? TAB_ROOT[state.tab];
}

/** Where a tab's button goes: its root when it is on, else the page it was left at. */
export function tabTarget(state: NavState, tab: Tab): string {
  return tab === state.tab ? TAB_ROOT[tab] : (state.stacks[tab].at(-1) ?? TAB_ROOT[tab]);
}

const KEY = 'wrapped.nav.v1';

function read(storage: BrowserStorage | null): NavState {
  try {
    const stored = JSON.parse(storage?.getItem(KEY) ?? 'null') as Partial<NavState> | null;
    const start = startState();
    if (!stored || !(stored.tab! in TAB_ROOT) || typeof stored.stacks !== 'object') return start;
    for (const tab of Object.keys(TAB_ROOT) as Tab[]) {
      const stack = stored.stacks?.[tab];
      // A page kept under a tab that is no longer its own is dropped: Settings sat in Season's
      // stack until it became a tab, and a stack ending on it would send Season's tab there.
      if (Array.isArray(stack) && stack[0] === TAB_ROOT[tab] && stack.every(isPath))
        start.stacks[tab] = stack.filter((page) => (homeTab(page) ?? tab) === tab);
    }
    return { tab: stored.tab!, stacks: start.stacks };
  } catch {
    return startState();
  }
}
const isPath = (value: unknown) => typeof value === 'string' && value.startsWith('/');

/** This tab's own storage, or null where it is blocked: the stacks are a tab's, not the phone's. */
function sessionStore(): BrowserStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

let storage: BrowserStorage | null | undefined;
let state: NavState | undefined;
let last: { path: string; move: Move } | undefined;
/** How far down each page was left, by path, for coming back to it. */
const scrolls = new Map<string, number>();
const listeners = new Set<() => void>();

const current = () => {
  if (storage === undefined) storage = sessionStore();
  return (state ??= read(storage));
};

/** The app's stacks, for the tab bar and the back chevrons. */
export const navState = (): NavState => current();
export const subscribeNav = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** A tab switch asked for by the tab bar, for the next page reached. */
let switching = false;

/**
 * The tab bar's button for `tab` was tapped, on its way to `target`. An Event's page belongs to
 * no tab by its path, so the tab is told here: the page reached next is that tab's.
 */
export function enterTab(tab: Tab, target: string): void {
  const now = current();
  if (now.tab === tab) return;
  state = { ...now, tab };
  // The same page may be open in both tabs: then no page is reached, only the tab changes.
  switching = target !== last?.path;
  persist();
}

function persist() {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Unkept, a reload starts each tab at its root.
  }
  queueMicrotask(() => listeners.forEach((listener) => listener()));
}

/**
 * Note that the rasika has reached `path`, and say which way they went. Safe to call again for
 * the same page (a render repeated): it answers as it first did.
 */
export function arrive(path: string): Move {
  if (last?.path === path) return last.move;
  const before = current();
  const { state: next, move } = visit(before, path);
  const switched = switching || next.tab !== before.tab;
  switching = false;
  // The first page of a launch, or a reload, just appears.
  last = { path, move: last === undefined ? 'same' : switched ? 'tab' : move };
  if (next !== state) {
    state = next;
    persist();
  }
  return last.move;
}

/** The way the page on show was reached. */
export const lastMove = (): Move => last?.move ?? 'same';

export const leftAt = (path: string): number => scrolls.get(path) ?? 0;
export function noteScroll(path: string, top: number): void {
  scrolls.set(path, top);
}
/** A page asked to open at its top, as the tab that is on does when tapped. */
export function forgetScroll(path: string): void {
  scrolls.delete(path);
}

/** For tests: start over. */
export function resetNav(): void {
  state = undefined;
  last = undefined;
  switching = false;
  storage = undefined;
  scrolls.clear();
}
