# Data Model: Season Logger and Live Wrapped

Phase 1 of `/speckit-plan`. Terms follow `GLOSSARY.md`. The phone store (Dexie over IndexedDB)
and the server store (Postgres) hold the same rasika-owned records. The catalog and the
project-kept tables are read-only on both.

## Conventions

- **Ids**: every rasika-owned record has a client-generated UUID `id` from `crypto.randomUUID()`,
  created on the phone (constitution II). The server never invents ids for rasika records.
- **Tombstones**: a delete sets `deletedAt` and syncs like any other write. The phone hides
  tombstoned rows; the server keeps them so a restore replays the delete.
- **Last write wins per record**: each rasika has one writing device (FR-022), so two writers
  never edit the same record. A push replaces the whole row.
- **Server bookkeeping** (server only): `rasikaId`, `seq` (bigint from one Postgres sequence,
  set on every insert or update, used as the pull cursor), `deletedAt`, `receivedAt` and the parent
  id. The record itself is stored as one `data` jsonb column, exactly as the phone sent it; its
  fields are defined only in `app/src/model/records.ts` (eng review D7).
- **Catalog references** use natural keys, never logger row ids (constitution III; design doc
  "Stable references"): `kriti_id` for a Composition, the canonical raga name for a Raga, the
  composer `name_key`, and the tala, language, subject and form names.
- **Derived, never stored**: the Wrapped, its range and every Card (constitution III).

## Detail value

Every Detail of an Item that can be Unknown, Not applicable, a Guess, Unresolved or an Override
holds a `DetailValue`, so the rasika's choice is kept exactly as entered (FR-008).

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
| `kind` | `concert` \| `lecdem` \| `dance` \| `harikatha` | Dance and Harikatha added 2026-11-06 (T057); Items work as for a Concert |
| `date` | ISO date | Defaults to today (Edge Cases) |
| `startTime` | `HH:MM` \| null | |
| `sabhaId` | uuid \| null | Own or shared Sabha |
| `status` | `planned` \| `attended` \| `missed` | Only `attended` counts in the Wrapped (FR-026). On screen `planned` reads Shortlisted and `attended` is Heard; `missed` is kept and shown nowhere. The stored words never change (ADR 0010, 2026-11-11) |
| `cancelled` | boolean | Set from the Schedule only while `touched` is false (FR-027). Never hides the Event: a Planned one stays in its day on Season, shown as cancelled, until the rasika removes it, and one whose Schedule entry is cancelled is shown so whatever this says (2026-11-07) |
| `source` | `schedule` \| `plan` \| `spot` | Where the Event came from |
| `scheduleEntryId` | string \| null | The Schedule entry's id, set at pick time or by promotion. One live Event per entry: adding it again returns the one planned, and the Undo of a deleted one is refused while another holds the entry (PR #25 review) |
| `scheduleVersionSeen` | string \| null | The entry version last applied or acknowledged |
| `scheduleChanged` | boolean | The "schedule changed" hint, set only on a Planned Event, and only when the version differs in a field the sheet shows (date, time, Sabha, kind, title, cancelled, billed Artists), never for an empty sheet; leaving Planned clears it (PR #25 review). Never on an Attended or Missed one: an Attended or Missed one is the rasika's record, and a later version leaves it alone, hint and all (2026-11-07). Cleared when the rasika answers it: "take it" gives the Event the version's named values, "keep mine" changes nothing else; `scheduleVersionSeen` already holds that version, so only a newer one sets it again (2026-11-07) |
| `touched` | boolean | True once the rasika edits it, changes its Stage (adds, edits or removes an Appearance; T058), or it becomes Attended. Schedule updates then stop |
| `title` | string \| null | Required for a Lecdem (FR-013); null for a Concert; the printed title, or null, for a Dance or a Harikatha |
| `note` | string \| null | Erased on deletion requests (see Deletion) |
| `createdAt`, `updatedAt`, `deletedAt` | timestamp | Device clock; display only, never a sync cursor |

State transitions (ADR 0010, 2026-11-11, replacing the explicit "Start logging"):
`planned → attended` when the first Item is saved, in that Item's own transaction, or when the
rasika says on the lapse card that they were there (viewing or editing leaves it `planned`);
`planned → missed` when its window ended with nothing logged and the rasika let it go, or
unasked when it was cancelled or shares a slot (starts within 30 minutes) with an Attended
Event; `missed → planned` when its listing is Shortlisted again; `attended → planned` stays in
the rules, used by no screen. A `missed` Event that gains an Item becomes `attended`. A `spot`
Event starts `attended`. A lapsed Event is never deleted by the app.

### Appearance

| Field | Type | Notes |
|---|---|---|
| `id`, `eventId`, `artistId` | uuid | `artistId` is own or shared. An Appearance the Schedule makes has the id it derives from the Event and the Artist (a version-3 UUID, the same on every phone, whatever place the Artist is billed at); that id is how the phone tells a Schedule row from one the rasika added, which the Schedule never bills, changes or removes (PR #25 review, 2026-11-07). An Appearance's Artist never changes on the phone, so the id keeps saying where the row came from |
| `role` | `vocal` \| `support` \| `violin` \| `veena` \| `chitravina` \| `flute` \| `nagaswaram` \| `saxophone` \| `mandolin` \| `mridangam` \| `thavil` \| `khanjira` \| `ghatam` \| `morsing` \| `dancer` \| `nattuvangam` \| `other` \| `presenter` \| null | What they did; null when unknown. No Role ranks above another (FR-004). `support` is vocal support. `support`, `chitravina`, `nagaswaram`, `saxophone`, `mandolin`, `thavil`, `dancer` and `nattuvangam` were added 2026-11-06 (T057) |
| `colourPrimary` | Colour \| `unknown` \| null | |
| `colourSecondary` | Colour \| null | Two-tone outfit |
| `billed` | boolean | Billed by the current Schedule version (or the Plan). A Schedule row the newer version drops but the rasika gave a Colour stays, with `billed` false; one the rasika added is never billed |
| `group` | string \| null | The name the Artist was billed under with others, such as "Malladi Brothers", copied from the Schedule (T057); null otherwise. Display only: never an Artist, never counted |
| `support` | boolean, optional | True when the Schedule billed them as support to a lead on the same instrument ("Violin with support"), copied from the feed's `support` (2026-11-10); a support singer is the `support` Role instead, unchanged; a later version sets or clears it. Absent on a row stored before it existed and on one the rasika added, which reads as false. `role` stays the instrument, so a support violinist is `violin` and counts as violin in the Wrapped. A support Appearance never names the Event, but stays on Stage |
| `position` | integer | The order added; Stage lists by Role, then by this (walkthrough S4, 2026-11-04). Kept as a field so Undo restores a removed Artist to its place and the row shape stays as synced |
| timestamps | | as Event |

Colour palette: the 12 colours in last season's Colours sheet (white, red, blue, orange, yellow,
brown, pink, beige, green, purple, black, grey). Extending it is a project-kept list change.

A Lecdem has at most 3 Appearances with role `presenter` (FR-013).

A group billed together, such as the Malladi Brothers, is kept as each member's own Appearance,
each with the group's name in `group`. The name sits on the Appearance rather than the Event
because an Event can bill a group beside other Artists (the brothers with a violinist and a
mridangist), so only the members' rows say whom it names; and it needs no new record, table or
sync change, since the server keeps the row as sent. It is display only: the Concert line shows
it in place of the members' names, and the Wrapped counts each member on their own (Maintainer,
2026-11-06).

