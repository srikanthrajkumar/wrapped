// T124: serves a Season's Schedule, `GET /functions/v1/schedule/{season}` (contracts/
// schedule-feed.md, "Delivery"; ADR 0001, "The Schedule as an Edge Function"). It is deployed
// to the public-data project, the logger's, beside the catalog (ADR 0009).
//
// It reads the private `schedule` bucket with the service key the Edge runtime injects, so the
// bucket is never readable by anyone else: `{season}/current.json` first, then the file it
// names, whose sha256 must match the pointer's and whose `season` must be the one asked for
// (Codex, T124 review). It answers with the file's exact bytes and `ETag: "<sha256>"`, `304`
// when `If-None-Match` names that sha256, and `404` for a Season with no pointer. A pointer it
// can't use, or one naming a missing, mismatched or other Season's file, is the logger's fault
// and answers `502`, so the phone keeps its stored copy.
//
// No sign-in: the listings are public (Maintainer, 2026-11-09), so the function takes no token
// (`verify_jwt = false`, supabase-public/supabase/config.toml). No imports, so nothing is fetched
// at cold start; it runs on Deno, and typechecks under the repository's Node settings by
// declaring the two Deno calls it makes.

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

const BUCKET = 'schedule';
const SEASON = /^\d{4}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;

interface Pointer {
  format: 1;
  season: string;
  file: string;
  sha256: string;
}

/** Public data, no cookies: any origin may read it, and the phone may read the ETag. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'ETag',
};

function reply(status: number, body: string | null, headers: Record<string, string> = {}) {
  const json: Record<string, string> = body === null ? {} : { 'Content-Type': 'application/json' };
  return new Response(body, { status, headers: { ...CORS, ...json, ...headers } });
}

const problem = (status: number, code: string) => reply(status, JSON.stringify({ code }));

/** The Season a path names: `/schedule/2026-27`, with or without `/functions/v1` before it. */
function seasonOf(url: string): string | null {
  const match = /\/schedule\/([^/]+)\/?$/.exec(new URL(url).pathname);
  const season = match ? decodeURIComponent(match[1]!) : null;
  return season && SEASON.test(season) ? season : null;
}

/** A pointer for `season` naming one of its own files by the hash in its name, or null. */
function readPointer(json: unknown, season: string): Pointer | null {
  if (typeof json !== 'object' || json === null) return null;
  const p = json as Record<string, unknown>;
  if (p.format !== 1 || p.season !== season) return null;
  if (typeof p.sha256 !== 'string' || !SHA256.test(p.sha256)) return null;
  if (p.file !== `${season}/schedule.${season}.${p.sha256}.json`) return null;
  return { format: 1, season, file: p.file, sha256: p.sha256 };
}

/** Whether `If-None-Match` names the current file: a list of tags, weak or strong, or `*`. */
function matches(ifNoneMatch: string | null, sha256: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(',')
    .map((tag) =>
      tag
        .trim()
        .replace(/^W\//, '')
        .replace(/^"(.*)"$/, '$1'),
    )
    .some((tag) => tag === '*' || tag === sha256);
}

/** The `season` a file names, or null for one that isn't a JSON object naming one. */
function fileSeason(bytes: ArrayBuffer): string | null {
  try {
    const json: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const season = (json as { season?: unknown } | null)?.season;
    return typeof season === 'string' ? season : null;
  } catch {
    return null;
  }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The key the function reads the bucket with. Supabase's new secret key first: the runtime
 * injects the project's secret keys as `SUPABASE_SECRET_KEYS`, a JSON object keyed by name, and
 * `default` is the one every project has. Then the legacy `service_role` key, which still works
 * until the project turns its legacy keys off; Supabase is retiring them by the end of 2026 (ADR
 * 0001, "Which key the function reads with").
 */
function serviceKey(): string | null {
  try {
    const keys: unknown = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? 'null');
    const secret = (keys as { default?: unknown } | null)?.default;
    if (typeof secret === 'string' && secret) return secret;
  } catch {
    // Not JSON: fall back to the legacy key.
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null;
}

/** One object from the bucket, or null when it isn't there. Throws on any other failure. */
async function readObject(path: string): Promise<ArrayBuffer | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = serviceKey();
  if (!url || !key) throw new Error('The runtime gave no SUPABASE_URL or service key');
  // The key on `apikey`, and the same value as the Bearer token, as supabase-js and the logger's
  // uploader send it: an `sb_secret_` key isn't a JWT, and is taken as a Bearer token only beside
  // an `apikey` of the same value.
  const response = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  // Storage answers a missing object with 400 or 404, its body saying `not_found`.
  if (response.status === 404 || response.status === 400) {
    const text = await response.text();
    if (response.status === 404 || /not.?found/i.test(text)) return null;
    throw new Error(`Storage answered ${response.status}: ${text}`);
  }
  if (!response.ok) throw new Error(`Storage answered ${response.status}`);
  return response.arrayBuffer();
}

async function serve(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return reply(204, null, {
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'if-none-match, authorization, apikey, x-client-info',
      'Access-Control-Max-Age': '86400',
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return problem(405, 'method');
  const season = seasonOf(request.url);
  if (!season) return problem(404, 'no_season');

  const pointerBytes = await readObject(`${season}/current.json`);
  if (!pointerBytes) return problem(404, 'no_season');
  let pointer: Pointer | null;
  try {
    pointer = readPointer(JSON.parse(new TextDecoder().decode(pointerBytes)), season);
  } catch {
    pointer = null;
  }
  if (!pointer) return problem(502, 'pointer_unreadable');

  const etag = `"${pointer.sha256}"`;
  // `no-cache`: anything may keep a copy, but must ask again before using it.
  const headers = { ETag: etag, 'Cache-Control': 'no-cache' };
  if (matches(request.headers.get('If-None-Match'), pointer.sha256)) {
    return reply(304, null, headers);
  }
  const file = await readObject(pointer.file);
  if (!file) return problem(502, 'file_missing');
  if ((await sha256Hex(file)) !== pointer.sha256) return problem(502, 'sha256_mismatch');
  // A whole other Season's file uploaded under this one's path, with a pointer to match, would
  // replace a phone's Schedule and make it refuse every corrected file as an earlier Season.
  if (fileSeason(file) !== season) return problem(502, 'season_mismatch');
  return new Response(request.method === 'HEAD' ? null : file, {
    status: 200,
    headers: { ...CORS, ...headers, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  try {
    return await serve(request);
  } catch (error) {
    console.error(error);
    return problem(500, 'server');
  }
});
