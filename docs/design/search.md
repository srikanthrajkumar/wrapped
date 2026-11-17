# One search

The third spec of phase 2. The user signed it off on 2026-11-17, one decision at a time, each
decision taken through two council rounds (two Claude reviewers and Codex).

The decisions:

- **Decision 1, structure:** A, one docked search everywhere, with "Add new" on top.
- **Decision 2, before typing:** A, your names by the field, with yes to all three lines: listings
  ahead only, lead Artists only, and the caption "Often heard".
- **Decision 3, several or one:** A, picks pinned at the top.
- **Decision 4, result anatomy:** A, results on a panel.

Today the app searches in four places (inventory U21 to U24), laid out two ways. The Item editor,
the Artist and Sabha pickers and the Detail pickers share one docked search (`DockedSearch.tsx`).
What's on has its own search sheet, with its field at the top. The user's direction: "Prefer it
all look more like Item search."

**Builds on:** [foundations.md](foundations.md) and [row.md](row.md), as signed off and built
(main 4e817ac):

- Text sits 24px from the screen and fills 8px from it, with 16px corners.
- Rows are 12px above and below their text.
- Results are List rows; "? Don't know", "Use what I typed" and "Add new" are Action rows.

These DESIGN.md rules stay as they are:

- The Item editor's search is the one field that autofocuses, with What's on's search sheet the
  recorded second.
- What's on's bar reads the filter, with one × that clears it all.
- Picks of one sort widen the filter and picks of different sorts narrow it.
- Filters don't last across launches.
- The ranking of names and songs is unchanged.

