# The list row

The second spec of phase 2. The user signed it off on 2026-11-16, one decision at a time.

The decisions:

- **Decision 1, variants:** A, four kinds of row.
- **Decision 2, anatomy:** A, with time first on the facts line.
- **Decision 3, states and edge cases:** A, with the word "Cancelled" shown in the facts line.

Today the row is built eight ways (inventory U14 to U19 and U24), and most of the new rhythm
lands in rows.

**Builds on:** [foundations.md](foundations.md), as signed off. Rows are 12px above and below
(68px for two lines, 88 for three). Text sits on a 24px column on panels. The type roles apply.
These DESIGN.md rules stay as they are:

- The name wraps and is never cut.
- A printed title takes two lines at most.
- Accompanists take one line, whole names, then "+N".
- Pressed is 0.6 opacity.

**Out of scope:**

- **Integration:** which rows appear on which page, and the hero concert repeating under Today
  and Diary.
- **Search behaviour:** order and the best match. These wait for the search spec. The search
  result row's look is in scope.

**Status:** a spec only. No app code has changed. The proposed DESIGN.md change is in
[row-design-md.diff](row-design-md.diff). It applies on top of
[foundations-design-md.diff](foundations-design-md.diff). Neither diff is applied.

The mocks, the options set aside and the council's reviews are on the Artifact page "Wrapped
List Row". The council was two Claude reviewers and Codex, reviewing the recommended option of
each decision only:

| Decision | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| Variants | 7, 7, 9 | 9, 8, 9 | |
| Anatomy | 7, 7, 8 | 8, 8, 9 | |
| States | 7, 6, 9 | 7, 6, 8 | 8, 7, 9 |

The states decision needed a third round, after mock errors were fixed and checked at 2x.

## 1. Variants: four kinds

| Kind | Job | Rows |
| --- | --- | --- |
| **Concert** | A concert, heard or not. | The hub's Today and Tomorrow, the hub's Diary row, What's on, Shortlist, the Diary, and the lapse question's rows. |
| **Item** | A logged Item of a concert, in its sung order. | The Event's Items. |
| **List** | Anything else that names a thing, whatever a tap does: open, pick, toggle, run. | Stage, Settings, both search lists. |
| **Action** | A one-line reply to its group's question. | "None of these" (or "None of the rest"), "? Don't know", "Use what I typed: “…”", "Add “…” as a new Artist" (or Sabha). |

- **Picking the kind needs no judgement.** A row that names a thing is a Concert, Item or List
  row. A row that answers its group is an Action row. So Settings' Export is a List row.
- **One tap per row.** The whole row is one target. A row may carry at most one nested 48px
  control at its right, with its own spoken name: the lapse "Yes", the Stage colour dot, or the
  schedule-changed hint.
- **A concert's second line follows one stored fact, its status (ADR 0010), never the clock.**
  - Heard: no star and no marks, and its Item count.
  - Not yet heard: its time or how close it is, a star when Shortlisted, and the cancelled and
    changed marks.
- **Not rows:**
  - "Earlier today" is a fold (U13).
  - The Shortlist slot's "4:00 pm · 2" is a label (U12).
  - The hub's Shortlist line is part of its section header (U09).
  - The Theme control is its own control (U43).

## 2. Anatomy

| Kind    | Leading                                                                                                           | Lines                                                                                                                                                                                                                                                                                                       | Trailing                                                                                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concert | None. The name always starts on the column.                                                                         | 1. The name (Body), then its kind mark and instrument word (Caption), kept with its last word.<br>2. The printed title (Sub, two lines at most), when there is one.<br>3. The accompanists (Sub, one line, whole names then "+N"), when there are any.<br>4. The facts, time first: "when · Sabha", plus "· N Items" once heard (never "0 Items"). | The trailing column (section 3). No chevron, ever.                                                                                                                                                          |
| Item    | The number, right-aligned in tabular figures, in a 24px box from the column, then 8px (title at 56).                | 1. The title (Strong), then the Laya mark.<br>2. "Raga · Composer" (Sub).                                                                                                                                                                                                                                 | None. No chevron.                                                                                                                                                                                          |
| List    | An optional 20px mark in a 24px box, then 8px (text at 56). Within a panel, every row has one or none does.        | 1. The title (Body).<br>2. Optional, one line (Sub): the row's own facts in a fixed order per kind. A row with no facts is one line, at least 48px.                                                                                                                                         | At most one of: a value (Sub, "Last: 2 Nov"), a check (picked), or a chevron (only when the tap opens a page). A kind word (Caption, "Artist", "Raga") sits before a check when both show. A nested control (the colour dot). |
| Action  | None.                                                                                                             | One line, Strong. Its words carry any sign ("? Don't know").                                                                                                                                                                                                                                                | None.                                                                                                                                                                                                      |

