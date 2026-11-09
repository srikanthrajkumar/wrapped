// Fetching the Schedule (T060, T124): the one seam that knows the transport
// (store/schedule-fetch.ts). The endpoint comes from the build's public-data URL and the Season of
// the day. A changed file (200) is stored with its ETag, the sha256, and applied; an unchanged
// one is asked for with that tag and comes back 304; a failed fetch, a server error, a Season
// with no file yet or an unusable file keeps the last copy; a build with no public-data URL fetches
// nothing. The server's side is in supabase/tests/schedule.test.ts.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { addFromSchedule, scheduleMeta } from '../../src/store/schedule';
import {
  fetchSchedule,
  scheduleUrl,
  seasonOn,
  startScheduleFetch,
} from '../../src/store/schedule-fetch';
import { freshDb } from '../helpers';
import { fileOf, raw } from './schedule-fixtures';

/** A fetch answering with each reply in turn, recording what it was sent. */
function server(...replies: (Response | Error)[]) {
  const sent: RequestInit[] = [];
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(init ?? {});
    const reply = replies.shift()!;
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, sent };
}

const SHA = `"${'a'.repeat(64)}"`;

const ok = (body: unknown, etag: string | null = SHA) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: etag ? { ETag: etag, 'Content-Type': 'application/json' } : {},
  });

describe('where the Schedule is asked for (T124)', () => {
  it("asks this build's Supabase project for the Season of the day", () => {
    expect(scheduleUrl('https://abc.supabase.co', '2026-27')).toBe(
      'https://abc.supabase.co/functions/v1/schedule/2026-27',
    );
    expect(scheduleUrl('http://127.0.0.1:54321/', '2026-27')).toBe(
      'http://127.0.0.1:54321/functions/v1/schedule/2026-27',
    );
  });

  it('names the Season that starts in July', () => {
    expect(seasonOn(new Date(2026, 10, 9))).toBe('2026-27');
    expect(seasonOn(new Date(2027, 0, 20))).toBe('2026-27');
    expect(seasonOn(new Date(2027, 5, 30))).toBe('2026-27');
    expect(seasonOn(new Date(2027, 6, 1))).toBe('2027-28');
    expect(seasonOn(new Date(2099, 11, 1))).toBe('2099-00');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds for the tests with no public-data URL, so no test reaches the real project', () => {
    // app/vitest.config.ts sets it empty, over any app/.env (ADR 0009).
    expect(import.meta.env.VITE_PUBLIC_DATA_URL || null).toBeNull();
  });

  it('fetches nothing, and listens for nothing, in a build with no public-data URL', async () => {
    expect(scheduleUrl(undefined, '2026-27')).toBeNull();
    expect(scheduleUrl('', '2026-27')).toBeNull();
    const db = freshDb();
    const fetch = vi.fn();
    const addEventListener = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', { addEventListener });
    startScheduleFetch(null, db);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
  });
});

