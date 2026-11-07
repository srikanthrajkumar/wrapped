// Fetching the Schedule (T060): the one seam that knows the transport (store/schedule-fetch.ts).
// A changed file is stored with its tag and applied; an unchanged one is asked for with the tag;
// a failed fetch, a server error or an unusable file keeps the last copy. T124 swaps the
// transport, and these tests with it.

import { describe, expect, it, vi } from 'vitest';
import { addFromSchedule, scheduleMeta } from '../../src/store/schedule';
import { fetchSchedule } from '../../src/store/schedule-fetch';
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

const ok = (body: unknown, etag: string | null = '"abc"') =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: etag ? { ETag: etag, 'Content-Type': 'application/json' } : {},
  });

describe('fetching the Schedule (T060)', () => {
  const url = 'https://example.test/schedule.json';

  it('stores a new file, sends its ETag next time, and takes a 304 as unchanged', async () => {
    const db = freshDb();
    const { fetch, sent } = server(ok(fileOf([raw()])), new Response(null, { status: 304 }));
    expect(await fetchSchedule({ url, db, fetch })).toBe('updated');
    expect(await db.schedule.count()).toBe(1);
    expect(await scheduleMeta(db)).toMatchObject({ season: '2026-27', tag: '"abc"' });
    expect(await fetchSchedule({ url, db, fetch })).toBe('unchanged');
    expect(sent[0]!.headers).toEqual({});
    expect(sent[1]!.headers).toEqual({ 'If-None-Match': '"abc"' });
    expect(await db.schedule.count()).toBe(1);
  });

  it('keeps the last copy when the fetch fails, the server errs, or the file is unusable', async () => {
    const db = freshDb();
    const first = server(ok(fileOf([raw()])));
    await fetchSchedule({ url, db, fetch: first.fetch });
    const { fetch } = server(
      new TypeError('Failed to fetch'),
      new Response('oops', { status: 503 }),
      ok(fileOf([], { format: 2 })),
      new Response('<html>', { status: 200 }),
    );
    for (let i = 0; i < 4; i += 1) expect(await fetchSchedule({ url, db, fetch })).toBe('failed');
    expect((await db.schedule.toArray()).map((e) => e.id)).toEqual([
      'music-academy-2026-12-15-1600',
    ]);
    expect(await scheduleMeta(db)).toMatchObject({ tag: '"abc"' });
  });

  it('keeps a newer file over an older copy of the same Season', async () => {
    const db = freshDb();
    const { fetch } = server(
      ok(fileOf([raw({ version: 4 })], { publishedAt: '2026-11-21T10:00:00Z' }), '"new"'),
      ok(fileOf([raw()], { publishedAt: '2026-11-20T10:00:00Z' }), '"old"'),
    );
    await fetchSchedule({ url, db, fetch });
    expect(await fetchSchedule({ url, db, fetch })).toBe('unchanged');
    expect((await db.schedule.toArray())[0]!.version).toBe(4);
    expect(await scheduleMeta(db)).toMatchObject({ tag: '"new"' });
  });

  it('applies a new file to the Events planned from it', async () => {
    const db = freshDb();
    await fetchSchedule({ url, db, fetch: server(ok(fileOf([raw()]))).fetch });
    const event = await addFromSchedule('music-academy-2026-12-15-1600', { db });
    const later = fileOf([raw({ version: 4, startTime: '18:00' })], {
      publishedAt: '2026-11-22T10:00:00Z',
    });
    await fetchSchedule({ url, db, fetch: server(ok(later, '"later"')).fetch });
    expect((await db.events.get(event.id))?.startTime).toBe('18:00');
  });

  it('keeps a cancellation when a later file says cancelled: null (Codex, PR #25)', async () => {
    const db = freshDb();
    const first = fileOf([raw({ cancelled: true })]);
    await fetchSchedule({ url, db, fetch: server(ok(first, '"a"')).fetch });
    const bad = fileOf([raw({ version: 4, cancelled: null })], {
      publishedAt: '2026-11-21T10:00:00Z',
    });
    expect(await fetchSchedule({ url, db, fetch: server(ok(bad, '"b"')).fetch })).toBe('failed');
    expect(await scheduleMeta(db)).toMatchObject({ tag: '"a"' });
    expect((await db.schedule.toArray())[0]).toMatchObject({ version: 3, cancelled: true });
  });
});
