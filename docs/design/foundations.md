# Foundations: grid, rhythm and type

The first spec of the design process (phase 2), and the one every component spec builds on.
Signed off by the user on 2026-11-16, one decision at a time. The decisions:

- **Decision 1, the gutter and column:** C, panels everywhere.
- **Decision 2, vertical rhythm:** B, even.
- **Decision 3, the type scale:** B, a 17px label.

It settles the inventory's inconsistencies 1, 2 and 4 ([inventory.md](inventory.md)): text that
jumps between 24px and 16px, five section-label styles, and four page-title styles.

**Status:** a spec only. No app code has changed. DESIGN.md is not yet edited; the proposed
change is in [foundations-design-md.diff](foundations-design-md.diff).

The mocks, the options set aside and the council's reviews are on the Artifact page "Wrapped
Grid and Type". Each decision was reviewed in two rounds by two Claude reviewers and Codex,
on its own question only:

| Decision | Round 1 | Round 2 |
| --- | --- | --- |
| 1, gutter and column | 8, 8, 8 | 9, 9, 9 |
| 2, vertical rhythm | 8, 8, 7 | 9, 9, 8 |
| 3, type scale (on option A) | 7, 8, 7 | 9, 9, 9 |

The user chose B for decision 3. B was Codex's round-1 preference. The round-2 rules carry over
to B unchanged.

## 1. Grid: two edges

