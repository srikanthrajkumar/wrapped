// Deletion receipts for Undo (eng review D1 and D7; DESIGN.md "Deleting"). Each delete writes,
// in the same transaction as its tombstones, a receipt naming exactly what it removed and when.
// Undo checks that every record is still the tombstone that delete made, then consumes the
// receipt, so a receipt survives a crash and a stale or replayed Undo restores nothing.

import { newId, type RasikaTable } from '../model';
import type { MetaEntry, WrappedDB } from './db';

export type DeletionKind = 'item' | 'appearance' | 'event';

export interface DeletionReceipt {
  id: string;
  kind: DeletionKind;
  /** The Event the deletion belongs to: the deleted Event itself for an Event delete. */
  eventId: string;
  /** The Item's number or the Appearance's billing place when deleted; null for an Event. */
  position: number | null;
  /** Every record the delete tombstoned, with the `deletedAt` it stamped. */
  records: { table: RasikaTable; id: string; deletedAt: string }[];
  at: string;
}

const PREFIX = 'receipt:';
const keyOf = (id: string) => `${PREFIX}${id}`;

/** Write a receipt inside the caller's transaction (which must include `db.meta`). */
export async function writeReceipt(
  db: WrappedDB,
  receipt: Omit<DeletionReceipt, 'id' | 'at'>,
): Promise<DeletionReceipt> {
  const stored: DeletionReceipt = { ...receipt, id: newId(), at: new Date().toISOString() };
  await db.meta.put({ key: keyOf(stored.id), value: stored });
  return stored;
}

/**
 * Take a receipt for an Undo, inside the caller's transaction: it is returned and deleted only
 * when every record it names is still the tombstone it recorded. A receipt that is missing
 * (already used) restores nothing; one whose records changed since (restored and deleted again,
 * perhaps in another tab) is stale, so it is dropped and restores nothing either.
 */
export async function takeReceipt(
  db: WrappedDB,
  id: string,
  kind: DeletionKind,
): Promise<DeletionReceipt | null> {
  const receipt = (await db.meta.get(keyOf(id)))?.value as DeletionReceipt | undefined;
  if (!receipt || receipt.kind !== kind) return null;
  for (const record of receipt.records) {
    const row = (await db.table(record.table).get(record.id)) as
      { deletedAt: string | null } | undefined;
    if (row?.deletedAt !== record.deletedAt) {
      await db.meta.delete(keyOf(id));
      return null;
    }
  }
  await db.meta.delete(keyOf(id));
  return receipt;
}

async function allReceipts(db: WrappedDB): Promise<DeletionReceipt[]> {
  const rows: MetaEntry[] = await db.meta.where('key').startsWith(PREFIX).toArray();
  return rows.map((row) => row.value as DeletionReceipt);
}

/** An Event's receipts for its Items and Appearances, newest first ("Recently deleted"). */
export async function listReceipts(eventId: string, db: WrappedDB): Promise<DeletionReceipt[]> {
  return (await allReceipts(db))
    .filter((receipt) => receipt.eventId === eventId && receipt.kind !== 'event')
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Forget an Event's Item and Appearance receipts: the rasika has left the Event (D7). */
export async function clearReceipts(eventId: string, db: WrappedDB): Promise<void> {
  const keys = (await listReceipts(eventId, db)).map((receipt) => keyOf(receipt.id));
  await db.meta.bulkDelete(keys);
}

/** Forget one receipt, as when its Undo bar runs out on home. */
export async function dropReceipt(id: string, db: WrappedDB): Promise<void> {
  await db.meta.delete(keyOf(id));
}

/** Forget receipts older than `maxAgeMs`, so a crash mid-Undo never leaves them for good. */
export async function pruneReceipts(maxAgeMs: number, db: WrappedDB, now = Date.now()) {
  const cutoff = new Date(now - maxAgeMs).toISOString();
  const keys = (await allReceipts(db))
    .filter((receipt) => receipt.at < cutoff)
    .map((receipt) => keyOf(receipt.id));
  await db.meta.bulkDelete(keys);
}
