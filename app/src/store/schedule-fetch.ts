// Fetching the Schedule (T060, T124; contracts/schedule-feed.md, "Delivery"): the one seam that
// knows where the feed lives and how to ask for it. Everything else sees only `startScheduleFetch`
// and `fetchSchedule`, and stores the file with an opaque tag (store/schedule.ts `ScheduleMeta`).
// The server is the public-data project, the logger's, which holds the catalog (ADR 0009), never
// the personal-data one sync talks to: its `schedule` Edge Function serves a Season with the
// file's sha256 as its `ETag`, so the phone sends the stored tag as `If-None-Match` and an
// unchanged Schedule comes back as `304` with no body. No sign-in: the listings are public. The
// logging path never waits for it, and a failed fetch keeps the last stored copy.

import { db as defaultDb, type WrappedDB } from './db';
import {
  applySchedule,
  readScheduleFile,
  scheduleMeta,
  storeSchedule,
  type ScheduleFile,
} from './schedule';

/**
 * The public-data project for this build, or null for a build with none: the deployed build gets
 * it from tools/deploy/deploy.sh; tests, e2e and the hill-climb rig always build without it.
 */
const PUBLIC_DATA_URL: string | null = import.meta.env.VITE_PUBLIC_DATA_URL || null;

/**
 * The Season the phone asks for on `now`, by its local date: from July, the one that starts that
 * year (2026-27 from 1 July 2026); before July, the one that started the year before.
 */
export function seasonOn(now: Date): string {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

/** Where `season` is served on the public-data project at `base`; null when there is none. */
export function scheduleUrl(base: string | null | undefined, season: string): string | null {
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/functions/v1/schedule/${encodeURIComponent(season)}`;
}

export type Fetched =
  /** A new file was stored, and applied to the Events made from it. */
  | 'updated'
  /** The server's file is the one stored (`304`), or an older copy of it. */
  | 'unchanged'
  /** No answer, an error, no file for the Season yet, or one this reader can't use: the stored copy stays. */
  | 'failed';

export interface FetchOptions {
  url: string;
  /** The Season `url` serves. A file for any other is refused, the stored copy kept. */
  season: string;
  db?: WrappedDB;
  fetch?: typeof globalThis.fetch;
}

/** What one download gives: a changed file with its tag, the stored one again, or nothing. */
type Downloaded = { file: ScheduleFile; tag: string | null } | 'unchanged' | 'failed';

/**
 * The transport, and all it knows: ask `url` for the file, with the stored tag (the `ETag` it
 * came with, the file's sha256) as `If-None-Match`. Never throws.
 */
async function download(
  url: string,
  storedTag: string | null,
  fetch: typeof globalThis.fetch,
): Promise<Downloaded> {
  try {
    const headers: Record<string, string> = {};
    if (storedTag) headers['If-None-Match'] = storedTag;
    // `no-store`: the browser's cache is neither read nor written, so the stored copy and its tag
    // are the only cache, and a `304` reaches this code as it is.
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (response.status === 304) return 'unchanged';
    if (!response.ok) return 'failed';
    const file = readScheduleFile(await response.json());
    return file ? { file, tag: response.headers.get('ETag') } : 'failed';
  } catch {
    return 'failed';
  }
}

/** Fetch the Schedule once, store a changed file, and apply it. Never throws. */
export async function fetchSchedule({
  url,
  season,
  db = defaultDb,
  fetch = globalThis.fetch.bind(globalThis),
}: FetchOptions): Promise<Fetched> {
  let got: Downloaded;
  try {
    got = await download(url, (await scheduleMeta(db))?.tag ?? null, fetch);
  } catch {
    return 'failed';
  }
  if (typeof got === 'string') return got;
  // A file of another Season, uploaded by mistake under this one's name, would replace the
  // stored Schedule and leave every corrected file refused as an earlier Season (Codex, T124).
  if (got.file.season !== season) return 'failed';
  try {
    if (!(await storeSchedule(got.file, got.tag, { db }))) return 'unchanged';
  } catch {
    return 'failed';
  }
  await applySchedule({ db }).catch(() => undefined);
  return 'updated';
}

let started = false;

/**
 * Keep the Schedule current in the background: the stored copy is applied at launch (an apply a
 * force-close cut short finishes then), then the Season of the day is fetched now and each time
 * the phone comes back online. A build with no public-data URL fetches nothing. Nothing waits
 * on it.
 */
export function startScheduleFetch(
  base: string | null = PUBLIC_DATA_URL,
  db: WrappedDB = defaultDb,
  now: () => Date = () => new Date(),
) {
  if (started) return;
  started = true;
  void applySchedule({ db }).catch(() => undefined);
  if (scheduleUrl(base, seasonOn(now())) === null) return;
  const run = () => {
    const season = seasonOn(now());
    const url = scheduleUrl(base, season);
    if (url && navigator.onLine) void fetchSchedule({ url, season, db });
  };
  run();
  window.addEventListener('online', run);
}
