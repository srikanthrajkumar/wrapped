# Contract: Schedule Feed

**Status: agreed with the logger project on 2026-11-06** (T057). The logger project owns the
Schedule (constitution, Boundaries) and publishes it as this feed; this project only reads it.
The Maintainer decided publishing, the Roles, group names and the Event kinds the same day. P3
still works from hand-entered Plan entries alone when no feed is reachable (FR-025).

## Delivery

- The logger writes one content-hashed file per Season and change,
  `schedule.{season}.{sha256}.json`, and uploads it to a private Supabase Storage bucket on this
  project's Supabase project. It uploads after each collection run that changed something,
  separately from app deploys: a new Schedule never waits for a release, and a release never
  carries one. The upload credential is the Maintainer's setup, never in either repository.
- This app's server serves the newest file for a Season at `GET /v1/schedule/{season}`, with the
  file's sha256 (lower-case hex, quoted) as its `ETag`. A request whose `If-None-Match` matches
  gets `304` and no body, so a phone downloads the file only when it changed. The bucket itself
  is never public.
- The phone fetches the feed when online and stores the entries locally. The logging path never
  waits for it, and a failed fetch keeps the last copy.

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
- it reads a Role it doesn't know as null, since a Role is only a hint;
- it skips an entry of a kind it doesn't know, leaving any Event already made from it alone.

So new optional fields, Roles and kinds stay in format 1. The format number changes only when an
existing field changes meaning or type, or a field a reader needs becomes required.

## How the phone applies a new version (FR-027)

For each Event with a `scheduleEntryId`:

- `touched` is false: copy the new date, time, Sabha, kind, title and billed Artists, with their
  Roles and group names; set `cancelled`.
- `touched` is true: change nothing; set `scheduleChanged` so the hint shows.
- Either way, record `scheduleVersionSeen`.

## Still open

- **Who plays at a Dance.** Listings often name only the dancer. The Maintainer is consulting the
  logger project on collecting the musicians on stage, so early Dance entries may bill the dancer
  alone.
- **The upload credential.** The Maintainer sets up the credential the logger uploads with, and
  where it is kept, before the first upload to the hosted project (T111).
- **Which file is newest.** How the server finds the current file for a Season among the uploaded
  ones (a pointer the logger writes after the file, or the newest `publishedAt`) is settled with
  the logger project when the endpoint is built (T124).
