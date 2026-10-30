# Feature Specification: Season Logger and Live Wrapped

**Feature Branch**: `main` (no feature branch; spec directory `specs/001-season-logger`)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "what does building this entail, what should we use to build this etc."
Interpreted as: specify version 1 of Carnatic Wrapped as approved in
`docs/designs/carnatic-wrapped.md`, using the terms in `GLOSSARY.md`. What to build *with* is a
`/speckit-plan` question and is deliberately left out of this spec.

## Clarifications

### Session 2026-10-28

- Q: This season, will anyone other than you log in the app? → A: Open to any rasika this season
  (option C). Each rasika has their own account and season; the Maintainer (the person running
  the app) sees, with consent, the names and Events rasikas add, and promotes them into the
  shared lists.
- Q: Should sharing hand-typed names with the Maintainer be on by default or off by default? →
  A: Asked once at sign-up as an explicit yes/no with no default, changeable in settings.
  Sign-up is with a Google account, and the rasika's name is stored.
- Q: Do other rasikas need to be able to sign up by 1 December? → A: Yes, open to everyone on
  1 December alongside logging, including consent. The Maintainer's review and promotion follow
  by 15 December (amended 2026-10-30 by the eng review, D13: promotion needs logged entries
  first, and consented entries wait for review).
- Q: Can a rasika delete their account, and what happens to their data? → A: No self-serve
  deletion this season. The app shows a contact for deletion requests. On request, the
  Maintainer erases the rasika's name and Google account and keeps the season, no longer linked
  to anyone, for aggregate reports such as a State of Margazhi report (if the rasika said yes
  to season reports; see the next answer).
- Q: Should sign-up ask separately for permission to use a rasika's season, unlinked from them,
  in season reports? → A: Yes. Two separate yes/no questions at sign-up, one for sharing added
  names and one for season reports, each changeable in settings.

### Session 2026-10-29

- Q: Should a rasika be able to log before signing up? → A: No. Sign-in is required once, at
  first launch, when the rasika is online anyway to install the app, so that nothing logged
  exists only on the phone. After that, logging never waits on sign-in or the network.

### Session 2026-10-30

- Q: Are alapana, tanam, niraval and kalpana swaram recorded? → A: Yes. They are Details of
  the Item, like its Composition and Raga. The app records which ones were heard and shows them
  in the usual concert order; the order heard is not stored. An improvised Detail can have its
  own Raga when it differs from the Item's. How they are entered is designed when the Item
  editor is built, and they stay out of the main logging path.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log a Concert in the hall with no signal (Priority: P1)

At a Concert, the rasika opens the installed app and creates the Event. They pick the Sabha,
then add each Artist in their Role with the Colour they wore. As each Item is performed, they
add it in order. Picking a Composition fills in its raga, tala, composer, language and subject.
Any of those can be changed in a tap (an Override), marked "?" (Unknown), marked not sure (a
Guess), or typed freely (Unresolved). A Tani avartanam is recorded on the Item it followed, with
its Nadai. Nothing waits for the network, and nothing is lost if the phone locks, the app is
closed or the battery dies.

**Why this priority**: this replaces the phone note and the paper. Without it there is nothing
to sync, plan or wrap. Last season had 33 Concerts with about 6 Items each (193 in all), so
this flow runs about 230 times a season.

**Independent Test**: on the phone in airplane mode, log a full Concert (5 Appearances with
Colours, 8 Items, one Tani avartanam, notes), force-close the app, reopen it, and find every
detail intact.

**Acceptance Scenarios**:

1. **Given** the app is installed and the phone is in airplane mode, **When** the rasika opens
   it, **Then** the logging screen appears with no error and no waiting.
2. **Given** a new Concert, **When** the rasika types "sahana" or "saahana" in the raga field,
   **Then** the same Raga is offered. Spelling variants of Compositions and Composers behave the
   same way.
3. **Given** a picked Composition whose catalog raga is Todi, **When** the rasika changes the
   raga to Dhanyasi, **Then** the Item is saved in Dhanyasi without a warning, and the Wrapped
   counts Dhanyasi.
4. **Given** any field on an Item, **When** the rasika enters "?", marks the value not sure, or
   types text the catalog doesn't know, **Then** the Item saves with that value kept exactly as
   entered.
