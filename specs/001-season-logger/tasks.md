---

description: "Task list for the Season Logger and Live Wrapped"
---

# Tasks: Season Logger and Live Wrapped

**Input**: Design documents from `specs/001-season-logger/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md), and
ADRs 0001 to 0005 in `docs/adr/`.

**Tests**: test-first is not required (constitution IV). Tests are included only where the
constitution requires them, on the paths where a failure silently loses or corrupts the
season: offline capture, sync without duplicates, delete and reorder, restore, catalog
updates, export. The privacy and promotion checks from quickstart.md are included as well. They
are marked **(required)**.

**Organization**: one phase per user story. User Story 2 is split: part 1 (safe on the phone)
comes right after US1, and part 2 (server copy and restore) comes after Plan and Lecdem, ahead
of Cards and Tidy so sign-up is ready by 1 December. The server is built and tested locally and
deployed last, so it stays free until deploy (ADR 0001, eng review D12).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1 to US7)
- Paths follow plan.md: `app/` (the PWA, with record and sync types in `app/src/model/`), `supabase/` (server, local until deploy),
  `tools/`. Tasks marked **(logger repo)** run in `/opt/carnatic/logger`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: repository, tooling and the checks every change must pass (constitution,
quality gates).

- [ ] T001 Create the npm workspace root with the workspace `app`, a strict `tsconfig.base.json` (`"strict": true`), and a `.gitignore` covering `node_modules`, `dist`, `.env*` and `supabase/.env` in `package.json`, `tsconfig.base.json`, `.gitignore`
- [ ] T002 Scaffold the PWA with Vite, React 19 and TypeScript; add runtime dependencies `react@19`, `react-dom@19`, `wouter@3.13`, `dexie@4.4.x` (pin a version at or after 4.4.7), `dexie-react-hooks`, `@leeoniya/ufuzzy@1.0.x` in `app/package.json`, `app/vite.config.ts`, `app/index.html`, `app/src/main.tsx`
- [ ] T003 [P] Create the model folder for record and sync types with a barrel `app/src/model/index.ts`. Files in `app/src/model/` import nothing from screens, the store or UI libraries, because supabase tests and tools import them too (eng review D1)
- [ ] T004 [P] Configure ESLint (flat config) and Prettier for all workspaces in `eslint.config.js`, `.prettierrc`
- [ ] T005 [P] Configure Vitest as a root workspace covering `app` and `tools`, with `fake-indexeddb` loaded in the app's setup file, and add `tsx` as a dev dependency for TypeScript scripts in `tools/`, in `vitest.workspace.ts`, `app/vitest.config.ts`, `app/tests/setup.ts`
- [ ] T006 [P] Configure Playwright with a phone viewport (iPhone 13) and `vite preview` as the web server in `app/playwright.config.ts`
- [ ] T007 Write the size-budget check: brotli-compress every file in the first-phase precache list and fail above 2 MB, and every second-phase file and fail above a further 3 MB (constitution V, SC-009), in `tools/size-budget/check.mjs`
- [ ] T008 Add the root `check` script running typecheck, lint, Vitest, Playwright and `tools/size-budget/check.mjs` in that order, as quickstart.md describes, in `package.json`. Also run `tools/size-budget/check.mjs` at the end of the app's `build` script, so every build fails when a budget is exceeded (constitution V), in `app/package.json`
- [ ] T009 [P] Install the router's contingent skill `npx skills add antfu/skills@vitest -a claude-code -y --copy` after reading its SKILL.md, and record it in §2 of `docs/skills-router.md`
- [ ] T010 Spike Google sign-in on the primary iPhone with the app installed to the home screen: Google's sign-in button with `supabase.auth.signInWithIdToken`, against a free throwaway Supabase project and a temporary HTTPS address. Record whether sign-in completes inside the installed app in `specs/001-season-logger/research.md` before Phase 3. If it fails, T077 uses Supabase's email one-time code instead (eng review D3). If the email code is needed: Supabase's built-in email sender is rate-limited and may send only to project members, so open sign-up would need a custom SMTP provider, and FR-021 and FR-047 (which assume a Google account and Google's name) would need a spec amendment with a name-entry step; both are decided then (outside voice 4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the record types, the one storage module, the catalog and search, the offline
shell, and the design system. Every story builds on these.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Record types (shared)

- [ ] T011 [P] Define the record types from data-model.md in `app/src/model/records.ts`: Event (`kind`: `concert` \| `lecdem`; `status`: `planned` \| `attended` \| `missed`; `source`: `schedule` \| `plan` \| `spot`; `cancelled`, `scheduleEntryId`, `scheduleVersionSeen`, `scheduleChanged`, `touched`, `title`, `note`, `createdAt`, `updatedAt`, `deletedAt`), Appearance (`role`: `lead` \| `second_lead` \| `violin` \| `mridangam` \| `khanjira` \| `ghatam` \| `morsing` \| `other_accompaniment` \| `presenter`; `colourPrimary`: Colour \| `unknown` \| null; `colourSecondary`; `billed`; `position`), Item, Artist, Sabha (`name`, `aliases`, `mergedIntoId`), Link (`ownTable`: `artist` \| `sabha` \| `event`), SharedArtist, SharedSabha (`listVersion`), ScheduleEntry, and the Colour palette (white, red, blue, orange, yellow, brown, pink, beige, green, purple, black, grey)
- [ ] T012 [P] Define `FieldValue` and its validator in `app/src/model/field-value.ts`: `state` is `catalog` \| `override` \| `unknown` \| `na` \| `unresolved`; "`FieldValue.key` is required for `catalog` and `override` and must be null otherwise"; `text` is `"?"` for `unknown` and `""` for `na`; `guess` is "Allowed with `catalog`, `override` and `unresolved`"
- [ ] T013 [P] Add `newId()` returning `crypto.randomUUID()`, the one source of record and outbox ids, in `app/src/model/ids.ts` (eng review D2)
- [ ] T014 [P] Define the push and pull payload types from contracts/sync-api.md (ops with `opId`, `table`, `row` and `baseSeq`, where a delete is the full row with `deletedAt` set; an `appVersion` sent with every sync request (eng review D14); responses `acked` with each record's new `seq`, `rejected` with codes `foreign_rasika`, `missing_event`, `conflict`; pull `changes`, `cursor`, `more`) in `app/src/model/sync-payloads.ts`

### The storage module (ADR 0002, ADR 0003)

- [ ] T015 Create the Dexie database with the indexes in data-model.md ("events: id, status, date, sabhaId, scheduleEntryId"; "appearances: id, eventId, artistId"; "items: id, eventId, [eventId+position]"; "artists: id, name, mergedIntoId"; "sabhas: id, name, mergedIntoId"; "links: id, [ownTable+ownId]"; "sharedArtists: id, name"; "sharedSabhas: id, name"; "schedule: id, date"; "outbox: ++seq, opId, recordId"; "meta: key") in `app/src/store/db.ts`
- [ ] T016 Implement the only write path in `app/src/store/mutate.ts`: `save(table, row)` and `remove(table, id)`. Each runs one Dexie read-write transaction that writes the record (a delete sets `deletedAt`, a tombstone) and an outbox entry (`opId` from `newId()`, `table`, `recordId`, `op`, `row`, `queuedAt`), then returns. Never `await fetch` inside a transaction, and never touch the network (constitution I). If the record already has an outbox entry that has never been sent, the save replaces that entry's row and keeps its place in the queue; an entry sent at least once, even if the reply was lost, is never changed, so the save adds a new entry (eng review D8). The sync loop claims a batch by setting `firstSentAt` in the same transaction that reads it and pushes exactly those rows, so a save after the claim adds a new entry (outside voice 1). Save transactions use Dexie's strict durability (`chromeTransactionDurability: 'strict'`), so a write is on disk before the save returns (FR-003, outside voice 12). `remove()` saves the full row with `deletedAt` set: a delete is an upsert (outside voice 8)
- [ ] T017 Implement live-query hooks in `app/src/store/queries.ts` that hide tombstoned rows, follow `mergedIntoId` to the surviving Artist or Sabha, and resolve own Artists, Sabhas and Events through their Link (ADR 0005)
- [ ] T018 [P] Request `navigator.storage.persist()` on first run and store the result and a quota estimate in `meta` (FR-023), in `app/src/store/persist.ts`
- [ ] T019 [P] **(required)** Offline-capture test in `app/tests/store/offline-capture.test.ts`: a save writes the record and its outbox entry together; a failed transaction writes neither; the data survives closing and reopening the database (a stand-in for a force-close); ten saves to one record leave one outbox entry; a save after a push whose reply was lost adds a second entry, and both reach the server (eng review D8); a save that lands between a batch claim and its acknowledgement still reaches the server (outside voice 1)

### Catalog snapshot and search (ADR 0004)

- [ ] T020 **(logger repo)** Rebuild the logger's canonical tables locally from `pipeline/karnatik/extracted/`: `docker compose -f pipeline/karnatik/db/docker-compose.yml up -d`, then `bun run load.ts` and `bun run resolve.ts` with `DATABASE_URL=postgres://carnatik:carnatik@localhost:5434/carnatik`, and confirm 30,539 songs in `/opt/carnatic/logger/pipeline/karnatik/`
- [ ] T021 **(logger repo)** Write the snapshot exporter producing format 1 of contracts/catalog-snapshot.md in `/opt/carnatic/logger/pipeline/karnatik/export-snapshot.ts`. It must: dictionary-encode strings; key only by natural keys (`kriti_id`, canonical raga name, composer `name_key`, tala, language, subject and form names); take `groupKey` from `raga-groups.json` and aliases from the normalize and alias maps; emit a cumulative `remap` against the previous snapshot; and name the file `catalog.<sha256>.json`
- [ ] T022 [P] Create two handmade test snapshots of about 20 songs each in `app/tests/fixtures/catalog-v1.json` and `app/tests/fixtures/catalog-v2.json`. v2 must merge one raga key, retire one song, and link Pantuvarali with Kamavardhini, which are separate in v1
- [ ] T023 Implement the snapshot loader in `app/src/catalog/load.ts`: read the precached `catalog.<hash>.json`, check its SHA-256 against the name, refuse a mismatched file and keep the previous version, and decode the column arrays into in-memory tables with lookup maps by key (`-1` means no value)
- [ ] T024 [P] Implement the transliteration fold from §5 of docs/skills-router.md in `app/src/catalog/fold.ts`: NFD plus stripping combining marks, `aa→a`, `ee|ii→i`, `oo|uu→u`, `th→t`, `dh→d`, `bh→b`, `kh→k`, `gh→g`, `sh|ṣ|ś→s`, `zh→l`, `w→v`, collapsing doubled letters. Apply it to both index and query
- [ ] T025 Implement catalog search with uFuzzy over the folded title, first line, raga names and aliases, composer names and aliases, and talas in `app/src/catalog/search.ts`. Gate or cap ranking for single-character queries (research.md)
- [ ] T026 Implement text-to-catalog matching (exact folded name or Alias → key, else Unresolved with the text kept), shared by the editor and the reference import, in `app/src/catalog/match.ts`
- [ ] T027 [P] Build the golden set of about 100 variant spellings from last season's sheet plus hand-added cases, with a test asserting at least 95% return the intended entry in the top 3 (SC-010), in `tools/golden-set/golden.json` and `tools/golden-set/golden.test.ts`. The Maintainer reviews the set

