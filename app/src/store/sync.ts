// The sync loop (T078; contracts/sync-api.md, "Sync order on the phone"; ADR 0003). It pushes the
// outbox oldest first, then pulls until the server has nothing more. Nothing on the logging path
// waits for it: saves only write the store, and the loop runs beside them (constitution I).
//
// What it promises, on the paths that could lose data (constitution II):
// - an op leaves the outbox only when the server acked or rejected it; a rejected op's row stays
//   in "needs attention" and in the unsynced count;
// - no failure (401, 409, 426, 400, a lost reply) touches the outbox or the season;
// - a pulled row never replaces a record that still has a pending or rejected op (eng review D4);
//   the server's version is held aside instead, because the cursor has moved past it.

import { newId, PULL_PAGE_LIMIT, RASIKA_TABLES, type RasikaRow, type RasikaTable } from '../model';
import type { PullChange, PullResponse, PushOp, PushResponse } from '../model/sync-payloads';
import { remapPulledRow } from '../catalog/upgrade';
import type { Remap } from '../catalog/load';
import { db as defaultDb, type OutboxEntry, type ServerSeq, type WrappedDB } from './db';
import { claimBatch } from './outbox';
import { SyncError, type SyncApi, type SyncFailure } from './sync-api';

export const DEVICE_ID_KEY = 'deviceId';
export const PULL_CURSOR_KEY = 'pullCursor';
export const LAST_SYNCED_KEY = 'lastSyncedAt';

export interface SyncOptions {
  db?: WrappedDB;
  /** The catalog's remap, applied to every pulled Item before it is stored (outside voice 6). */
  remap?: Remap;
}

/** This phone's id for the writer claim, made once and kept in `meta`. */
export async function deviceId(db: WrappedDB = defaultDb): Promise<string> {
  return db.transaction('rw', db.meta, async () => {
    const stored = (await db.meta.get(DEVICE_ID_KEY))?.value;
    if (typeof stored === 'string') return stored;
    const id = newId();
    await db.meta.put({ key: DEVICE_ID_KEY, value: id });
    return id;
  });
}

// Push

function toOp(entry: OutboxEntry): PushOp {
  return {
    opId: entry.opId,
    table: entry.table,
    baseSeq: entry.baseSeq ?? 0,
    row: entry.row,
  } as PushOp;
}

/**
 * Push one batch: the oldest ops, at most PUSH_BATCH_LIMIT. Returns the number of ops the
 * server answered, 0 when the outbox was empty. Throws SyncError, leaving the outbox as it was.
 */
export async function pushBatch(
  api: SyncApi,
  { db = defaultDb }: SyncOptions = {},
): Promise<number> {
  const batch = await claimBatch(undefined, db);
  if (batch.length === 0) return 0;
  let response: PushResponse;
  try {
    response = await api.push({ deviceId: await deviceId(db), ops: batch.map(toOp) });
  } catch (error) {
    if (error instanceof SyncError && error.failure.kind === 'bad_request') {
      const opIds = batch.map((entry) => entry.opId);
      throw new SyncError({ ...error.failure, opIds });
    }
    throw error;
  }
  return settlePush(db, batch, response);
}

/**
 * Settle a push's 200 answer in one transaction, in the batch's order:
 * - an acked op leaves the outbox, and its `seq` becomes the record's base; a held server
 *   version it supersedes is dropped, and so is any earlier rejection of the record;
 * - a rejected op leaves the outbox into "needs attention", with the row as pushed; a record
 *   keeps one entry there, its latest rejection.
 * An op the answer doesn't mention stays queued. Returns how many ops were answered.
 */
export async function settlePush(
  db: WrappedDB,
  batch: readonly OutboxEntry[],
  response: PushResponse,
): Promise<number> {
  const acked = new Map(response.acked.map((ack) => [ack.opId, ack.seq]));
  const rejected = new Map(response.rejected.map((rejection) => [rejection.opId, rejection]));
  const now = new Date().toISOString();
  let answered = 0;
  await db.transaction('rw', db.outbox, db.serverSeqs, db.attention, async () => {
    for (const entry of batch) {
      const seq = acked.get(entry.opId);
      const rejection = rejected.get(entry.opId);
      if (seq !== undefined) {
        await db.outbox.where('opId').equals(entry.opId).delete();
        await recordSeq(db, entry.table, entry.recordId, seq);
        await db.attention.where({ table: entry.table, recordId: entry.recordId }).delete();
        answered += 1;
      } else if (rejection) {
        await db.outbox.where('opId').equals(entry.opId).delete();
        // One entry per record: its latest rejection, with the row as last pushed.
        await db.attention.where({ table: entry.table, recordId: entry.recordId }).delete();
        await db.attention.put({
          opId: entry.opId,
          table: entry.table,
          recordId: entry.recordId,
          row: entry.row,
          code: rejection.code,
          message: rejection.message,
          rejectedAt: now,
        });
        answered += 1;
      }
    }
  });
  return answered;
}

