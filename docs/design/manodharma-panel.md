# Manodharma's panel

A follow-up to [item-editor.md](item-editor.md) §4 and §5, raised by the user while reviewing the
Item editor. One decision.

**Status:** signed off by the user on 2026-11-21: **B**, a panel fold. Built on branch
`design/manodharma-panel` (`PanelFold` in `fold.tsx`), and applied to DESIGN.md. The options
were drawn in the app itself (a temporary switch picking the option), shot at 390×844 (2x) in
light and dark with the hill-climb seed: "Vatapi" for a closed Manodharma and "Chakkani Raja"
(Alapana, Kalpanaswaram in three Ragas, the Layavinyasam with its note) for an open one. The
script is `app/e2e/screens/manodharma-shots.ts` (not committed). The shots are on the Artifact
page "Manodharma panel": https://claude.ai/artifact/Ba4YBkZYc19bmbCi5XjXvA

## The mismatch

Closed, Manodharma is a bare label with a chevron, "Manodharma ⌄", on the page. The
Layavinyasam under it is always a one-row grey panel. Side by side, one looks like a heading and
the other like a row, though both are something you turn parts on in.

Measured today (main acc2698), closed: the label's text ends 24px over the Layavinyasam's panel,
not 32, since the fold's 48px row and its 16px under the Details are set for a label over its
own panel.

## The decision: does Manodharma get its panel when closed?

**B (recommended): a panel fold.** Closed, Manodharma is a one-row panel, like the
Layavinyasam's: "Manodharma" in Strong, the chevron on the 24px column. Opening grows that same
panel by the four parts, a hairline under the title row. The title row is the fold's one target,
48px, spoken "Manodharma, collapsed / expanded" as today.

- Panels stand 32px apart: the Details, Manodharma, the Layavinyasam.
- Closed, the page is 36px taller than today to the Layavinyasam's foot (560 against 524).
- Open, 20px taller than today (992 against 972): the title is a 48px row inside the panel
  rather than a label 8px over it.
- What stays: open when the Item has any part, otherwise closed; only a tap opens or closes it;
  it grows over 200ms (DESIGN.md "Folds").

**C: always open.** No fold. "Manodharma" is a label over a panel of the four rows, as every
other group. Closed today becomes 212px taller (Layavinyasam's foot at 736): on a plain kriti the
four empty rows take most of a screen.

**A: as built.** The fold's label on the page, and its panel only when open.

## The DESIGN.md change

The Manodharma bullet ("a fold holding Alapana, …") gains: "The fold is its own panel: closed,
one 48px row, 'Manodharma' with its chevron, as the Layavinyasam's one-row panel under it;
opening grows that panel by the parts, a hairline under the title." And a Decisions Log row.
