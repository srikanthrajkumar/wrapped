# Review record: Season Logger and Live Wrapped

The history of the plan reviews for [plan.md](plan.md). Their outcomes are already written
into the plan, spec, tasks, data model and contracts. References such as "eng review D8" or
"outside voice 1" in those files point here.

## Eng review (plan-eng-review, 2026-10-29)

Target: `specs/001-season-logger/plan.md`, read with research.md, data-model.md, contracts/,
quickstart.md, tasks.md and ADRs 0001 to 0005. The plan above is kept as written; amendments
approved in this review are applied to it and to tasks.md, and recorded below.

### Scope record

feature answers: none proposed; structure: B (D1, "Smaller arrangement (recommended)");
accepted scope: fold `shared/` into `app/src/model/` (records, field values, ids, sync
payloads), with tasks T001, T003 and T010 to T013 changing their paths; pending remedies: R1,
R2, R3, R4, R5, R6, R7, R8, R9.

## Decision ledger

### R1: How record ids are generated
Finding: S1, INFORMATIONAL, confidence 7/10, tasks.md:61 ("Implement a dependency-free UUIDv7 generator using `crypto.getRandomValues`"), reviewer: plan-eng-review (Scope Challenge, reuse ladder).
Plan baseline: custom UUIDv7 generator in `app/src/model/uuidv7.ts` (data-model.md "Ids": client-generated UUIDv7); not separately approved.
Runtime evidence: none (no code). `crypto.randomUUID()` is built into every browser the app targets (iOS Safari 15.4+, Chrome 92+) [estimated from platform docs, not probed]. Ordering in the design comes from the server `seq`, item `position`, outbox `++seq` and event dates, never from id order (data-model.md, contracts/sync-api.md:87).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R1 id generator | custom UUIDv7, pending | built-in `crypto.randomUUID()` (UUIDv4) behind a one-line `newId()` in app/src/model/ids.ts; T012 rewritten to that; data-model.md "Ids" and ADR 0003 say UUID | custom UUIDv7 kept (T012 as written) |
| R2 to R9 | pending | pending | pending |
Question D2:
D2 — Use the browser's built-in id generator instead of writing our own?
Project/branch/task: main, spec 001 plan, task T012 and data-model.md "Ids".
ELI10: Every record needs a unique id created on the phone. The plan writes its own generator for a time-ordered kind (UUIDv7). The browser already has crypto.randomUUID(), which makes random ids with no code to write. Nothing in the design sorts by id: order comes from dates, positions and the server's sequence number. So the time-ordering buys nothing here.
Stakes if we pick wrong: Building it ourselves adds a small piece of code that can have subtle bugs (clock rollback, collisions) for no benefit. Switching later is cheap, since ids are opaque strings.
Recommendation: A because the platform already does this, and nothing depends on id order.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Built-in crypto.randomUUID() (recommended)
  ✅ No code to write or test, and the browser's generator is well proven
  ✅ Task T012 shrinks to a one-line newId() wrapper, so ids still come from one place
  ❌ Random ids scatter across Postgres index pages; irrelevant at about 250 rows per rasika
B) Keep the custom UUIDv7 generator
  ✅ Ids sort roughly by creation time, which helps reading raw tables during debugging
  ❌ About 20 lines of our own code to get right, including clock handling, with its own tests
Net: built-in randomness versus time-sortable ids nobody reads.
Header: Record ids
Options:
A) Built-in id (recommended)
Use crypto.randomUUID() for every record and outbox id, through a one-line newId() in app/src/model/ids.ts. Task T012 is rewritten to that; data-model.md "Ids" and ADR 0003 say UUID instead of UUIDv7. Effort: human ~10 min / CC ~2 min. Risk: none known. Maintenance: none.
B) Keep custom UUIDv7
Keep task T012 as written: a dependency-free UUIDv7 generator in app/src/model/uuidv7.ts with tests for ordering and uniqueness. Effort: human ~1 h / CC ~10 min. Risk: clock-related edge cases. Maintenance: our own code.

State: approved
Actual answer: A) Built-in id (recommended), D2 answer 2026-10-29
Accepted scope: ids from crypto.randomUUID() through a one-line newId() in app/src/model/ids.ts; T012 rewritten to that; data-model.md "Ids" and ADR 0003 say UUID instead of UUIDv7
History: none

### R2: Sign-in method on an installed iPhone app, and when it is proven
Finding: A1, CRITICAL, confidence 7/10, tasks.md:327 (T094 "supabase-js with Google `signInWithOAuth`") and research.md:154 ("sign-in from an installed iOS PWA has not been tried"), reviewer: plan-eng-review (Architecture).
Plan baseline: Google sign-in by OAuth redirect (T094); first checked on the device at T111 in the final phase; sign-in required at first launch (FR-050, commit d3361f0).
Runtime evidence: unknown, no device test. Web reports (Auth0 community, firebase-js-sdk issue 77, Apple developer forums; mostly 2018 to 2021) say the redirect opens Safari and does not return to a home-screen app, whose storage is separate. Supabase documents `signInWithIdToken` with Google's own sign-in button, which keeps the user on the page [unverified on iOS].
Comparison grid:
| Choice | Current | A | B | C |
|---|---|---|---|---|
| R2 sign-in method | Google OAuth redirect | Google button + `signInWithIdToken`; Supabase email one-time code only if the spike fails | Google button + `signInWithIdToken` and email one-time code, both built | Google OAuth redirect |
| R2 when proven on iPhone | T111, final phase | spike in Phase 1 on the primary iPhone, using a free throwaway Supabase project and a temporary HTTPS address; result in research.md before Phase 3 | T111, final phase | T111, final phase |
| R1 ids | approved D2 | unchanged | unchanged | unchanged |
| R3 to R10 | pending | pending | pending | pending |
Question D3:
D3 — Prove Google sign-in works on an installed iPhone app before building on it?
Project/branch/task: main, spec 001 plan, T094 (sign-in) and FR-050 (sign-in at first launch).
ELI10: The app now asks for Google sign-in the first time it opens. The usual Google sign-in sends you away to a Google page and back. On an iPhone home-screen app, reports say the "back" part breaks: the login finishes in Safari, and the app never learns about it, because the two keep separate storage. Google also offers its own sign-in button that hands the app a token without leaving the page, which Supabase supports. Nobody has tried either on your phone yet.
Stakes if we pick wrong: If sign-in fails on iPhones and we find out in late November, every iPhone rasika is blocked at first launch, a week before the season.
Recommendation: A because a one-day test in week one turns the riskiest unknown into a fact, and keeps the build small if Google's button works.
Completeness: A=9/10, B=8/10, C=4/10
Pros / cons:
A) Spike on your iPhone in Phase 1, fall back to email code (recommended)
  ✅ Learns in week one whether Google sign-in works on an installed iPhone app, before screens depend on it
  ✅ Builds only one sign-in method unless the test fails, so less UI and fewer tests
  ❌ Needs a free throwaway Supabase project and a temporary HTTPS address for the test, about half a day of setup
B) Build Google's button and an email one-time code from the start
  ✅ Works on iPhone even if Google fails, with no spike needed
  ❌ Two sign-in methods to build, test and explain in the UI, even if Google works
C) Keep the redirect sign-in and test it at the end (T112)
  ✅ No extra work now; the plan stays as written
  ❌ The one check that could block every iPhone user happens in the final week
Net: half a day of setup now versus finding a launch blocker in the last week.
Header: iPhone sign-in
Options:
A) Spike first (recommended)
In Phase 1, on your primary iPhone with the app installed, test Google's sign-in button with supabase.auth.signInWithIdToken, using a free throwaway Supabase project and a temporary HTTPS address. If it works, T094 uses it. If not, T094 uses Supabase's email one-time code (a 6-digit code typed in the app) instead. Record the result in research.md before Phase 3. Effort: human ~1 day / CC ~1 h. Risk: low. Maintenance: one sign-in method.
B) Build both methods
T094 builds Google's sign-in button with signInWithIdToken and Supabase's email one-time code, both offered on the sign-in screen from the start. Tested on the device at T112 as planned. Effort: human ~1.5 days / CC ~1.5 h. Risk: low. Maintenance: two sign-in methods.
C) Keep as planned
T094 keeps Google OAuth redirect; the first device check stays at T112 in the final phase. Effort: none now. Risk: high, a possible launch blocker found late. Maintenance: one method.

State: approved
Actual answer: A) Spike first (recommended), D3 answer 2026-10-29
Accepted scope: a new Phase 1 task: on the primary iPhone with the app installed, test Google's sign-in button with supabase.auth.signInWithIdToken (free throwaway Supabase project, temporary HTTPS address), result recorded in research.md before Phase 3; T094 uses that button if it works, otherwise Supabase's email one-time code; ADR 0001 "Not yet tested" points to the spike
History: factual correction 2026-10-30: the final-phase device check is T111, not T112 (task renumbering in f7bb52a); the question text sent as D3 said T112; no behavior or approval changed

### R3: What a pull does to a row with an unsent local edit
Finding: A2, CRITICAL, confidence 8/10, contracts/sync-api.md:91 ("The phone applies a page in one local transaction, then stores the new cursor."), reviewer: plan-eng-review (Architecture).
Plan baseline: pull applies every pulled row; no rule about rows with pending outbox entries (contracts/sync-api.md "Pull", tasks.md T095).
Runtime evidence: none (no code). Scenario, by reading the contract: save raga (op1 queued) → pull returns the older server row → raga reverts on screen → save tala on the reverted row (op2 carries the old raga) → push op1 then op2 → server ends with the old raga. A silent lost edit on a constitution IV data-loss path.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R3 pull rule for rows with pending ops | pulled row replaces local row | pulled row is skipped while the local row has any pending outbox op; required test added to T086 | pulled row replaces local row (as written) |
| R1, R2 | approved D2, D3 | unchanged | unchanged |
| R4 to R10 | pending | pending | pending |
Question D4:
D4 — Stop a pull from overwriting an edit that hasn't been sent yet?
Project/branch/task: main, spec 001 plan, contracts/sync-api.md "Pull" and task T095 (sync loop).
ELI10: When the app syncs, it sends your changes, then fetches the server's copy. If you edit something between those two steps, the fetched copy is older than what's on your phone, and the plan lets it overwrite your edit. Your next edit then builds on the old value and sends it back, so the first edit is lost without any sign. Since only one device writes, the phone's copy is always the newest while it has unsent changes; the fix is to skip fetched rows that still have changes waiting to send.
Stakes if we pick wrong: A rasika fixes a raga in the hall, edits the tala a moment later, and the raga fix quietly disappears from the season.
Recommendation: A because it closes a silent data-loss path with one rule and one test.
Completeness: A=10/10, B=3/10
Pros / cons:
A) Skip pulled rows that have unsent local changes (recommended)
  ✅ No edit can be overwritten by an older server copy, which closes the lost-edit path
  ✅ One rule in the pull step plus one required test; no merging logic
  ❌ A row edited on the server alone (none today) would wait until the phone's change is sent
B) Keep as written
  ✅ No extra rule in the pull step
  ❌ A quick second edit during sync can silently undo the first one
Net: one rule and one test versus a silent lost-edit path.
Header: Pull rule
Options:
A) Skip pending rows (recommended)
When a pull page is applied, any row whose record still has a pending outbox op is skipped; the local row wins until its op is acknowledged. Contract sync-api.md and task T095 say so, and the required sync-client test (T086) adds the edit-during-sync case. Effort: human ~1 h / CC ~10 min. Risk: none known. Maintenance: one rule.
B) Keep as written
Pull pages replace local rows whatever their outbox state. Effort: none. Risk: silent lost edits during sync. Maintenance: none.

State: approved
Actual answer: A) Skip pending rows (recommended), D4 answer 2026-10-29
Accepted scope: pull skips any row whose record has a pending outbox op (local wins until acknowledged); stated in contracts/sync-api.md "Pull" and T095; required sync-client test T086 adds the edit-during-sync case
History: none

### R4: Where the Maintainer and report views live, so row-level security can't be skipped
Finding: A3, CRITICAL, confidence 8/10, tasks.md:366 (T101 "**candidates view**") and tasks.md T113 ("Create the read-only view for season reports"), reviewer: plan-eng-review (Architecture, security).
Plan baseline: a candidates view (T101) and a season-report view (T113); schema and access not stated; Maintainer functions "callable only by the `maintainer` allowlist" (T101).
Runtime evidence: none (no code). Postgres views run with their owner's privileges unless `security_invoker` is set; Supabase's linter flags this as lint 0010 (security_definer_view), and views in the API-exposed `public` schema can be queried by any signed-in user [web: Supabase lint docs as quoted by third-party guides; not probed locally].
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R4 view placement and access | unstated (default `public`, owner rights) | views in a private schema the API doesn't expose; Maintainer reads them only through functions that check the allowlist first; anon and rasikas get no grant; privacy test T085 calls them as a rasika and expects refusal | unstated, as written |
| R1 to R3 | approved D2 to D4 | unchanged | unchanged |
| R5 to R10 | pending | pending | pending |
Question D5:
D5 — Keep the Maintainer and report views out of reach of ordinary rasikas?
Project/branch/task: main, spec 001 plan, T101 (promotion candidates) and T113 (season-report view).
ELI10: The database rules that keep each rasika's season private apply to tables. A Postgres view, by default, runs with the database owner's rights, so those rules don't apply to it. Supabase also publishes everything in its main schema through its API. So a view of "all consenting seasons" left there could be read by any signed-in rasika. The fix is to keep these views somewhere the API doesn't publish, and let only the Maintainer reach them, through functions that check the allowlist first.
Stakes if we pick wrong: One rasika could read every other consenting rasika's season and hand-typed names, breaking the constitution's privacy rule and the DPDP consent promise.
Recommendation: A because it makes privacy depend on where the views live, not on every future view being written carefully.
Completeness: A=10/10, B=3/10
Pros / cons:
A) Private schema, Maintainer-only functions, privacy test (recommended)
  ✅ No view is reachable through the API, so a careless future view can't leak seasons
  ✅ The privacy test proves a rasika is refused, so a regression fails the build
  ❌ Maintainer screens call functions instead of reading views directly, a little more SQL
B) Keep as written
  ✅ Simplest to write: plain views queried directly
  ❌ The default placement leaks every consenting season to any signed-in rasika
Net: a little more SQL versus a cross-rasika privacy leak.
Header: Private views
Options:
A) Private schema (recommended)
Create the candidates and season-report views in a private schema that Supabase's API doesn't expose. The Maintainer reads them only through functions that check the maintainer allowlist first; anonymous users and rasikas get no grant on the schema. Tasks T101 and T113 say so, and the required privacy test T085 calls each function and view as an ordinary rasika and expects refusal. Effort: human ~2 h / CC ~15 min. Risk: none known. Maintenance: one schema rule.
B) Keep as written
Views are created without a stated schema or access rule, so they land in the exposed public schema with owner rights. Effort: none. Risk: cross-rasika privacy leak. Maintenance: none.

