// "Ready for offline" (Edge Cases, "Partly downloaded app"): set only when both download
// phases are cached for the catalog version this build ships.

import { db as defaultDb, type WrappedDB } from './db';

export const READY_KEY = 'readyForOffline';

export interface ReadyForOffline {
  /** The catalog file both phases were cached for; null for a build with no catalog. */
  catalogFile: string | null;
  at: string;
}

export async function recordOfflineReady(
  ready: boolean,
  catalogFile: string | null,
  db: WrappedDB = defaultDb,
): Promise<void> {
  if (ready) {
    const value: ReadyForOffline = { catalogFile, at: new Date().toISOString() };
    await db.meta.put({ key: READY_KEY, value });
  } else {
    await db.meta.delete(READY_KEY);
  }
}