Whom an Event is known by (`app/src/store/stage.ts`, Maintainer, 2026-11-10): its Appearances in
its kind's Roles that are not support; for a Concert with none, every violinist who is not support,
as equals ("they shouldn't be fallbacks though right. Some of them are equal"); else the first
Artist on Stage who is not support. With only support on Stage, the first of them names it, as
before. A `support` Role (vocal
support) counts as support too. Derived each time, never stored.

### Item

| Field | Type | Notes |
|---|---|---|
| `id`, `eventId` | uuid | |
| `position` | integer | Running order. A reorder renumbers the affected Items in one transaction, each an outbox change (constitution II) |
| `compositionKey` | string \| null | `kriti_id`. Null for RTP, viruttam, slokam, medley, free text (FR-010) |
| `title` | string | As picked or typed |
| `form` | DetailValue | Catalog form, or a project-kept non-composition form (RTP, viruttam, slokam, medley) |
| `ragas` | DetailValue[] | Ordered. One for most Items; several for ragamalika and RTP (FR-009) |
| `tala` | DetailValue | |
| `nadai` | DetailValue | Keys: `tisra`, `chatusra`, `khanda`, `misra`, `sankeerna`. Qualifies the `tala` and is shown with it, as in "Adi (khanda nadai)" |
| `composer` | DetailValue | For an RTP: `na` by default; the rasika may fill in whoever wrote the pallavi (FR-041) |
| `language` | DetailValue | |
| `subject` | DetailValue | Rolled up to a Topic at Wrapped time |
| `layaVinyasam` | `{ nadai: DetailValue, note: string \| null }` \| null | The Laya vinyasam that followed this Item (FR-011) |
| `improvised` | `{ kind: alapana \| tanam \| niraval \| kalpana_swaram, raga: DetailValue \| null }[]` | Improvised Details heard (FR-051). Shown in the usual concert order, not the order heard; `raga` is null when it is the Item's Raga. Entry design is open (T044) |
| `note` | string \| null | Erased on deletion requests |
| timestamps | | as Event |

