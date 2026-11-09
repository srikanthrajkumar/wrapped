// The season export, format 1 (contracts/season-export.md; T050, FR-019). Built entirely from
// the phone store, with no network, so it works offline and from any screen that holds data.
// A rescue Export from a "Not saved on this phone" line adds the values the phone could not
// store, read from the screen and never written to the database (eng review D6).

import { db as defaultDb, type WrappedDB } from './db';
import { CATALOG_VERSION_KEY } from './catalog-version';
import { countUnsynced } from './outbox';

export interface NotSavedValue {
  table: string;
  id: string;
  field: string;
  value: unknown;
  enteredAt: string;
  /** Typed, being written, failed, or written and not yet seen in the store. */
  state?: 'typed' | 'saving' | 'failed' | 'unconfirmed';
}

export interface SeasonExport {
  format: 1;
  exportedAt: string;
  appVersion: string;
  catalogVersion: string | null;
  /** Null only when the store could not be read (`storeUnreadable`). */
  unsyncedOps: number | null;
  events: unknown[];
  appearances: unknown[];
  items: unknown[];
  artists: unknown[];
  sabhas: unknown[];
  links: unknown[];
  notSaved?: NotSavedValue[];
  /** Present only when the store itself could not be read: the arrays are then empty. */
  storeUnreadable?: { error: string };
  /**
   * Present only when the store was still opening and didn't answer in time: the arrays are
   * empty, but the season is likely still on the phone, readable once it opens.
   */
  storeTimedOut?: { error: string };
}

/** An ISO timestamp with the phone's own offset, as in "2026-12-14T21:30:00+05:30". */
export function localTimestamp(date = new Date()): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}

export const LAST_EXPORT_KEY = 'lastExport';

/** The last Export that held the season and was handed over, by its `exportedAt`. */
export interface LastExport {
  at: string;
}

/** Recorded once a file holding the season has been handed over, never before (Settings). */
export async function recordLastExport(at: string, db: WrappedDB = defaultDb): Promise<void> {
  await db.meta.put({ key: LAST_EXPORT_KEY, value: { at } satisfies LastExport });
}

export async function readLastExport(db: WrappedDB = defaultDb): Promise<LastExport | null> {
  return ((await db.meta.get(LAST_EXPORT_KEY))?.value as LastExport | undefined) ?? null;
}

/** How long an Export waits for the store: a db.open blocked by another tab never answers. */
const EXPORT_TIMEOUT_MS = 10_000;

/**
 * The whole season as stored, tombstones included, in one read transaction so the file is one
 * consistent copy. With `notSaved`, the stranded values come as their own labelled section.
 * Fails, rather than hangs, when the store doesn't answer within `timeoutMs`.
 */
export async function buildExport({
  db = defaultDb,
  appVersion,
  notSaved,
  now = new Date(),
  timeoutMs = EXPORT_TIMEOUT_MS,
}: {
  db?: WrappedDB;
  appVersion: string;
  notSaved?: NotSavedValue[];
  now?: Date;
  timeoutMs?: number;
}): Promise<SeasonExport> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`the phone store didn't answer within ${timeoutMs / 1000} s`);
      reject(Object.assign(error, { name: 'TimeoutError' }));
    }, timeoutMs);
  });
  try {
    return await Promise.race([readSeason(db, appVersion, notSaved, now), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function readSeason(
  db: WrappedDB,
  appVersion: string,
  notSaved: NotSavedValue[] | undefined,
  now: Date,
): Promise<SeasonExport> {
  return db.transaction(
    'r',
    [
      db.events,
      db.appearances,
      db.items,
      db.artists,
      db.sabhas,
      db.links,
      db.outbox,
      db.attention,
      db.meta,
    ],
    async () => ({
      format: 1 as const,
      exportedAt: localTimestamp(now),
      appVersion,
      catalogVersion:
        ((await db.meta.get(CATALOG_VERSION_KEY))?.value as string | undefined) ?? null,
      unsyncedOps: await countUnsynced(db),
      events: await db.events.toArray(),
      appearances: await db.appearances.toArray(),
      items: await db.items.toArray(),
      artists: await db.artists.toArray(),
      sabhas: await db.sabhas.toArray(),
      links: await db.links.toArray(),
      ...(notSaved && notSaved.length > 0 ? { notSaved } : {}),
    }),
  );
}

/**
 * A rescue Export, whatever happens: the stored season when the store can be read, else (the
 * database closed, lost as in WebKit's "Connection to Indexed Database server lost", or not
 * answering) a file with empty arrays, the unsaved values and a `storeUnreadable` marker (or
 * `storeTimedOut`, when it was only slow to answer), so
 * values the phone could not store still leave it. Only a rescue Export comes here: a plain one
 * of an unreadable store fails visibly instead (screens/components/export-file.ts).
 */
export async function exportOrRescue(options: {
  db?: WrappedDB;
  appVersion: string;
  notSaved?: NotSavedValue[];
  now?: Date;
  timeoutMs?: number;
}): Promise<SeasonExport> {
  try {
    return await buildExport(options);
  } catch (error) {
    const { appVersion, notSaved, now = new Date() } = options;
    const reason = {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
    const slow = error instanceof Error && error.name === 'TimeoutError';
    return {
      format: 1,
      exportedAt: localTimestamp(now),
      appVersion,
      catalogVersion: null,
      unsyncedOps: null,
      events: [],
      appearances: [],
      items: [],
      artists: [],
      sabhas: [],
      links: [],
      ...(notSaved && notSaved.length > 0 ? { notSaved } : {}),
      ...(slow ? { storeTimedOut: reason } : { storeUnreadable: reason }),
    };
  }
}
