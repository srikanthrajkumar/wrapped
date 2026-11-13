// The tabs' own back stacks (the Maintainer, 2026-11-11): What's on, then Shortlist, then Season
// again finds What's on where it was left; an Event belongs to the tab it was opened from; the
// tab that is on, tapped, returns to its root.

import { describe, expect, it } from 'vitest';
import {
  arrive,
  enterTab,
  homeTab,
  navState,
  resetNav,
  startState,
  tabTarget,
  under,
  visit,
  WHATS_ON,
  type NavState,
} from '../../src/screens/nav';

const walk = (...paths: string[]) => {
  let state: NavState = startState();
  const moves: string[] = [];
  for (const path of paths) {
    const next = visit(state, path);
    state = next.state;
    moves.push(next.move);
  }
  return { state, moves };
};

describe('the tabs’ stacks', () => {
  it('keeps each tab’s own stack across a switch', () => {
    const { state, moves } = walk(WHATS_ON, '/shortlist', '/');
    expect(moves).toEqual(['forward', 'tab', 'tab']);
    // Season was left on What's on: its button, tapped from Shortlist, goes back there.
    expect(walk(WHATS_ON, '/shortlist').state.stacks.season).toEqual(['/', WHATS_ON]);
    expect(tabTarget(walk(WHATS_ON, '/shortlist').state, 'season')).toBe(WHATS_ON);
    // Reaching its root leaves What's on behind.
    expect(state.stacks.season).toEqual(['/']);
  });

  it('opens an Event in the tab that is on, and goes back to the page under it', () => {
    const diary = walk('/diary', '/event/a');
    expect(diary.state.tab).toBe('diary');
    expect(diary.state.stacks.diary).toEqual(['/diary', '/event/a']);
    expect(under(diary.state, '/event/a')).toBe('/diary');
    const whatsOn = walk(WHATS_ON, '/event/a', '/event/a/item/new', '/event/a/item/i1');
    // The Item made replaces the new one: one Item deep, never two.
    expect(whatsOn.state.stacks.season).toEqual(['/', WHATS_ON, '/event/a', '/event/a/item/i1']);
    expect(under(whatsOn.state, '/event/a')).toBe(WHATS_ON);
    expect(under(whatsOn.state, '/event/a/item/i1')).toBe('/event/a');
  });

  it('goes back by leaving what was above', () => {
    const { state, moves } = walk(WHATS_ON, '/event/a', '/event/a/item/i1', '/event/a', WHATS_ON);
    expect(moves).toEqual(['forward', 'forward', 'forward', 'back', 'back']);
    expect(state.stacks.season).toEqual(['/', WHATS_ON]);
  });

  it('returns the tab that is on to its root, and another to where it was left', () => {
    const { state } = walk('/shortlist', '/event/a');
    expect(tabTarget(state, 'shortlist')).toBe('/shortlist');
    expect(tabTarget(state, 'diary')).toBe('/diary');
    expect(visit(state, '/diary').state.stacks.shortlist).toEqual(['/shortlist', '/event/a']);
    expect(tabTarget(visit(state, '/diary').state, 'shortlist')).toBe('/event/a');
  });

  it('keeps Settings as its own tab, with the review under it', () => {
    expect(homeTab('/settings')).toBe('settings');
    expect(homeTab('/admin')).toBe('settings');
    expect(homeTab(WHATS_ON)).toBe('season');
    expect(homeTab('/event/a')).toBeNull();
    // What's on is left where it was, under Season, while Settings is on.
    const { state, moves } = walk(WHATS_ON, '/settings', '/admin');
    expect(moves).toEqual(['forward', 'tab', 'forward']);
    expect(state.tab).toBe('settings');
    expect(state.stacks.season).toEqual(['/', WHATS_ON]);
    expect(state.stacks.settings).toEqual(['/settings', '/admin']);
    expect(tabTarget(state, 'season')).toBe(WHATS_ON);
    expect(tabTarget(state, 'settings')).toBe('/settings');
  });

  it('drops Settings from a Season stack kept from before it was a tab', () => {
    const kept = new Map<string, string>([
      [
        'wrapped.nav.v1',
        JSON.stringify({
          tab: 'season',
          stacks: { season: ['/', '/settings'], shortlist: ['/shortlist'], diary: ['/diary'] },
        }),
      ],
    ]);
    const before = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => kept.get(key) ?? null,
        setItem: (key: string, value: string) => void kept.set(key, value),
        removeItem: (key: string) => void kept.delete(key),
      },
    });
    try {
      resetNav();
      expect(navState().stacks.season).toEqual(['/']);
      expect(navState().stacks.settings).toEqual(['/settings']);
      // Season's tab goes to the hub, never back into Settings.
      arrive('/settings');
      expect(tabTarget(navState(), 'season')).toBe('/');
    } finally {
      if (before) Object.defineProperty(globalThis, 'sessionStorage', before);
      else delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
      resetNav();
    }
  });

  it('answers the same page with no move', () => {
    expect(walk('/', '/').moves).toEqual(['same', 'same']);
  });

  it('answers the same page with no move', () => {
    expect(walk('/', '/').moves).toEqual(['same', 'same']);
  });
});

// An Event's path names no tab, so the tab bar says which tab its button enters.
describe('a tab entered from the tab bar', () => {
  it('opens an Event left in another tab in that tab, not the one that was on', () => {
    resetNav();
    arrive('/');
    arrive('/event/a');
    // From Season's Event to the Shortlist, then to the Diary.
    enterTab('shortlist', '/shortlist');
    expect(arrive('/shortlist')).toBe('tab');
    enterTab('diary', '/diary');
    arrive('/diary');
    // Back to Season: its button goes to the Event it was left on, which is Season's.
    enterTab('season', '/event/a');
    expect(arrive('/event/a')).toBe('tab');
    expect(navState().tab).toBe('season');
    expect(navState().stacks.season).toEqual(['/', '/event/a']);
    expect(navState().stacks.diary).toEqual(['/diary']);
    resetNav();
  });

  it('changes only the tab when the same page is open in both', () => {
    resetNav();
    arrive('/');
    arrive('/event/a');
    enterTab('shortlist', '/shortlist');
    arrive('/shortlist');
    arrive('/event/a');
    enterTab('season', '/event/a');
    expect(navState().tab).toBe('season');
    // The page reached next is an ordinary move, not a tab switch.
    expect(arrive('/')).toBe('back');
    resetNav();
  });
});
