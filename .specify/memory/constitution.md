# Carnatic Wrapped Constitution

## Core Principles

### I. Offline-First Logging (NON-NEGOTIABLE)

Everything needed to log a concert or lecdem MUST live on the phone: the app shell, the catalog
snapshot, the search index, sabhas, artists and planned events.

- Operations on the logging path MUST NOT await the network. That covers opening the app, finding
  a planned event, creating an event, adding people and items, editing, reordering and deleting.
- Every save MUST be one local transaction that writes the record and its outbox entry, then
  returns. No spinner appears on any save.
- A network error MUST NOT block the UI, discard input or send the user to a sign-in screen.
  Sign-in is needed only to restore onto an empty device.
- Sync runs whenever signal and the app are both present: on start, on reconnect, on return to the
  app and after each write. Background sync is not assumed.

Rationale: sabha halls have poor or no signal. A logger that hesitates in the hall gets replaced by
paper.

### II. Nothing Is Lost

The season MUST survive the loss, wipe or eviction of the phone.

- The server holds a durable copy of every synced record. The phone's store is a working copy.
- Writes carry client-generated ids and idempotency keys, so a retried push never duplicates.
  Deletes are tombstones synced like any other write. Item order is an explicit position field.
- Restore MUST push any unsynced local outbox before it downloads, so a restore never discards a
  local write.
- The app MUST show the count of writes not yet on the server.
- Export of the whole season (JSON at minimum) MUST work offline and from any screen state that
  holds data.
- On first run the app requests persistent storage.

Rationale: browsers, iOS in particular, may clear site storage. A season of concerts cannot be
re-attended.

### III. The Catalog Suggests; the Rasika Decides

The catalog is a strong reference, not proof of provenance. What the user heard in the hall is
the truth of the log.

- Picking a composition fills in raga, tala, composer, language and topic as a suggestion. Every
  filled-in field MUST be editable on the spot, in one or two taps, with no warning or
  confirmation. A kriti sung in a raga other than the catalog's is logged as sung.
- The Wrapped counts what the user logged, not what the catalog says. An edited field is never
  silently reset by a later catalog update.
- "?" and free text MUST be accepted on every field. Unresolved values are kept as typed, count
  in the Wrapped as their own bucket, and can be resolved later.
- Editing a logged item never edits the catalog. The catalog belongs to the logger project.
- Linked raga names (e.g. Pantuvarali and Kamavardhini) are never merged and never treated as
  unrelated. A song shows its own name prominently and the sibling small. Analytics aggregate on
  the linked pair.
- Links to catalog entries MUST survive catalog rebuilds. The logger regenerates its row ids on
  every run, so logs point at stable names (e.g. the karnatik kriti id), and each item keeps the
  text as typed or picked as a fallback.
- Wrapped statistics are derived from logged data and MUST NOT be stored as a source of truth.

Rationale: the catalog is a highly competitive standard, but the music is freer than any dataset.
Performers change ragas, and sources disagree. A logger that argues with the listener records the
catalog, not the concert.

### IV. Grounded in the Data

Product and design suggestions MUST cite what the data shows, not assumptions about how people
log. The sources are:

- last season's spreadsheet (`docs/reference/wrapped-2024-25.xlsx`);
- the catalog;
- seasons logged in the app;
- measurements on the primary test device.

A proposal states its evidence, for example "6 items per concert", "40 cells are ? or -", or
"search misses 3 of 100 spellings". Where no data exists, the proposal says so.

Testing follows judgment, not a ritual. Test-first is not mandated. One narrow exception: paths
where a failure silently loses or corrupts the season MUST have automated tests before they ship.
Those paths are:

- offline capture surviving a forced close;
- sync without duplicates;
- delete and reorder reaching the server;
- restore onto an empty device;
- catalog updates;
- export.

Rationale: last season's spreadsheet answered design questions better than any interview could.
Data-loss bugs are invisible until the data is gone, so those paths alone get mandatory tests.

### V. Latency and Size Budgets

Speed is a feature with numbers. The current budgets, on a mid-range phone with the app installed:

- Cold start to the logging screen in airplane mode: under 1.5 s.
- Catalog search: under 50 ms p95 from keystroke to results, offline.
- Local save: under 100 ms.
- First-install download (shell, catalog snapshot, search index): under 2 MB compressed.
  Second-phase assets (card rendering, xlsx writer): under a further 3 MB.

Size budgets MUST be checked automatically on every build. Timing budgets MUST be measured on the
primary test device before each release. A change that breaks a budget does not ship until the
budget is restored or this constitution is amended.

Rationale: in a hall, the app competes with a paper notebook. Every dependency spends the budget.

### VI. Deliberate, Simple Decisions

- Decisions are made one at a time, by the user, with the options and trade-offs stated. Plan
  questions MUST NOT be auto-decided.
- A hard-to-reverse decision (storage engine, sync model, auth, hosting, catalog key scheme, data
  shape) MUST be recorded as an ADR in `docs/adr/` before code depends on it.
- A new runtime dependency MUST be justified by what it saves against what it costs: size budget,
  maintenance and lock-in.
- Build what this season needs (YAGNI). The deadline cuts scope along the design doc's cut line.
  It never cuts the data-loss tests or the principles above.

Rationale: the user values the right incremental decisions over speed of delivery. A record of
why makes each decision reviewable later.

## Boundaries and Constraints

- **Platform:** an installable web app (PWA), phone-first, used from the home screen. There is no
  app store. All on-device storage sits behind one module, so the app can be wrapped natively
  (e.g. Capacitor) without a rewrite if browser storage proves unreliable.
- **Ownership:** the logger project (`/opt/carnatic/logger`) owns the kriti, raga and composer
  catalog and the schedule feed. This project consumes them through versioned contracts: a
  content-hashed catalog snapshot and a schedule feed format defined here. It does not scrape,
  edit or own either.
- **Project-owned reference data:** composer dates and the subject-to-topic roll-up live in this
  repository, keyed by catalog natural keys.
- **Users:** one user and one writing device this season. Every record carries an owner, so
  friends can be added later without a data migration.
- **Privacy and security:**
  - The season log is personal data. The API MUST authenticate every request.
  - A lost device's session MUST be revocable.
  - Secrets MUST NOT be committed.
  - Share cards contain only what the user chooses to post.

## Development Workflow and Quality Gates

- Work follows the pipeline in `docs/skills-router.md`:
  1. constitution
  2. glossary
  3. specify and clarify
  4. plan with ADRs
  5. plan reviews
  6. design
  7. tasks and analyze
  8. implement
  9. review and QA
  10. ship

  Each step uses the skill the router names. Skills not in the router are vetted per its §6
  before use.
- Every change MUST pass, before it lands:
  - typecheck, lint and the full test suite;
  - the size budgets;
  - a code review (`/review`).
- UI changes are checked at phone width, and the logging path is checked in airplane mode.
- Each plan's Constitution Check lists any principle a design bends. It records the
  justification in Complexity Tracking, or redesigns.
- Domain terms follow `GLOSSARY.md` once it exists. Code, specs and UI use the same words.

## Governance

This constitution supersedes the "Non-negotiables" section of `CLAUDE.md` and any conflicting
practice. When a spec, plan or task conflicts with it, the constitution wins until it is amended.

- **Amendments:** proposed in writing with the reason and the affected principles, approved by the
  user, and recorded with a Sync Impact Report. Dependent artifacts (specs, plans, CLAUDE.md,
  `docs/skills-router.md`) are updated in the same change.
- **Versioning:** semantic.
  - MAJOR: a principle is removed or redefined.
  - MINOR: a principle or section is added, materially expanded, or a budget is loosened.
  - PATCH: wording and clarifications only.
- **Compliance:**
  - `/speckit-plan` runs the Constitution Check gate.
  - `/speckit-analyze` flags conflicts between spec, plan and tasks.
  - `/review` checks each change against Principles I–V.
  - Runtime guidance for agents lives in `CLAUDE.md` and `docs/skills-router.md`.

**Version**: 1.0.0 | **Ratified**: 2026-10-27 | **Last Amended**: 2026-10-27
