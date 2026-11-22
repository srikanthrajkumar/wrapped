# Starting a log

How a rasika starts logging a concert, and what the Hub's + does at the season. Decided by the
user on 2026-11-22, one decision at a time, after two council rounds (two Claude reviewers and
Codex). Built the same day (see "As built").

**Review page:** https://claude.ai/artifact/H8iD2Q1xyytaYP49zCdaku (the renders, the mocks, the
measurements and the council's scores).

## Decisions

| # | Decision | Chosen | Council, round 2 |
| --- | --- | --- | --- |
| 1 | Structure: what the + leads to | **G.** The + stays one tap to a blank Concert, and the blank Concert offers the listings nearest its time | G 8 · 8 · 8 (A 4 · 4 · 4, C2 8 · 6 · 7) |
| 2 | When the offer goes | **Once an Artist or a Sabha is set**, not at the first Item | Split; the user took the recommendation |
| 2b | What the offer is built around | **The Concert's own date and time**, so a late log works | Recommended by Claude 1 |
| 3 | Words | **"Is it one of these?"** and **"Search What's on…"**, the link always shown in season | The user: "I am sometimes logging concerts that have passed" |
| 4 | What's on's search with no match | **E2: "Not listed? Start a Concert"** | E2 8 · 7 · 6 |
| 4b | A listing as the best match in the Artist picker | **Later** | Two of three for later |

Not chosen: A (as built), B2 and C2 (a "Which concert?" sheet behind the +), D (switched by the
season's dates), F (re-ranking the Hub's Today panel). The Hub is unchanged.

## Why

Measured on the real 2026-27 feed (711 listings, 4 Nov to 17 Jan; 452 in December) with the Hub's
own rule, on peak days (15 Dec to 1 Jan, 394 listings), nothing Shortlisted:

| Opened at | 10 min before | at start | 10 min in | 30 min in | 60 min in |
| --- | --- | --- | --- | --- | --- |
| On the Hub's Today panel, as built | 97% | 54% | 54% | 43% | 40% |
| In G's 4 rows, nearest to the Concert's time | 90% | 97% | 90% | 69% | 55% |

- The Today panel favours the next slot ("what can I still catch"). At 4:10 pm on Sat 19 Dec the four
  concerts that began at 4:00 are all off the Hub. The + is the obvious way in.
- A blank Concert costs about 10 taps and 4 typed names to match what "I'm here" fills in one tap
  (2.6 billed Artists per listing on average, each about 3 taps, plus the Sabha). It also leaves the
  listing unlinked.
- There's no data on how many concerts are unlisted: last season's spreadsheet has no concert dates.

## The +

Unchanged: a 28px mark in a 48px target at the hero's right, spoken "Log a Concert". One tap makes
a blank Concert dated now and opens it. The 2026-11-08 rule is kept: an untouched one is taken back
on leaving (`app/src/screens/new-concert.ts`).

## The blank Concert offers its listings (G)

### When the offer shows

- On a Concert the + made, while it has **no Artist and no Sabha**. Items and a Note don't hide it
  (decision 2): someone who arrives late and logs the first song before anything else still sees it.
- Only when the stored Schedule has at least one listing **near the Concert's own date and time**:
  started up to 2½ hours before it, or starting within 60 minutes after it (decision 2b). The time
  starts as now, so in the hall that means on now or within the hour.
- Changing the Concert's date or time re-centres the offer. That is the late log: + › the time ›
  4:00 pm › the row.
- Left out: cancelled listings, and listings the rasika has already heard.
- With nothing near, no section shows, only the link ("Search What's on…").

### What it shows

- In the blank Concert's empty middle, in place of "No Items yet" (or above the Items, once there
  are some), as one section in the section pattern:
  - The header: **"Is it one of these?"** in `body` 600, with no count and no chevron.
  - Under it, in `sub`, muted: "On now or within the hour · tap to fill it in" while the Concert's
    time is now (within 5 minutes); otherwise "Near 4:00 pm · tap to fill it in".
- A panel of up to **4** rows, as What's on draws them (the dot for on now, time · Sabha):
  - the rasika's Shortlisted ones first;
  - then the rest, nearest to the Concert's time first;
  - concerts that start at the same time in Sabha order.
- The rows are worked out when the page opens and when the date or time changes. They are never
  re-sorted under the thumb.
