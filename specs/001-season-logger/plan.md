# Implementation Plan: Season Logger and Live Wrapped

**Branch**: `main` (spec directory `specs/001-season-logger`) | **Date**: 2026-10-29 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-season-logger/spec.md`

**Status**: Phase 1 drafted. Hosting and sign-in are decided: Supabase Auth and Supabase
Postgres ([ADR 0001](../../docs/adr/0001-supabase-for-sign-in-and-server-store.md)), built last.

**Reviews**: the engineering and design review history is in [reviews.md](reviews.md).

## Summary

A local-first PWA. The phone holds the whole working season in IndexedDB (via Dexie), the
catalog snapshot in memory, and a search index. Every save is one local transaction that writes
the record and its outbox entry. When the app is open with signal, the outbox is pushed to
Supabase (Postgres functions or Edge Functions, ADR 0001), and server changes are pulled by
cursor. The Wrapped and its Cards
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
(`context.setOffline`); a real installed PWA on the iPhone 16 and the Redmi Note 5 before each release.
Both tools are named in `docs/skills-router.md`.

**Static hosting**: pending, task T054. The PWA's static files need a host before the
phone-only fallback can ship; ADR 0001 covers sign-in and the database only.

**Target Platform**: current iOS Safari and Android Chrome, installed to the home screen or in a
browser tab. Test phones: iPhone 16 (primary) and Redmi Note 5 (Android; speed budgets judged on
it as the slowest phone).

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
| II. Nothing Is Lost | UUID ids and `opId` idempotency; tombstones; integer `position`; restore pushes before pulling; unsynced count = outbox length; JSON export offline; `persist()` on first run | Pass |
| III. Catalog Suggests | `DetailValue` keeps state and text for every Detail; Overrides never reset; natural keys with a remap; Linked ragas looked up at Wrapped time, never stored; catalog read-only | Pass |
| IV. Grounded in the Data | Sizes measured; colour palette and seeds from last season's sheet. Required tests listed in each contract for the six data-loss paths | Pass |
| V. Budgets | First install about 0.6 MB measured so far (catalog 448 KB, React 67, Dexie 32, uFuzzy 4, wouter 3) of 2 MB; size check in the build | Pass; card renderer to be measured against the 3 MB second budget |
| VI. Deliberate Decisions | Each choice made by the Maintainer, one at a time. ADRs in `docs/adr/`: 0001 hosting and sign-in, 0002 phone store, 0003 sync model, 0004 catalog keys and snapshot, 0005 data shape | Pass |
| Boundaries: one storage module | All Dexie access sits in `app/src/store/` | Pass |
| Boundaries: privacy | Server checks `rasikaId` on every row; Maintainer endpoints return names and counts only; de-identification nulls notes too; consent events logged | Pass; DPDP legal check before public launch |

One risk is retained by choice: the eng review's D9 left the save-failure behavior unspecified
([reviews.md](reviews.md), R11), recorded in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-season-logger/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── reviews.md           # eng and design review history
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
│   ├── model/               # record and sync types; imports nothing from UI (eng review D1)
│   ├── store/               # the one storage module: Dexie schema, outbox, sync client, export
│   ├── catalog/             # snapshot loader, transliteration fold, uFuzzy search, upgrade remap
│   ├── reference/           # composer-dates.json, topics.json (project-kept)
│   ├── screens/             # Plan, Event (Concert and Lecdem), Item, Tidy, Wrapped, Settings,
│   │                        # SignIn, Consent, SchedulePicker, admin/Review
│   ├── wrapped/             # aggregations and Cards (Cards load in the second download)
│   └── sw.ts                # service worker: two-phase precache, prompt-to-update
├── tests/                   # Vitest
└── e2e/                     # Playwright, offline scenarios

supabase/                    # Supabase CLI project, built last (ADR 0001)
├── config.toml              # local stack; Google sign-in
├── migrations/              # tables, row-level security, sync functions
├── functions/               # Edge Functions, only if push and pull go there
└── tests/                   # sync, privacy and promotion tests against the local stack

tools/
├── import-2024-25/          # reference import through the app's matching (FR-039, FR-040)
├── golden-set/              # ~100 variant spellings for SC-010
├── reference-seed/          # shared lists, composer dates, topics, forms from last season's sheet
└── size-budget/             # fails the build above 2 MB first install or 3 MB second download
```

