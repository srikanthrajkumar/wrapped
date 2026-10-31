// The sync loop's side of the outbox. The loop itself (T078) claims a batch, pushes exactly
// those entries, and drops the ones the server answered.

import { PUSH_BATCH_LIMIT } from '../model';
import { db as defaultDb, type OutboxEntry, type WrappedDB } from './db';

/**
 * Take the oldest entries for a push. Marking them sent (`firstSentAt`) happens in the same
 * transaction that reads them, so a save that lands after the claim can't change a row that
 * is on its way: it adds a new entry instead (outside voice 1). Entries claimed before and
 * never answered are claimed again, with the same opId, and the server acknowledges them
 * without reapplying.
 */
export async function claimBatch(
  limit = PUSH_BATCH_LIMIT,
  db: WrappedDB = defaultDb,
): Promise<OutboxEntry[]> {
  return db.transaction('rw', db.outbox, async () => {
    const batch = await db.outbox.orderBy('seq').limit(limit).toArray();
    const now = new Date().toISOString();
    const claimed = batch.map((entry) => ({ ...entry, firstSentAt: entry.firstSentAt ?? now }));
    await db.outbox.bulkPut(claimed);
    return claimed;
  });
}

/**
 * Drop the entries the server acknowledged, by opId. Rejected ops are the sync loop's (T078,
 * T097): the contract takes them out of the push queue into "needs attention", still counted
 * as unsynced, so a batch never re-sends them.
 */
export async function acknowledge(
  opIds: readonly string[],
  db: WrappedDB = defaultDb,
): Promise<void> {
  await db.outbox.where('opId').anyOf(opIds).delete();
}