### Shell, reference data and design

- [ ] T028 Configure vite-plugin-pwa with `injectManifest` in `app/vite.config.ts` and `app/src/sw.ts`:
  - phase-1 precache of the shell, catalog snapshot and reference JSON;
  - navigation fallback;
  - prompt-to-update with no silent `skipWaiting`;
  - a phase-2 cache (card renderer, fonts, xlsx writer) fetched right after install;
  - `meta.readyForOffline` set only when both phases are cached for the current catalog version (Edge Cases, "Partly downloaded app")
- [ ] T029 Write the reference seeding script in `tools/reference-seed/seed.py`, reading `docs/reference/wrapped-2024-25.xlsx` and run with `uv run --with openpyxl python -I`. It outputs:
  - `app/src/reference/shared-lists.seed.json`: the 11 Sabhas and the Artists in the sheet (FR-005);
  - `app/src/reference/composer-dates.json`: the 56 Composers from the Timelines sheet, keyed by composer `name_key` from the snapshot, with `born`, `died` and `approx`;
  - `app/src/reference/topics.json`: Subject → Topic from the Topic column;
  - `app/src/reference/forms.json`: the project-kept non-composition forms (RTP, viruttam, slokam, medley) that `form` uses when an Item has no Composition (data-model.md, Item).

  Names that don't match a catalog key are listed for the Maintainer, not guessed
