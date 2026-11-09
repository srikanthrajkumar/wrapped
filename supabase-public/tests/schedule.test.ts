// T124 (privacy): the `schedule` Edge Function serves a Season from the private bucket, on the
// public-data stack (contracts/schedule-feed.md, "Delivery"; ADR 0001, "The Schedule as an Edge
// Function"; ADR 0009). It reads `{season}/current.json`, then the file it names, and checks the
// file's sha256 against the pointer and its own season against the one asked for. It answers
// 200 with the file's bytes and `ETag: "<sha256>"`, 304 on a matching `If-None-Match`, 404 with
// no pointer, and 502 for a pointer naming a missing, mismatched or other Season's file. No
// sign-in is needed. The bucket itself is readable by neither `anon` nor `authenticated`: only
// the function reads it, with the service key.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it, vi } from 'vitest';

const stack = inject('stack');
const BUCKET = 'schedule';
const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** The logger's side: it writes with the project's service-role key, as here. */
const logger = createClient(stack.apiUrl, stack.serviceRoleKey, { auth: noSession });

/** A client with only the public key, as any browser has. */
const anon = () => createClient(stack.apiUrl, stack.anonKey, { auth: noSession });

/** A user signed in to this project, to show `authenticated` gets no more than `anon`. */
async function signedIn(): Promise<SupabaseClient> {
  const email = `schedule-${randomUUID()}@example.test`;
  const password = randomUUID();
  const created = await logger.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = anon();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return client;
}

/** A direct connection as the database owner, to look past the API. */
const db = postgres(stack.dbUrl, { onnotice: () => {}, max: 2 });
afterAll(async () => {
  await db.end();
});

const written: string[] = [];
afterAll(async () => {
  if (written.length) await logger.storage.from(BUCKET).remove(written);
});

/** A Season of its own for each test, far from any real one, so tests can run side by side. */
function season(): string {
  const year = randomInt(3000, 9998);
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const fileBytes = (season: string, publishedAt = '2026-11-20T10:00:00Z') =>
  new TextEncoder().encode(
    JSON.stringify({ format: 1, season, publishedAt, entries: [] }, null, 2) + '\n',
  );

async function put(path: string, bytes: Uint8Array | string, upsert = false) {
  const body = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const { error } = await logger.storage
    .from(BUCKET)
    .upload(path, body, { contentType: 'application/json', upsert });
  if (error) throw error;
  written.push(path);
}

/** The logger's pointer for `season`, as contracts/schedule-feed.md shapes it. */
const pointerOf = (season: string, hash: string, fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: 1,
    season,
    file: `${season}/schedule.${season}.${hash}.json`,
    sha256: hash,
    publishedAt: '2026-11-20T10:00:00Z',
    ...fields,
  });

/** Uploads a file, then the pointer naming it, as the logger does. Returns the file's hash. */
async function publish(season: string, bytes = fileBytes(season)): Promise<string> {
  const hash = sha256(bytes);
  await put(`${season}/schedule.${season}.${hash}.json`, bytes);
  await put(`${season}/current.json`, pointerOf(season, hash), true);
  return hash;
}

/**
 * The ETag for `hash`: the sha256, quoted. The runtime gzips the body for a client that accepts
 * it, as the phone's browser does, and then marks the tag weak (`W/`); the phone keeps it as it
 * came and sends it back, and a weak tag matches all the same.
 */
const etagOf = (hash: string) => new RegExp(`^(W/)?"${hash}"$`);

/** The phone's request: a plain GET, with no key and no token. */
const get = (season: string, headers: Record<string, string> = {}, method = 'GET') =>
  fetch(`${stack.apiUrl}/functions/v1/schedule/${season}`, { method, headers });

