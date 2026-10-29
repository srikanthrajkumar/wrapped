# Data Model: Season Logger and Live Wrapped

Phase 1 of `/speckit-plan`. Terms follow `GLOSSARY.md`. The phone store (Dexie over IndexedDB)
and the server store (Postgres) hold the same rasika-owned records. The catalog and the
project-kept tables are read-only on both.

## Conventions

- **Ids**: every rasika-owned record has a client-generated UUIDv7 `id`, created on the phone
  (constitution II). The server never invents ids for rasika records.
- **Tombstones**: a delete sets `deletedAt` and syncs like any other write. The phone hides
  tombstoned rows; the server keeps them so a restore replays the delete.
- **Last write wins per record**: each rasika has one writing device (FR-022), so two writers
  never edit the same record. A push replaces the whole row.
- **Server bookkeeping** (server only): `rasikaId`, `seq` (bigint from one Postgres sequence,
  set on every insert or update, used as the pull cursor) and `receivedAt`.
- **Catalog references** use natural keys, never logger row ids (constitution III; design doc
  "Stable references"): `kriti_id` for a Composition, the canonical raga name for a Raga, the
  composer `name_key`, and the tala, language, subject and form names.
- **Derived, never stored**: the Wrapped, its range and every Card (constitution III).

## Field value

Every Item field that can be Unknown, Not applicable, a Guess, Unresolved or an Override holds
a `FieldValue`, so the rasika's choice is kept exactly as entered (FR-008).

| Field | Type | Meaning |
|---|---|---|
| `state` | `catalog` \| `override` \| `unknown` \| `na` \| `unresolved` | How the value was entered |
| `key` | string \| null | Catalog natural key. Required for `catalog` and `override`, null otherwise |
| `text` | string | The text as typed or picked. Always kept as the fallback; `"?"` for `unknown`, `""` for `na` |
| `guess` | boolean | Marked not sure. Allowed with `catalog`, `override` and `unresolved`; counts as its value |

Rules:

- `catalog`: filled in from the picked Composition and left alone.
- `override`: the rasika changed a filled-in value, or set one on an Item that has a
  Composition. Counts as its value (FR-030). A catalog update never resets it.
- `unresolved`: free text the catalog didn't match. Counts under `text` until matched (P6).
- Matching an Unresolved value (FR-035) rewrites `state` and `key` on every Item whose `text`
  matches, each as its own change.

## Rasika-owned records (phone and server)

### Event

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `kind` | `concert` \| `lecdem` | |
| `date` | ISO date | Defaults to today (Edge Cases) |
| `startTime` | `HH:MM` \| null | |
| `sabhaId` | uuid \| null | Own or shared Sabha |
| `status` | `planned` \| `attended` \| `missed` | Only `attended` counts in the Wrapped (FR-026) |
| `cancelled` | boolean | Set from the Schedule only while `touched` is false (FR-027) |
| `source` | `schedule` \| `plan` \| `spot` | Where the Event came from |
| `scheduleEntryId` | string \| null | The Schedule entry's id, set at pick time or by promotion |
| `scheduleVersionSeen` | string \| null | The entry version last applied or acknowledged |
| `scheduleChanged` | boolean | The "schedule changed" hint |
| `touched` | boolean | True once the rasika edits it or it becomes Attended. Schedule updates then stop |
| `title` | string \| null | Required for a Lecdem (FR-013) |
| `note` | string \| null | Erased on deletion requests (see Deletion) |
| `createdAt`, `updatedAt`, `deletedAt` | timestamp | Device clock; display only, never a sync cursor |

State transitions: `planned → attended` (logging it), `planned → missed` (rasika says so),
`missed → planned` and `attended → planned` (undo). A `spot` Event starts `attended`.

### Appearance

| Field | Type | Notes |
|---|---|---|
| `id`, `eventId`, `artistId` | uuid | `artistId` is own or shared |
| `role` | `lead` \| `second_lead` \| `violin` \| `mridangam` \| `khanjira` \| `ghatam` \| `morsing` \| `other_accompaniment` \| `presenter` | FR-004 |
| `colourPrimary` | Colour \| `unknown` \| null | |
| `colourSecondary` | Colour \| null | Two-tone outfit |
| `billed` | boolean | Came from the Plan or Schedule |
| `position` | integer | Display order |
| timestamps | | as Event |

Colour palette: the 12 colours in last season's Colours sheet (white, red, blue, orange, yellow,
brown, pink, beige, green, purple, black, grey). Extending it is a project-kept list change.

A Lecdem has at most 3 Appearances with role `presenter` (FR-013).

### Item

| Field | Type | Notes |
|---|---|---|
| `id`, `eventId` | uuid | |
| `position` | integer | Running order. A reorder renumbers the affected Items in one transaction, each an outbox change (constitution II) |
| `compositionKey` | string \| null | `kriti_id`. Null for RTP, viruttam, slokam, medley, free text (FR-010) |
| `title` | string | As picked or typed |
| `form` | FieldValue | Catalog form, or a project-kept non-composition form (RTP, viruttam, slokam, medley) |
| `ragas` | FieldValue[] | Ordered. One for most Items; several for ragamalika and RTP (FR-009) |
| `tala` | FieldValue | |
| `nadai` | FieldValue | Keys: `tisra`, `chatusra`, `khanda`, `misra`, `sankeerna` |
| `composer` | FieldValue | For an RTP: `na`, unless `pallaviAuthor` is filled |
| `pallaviAuthor` | FieldValue \| null | RTP only; when filled, counts as a Composer (FR-041) |
| `language` | FieldValue | |
| `subject` | FieldValue | Rolled up to a Topic at Wrapped time |
| `tani` | `{ nadai: FieldValue, note: string \| null }` \| null | The Tani avartanam that followed this Item (FR-011) |
| `note` | string \| null | Erased on deletion requests |
| timestamps | | as Event |