- [ ] T030 Produce `DESIGN.md` with `/design-consultation` (pipeline step 6 in docs/skills-router.md), including the 12-colour swatch palette and phone-width layouts for Plan, Event, Item, Wrapped and Settings
- [ ] T031 Apply the mobile-native base rules in `app/src/styles/base.css`: 16px inputs, `dvh`, safe-area insets, no tap highlight, no sticky hover, and `touch-action` on controls
- [ ] T032 Set up wouter routes for Plan (home), Event, Item, Tidy, Wrapped, Settings and `/admin`, opening to the home screen with no network wait, in `app/src/App.tsx` and `app/src/main.tsx`
- [ ] T033 At the end of Phase 2, on the primary phone with the app installed, measure cold start to the home screen in airplane mode and search p95 over the full catalog, and record both in `specs/001-season-logger/research.md`. If either misses its budget (1.5 s, 50 ms), decide the fix then from the numbers; T113 still re-measures before release (eng review D10)

**Checkpoint**: foundation ready. Saves are atomic and offline, the catalog loads and searches,
and the shell installs.

---

## Phase 3: User Story 1 - Log a Concert in the hall with no signal (Priority: P1) 🎯 MVP

**Goal**: create a Concert, add Appearances with Colours and Items in running order, pick
Compositions, and change any field in a tap, all offline, losing nothing on a force-close.

**Independent Test**: on the phone in airplane mode, log a full Concert (5 Appearances with
Colours, 8 Items, one Tani avartanam, notes), force-close, reopen, and find every detail intact.

### Required tests for User Story 1

- [ ] T034 [P] [US1] **(required)** End-to-end offline capture test (SC-001) in `app/e2e/offline-concert.spec.ts`: with `context.setOffline(true)`, log 5 Appearances with Colours, 8 Items, one Tani avartanam and notes; close the browser context; reopen; assert every field
- [ ] T035 [P] [US1] **(required)** Delete-and-reorder local test in `app/tests/store/reorder-delete.test.ts`: reordering renumbers the affected Items in one transaction with an outbox op each; deleting writes a tombstone and an op; "`position` is unique among an Event's live Items after each transaction"; both survive a reopen

### Implementation for User Story 1

- [ ] T036 [P] [US1] Implement Event actions in `app/src/store/events.ts`:
  - create an Event: date defaults to today; a `spot` Event starts `attended`;
  - edit an Event: sets `touched` to true;
  - state transitions as in data-model.md: "`planned → attended` (logging it), `planned → missed` (rasika says so), `missed → planned` and `attended → planned` (undo)";
  - validation: "A Lecdem needs a `title`. A Concert's `title` is null"
- [ ] T037 [P] [US1] Implement Artist, Sabha and Appearance actions in `app/src/store/people.ts`. Find own and shared entries by folded name and Alias as the rasika types; a new name creates an own Artist or Sabha (FR-005). Add Appearances with a role and Colours (FR-004), so a previously logged Artist gets a new Appearance for the same person (US1 scenario 6). Each own Artist and Sabha stores its folded name as `nameKey`, using `app/src/catalog/fold.ts` (outside voice 9)
- [ ] T038 [US1] Implement Item actions in `app/src/store/items.ts`, using `app/src/store/mutate.ts`:
  - **add**: at the end of the running order;
  - **reorder**: renumber in one transaction;
  - **delete**: a tombstone;
  - **pick a Composition**: fills `form`, `ragas`, `tala`, `composer`, `language` and `subject` as `catalog` FieldValues from the snapshot;
  - **edit a field**: becomes `override` when the Item has a Composition and the value differs, with no confirmation (FR-007);
  - **other values**: set Unknown, Not applicable, Guess or Unresolved, kept exactly as entered (FR-008);
  - **several Ragas**: in order (FR-009);
  - **no Composition**: an Item can have `compositionKey` null (FR-010)
- [ ] T039 [US1] Add the RTP and Tani avartanam rules in `app/src/store/items.ts`:
  - an RTP has no Composition, one or more Ragas, a tala and Nadai, a language and subject, and an optional `pallaviAuthor`;
  - `composer` is `na` unless `pallaviAuthor` is filled (FR-041);
  - `tani` is `{ nadai, note }` on the Item it followed (FR-011)
- [ ] T040 [P] [US1] Build the field input in `app/src/screens/components/FieldInput.tsx`: shows the value, its state and a not-sure mark; one or two taps to change it, mark "?", mark Not applicable, toggle not sure, or type freely; offers catalog search as the rasika types
- [ ] T041 [P] [US1] Build the Artist and Sabha pickers in `app/src/screens/components/ArtistPicker.tsx` and `app/src/screens/components/SabhaPicker.tsx`
- [ ] T042 [P] [US1] Build the Colour picker in `app/src/screens/components/ColourPicker.tsx`: the 12 swatches plus "?", and an optional second colour
- [ ] T043 [US1] Build the Event screen in `app/src/screens/EventScreen.tsx`: date, start time, Sabha, kind, note, the Appearances list with Role and Colours, and the running order with move up, move down and delete
- [ ] T044 [US1] Build the Item editor in `app/src/screens/ItemEditor.tsx`: Composition search, every field through FieldInput, the ragamalika raga list, tala with Nadai, the RTP pallavi author, and the Tani avartanam section with its Nadai and note
- [ ] T045 [US1] Write the 2024-25 reference import in `tools/import-2024-25/import.ts`, reading the sheet with `read-excel-file` (dev dependency) and run with `tsx`. It matches every Item through `app/src/catalog/match.ts` (FR-039) and reports, out of 193, how many matched a Composition, were "?", were special forms with no Composition, or stayed Unresolved (SC-005). It writes `app/tests/fixtures/reference-2024-25.json` as a test fixture only, never into a rasika's log, lists or Wrapped (FR-040)
- [ ] T046 [US1] Implement the catalog upgrade in `app/src/catalog/upgrade.ts`, run on the launch where the rasika accepts a new version (FR-038). In one transaction it:
  - rewrites merged keys on every Item `FieldValue` and `compositionKey`;
  - turns retired keys into `unresolved` with `text` kept;
  - leaves `state` alone;
  - queues each changed Item in the outbox;
  - separately, outside that transaction: the same remap is applied to every pulled row before it is stored, so rows restored under older keys keep their meaning (outside voice 6)
