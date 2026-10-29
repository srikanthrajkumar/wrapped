---
status: accepted
---

# Dexie on IndexedDB for the phone store

The phone keeps the working season in IndexedDB through Dexie 4.4.x. Every Dexie call sits in
one module (`app/src/store/`), so a native wrapper such as Capacitor could swap the storage
without touching screens (constitution, Boundaries). Dexie costs 32 KB (measured), works on
every iOS Safari that can install the app, and its live queries redraw screens and the Wrapped
on each save. A season is about 250 Items, so a relational engine on the phone buys nothing.
Decided 2026-10-29; evidence in `specs/001-season-logger/research.md`.

## Considered options

- **SQLite WASM** (`opfs-sahpool`): about 430 KB, a quarter of what the first-install budget
  has left after the catalog, for no gain at this size. Needs Safari 16.4+.
- **PGlite**: about 4 MB, and its OPFS storage fails on Safari (252 file-handle cap).
- **DuckDB-WASM**: 5.6 to 6.3 MB, about three times the whole first-install budget, with no
  evidence of OPFS persistence on iOS. DuckDB is kept only for the Maintainer's end-of-season
  report, reading the server's Postgres read-only.

## Consequences

- IndexedDB can be cleared by iOS, so the phone store is a working copy. The server copy,
  restore and export carry the guarantee (ADR 0003).
- The catalog is not stored in IndexedDB. It is loaded into memory from a precached file
  (ADR 0004).