Group keys for Linked ragas are never stored on the Item. The Wrapped looks them up in the
current catalog snapshot (design doc, "Stable references").

### Artist and Sabha (own)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | As typed |
| `nameKey` | string | The name folded as in search (`app/src/catalog/fold.ts`); groups promotion candidates |
| `aliases` | string[] | Names merged into this one (FR-036) |
| `mergedIntoId` | uuid \| null | Set on the merged-away record. Readers follow it |
| timestamps | | as Event |

A rasika's merge (P6) sets `mergedIntoId` on the old record and adds its name to the survivor's
`aliases`. Appearances are not rewritten; they resolve through `mergedIntoId`.

A rename of an own Artist (walkthrough S5, 2026-11-04) sets `name` and `nameKey` and adds the
name it replaced to `aliases`, so search still finds it; Appearances follow without being
rewritten. It is one ordinary save of the row, of the entry the id was merged into, if any (a
merge chain that can't be followed is refused); the journal checks it there. A shared Artist,
or an own one with a Link, is named by the Maintainer and is not renamed on the phone.

## Shared and server-written records (pulled, never pushed)

### Shared Artist and Shared Sabha

`id` (uuid), `name`, `aliases[]`, `listVersion` (integer). Seeded from the 11 Sabhas and the
Artists in last season's sheet (FR-005), plus three Sabhas frequent in the Schedule feed
(Krishna Gana Sabha, Vani Mahal, Bharat Kalachar), with the logger's short names as Sabha
Aliases (2026-11-08). The Maintainer edits them; every change bumps the list
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
shared Artist id, role, group, support: false when the feed leaves it out), `title`, `cancelled`. Not rasika-owned. Each file fetched
replaces the stored entries whole (T060); an Event made from an entry the newer file lacks is
never changed. The file's Season, `publishedAt` and the fetch's tag for it (the server's `ETag`, the file's sha256, as it came) are kept in `meta` as `schedule`. A file is refused whole, the stored copy and its tag kept, when any entry is malformed (a field the feed never leaves null, such as `cancelled`, given as null included), its `publishedAt` is not a real day and time with its offset, or it is for an earlier Season, or published earlier in the same one (compared as instants).

## Phone-only records