/** Make `seq` the record's known server seq, unless the phone already knows a later one. */
async function recordSeq(db: WrappedDB, table: RasikaTable, id: string, seq: number) {
  const known = await db.serverSeqs.get([table, id]);
  if (known && known.seq >= seq) return;
  const held = known?.held && known.held.seq > seq ? known.held : null;
  await db.serverSeqs.put({ table, id, seq, held });
}

// Pull

const OWN_TABLES = new Set<string>(RASIKA_TABLES);

function isOwn(change: PullChange): change is PullChange & { table: RasikaTable; seq: number } {
  return OWN_TABLES.has(change.table);
}

/**
 * Apply one pulled page and store its cursor, in one transaction. An own row whose record has a
 * pending outbox op or a rejected op in "needs attention" is not applied: the local row is the
 * rasika's latest (only this device writes), and its op carries it to the server. Its server
 * version is held, for "keep the server's" and "keep mine", and never becomes the record's base
 * on its own, so a later push can't overwrite another device's edit unseen (eng review D11).
 */
export async function applyPullPage(
  db: WrappedDB,
  page: PullResponse,
  remap?: Remap,
): Promise<void> {
  const tables = [
    ...RASIKA_TABLES.map((table) => db.table(table)),
    db.links,
    db.sharedArtists,
    db.sharedSabhas,
    db.outbox,
    db.attention,
    db.serverSeqs,
    db.meta,
  ];
  await db.transaction('rw', tables, async () => {
    for (const change of page.changes) {
      if (isOwn(change)) {
        await applyOwn(db, change.table, change.seq, change.row, remap);
      } else if (change.table === 'links') {
        await db.links.put(change.row);
      } else if (change.table === 'sharedArtists') {
        await db.sharedArtists.put(change.row);
      } else {
        await db.sharedSabhas.put(change.row);
      }
    }
    await db.meta.put({ key: PULL_CURSOR_KEY, value: page.cursor });
  });
}

async function applyOwn(
  db: WrappedDB,
  table: RasikaTable,
  seq: number,
  row: RasikaRow,
  remap: Remap | undefined,
) {
  const known: ServerSeq | undefined = await db.serverSeqs.get([table, row.id]);
  if (known && known.seq >= seq) return;
  if (await hasLocalChanges(db, table, row.id)) {
    if (known?.held && known.held.seq >= seq) return;
    await db.serverSeqs.put({ table, id: row.id, seq: known?.seq ?? 0, held: { seq, row } });
    return;
  }
  const stored = remap ? remapPulledRow(table, row as never, remap) : row;
  await db.table(table).put(stored);
  await db.serverSeqs.put({ table, id: row.id, seq, held: null });
}

/** True while the record has an op in the outbox or a rejected op in "needs attention". */
export async function hasLocalChanges(
  db: WrappedDB,
  table: RasikaTable,
  id: string,
): Promise<boolean> {
  const queued = await db.outbox
    .where('recordId')
    .equals(id)
    .filter((entry) => entry.table === table)
    .count();
  if (queued > 0) return true;
  return (await db.attention.where({ table, recordId: id }).count()) > 0;
}

/** Pull from the stored cursor until `more` is false. Each page is applied as it arrives. */
export async function pullAll(api: SyncApi, { db = defaultDb, remap }: SyncOptions = {}) {
  let cursor = ((await db.meta.get(PULL_CURSOR_KEY))?.value as string | undefined) ?? '';
  for (;;) {
    const page = await api.pull({ cursor, limit: PULL_PAGE_LIMIT });
    await applyPullPage(db, page, remap);
    if (!page.more) return;
    if (page.cursor === cursor) {
      throw new SyncError({
        kind: 'refused',
        status: 200,
        code: 'stuck_cursor',
        message: 'The pull answered more without moving its cursor',
      });
    }
    cursor = page.cursor;
  }
}

