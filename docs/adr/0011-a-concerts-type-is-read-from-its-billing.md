---
status: accepted
---

# A concert's type is read from its billing, never stored

A row on What's on, Starting soon and the Shortlist names a concert's type when it isn't vocal
("Violin", "Flute", "Veena", "Jugalbandi"), since the pick turns on who is on stage
([docs/designs/season-spine.md](../designs/season-spine.md), Part 4). The type is worked out on
screen from the Roles the Schedule bills, or the Event's Stage, each time the row is drawn. It
is never written to an Event, the Schedule or the server, so no record changes shape
(constitution VI) and it never overrides what the rasika logged (constitution III). The rule is
the design's first cut, recorded here by the builder on 2026-11-11.

## The rule

- **Accompanying Roles:** violin, mridangam, ghatam, khanjira, morsing, thavil, nattuvangam
  and vocal support; anyone the Schedule bills as support; and `other` (a tabla, say) when it
  is billed beside a lead.
- **Leads** are the billed Artists whose Role is not an accompanying one; with none, the first
  billed. This is the known-by rule (`store/stage.ts`), which already names a Concert by its
  violinists when nobody else leads (the Maintainer, 2026-11-10).
- **The type** is the leads' Role. Vocal shows nothing, as 276 of the 415 concerts in the
  2026-27 feed are vocal and a mark on most rows says nothing. Two leads of different Roles
  are a **Jugalbandi**. Violin is the type only when no other lead is billed.
- **No type** when the billing carries no Roles at all, or bills nobody: the row reads as a
  vocal one does.
- **A Lecdem, a Dance and a Harikatha** keep their kind's mark and take no type.

The type's own marks (words or icons) are still open; the rows show the word.

## Considered options

- **Store the type on the Event.** Rejected: it is a second copy of the Stage that a later
  Role edit would have to keep in step, and a shape change for what a row can read.
- **Mark every row, vocal included.** Rejected by the counts above.