5. **Given** a Concert with 8 Items, **When** the rasika reorders two and deletes one, **Then**
   the running order shows the change at once and survives a force-close.
6. **Given** an Artist logged at an earlier Event, **When** the rasika starts typing their name,
   **Then** the Artist is offered, and choosing them creates a new Appearance for the same
   person.
7. **Given** an RTP, **When** the rasika logs it, **Then** it is an Item with no Composition,
   one or more Ragas in order, a tala and Nadai, the language and subject of its pallavi, and an
   optional pallavi author.

---

### User Story 2 - Never lose the season (Priority: P2)

Whenever the phone has signal and the app is open, everything logged is copied to the server.
The rasika can always see how many changes are not yet copied. If the phone is wiped, replaced
or its storage cleared, they sign in once and the whole season comes back. They can export the
whole season at any time, even offline.

**Why this priority**: a season cannot be re-attended. A web app's storage can be cleared by the
phone (iOS in particular), so the server copy, restore and export are what make P1 safe.

**Independent Test**: log three Events offline. Reconnect with the app open and confirm all
three reach the server with no duplicates. Clear the app's storage, reopen, sign in, and confirm
the full season is back before the logging screen appears.

**Acceptance Scenarios**:

1. **Given** 3 Events logged offline, **When** signal returns with the app open, **Then** all
   changes reach the server within 30 seconds, exactly once each, and the unsynced count falls
   to 0.
2. **Given** the same change is sent twice because of a dropped connection, **When** the server
   receives both, **Then** it stores it once.
3. **Given** an Item deleted and two Items reordered offline, **When** they sync, **Then** the
   server shows the same running order as the phone.
4. **Given** a synced season and an emptied phone, **When** the rasika opens the app with signal
   and signs in, **Then** every Event, Item, Artist, Appearance, Sabha, Plan entry, Guess,
   Override and Unresolved value is restored before logging resumes.
5. **Given** an emptied phone with no signal in a hall, **When** the rasika opens the app,
   **Then** logging works on the empty phone. Restore runs when signal returns, and it uploads
   the new entries before downloading, so they are kept.
6. **Given** any state, **When** the rasika chooses Export, **Then** a complete file of the
   season is produced on the phone, even offline.
7. **Given** 30 days with no network, **When** the rasika opens the app, **Then** they are still
   signed in.

---

### User Story 3 - Arrive with the Concert already filled in (Priority: P3)

Before the season, the rasika enters their Plan: the Events they intend to attend, with date,
start time, Sabha, kind and, for Concerts, the billed Artists in their Roles. If the logger
project's Schedule is available, they pick Plan entries from it instead of typing. At the hall,
they open the planned Event and log straight away. Date, Sabha and Artists are already there.
An Event they didn't go to is marked Missed.

**Why this priority**: the rasika wants context in place so attention goes to the music. It
depends on P1 and is useful with or without the Schedule.

**Independent Test**: enter 10 Plan entries. In airplane mode on one of those dates, open a
planned Concert and log it without typing the date, Sabha or any billed Artist.

**Acceptance Scenarios**:

1. **Given** a Planned Concert, **When** the rasika opens it on the day, **Then** date, start
   time, Sabha and billed Artists are filled in, and only Colours and Items remain to add.
2. **Given** a Planned Event the rasika did not attend, **When** they mark it Missed, **Then** it
   no longer appears as upcoming and does not count in the Wrapped.
3. **Given** a Schedule entry that changes after the rasika has edited or attended its Event,
   **When** the change arrives, **Then** the Event is not overwritten and a "schedule changed"
   hint appears.
4. **Given** a Schedule entry the Sabha cancels, **When** the cancellation arrives, **Then** an
   untouched Planned Event is shown as cancelled, and an edited or Attended one only gets the
   hint.
5. **Given** no Schedule exists this season, **When** the rasika uses the app, **Then** every
   other capability works fully from hand-entered Plan entries.

---

### User Story 4 - Log a Lecdem (Priority: P4)

At a Lecdem, the rasika records the title, up to 3 presenters (Artists in the presenter Role)
and the Sabha, with optional Colours, Items demonstrated and notes.

