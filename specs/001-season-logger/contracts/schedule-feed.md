# Contract: Schedule Feed

**Status: proposed.** The logger project owns the Schedule (constitution, Boundaries). This
shape still needs agreeing with the logger project. Until a feed exists, P3 works from
hand-entered Plan entries alone (FR-025).

## Delivery

- The logger publishes one file per Season. This app's server serves it at
  `GET /v1/schedule/{season}` with an `ETag`, so phones download it only when it changed.
- The phone fetches it when online and stores the entries locally. The logging path never
  waits for it.

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
        { "name": "…", "role": "lead" },
        { "name": "…", "role": "violin" }
      ],
      "cancelled": false
    }
  ]
}
```

- `id` MUST stay the same for an entry across versions, and MUST never be reused for another
  Event.
- `version` increases whenever any field of the entry changes.
- `sabha` and `billed[].name` are names. The phone matches them to shared or own Sabhas and
  Artists as it does typed names. `role` uses the Role values in
  [data-model.md](../data-model.md).
- A cancelled Event stays in the feed with `cancelled: true`. It is not removed.

## How the phone applies a new version (FR-027)

For each Event with a `scheduleEntryId`:

- `touched` is false: copy the new date, time, Sabha and billed Artists; set `cancelled`.
- `touched` is true: change nothing; set `scheduleChanged` so the hint shows.
- Either way, record `scheduleVersionSeen`.

## Open with the logger project

- Who assigns `id`s, and how they stay stable when a Sabha reissues its list.
- Whether Lecdems are in the same feed.
- Where the file is published for this server to fetch.
