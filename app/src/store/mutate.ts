// The only write path for rasika records (constitution I). Each save is one local transaction
// that writes the record and its outbox entry, then returns. Nothing here touches the network.

import { newId, type RasikaRows, type RasikaTable } from '../model';
import { db as defaultDb, type OutboxEntry, type WrappedDB } from './db';

/**
 * Store `row` and queue it for the server, in one transaction. Stamps `updatedAt` and
 * returns the row as stored.
 */
export async function save<T extends RasikaTable>(
  table: T,
  row: RasikaRows[T],
  db: WrappedDB = defaultDb,
): Promise<RasikaRows[T]> {
  const stored = { ...row, updatedAt: new Date().toISOString() };
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.table(table).put(stored);
    await enqueue(db, table, stored, 'save');
  });
  return stored;
}

/**
 * Delete a record by saving it as a tombstone: the full row with `deletedAt` set, so a delete
 * syncs as an upsert (outside voice 8). Returns the tombstone, or undefined when there is no
 * such record.
 */
export async function remove<T extends RasikaTable>(
  table: T,
  id: string,
  db: WrappedDB = defaultDb,
): Promise<RasikaRows[T] | undefined> {
  return db.transaction('rw', [db.table(table), db.outbox], async () => {
    const current = (await db.table(table).get(id)) as RasikaRows[T] | undefined;
    if (!current) return undefined;
    const now = new Date().toISOString();
    const tombstone = { ...current, deletedAt: current.deletedAt ?? now, updatedAt: now };
    await db.table(table).put(tombstone);
    await enqueue(db, table, tombstone, 'remove');
    return tombstone;
  });
}

/**
 * Queue a row inside the caller's transaction. A record has at most one never-sent entry: a
 * save replaces its row and keeps its place in the queue. An entry sent at least once, even if
 * the reply was lost, may already be stored under its opId, so it is never changed and the
 * save adds a new entry (eng review D8).
 */
async function enqueue(
  db: WrappedDB,
  table: RasikaTable,
  row: RasikaRows[RasikaTable],
  op: OutboxEntry['op'],
): Promise<void> {
  const unsent = await db.outbox
    .where('recordId')
    .equals(row.id)
    .filter((entry) => entry.table === table && entry.firstSentAt === null)
    .first();
  if (unsent?.seq !== undefined) {
    await db.outbox.update(unsent.seq, { row, op });
    return;
  }
  await db.outbox.add({
    opId: newId(),
    table,
    recordId: row.id,
    op,
    row,
    queuedAt: new Date().toISOString(),
    firstSentAt: null,
  });
}