**Why this priority**: last season had 6 Lecdems against 33 Concerts. They matter to the
rasika but are a lighter form of P1.

**Independent Test**: log a Lecdem offline with 2 presenters, one of whom also performed at an
earlier Concert, and confirm both Appearances belong to the same Artist.

**Acceptance Scenarios**:

1. **Given** a new Lecdem, **When** the rasika enters title, presenters, date and Sabha,
   **Then** it saves without any Item.
2. **Given** a presenter who led an earlier Concert, **When** they are picked, **Then** one
   Artist has both Appearances.

---

### User Story 5 - Watch the Wrapped grow and share Cards (Priority: P5)

After any Concert, the rasika opens the Wrapped. It suggests a Wrapped range that fits the
Events they attended, which they can adjust. It shows the season so far, and any Card can be
shared as an image sized for an Instagram story. It works offline.

**Why this priority**: the Wrapped is the payoff and the reason to log carefully. It is
computed from the log, so it can only come after P1. The first Cards are due by 20 December.

**Independent Test**: using last season's data as a reference, reproduce its colours chart and
composer timeline as Cards offline and share one as an image. The reference data never shows
in the rasika's own Wrapped.

**Acceptance Scenarios**:

1. **Given** a Concert just saved, **When** the rasika opens the Wrapped, **Then** it already
   includes that Concert.
2. **Given** Attended Events from 28 November to 8 January, **When** the Wrapped opens, **Then**
   it suggests a range covering them, and the rasika can change either end.
3. **Given** Items in Pantuvarali and in Kamavardhini, **When** the top-ragas Card is shown,
   **Then** they count together as Linked ragas, and each name stays visible.
4. **Given** Items with Unknown values, **When** a Card counts that field, **Then** they appear
   as a "?" bucket. Not applicable values appear nowhere, and Guesses count as their value.
5. **Given** a Composer with no known dates, **When** the composer-timeline Card is drawn,
   **Then** that Composer appears in an "undated" band.
6. **Given** any Card, **When** the rasika chooses Share, **Then** the phone's share sheet offers
   the image, offline included.

---

### User Story 6 - Tidy up the log (Priority: P6)

Between Concerts, the rasika works through a list of Unresolved values and Guesses, matches or
confirms them, and merges duplicate Artists or Sabhas created by typos.

**Why this priority**: tidying improves the Wrapped but is never needed to log. Unresolved
values already count under their text as typed.

**Independent Test**: create two Artists that are the same person and one Unresolved raga.
Merge the Artists, match the raga, and confirm all Appearances and the Wrapped update.

**Acceptance Scenarios**:

1. **Given** an Unresolved raga "Kamavardini", **When** the rasika matches it to Kamavardhini,
   **Then** every Item with that text updates and the Wrapped counts it under Kamavardhini.
2. **Given** two Artists who are one person, **When** the rasika merges them, **Then** every
   Appearance points to one Artist, and the merged name becomes an alias.

---

### User Story 7 - Promote what rasikas had to type (Priority: P7)

The Maintainer sees which Artists, Sabhas and Events rasikas had to create by hand because the
shared lists or the Schedule lacked them. For example, several rasikas each typed "Anirudh
Athreya". The Maintainer adds the entry to the shared list, or adds the Event to the Schedule.
Each rasika's own entry then links to the shared one, and their logs keep everything they
typed or changed.

**Why this priority**: with any rasika able to sign up, gaps in the starting lists turn into
typing for everyone. Promotion closes a gap once for all. It never blocks logging, which works
with hand-typed entries throughout.

**Independent Test**: as two consenting rasikas, each create an Artist "Anirudh Athreya" at a
Concert. As the Maintainer, promote it. Confirm both rasikas' Appearances now point to the
shared Artist, their text as typed is kept, and a third rasika is offered him from the start.

**Acceptance Scenarios**:

1. **Given** rasikas who agreed to share their additions, **When** the Maintainer opens the
   review list, **Then** it shows each hand-created Artist, Sabha and Event with how many
   rasikas created it, and no other personal detail.
2. **Given** a promoted Artist, **When** a rasika's app next syncs, **Then** their own matching
   Artist links to the shared one, and all its Appearances follow.
