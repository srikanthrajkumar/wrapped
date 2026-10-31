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
 * On first run, ask for persistent storage and record the answer with a quota estimate in
 * `meta`. Later runs return the stored answer without asking again. Never throws: a refusal
 * or a missing API must not stop the app from opening.
 */
export async function ensurePersistentStorage(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
  db: WrappedDB = defaultDb,
): Promise<PersistState> {
  const stored = await db.meta.get(PERSIST_KEY);
  if (stored) return stored.value as PersistState;

  const granted = storage?.persist ? await storage.persist().catch(() => false) : null;
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
