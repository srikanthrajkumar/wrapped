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
  at a time in the order entered (by the time entered, kept across retries and relaunches),
  stopping at the first that fails again; a second tap while one runs does nothing. It never
  replays a change computed from an earlier state.
- **Deletes are their own kind** (fourth review, 2026-11-02). A failed delete reads "Not
  deleted", and its Try again, from the record's row or the season-wide one, runs the whole
  delete the first tap ran: the store's delete, the Undo offer, and leaving the deleted record's
  screen. Its Dismiss keeps the record after all: the delete entry leaves the journal and the
  store is left as it is, which loses nothing, since the failed delete changed nothing
  (2026-11-03).
- **A row shows one kind** of failure, so Dismiss, which a move, a repick or a delete has but a
  value never does, takes only the entries of its own kind.
- **A saved value stays shown** until the screen reads the store back holding it, by the same
  per-field projection the journal uses, however slow the phone. Composite values never share a
  key: the Laya vinyasam's note has its own entry, apart from its Nadai. Typed text going back to
  the stored value while a write for it is running is still written, since that write may land
  after.
- **Moves and repicks are not retried.** Their meaning depends on the order or the Details at the
  moment of the tap, so a replay can undo later work. A failure says it didn't happen ("Not
  moved", "Not changed") and the rasika does it again. A failed repick stays in the journal so
  the chosen pick can be exported.
- **New records** (a Concert, an Artist or Sabha, an Appearance, a first Item pick) are one entry
  each, with their own id, shown by what identifies them (a Concert's date and time). Try again
  creates each once. Nothing merges two attempts: two failed taps are two entries.
- **Clear** removes only its row's entries contained in an Export the rasika confirms is saved,
  matched by value and time entered, never by field alone. A download that the browser may not
  have saved is not proof of handover.
- **Every Export**, plain or rescue, carries every journal entry, typed, being written or
  failed, in the state it was journalled in, after a relaunch too.
- **Failed Undos**, and an Undo while it is written, are kept the same way, beside the journal
  (one `localStorage` key per receipt, each read and checked on its own), so a deleted Concert's
  Undo bar survives a reload or a kill, and their deletion receipts are kept while the bar
  exists.
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
  entries only when the page is shown again or reloaded. For two different fields neither loses
  anything, since every entry has its own key. For the same field they do: one tab writing or
  confirming its value removes the key the other tab's value was kept under (corrected after the
  fourth review). The app runs as one installed window, so this is accepted, not handled.
- An entry lives in `localStorage`, whose writes a browser may batch: a kill in the instant
  after a value is entered could still lose it. This needs the T033 device check (Android Chrome
  installed app, iOS standalone).
- If `localStorage` can't be written at all (full or blocked), an older copy of the same field is
  removed rather than left to hide a newer stored value after a relaunch, and the screens say so.