- [ ] T047 [US1] **(required)** Catalog-update test using the v1 and v2 fixtures in `app/tests/catalog/upgrade.test.ts`: a merged key is rewritten; an Override keeps its state; a retired key becomes Unresolved with its text kept; a row pulled with a v1 key after v2 is installed is remapped (outside voice 6)
- [ ] T048 [P] [US1] Search latency test in `app/e2e/search-perf.spec.ts`: 4× CPU throttle via CDP, p95 from keystroke to results under 50 ms over the full snapshot (SC-007)

**Checkpoint**: a full Concert logs offline and survives a force-close. The reference import
reports its four rates. This is the MVP.

---

## Phase 4: User Story 2, part 1 - Safe on the phone (Priority: P2)

**Goal**: the rasika always sees what is not yet on the server, and can export the whole
season at any time, offline. This is the design doc's fallback if the server is late.

**Independent Test**: log three Events offline, see the unsynced count rise, export, and
find every record in the file.

- [ ] T049 [P] [US2] **(required)** Export test in `app/tests/store/export.test.ts`: an export taken offline, with unsynced ops, "contains every live and tombstoned record in the store" and `unsyncedOps`
- [ ] T050 [US2] Implement the JSON export in format 1 of contracts/season-export.md in `app/src/store/export.ts`: `format`, `exportedAt`, `appVersion`, `catalogVersion`, `unsyncedOps`, `events`, `appearances`, `items`, `artists`, `sabhas`, `links`, tombstones included, no account details
- [ ] T051 [US2] Add an Export action reachable from every screen that holds data, offering the file through `navigator.share({ files })` with a download fallback (FR-019), in `app/src/screens/components/ExportAction.tsx`
- [ ] T052 [P] [US2] Show the unsynced count (outbox length, FR-016) and the "ready for offline" state on every screen in `app/src/screens/components/SyncStatus.tsx`
- [ ] T053 [P] [US2] Build the Settings screen with storage-persisted state, Export, and the app and catalog versions in `app/src/screens/SettingsScreen.tsx`
- [ ] T054 [US2] The Maintainer decides where the PWA's static files are hosted, needed before the phone-only fallback can ship (ADR 0001 covers sign-in and the database, not the static site; research.md notes free static hosting on Cloudflare Workers Static Assets). Record it in `docs/adr/0006-static-hosting.md`

**Checkpoint**: logging plus export can ship alone if the server is late.

---

## Phase 5: User Story 3 - Arrive with the Concert already filled in (Priority: P3)

**Goal**: enter Plan entries ahead of time, or pick them from the Schedule, and log a planned
Event without typing date, Sabha or billed Artists.

**Independent Test**: enter 10 Plan entries. In airplane mode on one of those dates, open a
planned Concert and log it without typing date, Sabha or any billed Artist.

- [ ] T055 [P] [US3] Implement Plan actions in `app/src/store/plan.ts`:
  - **create a Plan entry** with date, start time, Sabha, kind, billed Artists in Roles and a Lecdem title (FR-024). It is saved as an Event with `status` `planned` and `source` `plan`, and Appearances with `billed` true;
  - **open for logging**: sets `attended` and `touched`;
  - **mark Missed**: Missed Events no longer show as upcoming (FR-026)
- [ ] T056 [US3] Build the Plan (home) screen in `app/src/screens/PlanScreen.tsx`: upcoming Planned Events by date and time, today first; add a Plan entry; mark Missed; open a planned Event straight into the Event screen with everything filled in (SC-004)
- [ ] T057 [US3] Get the logger project's agreement on contracts/schedule-feed.md, which is "proposed": who assigns `id`s, whether Lecdems are included, and where the file is published. Update the contract's status in `specs/001-season-logger/contracts/schedule-feed.md`
- [ ] T058 [US3] Implement applying a Schedule version in `app/src/store/schedule.ts`:
  - `touched` false: "copy the new date, time, Sabha and billed Artists; set `cancelled`";
  - `touched` true: "change nothing; set `scheduleChanged` so the hint shows";
  - "Either way, record `scheduleVersionSeen`" (FR-027);
  - match Sabha and billed names to shared or own entries by name or Alias
- [ ] T059 [P] [US3] **(required: an overwrite would corrupt the season)** Schedule protection test in `app/tests/store/schedule-apply.test.ts`: an edited or Attended Event is never changed and gets the hint; an untouched Planned Event updates; a cancellation marks only untouched Events
- [ ] T060 [US3] Fetch the Schedule when online with `ETag`, storing entries locally, from a configurable URL (a static file until the server serves `GET /v1/schedule/{season}`), in `app/src/store/schedule-fetch.ts`
- [ ] T061 [US3] Build the Schedule picker that adds entries to the Plan with `source` `schedule`, and show "schedule changed" and "cancelled" on Plan entries, in `app/src/screens/SchedulePicker.tsx` and `app/src/screens/PlanScreen.tsx`

**Checkpoint**: P3 works from hand-entered Plan entries alone (FR-025); the Schedule adds to it
when the feed exists.

---

## Phase 6: User Story 4 - Log a Lecdem (Priority: P4)

**Goal**: record a Lecdem with a title, up to 3 presenters and a Sabha, with optional Colours,
Items and notes.

**Independent Test**: log a Lecdem offline with 2 presenters, one of whom performed at an
earlier Concert, and confirm both Appearances belong to the same Artist.

- [ ] T062 [US4] Enforce the Lecdem rules in `app/src/store/events.ts` and `app/src/store/people.ts`: a `title` is required, and "A Lecdem has at most 3 Appearances with role `presenter`" (FR-013)
- [ ] T063 [US4] Add the Lecdem mode to the Event screen in `app/src/screens/EventScreen.tsx`: title, up to 3 presenters through ArtistPicker, optional Colours, optional Items, note

**Checkpoint**: Concerts and Lecdems both log offline.

---

## Phase 7: User Story 2, part 2 - Server copy and restore (Priority: P2; built locally after the phone stories, deployed last, eng review D12)