State: approved
Actual answer: A) Private schema (recommended), D5 answer 2026-10-29
Accepted scope: candidates and season-report views in a private schema the Supabase API doesn't expose; Maintainer reads them only through functions that check the maintainer allowlist first; no grant on that schema for anon or rasikas; T101 and T113 say so; required privacy test T085 calls each function and view as an ordinary rasika and expects refusal
History: none

### R5: What a former writing device can do with its unsent changes
Finding: A4, INFORMATIONAL, confidence 7/10, contracts/sync-api.md:32 (`POST /v1/devices/claim` "Makes this device the writer (FR-022)") with FR-050 (sign-in at first launch) and contracts/season-export.md ("Importing an export is out of scope this season"), reviewer: plan-eng-review (Architecture).
Plan baseline: the device most recently signed in is the writer (FR-022); a former writer stops pushing, keeps its unsynced changes and offers export (spec Edge Cases "Second device", T100); no import.
Runtime evidence: none (no code). Scenario: rasika logs at a concert with no signal (phone queues ops), later signs in on an iPad to show a friend the Wrapped → iPad becomes writer → phone's next push gets 409 → queued Items reach the server only by hand re-entry.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R5 former writer's options | stop pushing, keep queue, offer export | same, plus "Make this the writing device again": re-claims, then pushes its queue (last write wins per record); required test in T086 | stop pushing, keep queue, offer export (as written) |
| R1 to R4 | approved D2 to D5 | unchanged | unchanged |
| R6 to R10 | pending | pending | pending |
Question D6:
D6 — Let a phone that lost writing rights take them back and send its queued changes?
Project/branch/task: main, spec 001 plan, FR-022 (one writing device) and T100 ("not the writer" state).
ELI10: Only one device can send changes at a time: the one you signed in on most recently. Now that sign-in happens at first launch, just opening the app on an iPad makes the iPad the writer. If your phone still had changes waiting (say from a hall with no signal), it can no longer send them; today it can only export them to a file, and there's no import. Adding a "make this the writing device again" button lets the phone take writing back and send what it was holding.
Stakes if we pick wrong: Concerts logged offline on the phone stay stuck on it, and reach the season only if the rasika types them again.
Recommendation: A because it keeps one writer at a time but never strands a logged concert.
Completeness: A=9/10, B=5/10
Pros / cons:
A) Add "make this the writing device again" (recommended)
  ✅ Changes logged offline always reach the server, with no re-typing
  ✅ Reuses the existing claim call and push; one button and one test
  ❌ If both devices edited the same record, the phone's version wins, by last write
B) Keep as written: export only
  ✅ Simplest rule: whoever signed in last writes, full stop
  ❌ Queued changes on the old device reach the server only by hand re-entry
Net: one button and one test versus stranded concerts.
Header: Take back writer
Options:
A) Allow taking back (recommended)
When a push returns 409 not_writer, the phone shows "Make this the writing device again" next to Export. Choosing it calls POST /v1/devices/claim, then pushes its queued ops, last write wins per record. Contract sync-api.md and tasks T100 and T086 say so; T086 adds the test that a re-claimed phone's queued ops all reach the server. Effort: human ~1.5 h / CC ~15 min. Risk: low. Maintenance: one button.
B) Export only
A former writer stops pushing, keeps its queue and offers export, as the spec says today. Effort: none. Risk: stranded queued changes. Maintenance: none.

State: approved
Actual answer: A) Allow taking back (recommended), D6 answer 2026-10-29
Accepted scope: on 409 not_writer the phone offers "Make this the writing device again" next to Export; it calls POST /v1/devices/claim, then pushes its queued ops, last write wins per record; contracts/sync-api.md, T100 and T086 say so; T086 tests that a re-claimed phone's queued ops all reach the server
History: none

### R10: Where the record fields are defined for the server
Finding: A5, INFORMATIONAL, confidence 7/10, tasks.md:311 (T088 "tables for events, appearances, items, artists and sabhas with the data-model.md columns") and tasks.md T010 (the same records in `app/src/model/records.ts`), reviewer: plan-eng-review (Architecture, red flag 8: hand-synced list).
Plan baseline: each field is a typed Postgres column (T088) and a TypeScript type (T010), and is described in data-model.md and the contracts.
Runtime evidence: none (no code). The server never reads record fields during sync; it only needs `id`, `rasika_id`, `seq`, `deleted_at`, `received_at` and the parent id (contracts/sync-api.md "Push", "Pull"). Fields are read on the server only by the candidates view (names) and the season-report view.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R10 server storage of record fields | one typed column per field (T088) | one `data` jsonb column holding the record as the phone sent it, plus `id`, `rasika_id`, `seq`, `deleted_at`, `received_at` and the parent id; push and pull are one generic upsert and select for all five tables; views read fields with JSON operators; the record shape is defined only in app/src/model/records.ts | one typed column per field (as written) |
| R1 to R5 | approved D2 to D6 | unchanged | unchanged |
| R6 to R9 | pending | pending | pending |
Question D7:
D7 — Store each record as one JSON column on the server instead of a column per field?
Project/branch/task: main, spec 001 plan, T088 (season tables) and T010 (record types).
ELI10: Right now every field of an Event or Item would be listed in three places: the app's TypeScript types, the server's table columns, and the docs. When a field is added to the app and missed on the server, pushes of that field get rejected or quietly dropped. But the server never looks inside a record during sync; it only needs the id, owner, sequence number, delete marker and parent. So the server can keep the whole record as one JSON column, and the field list lives in one place: the app.
Stakes if we pick wrong: Typed columns mean every new field needs a matching database migration, and a forgotten one loses that field on every sync.
Recommendation: A because it removes the hand-kept field list where a mistake loses data, and makes push and pull one generic path.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) One JSON column per record (recommended)
  ✅ The field list lives only in app/src/model/records.ts; adding a field needs no migration
  ✅ Push and pull become one generic upsert and select for all five tables, so less SQL to test
  ❌ The candidates and report views read fields with JSON operators, and the database can't type-check them
B) A typed column per field (as written)
  ✅ The database checks each field's type and makes ad hoc SQL queries easy to write
  ❌ Every field change needs a matching migration, and a missed one drops data on sync
Net: a field list kept in one place versus database-checked columns.
Header: Server rows
Options:
A) JSON column (recommended)
Each season table (events, appearances, items, artists, sabhas) has id, rasika_id, seq, deleted_at, received_at, the parent id where there is one, and a data jsonb column holding the record as the phone sent it. Push and pull use one generic upsert and select for all five tables. The candidates and report views read fields with JSON operators. T088, T090, T091 and data-model.md "Server bookkeeping" say so. Effort: human saves ~half a day / CC ~10 min to amend. Risk: low. Maintenance: no field migrations.
B) Typed columns
Keep T088 as written: one typed Postgres column per field, matching the TypeScript types and data-model.md. Effort: as planned. Risk: a missed migration drops a field on sync. Maintenance: a migration per field change.

State: approved
Actual answer: A) JSON column (recommended), D7 answer 2026-10-30
Accepted scope: each season table (events, appearances, items, artists, sabhas) has id, rasika_id, seq, deleted_at, received_at, the parent id where there is one, and a data jsonb column holding the record as sent; push and pull are one generic upsert and select for all five tables; candidates and report views read fields with JSON operators; T088, T090, T091 and data-model.md "Server bookkeeping" say so
History: none

### R6: Which side enforces rules that span several rows
Finding: A6, INFORMATIONAL, confidence 6/10, contracts/sync-api.md:48 ("At most 200 ops per request") and data-model.md:227 ("`position` is unique among an Event's live Items after each transaction"), reviewer: plan-eng-review (Architecture).
Plan baseline: validation rules listed without saying which side enforces them; a reorder is several ops and can straddle two push batches.
Runtime evidence: none (no code).
Comparison grid: none; no question. Resolved by D7 (approved): the server stores each record as sent and checks only id, owner and parent, so it holds no rule across rows. Correction recorded in data-model.md "Validation rules": the phone enforces them all; the server checks id, owner and parent Event only.
State: approved
Actual answer: no question; follows from D7 answer 2026-10-30
Accepted scope: data-model.md "Validation rules" states that the phone enforces all of them and the server checks only id, owner and parent
History: none

### R7: Maintainer writes take the rasika's lock
Finding: A7, INFORMATIONAL, confidence 6/10, contracts/sync-api.md:87 ("the rasika's own records and Links, by `seq`, written only under that rasika's lock") against tasks.md T101 (promote, no lock stated) and T093 (de-identification, no lock stated), reviewer: plan-eng-review (Architecture).
Plan baseline: the contract already requires Links to be written under the rasika's lock; the tasks omitted it.
Runtime evidence: none (no code).
Comparison grid: none; no question. Alignment of T101 and T093 with the contract as written, with no behavior change: promote takes each affected rasika's advisory lock; de-identification holds the rasika's lock.
State: approved
Actual answer: no question; carries the contract's existing rule (contracts/sync-api.md "Pull")
Accepted scope: T101 promote and T093 de-identification take the affected rasika's advisory lock
History: none

### R8: One pending outbox entry per record, or one per save
Finding: Q1, INFORMATIONAL, confidence 7/10, tasks.md T015 ("Each runs one Dexie read-write transaction that writes the record ... and an outbox entry"), with T038 (field input saves as the rasika edits) and T095 (sync "after each save"), reviewer: plan-eng-review (Code quality).
Plan baseline: every save appends a new outbox entry with the full row; the unsynced count is the outbox length (data-model.md "Phone-only records", FR-016).
Runtime evidence: none (no code). About 250 Items per season, each edited several times, so the outbox may hold several copies of one record [estimated].
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R8 outbox entries per record | one per save | one per record while unsent: a save replaces the row of that record's unsent entry, keeping its place in the queue; an entry that has been sent at least once (even if the reply was lost) is never changed, so a later save adds a new one; required test added to T018 | one per save (as written) |
| R8 unsynced count meaning | outbox length (saves) | outbox length, now records with unsent changes | outbox length (saves) |
| R1 to R7, R10 | approved D2 to D7 and alignments | unchanged | unchanged |
| R9, R11 | pending | pending | pending |
Question D8:
D8 — Keep one queued change per record instead of one per save?
Project/branch/task: main, spec 001 plan, T015 (save path) and FR-016 (unsynced count).
ELI10: Every save adds a "send this to the server" entry with a full copy of the record. Fix a raga, then the tala, then a note, and one Item has three entries queued, all sent one after another, and the "not yet synced" counter says 3 for one Item. Instead, a save can update the record's waiting entry in place, as long as that entry has never been sent. The server gets the same final record, with less to send, and the counter means "records with unsent changes".
Stakes if we pick wrong: Without it, more data goes over a weak hall connection, and the counter overstates the risk. Done carelessly, changing an entry the server may already have stored would be ignored as a duplicate, so any entry that has been sent, even with no reply, must stay untouched.
Recommendation: A because it sends less over bad signal and makes the counter honest, with one rule that is easy to test.
Completeness: A=9/10, B=7/10
Pros / cons:
A) One unsent entry per record (recommended)
  ✅ Less to push over weak signal; ten edits to one Item send once
  ✅ The unsynced count reads as records at risk, which is what the rasika cares about
  ❌ One more rule in the save path (never touch an entry that has been sent), with its own test
B) One entry per save (as written)
  ✅ Simplest save path: always append
  ❌ Repeated edits queue and push repeated full copies; the counter counts saves, not records
Net: one tested rule versus redundant pushes and a misleading counter.
Header: Outbox entries
Options:
A) One per record (recommended)
A save replaces the row in that record's never-sent outbox entry, keeping its place in the queue. An entry that has been sent at least once, even if the reply was lost, is never changed, so a save after that adds a new entry. The unsynced count then means records with unsent changes. T015 and data-model.md "Phone-only records" say so, and the required offline-capture test T018 adds: ten saves to one record leave one entry; a save after a push whose reply was lost adds a second entry, and both reach the server. Effort: human ~1.5 h / CC ~15 min. Risk: low. Maintenance: one rule.
B) One per save
Every save appends a new outbox entry, as written. Effort: none. Risk: redundant pushes and a counter that overstates. Maintenance: none.

State: approved
Actual answer: A) One per record (recommended), D8 answer 2026-10-30
Accepted scope: a save replaces the row in that record's never-sent outbox entry, keeping its queue place; an entry sent at least once (even with a lost reply) is never changed, so a later save adds a new entry; unsynced count means records with unsent changes; T015 and data-model.md "Phone-only records" say so; required test T018 adds the ten-saves and lost-reply cases
History: payload revised before asking: "being pushed" widened to "sent at least once, even if the reply was lost", because a changed entry reusing a stored opId would be dropped as a duplicate

### R11: What the rasika sees when a save fails
Finding: Q2, INFORMATIONAL, confidence 6/10, tasks.md T015 (the only write path; no failure behavior stated) against constitution I ("A network error ... MUST NOT ... discard input") and FR-003 ("Every save MUST be kept on the phone immediately"), reviewer: plan-eng-review (Code quality, error paths).
Plan baseline: save is one Dexie transaction that returns; no behavior stated when the transaction fails.
Runtime evidence: none (no code). IndexedDB writes can fail with a quota error, and iOS Safari has reported lost IndexedDB connections after the app is backgrounded [in-distribution knowledge, not probed]; a failed transaction writes neither the record nor its outbox entry (T018).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R11 behavior on a failed save | unstated | the screen keeps what was entered, shows "Not saved" with Retry, retries once after reopening the database, and never shows the value as saved; Export stays reachable; required test added to T018 (a forced transaction failure keeps the input and saves on retry) | unstated (as written) |
| R1 to R8, R10 | approved D2 to D8 and alignments | unchanged | unchanged |
| R9 | pending | pending | pending |
Question D9:
D9 — Define what happens on screen when a save fails?
Project/branch/task: main, spec 001 plan, T015 (save path), FR-003 and constitution I.
ELI10: Saving to the phone almost always works, but it can fail: the phone's storage is full, or iPhones sometimes drop the app's connection to its database after it has been in the background. The plan doesn't say what happens then. Without a rule, the screen could clear the field or look saved when nothing was stored. The rule: keep what was typed on screen, say "Not saved" with a Retry button, retry once after reconnecting, and never pretend it's saved.
Stakes if we pick wrong: A rasika types an Item, the save silently fails, and the Item is missing from the season with no sign anything went wrong.
Recommendation: A because a failed save must be visible and recoverable, which the constitution requires, and it is one small path with one test.
Completeness: A=9/10, B=4/10
Pros / cons:
A) Keep the input, show "Not saved", retry (recommended)
  ✅ Nothing typed is lost; the rasika sees the problem and can retry or export
  ✅ One automatic retry after reopening covers iOS's lost database connection without a tap
  ❌ One more UI state, "Not saved", to design and test
B) Leave it unspecified
  ✅ No extra UI state
  ❌ A failed save can clear the input or look saved, losing an Item with no sign
