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
- `notSaved` (optional; eng review D6, 2026-11-01): present only in an Export started from a
  "Not saved on this phone" line. It lists the values the phone could not store, each with the
  record it belongs to (`table`, `id`, `field`, `value`, `enteredAt`), read from the screen
  without writing to the database. Every other array still comes from the store, so the file is
  the stored season plus what failed to save, clearly separated.

Importing an export is out of scope this season (YAGNI). The format keeps every field an import
would need.

## Spreadsheet (stretch)

The shape of last season's sheet (`docs/reference/wrapped-2024-25.xlsx`): Main (one row per
Concert), Lecdems, Colours and Compositions (one row per Item). It is written with
write-excel-file in the second download.

## Required test (constitution IV, "export")

An export taken offline, with unsynced ops, contains every live and tombstoned record in the
store.