**Goal**: sign in with Google, push the outbox without duplicates, pull by cursor, restore an
emptied phone, and keep each rasika's season private. Development runs on a local Supabase,
at no cost.

**Independent Test**: log three Events offline. Reconnect with the app open and confirm all
three reach the server with no duplicates. Clear the app's storage, reopen, sign in, and
confirm the full season is back before logging resumes.

### Setup for the server

- [ ] T064 [US2] Install the Supabase CLI, run `supabase init`, and configure Google sign-in for the local stack, with secrets in `supabase/.env` only (never committed), in `supabase/config.toml`
- [ ] T065 [P] [US2] Install the router's contingent skill `npx skills add supabase/agent-skills@supabase -a claude-code -y --copy` after reading its SKILL.md, and record it in §2 of `docs/skills-router.md`
- [ ] T066 [US2] The Maintainer decides whether push and pull run as Postgres functions or as Edge Functions (ADR 0001, "Still open"). The decision includes how errors map to the contract's responses (401, `409 not_writer`, `rejected` codes), since Postgres functions return them through Supabase's API, not as hand-written HTTP. Record it in `docs/adr/0001-supabase-for-sign-in-and-server-store.md`

### Required tests for the server

- [ ] T067 [P] [US2] **(required)** Sync tests against the local stack in `supabase/tests/sync.test.ts`:
  - the same push sent twice stores each op once (FR-015);
  - an offline delete and a reorder come back identical on pull;
  - a pull from an empty cursor returns the full season;
  - a non-writer device gets `409 not_writer`
- [ ] T068 [P] [US2] **(required, privacy)** Row-level security tests in `supabase/tests/privacy.test.ts`: rasika A cannot read or write rasika B's rows through any table or function, and a pushed row for another rasika is rejected `foreign_rasika` (SC-015); also, as an ordinary rasika, the private-schema views are unreachable and every Maintainer function refuses the call; and an anonymous caller can execute no function (eng review D5, outside voice 10)
- [ ] T069 [P] [US2] **(required)** Sync client tests in `app/tests/store/sync-client.test.ts`: a 401 and a network error both leave the outbox and local data intact; a 409 stops pushing and keeps the outbox; rejected ops are kept locally and listed as needing attention; a row edited while a pull is in flight keeps the edit, and the edit reaches the server (eng review D4); after a 409, re-claiming pushes every queued op and the server ends with all of them (eng review D6); an iPad edits Event E as writer, the phone re-claims with an older E queued: the phone's op is rejected `conflict`, the iPad's edit stays, and "keep mine" then pushes the phone's version (eng review D11); a `426 update_required` stops syncing and leaves the outbox and local data intact (eng review D14)

### Implementation for the server

Use the `supabase-postgres-best-practices` skill for every migration.

- [ ] T070 [US2] Write the accounts migration in `supabase/migrations/0001_accounts.sql`:
  - `rasika`: `id`, `auth_user_id`, `email`, `name`, `share_additions` and `season_reports` ("Null until answered; nothing pre-selected"), `writer_device_id`, `created_at`, `deidentified_at`;
  - append-only `consent_event`;
  - `device`;
  - `processed_op` with a primary key on (`rasika_id`, `op_id`);
  - a trigger creating the Rasika row on the first Supabase Auth sign-in;
  - row-level security on every table
- [ ] T071 [US2] Write the season migration in `supabase/migrations/0002_season.sql`: tables for events, appearances, items, artists and sabhas, each with `id`, `rasika_id`, `seq` (bigint from one shared sequence), `deleted_at`, `received_at`, the parent id where there is one (`event_id` for appearances and items), and a `data` jsonb column holding the record exactly as the phone sent it; the record's fields are defined only in `app/src/model/records.ts` (eng review D7); indexes on (`rasika_id`, `seq`); row-level security limited to `(select auth.uid())`'s own rows
- [ ] T072 [US2] Write the shared migration in `supabase/migrations/0003_shared.sql`: `shared_artist` and `shared_sabha` with `list_version`, `link`, and a `maintainer` allowlist table; plus `supabase/seed.sql` loading `app/src/reference/shared-lists.seed.json`
- [ ] T073 [US2] Implement push in the place chosen in T066, in `supabase/migrations/0004_sync.sql` or `supabase/functions/sync/`. Per contracts/sync-api.md:
  - at most 200 ops, applied in order in one transaction under a per-rasika advisory lock;
  - writer check returning `409 not_writer`;
  - a repeated `opId` is acknowledged without reapplying;
  - each op is an upsert that replaces the row and stamps a new `seq`; a delete is the full row with `deletedAt` set (outside voice 8);
  - invalid ops are recorded as processed and returned in `rejected` with a specific code;
  - push is one generic upsert shared by all five tables, writing the record into `data` (eng review D7);
  - push rejects an upsert whose `id` already belongs to another rasika (`foreign_rasika`);
  - push, pull and the account functions revoke EXECUTE from PUBLIC and anon and grant it only to signed-in users (outside voice 10);
  - each op's `baseSeq` must equal the record's current `seq` (0 for a new record), else the op is rejected `conflict`; each ack returns the record's new `seq` (eng review D11);
  - a request whose app version is below the server's minimum gets `426 update_required` (eng review D14)
- [ ] T074 [US2] Implement pull alongside push. The two-part cursor holds the rasika's own rows and Links by `seq`, and the shared lists by `list_version`. Pages are capped at `limit=500` with `more`; an empty cursor returns everything. Pull is one generic select shared by all five tables, returning `data` with `deleted_at` (eng review D7)
- [ ] T075 [US2] Implement the account operations: `GET /v1/me` (including `deletionContact`), `PUT /v1/me/consent` (each change appends a `consent_event`), and `POST /v1/devices/claim` (makes this device the writer, FR-022), in the same place as push
- [ ] T076 [US2] Implement de-identification for a deletion request in `supabase/migrations/0005_deletion.sql`, following data-model.md "Deletion". In one transaction, holding the rasika's advisory lock (eng review R7):
  - delete the Supabase Auth user;
  - null `authUserId`, `email` and `name`, set `deidentifiedAt`, delete devices;
  - null every `note`, including each Item's `tani.note` (outside voice 9);
  - if `seasonReports` is not true, delete the season (FR-047);
  - keep the `consent_event` rows, which point only at the opaque rasika id, for at least one year (DPDP Rules; data-model.md, "Consent event")
