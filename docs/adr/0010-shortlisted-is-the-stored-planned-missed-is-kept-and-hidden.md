---
status: accepted
---

# Shortlisted is the stored `planned`; Missed is kept and no longer shown

The Season spine ([docs/designs/season-spine.md](../designs/season-spine.md), Part 1) folds
Planned into one stage before logging, named **Shortlist** by the Maintainer on 2026-11-11
("Interested" in the design). A concert is Listed, then Shortlisted, then Heard. The design left
to this ADR whether the stored word changes, what stored Missed Events become, and what that
means for the schema and sync.

**Decision.** An Event's `status` keeps its three stored values, `planned`, `attended` and
`missed`. Only their meaning on screen changes: `planned` reads **Shortlisted**, `attended` is
**Heard**, and `missed` is kept but shown and counted nowhere. No stored Event is rewritten, on
the phone or the server. Decided by the builder on 2026-11-11, as the design asked of this ADR;
the Maintainer accepts or reverses it with the pull request that carries it.

## Why the stored word stays

Renaming `planned` to `shortlisted` would change no pixel and would rewrite a rasika's records
in every place they are kept:

- on the phone: `events`, and every copy of an Event row waiting or held in `outbox`,
  `attention`, `serverSeqs.held` and the deletion receipts;
- on the server: `data ->> 'status'` in `private.events`, either by a migration behind every
  phone's `serverSeqs` (so the next push of such an Event conflicts) or by one op per Event from
  a phone that may not be the writing device (ADR 0003);
- in every Export already handed over, which a later import must still read, so both spellings
  would be accepted for good.

It would also need the store's schema version bumped and `min_app_version` raised, so that a
0.2.0 build, whose rules refuse an unknown status, never meets the new word. All of that is
risk on the paths where a failure loses data (constitution II), for a word no rasika sees.

Kept, every Event stored as Planned is Shortlisted with the same id and source by being read:
on upgrade, through sync and after a restore (SF-D21), with nothing to migrate and nothing that
can half-finish.

**The cost** is that the code says `planned` where the screen says Shortlisted. It is held in
one place: GLOSSARY.md and the comment on `EventStatus` (`app/src/model/records.ts`) say so, and
the screens take their words from `MESSAGES`.

## What changes in the rules

- **`planned → attended`** no longer has a button ("Start logging" goes). It happens:
  - when the first Item is saved, inside that Item's own transaction, so an Event with an Item
    is never left Shortlisted;
  - when the rasika says they were there on the lapse card (Items optional).
  Either marks the Event `touched` and clears a pending "schedule changed" hint, as today.
- **The listing's second button** (wording to be approved, "I'm here" in the design) makes the
  Event **Attended** at once, with `source: 'schedule'` and its Schedule entry, as the + makes a
  `spot` one. Left with nothing entered it is taken back by the rule the + already has
  (`screens/new-concert.ts`). On a concert already Shortlisted it only opens the Event ready
  for its first Item; the status waits for that Item, so backing out leaves it Shortlisted.
- **Shortlist toggled off** deletes the Event as a tombstone that syncs, with Undo (SF-D22). It
  is offered only while the Event is `planned`.
- **Lapse** (SF-D24, SF-D39). A `planned` Event has lapsed once its logging window has ended:
  four hours after its start, or the end of its day when it has no start time
  (`store/logging-note.ts`). A lapsed one is shown only on the lapse card.
  - Tapped there, it becomes `attended`.
  - Left when the card is closed, it becomes `missed`.
  - One that starts within 30 minutes of an Attended Event of the same day, or whose Schedule
    entry is cancelled, becomes `missed` without being asked.
  - One that holds a live Item becomes `attended`, never `missed`, however it came to hold one.
  Each is an ordinary status save through `mutate.ts`, with its outbox entry. The first time a
  phone runs this, every Event that lapsed before is asked about once, newest day first.
- **`missed`** (SF-D38). Events stored as Missed stay exactly as they are and are shown and
  counted nowhere: not on Season, What's on, the Shortlist, the Diary or the hero, and never as
  Now. They stay in Export, sync and restore. One Event still holds its Schedule entry, so the
  entry reads as a plain listing again and its sheet acts on that Event: Shortlist is
  `missed → planned`, and the second button is `missed → attended` (a new transition).
- **Unchanged:** only `attended` counts in the Wrapped (FR-026) and is listed in the Diary; the
  Schedule updates only a `planned` Event, and only a `planned` one carries the "schedule
  changed" hint; `attended → planned` stays in the rules, used by no screen.

## Schema and sync consequences

- **No record changes shape and no new value is stored**, so the phone store's schema version
  stays 4 and the server's `min_app_version` stays `0.2.0` (CONTRIBUTING.md, "Deploying").
- **A 0.2.0 build on another device or in another tab** reads every row this build writes: it
  shows a Shortlisted Event as Planned with "Start logging", and still shows Missed ones. That
  is the old face on the same data, and loses nothing.
- **The server** keeps each row as sent and never reads `status`, so it needs no migration.
- The app's version becomes 0.3.0 for the new face alone.

## Considered options

- **Rename the stored value to `shortlisted`.** Rejected, for the reasons above.
- **Turn stored Missed Events into tombstones.** Rejected: it deletes the rasika's records
  (constitution II), and a restore from an older Export would bring them back.
- **Turn them into Shortlisted or Heard.** Rejected: the first brings each back as a lapse
  question, the second adds concerts the rasika did not hear to the Wrapped (FR-026).
- **A fourth status for "dropped".** Rejected: `missed` already means it, and a new stored value
  is the shape change this decision avoids.
- **Hide a lapsed Event by computing it, never writing `missed`.** Rejected: the Event would
  read Shortlisted in every Export and on any other device for good, and would be asked about
  again after a restore.