- On a 667pt phone the section scrolls with the page and clears the Add Item bar. It doesn't shrink
  to 3 rows: 3 rows cover 80% at 10 min in, against 90% for 4.

### "Search What's on…"

- One Action row under the panel: a magnifier on the + glyphs' 24px column, then "Search What's on…"
  in `body`, muted, regular weight.
- It shows on every blank Concert while the Concert's date falls within the stored Schedule's span,
  **with or without the list** (decision 3). Builder's call, open to review: that span is from the
  first listing's date to 7 days after the last. Outside it (February, or with no feed on the phone)
  the blank Concert is exactly as built.
- It opens the docked search (search.md) over the whole Season's listings, past days included, by
  Artist or Sabha, the Concert's own day first. A pick does what a row does.
- With no match: "Nothing matches “…”" on the panel, and a pinned Action row "Not listed? Fill it in
  yourself" that closes the search back to the blank Concert. Builder's words, open to review.

### What a row does (the data rules)

- **One path with "I'm here".** A row makes the listing's Event exactly as "I'm here" does
  (`addFromSchedule`): billed Artists with their Roles, the Sabha, the kind, the printed title, the
  listing's date and start time (4:00, not the 4:10 the blank was made at), and the link
  (`scheduleEntryId`). Opening it ready for an Item makes it Heard (ADR 0010).
- **The blank one is taken back** in the same local transaction, as an untouched one is. Anything
  already entered in it (Items with their Details, a Note) moves to the listing's Event first, in
  order, kept as typed.
- **Already the rasika's.** If the listing already has an Event (Shortlisted), that Event opens.
  Whatever the blank one held moves there and is added after anything already in it. Nothing in the
  existing Event is overwritten.
- **Undo.** An Undo bar, "NJ Nandini · Undo", for as long as Undo bars last. Undo brings back the
  blank Concert as it was, with its offer and anything it held. If the Event was new, it removes it;
  if it already existed, it takes back only what the fill added. Undo ends at the first edit after
  the fill.
- **Offline.** It reads only the stored Schedule and writes locally, like every save: one
  transaction with its outbox entries, no spinner (constitution I). Ids are the client's, so a retry
  never duplicates (ADR 0007).
- **No new field.** It uses the Event's existing fields. If the build finds it needs one, an ADR
  comes first (constitution VI).

## What's on's search with no match (E2)

- Pinned above "Nothing matches “…”", as search.md pins its Action rows: a + on the 24px column,
  then **"Not listed? Start a Concert"** in `body`, muted, regular weight. It shows only on a search
  with no match.