Group keys for Linked ragas are never stored on the Item. The Wrapped looks them up in the
current catalog snapshot (design doc, "Stable references").

### Artist and Sabha (own)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | As typed |
| `aliases` | string[] | Names merged into this one (FR-036) |
| `mergedIntoId` | uuid \| null | Set on the merged-away record. Readers follow it |
| timestamps | | as Event |

A rasika's merge (P6) sets `mergedIntoId` on the old record and adds its name to the survivor's
`aliases`. Appearances are not rewritten; they resolve through `mergedIntoId`.

## Shared and server-written records (pulled, never pushed)

### Shared Artist and Shared Sabha

`id` (uuid), `name`, `aliases[]`, `listVersion` (integer). Seeded from the 11 Sabhas and the
Artists in last season's sheet (FR-005). The Maintainer edits them; every change bumps the list
version, and phones pick it up on the next pull (FR-045).

### Link

Written by the server when the Maintainer promotes an entry (FR-044). The rasika's own row is
never modified by the server, which keeps last-write-wins safe.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `ownTable` | `artist` \| `sabha` \| `event` | |
| `ownId` | uuid | The rasika's own record |
| `sharedId` | string | Shared Artist or Sabha id, or a Schedule entry id |

Readers resolve an own Artist or Sabha through its Link, so Appearances follow without being
rewritten and the text as typed is kept. An Event Link sets the Schedule association only;
FR-027 still protects a `touched` Event.

### Schedule entry

Copied from the logger's Schedule feed ([contracts/schedule-feed.md](contracts/schedule-feed.md)):
`id`, `version`, `date`, `startTime`, `sabha` (shared id or name), `kind`, `billed` (name or
shared Artist id, role), `title`, `cancelled`. Not rasika-owned.

## Phone-only records

| Table | Purpose |
|---|---|
| `outbox` | `opId` (uuid, the idempotency key), `table`, `recordId`, `op` (`upsert` \| `delete`), `row`, `queuedAt`. Written in the same transaction as the record (constitution I). Its length is the unsynced count (FR-016) |
| `meta` | Key/value: `deviceId`, `pullCursor`, `catalogVersion`, `sharedListsVersion`, consent answers, cached identity, "ready for offline" flags |

### Dexie indexes (draft)

```text
events:        id, status, date, sabhaId, scheduleEntryId
appearances:   id, eventId, artistId
items:         id, eventId, [eventId+position]
artists:       id, name, mergedIntoId
sabhas:        id, name, mergedIntoId
links:         id, [ownTable+ownId]
sharedArtists: id, name
sharedSabhas:  id, name
schedule:      id, date
outbox:        ++seq, opId
meta:          key
```

The catalog snapshot is not stored in IndexedDB. It ships as a precached, content-hashed file
loaded into memory at start ([contracts/catalog-snapshot.md](contracts/catalog-snapshot.md)).

## Server-only records

### Rasika

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Opaque. Survives de-identification. Not the Supabase user id |
| `authUserId` | uuid \| null | The Supabase Auth user (`auth.users`). Nulled on a deletion request |
| `email`, `name` | string \| null | From Google. Erased on a deletion request (FR-047) |
| `shareAdditions` | boolean \| null | Null until answered; nothing pre-selected (FR-042) |
| `seasonReports` | boolean \| null | Null until answered (FR-049) |
| `writerDeviceId` | uuid \| null | The current writing device (FR-022) |
| `createdAt`, `deidentifiedAt` | timestamp | |

### Consent event

Append-only: `rasikaId`, `purpose` (`share_additions` \| `season_reports`), `value`, `at`.
Kept for at least a year (DPDP Rules; see research.md).

### Device and session

`Device`: `id`, `rasikaId`, `label`, `createdAt`, `lastSeenAt`. It records which phone is the
writer. Sessions are Supabase Auth's (ADR 0001): refresh tokens never expire, no inactivity
timeout is set, and a lost phone is revoked by signing out other devices. A 401 never clears
the phone's data (FR-020, FR-021).

### Processed op

`rasikaId`, `opId`, `receivedAt`. A primary key on (`rasikaId`, `opId`) makes a repeated push a
no-op (FR-015).

### Promotion candidates (view)

Own Artists, Sabhas and hand-typed Events from rasikas whose `shareAdditions` is true, grouped
by a folded name, showing only the name and the number of rasikas (FR-042, P7 scenario 1).

## Deletion and de-identification (FR-047)

On request, in one transaction:

1. Delete the Supabase Auth user, which ends its sessions. Null `authUserId`, `email` and
   `name`, set `deidentifiedAt`, and delete devices.
2. Null every `note` on the rasika's Events and Items, because free text can identify them.
3. If `seasonReports` is not true, delete the rasika's season as well.

## Validation rules

- An Item's `eventId` must point to an Event that is not deleted.
- `position` is unique among an Event's live Items after each transaction.
- A Lecdem needs a `title`. A Concert's `title` is null.
- `FieldValue.key` is required for `catalog` and `override` and must be null otherwise.
- A pushed row whose `rasikaId` differs from the session's rasika is rejected (constitution,
  Privacy).

## Catalog version upgrade

Each snapshot ships a remap from earlier versions: old key → new key, or `retired`. On the
launch where the rasika accepts a new version (FR-038), one transaction:

- rewrites merged keys on every Item `FieldValue` and `compositionKey`;
- turns retired keys into `unresolved` with `text` kept;
- leaves `state` alone, so Overrides stay Overrides;
- queues each changed Item in the outbox.

This path has a required test (constitution IV, "catalog updates").
