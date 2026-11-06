// The sync loop's side of the outbox. The loop (store/sync.ts) claims a batch, pushes exactly
// those entries, and settles the ones the server answered.

import { PUSH_BATCH_LIMIT, type RasikaTable } from '../model';
import { db as defaultDb, type OutboxEntry, type WrappedDB } from './db';

/**
 * Take the oldest entries for a push. Marking them sent (`firstSentAt`) happens in the same
 * transaction that reads them, so a save that lands after the claim can't change a row that
 * is on its way: it adds a new entry instead (outside voice 1). Entries claimed before and
 * never answered are claimed again, with the same opId and baseSeq, and the server
 * acknowledges them without reapplying.
 *
 * An entry's `baseSeq` is stamped here, on its first send, from the record's last known server
 * `seq` (0 for a record the server has never answered), and never changed after: a retry after
 * a lost reply repeats the push it retries (contracts/sync-api.md, "Push"). Ops on one record
 * that no ack has answered therefore share a base, which the server reads as one device's run
 * of edits, not a conflict.
 *
 * Because entries leave only when answered, the oldest `limit` entries after a lost reply
 * start at the same head and hold at least every op of the push they repeat.
 */
export async function claimBatch(
  limit = PUSH_BATCH_LIMIT,
  db: WrappedDB = defaultDb,
): Promise<OutboxEntry[]> {
  return db.transaction('rw', db.outbox, db.serverSeqs, async () => {
    const batch = await db.outbox.orderBy('seq').limit(limit).toArray();
    const now = new Date().toISOString();
    const claimed: OutboxEntry[] = [];
    for (const entry of batch) {
      claimed.push({
        ...entry,
        firstSentAt: entry.firstSentAt ?? now,
        baseSeq: entry.baseSeq ?? (await knownSeq(db, entry.table, entry.recordId)),
      });
    }
    await db.outbox.bulkPut(claimed);
    return claimed;
  });
}

/** The last server `seq` this phone knows for a record; 0 for one the server has not answered. */
export async function knownSeq(db: WrappedDB, table: RasikaTable, id: string): Promise<number> {
  return (await db.serverSeqs.get([table, id]))?.seq ?? 0;
}

/**
 * Drop the entries the server acknowledged, by opId. The sync loop settles a push through
 * `settlePush` (store/sync.ts), which also records each ack's `seq`; this is the bare removal.
 */
export async function acknowledge(
  opIds: readonly string[],
  db: WrappedDB = defaultDb,
): Promise<void> {
  await db.outbox.where('opId').anyOf(opIds).delete();
}

/**
 * Writes not yet on the server (FR-016): every outbox entry, and every rejected op still in
 * "needs attention" (constitution II, outside voice 7). Runs inside a caller's transaction when
 * it holds both tables.
 */
export async function countUnsynced(db: WrappedDB = defaultDb): Promise<number> {
  return db.transaction('r', db.outbox, db.attention, async () => {
    return (await db.outbox.count()) + (await db.attention.count());
  });
}