**Structure Decision**: the phone app (`app`, with record and sync types in `app/src/model/`)
and the Supabase project (`supabase`) in one repository (eng review D1). The phone app builds and runs alone, which keeps the design
doc's fallback: if the server is not ready by 1 December, the static app ships with export
only, and the outbox pushes after the first sign-in once the server is live.

**Build order**: the phone app, outbox and export come first; the outbox only queues until the
server exists. The server is built locally after Plan and Lecdem and before Cards and Tidy, so
sign-up is ready by 1 December, and deployed last (ADR 0001, eng review D12). The sync tests that need a server run against the
local Supabase once it exists.

## Remaining open items

1. Card renderer decision (can wait until the Cards tasks, before 20 December work starts).
2. Schedule feed shape agreed with the logger project.
3. Install the contingent skill `supabase/agent-skills@supabase` when the server work starts
   (T065). `vitest` was installed with the scaffold (T009).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Save-failure behavior unspecified, which bends II (Nothing Is Lost) and FR-003 | Maintainer's choice in the eng review (D9): no extra screen state now | "Keep the input, show 'Not saved', retry" was offered (D9 option A) and declined |

## Design decisions (plan-design-review, 2026-10-30)

Decisions approved one by one in the design review. They are the brief for DESIGN.md (T030)
and bind the screen tasks.

- **DD1 Navigation (D1, approved):** three bottom tabs: Season (home), Wrapped, Settings. Event and
  Item open as pushed screens with a back gesture. The tab bar hides while the Item editor is
  open. Tidy is reached from home; the Maintainer's `/admin` from Settings.
- **DD2 Home (D2, approved):** three sections, in order.
  - **Now:** an Event counts as Now from 60 minutes before its start until 4 hours after it. It shows as one large
    block (Sabha, first-billed Artist, start time) with one primary action, "Start logging", or "Continue: N
    Items" once started. With no such Event: "Log a Concert now", with a smaller "Lecdem".
  - **Next:** upcoming Planned Events, grouped by day.
  - **Season so far:** Attended Events, newest first, each with its Item count, and one line
    linking to the Wrapped.
- **DD3 Event screen (D3, approved; order revised by the information priorities):** in concert
  order.
  1. A one-line header: Sabha · date · start time, tapped to edit. The kind is set at creation.
  2. **Running order:** numbered rows, each showing the title, then Raga · Composer. A Laya
     vinyasam shows as a badge on the row it followed.
  3. **Stage:** one row per Appearance, in billing order: name and role. Colours are optional and can be added at
     any time; they never come before logging an Item (Information priorities, 2026-10-30).
  4. A fixed, full-width "Add Item" button at the bottom, at least 56px tall.
  5. The note, last.
- **DD4 Item editor (D4, approved):**
  - **One search box,** focused when the editor opens and docked just above the keyboard. Results
    grow upward, best match nearest the box. Each result shows the title, then Raga · Composer ·
    Tala. Results include Ragas, so typing "Begada" for an alapana starts an Item with only its
    Raga, and the Composition is added when recognised.
  - **Fixed rows, always last:** "Use what I typed" (Unresolved), "? Don't know", and the
    special forms RTP, Viruttam/Slokam and Medley.
  - **After a pick,** the Details appear as a grid of tappable values. The Laya vinyasam and the
    improvised Details stay folded underneath (FR-051).
  - **Saving:** each Detail saves when it is changed; there is no Save button. The bottom bar
    has "Done" and "Next Item →", which opens a fresh editor.
  - **Autofocus:** the editor's search box is the one exception to "no mobile autoFocus" (T110),
    recorded in DESIGN.md.
