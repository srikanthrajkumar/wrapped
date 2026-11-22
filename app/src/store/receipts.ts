// Deletion receipts for Undo (eng review D1 and D7; DESIGN.md "Deleting"). Each delete writes,
// in the same transaction as its tombstones, a receipt naming exactly what it removed and when.
// Undo checks that every record is still the tombstone that delete made, then consumes the
// receipt, so a receipt survives a crash and a stale or replayed Undo restores nothing.

import { newId, type Event, type RasikaTable } from '../model';
import type { MetaEntry, WrappedDB } from './db';
import type { Birth } from './events';
import type { LoggingNote } from './logging-note';

/**
 * Undo is only for whole things: a Concert, an Item, an Artist (the Maintainer, 2026-11-25).
 * The Shortlist's Undo is an `event` receipt too. `fill`: a blank Concert was filled from a
 * listing and taken back, and Undo brings that Concert back (docs/design/log-entry.md).
 */
export type DeletionKind = 'item' | 'appearance' | 'event' | 'fill';

/** What a `fill` took from the blank Concert and gave the listing's Event, for Undo. */
export interface Filled {
  /** The blank Concert as it was, to bring back. */
  blank: Event;
  /** Who the listing is known by, for the bar: "NJ Nandini". */
  lead: string;
  /** The listing's Event was made by the fill (else it was the rasika's already). */
  made: boolean;
  /** The Event's own fields before the fill, when it was the rasika's already. */
  before: Pick<Event, 'status' | 'touched' | 'scheduleChanged' | 'note'> | null;
  /** The Items moved, with their places in the blank Concert. */
  moved: { id: string; position: number }[];
  /** The blank Concert's Item draft moved with them. */
  draft: boolean;
  /** Its logging note moved with them. */
  logging: boolean;
  /** Each one's logging note before the fill, put back by Undo. */
  loggingBlank?: LoggingNote | null;
  loggingBefore?: LoggingNote | null;
  /**
   * What the blank Concert was born with, as Season's + noted it (screens/new-concert.ts), so
   * Undo notes it as new again: as born when it was untouched, else as first born, so an edit
   * made to it (a late log's time) keeps it for good.
   */
  birth?: (Birth & { tappedAt: string }) | null;
}

const KINDS: readonly string[] = ['item', 'appearance', 'event', 'fill'] satisfies DeletionKind[];

/**
 * Whether a receipt is of a kind Undo still restores. A `piece` or `title` receipt written by an
 * earlier build (a piece of an Item removed, a title taken by a change to Concert) is not: it is
 * dropped quietly, never offered.
 */
export function undoableKind(kind: unknown): kind is DeletionKind {
  return typeof kind === 'string' && KINDS.includes(kind);
}

export interface DeletionReceipt {
  id: string;
  kind: DeletionKind;
  /** The Event the deletion belongs to: the deleted Event itself for an Event delete. */
  eventId: string;
  /**
   * The Item's number, or the Appearance's place in the order added, when deleted; null for an
   * Event.
   */
  position: number | null;
  /** Every record the delete tombstoned, with the `deletedAt` it stamped. */
  records: { table: RasikaTable; id: string; deletedAt: string | null }[];
  /** For a `fill` receipt: what it moved. Its records are the listing's Event, live, and the
   *  blank Concert's tombstone when it left one. */
  fill?: Filled;
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

/** Read a receipt without taking it, inside the caller's transaction. */
export async function peekReceipt(db: WrappedDB, id: string): Promise<DeletionReceipt | undefined> {
  return (await db.meta.get(keyOf(id)))?.value as DeletionReceipt | undefined;
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
  const receipt = await peekReceipt(db, id);
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

/**
 * An Event's receipts for its Items and Appearances, newest first ("Recently deleted"). A receipt
 * of a retired kind, left by an earlier build, is never listed; nor is a fill, whose Undo lives
 * only as long as its bar.
 */
export async function listReceipts(eventId: string, db: WrappedDB): Promise<DeletionReceipt[]> {
  return (await eventReceipts(eventId, db)).filter(
    (receipt) => undoableKind(receipt.kind) && receipt.kind !== 'fill',
  );
}

async function eventReceipts(eventId: string, db: WrappedDB): Promise<DeletionReceipt[]> {
  return (await allReceipts(db))
    .filter((receipt) => receipt.eventId === eventId && receipt.kind !== 'event')
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Forget an Event's Item and Appearance receipts: the rasika has left the Event (D7). Those in
 * `keep` stay: a failed Undo's bar still needs its receipt.
 */
export async function clearReceipts(
  eventId: string,
  db: WrappedDB,
  keep: ReadonlySet<string> = new Set(),
): Promise<void> {
  const keys = (await eventReceipts(eventId, db))
    .filter((receipt) => !keep.has(receipt.id))
    .map((receipt) => keyOf(receipt.id));
  await db.meta.bulkDelete(keys);
}

/** Forget one receipt, as when its Undo bar runs out on home. */
export async function dropReceipt(id: string, db: WrappedDB): Promise<void> {
  await db.meta.delete(keyOf(id));
}

/**
 * Forget receipts older than `maxAgeMs`, so a crash mid-Undo never leaves them for good, except
 * those in `keep`: a failed Undo's bar, kept across reloads, still needs its receipt. A receipt of
 * a retired kind, left by an earlier build, goes whatever its age.
 */
export async function pruneReceipts(
  maxAgeMs: number,
  db: WrappedDB,
  now = Date.now(),
  keep: ReadonlySet<string> = new Set(),
) {
  const cutoff = new Date(now - maxAgeMs).toISOString();
  const keys = (await allReceipts(db))
    .filter(
      (receipt) => !keep.has(receipt.id) && (!undoableKind(receipt.kind) || receipt.at < cutoff),
    )
    .map((receipt) => keyOf(receipt.id));
  await db.meta.bulkDelete(keys);
}