Net: one UI state and one test versus silent loss on a failed save.
Header: Failed save
Options:
A) Keep input, retry (recommended)
When a save transaction fails, the screen keeps what was entered and shows "Not saved" with a Retry button; the store reopens the database and retries once automatically; nothing shows as saved until the transaction commits; Export stays reachable. T015 says so, and the required test T018 adds: a forced transaction failure keeps the input, and Retry then saves record and outbox entry together. Effort: human ~2 h / CC ~15 min. Risk: low. Maintenance: one UI state.
B) Unspecified
Leave T015 without failure behavior, as written. Effort: none. Risk: silent loss on a failed save. Maintenance: none.

State: approved
Actual answer: B) Unspecified, D9 answer 2026-10-30
Accepted scope: none; T015 stays without stated failure behavior (risk retained: a failed save is not specified to keep the input or show an error)
History: none

### R9: When cold start and search speed are first measured on the phone
Finding: P1, INFORMATIONAL, confidence 6/10, research.md:57 ("only the ranking is reliable") and tasks.md T111 (device timing in the final phase), reviewer: plan-eng-review (Performance).
Plan baseline: search p95 checked in CI under 4× CPU throttle (T047); cold start under 1.5 s and save under 100 ms measured on the primary device only in Phase 11 (T111).
Runtime evidence: catalog 2,031 KB raw JSON, 30,539 songs (research.md:9-10, measured); parse, fold and index time on a phone unknown [not measured].
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R9 first on-device timing | Phase 11 (T111) | as soon as the catalog loads and searches (end of Phase 2), on the primary phone: cold start to the home screen in airplane mode and search p95 over the full catalog, recorded in research.md; if either misses its budget, the fix is decided then from the numbers; T111 still re-measures before release | Phase 11 (T111) only |
| R1 to R8, R10, R11 | approved D2 to D9 and alignments | unchanged | unchanged |
Question D10:
D10 — Time cold start and search on your phone when the catalog first works, not only at the end?
Project/branch/task: main, spec 001 plan, T047 (search timing in CI) and T111 (device timing before release).
ELI10: The app must open in under 1.5 seconds and show search results within 50 ms, offline. At startup it reads a 2 MB catalog and prepares 30,000 song names for search. Nobody knows yet how long that takes on a real phone; the plan first measures it in the last phase. Measuring as soon as the catalog loads, at the end of Phase 2, shows early whether we need to change anything, like showing the screen before search is ready, or preparing the search data when building the catalog.
Stakes if we pick wrong: If the phone is too slow and we learn in late November, the fix lands under deadline pressure, after the screens are built around the slow path.
Recommendation: A because a short measurement in week one replaces a guess with a number, as the constitution asks.
Completeness: A=9/10, B=6/10
Pros / cons:
A) Measure on the phone at the end of Phase 2 (recommended)
  ✅ Learns in week one whether the 1.5 s and 50 ms budgets hold, before screens depend on the load path
  ✅ Any fix is chosen from real numbers, not guessed now
  ❌ Needs the primary phone named and the app installed early, about half an hour each time
B) Measure only before release (as written)
  ✅ No extra step in the first week
  ❌ A slow catalog load or search shows up in the final phase, close to 1 December
Net: half an hour in week one versus a late performance surprise.
Header: Early timing
Options:
A) Measure early (recommended)
At the end of Phase 2, on the primary phone with the app installed, measure cold start to the home screen in airplane mode and search p95 over the full catalog, and record both in research.md. If either misses its budget, decide the fix then from the numbers. T111 still re-measures before release. A new task in Phase 2 says so. Effort: human ~1 h / CC ~10 min. Risk: none. Maintenance: none.
B) Measure at the end
Keep device timing only in T111 before release, as written. Effort: none now. Risk: late discovery. Maintenance: none.

State: approved
Actual answer: A) Measure early (recommended), D10 answer 2026-10-30
Accepted scope: a new Phase 2 task: at the end of Phase 2, on the primary phone with the app installed, measure cold start to the home screen in airplane mode and search p95 over the full catalog, record both in research.md, and decide any fix then from the numbers; T111 still re-measures before release
History: none

### Task numbering note

Records R1 to R11 cite task numbers as they stood when each question was asked. After D10, two
tasks were inserted (T010, the iPhone sign-in spike; T033, on-device timing), so tasks from the
old T010 to T031 moved up by one and tasks from the old T032 onward moved up by two. tasks.md
is renumbered with every cross-reference updated. After D12 moved the server and promotion
phases ahead of Cards and Tidy, tasks were renumbered again in their new order; R13 and R14
were corrected to that numbering before they were asked. Records asked earlier keep the ids
they were asked with.

### Outside voice (Claude subagent, native fallback; Codex sandbox unavailable)

Findings carried without a question, because each implements an approved decision or a
constitution rule, or corrects a fact (reviewer: outside voice; applied to tasks.md, the sync
contract and data-model.md):
- OV1 (High): D8 race. The sync loop claims a batch (`firstSentAt`) in the transaction that reads it; T016, T019. Necessary for D8's approved rule.
- OV5: `autoRefreshToken: false`, refresh only before syncing; T096. Implements ADR 0001's "token only when syncing".
- OV6: remap applied to pulled rows; T046, T047. Implements FR-038.
- OV7: rejected records stay in the unsynced count; T097, contract. Implements constitution II.
- OV8: a delete is a full-row upsert with `deletedAt`; T014, T016, contract, data-model. Needed by D7 and D8.
- OV9 (part): `tani.note` nulled on deletion; `nameKey` stored for candidate grouping; T095, T037, T103, data-model. Event grouping recorded as undefined, settled with T057.
- OV10: EXECUTE revoked from PUBLIC and anon; push rejects foreign ids; DuckDB read-only role; test wording fixed; T087, T092, T103, T115. Implements D5 and the constitution's privacy rule.
- OV12: Dexie strict durability on saves; T016. Implements FR-003.
- OV13 (part): restore opens logging after 10 s; T098. Implements constitution I.
- OV17: outbox indexed by `recordId`; T015, data-model. Needed by D4 and D8.
- OV19: stale plan text corrected (Constitution Check note on D9, "Remaining open items").
- OV4: D3's email fallback cost recorded on T010 as a contingency; no behavior change.
- OV16, OV18: handed to the design step (T101 → T030) and the security review (T109) as items to settle there.

### R16: Conflict check when a phone that took back writing rights pushes its queue
Finding: OV2, High, confidence 7/10, contracts/sync-api.md 409 row ("Make this the writing device again", from D6) against ADR 0003 ("whole-record last-write-wins can never lose a concurrent edit") and contracts/sync-api.md "Pull" (D4 "the local row is newer, because only this device writes"), reviewer: outside voice (Claude subagent).
Plan baseline: D6 approved: re-claim, then push queued ops, last write wins per record (D6 answer 2026-10-29).
Runtime evidence: none (no code). Scenario: the iPad becomes writer and edits Event E; the phone re-claims and pushes its older full copy of E, overwriting the iPad's edit; D4 had made the phone skip the iPad's newer row during pull.
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R16 conflict check on push | none: last write wins (D6) | each op carries `baseSeq`, the server `seq` the phone last saw for that record (0 if new); the server rejects an op with `conflict` when the record's current `seq` is newer; each ack returns the record's new `seq`, which becomes the base for that record's later ops, so a phone never conflicts with its own writes; conflicts appear in "needs attention" with "keep mine" (re-push with the new baseSeq) or "keep the server's" (drop the op and pull); required test in T088 | none; ADR 0003 records that re-claiming can overwrite edits made on the other device | none until a bounded check of how many records two devices touch in a session (max 1 h); remedy stays pending | none now; proposal stays open |
| R5 take back writer | approved D6 | unchanged | unchanged | unchanged | unchanged |
| R1 to R4, R6 to R11 | approved | unchanged | unchanged | unchanged | unchanged |
Question D11:
D11 — When a phone takes writing back, stop it from silently overwriting newer edits?
Project/branch/task: main, spec 001 plan, D6 (take back writer) and contracts/sync-api.md "Push".
ELI10: D6 lets a phone that lost writing rights take them back and send what it was holding. But if the other device (say the iPad) edited the same Event in the meantime, the phone's older copy overwrites the iPad's edit, and nobody is told. The fix: each change says which server version it was based on. If the server has a newer version, it refuses that one change, and the phone asks the rasika "keep mine or keep the other device's?".
Stakes if we pick wrong: An edit made on one device quietly disappears when the other device takes writing back.
Recommendation: A because it turns a silent overwrite into a visible choice, and it guards every push, not just re-claims.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: version check on every push (recommended)
  ✅ No edit is overwritten silently; a conflict becomes a visible keep-mine or keep-theirs choice
  ✅ Protects every push, including cases nobody has thought of yet
  ❌ One more field per op, one more server check and one conflict screen to build and test
B) Keep D6 as is and record the accepted loss in ADR 0003
  ✅ No new code; the rule stays "last write wins"
  ❌ Edits made on the other device can vanish when writing is taken back, with no sign
C) Investigate first (up to 1 hour)
  ✅ Checks how often two devices would really touch the same record before adding code
  ❌ There's no season data yet to measure, so the answer is a guess; the risk stays open meanwhile
D) Defer this change only
  ✅ Keeps the current build scope; can be added before the server work starts
  ❌ The silent overwrite stays in the plan until someone comes back to it
Net: one version field and a conflict screen versus silent overwrites on re-claim.
Header: Push conflicts
Options:
A) Apply version check (recommended)
Each pushed op carries baseSeq, the server seq the phone last saw for that record (0 for a new one). The server rejects an op with code conflict when the record's current seq is newer. Each ack returns the record's new seq, which becomes the base for that record's later ops, so the phone never conflicts with its own writes. The phone lists conflicts under "needs attention" with "keep mine" (re-push with the new baseSeq) and "keep the server's" (drop the op and pull). Contract, T014, T092, T097 and data-model say so; the required test T088 adds an iPad-edit-then-phone-reclaim case. Effort: human ~4 h / CC ~30 min. Risk: low. Maintenance: one check and one screen.
B) Keep last write wins
Keep D6 as approved; ADR 0003 records that re-claiming can overwrite edits made on the other device. Effort: ~10 min. Risk: silent overwrite in a rare case. Maintenance: none.
C) Investigate first
Spend at most 1 hour estimating how often two devices edit the same record; no code changes; the remedy stays pending. Effort: ~1 h. Risk: open meanwhile. Maintenance: none.
D) Defer this change
Leave the proposal open; nothing changes now. Effort: none. Risk: stays open. Maintenance: none.

State: approved
Actual answer: A) Apply version check (recommended), D11 answer 2026-10-30
Accepted scope: each op carries baseSeq (0 if new); server rejects with conflict when the record's seq is newer; acks return the new seq, the base for that record's later ops; conflicts in "needs attention" with keep mine (re-push with new baseSeq) or keep the server's (drop and pull); contract, T014, T092, T097, data-model; required test T088 adds the iPad-edit-then-phone-reclaim case
History: payload revised before asking: added that acks return the new seq, so a phone's own consecutive writes never conflict

### R12: When the server is built relative to Cards and Tidy
Finding: OV3, High, confidence 7/10, tasks.md "Implementation Strategy" (server phases 9 and 10 after Plan, Lecdem, Cards and Tidy) and ADR 0001 consequence "The server is built last", against the spec's 1 December open sign-up (Clarifications 2026-10-28) and FR-031 (Cards due 20 December), reviewer: outside voice (Claude subagent).
Plan baseline: the Maintainer asked for the server to be "the last thing we do" and free until deploy (2026-10-29); tasks.md orders Phases 5 to 8 (Plan, Lecdem, Cards, Tidy) before Phases 9 and 10 (server, promotion).
Runtime evidence: none (no code). Local Supabase costs nothing (ADR 0001), so building the server earlier does not end "free until deploy"; only deploying does.
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R12 build order | 1-4, Plan, Lecdem, Cards, Tidy, server, promotion, deploy | 1-4, Plan, Lecdem, server (Phase 9), promotion (Phase 10), Cards, Tidy, deploy last; everything stays free until deploy; tasks.md phases reordered (task ids follow) | as now: server built last | bounded estimate (max 1 h) of the November calendar per phase; order unchanged meanwhile | proposal open; order unchanged |
| R1 to R11, R16 | approved | unchanged | unchanged | unchanged | unchanged |
Question D12:
D12 — Build the server before the Cards and Tidy, while still deploying it last?
Project/branch/task: main, spec 001 plan, tasks.md build order and ADR 0001 ("server built last").
ELI10: You asked for the server to be the last thing we do, so it stays free until deploy. But building it costs nothing either: it runs on this machine until deploy. The deadlines point the other way. Sign-up for everyone opens on 1 December and needs the server, while the Cards aren't due until 20 December. As planned, sign-in, sync, privacy rules and consent, the riskiest parts, land in the last week of November. Building the server right after Plan and Lecdem, then Cards and Tidy, keeps it free and gives the risky parts more time.
Stakes if we pick wrong: If the server slips, 1 December sign-up slips or ships under-tested, while Cards that could wait got built first.
Recommendation: A because it matches the work to the deadlines, and the server still costs nothing until deploy.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: server before Cards and Tidy (recommended)
  ✅ Sign-in, sync and privacy get tested weeks earlier, before 1 December
  ✅ Still free: the server runs locally until deploy, which stays last
  ❌ Cards start later, closer to their 20 December date
B) Keep the server last
  ✅ Matches what you asked for; phone features first, server at the end
  ❌ The riskiest work and the 1 December deadline meet in the last week of November
C) Investigate first (up to 1 hour)
  ✅ A rough calendar per phase shows whether the current order fits November
  ❌ Estimates without code are rough; the decision waits meanwhile
D) Defer this change only
  ✅ No reshuffle now; revisit after Phase 4
  ❌ The order stays as is until someone revisits it
Net: Cards a little later versus sign-in and sync squeezed against 1 December.
Header: Build order
Options:
A) Server before Cards (recommended)
Reorder tasks.md to: Setup, Foundational, US1, US2 part 1, Plan (US3), Lecdem (US4), server and restore (US2 part 2), promotion (US7), Cards (US5), Tidy (US6), Polish. Deploy (Supabase Pro, static host) stays last, so everything stays free until then. ADR 0001's consequence becomes "built locally after the phone stories, deployed last". Effort: human ~30 min / CC ~5 min to reorder. Risk: Cards later. Maintenance: none.
B) Keep server last
Keep the current order: Cards and Tidy before the server. Effort: none. Risk: deadline squeeze in late November. Maintenance: none.
C) Investigate first
Spend at most 1 hour estimating each phase against the November calendar; the order stays unchanged meanwhile. Effort: ~1 h. Risk: none. Maintenance: none.
D) Defer this change
Leave the proposal open; order unchanged. Effort: none. Risk: unchanged. Maintenance: none.

State: approved
Actual answer: A) Server before Cards (recommended), D12 answer 2026-10-30
Accepted scope: tasks.md reordered to Setup, Foundational, US1, US2 part 1, US3, US4, US2 part 2 (Phase 7), US7 (Phase 8), US5 (Phase 9), US6 (Phase 10), Polish; deploy stays last and everything stays free until then; ADR 0001 consequence, plan.md build order and research.md timing updated; task ids renumbered
History: none

