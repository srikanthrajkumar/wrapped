# Contract: Sync API

The interface between the phone and the server, served by Supabase
([ADR 0001](../../../docs/adr/0001-supabase-for-sign-in-and-server-store.md)). The operations
below are written as HTTP paths. Each is a Postgres function called through Supabase's API
(`supabase.rpc`; ADR 0001, T066): `POST /v1/sync/push` is `sync_push`, and likewise for the
others. The bodies, responses and rules stay as written, except that error bodies take
PostgREST's shape (see "Errors" below). Records and field names are in [data-model.md](../data-model.md).

Every call carries the Supabase access token (`Authorization: Bearer <token>`) and the app's
version (`X-App-Version`). Below the server's minimum supported version, every call answers
`426 update_required`; the phone keeps logging and its outbox and asks the rasika to update
(eng review D14). The rasika is
the token's user (`auth.uid()`), never a field in the body. Row-level security on every rasika
table limits reads and writes to that rasika's own rows.

## Sign-in and sessions (Supabase Auth)

- Google sign-in through Supabase Auth. The first sign-in creates the Rasika row for that user
  (FR-021).
- Refresh tokens never expire and no inactivity timeout is set, so a rasika offline for 30 days
  is still signed in on return (FR-020).
- A lost phone is revoked by signing out with scope `others` from another device (FR-021).
  Supabase's "single session per user" setting stays off; the writer claim below handles the
  one writing device.
- The phone asks supabase-js for a token only when syncing. Logging never checks the session.
- A 401, or a session Supabase has ended, shows a non-blocking "sign in again" prompt. The
  phone MUST keep its outbox and local data (constitution I).

## Account

| Method and path | Body | Response |
|---|---|---|
| `GET /v1/me` | | `{ id, name, shareAdditions, seasonReports, writerDeviceId, deletionContact }` |
| `PUT /v1/me/consent` | `{ shareAdditions?: boolean, seasonReports?: boolean }` | `200 { shareAdditions, seasonReports }`. Each change appends a Consent event |
| `POST /v1/devices/claim` | `{ deviceId, label }` | `200 { writerDeviceId }`. Makes this device the writer (FR-022) |

## Push

`POST /v1/sync/push`

```json
{
  "deviceId": "0193…",
  "ops": [
    { "opId": "0193…", "table": "items", "baseSeq": 0, "row": { "id": "0193…", "eventId": "…", "position": 3, "deletedAt": null, "…": "…" } },
    { "opId": "0193…", "table": "items", "baseSeq": 4182, "row": { "id": "0193…", "eventId": "…", "position": 4, "deletedAt": "2026-12-14T17:02:11Z", "…": "…" } }
  ]
}
```

- At most 200 ops per request, in outbox order. The phone sends one request at a time.
- The phone sends its outbox oldest first. A retry starts at the oldest op not yet acked or
  rejected, and never holds fewer ops than the push it repeats. Ops leave the outbox only when
  acked or rejected, and the cap of 200 doesn't change between attempts. The server's
  lost-reply rule below relies on this: a shorter retry could get a false `conflict` on an edit
  made after it. Nothing would be lost, and "keep mine" resolves it.
- Tables a phone may push: `events`, `appearances`, `items`, `artists`, `sabhas`.
- The server applies ops in order, in one transaction holding a per-rasika advisory lock:
  - an `opId` already in Processed op is acknowledged again and not reapplied (FR-015);
  - each op is an upsert of the full row: it replaces the row and stamps a new `seq`. A delete
    is the full row with `deletedAt` set, kept as a tombstone (outside voice 8);
  - an upsert whose `id` already belongs to another rasika is rejected `foreign_rasika`;
  - an op whose `baseSeq` differs from the record's current `seq` (0 for a new record) is
    rejected `conflict`, so no push silently overwrites a newer version (eng review D11). Two
    ops on one record in the same push may both carry the `seq` from before the push: the phone
    learns the first op's new `seq` only from the reply, so the second is its own later edit,
    not a conflict. The same holds after a lost reply: an op acknowledged again in this push
    counts as an earlier op of the push while nothing has written its record since, so an edit
    made before any ack arrived is accepted. An op is never accepted over a write made after
    that run, such as another device's;
  - an op the server can't read (an unknown table, a row without a uuid `id` or `eventId`, a
    `baseSeq` that isn't a whole number) is rejected `invalid_op`;
  - a live Appearance or Item needs a live Event of the same rasika, else `missing_event`. A
    deleted one needs only the Event, since the phone deletes the children first.

Responses:

| Status | Body | Phone does |
|---|---|---|
| `200` | `{ "acked": [{ "opId", "seq" }], "rejected": [{ "opId", "code", "message" }] }` | Removes acked and rejected ops from the outbox. Keeps rejected records locally, lists them in "needs attention", and keeps counting them as unsynced until fixed or discarded |
| `401` | | Keeps the outbox; shows the sign-in prompt |
| `400` | `{ "code": "bad_request", "message" }` | The request is malformed (no `ops` array, more than 200 ops, a `deviceId` or `opId` that isn't a uuid) and nothing was applied. Stops pushing, keeps the outbox and lists the batch in "needs attention". Never retried with backoff: a retry would block the outbox behind one bad batch |
| `409` | `{ "code": "not_writer", "details": "<writer device id>" }` | Stops pushing, keeps the outbox, tells the rasika and offers export or "Make this the writing device again", which claims the device and resumes pushing (Edge Cases, "Second device") |
| `5xx` or network error | | Retries with exponential backoff and jitter |

A rejected op is recorded as processed so it is never retried in a loop, and its `code` is
specific (`foreign_rasika`, `missing_event`, `conflict`, `invalid_op`). A `conflict` is shown with "keep
mine" (re-push with the new `baseSeq`) and "keep the server's" (drop the op and pull). A rejected op is
reported, never dropped quietly.

## Errors

A 409 or 426 is raised by the function with PostgREST's custom error, so its body has
PostgREST's shape: `{ "code", "message", "details", "hint" }`, with `code` set to `not_writer`
or `update_required`. PostgREST takes `details` only as a string, so it holds one plain value:
the writer device's id for a 409 (null if no device has claimed yet), the minimum app version
for a 426. A 401 is Supabase's API's own response to a missing or expired token.
The `426` check runs once per request, in a pre-request function that reads `X-App-Version`
(ADR 0001, "How the contract's responses map").

## Pull

`GET /v1/sync/pull?cursor=<opaque>&limit=500`

```json
{
  "changes": [
    { "table": "events", "seq": 4182, "row": { "id": "…", "…": "…", "deletedAt": null } },
    { "table": "links", "seq": 4190, "row": { "id": "…", "ownTable": "artist", "ownId": "…", "sharedId": "…" } },
    { "table": "sharedArtists", "row": { "id": "…", "name": "Anirudh Athreya", "aliases": [], "listVersion": 7 } }
  ],
  "cursor": "<opaque>",
  "more": false
}
```

- Tables pulled: the five rasika tables, `links`, `sharedArtists` and `sharedSabhas`.
- Each of the rasika's own changes and Links carries its server `seq`. The phone keeps it as
  the record's base for its next op, so an edit after a restore, or after "keep the server's",
  isn't rejected as a `conflict`.
- An empty or missing cursor returns everything: this is the restore path.
- The cursor holds two positions:
  - the rasika's own records and Links, by `seq`, written only under that rasika's lock, so
    they commit in `seq` order;
  - the shared lists, by `listVersion`, written only under a single shared-lists lock.
  Neither can skip a row committed late by another transaction.
- The phone applies a page in one local transaction, then stores the new cursor.
- A pulled row is skipped while the phone still has a pending outbox op for that record: the
  local row is newer, because only this device writes. It reaches the server with its op.

## Sync order on the phone

Run on app start, `online`, `visibilitychange` to visible, and after each save (FR-014):

1. If not signed in, stop. Logging carries on (FR-018).
2. Push until the outbox is empty or an error stops it.
3. Pull until `more` is false.

Restore (FR-017) is the same sequence on an empty store, after `POST /v1/devices/claim`. Push
runs first, so entries logged on the empty phone are kept.

## Maintainer

These need the Maintainer's Supabase user, which is on a server-side allowlist table. They never return a rasika's identity or log details (FR-042).

| Method and path | Body | Response |
|---|---|---|
| `GET /v1/admin/candidates?table=artist\|sabha\|event` | | `[{ "name", "rasikaCount", "candidateKey" }]` from consenting rasikas only |
| `POST /v1/admin/shared/{artists\|sabhas}` | `{ name, aliases }` | The new shared entry; bumps `listVersion` |
| `POST /v1/admin/promote` | `{ table, candidateKey, sharedId }` | Writes a Link for each matching own record of consenting rasikas |
| `POST /v1/admin/deletion` | `{ email }` | Runs de-identification ([data-model.md](../data-model.md), "Deletion") |

## Required tests (constitution IV)

- The same push sent twice stores each op once.
- An offline delete and a reorder reach the server and come back identical on restore.
- A restore onto an empty store, with local unsynced ops, keeps those ops and returns the full
  season.
- A 401 and a network error both leave the outbox and local data intact.