3. **Given** a rasika's hand-typed Event that the Maintainer adds to the Schedule, **When** it
   syncs, **Then** the Event links to the Schedule entry and is not overwritten.
4. **Given** a rasika who did not agree to share, **When** the Maintainer reviews, **Then**
   nothing from that rasika appears.

---

### Edge Cases

- **Catalog update during the season.** A new catalog version arrives that merges or retires a
  Composition, Raga or Composer, or changes which ragas are Linked. Logged Items keep their
  meaning: merged names follow the merge, a retired one falls back to the text as typed and
  becomes Unresolved, and Linked-raga counts follow the new version. Overrides are never reset.
  A new version is applied only on the next launch, after the rasika agrees, never mid-Concert.
- **Partly downloaded app.** The first-install download (app, catalog, search) is enough to
  log. Cards and spreadsheet export need the second download. "Ready for offline" appears only
  when both are present for the current catalog version.
- **Two rasikas, same new name.** Each rasika's hand-created entry stays theirs until the
  Maintainer promotes a shared one. Promotion links both. It never merges two rasikas' data
  into one log.
- **Second device.** Each rasika has one writing device at a time. Signing in on a new device makes it the
  writer. A former writer that tries to sync is told it is no longer the writer, and keeps its
  unsynced changes for export.
- **Browser tab, then installed.** A rasika can use the app fully in a phone browser tab, and
  sees a banner suggesting they add it to the Home Screen. On iPhone the installed app has
  separate storage, so after installing they sign in again and restore brings the season back;
  changes not yet synced from the tab stay in the tab until it syncs.
- **Undated reference Events.** Every Concert in last season's sheet has no date. In the
  reference import they may have no date and are ordered by their row in the sheet. New Events
  default to today.
- **Two Tani avartanams in one Concert.** Each belongs to the Item it followed.
- **Ragamalika.** The Item keeps its list of Ragas in order. Each Raga counts once for that Item
  in the top-ragas Card.
- **A performer's own Composition** (e.g. Akkarai Sornalatha's "Gananatham Smarami", sung at her
  own Concert). The Composer and the Artist are different entries and are not linked.
- **"Mix of 3 Compositions"** or similar medleys. Logged as one Item with free text; its fields
  are Not applicable.
- **Phone storage cleared mid-Concert.** Unsynced entries since the last sync are lost. The
  unsynced count is how the rasika knows the risk. This is an accepted limit, mitigated by
  syncing whenever the app is open with signal.
- **No sync in the background.** Changes upload only while the app is open. Leaving the app
  closed on Wi-Fi does not sync.

## Requirements *(mandatory)*

### Functional Requirements

**Logging (P1, P4)**

- **FR-001**: The app MUST let the rasika create an Event of kind Concert or Lecdem, with date,
  start time, Sabha, status and an optional note.
- **FR-002**: Every logging action MUST complete without the network: create, edit, reorder,
  delete and search.
- **FR-003**: Every save MUST be kept on the phone immediately, survive a force-close, and show
  no waiting indicator.
- **FR-004**: The rasika MUST be able to add Appearances to an Event. Each Appearance has an
  Artist, a Role (lead, second lead, violin, mridangam, khanjira, ghatam, morsing, other
  accompaniment, presenter) and a Colour (one primary from a fixed palette plus an optional
  second).
- **FR-005**: Artists and Sabhas MUST be picked from earlier entries as the rasika types. A new
  name creates a new Artist or Sabha that belongs to that rasika. Every rasika starts from the
  shared lists, first seeded with the 11 Sabhas and the Artists in last season's sheet.
- **FR-006**: The rasika MUST be able to add Items to a Concert or Lecdem in running order, and
  reorder or delete them.
- **FR-007**: Picking a Composition MUST fill in its raga, tala, composer, language and subject
  from the catalog. Each field MUST stay editable in one or two taps with no confirmation.
- **FR-008**: Every Item field MUST accept a catalog value, "?" (Unknown), Not applicable, a
  value marked not sure (Guess), or free text (Unresolved), and keep it exactly as entered.
- **FR-009**: An Item MUST be able to have several Ragas in order (ragamalika, RTP) and a tala
  with Nadai.