### R13: Whether promotion (Phase 8) must be ready on 1 December
Finding: OV15, Medium, confidence 6/10, tasks.md Phase 8 checkpoint ("sign-up with promotion is ready for 1 December") and spec Clarifications 2026-10-28 ("open to everyone on 1 December alongside logging, including consent and the Maintainer's review and promotion"), reviewer: outside voice (Claude subagent).
Plan baseline: candidate "Promotion: Maintainer review screen, create shared entries, promote, Links (Phase 8, T084 to T087 after D12 renumbering)"; current disposition: included for 1 December, per the spec clarification.
Runtime evidence: none (no code). Candidates exist only after consenting rasikas log hand-typed entries; the consent questions themselves are in Phase 7 (T081, T082). Event promotion also depends on the schedule feed, not yet agreed (T057).
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R13 promotion by 1 December | included for 1 December | Include: stays required for 1 December | Defer: consent capture stays in Phase 7 for 1 December; the review screen, shared-entry creation, promote and Links (Phase 8) ship by 15 December; spec clarification amended | Cut: no promotion this season; spec P7 and FR-043 to FR-045 removed | Hold: stop and discuss; disposition unchanged |
| R12 build order | approved D12 | unchanged | unchanged | unchanged | unchanged |
| other choices | approved | unchanged | unchanged | unchanged | unchanged |
Question D13:
D13 — Does Maintainer promotion need to be ready on 1 December, or can it follow mid-December?
Project/branch/task: main, spec 001 plan, Phase 8 (promotion) and the spec's 1 December sign-up clarification.
ELI10: Promotion is how you turn names that several rasikas typed by hand, like "Anirudh Athreya", into a shared entry everyone gets. It needs hand-typed entries to exist first, and those only appear once people start logging. What must exist on day one is the consent question ("share what you type with the Maintainer?"), which is already in the sign-up phase. The review screen and the promote button could follow by mid-December with nothing lost, because consented entries wait until then.
Stakes if we pick wrong: Keeping promotion on the 1 December path adds four tasks to the tightest week; deferring means the first weeks of the season run without promotions.
Recommendation: B because day one only needs consent; promotion has nothing to work on until people have logged.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Include: required for 1 December
  ✅ Promotion works from the first day, as the spec says today
  ❌ Four more tasks in the last week before launch, for a feature with no data yet
B) Defer to 15 December (recommended)
  ✅ Frees the week before launch for sign-in, sync and privacy
  ✅ Consent is captured from day one, so no shared entry is lost; they wait for review
  ❌ For the first two weeks, rasikas don't get shared names others typed; the spec clarification changes
C) Cut for this season
  ✅ Removes the whole promotion feature and its privacy surface
  ❌ Gaps in the starting lists stay as typing for everyone all season
D) Hold
  ✅ Stops to talk it through before deciding
  ❌ The disposition stays open meanwhile
Net: launch-week focus versus promotions in the first two weeks.
Header: Promotion date
Options:
A) Include for 1 Dec
Keep promotion (Phase 8: review screen, shared entries, promote, Links) required for 1 December, as the spec says. Effort: as planned. Risk: crowded launch week. Maintenance: none.
B) Defer to 15 Dec (recommended)
Consent capture stays in Phase 7 for 1 December. The review screen, shared-entry creation, promote and Links (Phase 8) ship by 15 December. The spec's 1 December clarification and the Phase 8 checkpoint are amended to say so. Effort: human ~15 min / CC ~3 min. Risk: two weeks without promotions. Maintenance: none.
C) Cut this season
Remove promotion: spec story P7 and FR-043 to FR-045, Phase 8 tasks and the candidates view. Consent for sharing is no longer needed either. Effort: human ~1 h / CC ~10 min. Risk: typing gaps all season. Maintenance: less.
D) Hold to discuss
Stop here and talk it through; promotion stays included for 1 December until decided. Effort: none. Risk: none. Maintenance: none.

State: approved
Actual answer: B) Defer to 15 Dec (recommended), D13 answer 2026-10-30
Accepted scope: consent capture stays in Phase 7 for 1 December; review screen, shared-entry creation, promote and Links (Phase 8) ship by 15 December; spec clarification, SC-016 and the Phase 8 checkpoint amended; tasks.md deadline text updated
History: payload corrected before asking: task ids updated to the D12 numbering (consent T081 and T082; promotion T084 to T087)

### R14: Refusing sync from app versions the server no longer understands
Finding: OV14, Medium, confidence 6/10, contracts/sync-api.md (no version field in any request) with tasks.md T028 (service worker "prompt-to-update with no silent `skipWaiting`") (old clients can keep running indefinitely), reviewer: outside voice (Claude subagent).
Plan baseline: no app-version check; the contract has no protocol version; clients update only when the rasika accepts the prompt.
Runtime evidence: none (no code). D7, D8 and D11 already changed the push shape in this review; a later change would meet phones still running an older build.
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R14 version check | none | every sync request carries the app's version; the server keeps a minimum version and answers `426 update_required` below it; the phone keeps logging and its outbox, and shows a non-blocking "update the app to keep syncing" prompt; in place before the first public deploy; test in T069 | none | bounded check (max 30 min) of how Supabase functions read a version header; remedy pending | proposal open; none now |
| other choices | approved | unchanged | unchanged | unchanged | unchanged |
Question D14:
D14 — Add an app-version check so old app versions can't send changes in an outdated format?
Project/branch/task: main, spec 001 plan, contracts/sync-api.md and the service worker's update prompt.
ELI10: The app updates only when the rasika taps "update", so some phones will run an older version for weeks. If we change how changes are sent (this review already did three times), an old phone could send changes the server misreads. A small fix: every sync says which app version it is; if the version is too old, the server says "update required". The phone keeps logging and keeps everything queued, and asks the rasika to update.
Stakes if we pick wrong: After a sync format change mid-season, old phones could send records the server stores wrongly, or have them rejected, without understanding why.
Recommendation: A because it is a few lines now and the only safe way to change the sync format after launch.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: version check before first deploy (recommended)
  ✅ The sync format can change after launch without old phones corrupting or losing data
  ✅ Old phones keep logging and keep their queue; they only stop sending until updated
  ❌ One header, one server check and one prompt to build and test
B) Keep: no version check
  ✅ Nothing extra to build before launch
  ❌ Any later change to the sync format risks old phones sending data the server misreads
C) Investigate first (up to 30 minutes)
  ✅ Confirms how a Supabase function reads a version header before committing
  ❌ The remedy stays pending; it's a small, standard pattern either way
D) Defer this change only
  ✅ Nothing now; can be added before the first deploy
  ❌ Easy to forget until the first format change after launch
Net: a header and a prompt versus unsafe sync format changes after launch.
Header: Version check
Options:
A) Apply version check (recommended)
Every sync request carries the app's version. The server keeps a minimum supported version and answers 426 update_required below it. The phone keeps logging and its outbox, and shows a non-blocking "Update the app to keep syncing" prompt. In place before the first public deploy. Contract, T014, T073, T078 say so; the required sync-client test T069 adds the 426 case (outbox kept). Effort: human ~1.5 h / CC ~15 min. Risk: low. Maintenance: raise the minimum when the format changes.
B) No version check
Keep the contract without a version; nothing changes. Effort: none. Risk: unsafe format changes after launch. Maintenance: none.
C) Investigate first
Spend at most 30 minutes on how Supabase functions read a request header; the remedy stays pending. Effort: ~30 min. Risk: none. Maintenance: none.
D) Defer this change
Leave the proposal open; nothing changes now. Effort: none. Risk: unchanged. Maintenance: none.

State: approved
Actual answer: A) Apply version check (recommended), D14 answer 2026-10-30
Accepted scope: every sync request carries the app version; server keeps a minimum and answers 426 update_required below it; phone keeps logging and its outbox and shows a non-blocking update prompt; before the first public deploy; contract, T014, T073, T078; required test T069 adds the 426 case
History: payload corrected before asking: task ids updated to the D12 numbering (service worker T028, sync-client test T069)

### R15: First launch in a phone browser tab instead of the installed app
Finding: OV11, Medium, confidence 6/10, spec Assumptions ("the app is used installed on the home screen") with FR-050 (sign-in at first launch) and research.md "Platform facts" (installed apps are exempt from eviction), reviewer: outside voice (Claude subagent).
Plan baseline: the app is assumed to be used installed; nothing in the tasks detects or handles a first launch in a browser tab.
Runtime evidence: none (no code). On iOS, Safari and an installed home-screen app keep separate storage; a rasika who signs in and logs in a Safari tab, then installs, starts the installed app empty and must sign in again; tab storage can be cleared after 7 days without use [WebKit policy as summarised in research.md; not probed].
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R15 first launch in a phone browser tab | not handled | on a phone, when not running as an installed app, first launch shows install steps ("Add to Home Screen" on iPhone, the install prompt on Android) instead of sign-in; sign-in, consent and logging start in the installed app; desktop browsers are unaffected; covered in the design step (T030) and T081 | not handled | bounded check (max 1 h) on the primary iPhone of what a tab-to-installed move does to storage; remedy pending | proposal open; not handled |
| other choices | approved | unchanged | unchanged | unchanged | unchanged |
Question D15:
D15 — On a phone, send people to install the app before they sign in and log?
Project/branch/task: main, spec 001 plan, FR-050 (sign-in at first launch) and the spec's "used installed" assumption.
ELI10: On an iPhone, the app in a Safari tab and the app added to the Home Screen keep separate data. Someone who signs in and logs a concert in a Safari tab, then adds it to the Home Screen, opens an empty app and has to sign in again. Safari can also clear a tab's data after a week without use. Since the plan assumes the app is installed anyway, the first screen on a phone browser can show how to install it, and sign-in and logging start only in the installed app.
Stakes if we pick wrong: Rasikas log their first concerts in a tab, lose them to a cleanup or find them missing after installing, and sign in twice.
Recommendation: A because it makes the plan's "used installed" assumption true, before any data can land in the wrong place.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: install first on phones (recommended)
  ✅ No season data ever lives in a tab that Safari may clear or that the installed app can't see
  ✅ One sign-in, in the place it will be used, and installed apps are the ones exempt from eviction
  ❌ One more step before first use, and some people may give up at the install instructions
B) Keep: allow use in a tab
  ✅ Fastest first use: open the link and start
  ❌ Tab data is separate from the installed app and can be cleared, so early logs can go missing
C) Investigate first (up to 1 hour)
  ✅ Checks on your iPhone what really happens to tab data when you install
  ❌ The answer may differ across iOS versions; the remedy stays pending meanwhile
D) Defer this change only
  ✅ Nothing now; can be added in the design step
  ❌ The gap stays until someone comes back to it
Net: one install step versus early logs stranded in a browser tab.
Header: Install first
Options:
A) Install first (recommended)
On a phone, when the app isn't running as an installed app, first launch shows install steps ("Add to Home Screen" on iPhone, the browser's install prompt on Android) instead of sign-in. Sign-in, consent and logging start only in the installed app. Desktop browsers are unaffected. The design step (T030) and the sign-up task T081 say so. Effort: human ~2 h / CC ~15 min. Risk: some drop-off at install. Maintenance: none.
B) Allow use in a tab
Nothing changes; a phone browser tab can sign in and log like the installed app. Effort: none. Risk: early logs stranded in a tab. Maintenance: none.
C) Investigate first
Spend at most 1 hour on the primary iPhone checking what moving from a tab to the installed app does to data and sign-in; the remedy stays pending. Effort: ~1 h. Risk: none. Maintenance: none.
D) Defer this change
Leave the proposal open; nothing changes now. Effort: none. Risk: unchanged. Maintenance: none.

State: approved
Actual answer: Other (user's own words, 2026-10-30): "nudge them, but they'd also continue to be able to use this on their regular browser flow"
Accepted scope: a phone browser tab works fully (sign-in, consent, logging); while not running as an installed app on a phone, every screen shows a persistent banner suggesting Add to Home Screen, with the iPhone and Android steps; desktop browsers show no banner; moving from a tab to the installed app means signing in again, after which restore brings the season back; T052, spec Assumptions and Edge Cases, quickstart scenario 17
History: D15 answer 2026-10-30 was D) Defer, leaving the row unresolved; reopened by the user the same day after an explanation of what installing means, and answered with option "nudge, don't require" offered in chat

### TODO-1: What happens to the paid Supabase plan after the season
Finding: OV20, Low, confidence 7/10, ADR 0001 consequence "the season's database moves to Pro (from $25/month ...)" with no end date, reviewer: outside voice (Claude subagent).
Plan baseline: Pro from deploy onward; no plan for the months after January.
Runtime evidence: Pro is from $25/month (supabase.com/pricing, checked 2026-10-29); the app is idle about ten months a year.
Comparison grid:
| Choice | Current | A | B | C |
|---|---|---|---|---|
| TODO-1 post-season plan | none | add to TODOS.md: after the season report, decide downgrade, pause or keep, with a full export first | skip | build now: add a post-season task to tasks.md |
Question D16:
D16 — Add a TODO to decide what to do with the paid Supabase plan after the season?
Project/branch/task: main, spec 001 plan, ADR 0001 (Supabase Pro from deploy).
ELI10: Supabase Pro costs about $25 a month, roughly $300 a year, for an app used mostly in December and January. Nothing in the plan says what happens in February. Options then include keeping it, exporting everything and moving to the free tier (which pauses when idle), or pausing the project. It doesn't need deciding now, but it should be written down so it isn't forgotten.
Stakes if we pick wrong: About $250 a year spent on an idle database, or a downgrade done in a hurry that loses the season.
Recommendation: A because it's a real decision for February, and a TODO keeps it from being forgotten without adding work now.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Add to TODOS.md (recommended)
  ✅ The February decision is written down with its context, including "export first"
  ✅ No work now; nothing in the build changes
  ❌ One more item in a new TODOS.md file
B) Skip
  ✅ Nothing to track
  ❌ The bill keeps running after the season until someone notices
C) Build it now
  ✅ A task in tasks.md makes it part of the season plan
  ❌ Adds post-season work to a build plan that ends at launch
Net: a written reminder versus an unnoticed bill.
Header: Post-season
Options:
A) Add to TODOS.md (recommended)
Create TODOS.md with: after the season report, decide whether to keep Pro, export everything and move to the free tier, or pause the project; always take a full export first. Effort: S. Priority: P3. Depends on: the end-of-season report.
B) Skip
No TODO; nothing recorded. Effort: none.
C) Build it now
Add a post-season task to tasks.md Phase 11 with the same content. Effort: S.

State: approved
Actual answer: A) Add to TODOS.md (recommended), D16 answer 2026-10-30
Accepted scope: TODOS.md created with the post-season Supabase plan item (P3, S, depends on the end-of-season report)
History: none

