// Whether the phone's database opened. When the open is refused (WebKit's "Connection to Indexed
// Database server lost"), Dexie's live queries never answer, so the screens would stay blank: the
// app shows the rescue screen (screens/RescueScreen.tsx), which needs no database. An open still
// waiting after OPEN_TIMEOUT_MS is only slow: the screens stay, with "Still opening your
// season…" and Export at the top, until it opens or fails.

import { useSyncExternalStore } from 'react';
import type { WrappedDB } from './db';

export const OPEN_TIMEOUT_MS = 10_000;

export type StoreHealth =
  | { state: 'opening' }
  | { state: 'slow' }
  | { state: 'open' }
  | { state: 'failed'; error: unknown };

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
  db.open().then(
    () => {
      clearTimeout(timer);
      set({ state: 'open' });
    },
    (error: unknown) => {
      clearTimeout(timer);
      console.error('the phone store did not open', error);
      set({ state: 'failed', error });
    },
  );
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
