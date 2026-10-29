---
status: accepted
---

# Catalog by natural key, shipped in each deploy

Logged Items point at catalog entries by natural key, never by logger row id. The keys are the
karnatik `kriti_id`, the canonical raga name, the composer `name_key`, and the tala, language,
subject and form names. The logger rebuilds its tables on every run and regenerates row ids, so
any id-based link would break on the next rebuild. The catalog reaches the phone as one
content-hashed snapshot file that each app deploy includes and precaches. A new catalog is
therefore a new deploy, applied on the next launch after the rasika agrees, never in the middle
of a Concert. Decided 2026-10-29 from the design doc; the shape is in
`specs/001-season-logger/contracts/catalog-snapshot.md`.

## Considered options

- **Logger row ids**: smaller, but invalidated by every rebuild.
- **A catalog API queried as the rasika types**: fails offline (constitution I).
- **The catalog in IndexedDB with delta updates**: needs a second sync path and its own
  migrations, to save re-downloading a file of about 450 KB a few times a season.
- **Storing the Linked-raga group on each Item**: goes stale whenever the logger links or
  unlinks a pair. The group is looked up from the current snapshot when the Wrapped is computed.

## Consequences

- **Size**: strings that repeat across 30,539 songs are stored once (dictionary encoding),
  which keeps the snapshot at 448 KB brotli, measured.
- **Text fallback**: every Item also keeps the text as typed or picked.
- **Remap on upgrade**: each snapshot carries a cumulative remap of merged and retired keys.
  Merged keys are rewritten on stored Items; a retired key becomes Unresolved with its text
  kept; Overrides keep their state. This path has a required test (constitution IV).
- **Project-kept tables**: composer dates and the Subject-to-Topic roll-up are owned by this
  repository, keyed by the same natural keys, and bundled with the app. They update through the
  same prompt to update on the next launch.
- **Logger contract**: the logger project must keep these keys stable, and must report merges
  and retirements between versions so the remap can be built.