### TODO-2: Merging duplicate Events in Tidy
Finding: OV13 (part), Medium, confidence 6/10, FR-036 (merge covers "duplicate Artists or Sabhas" only) with FR-018 (an emptied phone with no signal still logs, then restores), reviewer: outside voice (Claude subagent).
Plan baseline: Tidy (Phase 10) merges Artists and Sabhas; Events cannot be merged.
Runtime evidence: none (no code). Scenario: storage is cleared, the rasika logs a planned Concert offline on the empty phone (a new Event), then restore brings back the original Planned Event, so the Plan shows a phantom upcoming Event and the Wrapped may count Appearances twice. Rare: it needs storage cleared plus no signal at the hall.
Comparison grid:
| Choice | Current | A | B | C |
|---|---|---|---|---|
| TODO-2 merge Events | not possible | add to TODOS.md: Tidy can merge two Events (keep one, move Appearances and Items, tombstone the other) | skip; the rasika deletes the phantom Event by hand | build now: a merge-Events task in Phase 10 |
Question D17:
D17 — Add a TODO for merging duplicate Events in Tidy?
Project/branch/task: main, spec 001 plan, FR-036 (merge) and FR-018 (logging on an emptied phone).
ELI10: If a phone's storage is wiped and you log a planned concert before signal returns, the app creates a new Event. When restore brings back your season, the original planned Event comes back too, so you have two. Tidy can merge duplicate artists and sabhas, but not Events. You can always delete the extra one by hand; a merge would also move its items across.
Stakes if we pick wrong: In this rare case, a phantom upcoming Event lingers and counts can double until the rasika deletes it.
Recommendation: A because it is rare and has a manual workaround, so it belongs on the list, not in this build.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Add to TODOS.md (recommended)
  ✅ Captured with the scenario, ready if real seasons show it happening
  ✅ No added scope before 1 December
  ❌ Until built, the rasika fixes duplicates by deleting one by hand
B) Skip
  ✅ Nothing to track; deleting by hand covers the rare case
  ❌ The scenario is forgotten and may surprise someone later
C) Build it now
  ✅ Tidy handles every kind of duplicate this season
  ❌ More Tidy scope for a rare case, in a phase that already follows the deadline work
Net: a tracked rare case versus more Tidy scope now.
Header: Merge Events
Options:
A) Add to TODOS.md (recommended)
Add a TODOS.md item: Tidy can merge two Events (keep one, move its Appearances and Items, tombstone the other), with the emptied-phone scenario as context. Effort: M. Priority: P3. Depends on: Tidy (Phase 10).
B) Skip
No TODO; duplicates are deleted by hand. Effort: none.
C) Build it now
Add a merge-Events task to Phase 10 (Tidy), with a test. Effort: M.

State: approved
Actual answer: A) Add to TODOS.md (recommended), D17 answer 2026-10-30
Accepted scope: TODOS.md item for merging duplicate Events in Tidy (P3, M, depends on Phase 10)
History: none

Approval readiness: PASS. Accepted remedies and their answers: R1 (D2), R2 (D3), R3 (D4), R4
(D5), R5 (D6), R10 (D7), R6 (follows D7), R7 (contract alignment, no behavior change), R8 (D8),
R9 (D10), R16 (D11), R12 (D12), R13 (D13), R14 (D14), TODO-1 (D16), TODO-2 (D17), and the
outside-voice items carried under approved decisions (listed above). Not accepted: R11 (D9,
kept as written). R15 (D15, nudge banner) answered after first being deferred.

## Eng review output (2026-10-30)

### NOT in scope
- Save-failure behavior (R11): left unspecified by choice (D9); recorded as a retained risk.
- Requiring install on phones (R15): not required; a banner nudges instead (D15).
- JWT lifetime and refresh-token reuse interval tuning (OV5 remainder): defaults kept; revisit only if in-hall "sign in again" prompts show up in testing.
- Grouping of hand-typed Events into promotion candidates (OV9 remainder): settled with the schedule feed (T057).
- Merging duplicate Events (TODO-2) and the post-season Supabase plan (TODO-1): in TODOS.md.
- The State of Margazhi report itself: after the season; T115 only provides its private view.

### What already exists
- Built-ins reused instead of rebuilt: `crypto.randomUUID()` (D2); Supabase Auth sessions, revocation and row-level security (ADR 0001); Dexie transactions and live queries (ADR 0002); vite-plugin-pwa precache and update flow; uFuzzy search.
- Logger pipeline reused for the catalog: `load.ts`, `resolve.ts` and the canonical JSON maps, with only a new exporter (T020, T021).
- No shared-code extraction was proposed: nothing exists yet to share.

### Diagrams

```
SAVE (phone, offline)                         SYNC (phone, when online)
UI ─► mutate.save(row)                        trigger: start | online | visible | after save
       │ one Dexie tx, strict durability            │ (single flight)
       ├─ write record                              ▼
       └─ outbox: replace never-sent entry   PUSH: claim batch (set firstSentAt) in one tx
          for this record, else append  (D8)      │  send {opId, table, baseSeq, row} + appVersion
                                                  ▼
                                            server, per-rasika lock:
                                              426 old app | 409 not writer | foreign id → reject
                                              baseSeq ≠ seq → reject conflict (D11)
                                              opId seen → ack again; else upsert data jsonb, new seq
                                                  │ acks {opId, seq} → drop entries, update baseSeq
                                                  ▼
                                            PULL by cursor (own seq, list version)
                                              skip rows with pending ops (D4)
                                              remap catalog keys (OV6), apply page in one tx
```

```
FIRST LAUNCH                                    WRITER
install → sign in (method from T010 spike)      device signs in → claims writer
        → two consent questions (FR-050)        old device push → 409 → "make this the
        → claim writer → restore (push, then             writing device again" → claim → push
          pull; logging opens after 10 s)                (conflicts listed, D11)
```

### Failure modes

| New path | Realistic failure | Test or handling | Rasika sees |
|---|---|---|---|
| Save | IndexedDB write fails (quota, lost connection) | none (D9 kept it unspecified) | unspecified: **critical gap**, possibly silent |
| Push batch | reply lost after the server stored it | opId dedup (T068), claimed entries never changed (T019) | nothing; retried quietly |
| Pull | page arrives during an edit | skip rows with pending ops (T069) | edit kept |
| Re-claim | other device edited the same record | `conflict` + needs attention (T069) | keep mine or keep the server's |
| Restore | weak signal during restore | 10 s timeout, continues in background (T079) | logging opens; season fills in |
| Old app | sync format changed after launch | `426 update_required` (T069) | non-blocking "update the app" |
| Sign-in on iPhone | redirect never returns to the installed app | Phase 1 spike (T010) | known before Phase 3 |
| Views | a view lands in the exposed schema | private schema + privacy test (T068) | nothing leaks |

Critical gaps: 1 (save failure, accepted by D9).

### Worktree parallelization strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Catalog export | logger repo `pipeline/karnatik/` | — |
| Phone foundation | `app/src/model/`, `app/src/store/` | — |
| Search and catalog | `app/src/catalog/`, `tools/golden-set/` | catalog export (fixtures meanwhile) |
| Screens | `app/src/screens/` | phone foundation |
| Server | `supabase/` | phone foundation (`app/src/model/`) |
| Cards | `app/src/wrapped/` | phone foundation |

- Lane A: catalog export → search and catalog (logger repo, `app/src/catalog/`).
- Lane B: phone foundation → screens (`app/src/store/`, `app/src/screens/`).
- Lane C: server (`supabase/`), once `app/src/model/` is stable.
- Execution order: launch A and B together; merge both; then C alongside the screens; Cards after C, per D12.
- Conflict flags: `app/src/model/` is shared by B and C, so freeze its shapes before C starts; `app/src/store/sync.ts` (B) and the push and pull functions (C) must change together.

### Implementation Tasks
Synthesized from this review's findings. The changes are already written into tasks.md; this
list points at them.

- [ ] **T1 (P1, human: ~1 day / CC: ~1 h)** — sign-in — Spike Google sign-in on the installed iPhone
  - Surfaced by: Architecture — R2 (D3)
  - Files: research.md; tasks.md T010
  - Verify: the result is recorded in research.md before Phase 3
- [ ] **T2 (P1, human: ~3 h / CC: ~20 min)** — store/sync — Outbox rules: never-sent replacement, batch claim, pull skip, strict durability
  - Surfaced by: Architecture R3 (D4), Code quality R8 (D8), outside voice OV1, OV12
  - Files: `app/src/store/mutate.ts`, `app/src/store/sync.ts` (T016, T078)
  - Verify: T019 and T069 pass
- [ ] **T3 (P1, human: ~3 h / CC: ~20 min)** — supabase — Private views, revoked EXECUTE, foreign-id rejection
  - Surfaced by: Architecture R4 (D5), outside voice OV10
  - Files: `supabase/migrations/` (T073, T084, T115)
  - Verify: T068 passes as an ordinary and an anonymous caller
- [ ] **T4 (P1, human: ~4 h / CC: ~30 min)** — sync — Version check on push (baseSeq) and conflict screen
  - Surfaced by: outside voice OV2 (D11)
  - Files: `app/src/store/sync.ts`, `supabase/migrations/0004_sync.sql` (T073, T078)
  - Verify: the iPad-edit-then-reclaim case in T069
- [ ] **T5 (P1, human: ~2 h / CC: ~15 min)** — server rows — One `data` jsonb column, generic push and pull, deletes as upserts
  - Surfaced by: Architecture R10 (D7), outside voice OV8
  - Files: `supabase/migrations/0002_season.sql` (T071, T073, T074)
  - Verify: T068 round-trips
- [ ] **T6 (P2, human: ~1.5 h / CC: ~15 min)** — sync — App version header and 426 handling
  - Surfaced by: outside voice OV14 (D14)
  - Files: contract, T014, T073, T078
  - Verify: the 426 case in T069
- [ ] **T7 (P2, human: ~1.5 h / CC: ~15 min)** — writer — "Make this the writing device again"
  - Surfaced by: Architecture R5 (D6)
  - Files: T083, T069
  - Verify: queued ops reach the server after re-claim
- [ ] **T8 (P2, human: ~1 h / CC: ~10 min)** — performance — On-device timing at the end of Phase 2
  - Surfaced by: Performance R9 (D10)
  - Files: research.md (T033)
  - Verify: cold start and search p95 recorded
- [ ] **T9 (P2, human: ~1 h / CC: ~10 min)** — catalog — Remap pulled rows
  - Surfaced by: outside voice OV6
  - Files: `app/src/catalog/upgrade.ts` (T046)
  - Verify: the pulled-row case in T047

