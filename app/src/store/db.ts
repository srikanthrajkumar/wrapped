// The phone store (ADR 0002). All Dexie access lives in app/src/store/ (constitution,
// Boundaries), and every write goes through mutate.ts.

import Dexie, {
  RangeSet,
  type DBCore,
  type EntityTable,
  type ObservabilitySet,
  type Table,
} from 'dexie';
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
import { upgradeItemShape } from '../model/item-shape';
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
  /**
   * The op's place in the outbox (`OutboxEntry.seq`). A record keeps its latest rejection, and
   * an ack clears only a rejection of the same op or an earlier one.
   */
  queueSeq: number;
  table: RasikaTable;
  recordId: string;
  /** The row as pushed. */
  row: RasikaRow;
  /** The server's rejection code, or `bad_request` for an op in a batch the server refused. */
  code: AttentionCode;
  message: string;
  rejectedAt: string;
}

export type AttentionCode = RejectCode | 'bad_request';

/**
 * A newer build of the app has this store: this build may not know its records' shape, so it
 * must not write to it (a save would drop the fields it doesn't know, and the outbox is shared).
 */
export class NewerStoreError extends Error {
  constructor() {
    super('A newer version of the app has opened this store');
    this.name = 'NewerStoreError';
  }
}

/**
 * Whether `error` says the browser dropped this page's connection to the store: WebKit's
 * "Connection to Indexed Database server lost" (an UnknownError) after hours in the background,
 * a connection closed under a transaction (InvalidStateError), or Dexie's DatabaseClosedError.
 * Dexie may wrap the browser's error as the `inner` of its own. The store is still there; a new
 * connection reaches it.
 */
export function isConnectionLost(error: unknown): boolean {
  let at: unknown = error;
  for (let depth = 0; at && typeof at === 'object' && depth < 4; depth++) {
    const { name, message, inner } = at as { name?: unknown; message?: unknown; inner?: unknown };
    if (at instanceof NewerStoreError) return false;
    if (typeof name === 'string' && LOST_NAMES.has(name)) return true;
    if (typeof message === 'string' && LOST_MESSAGE.test(message)) return true;
    at = inner;
  }
  return false;
}

const LOST_NAMES = new Set(['UnknownError', 'InvalidStateError', 'DatabaseClosedError']);
const LOST_MESSAGE = /indexed ?database server lost|database connection is clos/i;

/** Waits before each try at a new connection: about a second in all (store/health.ts). */
export const REOPEN_WAITS_MS = [0, 250, 750] as const;
/** How long a check of the connection may take before it counts as lost. */
export const PROBE_TIMEOUT_MS = 500;
/** How long one try at a new connection may take: an open WebKit never answers is given up. */
export const OPEN_ATTEMPT_MS = 1500;
/** How long a reopen may take in all, its tries and waits included, before the rescue screen. */
export const REOPEN_LIMIT_MS = 4000;

/** A new connection didn't open in time (OPEN_ATTEMPT_MS, REOPEN_LIMIT_MS). */
export class OpenTimeoutError extends Error {
  constructor(ms: number) {
    super(`The store did not open within ${ms} ms`);
    this.name = 'OpenTimeoutError';
  }
}

