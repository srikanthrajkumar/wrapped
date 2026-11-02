// Whether the phone's database opened (second review of PR #5, A3). When it won't (WebKit's
// "Connection to Indexed Database server lost", a refused open, or one still waiting after
// OPEN_TIMEOUT_MS), Dexie's live queries never answer, so the screens would stay blank: the app
// shows the rescue screen instead (screens/RescueScreen.tsx), which needs no database.

import { useSyncExternalStore } from 'react';
import type { WrappedDB } from './db';

export const OPEN_TIMEOUT_MS = 10_000;

let failure: unknown = null;
const listeners = new Set<() => void>();

function set(next: unknown) {
  failure = next;
  listeners.forEach((listener) => listener());
}

/** Open `db` in the background and remember whether it failed. Never awaited by the first render. */
export function watchStore(db: WrappedDB, timeoutMs = OPEN_TIMEOUT_MS): void {
  const timer = setTimeout(() => {
    set(new Error(`the phone store didn't open within ${timeoutMs / 1000} s`));
  }, timeoutMs);
  db.open().then(
    () => {
      clearTimeout(timer);
      // A slow open that got there after all: the screens come back.
      if (failure) set(null);
    },
    (error: unknown) => {
      clearTimeout(timer);
      console.error('the phone store did not open', error);
      set(error);
    },
  );
}

/** The reason the store didn't open, or null while it is open or opening. */
export function useStoreFailure(): unknown {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => failure,
  );
}