### Unresolved decisions that may bite you later
- None. R15 was deferred at first, then answered (D15: nudge, don't require).

### Completion summary
- Step 0: Scope Challenge: scope accepted as-is (D1 folded `shared/` into `app/src/model/`, same scope)
- Reality rows: 7/7 applicable rows emitted (PLAN_REALITY complete), 3 unverified premises
- Architecture Review: 7 issues found
- Code Quality Review: 2 issues found
- Test Review: diagram produced, 3 gaps identified (1 closed, 2 left by D9)
- Performance Review: 1 issue found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 2 items proposed to user (both added)
- Failure modes: 1 critical gap flagged (save failure, D9)
- Unresolved decisions: 0 in this review
- Outside voice: Codex unavailable (sandbox could not start); native Claude subagent fallback completed with 20 findings
- Parallelization: 3 lanes, 2 parallel / 1 sequential
- Lake Score: 2/7

### Suppressed findings
- None below confidence 5.

## Design review output (plan-design-review, 2026-10-30)


**NOT in scope:** the deferred findings in [plan.md](plan.md) ("Deferred design findings") (by the Maintainer's choice); mockups (the gstack
designer needs an OpenAI API key, which isn't set).

**What already exists:** no DESIGN.md and no UI code. The design doc fixes the 12-colour swatch
palette, the "season fabric" cover and story-sized Cards; last season's sheet charts are the
reference for Cards; T031 sets the mobile base rules (16px inputs, dvh, safe areas).

**Implementation Tasks** (the approved decisions are already written into tasks.md):
- [ ] **T1 (P1, human: ~1 day / CC: ~1 h)** — design — Run `/design-consultation` with DD1 to DD7 and the 16 deferred findings as its brief, then `/plan-design-review` on DESIGN.md
  - Surfaced by: all passes; Files: DESIGN.md (T030); Verify: design review re-run before T040 to T044
- [ ] **T2 (P1, human: ~30 min / CC: ~5 min)** — store — Build "Start logging" as the only way a planned Event becomes Attended (DD7)
  - Surfaced by: deferred finding 1; Files: `app/src/store/plan.ts` (T055), `app/src/screens/PlanScreen.tsx` (T056); Verify: viewing or editing a planned Event leaves it Planned

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | no DESIGN.md; UI scope about 10 screens     |
  | Step 0               | 3/10; all 7 dimensions                      |
  | Pass 1  (Info Arch)  | 2/10 → 6/10 after fixes                    |
  | Pass 2  (States)     | 2/10 → 2/10 after fixes (deferred)         |
  | Pass 3  (Journey)    | 3/10 → 3/10 after fixes (deferred)         |
  | Pass 4  (AI Slop)    | 4/10 → 4/10 after fixes (deferred)         |
  | Pass 5  (Design Sys) | 1/10 → 1/10 after fixes (deferred)         |
  | Pass 6  (Responsive) | 2/10 → 2/10 after fixes (deferred)         |
  | Pass 7  (Decisions)  | 6 resolved, 16 deferred                    |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (2 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed (deferred work is in T030) |
  | Approved Mockups     | 0 generated, 0 approved (no API key)        |
  | Decisions made       | 6 added to plan                             |
  | Decisions deferred   | 16 (listed above), plus D6 direction-only   |
  | Overall design score | 1/10 → 1/10                                 |
  +====================================================================+
```

Pass 4 classifies the app screens as OPERATE (app UI) and the Cards as share artifacts; no hard
rejection is triggered, but nothing visual is specified yet. The overall score stays at the lowest
pass (design system, 1/10) until DESIGN.md exists.

## Design review output (plan-design-review, 2026-11-01)

Reviewed `DESIGN.md` with the design sections of `plan.md`, scoped by the Maintainer (D1) to the
logging screens needed by 1 December: Season home, Event, Item editor, Detail input, the Artist
and Sabha pickers, the Colour sheet and first launch. Cards, sync conflict, restore and the
Lecdem variant are left to the phases that build them. Every decision below was asked and
answered one at a time and is written into `DESIGN.md`.

**Mockups:** none. The gstack designer has no image API key on this machine, so the review ran
text-only. The approved preview of the Event screen and Item editor (2026-11-01) stood as the
visual reference.

**Outside voices:** Codex (gpt-6-astra, completed) and an independent Claude subagent both
ran. Litmus: both said NO to "brand unmistakable on the first screen" and "cards necessary",
and YES to the other five checks. No hard rejection was triggered, and both named the risk of
lists built as card stacks (settled by D18). Both flagged the eng review's D9 as the most
serious gap (settled by D15).

### Decisions

| # | Decision | Answer |
|---|---|---|
| D3 | Which Event is Now when two qualify | The one being logged; otherwise the nearest start, with the other as a smaller line |
| D4 | The Event screen's bottom bar | "Start logging" or "Add Item" by state; "Done with this Concert" is a row after the last Item |
| D5 | Top bars of pushed screens | Back chevron left and "⋯" right (the Dynamic Island takes the centre); the concert shown large as the first block |
| D6 | Where reordering starts | A muted "Edit order" on the Running order heading |
| D7 | Fixed rows in the Item search | As in the preview: pinned at the top of the stack, the best match by the box |
| D8 | "Log a Concert now" | Opens the Event at once, ready to log; "Add Sabha" and "Add Artist" filled in any time |
| D9 | The product's name in the app | Deferred: the Maintainer is considering other names; a logo will appear somewhere |
| D10 | First launch | One step per screen: Welcome, Google, Consent 1, Consent 2, Getting ready (with progress), home |
| D11 | Empty home | The Now block alone; empty sections are hidden |
| D12 | When an Item exists | From its first pick; typed text survives the phone locking |
| D13 | Search states | Fixed rows only before typing; one-line notes for no match and no catalog |
| D14 | Status messages | A count line on home; an action line under the top bar only when something needs the rasika |
| D15 | Save failure (reopens the eng review's D9) | Highlight only after a successful write; a persistent "Not saved on this phone" with Try again and Export |
| D16 | Undo bar | Above the bottom action; pauses on focus; earlier deletes recoverable until leaving the Event |
| D17 | "Done with this Concert" | Optional; Now follows logging activity (an Item in the last 60 minutes); the summary also shows on the Concert |
| D18 | Lists | Rows on the background with hairlines; fills only for the Now block, the best match and sheets |
| D19 | Browser surfaces | Caret, selection, focus ring and scrollbars themed from the palette |
| D20 | Outfit swatches | The drafted 12 values, retuned with the Cards |
| D21 | Dark-theme text | Softened to lightness 0.88 and 0.72 for the hall |
| D22 | Dark-theme primary | Warm 0.88 fill, matching the softened text |
| D23 | Larger text and narrow phones | Follow the phone's text size to 200%; reflow; check at 320px |
| D24 | Focus | Five rules: focus on open, sheets return focus, one result announcement, rich Detail names, real roles |
| D25 | Detail input | One sheet: scoped docked search with "?", "Not sure" and "N/A" chips |
| D26 | Artist and Sabha pickers | Docked search, recent first, an explicit "Add new" row, skippable Role chips |
| D27 | Colour sheet | Tap saves; check mark plus ring; Second colour below; a stronger edge on Black, White and Grey |
| D28 | System message wording | Drafted now as one table in `DESIGN.md` for the Maintainer to edit |
| D29 | New catalog prompt | A row at the top of home, hidden while a Concert is being logged |

### Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (spec format); UI scope:  |
  |                      | logging screens for 1 December              |
  | Step 0               | 6/10; focus: logging screens first (D1)     |
  | Pass 1  (Info Arch)  | 6/10 → 8/10 after fixes                     |
  | Pass 2  (States)     | 3/10 → 8/10 after fixes                     |
  | Pass 3  (Journey)    | 6/10 → 8/10 after fixes                     |
  | Pass 4  (AI Slop)    | 7/10 → 9/10 after fixes                     |
  | Pass 5  (Design Sys) | 7/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 5/10 → 9/10 after fixes                     |
  | Pass 7  (Decisions)  | 5 resolved, 9 deferred to their phases      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (9 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated, 0 approved (no image API key)  |
  | Decisions made       | 26 added to the plan                        |
  | Decisions deferred   | 10 (listed below)                           |
  | Overall design score | 3/10 → 8/10                                 |
  +====================================================================+
```

Every rated pass is now 8 or above. What keeps the passes below 10:
- **Pass 1:** the brand (D9).
- **Pass 2:** the states deferred to their phases.
- **Pass 3:** the Wrapped moment, which belongs to the Cards.
- **Passes 4 to 6:** they still need checking on the built screens with `/design-review`, VoiceOver and TalkBack.

### NOT in scope

- "Did you go?" for past Planned Events: with the Plan screen (T056).
- "Ready for offline" covering share images: with the Cards.
- The restore banner and the conflict screen: with sync (US2).
- The Card template and the swatches' final tuning: T088 to T096.
- Cancelled versus "schedule changed": with the Schedule (T061).
- Consent toggles offline: with Settings (T082).
- Share in progress or failed: with the Cards.
- The Lecdem variant of the Event screen: T063.
- The Settings layout: with T082.

### What already exists

- **`app/src/styles/base.css` (T031):** tap feedback, the 16px input floor, safe areas, `dvh`,
  the tab-bar shell and `color-scheme`. D19 and D23 extend it.
- **The approved preview of the Event screen and Item editor (2026-11-01):** the reference for D5,
  D7 and D18.
- **The Phase 3 store on `phase-3-logging` (PR #4):**
  - Item actions, with Details starting as "?" and the Nadai as Not applicable, which D25
    matches;
  - the catalog upgrade, which D29's prompt starts;
  - `titleAliases` search, which D13 relies on.
- **shadcn preset `b51rn04Qt` (ADR 0006):** CSS variables, sheets with focus trapping (D24),
  and the Tabler icons. Not yet installed in `app/`.

### TODOS.md updates

None. Each deferral above belongs to an existing task, and the in-scope checks are in the
Implementation Tasks below.

### Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~3h / CC: ~20min)** — store and screens — Save-failure state and its
  required test (D15)
  - Surfaced by: Pass 2, both outside voices; reopens the eng review's D9
  - Files: `app/src/store/mutate.ts`, the Event and Item screens, `app/tests/store/save-failure.test.ts`
  - Verify: a failed write never plays the highlight, and leaves the value on screen with "Not
    saved on this phone"
- [ ] **T2 (P1, human: ~4h / CC: ~30min)** — Season home — Which Event holds Now: logging
  activity, then the nearest start, with "Done" optional (D3, D17); empty home (D11); catalog
  row (D29)
  - Surfaced by: Pass 1 and Pass 3
  - Files: the home screen and its selector, with a unit test for overlapping windows
  - Verify: a 4 pm and a 6:30 pm at 5:45, with and without Items logged in the last hour
- [ ] **T3 (P1, human: ~2h / CC: ~15min)** — theme — The CSS variable mapping, softened dark
  text and primary (D21, D22), and the themed caret, selection and focus ring (D19)
  - Surfaced by: Pass 4 and Pass 5
  - Files: the Tailwind theme and `app/src/styles/base.css`, when shadcn is set up
  - Verify: no browser-default blue in either theme; contrast as in `DESIGN.md`
- [ ] **T4 (P2, human: ~1 day / CC: ~1h)** — every logging screen — Larger-text reflow and the
  five focus rules (D23, D24)
  - Surfaced by: Pass 6
  - Files: T040 to T044
  - Verify: each screen at 320px and 200% text with the keyboard open; a VoiceOver and a
    TalkBack pass
- [ ] **T5 (P2, human: ~3h / CC: ~20min)** — Event screen — The Undo bar, "Recently deleted"
  and delete focus (D16)
  - Surfaced by: Pass 2
  - Files: `app/src/screens/EventScreen.tsx`
  - Verify: two quick deletes are both recoverable; Add Item stays reachable
- [ ] **T6 (P2, human: ~1h / CC: ~10min)** — copy — Use the Messages table's strings verbatim
  once the Maintainer has edited it (D28)
  - Surfaced by: Pass 7
  - Files: the screens in T040 to T044 and T081
  - Verify: grep the screens for each table string

### Unresolved Decisions

1. The product's name and where its logo appears (D9, deferred by the Maintainer).
2. The Maintainer's edits to the drafted Messages table (D28).
3. The items listed under NOT in scope above, each deferred to its phase under D1.

## Eng review output (plan-eng-review, 2026-11-01)

**Target:** the engineering impact of the design review of 2026-11-01 (`DESIGN.md`, D3 to D29
above) on `plan.md` and the Phase 3 store on `phase-3-logging` (PR #4, head `0f9206d`).
**Scope record:** about 7 changed files and one new module, under the complexity gate; scope
accepted as-is.

### Findings

1. [CRITICAL] (9/10) `app/src/store/items.ts:241` — a restored Item tombstone can collide with
   a newer Item's `position`; `deleteEvent` leaves no record of which tombstones it made.
2. [INFORMATIONAL] (9/10) `app/src/store/catalog-version.ts:38` — the catalog upgrade stamps
   `updatedAt` on every rewritten Item, so "changed in the last 60 minutes" (D17) misfires; no
   stored "Done".
3. [INFORMATIONAL] (9/10) `app/src/store/items.ts:68` — creating an Item from its first pick
   (D12) takes two transactions; a force-close between them leaves a blank Item.
4. [INFORMATIONAL] (8/10) `app/src/store/offline-ready.ts:2` — no first-phase "ready to log"
   fact and no install progress for D10.
5. [INFORMATIONAL] (8/10) `app/package.json` — no DOM test library for D15's required test.

### Decision ledger (2026-11-01)

#### R1: Undo restores without breaking the running order

Finding: 1, CRITICAL, 9/10, `app/src/store/items.ts:241`, `events.ts:113`, `mutate.ts:33`; reviewer: Claude (eng review)
Plan baseline: D16 (design review, 2026-11-01) approved Undo and "Recently deleted"; no restore action exists in the plan or `tasks.md`.
Runtime evidence: `removeItem` keeps the tombstone's `position`; `addItem` numbers from the last live Item; `save(..., { restore: true })` puts the row back unchanged; `deleteEvent` stamps each tombstone at its own time.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1 restore | `save(restore)` only; position can collide | `restoreItem` re-inserts at its old place and renumbers; `deleteEvent` returns the ids it removed for `restoreEvent` | unchanged |
| Required test | none | added to `app/tests/store/reorder-delete.test.ts` | none |
| D16 Undo design | approved | unchanged | unchanged |

Question D1:
D1 — How does Undo put a deleted Item or Concert back?
Project/branch/task: phase-3-logging (PR #4), the store behind D16's Undo and "Recently deleted".
ELI10: Deleting keeps the Item as a hidden "tombstone" at its old place number. If you then add a new Item, it can take the same number. Undoing the delete would then give two Items the same place, which the running-order test (T035) forbids. Deleting a whole Concert also hides its Items one by one with no note of which ones it hid, so Undo can't put back exactly those. Fix: a `restoreItem` action that slots the Item back where it was and renumbers in one step, and `deleteEvent` returning the list of what it hid so `restoreEvent` brings back exactly that.
Stakes if we pick wrong: Undo scrambles the running order, or brings back Items the rasika had deleted earlier on purpose.
Recommendation: A because Undo is now a promised feature and the collision is a silent integrity break on a required-test path.
Completeness: A=10/10, B=4/10
Pros / cons:
A) restoreItem and restoreEvent, with a required test (recommended)
  ✅ Undo always returns the Item to its place and keeps every place number unique (human: ~3h / CC: ~20min)
  ✅ Undoing a Concert delete brings back exactly the Items and Appearances it removed, nothing older
  ❌ Two new store actions and one more required test to maintain
B) Leave it; Undo calls save(restore) as today
  ✅ No new code; works whenever nothing was added between the delete and the Undo
  ❌ Delete-then-add-then-Undo gives two Items the same place, silently, mid-concert
Net: a small store change against a silent running-order corruption.
Header: Undo restore
Options:
A) restoreItem + restoreEvent (recommended)
Re-insert at the old place with renumbering in one transaction; deleteEvent returns the ids it removed; a required test in reorder-delete.test.ts.
B) Leave as is
Undo uses save(restore); a collision is possible after delete, add, Undo.

State: approved
Actual answer: A) restoreItem + restoreEvent (D1, 2026-11-01)
Accepted scope: `restoreItem` re-inserts an Item at its old place and renumbers in one transaction; `deleteEvent` returns the ids it tombstoned and `restoreEvent` restores exactly those; a required test in `app/tests/store/reorder-delete.test.ts`.
History: none

#### R2: Where "being logged" and "Done" are kept (D17)

Finding: 2, INFORMATIONAL, 9/10, `app/src/store/catalog-version.ts:38`, `app/src/model/records.ts` (Event); reviewer: Claude (eng review)
Plan baseline: D17 (design review, 2026-11-01): Now goes to the Event with an Item added or changed in the last 60 minutes and not ended with Done.
Runtime evidence: `save()` stamps `updatedAt` to now on every write, including the catalog upgrade's rewrite of each remapped Item; the Event record has no field for Done.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R2 storage | none | per-phone record in `db.meta`: per Event, the last logging time and the Done time, written only by the logging screens' actions; never synced | `loggingEndedAt` on Event, synced (data model, sync payload, server schema); activity from Items' `createdAt` |
| Effect of catalog upgrade or sync on Now | would count as activity | none | none |
| D17 behaviour | approved | unchanged | unchanged |

Question D2:
D2 — Where does the app keep "this Concert is being logged" and "Done was tapped"?
Project/branch/task: phase-3-logging (PR #4), the Now rule from D17.
ELI10: D17 says Now goes to the Concert you've logged in the last hour, unless you tapped Done. Reading that from each Item's "last changed" time doesn't work, because a catalog update rewrites every affected Item and stamps them all as changed just now. And there's nowhere to store "Done". Option A keeps a small note on this phone only: for each Concert, when you last logged something and when you tapped Done. Only the logging screens write it. Option B adds a "Done" field to the Concert record itself, which then syncs to the server and needs a data-model and server change.
Stakes if we pick wrong: A catalog update makes an old Concert grab Now, or a sync-schema change for something only this phone cares about.
Recommendation: A because Now is about what you're doing on this phone right now, and a per-phone note can't be disturbed by catalog updates or sync.
Completeness: A=9/10, B=8/10
Pros / cons:
A) A per-phone logging note in db.meta (recommended)
  ✅ Catalog updates and sync can never change Now; only your own logging taps do (human: ~2h / CC: ~15min)
  ✅ No change to the data model, the sync contract or the server schema
  ❌ Restoring onto a new phone mid-concert loses the note, so Now falls back to the nearest start
B) A synced loggingEndedAt field on the Event
  ✅ Done travels with the Concert to every device and survives a restore
  ❌ A data-model, sync-payload and server-schema change, plus migration, for a per-phone convenience
Net: a local note that nothing else can disturb, against a synced field that needs schema work.
Header: Logging note
Options:
A) Per-phone note in db.meta (recommended)
Per Event: last logging time and Done time, written only by the logging screens; never synced. Now reads it.
B) Synced Event field
loggingEndedAt on Event through the data model, sync payload and server schema; activity from Item createdAt.

State: approved
Actual answer: A) Per-phone note in db.meta (D2, 2026-11-01)
Accepted scope: A per-phone logging note in `db.meta`: per Event, the last logging time and the Done time, written only by the logging screens' actions and never synced; the Now selector reads it, so catalog upgrades and sync never change Now. A unit test covers a catalog upgrade not making an Event active.
History: none

#### R3: An Item is created from its first pick in one transaction (D12)

Finding: 3, INFORMATIONAL, 9/10, `app/src/store/items.ts:68` (`addItem` takes `title`, `form`, `note` only); reviewer: Claude (eng review)
Plan baseline: D12 (design review, 2026-11-01): a new Item exists from its first pick: a song, a Raga, a special form, "? Don't know" or "Use what I typed".
Runtime evidence: picking a song is `addItem` then `pickComposition`, two transactions; there is no Raga-only start.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R3 create | two transactions | one action, `addItemFrom(eventId, pick)`, for all five picks, in one transaction | unchanged |
| Test | none | extend `app/tests/store/logging.test.ts`: each pick creates exactly one Item with its Details | none |

