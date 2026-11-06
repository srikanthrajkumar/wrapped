// "Needs attention": ops the server rejected (contracts/sync-api.md, "Push"). Each record keeps
// its row on the phone and stays in the unsynced count until the rasika chooses here
// (constitution II, outside voice 7). Nothing in this file talks to the server; each choice
// queues or settles locally, and the next sync carries it.

import type { RasikaRow, RasikaTable } from '../model';
import type { RejectCode } from '../model/sync-payloads';
import { remapPulledRow } from '../catalog/upgrade';
import type { Remap } from '../catalog/load';
import { db as defaultDb, type AttentionEntry, type WrappedDB } from './db';
import { enqueue } from './mutate';
import { RuleError } from './rules';

export interface AttentionView {
  opId: string;
  table: RasikaTable;
  recordId: string;
  code: RejectCode;
  message: string;
  rejectedAt: string;
  /** The row on the phone now, which "keep mine" and "try again" send. */
  local: RasikaRow | null;
  /**
   * For a `conflict`: the server's newer version, once a pull has seen it; "keep mine" and
   * "keep the server's" wait for it.
   */
  server: RasikaRow | null;
}

/** Every record needing attention, oldest rejection first. */
export async function listAttention(db: WrappedDB = defaultDb): Promise<AttentionView[]> {
  const tables = [db.attention, db.serverSeqs, ...tablesOf(db)];
  return db.transaction('r', tables, async () => {
    const entries = await db.attention.toArray();
    entries.sort((a, b) => a.rejectedAt.localeCompare(b.rejectedAt));
    const views: AttentionView[] = [];
    for (const entry of entries) {
      const local = ((await db.table(entry.table).get(entry.recordId)) as RasikaRow) ?? null;
      const known = await db.serverSeqs.get([entry.table, entry.recordId]);
      views.push({
        opId: entry.opId,
        table: entry.table,
        recordId: entry.recordId,
        code: entry.code,
        message: entry.message,
        rejectedAt: entry.rejectedAt,
        local,
        server: known?.held?.row ?? null,
      });
    }
    return views;
  });
}

function tablesOf(db: WrappedDB) {
  return [db.events, db.appearances, db.items, db.artists, db.sabhas];
}

async function entryFor(db: WrappedDB, opId: string): Promise<AttentionEntry> {
  const entry = await db.attention.get(opId);
  if (!entry) throw new RuleError([`nothing needs attention for op ${opId}`]);
  return entry;
}

async function settle(db: WrappedDB, entry: AttentionEntry) {
  await db.attention.where({ table: entry.table, recordId: entry.recordId }).delete();
}

/**
 * "Keep mine" for a `conflict`: send the phone's row again, based on the server's newer version,
 * so it replaces that version (eng review D11). Needs the server's version from a pull.
 */
export async function keepMine(opId: string, db: WrappedDB = defaultDb): Promise<void> {
  await db.transaction(
    'rw',
    [db.attention, db.serverSeqs, db.outbox, ...tablesOf(db)],
    async () => {
      const entry = await entryFor(db, opId);
      const known = await db.serverSeqs.get([entry.table, entry.recordId]);
      if (entry.code === 'conflict') {
        if (!known?.held) throw new RuleError(['the server’s version has not been pulled yet']);
        await db.serverSeqs.put({ ...known, seq: known.held.seq, held: null });
      }
      const local = ((await db.table(entry.table).get(entry.recordId)) as RasikaRow) ?? entry.row;
      await settle(db, entry);
      await enqueue(db, entry.table, local, local.deletedAt === null ? 'save' : 'remove');
    },
  );
}

/**
 * "Try again" for a rejection other than `conflict`, such as `missing_event` once the Event is on
 * the server: queue the phone's row again as a new op.
 */
export const tryAgain = keepMine;

/**
 * "Keep the server's" for a `conflict`: store the server's version on the phone and drop the
 * phone's unsent changes to the record. Needs the server's version from a pull.
 */
export async function keepServers(
  opId: string,
  { db = defaultDb, remap }: { db?: WrappedDB; remap?: Remap } = {},
): Promise<void> {
  await db.transaction(
    'rw',
    [db.attention, db.serverSeqs, db.outbox, ...tablesOf(db)],
    async () => {
      const entry = await entryFor(db, opId);
      if (entry.code !== 'conflict') {
        throw new RuleError(['only a conflict has a server version to keep']);
      }
      const known = await db.serverSeqs.get([entry.table, entry.recordId]);
      if (!known?.held) throw new RuleError(['the server’s version has not been pulled yet']);
      const row = remap
        ? remapPulledRow(entry.table, known.held.row as never, remap)
        : known.held.row;
      await db.table(entry.table).put(row);
      await db.serverSeqs.put({ ...known, seq: known.held.seq, held: null });
      await db.outbox
        .where('recordId')
        .equals(entry.recordId)
        .filter((queued) => queued.table === entry.table && queued.firstSentAt === null)
        .delete();
      await settle(db, entry);
    },
  );
}

/**
 * "Discard": take the record out of "needs attention" and the unsynced count. Its row stays on
 * the phone as it is, and reaches the server with its next edit.
 */
export async function discard(opId: string, db: WrappedDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.attention, async () => {
    await settle(db, await entryFor(db, opId));
  });
}
