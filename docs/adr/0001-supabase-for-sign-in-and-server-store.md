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
`supabase/migrations/`, which the phone calls through Supabase's API (`supabase.rpc`). There are no
Edge Functions.

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
- `supabase/functions/` isn't created.
