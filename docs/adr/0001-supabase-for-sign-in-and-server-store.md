---
status: accepted
---

# Supabase for sign-in and the server store

Rasikas sign in with Google through Supabase Auth, and the server copy of every season lives in
Supabase Postgres. The Maintainer wants sign-in run by a platform, not by code we host. Supabase
Auth meets the spec's four sign-in needs: Google sign-in, still signed in after 30+ days unused,
no sign-out on a network error (auth-js 2.118), and revoking a lost phone by signing out the
other devices. It adds no cost or second vendor, and its sign-in data sits in the same database
as the seasons. Decided 2026-10-29; evidence in `specs/001-season-logger/research.md`.

## Considered options

- **Own API with Better Auth**, recommended first for its control over session length and
  per-device revocation. Rejected because it keeps users and sessions in our own database, so
  we would run sign-in ourselves.
- **Clerk**: the best revocation (one device at a time), but its free plan fixes sessions at 7
  days. 30-day sessions need its $25/month plan, and it adds a second vendor.
- **Firebase Auth**: revokes per user only, and its data location is not documented.
- **Neon or a VPS for the database**: Neon's free tier suspends after 5 minutes and is in
  Singapore; a VPS puts backups and patching on the Maintainer in mid-season.

## Consequences

- **The server is deployed last.** The phone app, its outbox and export come first and run
  alone, as in the design doc's fallback. The server is then built and tested locally, after
  Plan and Lecdem and before Cards and Tidy, so sign-up is ready by 1 December (eng review
  D12). Deploying it is the final step.
- **Free until deploy.** Development uses a local Supabase (the Supabase CLI on Docker), which
  costs nothing and never pauses. A hosted free project is fine for a throwaway check, but free
  projects pause after a week idle and have no automatic backups. So the season's database moves
  to Pro (from $25/month, Mumbai, daily backups kept 7 days, never paused) before rasikas sign
  up.
- **The app never depends on the Supabase session to log.** It keeps its own record of who is
  signed in and asks Supabase for a token only when syncing. Supabase's docs warn that a
  refresh reply lost on bad signal can end the session after its 10-second reuse window. The
  only effect is a non-blocking "sign in again" prompt: the outbox and season stay on the
  phone.
- **Revocation is "sign out all other devices"** (Supabase's `others` scope), not per device.
  That fits one writing device per rasika. The single writing device is still enforced by our
  own writer claim, not by Supabase's "single session per user" setting, so a former writer
  gets "not the writer" and keeps its unsynced changes for export.
- **Push and pull run as Postgres functions** called through Supabase's API (decided
  2026-11-06, T066; see the section below). They follow `contracts/sync-api.md`.
- **Tested 2026-10-31 (T010):** Google sign-in works from the app installed to the home screen
  on the iPhone 16 (iOS 18.7), both with Google's button and `signInWithIdToken` and with
  Supabase's redirect sign-in. Sign-in uses Google's button; the email one-time code fallback
  (eng review D3) is not needed. Details in `specs/001-season-logger/research.md`.

## Push and pull as Postgres functions

*Decided by the Maintainer 2026-11-06 (T066).*

Push, pull, the account operations and the Maintainer operations are Postgres functions in
`supabase/migrations/`, which the phone calls through Supabase's API (`supabase.rpc`). None of
them is an Edge Function. The one Edge Function serves the Schedule (below), from the
public-data project (ADR 0009).

Every hard rule in the sync contract belongs to the database:

- push applies its ops in one transaction under a per-rasika advisory lock;
- `seq` comes from one shared sequence;
- `processed_op` makes a retried push harmless;
- row-level security runs as `auth.uid()`.

A Postgres function gets all of these as written. An Edge Function can't hold one transaction across
Supabase API calls. It would either call a Postgres function anyway, adding a hop and a cold start,
or connect to Postgres directly and set or bypass row-level security itself, which is the riskier
path for the privacy tests (T068). The server stores each record's `data` as the phone sent it
and checks only relational facts (eng review D7), so sharing TypeScript with the app buys little.

### Considered option

- **Edge Functions (Deno, TypeScript)**: hand-written HTTP exactly as the contract reads, and
  code shared with the app. Rejected for the reasons above and for the extra runtime to deploy
  and keep secrets for in December.