Question D3:
D3 — Create a new Item and fill it from its first pick in one step?
Project/branch/task: phase-3-logging (PR #4), the store behind D12.
ELI10: D12 says an Item only exists once you pick something. Today the store can only make an empty Item, then fill it in a second step. If the phone dies or the app is swiped away between the two, a blank "?" Item is left in the running order and counts in the Wrapped. One store action that makes the Item already filled from the pick (a song, a Raga, a special form, "?" or what you typed) closes that gap.
Stakes if we pick wrong: Occasional phantom "?" Items appear in a Concert and inflate the season's counts.
Recommendation: A because it is what D12 means, and one transaction is how every other change in the store already works.
Completeness: A=10/10, B=6/10
Pros / cons:
A) One addItemFrom(pick) action (recommended)
  ✅ An Item never exists half-made; each pick creates exactly one filled Item (human: ~2h / CC: ~15min)
  ✅ Raga-only starts (an alapana before the song is known) get a proper action instead of a workaround
  ❌ One more store action, and the screens must route every pick through it
B) Keep addItem then pickComposition
  ✅ No store change; the two actions already exist and are tested
  ❌ A crash between them leaves a blank Item, and Raga-only starts have no action
Net: a single atomic action against an occasional phantom Item.
Header: Create on pick
Options:
A) addItemFrom(pick) (recommended)
One transaction for all five picks: song, Raga, special form, Unknown, typed text; tests extend logging.test.ts.
B) Keep two steps
addItem then pickComposition; a crash between them can leave a blank Item.

State: approved
Actual answer: A) addItemFrom(pick) (D3, 2026-11-01)
Accepted scope: One store action, `addItemFrom(eventId, pick)`, that creates an Item already filled from its first pick (song, Raga, special form, Unknown or typed text) in one transaction; the screens route every first pick through it; tests extend `app/tests/store/logging.test.ts` so each pick creates exactly one Item with its Details.
History: none

#### R4: "Ready to log offline" and real progress on first launch (D10)

Finding: 4, INFORMATIONAL, 8/10, `app/src/store/offline-ready.ts:2` ("set only when both download phases are cached"), `app/src/sw.ts:34` (`precacheAndRoute(phase1)`); reviewer: Claude (eng review)
Plan baseline: D10 (design review, 2026-11-01): "Getting ready to log offline" with real progress; "Ready to log offline" only once the catalog is stored.
Runtime evidence: Workbox precaches the first phase on install without reporting progress; the only stored fact covers both phases.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R4 ready fact | both phases only | a separate first-phase fact, `readyToLog`, in `db.meta`; `readyForOffline` keeps meaning both | a separate first-phase fact, `readyToLog` |
| Progress | none | the service worker posts "n of m first-phase files cached" to the page during install; a real bar | no progress messages; an indeterminate "Getting ready…" until the fact is set |
| D10 design | approved, "real progress" | unchanged | changes D10 to an indeterminate wait |

Question D4:
D4 — How does first launch know it can log offline, and show real progress?
Project/branch/task: phase-3-logging (PR #4), the first-launch "Getting ready" screen (D10).
ELI10: The app downloads in two parts: the first lets you log offline, the second (Cards, export) comes later. Today the app only notes "ready" once both parts are in, and the download reports no progress. D10 promised "Ready to log offline" after the first part, with a real progress bar. Option A stores a separate "ready to log" fact and has the background worker report how many first-part files are in. Option B stores the fact but shows a plain "Getting ready…" without a bar, a small change to D10.
Stakes if we pick wrong: First launch waits for the Cards download it doesn't need, or shows a bar that isn't measuring anything.
Recommendation: A because D10 promised real progress, and the worker already knows its file list.
Completeness: A=10/10, B=8/10
Pros / cons:
A) First-phase fact plus progress from the service worker (recommended)
  ✅ The bar measures real files, and logging opens as soon as the first part is stored (human: ~3h / CC: ~20min)
  ✅ 'Ready for offline' keeps its meaning for both parts, as the spec's Edge Cases define
  ❌ A small message channel between the worker and the page to build and test
B) First-phase fact, no progress bar
  ✅ Simpler: no worker messages, only a fact checked when install finishes
  ❌ On a slow first connection the rasika watches an unmoving 'Getting ready…' with no sense of time left
Net: an honest progress bar for a little worker plumbing, against a simpler wait that changes D10.
Header: First launch
Options:
A) Ready fact + progress (recommended)
readyToLog in db.meta for the first phase; the service worker posts n of m files during install for a real bar.
B) Ready fact only
readyToLog for the first phase; an indeterminate Getting ready with no bar, changing D10.

State: approved
Actual answer: A) Ready fact + progress (D4, 2026-11-01)
Accepted scope: A first-phase fact, `readyToLog`, in `db.meta` (`readyForOffline` keeps meaning both phases); the service worker posts first-phase install progress (n of m files cached) to the page, and the Getting ready screen shows a real bar; tests cover the fact being set after the first phase only and the progress messages.
History: none

#### R5: How D15's required save-failure test is built

Finding: 5, INFORMATIONAL, 8/10, `app/package.json` (no DOM test library); reviewer: Claude (eng review)
Plan baseline: D15 (design review, 2026-11-01): the save highlight plays only after a successful write; a failed write keeps the value with a persistent "Not saved on this phone", Try again and Export. A data-loss path, so its test is required (constitution IV).
Runtime evidence: `save()` returns a promise that rejects when its transaction fails (`mutate.ts:28`); Vitest runs without a DOM; Playwright e2e runs against the built app (`app/playwright.config.ts`).
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R5 test approach | none | the save-feedback logic in one framework-free module, unit-tested with a failing store; one Playwright case that makes IndexedDB writes fail and checks the screen | add `@testing-library/react` and `happy-dom`; component tests |
| New dev dependencies | none | none | two |
| D15 behaviour | approved | unchanged | unchanged |

Question D5:
D5 — How should the required save-failure test (D15) be built?
Project/branch/task: phase-3-logging (PR #4) and the screen tasks T040–T044.
ELI10: D15 is about what you see when a save fails, so its test has to check the screen, not just the store. The project has no tool today for testing React components outside a browser. Option A keeps the 'saving / saved / not saved' logic in one small plain module tested quickly with a fake failing store, and adds one real-browser test that forces the phone's storage to fail and checks 'Not saved on this phone' shows and the value stays. Option B adds a component-testing library and tests the components directly.
Stakes if we pick wrong: The one guard against silently lost Items goes untested at the screen, or the project picks up test dependencies it doesn't otherwise need.
Recommendation: A because it tests the logic fast and the real failure in the real browser, with no new dependencies.
Completeness: A=10/10, B=9/10
Pros / cons:
A) Plain module plus one real-browser failure test (recommended)
  ✅ The real screen is checked against a real storage failure in Chromium, not a simulated DOM (human: ~3h / CC: ~20min)
  ✅ No new dev dependencies; reuses the existing Vitest and Playwright setup
  ❌ Forcing an IndexedDB failure in Playwright needs a small test-only script in the page
B) Add @testing-library/react and happy-dom
  ✅ Components get fast tests of their own, useful for the screens that follow
  ❌ Two new dev dependencies, and a simulated DOM can't prove the real storage failure path
Net: one real-browser test and a plain module, against a new component-testing stack.
Header: Save test
Options:
A) Module + browser test (recommended)
Save-feedback logic in one framework-free module, unit-tested with a failing store; one Playwright case forcing IndexedDB writes to fail.
B) Component test library
Add @testing-library/react and happy-dom; test the components directly.

State: approved
Actual answer: A) Module + browser test (D5, 2026-11-01)
Accepted scope: The save-feedback logic (saving, saved with highlight, not saved with the value kept) lives in one framework-free module, unit-tested in Vitest against a store whose write rejects; one Playwright case forces IndexedDB writes to fail in the page and checks that "Not saved on this phone" shows and the value stays. No new dev dependencies. Required test (constitution IV).
History: none

### Sections 1 to 4

**1. Architecture.** Findings 1 to 4 above; all approved (D1 to D4). Two shapes for the one new
module, the per-phone logging note: (A) a `db.meta` note per Event, behind `noteLogging(eventId)`,
`endLogging(eventId)` and a pure `nowEvent(events, notes, now)` selector; (B) a synced
`loggingEndedAt` field on Event. A hides the whole Now rule behind three calls and touches no
contract; B spreads it across the data model, the sync payload and the server. A was picked
(D2). Red flag 8 (hand-synced list): the Messages table in `DESIGN.md` and the strings in the
screens. Implementing D28's "copy these strings" means one `app/src/screens/messages.ts` as the
only home for them in code, with a test that each table row's text appears there; this is the
mechanics of an approved decision, not a new choice. Failure per new path: a restore after the
Event's other Items were reordered (covered by D1's re-insert with renumbering); a service worker
that never posts progress (the Getting ready screen still advances when `readyToLog` is set, D4).

**2. Code quality.** No issues found beyond the findings above.

**3. Tests.**

```
CODE PATHS                                         USER FLOWS
[+] store/items.ts                                 [+] Logging a Concert
  ├── addItemFrom(pick)  [GAP] 5 picks (D3)          ├── [★★★ TESTED] offline capture — e2e/offline-concert.spec.ts
  ├── restoreItem()      [GAP] collision (D1) CRIT   ├── [GAP] [→E2E] save fails: "Not saved" stays (D5) CRIT
  └── removeItem()       [★★★ TESTED] reorder-delete ├── [GAP] delete, add, Undo keeps places unique (D1)
[+] store/events.ts                                  └── [GAP] Undo a Concert delete restores only its own
  ├── deleteEvent()      [★★ TESTED]                    Items and Appearances (D1)
  └── restoreEvent()     [GAP] token (D1) CRIT       [+] Home
[+] store/logging-note   (new)                          ├── [GAP] 4 pm and 6:30 pm at 5:45 (D2 selector)
  ├── nowEvent()         [GAP] activity, Done,          └── [GAP] catalog upgrade does not make an Event Now
  │                      window, ties (D2)            [+] First launch
[+] save-feedback        (new) [GAP] ok / fail (D5)      └── [GAP] readyToLog after phase 1 only; progress (D4)
[+] sw.ts install progress [GAP] messages (D4)
COVERAGE: 2/13 paths tested  |  GAPS: 11 (1 E2E), 3 critical (data-loss paths)
```

Every gap above is required proof of an approved decision (D1 to D5); no new test policy was
asked. Value cards are in the Implementation Tasks below. No test is made obsolete.

**4. Performance.** No issues found: `nowEvent` reads one note per Event in its window, and
nothing here touches the search path.

### Outside voice (Codex, gpt-6-astra, completed): dispositions

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | High | Unpicked typed text has no persistence plan | Carried under D12 (design): a persisted editor draft consumed by `addItemFrom`, with a stable id so a reopen after commit can't duplicate; restart test before and after a pick |
| 2 | High | Export beside a failed save omits the unsaved value | R6 (D6) |
| 3 | High | Overlapping edits can clear or misplace save feedback | Carried under D15/D5: feedback tracked per record, field and edit; a failed edit stays across navigation until a retry succeeds; tests for overlapping success and failure |
| 4 | High | Undo receipt lost on a crash; a stale Undo can replay over a newer delete in another tab | R7 (D7) |
| 5 | Medium | Appearance removal promises Undo but has no restore | Carried under D16 (design, "Artist removed"): R1's accepted scope extends to `restoreAppearance` with the same billing-order handling |
| 6 | High | A stored ready flag doesn't prove usable offline assets | R8 (D8) |
| 7 | Medium | The logging note is a separate write from the Item | Carried under D2: the note is written inside the logging action's transaction with the Item and outbox |
| 8 | Medium | After Done, the nearest-start fallback can reselect the same Concert; clock jumps | Carried under D17 (design, "releases Now at once"): ended Events are excluded from both paths; logging again clears Done; a note time in the future counts as now |
| 9 | Medium | Restoring after a catalog upgrade revives retired keys | Carried under D1: restore passes the Item through the current cumulative remap, keeping text and Overrides; test delete, upgrade, restore |
| 10 | High | Tests should prove rollback on part-way failure | Carried under D1/D3 as required proof, as T035 and T047 already do: a failure injected after the first write leaves records, positions and outbox unchanged |

#### R6: What Export includes when a save has failed (outside voice 2)

Finding: outside voice 2, High; `DESIGN.md` (Save failure), `contracts/season-export.md:7`; reviewer: Codex
Plan baseline: D15 (design): a failed write shows "Not saved on this phone" with Try again and Export.
Runtime evidence: the export contract reads stored records only, so the unsaved value is exactly what it leaves out.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R6 Export from "Not saved" | stored records only | stored records plus a labelled "Not saved" section holding the unsaved values from memory, written without touching the database | stored records only; the "Not saved" line instead offers Copy, putting the unsaved text on the clipboard |
| Ordinary Export | stored records | unchanged | unchanged |

Question D6:
D6 — When a save fails, what does the Export button next to "Not saved" export?
Project/branch/task: the save-failure state (D15) and the season export contract.
ELI10: If the phone can't write, the value you just entered lives only on screen. The Export next to "Not saved" is meant to rescue it, but today's export only reads what's already stored, so it would leave out exactly that value. Option A adds a clearly labelled "Not saved" section to that export, built from what's on screen, without writing to the database. Option B swaps Export for "Copy", putting the unsaved text on the clipboard.
Stakes if we pick wrong: The rescue button rescues everything except the one thing that needed rescuing.
Recommendation: A because the rasika gets one file with everything, including the stranded values, with no second step.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Export includes a labelled "Not saved" section (recommended)
  ✅ One file holds the whole season plus the stranded values, clearly marked (human: ~2h / CC: ~15min)
  ✅ Works even when the database can't be written, since it reads from the screen
  ❌ The export contract gains an optional section that importers must expect
B) Replace that Export with Copy to clipboard
  ✅ No contract change; the rasika pastes the text anywhere
  ❌ Clipboard text is easy to lose, and it's a second step mid-concert
Net: one complete rescue file against a lighter but more fragile clipboard copy.
Header: Rescue export
Options:
A) Add a Not saved section (recommended)
Export from the Not saved line includes the stranded values, read from the screen, in a labelled section.
B) Copy instead
The Not saved line offers Copy to clipboard instead of Export.

State: approved
Actual answer: A) Add a Not saved section (D6, 2026-11-01)
Accepted scope: Export started from the "Not saved" line includes the stored season plus a clearly labelled "Not saved" section holding the stranded values, read from the screen without writing to the database; `contracts/season-export.md` gains that optional section; a test exports while writes are still failing and finds the stranded value.
History: none

#### R7: Undo that survives a crash and can't replay over a newer delete (outside voice 4)

