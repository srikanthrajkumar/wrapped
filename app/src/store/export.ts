// The season export, format 1 (contracts/season-export.md; T050, FR-019). Built entirely from
// the phone store, with no network, so it works offline and from any screen that holds data.
// A rescue Export from a "Not saved on this phone" line adds the values the phone could not
// store, read from the screen and never written to the database (eng review D6).

import { db as defaultDb, type WrappedDB } from './db';
import { CATALOG_VERSION_KEY } from './catalog-version';

export interface NotSavedValue {
  table: string;
  id: string;
  field: string;
  value: unknown;
  enteredAt: string;
}

export interface SeasonExport {
  format: 1;
  exportedAt: string;
  appVersion: string;
  catalogVersion: string | null;
  unsyncedOps: number;
  events: unknown[];
  appearances: unknown[];
  items: unknown[];
  artists: unknown[];
  sabhas: unknown[];
  links: unknown[];
  notSaved?: NotSavedValue[];
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

/**
 * The whole season as stored, tombstones included, in one read transaction so the file is one
 * consistent copy. With `notSaved`, the stranded values come as their own labelled section.
 */
export async function buildExport({
  db = defaultDb,
  appVersion,
  notSaved,
  now = new Date(),
}: {
  db?: WrappedDB;
  appVersion: string;
  notSaved?: NotSavedValue[];
  now?: Date;
}): Promise<SeasonExport> {
  return db.transaction(
    'r',
    [db.events, db.appearances, db.items, db.artists, db.sabhas, db.links, db.outbox, db.meta],
    async () => ({
      format: 1 as const,
      exportedAt: localTimestamp(now),
      appVersion,
      catalogVersion:
        ((await db.meta.get(CATALOG_VERSION_KEY))?.value as string | undefined) ?? null,
      unsyncedOps: await db.outbox.count(),
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
