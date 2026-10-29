# Implementation Plan: Season Logger and Live Wrapped

**Branch**: `main` (spec directory `specs/001-season-logger`) | **Date**: 2026-10-29 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-season-logger/spec.md`

**Status**: Phase 1 drafted. Hosting and sign-in are decided: Supabase Auth and Supabase
Postgres ([ADR 0001](../../docs/adr/0001-supabase-for-sign-in-and-server-store.md)), built last.

## Summary

A local-first PWA. The phone holds the whole working season in IndexedDB (via Dexie), the
catalog snapshot in memory, and a search index. Every save is one local transaction that writes
the record and its outbox entry. When the app is open with signal, the outbox is pushed to a
thin HTTP API over Postgres, and server changes are pulled by cursor. The Wrapped and its Cards
are computed on the phone from the log. The catalog arrives from the logger project as a
content-hashed snapshot built into each deploy. See [research.md](research.md) for the evidence
behind each choice.

## Technical Context

**Language/Version**: TypeScript (strict) on both phone and server.

**Primary Dependencies** (phone):

| Dependency | Size (gzip) | Status |
|---|---|---|
| React 19 + react-dom | 67 KB | Decided 2026-10-29 |
| wouter 3.13 (router) | 3 KB | Decided 2026-10-29 |
| Dexie 4.4.x + dexie-react-hooks | 32 KB | Decided |
| uFuzzy 1.0.x | 4 KB | Decided |
| vite-plugin-pwa 2.0 / Workbox 7.4 | build-time + service worker | Decided |
| write-excel-file 4.x | 20 KB, second download | Decided |
| Card renderer: Satori + resvg, Takumi or Canvas 2D | 0 to 1.67 MB, second download | **Pending**, needed before Cards work |

**Primary Dependencies** (server): Supabase (ADR 0001). Google sign-in through Supabase Auth,
with `@supabase/supabase-js` on the phone, used only when syncing. Push and pull follow the
[sync contract](contracts/sync-api.md), as Postgres functions or Edge Functions, decided when
the server is built.

**Storage**: IndexedDB through Dexie on the phone ([data-model.md](data-model.md)); Supabase
Postgres on the server. Development uses a local Supabase (CLI on Docker), free and never
paused. The season's database moves to Supabase Pro in Mumbai before rasikas sign up, because
free projects pause after a week idle and have no automatic backups. DuckDB only for the
Maintainer's end-of-season report, reading Postgres read-only.

**Testing**: Vitest for units and the store; Playwright for end-to-end runs in offline mode
(`context.setOffline`); a real installed PWA on the primary test device before each release.
Both tools are named in `docs/skills-router.md`.

**Target Platform**: current iOS Safari and Android Chrome, installed to the home screen. The
primary test device is still to be named by the Maintainer.

**Project Type**: web application: a PWA and an HTTP API.

**Performance Goals** (constitution V, SC-006 to SC-009): cold start under 1.5 s in airplane
mode; search under 50 ms p95; save under 100 ms; Cards include a Concert within 1 s of saving.

**Constraints**: offline-first logging (constitution I); first-install download under 2 MB
(the catalog alone is 448 KB brotli, measured); second download under 3 MB; no background sync
on iOS.

**Scale/Scope**: about 40 Events and 250 Items per rasika per season (last season: 33
Concerts, 6 Lecdems, 193 Items); 30,539 catalog songs; open sign-up, so rasika count is
unknown. About 10 screens.

## Constitution Check

*Gate before Phase 0 and again after Phase 1 design.*

| Principle | How the plan meets it | Result |
|---|---|---|
| I. Offline-First Logging | Logging reads and writes only the Dexie store and the in-memory catalog. Save = one Dexie transaction (record + outbox). Sync triggers: start, `online`, visible, after save. 401 and network errors never block or redirect | Pass |
| II. Nothing Is Lost | UUIDv7 ids and `opId` idempotency; tombstones; integer `position`; restore pushes before pulling; unsynced count = outbox length; JSON export offline; `persist()` on first run | Pass |
| III. Catalog Suggests | `FieldValue` keeps state and text for every field; Overrides never reset; natural keys with a remap; Linked ragas looked up at Wrapped time, never stored; catalog read-only | Pass |
| IV. Grounded in the Data | Sizes measured; colour palette and seeds from last season's sheet. Required tests listed in each contract for the six data-loss paths | Pass |
| V. Budgets | First install about 0.6 MB measured so far (catalog 448 KB, React 67, Dexie 32, uFuzzy 4, wouter 3) of 2 MB; size check in the build | Pass; card renderer to be measured against the 3 MB second budget |
| VI. Deliberate Decisions | Each choice made by the Maintainer, one at a time. ADRs in `docs/adr/`: 0001 hosting and sign-in, 0002 phone store, 0003 sync model, 0004 catalog keys and snapshot, 0005 data shape | Pass |
| Boundaries: one storage module | All Dexie access sits in `app/src/store/` | Pass |
| Boundaries: privacy | Server checks `rasikaId` on every row; Maintainer endpoints return names and counts only; de-identification nulls notes too; consent events logged | Pass; DPDP legal check before public launch |

No principle is bent, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-season-logger/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── sync-api.md
│   ├── catalog-snapshot.md
│   ├── schedule-feed.md   # proposed; needs the logger project's agreement
│   └── season-export.md
└── tasks.md             # /speckit-tasks, not created here
```

### Source Code (repository root)

```text
app/                         # the PWA (Vite + React)
├── public/catalog/          # catalog.<hash>.json, copied from the logger's export
├── src/
│   ├── store/               # the one storage module: Dexie schema, outbox, sync client, export
│   ├── catalog/             # snapshot loader, transliteration fold, uFuzzy search, upgrade remap
│   ├── reference/           # composer-dates.json, topics.json (project-kept)
│   ├── screens/             # Plan, Event, Item, Lecdem, Tidy, Wrapped, Settings
│   ├── wrapped/             # aggregations and Cards (Cards load in the second download)
│   └── sw.ts                # service worker: two-phase precache, prompt-to-update
├── tests/                   # Vitest
└── e2e/                     # Playwright, offline scenarios

supabase/                    # Supabase CLI project, built last (ADR 0001)
├── config.toml              # local stack; Google sign-in
├── migrations/              # tables, row-level security, sync functions
├── functions/               # Edge Functions, only if push and pull go there
└── tests/                   # sync, privacy and promotion tests against the local stack

shared/                      # TypeScript types for records and sync payloads, used by both

tools/
├── import-2024-25/          # reference import through the app's matching (FR-039, FR-040)
└── golden-set/              # ~100 variant spellings for SC-010
```

**Structure Decision**: the phone app (`app`), the Supabase project (`supabase`) and a shared
types package in one repository. The phone app builds and runs alone, which keeps the design
doc's fallback: if the server is not ready by 1 December, the static app ships with export
only, and the outbox pushes after the first sign-in once the server is live.

**Build order**: the server is built last (ADR 0001). The phone app, outbox and export come
first; the outbox only queues until then. The sync tests that need a server run against the
local Supabase once it exists.

## Remaining before `/speckit-tasks`

1. Card renderer decision (can wait until the Cards tasks, before 20 December work starts).
2. Schedule feed shape agreed with the logger project.
3. Install the contingent skills the router names: `vitest` when the app is scaffolded, and
   `supabase/agent-skills@supabase` when the server work starts.

## Complexity Tracking

None.
