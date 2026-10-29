# Contract: Catalog Snapshot

The versioned, content-hashed file the logger project produces and this app ships to the phone
(constitution, Boundaries). The logger owns its content. This file defines its shape.

## Delivery

- The logger exports a snapshot file. This app's build copies it to
  `app/public/catalog/catalog.<hash>.json`, and it is precached in the first-install phase.
- A new catalog version is a new app deploy. The service worker's prompt-to-update applies it
  on the next launch, only after the rasika agrees (FR-038). It is never swapped mid-Concert.
- Size: the full catalog measured 448 KB brotli (research.md), inside the 2 MB first-install
  budget. The build fails if the shell, snapshot and search together pass 2 MB (constitution V).

## Shape (format 1)

Strings that repeat across 30,539 songs are stored once and referred to by index (dictionary
encoding). Keys are natural keys, never logger row ids (constitution III).

```json
{
  "format": 1,
  "version": "2026.11.10-1",
  "source": { "loggerCommit": "abc1234", "builtAt": "2026-11-10T09:00:00Z" },
  "ragas":     { "key": ["Todi", "…"], "display": ["Tōḍi", "…"], "aliases": [["Thodi"], "…"], "groupKey": ["todi", "…"], "mela": [8, "…"] },
  "composers": { "key": ["tyaagaraaja", "…"], "display": ["Tyagaraja", "…"], "aliases": [["Thyagaraja"], "…"] },
  "talas":     { "key": ["adi", "…"], "display": ["Adi", "…"] },
  "languages": { "key": ["Telugu", "…"] },
  "subjects":  { "key": ["Rama", "…"] },
  "forms":     { "key": ["kriti", "…"] },
  "songs": {
    "kritiId":   ["c0134", "…"],
    "title":     ["Viribhoni", "…"],
    "firstLine": ["…", "…"],
    "raga":      [12, "…"],
    "tala":      [3, "…"],
    "composer":  [40, "…"],
    "language":  [1, "…"],
    "subject":   [7, "…"],
    "form":      [0, "…"],
    "ragamalika": [[], "…"]
  },
  "remap": {
    "ragas":     { "<old key>": "<new key> | null" },
    "composers": { "<old key>": "<new key> | null" },
    "songs":     { "<old kritiId>": "<new kritiId> | null" }
  }
}
```

Field notes:

- Song columns are parallel arrays of equal length. `-1` means no value (for example, a song
  with no tala).
- `groupKey` comes from the logger's `raga-groups.json`. Ragas with the same `groupKey` are
  Linked ragas. Ragas never share a `key`.
- Aliases come from the logger's normalize and alias maps. Aliases are search terms only;
  matching an Alias stores the raga's `key`.
- `ragamalika` lists raga indices in order for songs that have several.
- `remap` is cumulative from every earlier version: a key mapped to `null` is retired. The
  upgrade rules are in [data-model.md](../data-model.md), "Catalog version upgrade".

## Hash and integrity

The file name carries the SHA-256 of its bytes. The app checks it after loading and refuses a
mismatched file, keeping the previous version.

## Project-kept tables (this repository, not the logger)

Composer dates and the Subject-to-Topic roll-up are owned here (constitution, Boundaries):

- `app/src/reference/composer-dates.json`: `{ "<composer key>": { "born": 1767, "died": 1847, "approx": false } }`, seeded from last season's Timelines sheet (56 Composers).
- `app/src/reference/topics.json`: `{ "<subject key>": "<Topic>" }`, seeded from last season's Topic column.

Both are bundled with the app, count toward the first-install budget, and update through the
same prompt-to-update as the snapshot. Their keys are catalog natural keys, so they survive
catalog rebuilds.

## Required tests (constitution IV, "catalog updates")

- A merged key is rewritten on stored Items; an Override keeps its state.
- A retired key becomes Unresolved with its text kept.
- Changing a `groupKey` in a new version changes the top-ragas Card for previously logged Items.