- [ ] T077 [US2] Implement sign-in on the phone in `app/src/store/auth.ts`:
  - the method proven by the Phase 1 iPhone spike (eng review D3): Google's sign-in button with `supabase.auth.signInWithIdToken`, or, if that failed, Supabase's email one-time code;
  - the app keeps its own cached identity in `meta`;
  - a token is requested only when syncing; logging never checks the session (ADR 0001);
  - a 401 or an ended session shows a non-blocking "sign in again" prompt;
  - no inactivity timeout and no "single session per user";
  - supabase-js is created with `autoRefreshToken: false`; the sync loop refreshes the session itself just before it syncs (ADR 0001, outside voice 5)
- [ ] T078 [US2] Implement the sync loop in `app/src/store/sync.ts`:
  - single-flight, triggered on start, `online`, `visibilitychange` to visible, and after each save (FR-014);
  - push FIFO batches of up to 200 with exponential backoff and jitter on 5xx or network errors;
  - send each op with `baseSeq`, the last server `seq` known for its record, updated from every ack so the phone never conflicts with its own writes; list `conflict` rejections in "needs attention" with "keep mine" (re-push with the new `baseSeq`) and "keep the server's" (drop the op and pull) (eng review D11);
  - send the app version with every request; on `426 update_required`, stop syncing, keep logging and the outbox, and show a non-blocking "Update the app to keep syncing" prompt (eng review D14);
  - handle 401, 409 and `rejected` as in the contract; a rejected op leaves the outbox, but its record stays in the unsynced count and in "needs attention" until the rasika fixes or discards it (constitution II, outside voice 7);
  - pull until `more` is false, applying each page in one transaction, then storing the cursor;
  - skip any pulled row whose record still has a pending outbox op, so the local row wins until its op is acknowledged (eng review D4)
- [ ] T079 [US2] Implement restore in `app/src/store/restore.ts`. On an empty store after sign-in: claim the device, push any local outbox, then pull from an empty cursor before the logging screen shows the season (FR-017). With no signal, logging works on the empty phone and restore runs when signal returns (FR-018). If the pull has not finished within 10 seconds, the logging screen opens anyway and restore continues in the background (constitution I, outside voice 13)
- [ ] T080 [US2] **(required)** End-to-end restore test against the local stack in `app/e2e/restore.spec.ts`, using a password test user enabled only in the local config:
  - sync a season;
  - clear storage;
  - offline, log one Item;
  - go online and sign in;
  - assert the new Item is kept and the full season returns, Unresolved values included (SC-003)
- [ ] T081 [US2] Build sign-up and consent in `app/src/screens/SignInScreen.tsx` and `app/src/screens/ConsentScreen.tsx`. Ask two separate explicit yes/no questions with nothing pre-selected: sharing hand-created entries with the Maintainer (FR-042), and inclusion in season reports with a one-line reason (FR-049). Sign-up is required once, at first launch, before logging (FR-050). After that, logging never waits on sign-in: an ended session shows only a non-blocking prompt, and an emptied phone with no signal still logs and asks for sign-in when signal returns (FR-018). If the phone-only fallback ships before the server, first launch skips sign-in and the outbox waits until the server is live
- [ ] T082 [US2] Extend Settings in `app/src/screens/SettingsScreen.tsx` (how consent toggles behave offline is settled in the design, T030; outside voice 16):
  - both consents, changeable at any time, with turning one off taking effect from then on;
  - "Sign out other devices" (Supabase `others` scope, FR-021);
  - the deletion contact (FR-046);
  - sign-in state
- [ ] T083 [US2] Show the "not the writer" state when a push returns 409: stop pushing, keep the unsynced changes, and offer Export and "Make this the writing device again", which calls `POST /v1/devices/claim` and then pushes the queued ops, last write wins per record (FR-022, Edge Cases "Second device", eng review D6), in `app/src/screens/components/SyncStatus.tsx`

**Checkpoint**: the season survives a wiped phone. Sign-up, consent and privacy are in place.

---

## Phase 8: User Story 7 - Promote what rasikas had to type (Priority: P7)

**Goal**: the Maintainer sees hand-created Artists, Sabhas and Events from consenting rasikas
and promotes them. Each rasika's own entry then links to the shared one.

**Independent Test**: two consenting rasikas each create an Artist "Anirudh Athreya"; the
Maintainer promotes it. Both rasikas' Appearances now point to the shared Artist with their
text kept, and a third rasika is offered him from the start.

- [ ] T084 [US7] Write the promotion migration in `supabase/migrations/0006_promotion.sql`:
  - **candidates view**: own Artists, Sabhas and hand-typed Events from rasikas whose `share_additions` is true, grouped by folded name, "only as the entry itself with a count of rasikas, never with the rasika's identity or other log details" (FR-042);
  - **create shared entry**: adds a shared Artist or Sabha and bumps `list_version` under the shared-lists lock;
  - **promote**: writes a Link for each matching own record of consenting rasikas (FR-044), taking each affected rasika's advisory lock so the Link commits in `seq` order for that rasika (contracts/sync-api.md "Pull"; eng review R7). For an Event, `sharedId` is the id of the Schedule entry the Maintainer added in the logger project (FR-043); this project never writes to the Schedule;
  - all three are callable only by the `maintainer` allowlist, with EXECUTE revoked from PUBLIC and anon (outside voice 10);
  - Artists and Sabhas are grouped by the folded `nameKey` the phone stores in each own record, so SQL never re-implements the fold (outside voice 9); how hand-typed Events are grouped is not yet defined and is settled with the schedule feed (T057);
  - the candidates view lives in a private schema that Supabase's API doesn't expose, with no grant for anonymous users or rasikas; the Maintainer reads it only through these functions, which check the allowlist first (eng review D5)
- [ ] T085 [P] [US7] **(required, privacy)** Promotion tests in `supabase/tests/promotion.test.ts`: two consenting rasikas' entries appear with count 2; a non-consenting rasika's never appear; after promotion both pulls include Links; a new rasika's pull includes the shared Artist (SC-016)
- [ ] T086 [US7] Check, and fix where needed, that pulled Links make Appearances follow the shared Artist without rewriting them, and that an Event Link sets `scheduleEntryId` without overwriting a `touched` Event (FR-044), in `app/src/store/queries.ts` and `app/src/store/sync.ts`
- [ ] T087 [US7] Build the Maintainer review screen at `/admin`, visible only to the allowlisted user, in `app/src/screens/admin/ReviewScreen.tsx`: candidates with rasika counts, create a shared entry, promote

