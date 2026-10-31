// Ask the browser to keep this site's storage (FR-023, constitution II). Persisted storage is
// exempt from eviction; iOS grants it by heuristics, so export and restore stay the backstop.

import { db as defaultDb, type WrappedDB } from './db';

export const PERSIST_KEY = 'storagePersist';

export interface PersistState {
  /** What the browser answered; null where it has no storage API. */
  granted: boolean | null;
  /** Bytes, from `navigator.storage.estimate()`, when the browser reports them. */
  quota: number | null;
  usage: number | null;
  askedAt: string;
}

/**
 * Ask for persistent storage and record the answer with a quota estimate in `meta`. Asked on
 * first run (FR-023) and on every launch after until the browser agrees: browsers grant it
 * more readily once the app is installed, so a rasika who first opened it in a tab is asked
 * again from the home screen. Neither iOS Safari nor Android Chrome shows a prompt (Firefox
 * does, which is why it stops once granted). Once
 * granted, the stored answer is returned without asking. A refusal or a missing storage API
 * is recorded, not thrown; a failing database does throw, and the caller decides.
 */
export async function ensurePersistentStorage(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
  db: WrappedDB = defaultDb,
): Promise<PersistState> {
  const stored = (await db.meta.get(PERSIST_KEY))?.value as PersistState | undefined;
  if (stored?.granted) return stored;

  const already = storage?.persisted ? await storage.persisted().catch(() => false) : false;
  const granted = already
    ? true
    : storage?.persist
      ? await storage.persist().catch(() => false)
      : null;
  const estimate = storage?.estimate ? await storage.estimate().catch(() => undefined) : undefined;
  const state: PersistState = {
    granted,
    quota: estimate?.quota ?? null,
    usage: estimate?.usage ?? null,
    askedAt: new Date().toISOString(),
  };
  await db.meta.put({ key: PERSIST_KEY, value: state });
  return state;
}