- **DD5 Wrapped (D5, approved):**
  - Headline numbers first, e.g. "39 Events · 241 Items · 112 Ragas".
  - The suggested Wrapped range as a quiet subtitle, tapped to change.
  - Then a vertical list of 9:16 live Card previews, drawn in the page, each with its own Share
    button.
  - The 1080×1920 PNG is rendered only when Share is tapped, which keeps SC-011 on the Redmi Note 5.
  - A check that each preview matches its shared image.
- **DD6 Status and sync messages (D6, deferred by the Maintainer):** the direction is agreed:
  logging screens show only a quiet indicator, and messages and details live elsewhere. The
  specifics are deferred to the frontend work (T030).

- **DD7 Start logging (approved after the review closed, 2026-10-30):** opening a planned Event
  only shows it. Editing it sets `touched` (FR-027) but leaves it Planned. An explicit "Start
  logging" marks it Attended and opens it for logging. FR-026, data-model.md, T055 and T056 say
  so.

### Information priorities (decided 2026-10-30)

What matters most, in plain terms, independent of how it is drawn.

**Inside one Item**
1. **First:** Raga and Composition.
2. **Second:** Composer, and Tala with its Nadai, as in "Adi (khanda nadai)". Nadai belongs to
   the Tala or to the Laya vinyasam; it is never a Detail on its own.
3. **Third:** Language and Subject.
4. **Tucked away until wanted:** the Laya vinyasam (with its own Nadai) and the improvised
   Details.

**During a concert**
1. **First:** the running order of Items.
2. **Second:** who is on stage.
3. **Third:** the concert's own facts (Sabha, date, time), already known from the plan.
4. **Last:** Colours. They can be added at any time, before, during or after, and never stand
   between the rasika and logging the next Item.
5. **Quiet unless something is wrong:** whether the concert is saved and backed up.

**Across the season**
1. **Top level:** the season log (planned and attended concerts), then the Wrapped.
2. **One step away:** tidying (unmatched values, Guesses, duplicates), settings and export, and
   sync details.
3. **Out of sight until needed:** the Maintainer's review and the schedule picker.

### Deferred design findings (for the frontend work, T030)

The Maintainer stopped the detailed questions after D6 ("the frontend we'll do later"). These
findings from the review and its outside voice are unresolved (all but item 1, settled as DD7) and form the rest of T030's brief:

1. *Resolved as DD7 above:* opening a planned Event used to mark it Attended.
2. **The visual code for the six Detail states,** including the clash between "?" for Unknown
   and "Vararaga (?)" for a Guess.
3. **A dark theme for logging screens in a dark hall:** near-black, warm off-white text, no white
   flashes.
4. **The end-of-concert moment:** "Done with this Concert" with a short summary and a link to the
   Wrapped.
5. **The first launch:** a welcome screen before sign-in, and the empty home.
6. **Save success feedback:** the new row highlighted briefly, no toast.
7. **Deleting:** a 5-second undo instead of a confirmation.
8. **Planned Events in the past that were never opened:** a "Did you go?" group on home.
9. **"Ready for offline":** two facts, logging versus share images.
10. **Restore in progress:** a banner until the season is back.
11. **The conflict screen:** the two versions side by side.
12. **The Card template:** Instagram safe zones, one headline sentence per Card, the app
    wordmark, how a white swatch shows, minimum data per Card, and the empty Wrapped.
13. **The Colour sheet:** a grid of labelled swatches, "?" and a second colour.
14. **Reordering Items** in an edit mode, and where Export lives.
15. **Tokens and rules for DESIGN.md:** type, palette, spacing, touch targets and thumb zone,
    accessible labels for the Detail states, motion, and copy for system messages.
16. **Smaller states:** cancelled versus "schedule changed", when the catalog-update prompt
    appears, consent toggles offline, Share in progress or failed.
17. **Save failure (D9):** kept as the Maintainer decided in the eng review; not reopened.