The grid is 8px, with 4px half-steps (IBM Carbon's 2x grid). Every number below is on it.

| Rule                  | Value                                                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fill edge             | **8px** from the screen, for every fill: panels, fields, the search bar, bottom buttons, the Undo bar.                                                                                                                 |
| Text edge             | **24px** from each side (8 + a 16px inset), for every label, row, title, count and mark.                                                                                                                               |
| Corners               | **16px** for every fill on the 8px edge. Today's values differ: panels 18, the search field 14, buttons 18, the Undo bar 14. The curtain's sheet edge keeps its **18px** (the user's call, 2026-11-14).                 |
| Which lists get panels | Any group of rows under one label gets one panel: a hub section, a What's on day, a Shortlist day, the Event's Items and Stage, a Settings group. A one-row group gets one too. A fold inside the group ("Earlier today") is its first row. A section with no rows (the hub's Shortlist line) has no panel. |
| Columns inside a list | Start on 24. An Item's number is right-aligned, in tabular figures, in a 24px box from 24; then 8px; then its title, at 56.                                                                                           |
| Marks and targets     | A mark's ink ends on 24 (chevrons, ⋯, +, stars, the colour dot). Its 48px tap area may reach into the 16px inset.                                                                                                     |
| Screen chrome         | Full-bleed, not on the 8px edge: the curtain, the status band, the tab bar, sheets and the dialog. Inside a sheet or dialog the same two edges apply, measured from its sides.                                          |
| Over a bottom fill    | The page fades out over 24px above anything fixed at the bottom, so no row is cut hard.                                                                                                                                 |
| A field in a panel    | Sits on the panel's text column (24 from the screen), not on the 8px edge: the panel is its fill's edge (the user, 2026-11-17).                                                                                         |

The 16px "screen gutter" is retired as a design value. The `<main>` padding that produces the
two edges is a build detail.

## 2. Rhythm

Every gap is measured between line boxes, never from the ink of a letter. Line boxes are the
4px-grid line heights. A 48px tap area (a section header, "Edit order", the Stage +) may reach
into a gap and never adds height.

| Space                  | Value                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Inside a row           | **12** above and below. Two lines are 68px, three are 88px: +24 for a wrapped name or title line (Body), +20 for each Sub line. A one-line row is at least 48px, its text centred, and the minimum wins. |
| Between sections       | **32**, from the last thing above (a panel's edge, or the last line where a section has no panel) to the next label.                       |
| Label to its panel     | **8**                                                                                                                                       |
| First section          | **16** under the curtain's foot (where the sheet's curve ends) on the hub, and under the strip's text on What's on.                         |
| Slot caption           | **12** under the row or panel edge above it, **8** over its first row.                                                                     |
| Page title             | **16** from the top on a tab page; **8** under the top bar on a pushed page.                                                                |
| Title block to content | **24**. On the Event, the block is the title and its facts line together.                                                                    |
| Scroll room            | **24** above the top of whatever is fixed at the bottom (the search bar, Add Item, the tab bar), so the last row always scrolls clear.        |

DESIGN.md's 64px two-line row becomes 68px. The 10px padding behind 64 was off the grid. With
the 20px second line, an even padding can only give 60, 68 or 76.

## 3. Type

Source Sans 3. Six sizes, three weights (400, 600, 700). Every line height is on the 4px grid.

| Level      | Token          | Size / line | Weight, colour                  | Used for                                                                                                                                                         |
| ---------- | -------------- | ----------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display    | `text-display` | 32 / 40     | 700, ink                        | The Welcome title, the Concert summary's numbers                                                                                                                 |
| Page title | `text-heading` | 24 / 32     | 700, ink                        | Every page's first block (tab pages, What's on, the Event, the Item editor, first launch, rescue); the curtain's "Season" and its hero concert              |
| Title      | `text-title`   | 20 / 28     | 600, ink                        | Sheet and dialog titles; a hero choice's names                                                                                                                    |
| Body       | `text-body`    | 17 / 24     | 400, ink                        | Row names, running text, field values                                                                                                                            |
| Strong     | `text-body`    | 17 / 24     | 600, ink                        | **Every label above a panel or a summary line** (hub sections, days, Items, Stage, Note, Improvised, Settings groups); an Item's title; buttons; an Empty's title |
| Sub        | `text-sub`     | 15 / 20     | 400, muted                      | Every second line (the Event's facts line too); counts and times; facts; field labels; rows inside a panel such as "Earlier today"; quiet buttons                |
| Caption    | `text-caption` | 13 / 16     | 400, muted, one line, cut with … | The instrument after a name ("Veena"); a search row's kind word ("Artist", "Raga"); the Item editor's eyebrow; the strip's weekday; tab words                     |

- **Place decides level, not look.** A label above a panel is Strong. A label inside a panel is
  a row (Sub, or Body for a row's name). A time or a count is never a Caption.
- **One emphasis rule.** What is live or selected is 600, in ink, at its own size:
  - Live: a concert under way ("On now", the time after a dot), one starting within the hour
    ("in 15 min"), and the hero's word ("Now", "Next").
  - Selected: the strip's chosen day, the tab that is on, a pressed chip or toggle.

  Nothing else changes weight inside a level.
- **Mixed sizes on one line sit on one baseline** ("Items" with "Edit order").
- **Tokens.** All six size tokens stay under their names. Nothing is renamed or added.
  - `text-title` now serves only sheets, the dialog and a hero choice, because the hub's section
    header leaves it.
  - The 500 weight goes; the strip's chosen day takes 600.

**Where today's styles go:**

| Today                                                                   | Becomes                                  |
| ----------------------------------------------------------------------- | ---------------------------------------- |
| Hub section header, 20/600 ink                                          | Strong, 17/600 ink                       |
| The Event's "Items" and "Stage", 15/600 muted                           | Strong                                   |
| What's on and Shortlist day labels, 15/600 muted                        | Strong                                   |
| Fold titles ("Note", "Improvised"), 15/600 muted                        | Strong                                   |
| Settings' "Theme", 15/400 muted                                         | Strong                                   |
| "Earlier today", 15/400 muted                                           | Sub, a row in its day's panel            |
| Slot and lapse-day captions, 13 muted                                   | Sub                                      |
| Page titles: tab pages, What's on, the curtain, 24/700                  | Page title (unchanged)                   |
| The Event's and the Item editor's titles, 20/600                        | Page title, 24/700                       |
| First launch's "Getting ready" and rescue's titles, 20/600              | Page title, 24/700                       |
| The Event's facts line, 17 muted                                        | Sub                                      |
| Field labels: 15 on the facts sheet, 13 in the Item editor and Nadai    | Sub, both                                |
| "In 15 min", "On now" and a live time: 400 ink                          | 600 ink (the emphasis rule)              |
| The strip's chosen day, 500                                             | 600                                      |

## 4. What changes for each inventory unit

Only what these three foundations decide. Where a unit has its own question that the foundations
don't answer, it is marked **(spec)** and waits for that unit's spec in phase 2.

| Unit                                | What changes                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01 Status band                     | Nothing.                                                                                                                                                                                                                           |
| U02 Tab bar                         | Words are Caption. The tab that is on is 600 ink (as today). The gap between icon and word goes from 2 to 4. Its top line stays (the user, 2026-11-17). (spec) Whether the words are too small.                                                 |
| U03 Install strip                   | Text is Sub, on the 24 edge. (spec) Its 36px and 44px heights, and Android's 44px button.                                                                                                                                       |
| U04 Bottom bar frame                | Its fill sits on the 8 edge (the frame's padding goes from 16 to 8). Buttons have 16px corners. A 24px fade above it. 24px of scroll room.                                                                                           |
| U05 Curtain                         | The first section sits 16 under its foot. The sheet edge keeps 18px.                                                                                                                                                              |
| U06 Hero                            | The concert is Page title (unchanged). Its word is Sub, 600 ink. Its line is Sub. A choice's names are Title.                                                                                                                      |
| U07 Tab header                      | The title is 16 from the top, then 24 to the content (was 8).                                                                                                                                                                   |
| U08 Pushed top bar and page title   | The title sits 8 under the bar everywhere (the new Item was 4, the edited Item 12). The Event's and Item's titles become Page title. The title block (with the facts line) is 24 to the content. The eyebrow is Caption. The ⋯ ink ends on 24. |
| U09 Section header                  | The label is Strong (was 20/600). 32 above, 8 to its panel. The count is Sub. The chevron's ink ends on 24. The Shortlist line is Sub, with 600 ink for its live parts.                                                                      |
| U10 Panel                           | Used for every group of rows on every page. Corners 16 (were 18). Edge 8, inset 16.                                                                                                                                              |
| U11 Section label (older)           | Becomes Strong in ink, 32 above and 8 to its panel. The Event's hairline under the label goes; the panel replaces it. (spec) "Today" against "Mon 14 Dec" on What's on.                                                                       |
| U12 Caption label                   | Becomes Sub, inside the panel: 12 above, 8 to its first row. (spec) Whether the slot time repeats each row's time; the count's alignment.                                                                                        |
| U13 Fold / accordion                | Fold titles are Strong. "Earlier today" is a Sub row, at least 48px, first in its day's panel. (spec) Its motion, and Role's "More".                                                                                           |
| U14 Concert row                     | On a panel everywhere. Padding goes from 10 to 12 (68/88). The name is Body; the lines are Sub; live parts are 600 ink; the instrument is Caption, kept on one line. (spec) A leading kind mark pushes the name off the 24 column.            |
| U15 Hub Diary row                   | Padding 12; its line is Sub. (spec) Whether it becomes a ConcertRow.                                                                                                                                                              |
| U16 Lapse question                  | The question is Strong (was 20/600). Rows have 12 padding, so a row with its 48px button is 72px. "None of these" is Strong. (spec) The pill "Yes".                                                                              |
| U17 Item row                        | On a panel. Padding goes from 10 to 12. The number box is 24 at 24, then 8, then the title at 56 (was 2ch + 12). The title is Strong; the line is Sub. Ordering rows go from 8 to 12.                                                               |
| U18 Stage row                       | On a panel. Padding goes from 8 to 12. The role is Sub. The colour dot's ink ends on 24.                                                                                                                                          |
| U19 Settings row                    | Groups on panels. One-line rows are at least 48px. "Theme" is Strong. The version lines are Sub.                                                                                                                                        |
| U20 Strip of days                   | The first stop's text sits on 24. The chosen day is 600 (was 500). The weekday is Caption. The first section is 16 under its text.                                                                                                       |
| U21 What's on search bar            | On the 8 edge, with 16px corners (were 14). The search mark sits on 24. The text is Body.                                                                                                                                                  |
| U22 What's on search sheet          | The field has 16px corners. Names are Body; the kind word is Caption. A toggle that is on is 600 ink. The no-match line is Sub. (spec) The two × marks, and whether no-match becomes an Empty.                                              |
| U23 Docked search                   | The field has 16px corners, on the sheet's 8 edge. The note is Sub.                                                                                                                                                                       |
| U24 Search result rows              | Two-line rows are 68px and one-line rows 48px. The kind badge is Caption. (spec) A name at 400 or 600 in each list; the best match's fill.                                                                                                |
| U25 Sheet (frame)                   | The title is Title. Content follows the two edges from the sheet's sides (text at 24, was 16). The close mark's ink ends on 24.                                                                                                 |
| U26 Listing sheet                   | Facts are Body; roles are Sub. The buttons sit on the 8 edge with 16px corners.                                                                                                                                                  |
| U27 Calendar sheet                  | The month is Title; weekday heads are Caption. Today is 600 (the strip's chosen day matches).                                                                                                                                       |
| U28 Event facts sheet               | Field labels are Sub. Fields have 16px corners (were 14), on the 8 edge.                                                                                                                                                          |
| U29 Name picker                     | The title is Title. Rows follow U24. (spec) The "Add Artist" and "Sabha" titles.                                                                                                                                                  |
| U30 Artist sheet                    | The name is Title. The "Role" label is Sub. Buttons have 16px corners.                                                                                                                                                                    |
| U31 Colour sheet and swatch         | Swatch names and the "Second colour" label are Sub. Buttons have 16px corners.                                                                                                                                                           |
| U32 Colour dot                      | Its ink ends on 24.                                                                                                                                                                                                                |
| U33 Detail input sheet              | "Now: …" and the "Nadai" label are Sub (Nadai was 13).                                                                                                                                                                           |
| U34 Schedule changed                | Facts are Body. The buttons sit on the 8 edge with 16px corners. The hint's ink ends on 24.                                                                                                                                       |
| U35 Concert summary                 | The numbers are Display. Their words ("Items", "Ragas"), the "First Ragas" and "New Composers" labels (2026-11-17) and the facts line are Sub. Padding is 24 from the dialog's sides (as today). (spec) The time breaking from "pm".          |
| U36 Empty state                     | The title is Strong; the line is Sub. (spec) Its spacing and its mark, tile or bare.                                                                                                                                                    |
| U37 Button                          | 16px corners (were 18), labels Strong. (spec) The pill "Yes".                                                                                                                                                                            |
| U38 The + (every one)               | Marks end on 24. "+ Add Artist" in the title takes Page title; "+ Add Sabha" in the facts line takes Sub. (spec) Mark sizes, 28 against 20.                                                                                    |
| U39 Quiet text button               | Sub (unchanged), on its label's baseline.                                                                                                                                                                                        |
| U40 Underlined value                | The Event facts line goes from 17 to 15 (Sub). Detail cell labels go from 13 to 15 (Sub). Values are Body. (spec) The underline on the facts line reads as a link.                                                                                      |
| U41 Chip                            | Sub (unchanged); pressed is 600 (unchanged).                                                                                                                                                                                      |
| U42 Text toggle                     | Body; on is 600 ink (unchanged).                                                                                                                                                                                                  |
| U43 Theme track                     | The track sits on the 8 edge with 16px corners. (spec) Its inner corners.                                                                                                                                                       |
| U44 Undo bar                        | On the 8 edge (its wrapper's 16 goes to 8), 16px corners (were 14), text on 24, Body.                                                                                                                                              |
| U45 Feedback rows                   | All are Sub with an 8px gap after the spinner or mark. Rows are at least 48px (SafetyRow was 44).                                                                                                                                     |
| U46 "⋯" menu                        | Items are Body. "Recently deleted" is Sub. (spec) "Delete" in red.                                                                                                                                                                 |
| U47 Small marks                     | The star, the dot and the cancelled mark end on 24 where they end a row. (spec) The kind mark's place, and the amber dot's 10px.                                                                                               |
| U48 First launch and rescue         | Welcome stays Display. The other titles become Page title (were 20/600). Buttons sit on the 8 edge with 16px corners.                                                                                                               |

## 5. For later

Raised by the council or the user while deciding. These are not part of these foundations;
each goes to its unit's spec or to the phase 4 passes.

- **Contrast at low brightness:** the panel fill, hairlines, muted Caption, and 600-on-15
  emphasis. Check with bold text and at 200% text, where the 24/17 step between title and label
  is the first to blur.
- **The kind mark:** a leading kind mark (the Lecdem icon) pushes that row's name off the 24
  column (U14, U47).
- **What's on day words:** the strip says "Today" while the day label says "Mon 14 Dec"
  (inventory duplicate 13).
- **The Shortlist slot:** its time repeats each row's time, and its count needs an alignment.
- **The Event's facts line:** it is underlined like a link (it opens the facts sheet).
- **"Earlier today":** needs its own component spec (motion, count).
- **Long lines:** need a cut-off rule beyond the row's own.
- **Scroll room:** check in the build that the last row clears the bottom stack.
- **The tab words:** may read small.

## 6. Proposed DESIGN.md change

[foundations-design-md.diff](foundations-design-md.diff), not applied. It covers:

- the frontmatter (row heights, the gutter);
- "Typography";
- "Layout" spacing;
- "The section pattern" (every page; the label in Strong);
- "The row" (12px, 68px);
- "Shapes" (lists on panels).