### How the contract's responses map

| Contract | How it's produced |
|---|---|
| `401` | Supabase's API rejects a missing, invalid or expired token before any function runs. EXECUTE on every function is revoked from `PUBLIC` and `anon` and granted only to `authenticated` |
| `426 update_required` | One pre-request function (PostgREST's `db-pre-request`) reads `X-App-Version` from `request.headers` and raises status 426 below the minimum, so every call is checked in one place |
| `409 not_writer` | Push raises status 409 when the device isn't the writer. Nothing is applied, because the raise rolls back the transaction |
| `200` with `acked` and `rejected` | The function's normal return value. Rejected ops (`foreign_rasika`, `missing_event`, `conflict`, …) are recorded in `processed_op` and returned, not raised |
| `5xx` | Unexpected errors, which the phone retries with backoff |

A raised status uses PostgREST's custom-error form (`RAISE SQLSTATE 'PGRST'`), which sets both
the HTTP status and the JSON body. The 409 and 426 bodies take PostgREST's error shape,
`{ code, message, details, hint }`, with `code` set to `not_writer` or `update_required`.
PostgREST accepts `details` only as a string or null (an object gives a 500, PGRST121), so
`details` holds one plain value: the writer device's id for a 409, the minimum app version for
a 426. Checked on the local stack, PostgREST 16.5, on 2026-11-06: 409 and 426 come through
with these bodies, the pre-request hook sees `X-App-Version`, and anon gets 401.

### Consequences

- The contract's paths are names, not URLs: `POST /v1/sync/push` is `rpc('sync_push')`, and
  likewise for the others (`contracts/sync-api.md`).
- The functions live in an exposed schema; helpers and Maintainer-only views live in a private
  schema that isn't exposed. Any `SECURITY DEFINER` function sets an empty `search_path` and
  checks `auth.uid()` itself.
- `supabase/functions/` isn't created. The Schedule's function (below) lives in
  `supabase-public/`, for the public-data project (ADR 0009); push and pull never move there.

## The Schedule as an Edge Function

*Decided 2026-11-09 (T124), with the delivery the Maintainer settled with the logger project that
day: a private bucket, a pointer per Season, and no sign-in to read the Schedule. It lives in the
public-data project, the logger's, not in this one (ADR 0009, the same day).*

`GET /v1/schedule/{season}` is the Edge Function
`supabase-public/supabase/functions/schedule/index.ts`, deployed to the public-data project and
reached at `{VITE_PUBLIC_DATA_URL}/functions/v1/schedule/{season}`. It reads `{season}/current.json` from the
private `schedule` bucket, then the file the pointer names, checks the file's sha256 against the
pointer and its own `season` against the one asked for, and answers with the file's bytes and
the sha256 as the `ETag`, `304` on a matching `If-None-Match`, `404` with no pointer, and `502`
for a pointer naming a missing or mismatched file or another Season's (contracts/schedule-feed.md,
"Delivery").

It is an Edge Function because a Postgres function can't do this. A Storage object's bytes live
in Storage's backend, not in Postgres, so no SQL function can read the pointer or hash the file,
and none can answer `304` with the file's own `ETag`. The rule above about push and pull is
about one transaction across many writes; serving a file needs none.

### How it reads the bucket without exposing it

