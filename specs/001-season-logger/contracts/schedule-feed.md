# Contract: Schedule Feed

**Status: agreed with the logger project on 2026-11-06** (T057). The logger project owns the
Schedule (constitution, Boundaries) and publishes it as this feed; this project only reads it.
The Maintainer decided publishing, the Roles, group names and the Event kinds the same day. P3
still works from hand-entered Plan entries alone when no feed is reachable (FR-025). Delivery
was settled with the logger project on 2026-11-09 (T124): a pointer per Season, served by this
app's server, with no sign-in. The Maintainer put it in the logger's own Supabase project, beside
the catalog, the same day (ADR 0009).

## Delivery

- The logger writes one content-hashed file per Season and change,
  `{season}/schedule.{season}.{sha256}.json`, and uploads it to the private `schedule` bucket in
  the public-data project's Storage: the logger's own Supabase project, which holds the catalog
  tables, never the project that holds rasikas' seasons (ADR 0009). A file is written once and never changed. It uploads after
  each collection run that changed something, separately from app deploys: a new Schedule never
  waits for a release, and a release never carries one.
- After the file, the logger writes the Season's pointer, `{season}/current.json`, naming the
  current file. It writes the pointer only once the file is uploaded, so a pointer never names a
  file that isn't there, and only the pointer ever moves:

  ```json
  {
    "format": 1,
    "season": "2026-27",
    "file": "2026-27/schedule.2026-27.<sha256>.json",
    "sha256": "<sha256>",
    "publishedAt": "2026-11-20T10:00:00Z"
  }
  ```

  `file` is the file's path in the bucket. `sha256` is the lower-case hex sha256 of the file's
  exact bytes, the same hash as in its name. `publishedAt` is the file's.
- Only the logger writes to the bucket (`pipeline/schedule/upload-feed.ts`, logger PR #70), with
  a secret key of that project (`sb_secret_…`), which the Maintainer sets on the logger's VM and
  is never in either repository. It uploads the file with `x-upsert: false`, reads the pointer back through
  `/storage/v1/object/authenticated/schedule/{season}/current.json` so it never moves it to an
  earlier `publishedAt`, then writes the pointer with `x-upsert: true` and
  `cache-control: no-cache`. The bucket is `schedule`, created by this app's migration for that
  project (`supabase-public/`); the uploader never creates one. The bucket is never public, and neither `anon` nor
  `authenticated` has any Storage policy on it: no phone reads it directly. A restrictive policy
  keeps it that way if a later one grants reads on other buckets
  (`supabase-public/supabase/migrations/0001_schedule_bucket.sql`).
- This app's server serves a Season at `GET /v1/schedule/{season}`, which is the `schedule` Edge
  Function in the public-data project, `{VITE_PUBLIC_DATA_URL}/functions/v1/schedule/{season}`
  (ADR 0001, "The Schedule as an Edge Function"). It needs no sign-in: the listings are public (Maintainer, 2026-11-09). It reads
  `{season}/current.json`, then the file the pointer names, and checks the file's sha256 against
  the pointer's, and the file's own `season` against the one asked for, before answering:

  | Answer | When |
  |---|---|
  | `200`, the file's exact bytes, `ETag: "<sha256>"` | The pointer is usable and the file matches it |
  | `304`, no body, the same `ETag` | `If-None-Match` names the pointer's sha256 (the file isn't read) |
  | `404 {"code":"no_season"}` | The Season has no pointer, or the path names no Season |
  | `502 {"code":"pointer_unreadable"}` | The pointer isn't JSON, isn't format 1, is for another Season, or names any file but `{season}/schedule.{season}.{sha256}.json` with its own lower-case `sha256` |
  | `502 {"code":"file_missing"}` | The file the pointer names isn't in the bucket |
  | `502 {"code":"sha256_mismatch"}` | The file's bytes don't hash to the pointer's `sha256` |
  | `502 {"code":"season_mismatch"}` | The file's own `season` isn't the Season asked for: another Season's file uploaded under this one's path (Codex, T124 review) |

  The `ETag` is the sha256, quoted. When the body is compressed on the way (the Edge runtime
  gzips it for a client that accepts that), the tag comes marked weak, `W/"<sha256>"`; it still
  matches, since `If-None-Match` compares weakly. Answers carry `Access-Control-Allow-Origin: *`
  and expose `ETag`, and a preflight allows `If-None-Match`, so the installed app can ask from
  its own origin.
