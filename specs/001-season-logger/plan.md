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

The eng review's D9 left the save-failure behavior unspecified ([reviews.md](reviews.md), R11).
The Maintainer reopened it in the design review of 2026-11-01 (D15): a failed write shows a
persistent "Not saved on this phone" with Try again and Export, and the save highlight plays only
after a successful write (`DESIGN.md`, Components).

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
| *Resolved 2026-11-01 (design review D15):* save-failure behavior unspecified, which bent II (Nothing Is Lost) and FR-003 | Maintainer's choice in the eng review (D9), reopened in the design review | "Keep the input, show 'Not saved', retry" was offered (D9 option A) and declined |

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
17. **Save failure (D9):** reopened and settled in the design review of 2026-11-01 (D15); see
    `DESIGN.md`, Components.

### Design system (design consultation, 2026-10-31 to 2026-11-01)

Started with `/design-consultation` (T030). The result is [`DESIGN.md`](../../DESIGN.md). T030
stays open until `/plan-design-review` has run on it; the screen tasks T040 to T044 wait on that.

**The one thing to remember:** "My season, seen whole." Every later choice is checked against it.

**Agreed so far**

- **Base: shadcn preset `b51rn04Qt`** (ui.shadcn.com/create?preset=b51rn04Qt): style Rhea, Mist
  neutrals and theme, rose chart colour, Tabler icons, medium radius, subtle menu accent,
  inverted translucent menus, Source Sans 3 for body with headings inheriting it. Rose replaced
  emerald because black with green is Spotify's look, and the Wrapped should not read as a copy.
- **Warm text on the dark theme:** an off-white with a warm cast rather than Mist's cool grey
  (finding 3).
- **Two surfaces.** The logging screens are a tool used one-handed in a dark hall and should
  recede. The Wrapped cards are shared and should look like the rasika's own season.
- **Typography: Source Sans 3 everywhere, app and cards.** Catalog names use IAST and ISO 15919
  letters (ḍ ṭ ṇ ṣ ṛ ḷ ṃ ṁ ṅ ḥ). Of 16 Google Fonts tested for all 39 needed letters, only
  Source Sans 3 and Noto Sans have them all. Instrument Sans has 19 and Public Sans 30, so the
  first preset's fonts would have mixed fonts mid-word in names like Tōḍi. Noto Sans adds no
  letters Source Sans 3 lacks, so it is not used.
- **Tamil and Devanagari:** the catalog contains neither script. They reach a Card only through
  text a rasika types (Artist or Sabha names, a Lecdem title). Whether the cards bundle Noto Sans
  Tamil and Noto Sans Devanagari as a fallback depends on the card renderer (T088): Satori or
  Takumi need bundled fonts; Canvas 2D uses the phone's own. The app screens use the phone's fonts
  for these scripts.
- **How the Detail states look (finding 2, decided 2026-11-01).** Every state also has a spoken
  label for screen readers, so none relies on a mark alone.
  - **Matched** to the catalog: plain text.
  - **Guess**: the sheet's own habit, "Vararaga (?)", with the "(?)" slightly muted.
  - **Unknown**: a lone "?". It never collides with a Guess, which always has a name before
    its "(?)".
  - **Unresolved** (typed, not matched): shown as typed; the Item editor adds a muted "not
    matched" under it. Tidy lists them all.
  - **Override**: plain text like any value; the Item editor adds a muted "catalog: Todi" so the
    difference can be seen and undone.
  - **Not applicable**: left out of lists ("Viruttam · Kambhoji"); the Item editor shows a muted
    "Not applicable".
- **Names shown in plain English spelling (decided 2026-11-01):** "Todi", "Kaddanuvariki",
  "Tyagaraja", with no diacritics and none of karnatik's capital-letter coding ("tODi",
  "Tyaagaraaja"). The catalog export produces them (contracts/catalog-snapshot.md); composer
  names need a hand-kept list, because karnatik's spellings ("Muttuswaamee Dikshitar") do not
  convert mechanically. Source Sans 3 stays: it also covers the diacritics rasikas may type.
- **Dark by default** (confirmed 2026-11-01): logging happens in a dark hall. Light is available
  in Settings, and moving between screens never flashes white.
- **Screen behaviour (decided 2026-11-01)**, settling deferred findings 4, 6, 7, 13 and 14:
  - **Colour sheet:** a grid of labelled swatches plus "?", then an optional second colour for
    a two-tone outfit.
  - **Saving:** the new or changed row highlights briefly. No toast and no spinner.
  - **Deleting:** removes at once with a 5-second Undo, never an "Are you sure?" question.
  - **Reordering Items:** in a separate edit mode on the Event screen, never by dragging during
    the Concert. Export stays reachable from every screen that holds data (FR-019, T051) and
    from Settings; its exact place is settled in the preview.
  - **Finishing a Concert:** "Done with this Concert" shows a short summary of the Concert and
    what it changed in the season's Wrapped (for example a first Raga or a new Composer). It
    does not link into the Wrapped: the Wrapped belongs to the whole season, not one Concert.

- **Preview approved (2026-11-01):** the Event screen and the Item editor, drawn with the preset,
  warm text and plain English names.
- **Tokens (approved 2026-11-01):** body 17px on a scale of 13, 15, 17, 20, 24 and 32; a 4px
  spacing base; touch targets of 48px and 56px for a screen's main action; motion only to explain
  a change (100ms press, 150ms state, 220ms sheets, a 1.2s save highlight, a 5s Undo), with
  reduced motion respected. Restrained app colour: greys, near-white or near-black for actions,
  rose only in charts. The values are in `DESIGN.md`.

**Proposed, not yet confirmed**

- Cards coloured by the season itself: the 12 Colour swatches the Artists wore, not a brand
  palette. Needs contrast rules for seasons that are mostly white or clash. The Maintainer is
  happy with this direction for the white swatch and the Card template; the details are settled
  when the Cards are designed (T088 to T096).
- One authored motion moment: a new stripe weaving into the season fabric when a Concert is
  finished. Settled with the Cards.
- The 12 outfit swatch values, drafted in `DESIGN.md`.

**Settled by the plain-spelling decision:** whether to normalise ṁ to ṃ. Display names no
longer carry diacritics, so the question no longer arises.

Settled from the earlier list: warm text, the Detail states and the white swatch and Card
template direction (all above); shadcn and Tailwind recorded in
[ADR 0006](../../docs/adr/0006-shadcn-and-tailwind-for-the-screens.md).

**Reviewed 2026-11-01** with `/plan-design-review` (D3 to D29, in [reviews.md](reviews.md)); its
decisions are in `DESIGN.md`. What is left is listed under "Still open" there, each with the
phase that designs it. **Next:** the Maintainer edits the Messages table in `DESIGN.md`, then
T040 to T044 are built to it.