- The bucket is private and has no Storage policy for `anon` or `authenticated`. A restrictive
  policy on `storage.objects` (`supabase-public/supabase/migrations/0001_schedule_bucket.sql`)
  keeps every client role
  off it even if a later migration grants reads on other buckets. Only the logger's uploader
  (logger PR #70) writes to it, with a secret key the Maintainer sets on the logger's VM, never
  in either repository.
- The function reads it through Storage's API with the secret key the Edge runtime gives every
  function, or the legacy service key until those are retired (below). The key stays in the
  runtime: nothing sets it by hand, and it never reaches the phone.
- The function reads only two names: `{season}/current.json`, with `season` matching
  `^\d{4}-\d{2}$`, and the file that pointer names, which must be exactly
  `{season}/schedule.{season}.{sha256}.json` with the pointer's own lower-case `sha256`. No
  request can make it read any other object.
- It takes no token (`verify_jwt = false` in `supabase-public/supabase/config.toml`): the
  listings are public,
  so a phone not signed in gets the Schedule from its first launch. It reads nothing but the
  Schedule, so the open door leads nowhere else.
- It imports nothing, so a cold start fetches no packages, and it needs no secret of its own.

### Considered options

- **The phone reads Storage directly** through a `{season}/current.json` pointer and a Storage
  policy for signed-in rasikas (the 2026-11-07 draft). Rejected: the Maintainer chose that no
  phone needs a sign-in for the Schedule and that no client role reads the bucket.
- **A Postgres function returning a short-lived signed URL.** Two round trips for every check,
  no `304` of the server's own without a second scheme, and the hash check left to the phone.
- **A public bucket.** Rejected outright: the contract never lets the bucket be public.

### Consequences

- The public-data local stack runs Storage and the Edge runtime
  (`supabase-public/supabase/config.toml`); this project's stack runs neither.
- Setting up the public-data project gains a step: run its one migration in the dashboard's SQL
  Editor and deploy the `schedule` function from the dashboard's editor, or both with the CLI
  (`docs/setup/schedule-hosting.md`).
- The function reads with the new secret key when the runtime gives one, and the legacy service
  key otherwise, so turning the legacy keys off doesn't stop it (below).
- End to end on the local public-data stack, 2026-11-09: the logger's real 2026-27 feed (542 entries,
  sha256 `6cc844ae…5b4d`) and its pointer, put in the bucket with the uploader's own headers and
  order, reached the phone's `fetchSchedule` as `200` (gzipped, weak `ETag`), all 542 entries
  stored, then `304` on the next fetch. The uploader refuses http, so it can't reach the local
  stack itself.
- Tested on the local stack, Supabase CLI 2.122.1 (edge-runtime 1.77.8, storage-api 1.84.19), on
  2026-11-09: `supabase-public/tests/schedule.test.ts`. The runtime gzips the body for a client that
  accepts it and then marks the `ETag` weak; the phone stores the tag as it came, and a weak tag
  still matches.

### Which key the function reads with

*Checked 2026-11-09, when the Maintainer chose the catalog project's new secret key
(`sb_secret_…`) for the logger's uploads.*

What Supabase's docs say:

- The legacy `anon` and `service_role` keys are being deprecated by the end of 2026, in the
  middle of the season. They stay valid until they are turned off under **Settings → API Keys**,
  and turning them off can be undone.
- The Edge runtime injects the new keys as `SUPABASE_SECRET_KEYS` and `SUPABASE_PUBLISHABLE_KEYS`:
  JSON objects keyed by name, where `default` is the key every project has, read as
  `JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS'))['default']`.
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` "still exist in the runtime, but they
  carry the legacy keys". So once the legacy keys are turned off, a function reading
  `SUPABASE_SERVICE_ROLE_KEY` holds a key Supabase no longer accepts. The docs don't describe
  that state further.
- Secret and publishable keys aren't JWTs: send them on the `apikey` header. The docs advise
  against `Authorization: Bearer` for them, and a Bearer token alone is parsed as a JWT and
  refused.

So the function reads `SUPABASE_SECRET_KEYS['default']` first, and falls back to
`SUPABASE_SERVICE_ROLE_KEY` when there is none, or none it can read. It sends the key on
`apikey`, and the same value as `Authorization: Bearer`, as supabase-js and the logger's
uploader do. The docs don't state when a Bearer secret key is accepted beside an equal `apikey`.
On the local stack (CLI 2.122.1, storage-api 1.84.19), Storage accepted the secret key on
`apikey` alone and on both headers with the same value, and refused it as a Bearer token alone
("Invalid Compact JWS"). The local runtime injects only the legacy variables, not
`SUPABASE_SECRET_KEYS`, so the key choice is tested by loading the function with a stand-in
environment (`supabase-public/tests/schedule.test.ts`, "the function itself").

The one thing to check on the hosted project, after the logger's first upload: turn the legacy
keys off, then ask for the Season with `curl`. A `200` or `404` means the function reads with the
secret key; a `500` means it doesn't, so turn the legacy keys back on and tell the router
(`docs/setup/schedule-hosting.md`).

Sources: [Managing secrets](https://supabase.com/docs/guides/functions/secrets),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys),
read 2026-11-09.
