// Whether the phone's database opened. When the open is refused (WebKit's "Connection to Indexed
// Database server lost"), Dexie's live queries never answer, so the screens would stay blank: the
// app shows the rescue screen (screens/RescueScreen.tsx), which needs no database. An open still
// waiting after OPEN_TIMEOUT_MS is only slow: the screens stay, with "Still opening your
// season…" and Export at the top, until it opens or fails. When a newer build of the app opens
// the store (from another tab), this one has closed it for good (store/db.ts), and the screens
// give way to a reload.
//
// WebKit drops the connection of a page left in the background for hours ("Connection to Indexed
// Database server lost"); the store itself is fine. So before the rescue screen shows for the
// store, the app quietly opens a new connection, for about a second (WrappedDB.reopen): when the
// open fails, when a write or the screens hit a dead connection, and when the page comes back to
// the foreground. Only when no new connection opens does the rescue screen show, and why it
// showed is kept (store/rescue-cause.ts).

import { useSyncExternalStore } from 'react';
import { isConnectionLost, NewerStoreError, type WrappedDB } from './db';
import { recordRescue } from './rescue-cause';

export const OPEN_TIMEOUT_MS = 10_000;

export type StoreHealth =
  | { state: 'opening' }
  | { state: 'slow' }
  | { state: 'open' }
  | { state: 'failed'; error: unknown }
  /** A newer build of the app has the store; this one has closed it and asks for a reload. */
  | { state: 'replaced' };

let health: StoreHealth = { state: 'opening' };
const listeners = new Set<() => void>();
/** The store being watched, for the heals below. */
let watched: WrappedDB | null = null;
/** When the screens last broke on a lost connection and a new one was tried (HEAL_WINDOW_MS). */
let lastCrashHeal = -Infinity;
/** The screens breaking again this soon after a heal goes to the rescue screen. */
export const HEAL_WINDOW_MS = 10_000;

function set(next: StoreHealth) {
  health = next;
  listeners.forEach((listener) => listener());
}

/** The store failed for good: the rescue screen, with the cause kept. Only the first counts. */
function fail(error: unknown) {
  if (health.state === 'failed' || health.state === 'replaced') return;
  if (isNewerStore(error)) {
    set({ state: 'replaced' });
    return;
  }
  console.error('the phone store did not open', error);
  recordRescue('store', error);
  set({ state: 'failed', error });
}

/** Open `db` in the background and follow how it goes. Never awaited by the first render. */
export function watchStore(db: WrappedDB, timeoutMs = OPEN_TIMEOUT_MS): void {
  health = { state: 'opening' };
  watched = db;
  const timer = setTimeout(() => {
    if (health.state === 'opening') set({ state: 'slow' });
  }, timeoutMs);
  db.on('versionchange', () => set({ state: 'replaced' }));
  // A lost connection no new one replaced, whoever found it (a write, a check, the screens).
  db.whenLost(fail);
  const opened = () => {
    clearTimeout(timer);
    if (health.state !== 'replaced') set({ state: 'open' });
  };
  db.open().then(opened, (error: unknown) => {
    if (isNewerStore(error)) {
      clearTimeout(timer);
      set({ state: 'replaced' });
      return;
    }
    // Once more, on a new connection, before the rescue screen.
    db.reopen().then(opened, (again: unknown) => {
      clearTimeout(timer);
      fail(again);
    });
  });
}

/**
 * Check the watched store answers and open a new connection if it doesn't (WrappedDB.reopen).
 * True when it answers; false when it is closed for good, and the rescue screen shows.
 */
export async function healStore(): Promise<boolean> {
  if (!watched || health.state === 'replaced' || health.state === 'failed') return false;
  try {
    await watched.reopen();
    return true;
  } catch (error) {
    fail(error);
    return false;
  }
}

/**
 * The screens broke (RescueBoundary). A lost connection gets one quiet heal, and the screens
 * are drawn again; anything else, or the same within HEAL_WINDOW_MS of a heal, is the rescue
 * screen, with the cause kept. Decides only: `healAfterCrash` does the heal.
 */
export function mayHealCrash(error: unknown, now = Date.now()): boolean {
  return (
    isConnectionLost(error) &&
    watched !== null &&
    health.state !== 'failed' &&
    health.state !== 'replaced' &&
    now - lastCrashHeal >= HEAL_WINDOW_MS
  );
}

/** The heal `mayHealCrash` allowed. True when the screens may be drawn again. */
export function healAfterCrash(now = Date.now()): Promise<boolean> {
  lastCrashHeal = now;
  return healStore();
}

/** The screens broke and won't be healed: keep why, for the rescue screen. */
export function recordCrash(error: unknown): void {
  // A store already failed or replaced has its own cause.
  if (health.state === 'failed' || health.state === 'replaced') return;
  recordRescue(isConnectionLost(error) ? 'store' : 'crash', error);
}

/**
 * When the page is shown again (visible, or back from the back-forward cache), check the store
 * answers before the rasika's next tap, and open a new connection if it doesn't.
 */
export function watchForeground(
  doc: Pick<Document, 'visibilityState' | 'addEventListener'> = document,
  win: Pick<Window, 'addEventListener'> = window,
): void {
  const check = () => {
    if (health.state === 'open') void healStore();
  };
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') check();
  });
  win.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) check();
  });
}

/**
 * An error nobody caught that says the connection was lost (a write left unawaited) heals the
 * store too. Nothing else here shows the rescue screen: a browser's "ResizeObserver loop"
 * report, or any other stray error, is left alone.
 */
export function watchStrayErrors(win: Pick<Window, 'addEventListener'> = window): void {
  const heard = (error: unknown) => {
    if (health.state === 'open' && isConnectionLost(error)) void healStore();
  };
  win.addEventListener('unhandledrejection', (event) =>
    heard((event as PromiseRejectionEvent).reason),
  );
  win.addEventListener('error', (event) => heard((event as ErrorEvent).error));
}

/** For tests: forget the store watched and the last heal. */
export function resetStoreHealth(): void {
  health = { state: 'opening' };
  watched = null;
  lastCrashHeal = -Infinity;
}

/** Dexie may hand back the error thrown while opening as the `inner` of its own. */
function isNewerStore(error: unknown): boolean {
  const inner = (error as { inner?: unknown } | null)?.inner;
  return error instanceof NewerStoreError || inner instanceof NewerStoreError;
}

export function storeHealth(): StoreHealth {
  return health;
}

export function subscribeStoreHealth(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useStoreHealth(): StoreHealth {
  return useSyncExternalStore(subscribeStoreHealth, storeHealth);
}
