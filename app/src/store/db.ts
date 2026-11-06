// The phone store (ADR 0002). All Dexie access lives in app/src/store/ (constitution,
// Boundaries), and every write goes through mutate.ts.

import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Appearance,
  Artist,
  Event,
  Item,
  Link,
  RasikaRow,
  RasikaTable,
  Sabha,
  ScheduleEntry,
  SharedArtist,
  SharedSabha,
} from '../model';
import type { RejectCode } from '../model/sync-payloads';

export const DB_NAME = 'carnatic-wrapped';

/** One change waiting for the server (data-model.md "Phone-only records"). */
export interface OutboxEntry {
  /** Queue order, assigned by IndexedDB. */
  seq?: number;
  /** The idempotency key the server records (FR-015). */
  opId: string;
  table: RasikaTable;
  recordId: string;
  op: 'save' | 'remove';
  /** The full row; a delete is the row with `deletedAt` set. */
  row: RasikaRow;
  queuedAt: string;
  /** Null until the first push attempt. An entry sent once is never changed (eng review D8). */
  firstSentAt: string | null;
  /**
   * The record's server `seq` this op is based on (eng review D11), stamped from `serverSeqs`
   * when the entry is first sent and kept for every retry, so a retried push repeats it.
   * Absent until then.
   */
  baseSeq?: number;
}

/**
 * What the phone knows of one record's server copy (contracts/sync-api.md, "Pull"). `seq` is the
 * last server `seq` this phone wrote or applied: the base of its next op. `held` is a newer
 * server version a pull skipped because the record had a pending or rejected op (eng review
 * D4); it is kept, since the cursor has moved past it, for "keep the server's" and as the base
 * for "keep mine" (eng review D11). It never becomes `seq` on its own.
 */
export interface ServerSeq {
  table: RasikaTable;
  id: string;
  seq: number;
  held: { seq: number; row: RasikaRow } | null;
}

/**
 * A pushed op the server rejected (contracts/sync-api.md, "Push"). It has left the outbox, so
 * it is never re-sent in a loop, but its record stays in the unsynced count and in "needs
 * attention" until the rasika fixes or discards it (constitution II, outside voice 7).
 */
export interface AttentionEntry {
  opId: string;
  table: RasikaTable;
  recordId: string;
  /** The row as pushed. */
  row: RasikaRow;
  code: RejectCode;
  message: string;
  rejectedAt: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class WrappedDB extends Dexie {
  events!: EntityTable<Event, 'id'>;
  appearances!: EntityTable<Appearance, 'id'>;
  items!: EntityTable<Item, 'id'>;
  artists!: EntityTable<Artist, 'id'>;
  sabhas!: EntityTable<Sabha, 'id'>;
  links!: EntityTable<Link, 'id'>;
  sharedArtists!: EntityTable<SharedArtist, 'id'>;
  sharedSabhas!: EntityTable<SharedSabha, 'id'>;
  schedule!: EntityTable<ScheduleEntry, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'seq'>;
  meta!: EntityTable<MetaEntry, 'key'>;
  serverSeqs!: Table<ServerSeq, [RasikaTable, string]>;
  attention!: EntityTable<AttentionEntry, 'opId'>;

  constructor(name = DB_NAME) {
    // Strict durability: a write is on disk before its transaction completes, so a save
    // survives a force-close the moment it returns (FR-003, outside voice 12).
    super(name, { chromeTransactionDurability: 'strict' });
    this.version(1).stores({
      events: 'id, status, date, sabhaId, scheduleEntryId',
      appearances: 'id, eventId, artistId',
      items: 'id, eventId, [eventId+position]',
      artists: 'id, name, mergedIntoId',
      sabhas: 'id, name, mergedIntoId',
      links: 'id, [ownTable+ownId]',
      sharedArtists: 'id, name',
      sharedSabhas: 'id, name',
      schedule: 'id, date',
      outbox: '++seq, opId, recordId',
      meta: 'key',
    });
    // Sync (T078): what the phone knows of each record's server copy, and rejected ops.
    this.version(2).stores({
      serverSeqs: '[table+id]',
      attention: 'opId, [table+recordId]',
    });
  }
}

export const db = new WrappedDB();
