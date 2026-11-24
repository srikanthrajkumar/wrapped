---
status: accepted
---

# A Lecdem has at most six presenters

FR-013 allowed a Lecdem at most 3 presenters (`MAX_PRESENTERS` in `store/rules.ts`). The
Music Academy's 2026-27 Academic Sessions have 27 lecdems, and one is a panel: "Articles in
100 years of the Journal" (21 Dec, 08:10), with 5 speakers billed as presenters. At 3 the app
refuses that entry whole, so the feed holds it out. The user raised the limit to 6 on
2026-11-24.

## The rule

- A Lecdem has at most **6** Appearances with the presenter Role. A 7th is refused with the
  same rule, "a Lecdem has at most 6 presenters", wherever it comes from: an Artist added or
  given the Role, a change of kind to Lecdem, an Undo, or a Schedule entry or version.
- A refused Schedule entry or version still changes nothing, and a refused Undo still keeps its
  receipt.
- Nothing stored changes shape. Every Lecdem valid at 3 is valid at 6.

## Why 6

The panel needs 5. A 6th leaves one spare for a panel of that size. The limit still catches a
feed that bills a whole list of names (a lecdem's demonstrators, say) as presenters, which is
the mistake the rule was there to stop.

## How the screens show them

Six names wrap a row to four lines and the hub's hero to six. So a row (What's on, the
Shortlist, the Diary) and the hero show **2 whole names, then "+N"**, from 4 presenters up, for a
Lecdem and a Harikatha alike (`leadNames` in `screens/fit-names.ts`). "+N" is spoken "and N
more". Up to 3 show in full, as before, so nothing the rasika already sees changes. The Event's
Stage lists everyone. The user chose this on 2026-11-24, from shots of the built app.

## Considered options

- **No limit.** Rejected: a mis-billed feed would then fill a Lecdem's heading with every name
  on the bill, and nothing would flag it.
- **Hold the panel out and keep 3.** Rejected: the rasika can't pick a real Academy session.
- **5, the panel's exact count.** Rejected: no room for a panel one larger.