describe('serving a Season (T124)', () => {
  it('serves the file the pointer names, its exact bytes, with its sha256 as the ETag', async () => {
    const s = season();
    const bytes = fileBytes(s);
    const hash = await publish(s, bytes);
    const reply = await get(s, { Origin: 'https://carnatic.example' });
    expect(reply.status).toBe(200);
    expect(reply.headers.get('ETag')).toMatch(etagOf(hash));
    expect(reply.headers.get('Content-Type')).toMatch(/^application\/json/);
    expect(reply.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(reply.headers.get('Access-Control-Expose-Headers')).toMatch(/etag/i);
    expect(new Uint8Array(await reply.arrayBuffer())).toEqual(bytes);
  });

  it('answers 304 with no body for a matching If-None-Match, and 200 for a stale one', async () => {
    const s = season();
    const hash = await publish(s);
    for (const tag of [`"${hash}"`, `W/"${hash}"`, `"0000", "${hash}"`, '*']) {
      const reply = await get(s, { 'If-None-Match': tag });
      expect(reply.status, tag).toBe(304);
      expect(reply.headers.get('ETag')).toMatch(etagOf(hash));
      expect(await reply.text()).toBe('');
    }
    // The tag exactly as a 200 gave it, weak or not, as the phone stores and sends it.
    const served = await get(s);
    const tag = served.headers.get('ETag')!;
    await served.arrayBuffer();
    expect((await get(s, { 'If-None-Match': tag })).status).toBe(304);
    const stale = await get(s, { 'If-None-Match': `"${'0'.repeat(64)}"` });
    expect(stale.status).toBe(200);
    await stale.arrayBuffer();
  });

  it('serves the new file once the pointer moves, and 200 to the old tag', async () => {
    const s = season();
    const first = await publish(s);
    const later = fileBytes(s, '2026-11-21T10:00:00Z');
    const second = await publish(s, later);
    expect(second).not.toBe(first);
    const reply = await get(s, { 'If-None-Match': `"${first}"` });
    expect(reply.status).toBe(200);
    expect(reply.headers.get('ETag')).toMatch(etagOf(second));
    expect(new Uint8Array(await reply.arrayBuffer())).toEqual(later);
  });

  it('answers 404 for a Season with no pointer, or a path that names no Season', async () => {
    const s = season();
    // A file alone is not published: the pointer is what makes it current.
    const bytes = fileBytes(s);
    await put(`${s}/schedule.${s}.${sha256(bytes)}.json`, bytes);
    for (const path of [s, season(), '2026', '..%2F2026-27', `${s}%2Fcurrent.json`]) {
      const reply = await get(path);
      expect(reply.status, path).toBe(404);
      expect(reply.headers.get('ETag')).toBeNull();
      await reply.text();
    }
  });

  it('refuses a pointer naming a missing file, and never serves another file', async () => {
    const s = season();
    await put(`${s}/current.json`, pointerOf(s, 'b'.repeat(64)), true);
    const reply = await get(s);
    expect(reply.status).toBe(502);
    expect(await reply.json()).toEqual({ code: 'file_missing' });
  });

  it('refuses a file whose sha256 is not the pointer’s', async () => {
    const s = season();
    const bytes = fileBytes(s);
    const hash = sha256(bytes);
    // The file at the pointer's name holds other bytes: a corrupt or overwritten upload.
    await put(`${s}/schedule.${s}.${hash}.json`, fileBytes(s, '2026-11-30T10:00:00Z'));
    await put(`${s}/current.json`, pointerOf(s, hash), true);
    const reply = await get(s);
    expect(reply.status).toBe(502);
    expect(reply.headers.get('ETag')).toBeNull();
    expect(await reply.json()).toEqual({ code: 'sha256_mismatch' });
  });

  it('refuses a file whose own season is not the one asked for (Codex, T124 review)', async () => {
    const s = season();
    const other = season();
    // A whole other Season's file, uploaded by mistake under this one's path with a pointer to
    // match: its name and hash check out, its contents don't.
    await publish(s, fileBytes(other));
    const reply = await get(s);
    expect(reply.status).toBe(502);
    expect(reply.headers.get('ETag')).toBeNull();
    expect(await reply.json()).toEqual({ code: 'season_mismatch' });
  });

  it('refuses a pointer it cannot use, or one naming a file outside its Season', async () => {
    const s = season();
    const other = season();
    const hash = await publish(other);
    const bad = [
      'not json',
      pointerOf(s, hash, { format: 2 }),
      pointerOf(s, hash, { season: other }),
      pointerOf(s, hash, { sha256: hash.toUpperCase() }),
      // A real, matching file, but another Season's: the pointer may name only its own.
      pointerOf(s, hash, { file: `${other}/schedule.${other}.${hash}.json` }),
      pointerOf(s, hash, { file: `${s}/current.json` }),
    ];
    for (const pointer of bad) {
      await put(`${s}/current.json`, pointer, true);
      const reply = await get(s);
      expect(reply.status, pointer).toBe(502);
      expect(await reply.json()).toEqual({ code: 'pointer_unreadable' });
    }
  });

  it('lets the phone send If-None-Match from another origin', async () => {
    const reply = await get(
      season(),
      {
        Origin: 'https://carnatic.example',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'if-none-match',
      },
      'OPTIONS',
    );
    expect(reply.status).toBeLessThan(300);
    expect(reply.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(reply.headers.get('Access-Control-Allow-Headers')).toMatch(/if-none-match/i);
    await reply.text();
  });
});

describe('the function itself, past the local gateway', () => {
  // Loaded here with a stand-in for the two Deno calls it makes, to check what the local stack
  // can't show: Kong answers every preflight itself before the function runs, where Supabase's
  // hosted gateway leaves them to the function; and the local runtime injects only the legacy
  // service key, where a hosted one also injects the new secret keys.
  const env = new Map<string, string>();
  let handler: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    (globalThis as { Deno?: unknown }).Deno = {
      env: { get: (name: string) => env.get(name) },
      serve: (h: typeof handler) => {
        handler = h;
      },
    };
    // By URL: the function is a Deno script, not a module this project's settings resolve.
    const fn = new URL('../supabase/functions/schedule/index.ts', import.meta.url).href;
    await import(/* @vite-ignore */ fn);
  });

  afterAll(() => {
    delete (globalThis as { Deno?: unknown }).Deno;
  });

  afterEach(() => {
    env.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('answers a preflight itself, allowing If-None-Match from any origin', async () => {
    const reply = await handler(
      new Request('https://abc.supabase.co/functions/v1/schedule/2026-27', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://carnatic.example',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'if-none-match',
        },
      }),
    );
    expect(reply.status).toBe(204);
    expect(reply.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(reply.headers.get('Access-Control-Allow-Methods')).toMatch(/\bGET\b/);
    expect(reply.headers.get('Access-Control-Allow-Headers')).toMatch(/if-none-match/i);
  });

  /** The headers the function sends Storage for one request, with these variables set. */
  async function storageHeaders(vars: Record<string, string>): Promise<Headers | null> {
    for (const [name, value] of Object.entries(vars)) env.set(name, value);
    let sent: Headers | null = null;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      sent = new Headers(init?.headers);
      return new Response('{"statusCode":"404","error":"not_found"}', { status: 400 });
    });
    const reply = await handler(
      new Request('https://abc.supabase.co/functions/v1/schedule/2026-27'),
    );
    await reply.text();
    return sent;
  }

  const URL_VAR = { SUPABASE_URL: 'https://abc.supabase.co' };
  const LEGACY = 'eyJ.legacy.service-role';
  const SECRET = 'sb_secret_new';

  it('reads with the new secret key when the runtime gives one, the same value on both headers', async () => {
    const sent = await storageHeaders({
      ...URL_VAR,
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET, other: 'sb_secret_other' }),
      SUPABASE_SERVICE_ROLE_KEY: LEGACY,
    });
    expect(sent?.get('apikey')).toBe(SECRET);
    expect(sent?.get('Authorization')).toBe(`Bearer ${SECRET}`);
  });

  it('falls back to the legacy service key when there is no usable secret key', async () => {
    for (const secretKeys of [undefined, '{', '{"other":"sb_secret_other"}', '{"default":""}']) {
      const sent = await storageHeaders({
        ...URL_VAR,
        ...(secretKeys === undefined ? {} : { SUPABASE_SECRET_KEYS: secretKeys }),
        SUPABASE_SERVICE_ROLE_KEY: LEGACY,
      });
      expect(sent?.get('apikey'), String(secretKeys)).toBe(LEGACY);
      expect(sent?.get('Authorization'), String(secretKeys)).toBe(`Bearer ${LEGACY}`);
      env.clear();
    }
  });

  it('answers 500, asking Storage nothing, with no key at all', async () => {
    env.set('SUPABASE_URL', 'https://abc.supabase.co');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reply = await handler(
      new Request('https://abc.supabase.co/functions/v1/schedule/2026-27'),
    );
    expect(reply.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('the bucket is the server’s alone (T124, privacy)', () => {
  let s: string;
  let path: string;
  let user: SupabaseClient;

  beforeAll(async () => {
    s = season();
    const hash = await publish(s);
    path = `${s}/schedule.${s}.${hash}.json`;
    user = await signedIn();
  });

  const clients = (): [string, SupabaseClient][] => [
    ['anon', anon()],
    ['authenticated', user],
  ];

  it('is private', async () => {
    const [bucket] = await db<{ public: boolean }[]>`
      select public from storage.buckets where id = ${BUCKET}`;
    expect(bucket).toEqual({ public: false });
    const reply = await fetch(`${stack.apiUrl}/storage/v1/object/public/${BUCKET}/${path}`);
    expect(reply.status).toBeGreaterThanOrEqual(400);
    await reply.text();
  });

  it('gives anon and a signed-in rasika nothing to read, list or sign', async () => {
    for (const [who, client] of clients()) {
      const bucket = client.storage.from(BUCKET);
      for (const object of [path, `${s}/current.json`]) {
        const download = await bucket.download(object);
        expect(download.data, `${who} download ${object}`).toBeNull();
        const signed = await bucket.createSignedUrl(object, 60);
        expect(signed.data, `${who} sign ${object}`).toBeNull();
      }
      const listed = await bucket.list(s);
      expect(listed.data ?? [], `${who} list`).toEqual([]);
      const buckets = await client.storage.listBuckets();
      expect(
        (buckets.data ?? []).map((b) => b.id),
        `${who} buckets`,
      ).not.toContain(BUCKET);
    }
  });

  it('lets neither write: no upload, overwrite or delete', async () => {
    for (const [who, client] of clients()) {
      const bucket = client.storage.from(BUCKET);
      const upload = await bucket.upload(`${s}/current.json`, '{}', { upsert: true });
      expect(upload.error, `${who} overwrite`).not.toBeNull();
      const fresh = await bucket.upload(`${s}/${who}.json`, '{}');
      expect(fresh.error, `${who} upload`).not.toBeNull();
      await bucket.remove([path]);
    }
    // Still there, and still served.
    const reply = await get(s);
    expect(reply.status).toBe(200);
    await reply.arrayBuffer();
  });

  it('holds even against a broad policy for another bucket', async () => {
    // A later migration granting reads on storage.objects to everyone must not reach this
    // bucket: the restrictive policy is ANDed with it.
    await db.begin(async (sql) => {
      await sql`create policy "test: everyone reads everything" on storage.objects
        for select to anon, authenticated using (true)`;
      try {
        await sql`select set_config('request.jwt.claims', ${JSON.stringify({ role: 'anon' })}, true)`;
        await sql`set local role anon`;
        const rows = await sql`select name from storage.objects where bucket_id = ${BUCKET}`;
        expect(rows).toEqual([]);
      } finally {
        await sql`reset role`;
        await sql`drop policy "test: everyone reads everything" on storage.objects`;
      }
    });
  });
});