### "When"

"When" leaves out what a label above already says:

| Where the row sits | "When" is | Example facts line |
| --- | --- | --- |
| Under a day label (What's on, a Shortlist day, the hub's Today and Tomorrow) | The time | "7:45 pm · Krishna Gana Sabha" |
| Under a time label (a Shortlist slot) | Nothing; once under way, "● On now" | "Music Academy"; "● On now · Music Academy" |
| No label above (the Diary, the hub's Diary row) | The day and time | "Sun 13 Dec · 6:45 pm · Sri Parthasarathy Swami Sabha · 3 Items" |

- **The hub's rows of today** lead with how close the concert is, in 600 ink: "in 20 min",
  or "● On now". This is unchanged from DESIGN.md.
- **A live dot leads the line,** 8px before its words: "● 6:00 pm · Music Academy" or
  "● On now · Narada Gana Sabha".
- **Under a time label,** where no time shows, a concert under way reads "● On now · Sabha"
  (the user, 2026-11-17).

### Kind words

- A kind word marks a row whose kind differs from its list's own: a Raga in a song search.
- A list of mixed kinds marks every row: What's on's search.

## 3. States and edge cases

| Case                   | Rule                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pressed                | 0.6 opacity while held, no fill.                                                                                                                                                                                                         |
| Live                   | The facts line leads with the dot and its words in 600 ink. On the hub, "in 20 min" is in 600 ink inside the hour.                                                                                                                       |
| Selected               | A picked search row ends in a check, after its kind word. A pressed chip or toggle is in 600 ink. The best match's fill belongs to the search spec.                                                                                       |
| Cancelled              | The whole row at 60%, star included. **The word "Cancelled" replaces the time in the facts line: "Cancelled · Music Academy".** The cancelled mark (passive, muted) sits in slot 2. Spoken "Cancelled". Pressed while cancelled: 0.6 on top, while held. |
| Schedule changed       | Its 48×48 control in slot 2, named "Schedule changed". The star in slot 1.                                                                                                                                                               |
| Cancelled and changed  | The changed control takes slot 2, because it can be acted on, and keeps its own spoken name. The row keeps "Cancelled" and its 60%.                                                                                                      |
| Lapsed                 | A Shortlisted concert asked about, under "Were you there". It shows no star, its time and Sabha, and a 48px-tall "Yes" at its right. One tap: the row opens the concert, as any Concert row does, and "Yes" is its own target beside it (the user, 2026-11-17). "None of these" is an Action row under the last one. |
| Heard, no Items        | No "0 Items". The facts line simply ends.                                                                                                                                                                                                |
| Long name              | Wraps, never cut, its lines balanced. The star takes 24px (16 and an 8px gap) from its first line only. The instrument word stays with its last word.                                                                                     |
| Long facts line        | Rules in this order: break at a "·" first; a fact longer than a line wraps inside itself; stop at two lines. On the second line the Sabha is cut with "…" before anything else, so the Item count always shows (the user, 2026-11-17). Line 1 is the time and any whole facts that fit. The "·" at a break is dropped. Examples: "7:00 pm" / "Sri Parthasarathy Swami Sabha, Vidya Bharathi K…"; "Sun 13 Dec · 6:45 pm" / "Sri Parthasarathy Swami… · 3 Items". |
| Accompanists           | One line, whole names, then "+N" (unchanged).                                                                                                                                                                                            |
| Printed title          | Two lines at most, then "…" (unchanged).                                                                                                                                                                                                 |
| Row height             | No cap. 68px with two lines; then +24 for a wrapped name or title line (Body) and +20 for each Sub line (a printed title, accompanists, a second facts line). |
| No time                | "When" is left out, and the facts line starts with the Sabha.                                                                                                                                                                            |
| Nobody billed          | The name is the Sabha, so the facts line doesn't repeat it: "9:00 am".                                                                                                                                                                   |
| No Artist and no Sabha | The name reads "No Sabha yet", and the facts line holds the rest.                                                                                                                                                                        |
| Something to fix       | A Settings row's mark and title turn amber.                                                                                                                                                                                              |
| Tap target             | The whole row, at least 48px, with its focus ring inside it. A nested control is a 48×48 box (wider for a word, as with "Yes"), its ink ending on the column.                                                                              |
| Divider                | The hairline inside each row's foot, across the text column (24px to 24px). The last row in a panel has none.                                                                                                                            |
| Trailing column        | 48px wide, with its marks' ink on the column. Slot 1: the star, on the name's first line. Slot 2: the cancelled mark or the one nested control, on the row's last line, so a 68px row keeps a line between them. A row with neither has no trailing column; its star ends the name's first line on the column. |
| List row's control     | A List row's one nested control (the Stage colour dot) sits on the row's last line, as a Concert row's slot 2: centred on a one-line row, on the role's line under a wrapped name (the user, 2026-11-17). |

## 4. Each current row, mapped

| Unit | Today | Code | Becomes | What changes |
| --- | --- | --- | --- | --- |
| U14 | Concert row | `ConcertRow.tsx:69–218`, used at `HubScreen.tsx:551`, `WhatsOnScreen.tsx:1126`, `ShortlistScreen.tsx:97`, `DiaryScreen.tsx:52` | Concert | See the list after this table. |
| U15 | Hub Diary row | `HubScreen.tsx:305–326` | Concert, heard | Becomes a ConcertRow. It gains its accompanists and the Diary page's facts line ("day · time · Sabha · N Items"). |
| U16 | Lapse row | `HubScreen.tsx:470–496` | Concert, with "Yes" as its nested control | Takes the Concert row's lines, fit rules and padding. Shows no star. "Yes" is 48px tall. The row opens the concert (2026-11-17). |
| U16 | "None of these" | `HubScreen.tsx:501–509` | Action | Becomes a row in the panel instead of a hand-built button. |
| U17 | Item row | `EventScreen.tsx:357–366`; ordering at `EventScreen.tsx:322–355` | Item | Padding 12. The number box is 24px from 24, then 8, with the title at 56 (was 2ch + 12). No chevron. |
| U18 | Stage row | `EventScreen.tsx:684–712`; colour button at `EventScreen.tsx:941–950` | List, with the colour dot as nested control | Padding 8 to 12. The role is the second line. The dot's ink ends on the column, on the row's last line (2026-11-17). |
| U19 | Settings row | `SettingsScreen.tsx:34` (`ROW`), `:91`, `:154–173` | List, with an icon leading | The text starts at 56. A value at the right ("Last: 2 Nov"). Rows are 48px minimum. Amber for something to fix. |
| U19 | Maintainer | `SettingsScreen.tsx:265–271` | List, with a chevron (it opens a page) | Sits on its own panel. The title is in ink, not muted. |
| U24 | Docked search result | `DockedSearch.tsx:104–131` | List | The title goes from 600 to 400. The "Raga" badge moves from after the title to the trailing slot. Two-line rows are 68px, one-line 48px. |
| U24 | Fixed rows | `DockedSearch.tsx:169–189` (`FixedRow`); used at `ItemEditor.tsx` ("? Don't know"), `DetailInput.tsx:207`, `NamePicker.tsx:153` | Action | The title goes from 400 to 600. |
| U24 | What's on name row | `WhatsOnScreen.tsx:1025–1041` | List, with the kind word and check trailing | Nothing visible. |

What changes in U14:

- The kind mark moves after the name.
- The facts line runs time first: "when · Sabha · N Items".
- The live dot leads the line, replacing the "·".
- Padding goes from 10 to 12.
- The star and nested control move into the 48px trailing column.
- A cancelled row says "Cancelled" in place of its time.
- Under a Shortlist slot, the row drops the time.

## 5. Raised, not changed

These were raised by the council. They stay as they are by earlier decisions, or wait for
another spec.

- **An Item's title stays 600**, signed off in the foundations. As a search candidate, a title
  is 400. The search spec may revisit this.
- **The kind marks stay icons** (the user's call, 2026-11-06). The cancelled and changed marks
  stay calendar-x and calendar-exclamation (2026-11-07).
- **Rows step by 20px** (68, 88), on the foundations' 4px half-step.
- **For later:**
  - A contrast pass at low brightness: cancelled against pressed, the two calendar marks, the
    live dot, and the small kind and instrument words.
  - The changed mark doesn't say what changed.
  - "No time" rows end without a word ("Time TBA" is a copy question).
  - The Item search's fixed rows need a clearer break from the results (search spec).
  - The "Yes" control's shape belongs to the button spec.
  - Section headers and "Earlier today" belong to their own specs.

## 6. Proposed DESIGN.md change

[row-design-md.diff](row-design-md.diff), not applied. It rewrites:

- "The row" (the four kinds, time first, "when", the trailing column, "Cancelled");
- the cancelled sentence under "The rasika's rows and the Schedule";
- "Search result" (titles in Body, the kind word in the trailing slot, the fixed rows as Action
  rows).

It applies on top of the foundations diff.
