// The phone store (ADR 0002). All Dexie access lives in app/src/store/ (constitution,
// Boundaries), and every write goes through mutate.ts.

import Dexie, { type EntityTable } from 'dexie';
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
  }
}

export const db = new WrappedDB();