| Table | Purpose |
|---|---|
| `outbox` | `opId` (uuid, the idempotency key), `table`, `recordId`, `row` (a delete is the full row with `deletedAt` set), `baseSeq` (the last server `seq` known for the record, from `serverSeqs`, stamped when the entry is first sent and kept for every retry; eng review D11), `queuedAt`, `firstSentAt` (null until the first push attempt, so D8 knows the entry may already be stored). Written in the same transaction as the record (constitution I). A record has at most one never-sent entry: a save replaces its row in place; an entry sent at least once is never changed (eng review D8). Its length, with the `attention` entries, is the unsynced count, which therefore counts records with unsent or rejected changes (FR-016) |
| `serverSeqs` | Keyed by (`table`, `id`): `seq`, the last server `seq` this phone wrote (from an ack) or applied (from a pull), the base of the record's next op; and `held`, a newer server version (`seq` and row) that a pull skipped because the record had a pending or rejected op (eng review D4). The cursor has moved past a held row, so it is kept for "keep the server's" and as the base for "keep mine"; it never becomes `seq` on its own (eng review D11) |
| `attention` | Rejected ops ("needs attention"): `opId`, `queueSeq` (the op's outbox `seq`), `table`, `recordId`, the `row` as pushed, `code` (the server's rejection code, or `bad_request` for an op of a batch the server refused with a 400), `message`, `rejectedAt`. One per record, its latest rejection, listed in outbox order (`queueSeq`). Left the outbox, so never re-sent in a loop, but counted as unsynced until the rasika chooses "keep mine" or "keep the server's" (a `conflict`; "discard" is "keep the server's" there), or "try again" or "discard" (any other code). An ack of the same op or a later one of the record clears it; an ack of an earlier op doesn't (constitution II, outside voice 7) |
| `meta` | Key/value: `deviceId`, `pullCursor`, `catalogVersion`, `sharedListsVersion`, `schedule` (the stored Schedule file's `season`, `publishedAt` and `tag`, opaque outside the fetch; T060), consent answers, cached identity, "ready for offline" flags |

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
outbox:        ++seq, opId, recordId
meta:          key
serverSeqs:    [table+id]
attention:     opId, [table+recordId]
```

The schema version is 4: 1 the first tables, 2 sync (`serverSeqs`, `attention`), 3 Dance, Harikatha
and an Appearance's `group`, 4 an Appearance's `support` (no index change in either). Any release that changes a record's shape bumps it,
so a tab still running an older build closes its store instead of writing
([contracts/sync-api.md](contracts/sync-api.md), "Errors").

The catalog snapshot is not stored in IndexedDB. It ships as a precached, content-hashed file
loaded into memory at start ([contracts/catalog-snapshot.md](contracts/catalog-snapshot.md)).

## Server-only records

### Rasika

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Opaque. Survives de-identification. Not the Supabase user id |
| `authUserId` | uuid \| null | The Supabase Auth user (`auth.users`). Nulled on a deletion request |
| `email`, `name` | string \| null | From Google; `email` follows the auth user's on a change. Erased on a deletion request (FR-047) |
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

`rasikaId`, `opId`, `receivedAt`, and the answer the op got: the record's new `seq`, or a
rejection's `code` and `message`. An acked op also keeps its record (table and id) and the
record's `seq` before this device's run of writes to it. A primary key on (`rasikaId`, `opId`)
makes a repeated push a no-op (FR-015), and the kept answer lets a retried push get the same
reply. The kept lineage lets a retry after a lost reply carry later edits of the same record
without a `conflict`, while nothing else has written the record since.

### Promotion candidates (view)

Own Artists, Sabhas and hand-typed Events from rasikas whose `shareAdditions` is true, grouped
by a folded name, showing only the name and the number of rasikas (FR-042, P7 scenario 1).

## Deletion and de-identification (FR-047)

On request, in one transaction:

1. Delete the Supabase Auth user, which ends its sessions, and its sign-in flow states. Null `authUserId`, `email` and
   `name`, set `deidentifiedAt`, and delete devices.
2. Null every `note` on the rasika's Events and Items, including each Item's `layaVinyasam.note`,
   because free text can identify them.
3. Delete Supabase Auth's own audit log entries for the user (`auth.audit_log_entries`), which
   name them by auth user id, email and Google name. An entry found by email alone goes only if
   it names no other user.

The rasika is found by their auth user's current email. The email on the rasika row is used only
when the auth user is already gone, since an address can pass to someone else. Accounts are
deleted only through this request: an auth user deleted any other way leaves its rasika row
behind, and audit entries under an older email can no longer be found.
4. Delete the rasika's processed ops: no device of theirs can push again.
5. If `seasonReports` is not true, delete the rasika's season as well.

A kept season keeps everything but the notes: own Artist and Sabha names and aliases, Event and
Item titles, and typed Detail values, catalog overrides included. They are what season reports
count (how many Bhairavis were truly sung), and keeping all of them needs no field-by-field
rule to maintain as the records change. Nothing left links them to the person.

The consent answers stand after de-identification. A kept season from a rasika whose
`shareAdditions` is true still counts in the promotion candidates, which show only a name and a
number of rasikas.

## Validation rules

The phone enforces all of these before saving. The server stores each record as sent (eng
review D7) and checks only the record's id, its owner and its parent Event; rules that span
several rows, such as unique positions, are the phone's (eng review R6).

- An Item's `eventId` must point to an Event that is not deleted.
- `position` is unique among an Event's live Items after each transaction.
- A Lecdem needs a `title`. A Concert's `title` is null. A Dance's or Harikatha's `title` may be
  either.
- `kind` and `role` are one of the values above; `group` is null or a non-empty name; `support`
  is absent or a boolean.
- `DetailValue.key` is required for `catalog` and `override` and must be null otherwise.
- A pushed record whose `id` already belongs to another rasika is rejected (`foreign_rasika`;
  constitution, Privacy).

## Catalog version upgrade

Each snapshot ships a remap from earlier versions: old key → new key, or `retired`. On the
launch where the rasika accepts a new version (FR-038), one transaction:

- rewrites merged keys on every Item `DetailValue` and `compositionKey`;
- turns retired keys into `unresolved` with `text` kept;
- leaves `state` alone, so Overrides stay Overrides;
- queues each changed Item in the outbox.

This path has a required test (constitution IV, "catalog updates").