/**
 * One full sync: push until the outbox is empty, then pull until the server has nothing more
 * (contracts/sync-api.md, "Sync order on the phone"). Throws SyncError at the first failure,
 * leaving whatever is not yet answered in the outbox.
 */
export async function syncOnce(api: SyncApi, options: SyncOptions = {}): Promise<void> {
  const db = options.db ?? defaultDb;
  for (;;) {
    const before = await db.outbox.count();
    if (before === 0) break;
    const answered = await pushBatch(api, options);
    if (answered === 0) {
      // A 200 that answered none of the batch would send it again forever.
      throw new SyncError({
        kind: 'refused',
        status: 200,
        code: 'unanswered',
        message: 'The server answered none of the pushed ops',
      });
    }
  }
  await pullAll(api, options);
  await db.meta.put({ key: LAST_SYNCED_KEY, value: new Date().toISOString() });
}

// The loop

/** What starts a sync (FR-014). */
export type SyncTrigger = 'start' | 'online' | 'visible' | 'save' | 'resume';

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'syncing' }
  /** A network error or 5xx; the loop tries again at `retryAt` (ms since the epoch). */
  | { state: 'waiting'; retryAt: number; failure: SyncFailure }
  /** Stopped until `resume()`, a sign-in, or the next launch; the outbox is kept. */
  | { state: 'stopped'; failure: SyncFailure };

export interface SyncLoopOptions extends SyncOptions {
  /** The server, signed in with a fresh token; null when no one is signed in (FR-018). */
  getApi: () => Promise<SyncApi | null>;
  /** The catalog's remap, read when each sync starts. */
  getRemap?: () => Remap | undefined;
  /** Backoff: the first wait's ceiling, and the longest (exponential, full jitter). */
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  now?: () => number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export interface SyncLoop {
  /** Ask for a sync. Single-flight: a request during a sync runs one more after it. */
  request(trigger: SyncTrigger): Promise<void>;
  /** Clear a stop (after a sign-in, a claim, or "try again") and sync. */
  resume(): Promise<void>;
  status(): SyncStatus;
  subscribe(listener: (status: SyncStatus) => void): () => void;
  /** Cancel a pending retry; for tests and teardown. */
  dispose(): void;
}

export function createSyncLoop(options: SyncLoopOptions): SyncLoop {
  const {
    getApi,
    getRemap,
    baseDelayMs = 2_000,
    maxDelayMs = 5 * 60_000,
    random = Math.random,
    now = Date.now,
    setTimer = (run, ms) => setTimeout(run, ms),
    clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  } = options;
  const db = options.db ?? defaultDb;
  let current: SyncStatus = { state: 'idle' };
  const listeners = new Set<(status: SyncStatus) => void>();
  let running: Promise<void> | null = null;
  let again = false;
  let attempt = 0;
  let timer: unknown = null;

  const set = (status: SyncStatus) => {
    current = status;
    for (const listener of listeners) listener(status);
  };

  const cancelRetry = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const runOnce = async () => {
    cancelRetry();
    set({ state: 'syncing' });
    try {
      const api = await getApi();
      if (!api) {
        set({ state: 'stopped', failure: { kind: 'signed_out' } });
        return;
      }
      await syncOnce(api, { db, remap: getRemap?.() ?? options.remap });
      attempt = 0;
      set({ state: 'idle' });
    } catch (error) {
      const failure: SyncFailure =
        error instanceof SyncError
          ? error.failure
          : { kind: 'network', status: 0, message: String(error) };
      // A request made during a failed run waits for the stop to clear or the retry.
      again = false;
      if (failure.kind !== 'network') {
        set({ state: 'stopped', failure });
        return;
      }
      const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      attempt += 1;
      const delay = Math.round(random() * ceiling);
      set({ state: 'waiting', retryAt: now() + delay, failure });
      timer = setTimer(() => {
        timer = null;
        void request('resume');
      }, delay);
    }
  };

  const drain = async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  };

  const request = (trigger: SyncTrigger): Promise<void> => {
    if (current.state === 'stopped' && trigger !== 'resume') {
      // A stop waits for the rasika (sign in, claim, update); only a missing session is
      // looked at again, since signing in clears it without any call to the server.
      if (current.failure.kind !== 'signed_out') return Promise.resolve();
    }
    if (current.state === 'waiting' && trigger === 'save') return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = drain().finally(() => {
      running = null;
    });
    return running;
  };

  return {
    request,
    resume: () => {
      if (current.state === 'stopped') set({ state: 'idle' });
      return request('resume');
    },
    status: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: cancelRetry,
  };
}
