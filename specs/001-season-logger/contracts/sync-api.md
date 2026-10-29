# Contract: Sync API

The interface between the phone and the server, served by Supabase
([ADR 0001](../../../docs/adr/0001-supabase-for-sign-in-and-server-store.md)). The operations
below are written as HTTP paths. When the server is built, each becomes a Postgres function
called through Supabase's API or an Edge Function; the bodies, responses and rules stay as
written. Records and field names are in [data-model.md](../data-model.md).

Every call carries the Supabase access token (`Authorization: Bearer <token>`). The rasika is
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
    { "opId": "0193…", "table": "items", "op": "upsert", "row": { "id": "0193…", "eventId": "…", "position": 3, "…": "…" } },
    { "opId": "0193…", "table": "items", "op": "delete", "row": { "id": "0193…", "deletedAt": "2026-12-14T17:02:11Z" } }
  ]
}
```

- At most 200 ops per request, in outbox order. The phone sends one request at a time.
- Tables a phone may push: `events`, `appearances`, `items`, `artists`, `sabhas`.
- The server applies ops in order, in one transaction holding a per-rasika advisory lock:
  - an `opId` already in Processed op is acknowledged again and not reapplied (FR-015);
  - an `upsert` replaces the row and stamps a new `seq`;
  - a `delete` sets `deletedAt` and stamps a new `seq`, keeping the row as a tombstone.

Responses:

| Status | Body | Phone does |
|---|---|---|
| `200` | `{ "acked": [opId], "rejected": [{ "opId", "code", "message" }] }` | Removes acked and rejected ops from the outbox. Keeps rejected records locally and lists them in "needs attention" |
| `401` | | Keeps the outbox; shows the sign-in prompt |
| `409` | `{ "code": "not_writer", "writerDeviceId" }` | Stops pushing, keeps the outbox, tells the rasika and offers export (Edge Cases, "Second device") |
| `5xx` or network error | | Retries with exponential backoff and jitter |

A rejected op is recorded as processed so it is never retried in a loop, and its `code` is
specific (`foreign_rasika`, `missing_event`, `invalid_field_value`, …). A rejected op is
reported, never dropped quietly.

## Pull

`GET /v1/sync/pull?cursor=<opaque>&limit=500`

```json
{
  "changes": [
    { "table": "events", "row": { "id": "…", "…": "…", "deletedAt": null } },
    { "table": "links", "row": { "id": "…", "ownTable": "artist", "ownId": "…", "sharedId": "…" } },
    { "table": "sharedArtists", "row": { "id": "…", "name": "Anirudh Athreya", "aliases": [], "listVersion": 7 } }
  ],
  "cursor": "<opaque>",
  "more": false
}
```

- Tables pulled: the five rasika tables, `links`, `sharedArtists` and `sharedSabhas`.
- An empty or missing cursor returns everything: this is the restore path.
- The cursor holds two positions:
  - the rasika's own records and Links, by `seq`, written only under that rasika's lock, so
    they commit in `seq` order;
  - the shared lists, by `listVersion`, written only under a single shared-lists lock.
  Neither can skip a row committed late by another transaction.
- The phone applies a page in one local transaction, then stores the new cursor.

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