- **FR-010**: An Item MUST be loggable without a Composition (RTP, viruttam, slokam, free text).
- **FR-011**: The rasika MUST be able to record a Tani avartanam on the Item it followed, with
  its Nadai and an optional note.
- **FR-012**: Search MUST find Compositions, Ragas and Composers across common transliteration
  variants (Thyagaraja / Tyagaraja, Sahana / Saahana) and the catalog's known Aliases.
- **FR-013**: A Lecdem MUST have a title and up to 3 presenters, and MAY have Items.

**Keeping the season safe (P2)**

- **FR-014**: The app MUST copy every change to the server whenever it is open with signal: on
  start, on reconnect, on returning to the app and after each save.
- **FR-015**: A change received twice MUST be stored once. Deletes and reorders MUST reach the
  server.
- **FR-016**: The app MUST show the number of changes not yet on the server.
- **FR-017**: On an empty phone, the app MUST offer sign-in and then restore the full season,
  uploading any local entries first.
- **FR-018**: On an empty phone with no signal, logging MUST still work. Restore MUST run when
  signal returns.
- **FR-019**: Export of the whole season to a file MUST work at any time, offline included.
  Export in the shape of last season's spreadsheet SHOULD be available (stretch).
- **FR-020**: The rasika MUST stay signed in through at least 30 days without network, and a
  network error MUST never sign them out.
- **FR-021**: Any rasika MUST be able to create an account by signing in with Google. The
  account stores the rasika's name. The server MUST let only the signed-in rasika read or change
  their own season. A lost phone's sign-in MUST be revocable from another device.
- **FR-022**: The app MUST allow each rasika only one writing device at a time. The device most recently signed in is the
  writer, and others are told so when they try to sync.
- **FR-023**: On first run the app MUST ask the phone to keep its storage persistently.

**Planning (P3)**

- **FR-024**: The rasika MUST be able to enter Plan entries (date, start time, Sabha, kind,
  billed Artists in Roles, Lecdem title) ahead of time.
- **FR-025**: When the logger project provides a Schedule, the app MUST let the rasika add its
  entries to the Plan, and MUST keep working fully without it.
- **FR-026**: An Event MUST move from Planned to Attended when logged, and to Missed when the
  rasika says so. Only Attended Events count in the Wrapped.
- **FR-027**: Once the rasika has edited or attended an Event, Schedule updates MUST NOT change
  it and MUST show a "schedule changed" hint instead. A cancelled Schedule entry marks an
  untouched Planned Event as cancelled.

**The Wrapped (P5)**

- **FR-028**: The Wrapped MUST be computed on the phone from Attended Events in a Wrapped range,
  offline, and reflect the latest save.
- **FR-029**: On opening, the Wrapped MUST suggest a range covering the rasika's Attended Events
  and let them change both ends.
- **FR-030**: Cards MUST count Linked ragas together while showing each name, count Unknown as
  "?", ignore Not applicable, and count Guesses and Overrides as their values.
