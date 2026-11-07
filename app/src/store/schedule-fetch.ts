// Fetching the Schedule (T060, contracts/schedule-feed.md "Delivery"): the one seam that knows
// where the feed lives and how to ask for it. Everything else sees only `startScheduleFetch` and
// `fetchSchedule`, and stores the file with an opaque tag (store/schedule.ts `ScheduleMeta`).
// Today: a configurable URL, sending the stored file's `ETag` so an unchanged file comes back as
// `304` with no body. T124 replaces `download` (and `SCHEDULE_URL`) with a `{season}/current.json`
// pointer read from Supabase Storage and a sha256 check of the file it names, the sha256 as the
// tag; nothing outside this module changes. The logging path never waits for it, and a failed
// fetch keeps the last stored copy.

import { db as defaultDb, type WrappedDB } from './db';
import {
  applySchedule,
  readScheduleFile,
  scheduleMeta,
  storeSchedule,
  type ScheduleFile,
} from './schedule';

/** The feed's URL for this build, or null when it has none (P3 then works from the Plan alone). */
export const SCHEDULE_URL: string | null = import.meta.env.VITE_SCHEDULE_URL || null;

export type Fetched =
  /** A new file was stored, and applied to the Events made from it. */
  | 'updated'
  /** The server's file is the one stored (`304`), or an older copy of it. */
  | 'unchanged'
  /** No answer, an error, or a file this reader can't use: the stored copy stays. */
  | 'failed';

export interface FetchOptions {
  url: string;
  db?: WrappedDB;
  fetch?: typeof globalThis.fetch;
}

/** What one download gives: a changed file with its tag, the stored one again, or nothing. */
type Downloaded = { file: ScheduleFile; tag: string | null } | 'unchanged' | 'failed';

/**
 * The transport, and all it knows: ask `url` for the file, with the stored tag (its `ETag`) as
 * `If-None-Match`. Never throws.
 */
async function download(
  url: string,
  storedTag: string | null,
  fetch: typeof globalThis.fetch,
): Promise<Downloaded> {
  try {
    const headers: Record<string, string> = {};
    if (storedTag) headers['If-None-Match'] = storedTag;
    // `no-cache` asks the browser to check with the server rather than answer from its cache.
    const response = await fetch(url, { headers, cache: 'no-cache' });
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
 * force-close cut short finishes then), then the feed is fetched now and each time the phone
 * comes back online. Nothing waits on it.
 */
export function startScheduleFetch(url: string | null = SCHEDULE_URL, db: WrappedDB = defaultDb) {
  if (started) return;
  started = true;
  void applySchedule({ db }).catch(() => undefined);
  if (url === null) return;
  const run = () => {
    if (navigator.onLine) void fetchSchedule({ url, db });
  };
  run();
  window.addEventListener('online', run);
}