**Folds in [PR 46](https://github.com/srikanthrajkumar/wrapped/pull/46)** ("the best match is
whole when the room above the keyboard is short", branch `claude/best-match-whole`, not merged).
Its rule is part of decision 1 (see "When the room is short").

**Out of scope:** integration beyond search, the ranking itself, and the catalog. The Composition
sheet and the Item editor share one search, so they are one row in the mapping.

**Status:** built (2026-11-17), with the DESIGN.md change below applied. The decisions, with
every option shown at 375px, are on the spec's page:
https://claude.ai/artifact/87wzk7mxDwMwWbUh9mAv4p

## 1. Structure: one docked search

One component, `DockedSearch`, for all four searches. What's on's search sheet becomes a docked
search too.

From the top down, inside a sheet or under a page's title:

1. **The head.**
   - A sheet's title and close.
   - On What's on: the kind toggles, sharing the close's row, with no title.
   - A Detail picker keeps its "Now: …" line under the title.
2. **A note, if any:** "Catalog not on this phone yet", a save failure.
3. **The pinned rows:** the chips, then Action rows ("? Don't know", "Use what I typed", "Add “…” as
   a new Artist"), and on What's on the picked names (decision 3).
4. **The results panel** (decision 4): the results from weakest at the top to best at the foot,
   then the field.
5. **The field**, on the 8px edge, standing on the keyboard.

Only the results scroll.

- **The best match is the row next to the field.** It is what Enter picks.
- **"Add “…” as a new Artist" (or Sabha) is a pinned row,** under the title, like "Use what I
  typed". It is shown once something is typed. Today it is the last row, between the best match
  and the field, where a stray tap made a duplicate.
- **The sheet fits its content.** It stands on the keyboard and grows upward to just under the
  top of the screen, as the pickers do today.
- **With the keyboard down,** the sheet stands on the bottom of the screen, above the home bar,
  and the field stays its last line. When the keyboard rises or falls, the list comes back to rest
  with the best match by the field, unless the rasika has scrolled it.
- **Screen readers** read top to bottom, as the screen shows. They hear the results list as "best
  match last" and the count once typing pauses (as built, design D24).
- **What's on:** tapping the bar opens the sheet with the field focused, at the foot, where the bar
  was. The field no longer jumps to the top of the screen.

### When the room is short

From PR 46, decided 2026-11-15 on the Maintainer's iPhone: the best match is never the row that is
cut.

- **The trigger:** a keyboard is up on a short screen and something is typed, and the room left
  under the pinned rows can't hold the best match whole and clear of the fade.
- **Then** every pinned row except "Use what I typed" steps aside:
  - the kind chips and "? Don't know" in the Item editor;
  - the "?", "Not sure" and "N/A" chips, the Nadai chips, and a Raga's move and remove in a
    Detail picker;
  - What's on's picked names;
  - "Add new" in the Artist and Sabha pickers.

  They come back when the field is cleared or the room returns.
- **"Whole"** means clear of the fade too, so a two-line best match is given 104px, not 80.
- **With too little room even then** (text at 200%), everything above the field scrolls as one,
  resting at its foot, with nothing hidden.
- **Where there is room,** nothing changes.

## 2. Before typing

| Search | Before typing | Shaded |
| --- | --- | --- |
| What's on | Up to five names you've heard most often, under the caption "Often heard" | Nothing |
| Artist and Sabha pickers | Your recent names, as built: up to eight, most recent next to the field | The most recent |
| Item editor | Its pinned rows only: the form chips, "? Don't know" | — |
| Detail pickers | Their chips only | — |

**What's on's names:**

- **Which names:**
  - Artists, groups and Sabhas from your own concerts.
  - Only names with a listing today or later (decision 2, "listings ahead only"). This hides a name
    you often hear that has nothing left this Season, since tapping it would filter to nothing.
  - An Artist counts once for each concert they led (decision 2, "lead Artists only"). The lead is
    the first billed name; a group counts as a lead. Accompanists are left out of these five, so
    they don't crowd out the singers you go to hear.
  - Names you've already picked are left out; they show as pinned rows (decision 3).
- **Order:**
  - Most heard next to the field; ties go to the latest.
  - As many as fit whole above the keyboard, five at most.
- **Nothing is shaded and Enter does nothing until something is typed.** What's on opens with the
  keyboard up, so a stray Enter must not filter the Season.
- **The caption** "Often heard" sits over the names, in `caption`, muted. It shows only when there
  are names.
- **With nothing heard yet:** only the toggles and the field show. Typing finds any name.
- **The A-to-Z list of the Season's names goes.**
- **Typed results don't change.** Typing still finds every name in the Season, accompanists and
  names with only past listings included, and any of them can be picked.

**Why two rankings:** the pickers rank by most recent because you're logging tonight's concert.
What's on ranks by most heard because you're choosing who to hear again.

## 3. Several or one

What's on picks several names and kinds; every other search picks one. These stay as built:

- Tapping a name picks it and closes the sheet onto its days.
- Tapping a picked name takes it off, and so does tapping a kind; either way the sheet stays open.
- The kinds stay text toggles, off in muted text, on in ink at 600 with a check after the word.
  Each is as wide on as off. (The user's call of 2026-11-10: "Mine and the kinds stay text
  toggles, unlike the Item chips.")

What changes:

- **The toggles share the close's row,** at the top of the sheet. The band that held only the close
  goes.
- **Picked names are pinned rows** at the top of the stack, under the toggles and above the results
  panel, in the order they were picked.
  - Each is a List row: the name, its kind word, then a check.
  - They stay there while you type, so a pick that doesn't match what is typed stays in view.
  - A picked name is not repeated in the results.
- **A pick taken off stays where it is, unticked, until the sheet closes,** so nothing moves under
  the thumb. Tapping it again puts it back.
- **The shaded best match is never a name already picked,** so Enter only ever adds.
- **The trailing slot:**
  - An unpicked row shows its kind word ("Artist", "Group", "Sabha") on the 24px column, with no
    empty room kept for a check. This answers the build's open question 2, deferred to this spec.
  - A picked row shows its kind word, then the check.
  - The two groups' kind words therefore sit 28px apart, between the groups and never inside one.
- **The pickers** pick one: no checks, and a tap picks and closes, as built.

## 4. Result anatomy

- **The results sit on a panel,** 8px from the screen with 16px corners, the foundations' "every
  group of rows on a panel". Its top edge is the break from the pinned rows; no divider is drawn
  above it.
  - On a page (the Item editor), the panel is `--panel`, one step lighter than the page.
  - On a sheet, the panel is the page colour (`--background`), one step darker than the sheet, so
    the break shows at low brightness.
- **Rows on the panel:**
  - List rows, 48px with one line and 68px with two, divided by the hairline.
  - Title in `body` 400, the second line in `sub`, muted.
  - A kind word in `caption`, muted, at the right on the title's line.
- **The best match's shading** is `surface-raised`.
  - It runs the panel's full width as its last row, so its sides stand 8px from the screen like
    every fill.
  - It shares the panel's bottom corners, and a single result takes all four.
  - Its text stays on the 24px column.
  - It must stand out as clearly on a page as on a sheet. Where the panel is the lighter one (a
    page), the build checks this on a phone at low brightness and adds a step if it falls short.
- **The fade:**
  - Shown only while a row is scrolled under the panel's top edge.
  - Drawn inside the panel, in the panel's colour: solid for the first 16px, fading over the next
    24px. A clipped row's text and divider are covered at the edge.
  - The panel's own edge never fades.
  - Today the fade is 12px solid then 20px, and it fades the rows themselves.
- **No match:**
  - One muted line in `sub`, on the panel, in the best match's place next to the field: "Nothing
    matches “zzqx”".
  - Worded the same in every search: Item, Detail, What's on, and the pickers, where "Add new"
    stays pinned above.
  - Screen readers hear "No matches", as now.
  - Today it is "No match in the catalog" above the pinned rows, and "No Artist or Sabha by that
    name." on What's on.
- **No catalog on the phone:** the note "Catalog not on this phone yet. What you type is kept and
  can be matched later in Tidy." stays at the top, as built.
- **The field:**
  - 48px, `surface-raised`, 16px corners, on the 8px edge.
  - The search mark on the 24px column.
  - A 2px `ring` inset while focused.
  - One shared class string, no longer copied in What's on.
  - **The field's clear mark** is a small filled circle with an × in it, muted, 20px in a 48px
    target, spoken "Clear search". It can't be mistaken for the sheet's close, which is the plain ×
    at the top right, spoken "Close".
- **No divider is drawn when nothing is pinned.** Today a picker draws a stray one under its title.
- **Pressed:** 0.6 opacity, as every target. On the best match the shading dims with its text.

## 5. States and edge cases

| State | What shows |
| --- | --- |
| Before typing | Decision 2's table |
| Typed, results | Pinned rows, the results panel (weakest to best, best shaded by the field), the field |
| Typed, one result | The panel holds one row, shaded, with all four corners |
| Typed, no match | Pinned rows ("Use what I typed" or "Add new" one row up), the panel with "Nothing matches “…”", the field |
| No catalog | The note at the top, then the pinned rows and the field; typing still works |
| Room short | "When the room is short" (PR 46) |
| Keyboard down | The sheet on the screen's foot; the field its last line |
| What's on, nothing heard | The toggles and the field only |
| What's on, picks on | The picks pinned at the top, also while typing |
| What's on, a pick taken off | Stays in place, unticked, until the sheet closes |
| A long name | Wraps; never cut (DESIGN.md "The row") |
| A two-line best match | The shading holds both lines; its bottom corners never clip the second line at 200% text |

## 6. Each search, mapped

| Search | Code | Today | Changes |
| --- | --- | --- | --- |
| What's on bar (U21) | `WhatsOnScreen.tsx:799` | Bar in the bottom stack, opens the sheet | Opens the docked search, the field at the foot where the bar was. The bar itself is unchanged |
| What's on search (U22) | `WhatsOnScreen.tsx:893` (sheet), `:946` (toggles), `:1016` (no match), `:1021` (rows) | Own sheet, field at the top, 85% tall, A-to-Z list, picks first with checks | Becomes `DockedSearch`: toggles in the close's row, picks pinned on top, "Often heard" before typing, results on the panel, best match shaded, the no-match line on the panel |
| Docked search (U23) | `DockedSearch.tsx:85` (stack), `:90` (divider), `:92` (results), `:133` (field), `:168` (FixedRow) | Flat results, divider always drawn, fade 12 + 20px | Results panel, no divider when nothing is pinned, fade 16 + 24px inside the panel, filled clear mark, PR 46's room rule, a slot for pinned picks |
| Item editor, Composition sheet | `ItemEditor.tsx:119` (ItemSearch), `:145` | Chips, "? Don't know", "Use what I typed" pinned; note "No match in the catalog" on top | No-match line on the panel by the field; "Use what I typed" passed as its own row (PR 46) |
| Artist and Sabha pickers | `NamePicker.tsx:143`, `:151` (lastRow) | Recent names; "Add “…” as a new …" as the last row | "Add new" pinned under the title (`lastRow` goes) |
| Detail pickers | `DetailInput.tsx:194`, `:201` (fixed) | Chips pinned; "Use what I typed" inside them | "Use what I typed" as its own row (PR 46); results on the panel |
| Search result rows (U24) | `rows.tsx:70` (kind word), `:71` (check) | Kind word, then the check's room kept on every row (`checked={false}`) | No check room on unpicked rows; picked rows kind word, then check |
| Messages | `messages.ts:120` (`noName`), `:203` (`noMatch`) | Two wordings | One: "Nothing matches “…”" |
| What's on names before typing | `season-filter.ts:181` (`suggest`), `store/people.ts:471` (`recentNames`) | A to Z | Most heard as lead, with a listing ahead, five at most |

## 7. Raised, not changed

From the council, for later:

- **The toggles:** whether Dance and Lecdem read as controls when all are off. Text toggles stay,
  the user's call of 10 Nov. If people turn kinds on often, a strip in thumb reach is the one idea
  worth trying (option B of decision 3).
- **Four or more picks:** perhaps one "+2 more" row once there are more than three.
- **Screen readers on What's on:** a picked row says "selected, tap to take off", an unpicked one
  "tap to filter".
- **Adding a second name:** whether people find that reopening adds to the filter. The bar shows it
  once the sheet closes.
- **The fade under Reduce Motion and in high-contrast modes.**
- **Low brightness:** check the panel and the shading on a real phone, not a monitor.
- **The field:** autocorrect, autocomplete and spellcheck stay off, as built. The first letter is
  not capitalised automatically.
- **Outside search:** what "?", "Not sure" and "N/A" each mean in a Detail picker; on the page
  rather than in a sheet, the Item editor's empty top half with no match.

## 8. Proposed DESIGN.md change

Applied with the build. It rewrites:

- the search sheet, under "Season";
- the Item editor's search stack;
- the Artist and Sabha pickers' last row;
- "Search box", "Search result" and "Search states";
- the depth ladder;
- the no-match message;
- the Decisions Log, with a row for 2026-11-17.

PR 46's own DESIGN.md text ("When the room is short") is written into "Search states" here, so the
two land as one.

## 9. Build notes (2026-11-17)

Where the build goes past the words above. The first four were decided on 2026-11-17 (the
user: "Keep all four") and are in DESIGN.md; the rest stay open to the user's veto.

- **Decided: the page's shading one step brighter in dark**, oklch(0.31 0.011 216.9) over
  surface-raised's 0.275, the step §4 allows: simulated at low brightness the page's shading read
  1.33:1 against the sheet's 1.48:1, and reads 1.55:1 with the step.
- **Decided, light theme:** a light sheet is as white as the page, so the results panel is
  `--panel` on a sheet too; and surface-raised over that panel measured 1.01:1, so the light
  shading is oklch(0.9 0.004 214).
- **Decided, when the room is short:** the fade's soft part shortens to end at the best match's
  top before the stack scrolls as one, so "Use what I typed" stays on a 664px phone at normal
  text size.
- **Decided, Often heard's leads** are those the concert is known by (the app's rule in
  store/stage.ts), as an own concert has no billing order: a duo counts both, a group whose
  members lead counts once as the group.
- **The kind word and the check sit on the title's first line** when a name wraps.
- **On a sheet the box stands 8px over the keyboard,** as on a page.
- **What's on's pinned picks and kind toggles keep the box focused** when tapped, so the keyboard
  stays up and the sheet doesn't move under the thumb.
- **Decided 2026-11-17:** "Add new" steps aside in the pickers when the room is short, as §1 says.
  DESIGN.md's wording now matches: only "Use what I typed", in Item search, always stays.
