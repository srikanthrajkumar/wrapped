// Whether the phone's database opened. When the open is refused (WebKit's "Connection to Indexed
// Database server lost"), Dexie's live queries never answer, so the screens would stay blank: the
// app shows the rescue screen (screens/RescueScreen.tsx), which needs no database. An open still
// waiting after OPEN_TIMEOUT_MS is only slow: the screens stay, with "Still opening your
// season…" and Export at the top, until it opens or fails. When a newer build of the app opens
// the store (from another tab), this one has closed it for good (store/db.ts), and the screens
// give way to a reload.

import { useSyncExternalStore } from 'react';
import { NewerStoreError, type WrappedDB } from './db';

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

function set(next: StoreHealth) {
  health = next;
  listeners.forEach((listener) => listener());
}

/** Open `db` in the background and follow how it goes. Never awaited by the first render. */
export function watchStore(db: WrappedDB, timeoutMs = OPEN_TIMEOUT_MS): void {
  health = { state: 'opening' };
  const timer = setTimeout(() => {
    if (health.state === 'opening') set({ state: 'slow' });
  }, timeoutMs);
  db.on('versionchange', () => set({ state: 'replaced' }));
  db.open().then(
    () => {
      clearTimeout(timer);
      if (health.state !== 'replaced') set({ state: 'open' });
    },
    (error: unknown) => {
      clearTimeout(timer);
      if (isNewerStore(error)) {
        set({ state: 'replaced' });
        return;
      }
      console.error('the phone store did not open', error);
      set({ state: 'failed', error });
    },
  );
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
