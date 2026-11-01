// "Ready for offline" (Edge Cases, "Partly downloaded app"): set only when both download
// phases are cached for the catalog version this build ships. "Ready to log" covers the first
// phase alone (eng review D4); only the service worker's last answer is kept, for display, never
// trusted as proof (D8).

import type { ReadyStatus } from '../precache-phases';
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

export const READY_TO_LOG_KEY = 'readyToLog';

/** The service worker's last answer about the first phase, with when it was given. */
export async function recordReadyToLog(
  status: ReadyStatus | null,
  db: WrappedDB = defaultDb,
): Promise<void> {
  await db.meta.put({
    key: READY_TO_LOG_KEY,
    value: status && { ...status, at: new Date().toISOString() },
  });
}