**Checkpoint**: promotion is ready by 15 December (eng review D13). Cards and Tidy follow.

---

## Phase 9: User Story 5 - Watch the Wrapped grow and share Cards (Priority: P5)

**Goal**: the Wrapped is computed on the phone from Attended Events in a Wrapped range, and
any Card shares as an Instagram-story image, offline. Colours, top Ragas and the Composer
timeline are due by 20 December.

**Independent Test**: from the reference fixture, reproduce last season's colours chart and
composer timeline as Cards offline and share one. The reference data never shows in the
rasika's own Wrapped.

- [ ] T088 [US5] The Maintainer decides the card renderer (Satori + resvg-wasm, Takumi, or Canvas 2D; research.md, "Share-card rendering"). Record the decision in `specs/001-season-logger/research.md`, with an ADR in `docs/adr/` if it carries lock-in. This blocks T093
- [ ] T089 [P] [US5] Suggest a Wrapped range covering the rasika's Attended Events, adjustable at both ends (FR-029), in `app/src/wrapped/range.ts`
- [ ] T090 [US5] Implement the aggregations in `app/src/wrapped/aggregate.ts`:
  - count only Attended Events within the range;
  - Linked ragas count together through the current snapshot's `groupKey`, each name kept;
  - Unknown counts as "?"; Not applicable counts nowhere; Guesses and Overrides count as their values; Unresolved counts under its text (FR-030);
  - each Raga of a ragamalika counts once for that Item;
  - merged Artists and Links are resolved;
  - a filled pallavi author counts as a Composer
- [ ] T091 [US5] **(required, catalog updates)** Aggregation test in `app/tests/wrapped/aggregate.test.ts`: with Items logged under v1, loading v2 (Pantuvarali linked to Kamavardhini) changes the top-ragas result; plus "?" buckets, Not applicable, Guess and Override counting; plus a merged Artist and an own Artist linked to a shared one each counting as one person (FR-036, FR-044; eng review test gap)
- [ ] T092 [P] [US5] Reference reproduction test in `app/tests/wrapped/reference-cards.test.ts`: from `app/tests/fixtures/reference-2024-25.json`, colour counts match the sheet (white 23, red 15, blue 15), and the composer timeline matches the Timelines sheet (SC-012)
- [ ] T093 [US5] Implement rendering a Card to a 1080×1920 PNG offline with the chosen renderer, bundling the Tamil and Devanagari Noto fonts in the phase-2 cache within the 3 MB budget, in `app/src/wrapped/render.ts`
- [ ] T094 [P] [US5] Build the Colours Card, counting both colours of a two-tone outfit, in `app/src/wrapped/cards/ColoursCard.tsx`
- [ ] T095 [P] [US5] Build the top-Ragas Card, with Linked ragas counted together, own name prominent and sibling small, in `app/src/wrapped/cards/TopRagasCard.tsx`
- [ ] T096 [P] [US5] Build the Composer timeline Card from `app/src/reference/composer-dates.json`, with an "undated" band for Composers without dates (FR-033), in `app/src/wrapped/cards/ComposerTimelineCard.tsx`
- [ ] T097 [US5] Share a Card through `navigator.share({ files })`, offline included, with a download fallback (FR-032), in `app/src/wrapped/share.ts`
- [ ] T098 [US5] Build the Wrapped screen in `app/src/screens/WrappedScreen.tsx`: the range picker and Cards, updating within 1 second of a save (SC-011)
- [ ] T099 [P] [US5] (stretch, in this order per FR-031) Build the season fabric cover Card in `app/src/wrapped/cards/FabricCoverCard.tsx`
- [ ] T100 [P] [US5] (stretch) Build the Topics Card, rolling Subjects up through `app/src/reference/topics.json` and showing unmapped Subjects under their own name (FR-034), in `app/src/wrapped/cards/TopicsCard.tsx`
- [ ] T101 [P] [US5] (stretch) Build the most-seen Artists and Accompanists Card in `app/src/wrapped/cards/ArtistsCard.tsx`
- [ ] T102 [P] [US5] (stretch) Build the Sabhas Card in `app/src/wrapped/cards/SabhasCard.tsx`
- [ ] T103 [P] [US5] (stretch) Build the firsts and rarities Card, using a Raga's share of the catalog, in `app/src/wrapped/cards/RaritiesCard.tsx`

**Checkpoint**: the three Cards due by 20 December render and share offline.

---

## Phase 10: User Story 6 - Tidy up the log (Priority: P6)

**Goal**: match Unresolved values, confirm Guesses, and merge duplicate Artists and Sabhas.

**Independent Test**: create two Artists who are the same person and one Unresolved raga.
Merge the Artists, match the raga, and confirm all Appearances and the Wrapped update.

- [ ] T104 [P] [US6] Implement matching and confirming in `app/src/store/resolve.ts`. Matching an Unresolved text to a catalog key rewrites `state` and `key` on every Item field whose `text` matches, each as its own outbox change (FR-035). Confirming a Guess clears its flag
- [ ] T105 [P] [US6] Implement merging in `app/src/store/merge.ts`. Merging two Artists or Sabhas sets `mergedIntoId` on the merged-away record and adds its name to the survivor's `aliases` (FR-036); Appearances are not rewritten
- [ ] T106 [US6] Build the Tidy screen in `app/src/screens/TidyScreen.tsx`: Unresolved values and Guesses grouped by text with counts, matching through catalog search, and merging duplicate Artists and Sabhas

**Checkpoint**: every user story is done. Deploy and launch work follows.

---

## Phase 11: Polish, launch and cross-cutting concerns