/** The error every write gets once the store is given up (WrappedDB.lost). */
const givenUp = () =>
  new Dexie.DatabaseClosedError('The store connection was lost; reload the app to open it again');

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `promise`, or an OpenTimeoutError once `ms` have passed. The promise itself runs on. */
function within<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OpenTimeoutError(ms)), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
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
    // Any release that changes a record's shape bumps the version (contracts/sync-api.md,
    // "Errors"), so tabs still running an older build close their store (below). 3: Dance and
    // Harikatha, their Roles, and an Appearance's `group` (T119-T122), which came without a bump.
    this.version(3).stores({});
    // 4: an Appearance's `support` (2026-11-10), with no index change. The stored Schedule was
    // read by a build that dropped `support`, and its tag would answer 304 to the same file: the
    // tag goes, so the next fetch reads the file again whole. The entries stay until then.
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        const meta = tx.table<{ key: string; value: unknown }, string>('meta');
        const stored = await meta.get('schedule');
        if (stored && typeof stored.value === 'object' && stored.value !== null) {
          await meta.put({ key: 'schedule', value: { ...stored.value, tag: null } });
        }
      });
    // 5: a Manodharma part's Ragas and the Layavinyasam's nadais become lists, and thirteen
    // Roles join (ADR 0012). Every stored copy of an Item that may still be written or read back
    // is rewritten in this one transaction: the Items themselves, tombstones included (an Undo
    // restores them); outbox entries never sent; rejected ops in "needs attention"; and held
    // server versions. An entry sent at least once is never changed (eng review D8): the server
    // may hold it under its opId, and it goes out as it was. Pulled rows are upgraded as they
    // arrive (store/sync.ts), so an old row on the server is never stored in its old shape.
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table<Item, string>('items')
          .toCollection()
          .modify((item, ref) => {
            const upgraded = upgradeItemShape(item);
            if (upgraded !== item) ref.value = upgraded;
          });
        await tx
          .table<OutboxEntry, number>('outbox')
          .filter((entry) => entry.table === 'items' && entry.firstSentAt === null)
          .modify((entry) => {
            entry.row = upgradeItemShape(entry.row as Item);
          });
        await tx
          .table<AttentionEntry, string>('attention')
          .filter((entry) => entry.table === 'items')
          .modify((entry) => {
            entry.row = upgradeItemShape(entry.row as Item);
          });
        await tx
          .table<ServerSeq, [RasikaTable, string]>('serverSeqs')
          .filter((known) => known.table === 'items' && known.held !== null)
          .modify((known) => {
            known.held = { ...known.held!, row: upgradeItemShape(known.held!.row as Item) };
          });
      });

    // A newer build is opening the store: close it for good, with no auto-open, so this build
    // never writes again; the screens ask for a reload (store/health.ts). Dexie's own handler
    // closes too, but reopens on the next write, and a reopen accepts the newer version.
    this.on('versionchange', () => {
      this.retired = true;
      this.close({ disableAutoOpen: true });
    });
    // Once given up (lost, below), no write reaches the store until the page reloads, on any
    // connection: one an abandoned open still makes later sets Dexie's `idbdb` all the same.
    this.use({
      stack: 'dbcore',
      name: 'given-up',
      create: (down: DBCore): DBCore => ({
        ...down,
        transaction: (stores, mode, options) => {
          if (this.gaveUp && mode === 'readwrite') throw givenUp();
          return down.transaction(stores, mode, options);
        },
      }),
    });
    // Write transactions run again once on a new connection when the browser dropped the old
    // one (healingTransaction, below). Set here, so callers keep Dexie's typing.
    (this as { transaction: unknown }).transaction = (...args: unknown[]) =>
      this.healingTransaction(args);
    // The same when this build opens a store a newer build already upgraded: Dexie would open it
    // at that version. Checked on every open, reopens included.
    this.on(
      'ready',
      () => {
        if (Math.floor(this.backendDB().version / 10) > this.verno) throw new NewerStoreError();
      },
      true,
    );
  }

  /** A newer build has the store: this one never opens it again (above). */
  private retired = false;
  /** The connection was lost for good and the rescue screen shows: nothing writes (lost). */
  private gaveUp = false;
  private reopening: Promise<void> | null = null;
  private lostListeners = new Set<(error: unknown) => void>();

  /**
   * Make sure the store answers, and if it doesn't, close the connection and open a new one:
   * up to three tries over about a second (REOPEN_WAITS_MS), never longer than REOPEN_LIMIT_MS
   * in all. A connection that answers is kept.
   * Callers at the same time share one attempt. Rejects when no new connection opened, and then
   * tells `whenLost` listeners first (store/health.ts shows the rescue screen).
   */
  reopen(): Promise<void> {
    if (this.gaveUp) return Promise.reject(givenUp());
    this.reopening ??= this.heal().finally(() => {
      this.reopening = null;
    });
    return this.reopening;
  }

  /** `listener` hears when the store's connection was lost and no new one would open. */
  whenLost(listener: (error: unknown) => void): () => void {
    this.lostListeners.add(listener);
    return () => void this.lostListeners.delete(listener);
  }

  /**
   * The connection is lost for good: the rescue screen shows (store/health.ts) and nothing
   * writes until "Try again" reloads the page. The store is closed with no auto-open, which
   * also rejects an open still pending (one WebKit never answered), so a write waiting on it
   * fails into the journal ("Not saved", kept for Export) instead of landing behind the rescue
   * screen. Dexie still sets `idbdb` if that open succeeds late; the given-up guards
   * (healingTransaction, the 'given-up' middleware) refuse any write on it.
   */
  private lost(error: unknown): void {
    if (!this.gaveUp) {
      this.gaveUp = true;
      this.close({ disableAutoOpen: true });
    }
    this.lostListeners.forEach((listener) => listener(error));
  }

  /**
   * The reopen, bounded: each open within OPEN_ATTEMPT_MS and the whole within REOPEN_LIMIT_MS,
   * so a reopen WebKit never answers still ends, in the rescue screen, never a blank page.
   */
  private async heal(): Promise<void> {
    const attempt = { expired: false };
    try {
      await within(this.tryReopen(attempt), REOPEN_LIMIT_MS);
    } catch (error) {
      attempt.expired = true;
      this.lost(error);
      throw error;
    }
  }

  private async tryReopen(attempt: { expired: boolean }): Promise<void> {
    if (await this.answers()) return;
    let last: unknown = new Dexie.DatabaseClosedError();
    for (const ms of REOPEN_WAITS_MS) {
      if (ms) await wait(ms);
      // Given up (REOPEN_LIMIT_MS): the rescue screen shows, and nothing here closes or opens.
      if (attempt.expired) break;
      if (this.retired) throw new NewerStoreError();
      this.close({ disableAutoOpen: false });
      try {
        await within(this.open(), OPEN_ATTEMPT_MS);
        // Live queries that failed on the old connection wait for a change to read again:
        // this tells them everything may have changed, as Dexie does when it creates a store.
        Dexie.on.storagemutated.fire(this.everything());
        return;
      } catch (error) {
        last = error;
        if (
          error instanceof NewerStoreError ||
          (error as { inner?: unknown }).inner instanceof NewerStoreError
        )
          break;
      }
    }
    throw last;
  }

  /** Whether the open connection answers a read of one count, within PROBE_TIMEOUT_MS. */
  private answers(): Promise<boolean> {
    const idb = this.isOpen() ? this.backendDB() : null;
    if (!idb) return Promise.resolve(false);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), PROBE_TIMEOUT_MS);
      const done = (answered: boolean) => {
        clearTimeout(timer);
        resolve(answered);
      };
      try {
        const request = idb.transaction('meta', 'readonly').objectStore('meta').count();
        request.onsuccess = () => done(true);
        request.onerror = () => done(false);
      } catch {
        done(false);
      }
    });
  }

  private everything(): ObservabilitySet {
    const all: ObservabilitySet = {};
    for (const table of this.tables) {
      const prefix = `idb://${this.name}/${table.name}/`;
      all[prefix] = all[`${prefix}:dels`] = new RangeSet(-Infinity, [[[]]]);
      for (const index of table.schema.indexes) {
        if (index.name) all[prefix + index.name] = new RangeSet(-Infinity, [[[]]]);
      }
    }
    return all;
  }

  /**
   * A write transaction that fails because the browser dropped the connection (WebKit, after
   * hours in the background) is run again once on a new connection, so the save the rasika made
   * lands. The failed run wrote nothing (a transaction is all or nothing), and each write
   * scope reads what it changes, so running it again writes it once. When no new connection
   * opens, or the second run fails too, the error goes to the caller as before: the journal
   * keeps the value as "Not saved" (screens/save-feedback.ts), and the rescue screen offers it
   * for Export. Reads, and transactions inside another, are left to Dexie.
   */
  private healingTransaction(args: unknown[]): Promise<unknown> {
    const base = Dexie.prototype.transaction as (...args: unknown[]) => Promise<unknown>;
    const run = () => base.apply(this, args);
    const mode: unknown = args[0];
    const writes = typeof mode === 'string' && (mode.startsWith('rw') || mode === 'readwrite');
    if (!writes || Dexie.currentTransaction) return run();
    if (this.gaveUp) return Promise.reject(givenUp());
    return run().catch(async (error: unknown) => {
      if (!isConnectionLost(error) || this.retired) throw error;
      try {
        await this.reopen();
      } catch {
        throw error;
      }
      try {
        return await run();
      } catch (again) {
        if (isConnectionLost(again)) this.lost(again);
        throw again;
      }
    });
  }
}

export const db = new WrappedDB();
