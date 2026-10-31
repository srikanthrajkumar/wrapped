// The only write path for rasika records (constitution I). Each save is one local transaction
// that writes the record and its outbox entry, then returns. Nothing here touches the network.

import { newId, RECORD_FIELDS, type RasikaRows, type RasikaTable } from '../model';
import { db as defaultDb, type OutboxEntry, type WrappedDB } from './db';

export interface WriteOptions {
  db?: WrappedDB;
}

export interface SaveOptions extends WriteOptions {
  /** Bring a deleted record back. Without it, a save never undoes a delete. */
  restore?: boolean;
}

/**
 * Store `row` and queue it for the server, in one transaction, and return the row as stored.
 *
 * - Only the table's own fields are kept (RECORD_FIELDS), so a record decorated for display
 *   never carries its extras into the store or to the server.
 * - `createdAt` stays as first stored; `updatedAt` is stamped now.
 * - A save onto a deleted record changes nothing and returns the tombstone, unless `restore`
 *   is set: an out-of-date copy saved after a delete must not bring the record back, nor
 *   turn its queued delete into a save.
 */
export async function save<T extends RasikaTable>(
  table: T,
  row: RasikaRows[T],
  { db = defaultDb, restore = false }: SaveOptions = {},
): Promise<RasikaRows[T]> {
  return db.transaction('rw', [db.table(table), db.outbox], async () => {
    const current = (await db.table(table).get(row.id)) as RasikaRows[T] | undefined;
    if (current?.deletedAt != null && !restore) return current;
    const stored = {
      ...ownFields(table, row),
      createdAt: current?.createdAt ?? row.createdAt,
      updatedAt: new Date().toISOString(),
      ...(restore ? { deletedAt: null } : {}),
    } as RasikaRows[T];
    await db.table(table).put(stored);
    await enqueue(db, table, stored, 'save');
    return stored;
  });
}

/**
 * Delete a record by saving it as a tombstone: the full row with `deletedAt` set, so a delete
 * syncs as an upsert (outside voice 8). Returns the tombstone, or undefined when there is no
 * such record. Deleting a tombstone again changes and queues nothing.
 */
export async function remove<T extends RasikaTable>(
  table: T,
  id: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<RasikaRows[T] | undefined> {
  return db.transaction('rw', [db.table(table), db.outbox], async () => {
    const current = (await db.table(table).get(id)) as RasikaRows[T] | undefined;
    if (!current || current.deletedAt != null) return current;
    const now = new Date().toISOString();
    const tombstone = { ...current, deletedAt: now, updatedAt: now };
    await db.table(table).put(tombstone);
    await enqueue(db, table, tombstone, 'remove');
    return tombstone;
  });
}

function ownFields<T extends RasikaTable>(table: T, row: RasikaRows[T]): Partial<RasikaRows[T]> {
  const kept: Record<string, unknown> = {};
  for (const field of Object.keys(RECORD_FIELDS[table])) {
    if (field in row) kept[field] = (row as unknown as Record<string, unknown>)[field];
  }
  return kept as Partial<RasikaRows[T]>;
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