- [ ] T107 [P] (stretch) Spreadsheet export shaped like last season's sheet (Main, Lecdems, Colours, Compositions) with write-excel-file, lazy-loaded from the phase-2 cache, in `app/src/store/export-xlsx.ts`
- [ ] T108 [P] Run `/review` on the full change set and fix its findings
- [ ] T109 [P] Run `/cso` on the row-level security, the functions and the Maintainer allowlist, and fix its findings, including a size limit on pushed rows (outside voice 18)
- [ ] T110 [P] Run the `accessibility` and `web-design-guidelines` skills on `app/src/screens/` (target size, focus not obscured, `inputmode`, no mobile `autoFocus`) and fix the findings
- [ ] T111 Create the Supabase Pro project in Mumbai, set up Google OAuth credentials, and apply `supabase/migrations/` and `supabase/seed.sql` before rasikas sign up (ADR 0001). Record the project ref, but no secrets, in `docs/adr/0001-supabase-for-sign-in-and-server-store.md`
- [ ] T112 Get the DPDP legal check of consent, withdrawal, erasure and the one-year log retention before public launch (constitution, Privacy), and record the outcome in `specs/001-season-logger/research.md`
- [ ] T113 On the primary test device, installed to the home screen, measure:
  - cold start to the logging screen in airplane mode under 1.5 s (SC-006);
  - save under 100 ms with no indicator (SC-008);
  - Google sign-in from the installed iOS PWA works (ADR 0001, "Not yet tested").

  Record the results in `specs/001-season-logger/research.md`
- [ ] T114 Run every scenario in `specs/001-season-logger/quickstart.md` and record the results there
- [ ] T115 Create the read-only view for season reports in `supabase/migrations/0007_report_view.sql`. It includes only seasons whose `season_reports` is true, has no rasika id, name, email or notes, and is the only thing the end-of-season DuckDB report reads (FR-048). The view lives in the same private schema as the candidates view, with no grant for anonymous users or rasikas (eng review D5). The end-of-season DuckDB report connects as a role that can read only this view (outside voice 10)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none. T010 (the iPhone sign-in spike) needs the primary iPhone named
  (spec Assumptions) and must finish before Phase 3.
- **Foundational (Phase 2)**: depends on Setup and blocks every story.
  - T020 and T021 are in the logger repo, and T021 needs T020.
  - T023 and later catalog tasks can use the T022 fixtures until the real snapshot exists.
  - T029 needs the real snapshot to key composer dates.
  - T033 (on-device timing) needs the primary phone and the real snapshot.
- **US1 (Phase 3)**: after Foundational.
- **US2 part 1 (Phase 4)**: after Foundational; it exports whatever exists. T054 (static
  hosting) must be decided before the phone-only fallback ships.
- **US3 (Phase 5)**: after US1, since it opens planned Events into the Event screen. T058 to
  T061 wait on T057, the logger project's agreement.
- **US4 (Phase 6)**: after US1, since it extends the Event screen.
- **US2 part 2 (Phase 7)**: after US1 and US2 part 1; built and tested locally, deployed last
  (ADR 0001, eng review D12). T073 to T075 wait on T066.
- **US7 (Phase 8)**: after Phase 7, because it needs the server.
- **US5 (Phase 9)**: after US1. T093 waits on T088, the card renderer decision.
- **US6 (Phase 10)**: after US1.
- **Polish (Phase 11)**: T111 before rasikas sign up; T112 before public launch.

### Maintainer decisions inside the task list

- T030: the design system.
- T054: static hosting.
- T057: the schedule feed, with the logger project.
- T066: where push and pull run.
- T088: the card renderer.

None of these is decided by the implementer (constitution VI).

### Within each story

The required tests sit next to the code they protect. Store actions come before the screens
that call them.

---

## Parallel Example: Foundational

```text
Task: "T011 Define the record types in app/src/model/records.ts"
Task: "T012 Define FieldValue and its validator in app/src/model/field-value.ts"
Task: "T013 Add newId() in app/src/model/ids.ts"
Task: "T014 Define the push and pull payload types in app/src/model/sync-payloads.ts"
Task: "T024 Implement the transliteration fold in app/src/catalog/fold.ts"
```

## Parallel Example: User Story 1

```text
Task: "T034 End-to-end offline capture test in app/e2e/offline-concert.spec.ts"
Task: "T035 Delete-and-reorder local test in app/tests/store/reorder-delete.test.ts"
Task: "T036 Event actions in app/src/store/events.ts"
Task: "T037 Artist, Sabha and Appearance actions in app/src/store/people.ts"
Task: "T040 Field input in app/src/screens/components/FieldInput.tsx"
Task: "T042 Colour picker in app/src/screens/components/ColourPicker.tsx"
```

## Parallel Example: User Story 5

```text
Task: "T094 Colours Card in app/src/wrapped/cards/ColoursCard.tsx"
Task: "T095 Top-Ragas Card in app/src/wrapped/cards/TopRagasCard.tsx"
Task: "T096 Composer timeline Card in app/src/wrapped/cards/ComposerTimelineCard.tsx"
```

## Parallel Example: Server (Phase 7)

```text
Task: "T067 Sync tests in supabase/tests/sync.test.ts"
Task: "T068 Row-level security tests in supabase/tests/privacy.test.ts"
Task: "T069 Sync client tests in app/tests/store/sync-client.test.ts"
```

---

## Implementation Strategy

### MVP first

1. Setup and Foundational.
2. US1: offline Concert logging.
3. US2 part 1: unsynced count and export.
4. **Stop and validate** on the primary device in airplane mode. This MVP is also the design
   doc's fallback: it can ship alone if the server is late.

### Incremental delivery

1. US3 (Plan) and US4 (Lecdem).
2. US2 part 2 (the server, local) and US7 (promotion), so sign-up is ready for 1 December
   (eng review D12).
3. US5 (Cards, due 20 December) and US6 (Tidy).
4. Deploy: Supabase Pro in Mumbai and static hosting, then open sign-up. Everything stays free
   until this step.

### Deadline tension to watch

Open sign-up on 1 December needs Phase 7 by then (spec Clarifications); promotion (Phase 8)
follows by 15 December (eng review D13), and the Cards (Phase 9) by 20 December. If November runs short, the cut line in the design doc
applies:

- the Schedule feed (T057 to T061), xlsx export (T107) and the stretch Cards drop first;
- if the server is not ready, the phone-only fallback ships (Phases 1 to 6 with export).

The required tests are never cut (constitution VI).

---

## Notes

- [P] tasks touch different files and depend on no unfinished task.
- Commit after each task or logical group; every change passes `npm run check` and `/review`.
- UI changes are checked at phone width, and the logging path in airplane mode.
- Domain words in code and UI follow `GLOSSARY.md`.
