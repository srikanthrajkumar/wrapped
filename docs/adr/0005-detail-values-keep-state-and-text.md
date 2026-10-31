---
status: accepted
---

# Detail values keep their state and text; shared facts are linked, not written in

Every Detail of an Item that can be in doubt is stored as a Detail value, not a bare string. A
Detail value records how the rasika entered it (catalog, Override, Unknown, Not applicable or
Unresolved), the catalog key if any, the text as entered, and a not-sure flag for a Guess.
Last season's sheet shows why. Its 10 composer cells marked "?" meant two things: 7 were RTPs,
where a composer is Not applicable, and 3 were genuine unknowns. A plain string can't tell
them apart, and the Wrapped counts them differently. Decided 2026-10-29; full shape in
`specs/001-season-logger/data-model.md`.

## Considered options

- **Plain strings with "?" and "-"**: last season's approach. It merges Unknown with Not
  applicable and loses whether a value overrode the catalog.
- **A separate Override table**: two places to read every Detail, and an Override can be lost
  by a missed join.
- **Rewriting a rasika's Appearances when Artists are merged or promoted**: loses the text as
  typed, and lets the server and the phone both write the same row, which breaks
  last-write-wins (ADR 0003).

## Consequences

- **A Guess is a flag, not a state**: "Vararaga (?)" stays a catalog, Override or Unresolved
  value and counts as that value.
- **Overrides are never reset**: a catalog update rewrites keys but never state.
- **Merges and promotions resolve on read**:
  - when a rasika merges two Artists or Sabhas, the merged-away record points to the survivor;
  - when the Maintainer promotes an entry, the server writes a separate Link row.
  Appearances are never rewritten, and readers follow the pointer or Link.
- **No separate Plan or Tani avartanam records**:
  - a Plan entry is an Event with status Planned;
  - a Tani avartanam is a Detail of the Item it followed.
- **The Wrapped and Cards are computed, never stored** (constitution III). Only the log is the
  record.
