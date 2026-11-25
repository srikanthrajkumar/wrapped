// Restore (T079; FR-017, FR-018; contracts/sync-api.md, "Sync order on the phone"). After a
// sign-in, one sync claims the phone as the writer, pushes whatever was logged on it, then pulls
// from the cursor, which on an empty phone is empty: that pull is the restore. Push runs first,
// so nothing logged before the sign-in is lost (constitution II).
//
// First launch waits for it so the season is back before the logging screen shows, but never for
// more than 10 seconds: a slow hall connection then opens logging anyway and the restore carries
// on beside it (constitution I, outside voice 13). With no signal the sync loop's retry and its
// `online` trigger run it when signal returns (FR-018).

import { db as defaultDb, type WrappedDB } from './db';
import { requestClaim } from './account';

export const RESTORE_WAIT_MS = 10_000;

/** How a restore ended, as far as first launch waits: finished, or carrying on beside logging. */
export type RestoreWait = 'done' | 'continuing';

/**
 * Start the restore after a sign-in and wait for it, for at most `waitMs`. `resume` is the sync
 * loop's (it clears any stop, such as "signed out", and syncs now, resolving when that sync has
 * ended). The claim is recorded first, in the store, so a restore cut short by a relaunch still
 * claims before its first push.
 */
export async function restoreAfterSignIn({
  resume,
  db = defaultDb,
  waitMs = RESTORE_WAIT_MS,
  setTimer = (run, ms) => setTimeout(run, ms),
}: {
  resume: () => Promise<void>;
  db?: WrappedDB;
  waitMs?: number;
  setTimer?: (run: () => void, ms: number) => unknown;
}): Promise<RestoreWait> {
  await requestClaim(db);
  const synced = resume().then(
    (): RestoreWait => 'done',
    (): RestoreWait => 'done',
  );
  const timedOut = new Promise<RestoreWait>((resolve) =>
    setTimer(() => resolve('continuing'), waitMs),
  );
  return Promise.race([synced, timedOut]);
}