describe('fetching the Schedule (T060, T124)', () => {
  const season = '2026-27';
  const url = 'https://abc.supabase.co/functions/v1/schedule/2026-27';

  it('refuses a file of another Season, keeping the stored copy (Codex, T124 review)', async () => {
    const db = freshDb();
    await fetchSchedule({ url, season, db, fetch: server(ok(fileOf([raw()]))).fetch });
    // A whole 2027-28 file served for 2026-27: taken, it would replace the Schedule, and every
    // corrected 2026-27 file after it would be refused as an earlier Season.
    const later = fileOf([raw({ id: 'next-season', date: '2027-12-15' })], {
      season: '2027-28',
      publishedAt: '2027-11-20T10:00:00Z',
    });
    const { fetch } = server(ok(later, '"other"'));
    expect(await fetchSchedule({ url, season, db, fetch })).toBe('failed');
    expect(await scheduleMeta(db)).toMatchObject({ season: '2026-27', tag: SHA });
    expect((await db.schedule.toArray()).map((e) => e.id)).toEqual([
      'music-academy-2026-12-15-1600',
    ]);
  });

  it('stores a new file, sends its ETag next time, and takes a 304 as unchanged', async () => {
    const db = freshDb();
    const { fetch, sent } = server(ok(fileOf([raw()])), new Response(null, { status: 304 }));
    expect(await fetchSchedule({ url, season, db, fetch })).toBe('updated');
    expect(await db.schedule.count()).toBe(1);
    expect(await scheduleMeta(db)).toMatchObject({ season: '2026-27', tag: SHA });
    expect(await fetchSchedule({ url, season, db, fetch })).toBe('unchanged');
    expect(sent[0]!.headers).toEqual({});
    expect(sent[1]!.headers).toEqual({ 'If-None-Match': SHA });
    expect(sent.map((init) => init.cache)).toEqual(['no-store', 'no-store']);
    expect(await db.schedule.count()).toBe(1);
  });

  it('keeps the last copy when the fetch fails, the server errs, or the file is unusable', async () => {
    const db = freshDb();
    const first = server(ok(fileOf([raw()])));
    await fetchSchedule({ url, season, db, fetch: first.fetch });
    const replies = [
      new TypeError('Failed to fetch'),
      new Response('oops', { status: 503 }),
      // No file for the Season yet, and a pointer naming a missing or mismatched file.
      new Response('{"code":"no_season"}', { status: 404 }),
      new Response('{"code":"sha256_mismatch"}', { status: 502 }),
      ok(fileOf([], { format: 2 })),
      new Response('<html>', { status: 200 }),
    ];
    const { fetch } = server(...replies);
    for (let i = 0; i < replies.length; i += 1) {
      expect(await fetchSchedule({ url, season, db, fetch })).toBe('failed');
    }
    expect((await db.schedule.toArray()).map((e) => e.id)).toEqual([
      'music-academy-2026-12-15-1600',
    ]);
    expect(await scheduleMeta(db)).toMatchObject({ tag: SHA });
  });

  it('keeps a newer file over an older copy of the same Season', async () => {
    const db = freshDb();
    const { fetch } = server(
      ok(fileOf([raw({ version: 4 })], { publishedAt: '2026-11-21T10:00:00Z' }), '"new"'),
      ok(fileOf([raw()], { publishedAt: '2026-11-20T10:00:00Z' }), '"old"'),
    );
    await fetchSchedule({ url, season, db, fetch });
    expect(await fetchSchedule({ url, season, db, fetch })).toBe('unchanged');
    expect((await db.schedule.toArray())[0]!.version).toBe(4);
    expect(await scheduleMeta(db)).toMatchObject({ tag: '"new"' });
  });

  it('applies a new file to the Events planned from it', async () => {
    const db = freshDb();
    await fetchSchedule({ url, season, db, fetch: server(ok(fileOf([raw()]))).fetch });
    const event = await addFromSchedule('music-academy-2026-12-15-1600', { db });
    const later = fileOf([raw({ version: 4, startTime: '18:00' })], {
      publishedAt: '2026-11-22T10:00:00Z',
    });
    await fetchSchedule({ url, season, db, fetch: server(ok(later, '"later"')).fetch });
    expect((await db.events.get(event.id))?.startTime).toBe('18:00');
  });

  it('keeps a cancellation when a later file says cancelled: null (Codex, PR #25)', async () => {
    const db = freshDb();
    const first = fileOf([raw({ cancelled: true })]);
    await fetchSchedule({ url, season, db, fetch: server(ok(first, '"a"')).fetch });
    const bad = fileOf([raw({ version: 4, cancelled: null })], {
      publishedAt: '2026-11-21T10:00:00Z',
    });
    expect(await fetchSchedule({ url, season, db, fetch: server(ok(bad, '"b"')).fetch })).toBe(
      'failed',
    );
    expect(await scheduleMeta(db)).toMatchObject({ tag: '"a"' });
    expect((await db.schedule.toArray())[0]).toMatchObject({ version: 3, cancelled: true });
  });
});