- **FR-031**: These Cards MUST be available by 20 December: Colours, top Ragas, Composer
  timeline. These SHOULD follow, in order: season fabric cover, Topics, most-seen Artists and
  Accompanists, Sabhas, firsts and rarities (a Raga's share of the catalog).
- **FR-032**: Every Card MUST render offline as an image sized for an Instagram story and be
  shareable through the phone's share sheet.
- **FR-033**: The composer timeline MUST use project-kept Composer dates. Birth and death years
  can be approximate, and death is blank for living Composers. Composers without dates appear
  in an "undated" band.
- **FR-034**: The Topics Card MUST roll Subjects up to Topics through a project-kept table.
  Subjects with no Topic appear under their own name.

**Tidying (P6)**

- **FR-035**: The app SHOULD list Unresolved values and Guesses, and let the rasika match or
  confirm each one, updating every Item that uses it.
- **FR-036**: The app SHOULD let the rasika merge duplicate Artists or Sabhas, keeping the
  merged-away name as an alias.

**Catalog and last season**

- **FR-037**: The catalog MUST be read-only in this app. Editing an Item never changes it.
- **FR-038**: A new catalog version MUST be applied only on the next launch, with the rasika's
  agreement. Logged Items MUST keep their meaning across versions (see Edge Cases).
- **FR-039**: Last season's spreadsheet MUST import through the same matching the app uses. The
  import reports, separately, how many Items matched a Composition, were "?", were special forms
  with no Composition, or stayed Unresolved, out of all 193 Items.
- **FR-040**: Imported 2024-25 Events and Items MUST be used only as a reference for testing
  matching and Cards, and MUST never appear in the rasika's log or Wrapped. Names and dates
  from the sheet MAY seed the shared lists and the project-kept tables (FR-005, Composer
  dates).
- **FR-041**: An RTP MUST have an optional pallavi author, blank by default. When filled, it
  counts as a Composer in the composer Cards and timeline; when blank, the composer is Not
  applicable.

**Promotion (P7)**

- **FR-042**: At sign-up the app MUST ask each rasika, as an explicit yes/no with nothing
  pre-selected, whether to share their hand-created entries with the Maintainer. The choice MUST
  be changeable in settings at any time, and turning it off stops sharing from then on. A
  rasika's hand-created Artists, Sabhas and Events MUST be visible to the Maintainer only while
  that rasika has agreed to share them, and only as the entry itself with a
  count of rasikas, never with the rasika's identity or other log details.
- **FR-043**: The Maintainer MUST be able to promote a shared entry: an Artist or Sabha into the
  shared lists. For a hand-typed Event, the Maintainer adds it to the Schedule in the logger
  project, then links each rasika's matching Event to that Schedule entry.
- **FR-044**: When an entry is promoted, each rasika's matching entry MUST link to the shared
  one on next sync. Appearances follow, text as typed and Overrides are kept, and an Event the
  rasika edited or attended is never overwritten.
- **FR-045**: Shared lists MUST be versioned, and a rasika's app picks up a new version on the
  next sync without any action.

**Accounts and deletion**

- **FR-046**: The app MUST show, in settings, a contact the rasika can message to request
  deletion. There is no self-serve account deletion this season.
- **FR-047**: On a deletion request, the Maintainer MUST be able to erase the rasika's name and
  Google account so their season can no longer be linked to them. The season is then kept,
  unlinked, only for aggregate reports, and only if they said yes to season reports; otherwise
  it is erased too.
- **FR-048**: Aggregate reports (e.g. a State of Margazhi report) MUST NOT identify any rasika,
  and MUST include only seasons whose rasika said yes to season reports (FR-049). A deleted
  rasika's season is kept under the same rule (FR-047).
- **FR-049**: At sign-up the app MUST ask, as a separate explicit yes/no with nothing
  pre-selected and a one-line reason, whether the rasika's season may be included, unlinked from
  them, in season reports. The choice MUST be changeable in settings at any time.
- **FR-050**: On first launch, the app MUST ask the rasika to sign in with Google and answer
  both consent questions (FR-042, FR-049) before logging. After that first sign-in, logging MUST
  never wait on sign-in: an ended session or a network error shows only a non-blocking "sign in
  again" prompt (FR-020). An emptied phone with no signal still logs, and asks for sign-in when
  signal returns (FR-018).

### Key Entities *(include if feature involves data)*

- **Event**: a Concert or Lecdem the rasika planned or attended. Has date, start time, Sabha,
  kind, status (Planned, Attended, Missed), source (Schedule, Plan, created on the spot), note.
  A Lecdem also has a title.
- **Sabha**: the organisation putting on an Event. Shared or a rasika's own, like an Artist. Has
  a name and aliases.
- **Rasika**: one account, signed in with Google, with their own season. Has a name and two
  yes/no answers: sharing hand-created entries, and inclusion in season reports.
- **Maintainer**: the person who runs the app and curates the shared lists. Not a rasika role.
- **Artist**: one person across the season. Either shared (from the shared lists) or a rasika's
  own, hand-created, until promoted. Has a name and aliases.
- **Appearance**: one Artist in one Role at one Event, with a Colour.
- **Item**: one piece at an Event, with a position in the running order. Refers to a Composition
  (optional), and has Ragas in order, tala with Nadai, composer, language, subject and note. Each
  field holds a value and its state (catalog, Override, Unknown, Not applicable, Guess,
  Unresolved), plus the text as entered.
- **Tani avartanam**: attached to the Item it followed. Has a Nadai and a note.
- **Composition, Raga, Composer, Tala, Subject** (catalog, read-only): supplied by the logger
  project in versions, with Aliases and Linked ragas.
- **Composer dates** (project-kept): per Composer, approximate birth and death years, seeded
  from last season's Timelines sheet (56 Composers).
- **Topic roll-up** (project-kept): Subject to Topic, seeded from last season's Topic column.
- **Schedule entry** (from the logger project): a published upcoming Event.
- **Shared lists**: the versioned Artists and Sabhas every rasika starts from, curated by the
  Maintainer. They may later come from the logger project's artist catalog.
- **Wrapped range and Card**: the dates a Wrapped covers, and one shareable image from it. Both
  are derived and never stored as the record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**By 1 December 2026**

- **SC-001**: A full Concert logged in airplane mode (5 Appearances with Colours, 8 Items, notes)
  survives a force-close with nothing lost.
- **SC-002**: After reconnecting with the app open, every change is on the server within 30
  seconds with no duplicates. Offline deletes and reorders match on the server.
- **SC-003**: Restore onto an emptied phone brings back the full season, Unresolved values
  included, before logging resumes.
- **SC-004**: Starting from a Planned Concert, logging needs no typing for date, Sabha or billed
  Artists.
- **SC-005**: Of last season's 193 Items, at least 90% resolve to a Composition, a deliberate
  "?" or a special form without manual cleanup. The three rates are reported separately; the
  target is confirmed once first measured.
- **SC-015**: Any rasika can sign up with Google, answer both consent questions and log a
  Concert, and no rasika can see another's season.
- **SC-016**: An Artist created by hand by two consenting rasikas can be promoted by the
  Maintainer and is offered to a new rasika from the start. Due by 15 December, not 1 December (eng review D13).

**Speed and size (mid-range phone, app installed)**

- **SC-006**: Opening the app to the logging screen in airplane mode takes under 1.5 seconds.
- **SC-007**: Search results appear within 50 ms of a keystroke for 95% of searches, offline.
- **SC-008**: Saving takes under 100 ms, with no waiting indicator ever shown.
- **SC-009**: The first-install download is under 2 MB, and the second download (Cards, export)
  is under a further 3 MB.
- **SC-010**: 95% of a golden set of about 100 variant spellings, drawn from last season's
  sheet and hand-added cases, return the intended entry in the top 3 results.

**By 20 December 2026**

- **SC-011**: Cards render offline and include a Concert within 1 second of saving it.
- **SC-012**: Last season's colours chart and composer timeline are reproduced from the imported
  data, matching the spreadsheet's counts (e.g. white 23, red 15, blue 15).

**Over the season**

- **SC-013**: The rasika logs every attended Event of the 2026-27 Season in the app, with no
  fallback to paper or a spreadsheet.
- **SC-014**: The season's Cards are posted straight from the app, with no hand-made charts.

## Assumptions

- Any rasika can sign up this season, and each has one writing device at a time. Every rasika's
  season is private to them.
- The phone runs a current iOS Safari or Android Chrome. Installing to the home screen is
  recommended, with a banner, but not required: the app also works fully in a browser tab (eng
  review D15). The primary test device will be named by the rasika.
- The logger project supplies the catalog as versions and, possibly, a Schedule. If no Schedule
  arrives this season, P3 works from hand-entered Plan entries alone.
- Until the logger project has an artist catalog, the Maintainer curates the shared Artist and
  Sabha lists. Moving them into the logger's catalog later is out of scope for this spec.
- Sign-in is with Google. It needs signal once per device, must not expire offline, and must
  allow revocation (FR-020 to FR-022). How sessions are kept is chosen in `/speckit-plan`.
- If the server is not ready by 1 December, logging ships phone-only with export, and changes
  upload once the server exists (cut line in the design doc).
- Durations and hall names are not recorded in version 1. Improvised Details (alapana, tanam,
  niraval, kalpana swaram) are recorded as heard, with their own Raga when it differs; their
  entry is designed with the Item editor (Clarifications 2026-10-30).
- Dance, harikatha and other Event kinds are out of scope this season.
- The golden set of spellings is built by the developer from last season's sheet and reviewed
  by the rasika.