Finding: outside voice 4, High; `app/src/store/events.ts:113`, R1/D1; reviewer: Codex
Plan baseline: D1: `deleteEvent` returns the ids it tombstoned, held in memory; `restoreEvent` restores those.
Runtime evidence: a returned list lives only in memory; nothing stops a stale Undo from another tab restoring rows that were restored and deleted again since.
Comparison grid:

| Choice | Current (D1) | A | B | C | D |
|---|---|---|---|---|---|
| R7 receipt | in memory only | a deletion receipt (the ids and each one's `deletedAt`) written to `db.meta` in the same transaction as the tombstones; restore checks every `deletedAt` still matches, then consumes the receipt; a stale receipt restores nothing | unchanged | unchanged; investigate two-tab use first | unchanged; proposal deferred |
| Tests | D1's | add: restart then Undo; a replayed Undo; two tabs deleting and restoring | D1's | D1's | D1's |

Question D7:
D7 — Should Undo survive a crash and refuse to replay over a newer delete?
Project/branch/task: phase-3-logging, the restore actions approved in D1.
ELI10: D1 has delete hand back a list of what it hid, kept in memory for Undo. If the app crashes, that list is gone, so "Recently deleted" vanishes. With the app open in two tabs, an old Undo in one tab could also bring back something the other tab deleted later. Option A writes a small receipt with the delete, in the same step, recording exactly when each thing was hidden. Undo only works if nothing has changed since, and the receipt survives a crash.
Stakes if we pick wrong: Undo disappears after a crash, or a stale Undo resurrects something deleted on purpose later.
Recommendation: A because it costs one record per delete and makes every Undo either exactly right or a no-op.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: a stored receipt checked on restore (recommended)
  ✅ 'Recently deleted' survives a crash or reload, and a stale Undo can never restore the wrong thing (human: ~2h / CC: ~15min)
  ✅ The check is a timestamp comparison inside the same transaction, nothing new to sync
  ❌ Receipts need clearing when the rasika leaves the Event, one more small cleanup
B) Keep D1 as approved
  ✅ Simplest; two tabs on one phone mid-concert is rare
  ❌ A crash loses Undo, and a stale Undo can override a newer delete silently
C) Investigate two-tab use first
  ✅ Measures whether two tabs ever happen in this PWA before adding code
  ❌ Leaves the crash case open while investigating, and the fix is small anyway
D) Defer this change
  ✅ Ships D1 sooner, with the receipt as a later change
  ❌ The restore actions get written twice, once now and again with receipts
Net: a small stored receipt against an Undo that can be lost or replayed wrongly.
Header: Undo receipt
Options:
A) Apply: stored receipt (recommended)
Receipt in db.meta written with the tombstones; restore checks each deletedAt still matches, then consumes it; tests for restart, replay and two tabs.
B) Keep D1
Receipt stays in memory as approved in D1.
C) Investigate first
Check whether two tabs happen before choosing; D1 unchanged meanwhile.
D) Defer
Leave this proposal open; D1 unchanged.

State: approved
Actual answer: A) Apply: stored receipt (D7, 2026-11-01)
Accepted scope: A deletion receipt (the ids and each one's `deletedAt`) is written to `db.meta` in the same transaction as the tombstones; restore checks every `deletedAt` still matches, then consumes the receipt, and a stale receipt restores nothing; receipts are cleared when the rasika leaves the Event; tests for Undo after a restart, a replayed Undo, and two tabs deleting and restoring.
History: none

#### R8: "Ready to log" checked against the cache, not just stored (outside voice 6)

Finding: outside voice 6, High; `app/src/pwa.ts:16,28`, `app/src/sw.ts:34`, R4/D4; reviewer: Codex
Plan baseline: D4: a stored first-phase fact, `readyToLog`, in `db.meta`; the service worker posts install progress.
Runtime evidence: a stored fact can outlive the cache it describes (eviction, a replacement worker); a page waiting for progress messages has no timeout.
Comparison grid:

| Choice | Current (D4) | A | B | C | D |
|---|---|---|---|---|---|
| R8 readiness | stored fact | derived: the page asks the controlling service worker, which checks its precache for every first-phase file of its own build; `db.meta` keeps only the last answer for display | unchanged | unchanged; investigate eviction on the two phones first | unchanged; proposal deferred |
| Progress wait | none | no progress message for 15 s: ask for status again; still incomplete: "The download stopped" with Try again | as D4 | as D4 | as D4 |
| Tests | D4's | add: interrupted install, a replacement worker, a missed message, cache removal | D4's | D4's | D4's |

Question D8:
D8 — Should "Ready to log offline" be checked against what's actually cached, rather than trusted as a stored flag?
Project/branch/task: phase-3-logging, the first-launch readiness approved in D4.
ELI10: D4 stores a "ready to log" note once the first download finishes. But phones can quietly clear website caches, and an app update can swap the background worker. Then the note says ready when the files aren't there, and you find out in the hall. Option A asks the background worker each time, and it checks that every needed file is really in its cache. If progress messages stop for 15 seconds, the screen asks again and offers "Try again" instead of waiting forever.
Stakes if we pick wrong: The app says it's ready offline when it isn't, and search fails at the concert.
Recommendation: A because readiness is exactly the promise the hall depends on, and checking the cache is a few lines in a worker that already holds the file list.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Apply: check the cache each time, with a 15 s timeout (recommended)
  ✅ 'Ready' is true only when the files are really there for the build that is running (human: ~3h / CC: ~20min)
  ✅ A stalled download ends in 'Try again' rather than an endless 'Getting ready…'
  ❌ More cases to test: interrupted install, a swapped worker, a cleared cache
B) Keep D4's stored fact
  ✅ Simpler; the fact is written once and read cheaply
  ❌ After an eviction or a worker swap it can claim 'ready' when it isn't
C) Investigate eviction first
  ✅ Learns how often the two test phones actually clear caches before adding code
  ❌ Leaves the stall-forever case open, and eviction is hard to observe on demand
D) Defer this change
  ✅ D4 ships as approved; this hardening comes later
  ❌ The first-launch screen gets built twice
Net: a readiness check that can't lie against a simpler flag that sometimes can.
Header: Ready check
Options:
A) Apply: check the cache (recommended)
The controlling service worker checks its precache for every first-phase file; 15 s progress timeout then Try again; tests for install interruption, worker swap, missed message, cache removal.
B) Keep D4
Stored readyToLog fact as approved in D4.
C) Investigate first
Check eviction on the phones first; D4 unchanged meanwhile.
D) Defer
Leave this proposal open; D4 unchanged.

State: approved
Actual answer: A) Apply: check the cache (D8, 2026-11-01)
Accepted scope: Readiness is derived, not trusted: the page asks the controlling service worker, which checks its precache for every first-phase file of its own build; `db.meta` keeps only the last answer for display. With no progress message for 15 s the page asks for status again, and if still incomplete shows "The download stopped" with Try again. Tests for an interrupted install, a replacement worker, a missed message and cache removal.
History: none

Approval readiness: PASS. R1 to R8 are approved (eng D1 to D8); outside voice findings 1, 3, 5,
7, 8, 9 and 10 are carried under earlier approvals as recorded above; nothing is pending.

### Required outputs (eng review, 2026-11-01)

**NOT in scope.** The screens themselves (T040 to T044, built to `DESIGN.md`); sync and its
conflict screen (US2); Cards (T088 to T096). Two tabs are handled only for Undo (D7), not as a
general mode.

**What already exists.** `save()` and `remove()` in `app/src/store/mutate.ts` (one transaction
with the outbox; `restore` flag); `moveItem` renumbering (`items.ts:216`); `deleteEvent`
cascade (`events.ts:113`); the catalog remap used by the upgrade (`catalog/upgrade.ts`); the two
precache phases (`sw.ts:27`); `db.meta` for per-phone facts (`offline-ready.ts`). Every new
action reuses these.

**Failure modes.**

| New path | Realistic failure | Handled by |
|---|---|---|
| Undo restore | delete, add, Undo collides on a place | D1 re-insert with renumbering |
| Undo restore | crash loses Undo; stale Undo in another tab | D7 stored receipt, checked |
| Undo restore | restored Item carries a retired catalog key | outside voice 9, current remap on restore |
| Create on pick | crash between create and fill | D3 one transaction |
| Now | catalog upgrade or sync looks like activity | D2 per-phone note |
| Now | Done reselected by nearest start | outside voice 8, ended Events excluded |
| Save feedback | a failed save looks saved | D5 highlight only after success |
| Save feedback | Export omits the stranded value | D6 `notSaved` section |
| First launch | flag says ready after eviction or a worker swap | D8 cache check |
| First launch | progress never arrives | D8 15 s timeout, Try again |

**Worktree parallelization.**

| Lane | Tasks | Modules |
|---|---|---|
| A | T048a, T048b, T048c | `app/src/store/` (shared, so in sequence) |
| B | T048e | `app/src/sw.ts`, `app/src/pwa.ts` |
| C | T048d, T048f | `app/src/screens/` (new modules) |

Launch A, B and C together; A runs its three tasks in order. T040 to T044 follow C and use A's
actions. Conflict flag: T048d's Playwright test and T048e both touch the e2e setup, so merge B
before C's e2e test.

### Implementation Tasks

Synthesized from this review's findings; each is also in `tasks.md`.

- [ ] **T1 (P1, human: ~1 day / CC: ~45min)** — store — Undo restore with receipts (T048a)
  - Surfaced by: finding 1; outside voice 4, 5, 9, 10
  - Files: `app/src/store/items.ts`, `events.ts`, `people.ts`, `app/tests/store/reorder-delete.test.ts`
  - Verify: `npm test -- reorder-delete`
  - Value: protects=place numbers stay unique and Undo restores exactly what one delete hid; fails_when=restore skips renumbering or the receipt check; why_new=T035 covers delete and reorder, not restore; seam=none; no_claim=two real devices (two Dexie connections stand in)
- [ ] **T2 (P1, human: ~3h / CC: ~15min)** — store — `addItemFrom(pick)` (T048b)
  - Surfaced by: finding 3; outside voice 1
  - Files: `app/src/store/items.ts`, `app/tests/store/logging.test.ts`
  - Verify: `npm test -- logging`
  - Value: protects=a pick creates exactly one filled Item; fails_when=creation splits into two transactions again; why_new=logging.test.ts creates then fills; seam=none; no_claim=none beyond protects
- [ ] **T3 (P1, human: ~3h / CC: ~20min)** — store — Logging note and `nowEvent` (T048c)
  - Surfaced by: finding 2; outside voice 7, 8
  - Files: `app/src/store/logging-note.ts`, tests beside it
  - Verify: `npm test -- logging-note`
  - Value: protects=Now follows the rasika's logging and Done only; fails_when=Now reads updatedAt or a finished Event wins the fallback; why_new=no Now logic exists; seam=none; no_claim=real clock changes (injected times)
- [ ] **T4 (P1, human: ~1 day / CC: ~45min)** — screens — Save feedback and rescue Export (T048d)
  - Surfaced by: finding 5; outside voice 2, 3
  - Files: `app/src/screens/save-feedback.ts`, its tests, `app/e2e/save-failure.spec.ts`
  - Verify: `npm test -- save-feedback` and `npm run e2e -- save-failure`
  - Value: protects=a failed write never looks saved and its value can be exported; fails_when=the highlight plays before the write settles or Export reads only the store; why_new=no screen-level save tests exist; seam=a test-only init script makes IndexedDB writes fail; no_claim=real quota exhaustion on a phone
- [ ] **T5 (P1, human: ~1 day / CC: ~45min)** — service worker — Verified readiness and progress (T048e)
  - Surfaced by: finding 4; outside voice 6
  - Files: `app/src/sw.ts`, `app/src/pwa.ts`, `app/e2e/first-launch.spec.ts`
  - Verify: `npm run e2e -- first-launch`
  - Value: protects="Ready to log offline" only when phase-one files are cached for the running build; fails_when=readiness is read from a stored flag again; why_new=offline-concert.spec.ts assumes an installed app; seam=none; no_claim=iOS eviction behaviour (Chromium only)
- [ ] **T6 (P2, human: ~1h / CC: ~10min)** — screens — `messages.ts` and its table test (T048f)
  - Surfaced by: Section 1, red flag 8
  - Files: `app/src/screens/messages.ts`, its test
  - Verify: `npm test -- messages`

Test Plan Artifact: written to the gstack project directory (`tasks-eng-review` and
`eng-review-test-plan` files).

### Completion summary (eng review, 2026-11-01)

- Scope Challenge: scope accepted as-is (about 7 files, one new module).
- Architecture: 4 findings (1 critical); Code quality: 0; Tests: 11 gaps, all covered by
  approved tasks; Performance: 0.
- Outside voice: Codex completed, 10 findings: 3 asked (D6 to D8), 7 carried under earlier
  approvals.
- Decisions: 8 made, 0 deferred. Unresolved: none.

REALITY: premise-table pass every claim has a receipt, unverified=0 app/src/store/mutate.ts:28
REALITY: already-done pass no commits on main since 2026-11-01 touch app/src/store or sw.ts app/src/store/items.ts:68
REALITY: surface-check pass no CLI or route named; store APIs read at their lines app/src/store/events.ts:113
REALITY: binding-decisions pass consistent with the 2026-10-30 eng decisions and design D3 to D29 specs/001-season-logger/reviews.md:926
REALITY: numbers pass 60 min and 15 s are design choices [estimated]; efforts [estimated] specs/001-season-logger/tasks.md:163
REALITY: deferred-asks pass no linked issue specs/001-season-logger/tasks.md:163
REALITY: pr-count pass one PR per wave (no ship policy file) specs/001-season-logger/tasks.md:163

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | Codex (`/plan-design-review`, `/plan-eng-review`; host: claude) | Independent 2nd opinion | 4 | eng 2026-11-01: completed, issues_found; design 2026-11-01: completed, issues_found; 2026-10-30 eng and design: unavailable (in-host fallback) | eng: 10 findings, 3 decided, 7 carried; design: 17 findings |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | CLEAR | 4 issues, 1 critical gap, all resolved (8 decisions) |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 | ISSUES OPEN | score: 3/10 → 8/10, 26 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** Codex (gpt-6-astra) completed for both the design phase and the eng
  phase on 2026-11-01, each with findings. The 2026-10-30 eng and design phases had no outside
  coverage (Codex sandbox unavailable then; native fallback only).
- **CROSS-MODEL:** on the eng phase, Codex agreed with findings 1 to 4 and went further on each:
  receipts for Undo, the rescue Export, cache-checked readiness, rollback tests. Where it went
  further, it was asked (D6 to D8) or carried under an approval that already covered it.
- **VERDICT:** ENG CLEARED — ready to implement the Phase 3 store additions (T048a to T048f) and
  the screens T040 to T044. Design review is open only for decisions deferred to later phases
  and the product's name.

**UNRESOLVED DECISIONS:**
- Design: the product's name and where its logo appears (D9, deferred by the Maintainer)
- Design: the Maintainer's edits to the drafted Messages table (D28)
- Design: items deferred to their phases under D1 (Did you go, ready for offline with Cards, restore, conflict, Card template, smaller states, Lecdem, Settings layout)