- It makes a blank Concert dated now, as the + does, and opens it. The typed text isn't put into
  any field (it can't tell an Artist from a Sabha). The Concert's back label is "What's on". The
  blank Concert offers its listings as above.

## Taps to an Event ready for the first Item

| Journey | As built | Now |
| --- | --- | --- |
| Listed, not Shortlisted, at the hall | 2 if on the Hub (54% at 10 min in), else 3 or more; or 1 to a blank and about 10 more | **2** (+ › row), 90% at 10 min in; else + › Search What's on… › type › pick |
| Shortlisted, the hero | 1 | 1 |
| Unlisted, in Chennai, in season | 1 | 1 (ignore the offer) |
| After the season, or outside Chennai | 1 | 1 |
| Listed, logged later the same day | Today › What's on › row › "I was there" (4) | + › time › row (3 plus the time), or + › Search What's on… › type › pick |
| Searched What's on, not listed | back to the Hub › + | **3** plus typing (Today › field › "Not listed? Start a Concert") |

## Build plan

- `EventScreen.tsx`: the offer section and the "Search What's on…" row on a blank Concert made by the
  + or by E2; the rules above.
- A shared function for "make this listing's Event" (`ListingSheet.tsx`'s `add`, `addFromSchedule`),
  used by "I'm here", G's rows and G's search.
- The take-back of the blank, with anything it held moved, in one transaction.
  - `new-concert.ts` keeps its Web Lock and journal rules. A fill counts as the rasika leaving the
    blank one.
- `WhatsOnScreen.tsx` / `DockedSearch`: E2's pinned Action row on no match.
- The listings near a time: one pure function (`spine.ts` or its own module), unit-tested on the
  real feed's shapes. The cases: the 4:00 slot at 4:10, 10 min before, a Shortlisted one, a heard
  one left out, cancelled, nothing near, a late log re-centred, and midnight.
- **Tests required (constitution IV, data-loss paths):**
  - a fill surviving a forced close mid-way;
  - Items moved from a blank to an existing Shortlisted Event, synced without duplicates;
  - Undo after a fill reaching the server.
- `e2e`: + › row › Event filled and Heard; + › Search What's on… › pick; E2 › blank Concert;
  Undo. (All built: see "As built".)
- DESIGN.md, once built:
  - "The +": add that the blank Concert offers its listings;
  - the Event screen's empty state;
  - What's on's search no-match;
  - a Decisions Log row for 2026-11-22.
- Hub: no change.

## Fixes from the mocks, for the build

- "Search What's on…": its glyph on the 24px column, its text on the same x as "Add Sabha".
- 32px between the section and Note.
- A Concert made by the + goes back to "Season", whatever made it.

## Later, or noticed

- **The Artist picker** offering a listing as the best match ("NJ Nandini's concert · 4:00 pm ·
  Music Academy"): later, if people reach for "+ Add Artist" first (decision 4b).
- **The Hub's Today panel** still leaves concerts just begun off at peak (54% at 10 min in). G covers
  logging; the panel keeps its job of "what can I still catch". Revisit only with data from the
  season.
- **Outside Chennai in December**, the blank Concert offers Chennai listings: one quiet section, no
  extra tap. Watch for it in feedback.
- What's on's late-log path (Past › row › "I was there") is unchanged.

## As built (2026-11-22)

- `app/src/screens/near-listings.ts`: the listings near a time, the Schedule's span and the
  listing search, pure and unit-tested (`tests/screens/near-listings.test.ts`, on the feed's
  shapes: 4:10 pm on 19 Dec, 10 min before, 5:30 pm, Shortlisted, heard and cancelled, nothing
  near, a late log, midnight).
- `app/src/store/schedule.ts` `fillFromSchedule` and `undoFill`: one transaction each, with a
  `fill` receipt (`store/receipts.ts`, local only, never synced; no Event field changed, so no
  ADR). Required tests in `tests/store/fill.test.ts`: a forced close mid-way leaves the blank
  Concert as it was; Items moved to a Shortlisted Event reach the server once each and never
  before their Event; Undo after the fill reached the server.
- `app/src/screens/listing-event.ts`: one path for "Shortlist", "I'm here" and the fill, with one
  id per attempt. `start-concert.ts`: the blank Concert, for the + and E2.
- `app/src/screens/components/ListingOffer.tsx`: the offer, "Search What's on…" and its search.
- `e2e/log-entry.spec.ts`: + › row › filled and Heard on the first Item; Undo › blank again,
  then no trace on leaving; Search What's on… › pick; no match › back; the offer gone once a
  Sabha is set, nothing near at 11:30 pm; E2 › blank Concert › "‹ What's on".

Builder's calls in the build, open to review:

- A moved Item is queued afresh at the back of the outbox, so the server never hears of it
  before the Event it moved to (an Item typed offline before the concert was Shortlisted).
- The blank Concert leaves no row only when it never left the phone and nothing was ever made
  for it; otherwise it goes as a tombstone that syncs, as an untouched one does.
- What moves with Items: an Item being typed (its draft) and the logging note, so the hero
  still reads it as being logged.
- An Artist added and not saved hides the offer, as a saved one does.
- Undo is refused ("it was changed since") once anything on the Event changed after the fill;
  the bar lasts as other Undo bars do. The fill's Undo is not in "Recently deleted".
- The search's rows read "Tue 22 Dec · 6:00 pm · Music Academy" under the name; before typing
  it shows nothing. A match on the name a concert is known by ranks above one on its Sabha, and
  that above an accompanist's ("Sanjay" finds Sanjay Subrahmanyan before Rishabh Kaushik, whose
  violinist is a Sanjay).
- From Codex's review of the build: a fill waits while a value typed on the blank Concert is
  not saved (its "Not saved" line shows); an Item being typed on both Concerts refuses the fill
  ("an Item is being typed on both Concerts"), so neither is lost; Undo is refused once an Item
  is being typed on the Event; Undo puts each logging note back as it was; and a blank Concert
  whose time was changed (a late log) comes back from Undo still marked as edited, so leaving it
  never takes it back.
