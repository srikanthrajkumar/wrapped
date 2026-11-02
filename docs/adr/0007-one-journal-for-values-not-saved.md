---
status: accepted
---

# One journal for values not yet confirmed in the phone store

Every value the rasika enters is written to one `localStorage` journal the moment it is entered,
one entry per field of a record (and per new record, by its own id), and an entry leaves only
when the phone store is read and seen holding that exact value, through a projection per field
(the record's column compared with the value as entered). That rule alone covers a failed write,
a kill mid-write, a reload, iOS ending the page and a relaunch, so nothing typed is lost
(constitution II, IV). Decided by the Maintainer on 2026-11-02, after the third `/review` of
PR #5 found new holes in the rescue code for the third round running: the code had grown to about
530 lines of intent merging, delta replays, two-tab sync and export marking, and most of that
round's serious findings came from those parts.

## The contract

- **Try again** re-applies the absolute value entered, through the same store action, one entry
  at a time in the order entered. It never replays a change computed from an earlier state.
- **Moves and repicks are not retried.** Their meaning depends on the order or the Details at the
  moment of the tap, so a replay can undo later work. A failure says it didn't happen ("Not
  moved", "Not changed") and the rasika does it again. A failed repick stays in the journal so
  the chosen pick can be exported.
- **New records** (a Concert, an Artist or Sabha, an Appearance, a first Item pick) are one entry
  each, with their own id, shown by what identifies them (a Concert's date and time). Try again
  creates each once. Nothing merges two attempts: two failed taps are two entries.
- **Clear** removes only entries contained in an Export the rasika confirms is saved, matched by
  value and time entered, never by field alone. A download that the browser may not have saved is
  not proof of handover.
- **Export** carries every journal entry, typed, being written or failed.
- **Failed Undos** are kept the same way, beside the journal (one `localStorage` key per
  receipt), so a deleted Concert's Undo bar survives a reload, and their deletion receipts are
  kept while the bar exists.
- **One window.** The app runs as one installed window, so the journal is not synchronised
  between tabs; it is only read again when the page is shown again (`pageshow`).

## Considered options

- **Keep the merged model** (one entry per intent, deltas replayed against current state, export
  marking by field, `storage`-event sync): each piece fixed a real case, but together they kept
  producing ways for a later success, a parallel retry or a stale marker to erase or overwrite
  what the rasika entered.
- **Retry moves and repicks by re-deriving them** (move by places from where the record is now,
  repick keeping fields saved since): tried in the second round; a retried move still lands
  somewhere the rasika didn't choose, and a retry read at retry time still overwrites a Detail set
  after it.

## Consequences

- An entry can outlive a successful write until the store is read back; a projection that
  disagrees with how the store keeps a value leaves the entry behind, so each field's projection
  is tested.
- Two open tabs share the journal's storage but don't hear each other: each sees the other's
  entries only when the page is shown again or reloaded, and neither loses them, since every
  entry has its own key.