- The phone asks the public-data project (`VITE_PUBLIC_DATA_URL`, set by
  `tools/deploy/deploy.sh`; never the sync project's `VITE_SUPABASE_URL`) for the Season of the
  day:
  from 1 July, the one that starts that year (2026-27 from 1 July 2026); before July, the one
  that started the year before. It asks when online, at launch and on each return online,
  sending the stored copy's tag as `If-None-Match`, and stores a new file with its `ETag`, as it
  came, as the tag (`store/schedule-fetch.ts`). A build with no public-data URL fetches nothing, as every test build does,
  and P3 works from the Plan alone. The logging path never waits for the fetch. Any answer but
  `200` with a file the reader accepts, or no answer, keeps the stored copy and its tag. So does
  a file whose `season` isn't the Season the phone asked for: taken, it would replace the stored
  Schedule, and every corrected file after it would be refused as an earlier Season.

## Shape (format 1)

```json
{
  "format": 1,
  "season": "2026-27",
  "publishedAt": "2026-11-20T10:00:00Z",
  "entries": [
    {
      "id": "music-academy-2026-12-15-1600",
      "version": 3,
      "date": "2026-12-15",
      "startTime": "16:00",
      "sabha": "Music Academy",
      "kind": "concert",
      "title": null,
      "billed": [
        { "name": "…", "role": "vocal", "group": "Malladi Brothers" },
        { "name": "…", "role": "vocal", "group": "Malladi Brothers" },
        { "name": "…", "role": "violin" },
        { "name": "…", "role": null }
      ],
      "cancelled": false
    }
  ]
}
```

### Entries

- **`id`** is assigned by the logger and kept by its committed ledger. It stays the same for an
  Event across versions, including when its time or Artists change, and is never reused for
  another Event. It is opaque: the phone never reads a date, time or Sabha from it, though it
  may look like one. A listing the logger can't match to one Event for certain is withheld until
  the Maintainer rules on it, rather than given a new id.
- **`version`** increases only when the entry's content changes (the logger compares a hash of
  the entry). An unchanged entry keeps its version across files.
- **`date`** is the ISO date. **`startTime`** is the printed local Chennai time (IST) as `HH:MM`,
  with no offset, or null when the listing gives none.
- **`sabha`** is the logger's ruled display name for the Sabha. The phone matches it to shared
  or own Sabhas as it does a typed name.
- **`kind`** is `concert`, `lecdem`, `dance` or `harikatha`. Upanyasams and talks are not in the
  feed.
- **`title`** is null for a Concert, and the printed title for a Lecdem, a Dance or a Harikatha.
  A Lecdem always has one; a Dance or a Harikatha has one when the listing prints it, else null.
- **`cancelled`** is true only when the Maintainer has ruled the Event cancelled. A cancelled
  entry stays in the feed. An Event dropped from a Sabha's listing is never inferred to be
  cancelled, and the phone never changes or removes an Event because its entry is missing from
  a newer file.

### Billed

- **`billed`** is everyone billed on stage, in billing order as on the listing; the phone keeps
  that order. It may be empty (`[]`).
- **`name`** is the logger's ruled display spelling. The phone matches it to shared or own Artists
  by name or Alias, as it does a typed name.
- **`role`** is a hint, not a fact: one of the Role values in [data-model.md](../data-model.md),
  or null when the listing doesn't say (about half of the billed people in the first dev feed).
  The logger maps printed roles to these values rather than to `other` wherever one fits.
  - In a Lecdem, a person billed without a role is billed as `presenter`.
  - In a Harikatha, the performer is billed as `presenter`, with the accompanists in their Roles.
  - In a Dance, the dancers are `dancer`, the nattuvanar `nattuvangam`, and the musicians in
    their music Roles.
- **`group`** (optional) is the name a group is billed under, such as "Malladi Brothers". A group
  is billed as its members, each its own entry, adjacent and in billing order, and each carrying
  the same `group`. It is absent, or null, for anyone not billed as part of a group. It is for
  display only: the Concert line and the Schedule card show it in place of the members' names,
  and each member still gets their own Appearance and counts on their own in the Wrapped.

### Format number

Adding `group`, the kinds `dance` and `harikatha` and the new Roles keeps **`format: 1`**. No
reader of the feed has been built yet (T058 to T061), so nothing already installed can misread
the additions; the first dev feed already says `format: 1`; and every addition is optional or a
new value. From the first reader on:

- the phone ignores fields it doesn't know;
- it refuses the whole file, keeping the copy it has, when any entry is malformed (an `id`,
  `version`, `date` that doesn't exist, `startTime`, `sabha`, `kind`, `title`, `cancelled` or a
  billed `role` of the wrong type, or `billed` not a list of named people), when `publishedAt`
  isn't a real day and time with its offset (`2026-11-31`, `24:00` or `:60` is none), or when the
  file is for an earlier Season than the one it has, or published before it in the same Season
  (compared as instants, so `+05:30` and `Z` order right) (PR #25 review);
- only `startTime`, `title`, a billed `role` and `group` may be null. `id`, `version`, `date`,
  `sabha`, `kind`, `cancelled`, `billed` and a billed `name` are always given, never null: a
  `cancelled` of null is refused, never read as false, so it can't reinstate a cancelled Event;
- it reads a Role it doesn't know as null, since a Role is only a hint;
- it skips an entry of a kind it doesn't know, leaving any Event already made from it alone.

So new optional fields, Roles and kinds stay in format 1. The format number changes only when an
existing field changes meaning or type, or a field a reader needs becomes required.

## How the phone applies a new version (FR-027)

For each Event with a `scheduleEntryId`:

- Attended or Missed: change nothing, set no hint, record nothing. It is the rasika's record of
  what happened (2026-11-07).
- `touched` is false: copy the new date, time, Sabha, kind, title and billed Artists, with their
  Roles and group names; set `cancelled`.
- `touched` is true: change nothing; set `scheduleChanged` so the hint shows, but only when the
  version differs in a field the hint's sheet shows (date, time, Sabha, kind, title, cancelled,
  billed Artists). A Planned Event whose Stage the rasika changed counts as touched (T058).
- Billed Artists are matched Artist by Artist, never by place. A Schedule-made Appearance has the
  id derived from the Event and the Artist, so two phones write the same record. One billed again
  keeps its Appearance and takes the group, and the Role unless the entry gives none (a null Role
  names nothing). A Schedule tombstone of the Artist, or of one since promoted or merged into
  them, comes back as that row, Colours and Role kept, still naming the Artist it was made for
  (which reads as the billed one). One the
  rasika added by hand stands for their billing as it is: never billed, its Role and group never
  changed, never removed, never doubled.
- Either way, on a Planned Event, record `scheduleVersionSeen`.
- A version that would break a rule (a Lecdem billed with more than 3 presenters) changes
  nothing and is not recorded, so a corrected version still applies.
- A cancelled entry never hides or removes an Event: a Planned one stays in its day on Season,
  shown as cancelled, until the rasika removes it (2026-11-07). The entries are listed in
  Season's timeline, quieter than the rasika's own, with no add on the row: an entry's sheet adds
  it (2026-11-08; there is no Schedule screen).

When the rasika answers the hint (2026-11-07):

- **Take it** gives the Event what the stored entry names, in one transaction: its date, its time
  and printed title when it gives them (a null one names none, so the rasika's stays), its Sabha,
  kind and `cancelled` (a reinstated entry clears it), and, when it bills anyone, its billed
  Artists, matched as above. A Schedule Artist no longer billed is removed, unless the rasika
  gave them a Colour, when they stay, no longer billed; the rasika's own Artists stay as they
  are. Notes, status, Items and everything else stay. Only a Planned Event takes it. A rule the
  result would break refuses it whole, and so does a stored entry newer than the one shown, or
  an Artist's Schedule id held by a row of another Artist. A change to Concert that takes a typed
  title keeps it in a receipt for Undo, as a kind change does.
- **Keep mine** clears `scheduleChanged` and changes nothing else.

## Still open

- **Who plays at a Dance.** Listings often name only the dancer. The Maintainer is consulting the
  logger project on collecting the musicians on stage, so early Dance entries may bill the dancer
  alone.
- **The upload credential, on the public-data project.** The logger uploads with that project's
  secret key, set by the Maintainer on its VM as `SCHEDULE_UPLOAD_KEY`, with
  `SCHEDULE_UPLOAD_SUPABASE_URL` and `SCHEDULE_UPLOAD_BUCKET`, before the first upload
  (`docs/setup/schedule-hosting.md`).
