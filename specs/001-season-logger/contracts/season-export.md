# Contract: Season Export

The file the rasika can produce at any time, offline included (FR-019, constitution II).

## JSON (required)

Built entirely from the phone store, then handed to the share sheet or saved.

```json
{
  "format": 1,
  "exportedAt": "2026-12-14T21:30:00+05:30",
  "appVersion": "1.0.0",
  "catalogVersion": "2026.11.10-1",
  "unsyncedOps": 4,
  "events": [],
  "appearances": [],
  "items": [],
  "artists": [],
  "sabhas": [],
  "links": []
}
```

- Each array holds full records as in [data-model.md](../data-model.md), tombstones included,
  so the file is a complete copy of the season.
- `unsyncedOps` tells the rasika whether the server is behind.
- Shared lists and the catalog are referenced by id and key, not copied.
- No account details are included.
- `notSaved` (optional; eng review D6, 2026-11-01; docs/adr/0007, 2026-11-02): present only in
  an Export started from a "Not saved" row or the rescue screen. It is the whole journal of
  values not yet seen in the phone store, in the order entered, each with the record it belongs
  to (`table`, `id`, `field`, `value`, `enteredAt`) and its `state`: `typed` (waiting for the
  autosave's pause), `saving` (its write running), `failed`, or `unconfirmed` (written, and the
  store not yet read back holding it). It is read from the journal, without writing to the
  database. Every other array still comes from the store, so the file is the stored season plus
  what is not yet in it, clearly separated. A move is not journalled. `field` is a field of the
  record, or one of these, whose `value` is shaped so the change can be placed back by hand:

  | `table` / `field` | What it is | `value` |
  |---|---|---|
  | `events` / `*` | A new Concert ("Log a Concert now") | `{ "kind", "date", "startTime" }` |
  | `items` / `*` | A new Item's first pick | `{ "eventId", "pick", "label" }` |
  | `items` / `pick` | A changed pick (not retried; kept for Export) | `{ "eventId", "pick", "label" }` |
  | `appearances` / `*` | An Artist added to a Concert | `{ "eventId", "artistId", "name" }` |
  | `artists` / `*`, `sabhas` / `*` | A new own Artist or Sabha | the name as typed |
  | `events` / `sabhaId` | A changed Sabha | `{ "id", "name" }` |
  | `events` / `logging` | "Done with this Concert" | `"done"` |
  | `appearances` / `colours` | Changed Colours | `{ "colourPrimary", "colourSecondary" }` |
  | any / `deletedAt` | A delete | `"deleted"` |

  A `pick` is `{ "kind": "song", "kritiId", "title" }`, `{ "kind": "raga", "key", "display" }`,
  `{ "kind": "form", "form" }`, `{ "kind": "unknown" }` or `{ "kind": "typed", "text" }`.
- `storeUnreadable` (optional; review of PR #5, 2026-11-02): present only when the phone store
  itself could not be read (the database closed or lost, as WebKit's "Connection to Indexed
  Database server lost", or not answering within 10 seconds). It holds
  `{ "error": "<name>: <message>" }`; every record array is then empty, `catalogVersion` and
  `unsyncedOps` are `null`, and `notSaved` still carries the values the screen held, so they
  leave the phone even when the store can't. A rasika who sees this marker has not lost the
  stored season: it is still on the phone, unread. Only a rescue Export is ever written this
  way, named `carnatic-wrapped-<day>-store-unreadable.json`; a plain Export of an unreadable
  store fails visibly instead of handing over empty arrays.
- The journal lives in `localStorage`, one key per field or new record
  (`wrapped.notSaved.v1:<table>:<id>:<field>`), from the moment a value is entered until the
  store is read back holding it, so a reload, a force-close or iOS ending the page doesn't lose
  it. Each copy is checked as it is read; a damaged one is skipped. An Export never removes
  anything: the rasika's Clear does, after confirming the file is saved, and only for the
  entries that file holds, matched by value and `enteredAt`.

Importing an export is out of scope this season (YAGNI). The format keeps every field an import
would need.

## Spreadsheet (stretch)

The shape of last season's sheet (`docs/reference/wrapped-2024-25.xlsx`): Main (one row per
Concert), Lecdems, Colours and Compositions (one row per Item). It is written with
write-excel-file in the second download.

## Required test (constitution IV, "export")

An export taken offline, with unsynced ops, contains every live and tombstoned record in the
store.
