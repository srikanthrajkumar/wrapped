# The Item editor

The fourth spec of phase 2, and the last component spec. The user signed it off on 2026-11-19,
one decision at a time, each through council rounds (two Claude reviewers and Codex).

The decisions:

- **Decision 1, where the Details sit:** B, one panel, with no lines inside.
- **Decision 2, the Raga line and its order:** A, the order in the Raga's sheet.
- **Decision 3, Manodharma:** List rows with a check (the user's own choice over the council's
  chips), each part silently following the Item's Raga; a hint once, and in an RTP the Raga line
  always shown. Reopened and decided by the user the same day.
- **Decision 4, the Layavinyasam:** P1, its own one-row panel under Manodharma, its nadais a
  list shown plainly.

Today the Item editor is the one page whose values sit flat on the page, while its Improvised
fold sits on a panel. Its Raga value sits 12px lower under its label than every other value (the
"Raga row" the Decisions Log deferred on 2026-11-17). And it has the app's second "Edit order",
which works unlike the Event's.

**Builds on:** [foundations.md](foundations.md), [row.md](row.md) and [search.md](search.md), as
signed off and built (main cb179c0):

- Text sits 24px from the screen and fills 8px from it, with 16px corners.
- Rows are 12px above and below their text: 48px with one line, 68 with two.
- "Panels everywhere": every group under a label sits on a panel.
- The Item editor's search, its pinned rows and the Composition sheet are search.md's. They are
  not reopened here.

These DESIGN.md rules stay as they are:

- A new Item exists from its first pick. "Next Item →" and "Done" open an empty editor or go
  back, and backing out discards what was typed (DD4).
- Values are underlined, never filled. Importance is weight and contrast: the title in 700, Raga
  and Tala in ink, the rest muted.
- The six Detail states, and their spoken names.
- Saving: no Save button; the highlight only where a change can't be seen happening.
- The Layavinyasam: removed by a tap, but never with a note typed under it (2026-11-05).

**Out of scope:**

- The search itself.
- The "⋯" menu's look (U46).
- The catalog.
- The Event page.

**Status:** a spec only. No app code has changed. The DESIGN.md change is in
[item-editor-design-md.diff](item-editor-design-md.diff), applied to DESIGN.md on 2026-11-19. The decisions, with every
option shown at 393px, are on the spec's page: https://claude.ai/artifact/9yR1gM5UBA1KbUS9p54EVS

The council scored the recommended option of each decision:

| Decision | Round 1 | Round 2 |
| --- | --- | --- |
| 1, where the Details sit | 7.5, 7.5, 8 | 8.5, 8, 8.5 |
| 2, the Raga line | 8, 7, 8 | 8, 8, 9 |
| 3, Improvised (A, then the user's C) | A: 7, 7, 7 | A: 8, 8, 8.5 |
| 3, C, the user's choice | 8, 8, 8 | |
| 3, reopened: Manodharma, the hint | 7, 7, 8 | 8, 8, 8 |
| 4, the Layavinyasam | 8, 7, 8 | 9, 9, 8.5 |

The user chose C after both rounds on A, so C had one round of its own. They then reopened it
as Manodharma and the Layavinyasam (§4, §5).

## 1. Today's Item editor, mapped

Shot at 393×852 in light and dark from main cb179c0, with the hill-climb seed (Mon 14 Dec 2026,
7:30 pm), and measured in the page. The shots are on the spec's page.

### New Item

`NewItem`, `ItemEditor.tsx:198`.

| Element | Today | Against the signed-off specs |
| --- | --- | --- |
| Top bar | "‹ Music Academy": the Event's Sabha, or "Concert". No ⋯. Backing out discards what was typed. | Matches. |
| Title | "Item 12", in the page title's 24/700, 8px under the bar and 24px over what follows. | Matches the foundations. |
| A failed first pick | " · Kalyani" after "Item 12", and the "Not saved" row. | Matches "Save failure". |
| The search | The docked search: the form chips, "? Don’t know", "Use what I typed" once something is typed, the results panel, and the box on the keyboard, autofocused. | Signed off (search.md). |
| Keyboard down | The pinned rows and the box sit at the screen's foot, and the top half is empty. | Raised for later in search.md. |
| Draft | Typed text survives the phone locking. The first pick makes the Item, and the page becomes the edit page. | Matches DESIGN.md. |

### Edit page

`EditItem`, `ItemEditor.tsx:350`.

| Element | Today (measured) | Against the signed-off specs |
| --- | --- | --- |
| Top bar | "‹ Music Academy", and ⋯ holding "Delete Item". | Matches U08. |
| Title block | The eyebrow "Item 6" in caption (56 to 72) sits directly over the title. The title is a 48px underlined button (64 to 112) in 24/32 700, and the block ends at 128. | Matches: 8px under the bar, and 24px from the title's text to the first label. |
| Title text | The song. For a Raga-only Item, the Raga, repeated on the Raga line. For a form, the form ("RTP"), repeated by Form. For "? Don’t know", a lone "?". For typed text, as typed. | DESIGN.md says nothing about the repeats. See §6. |
| Raga line | "Raga" or "Ragas" in sub (128 to 148), then the values as 48px buttons (148 to 196), "," between them, and a muted + (a 48px target). With no Raga, a lone "?". | **The value text sits 12px under its label; in the grid it sits 0px under.** This is the deferred Raga row. |
| Edit order (two or more Ragas) | A quiet "Edit order" on the label's line. Tapped, arrows ← and → flank each Raga, and it reads "Done". | The arrows push the first Raga off the 24px column. The Event's "Edit order" puts its "Done" in the bottom bar instead (U39). |
| Value notes | "not matched" or "catalog: Todi" under the first Raga, in caption. | Matches DESIGN.md. |
| Detail grid | Tala, Composer / Language, Subject / Form, in two columns (auto-fill, 8 em at least). Each cell is one button, 64px tall with 8px padding: the label in sub directly over the value in body, underlined. Tala is in ink; the rest are muted. | **Flat on the page**, while Improvised below sits on a panel. Cells are 64px, where the foundations' two-line row is 68. |
| Improvised fold | "Improvised" in Strong with its chevron, 32px under the grid. Open when the Item has any part. A panel of five rows, each a 48px chip with 12px above and below (72px). Once a part is pressed, its Raga ("In the Item’s Raga") shows beside its chip. The Laya vinyasam row adds "+ Nadai" and grows its Note field. | Rows are 72px, off the 48/68/88 steps. |
| Bottom bar | "Next Item →" outlined and "Done" filled, 56px, on the 8px edge, with the fade above. No tab bar. | Matches U04 and DESIGN.md (2026-11-04). |
| Detail sheets | The title ("Tala", "Raga 2"), "Now: …", the "?", "Not sure" and "N/A" chips, then any extras (the Nadai chips, "Remove this Raga", "In the Item’s Raga"), then the box. | The search is signed off. |
| Composition sheet | Tap the title: "Composition", the same Item search. A repick is one write; a failed one reads "Not changed". | Signed off. |
| Not on this phone | "This Item is not on this phone." under the top bar. | Unchanged. |
| Delete | ⋯ → "Delete Item": removed at once, back to the Concert, with the Undo bar "Item 6 deleted · Undo". | Matches "Deleting". |

## 2. Decision 1: the Details on one panel

The Details (Raga, Tala, Composer, Language, Subject, Form) sit on one panel, as Manodharma
does. There are no lines inside it.

- **The panel** starts 24px under the title block. It sits 8px from the screen with 16px corners,
  and its text runs on the 24px column. It is 32px from the panel to the "Manodharma" label, and
  8px from that label to its panel.
- **Every value is a cell**, 68px at least:
  - 12px, then the label (sub, muted), then the value (body, underlined), then 12px.
  - The label sits tight over the value, on the Raga line as everywhere else. This settles the
    Raga row.
- **The layout:** the Raga line runs full width, then Tala | Composer, Language | Subject, and Form
  alone.
  - Two equal columns, 16px apart, each 164px on a 393px phone.
  - "Muthuswami Dikshitar" and "Khanda Jati Triputa" fit on one line at the default text size.
- **Long values wrap, never cut.** A cell grows 24px for each extra value line. The two cells of a
  line are top-aligned, so the line takes the taller one's height.
- **Large text:** when a column would be narrower than 8 em (as built), the grid becomes one
  column of the same cells.
- **No lines inside the panel.** A value's underline with a hairline 12px under it read as two
  stacked rules in the dark. The Details are fields, not a list, and the 68px rhythm separates
  them. (Not chosen: B with hairlines.)
- **Each cell is one target and one spoken element**, label and value together ("Composer,
  Tyagaraja"):
  - It is the cell's full height. Across the 16px gap, the two targets split at its middle, so
    no strip is dead.
  - Pressed is 0.6 opacity, as every target. The focus ring is drawn inside the cell.
  - Screen readers read row by row: Raga, Tala, Composer, Language, Subject, Form.
- **On the Raga line,** each Raga and the + are their own targets (decision 2).
- **Value notes** ("not matched", "catalog: Todi") stay a caption line under their value. The
  cell grows 16px.

Not chosen:

- **A:** flat on the page, on the same rhythm.
- **C:** label-column rows. Its 104px label column breaks at large text.

## 3. Decision 2: the Raga line, and its order in the Raga's sheet

**The page:**

- "Raga" with one Raga, "Ragas" with two or more, then the Ragas in the order sung: "Kalyani,
  Kanada, Behag".
- Each Raga is its own 48px target, which opens its sheet. A comma stays with its Raga.
- **The +** sits one gap after the last Raga, its ink 8px after the word, as a comma's 8px. It
  has a 48px target and is spoken "Add Raga".
- **Wrapped lines step 48px** (24px of text, 24 between lines), so every target is whole and none
  overlap.
- **There is no "Edit order" on the page.** The quiet "Edit order" stays only on the Event, for
  Items.
- **Spoken:** each Raga is "Kanada, Raga 2 of 3", with ", guess" when it is one.
- With no Raga, the line shows a lone "?", spoken "Raga, unknown", as built.

**The Raga's sheet** (Raga 2 of 3, say):

- The title "Raga 2", spoken "Raga 2 of 3". Then "Now: Kanada", the chips, and the box, whose
  placeholder follows the title ("Raga 2…").
- **The chips:** with two or more Ragas, "?" and "Not sure". "N/A" means nothing for one Raga of
  several; "Remove" does that job. A lone Raga keeps "?", "Not sure" and "N/A", as built.
- **"← Earlier", "Later →" and "Remove"** share one line under the chips:
  - "Earlier" and "Later" keep fixed places, each a whole 48px target. At the ends one is dimmed
    and aria-disabled, never removed, so the next tap never lands on the wrong control.
  - "Remove" sits at the right, at least 24px clear of "Later". At 200% text it drops to its own
    48px line at the right.
  - A lone Raga's sheet has none of the three.
  - A Raga being added (from the +) has none of them until it is picked.
- **After a move,** the sheet stays open:
  - Its title and placeholder follow ("Raga 2" becomes "Raga 1").
  - The Raga reorders on the page behind, where it can be seen, and plays the save highlight.
  - Screen readers hear it once: "Kanada, now Raga 1 of 3".
- **After "Remove",** the sheet closes and the Undo bar offers it back ("Raga removed · Undo", 5
  seconds), as every delete does.
  - Focus goes to the Raga that took its place, or to the + if the last one went.
  - Undo puts the Raga back in its place and focuses it.
- **When the room is short** (search.md, signed off), the move line steps aside only once
  something is typed in the box and the best match would be cut. It comes back when the box is
  cleared or the keyboard falls. Moving needs no typing, so the line is always there for a move.

Not chosen:

- **B:** "Edit order" on the page, turning the Ragas into rows with ↑ and ↓. The panel jumps
  down while ordering, and its "Done" stands beside the bottom bar's "Done".
- **C:** as built, with the arrows inline.

## 4. Decision 3: Manodharma

Decided in two steps. On 2026-11-19 the user first chose List rows with a check (C) over the
council's chips (A). The same day they reopened it:

- The fold is "Manodharma". The Layavinyasam leaves it (decision 4).
- Kalpanaswaram and Layavinyasam are one word each.
- Each part can go through several Ragas. A Raga outside the Item's is rare, "like 1 in every
  10-15 compositions", mostly in RTPs, so a part defaults to the Item's Raga. Changing comes before
  adding, and both are less important.

Manodharma holds Alapana, Tanam, Niraval and Kalpanaswaram, each a List row (row.md) on the
fold's panel, in the order a concert takes them.

**The rows:**

- **Off:** one line, 48px, the part's name in body. A tap turns it on. It saves at once, with no
  highlight, since the check shows the save.
- **On, following the Item's Raga:** still one line, its name and the check. No Raga is shown.
  This is the silent default.
- **On, with its own Ragas:** a second line in sub, in ink, plain text: "Kharaharapriya, Kalyani,
  Kanada". The row grows to 68px. The Ragas are not separate targets.
- **In an RTP** (Form RTP), a part that is on always shows its Raga line: muted while it follows
  ("Kalyani"), in ink once it has its own. There, Ragas beyond the Item's are close to standard
  (decided by the user, 2026-11-19).
- **The check is the row's one nested control:**
  - A 48×48 target, its ink ending on the 24px column.
  - Centred on a one-line row; on a two-line row, on its last line, as row.md places a control.
  - Tapping it turns the part off. Undo always offers it back ("Alapana removed · Undo", 5
    seconds), Ragas and all, since a mis-tap in a dark hall must lose nothing.
- **A second tap is guarded.** For 500ms after a row turns on, another tap on it does nothing, so
  an accidental double tap never opens its sheet. A row that grows does so over `motion-grow`
  (200ms).
- **Screen readers:** one switch per part, in both states.
  - Off, the row is the switch, "Tanam, off".
  - On, the check is that switch, "Alapana, on", and focus moves to it.
  - The row then reads "Alapana, Raga Kharaharapriya, the Item's, change", or "Kalpanaswaram,
    Ragas Kharaharapriya, Kalyani, Kanada, change".

**The hint, once (decided by the user, 2026-11-19):**

- The first time on this phone that a rasika turns a part on, that row's second line reads
  "Kharaharapriya · tap to change" (muted). It names the silent default as well as the way to
  change it.
- It stays until a part's sheet is opened or the Item is left, then never shows again on this
  phone. A reinstall or a second phone shows it once more.
- The rows below shift 20px that one time only.

**The part's sheet.** The row's tap opens one sheet per part, never a sheet over a sheet.

- **While it follows:** the title "Alapana"; "Item’s Raga: Kharaharapriya"; "?" and "Not sure";
  a quiet "+ Another Raga"; and the box, "Change Raga…".
  - Changing is the box, the primary act.
  - Adding is the quiet button. It starts the part's list with the Item's Raga, then the new one,
    and the box reads "Add Raga…" until it is picked.
- **With its own Ragas:** the title "Kalpanaswaram", then its Ragas in a line, each a 48px target.
  - One is selected: 600, ink, underlined. The others are in ink with the faint value
    underline, never muted, so they read as tappable. The first is selected by default, and
    tapping another selects it. It is spoken "Kalyani, selected, 2 of 3".
  - Under the line, "?" and "Not sure", acting on the selected Raga. Then "← Earlier", "Later →"
    and "Remove", acting on it too, in fixed places, as decision 2's sheet orders them: changing
    before reordering.
  - A quiet "+ Another Raga" adds one at the end and selects it.
  - The Action row "Use the Item’s Raga only" sends the whole part back to following, with Undo.
  - The box names what it changes: "Change Kalyani…".
  - A long list wraps, and the sheet scrolls above the box.
- **The Item's Raga in a part's list stays live.** Copied in by "+ Another Raga", it reads
  "Kharaharapriya (Item’s)" in the sheet and follows the Item's Raga until it is changed in that
  slot.
- **A list cut back to only the Item's Raga** goes back to following, with no second line.
  "Remove" on a part's last own Raga does the same.

**Following** means the Item's first Raga (the main one; for an RTP, the pallavi's), and it is
live: it changes when the Item's Raga changes. A part's own list is its own.

**The fold** stays as built: "Manodharma" in Strong with its chevron, open when the Item has any
part, otherwise closed.

**row.md gains one line:** a check may be a List row's nested control, meaning "on; tap to turn
off". Before, a check was only a trailing mark meaning "picked".

**The data model** changes from one Raga per part to a list, empty while it follows, with a
marker for a slot that holds the Item's Raga live. The build needs an ADR for it, with the
migration (a part's single set Raga becomes a list of one) and what Undo restores.

Not chosen:

- **Before the reopening:** A, a row per part with its chip, which was the council's
  recommendation; and B, the chips together.
- **For the hint:** the hint once with no RTP line; no hint at all; one quiet "Ragas" on the
  fold's label, which is a mode.

## 5. Decision 4: the Layavinyasam

The user took the Layavinyasam (one word) out of Manodharma. Of its nadais: "Multiple nadais.
And needs to be a little less surreptitious compared to the others." Changing comes before
adding, as with the Ragas.

**Where it lives (P1):** its own panel of one row, 32px under Manodharma, always shown. It sits
outside the fold, so one tap turns it on.

**The row:**

- **Off:** one line, "Layavinyasam", 48px. A tap turns it on.
- **On:** its nadais are shown more plainly than a part's Ragas. The second line, in sub:
  - While no nadai is set: the Tala's nadai muted, then "+ Nadai" in ink, 16px apart, so they
    never read as a sum ("Chatusra   + Nadai"). With the Tala "?" or "N/A", just "+ Nadai".
  - Once set: "Khanda, Tisra" in ink. The list holds the nadais it moved through besides the
    Tala's, since a tani starts and ends in the Tala's nadai.
- **The check** is the row's one nested control, on its last line, as Manodharma's.
  - It is a switch, "Layavinyasam, on".
  - The row reads "Nadais: the Tala's, Chatusra. Add a nadai", "Nadais: Khanda, Tisra", or, with
    no Tala, "No nadai. Add a nadai".
  - It turns the Layavinyasam off with Undo ("Layavinyasam removed · Undo"), nadais, note and all.
- **With a note typed,** the decided rule stays (2026-11-05). The check's tap goes to the note,
  its text selected, to clear it first. The check is spoken "Clear the note to turn off
  Layavinyasam".
- **The Note** opens under the row, inside the panel, its label 8px over it and tied to it. It
  starts at one line (48px) and grows with its text. Today it opens at two lines.
- **A second tap is guarded:** for 500ms after it turns on, as Manodharma's rows.

**Its sheet.** The row's tap opens one sheet, "Layavinyasam".

- **"Tala’s nadai: Chatusra"** shows under the title whenever the Tala's nadai is known.
- **With no nadai set:** the Nadai chips ("?", Tisra, Chatusra, Khanda, Misra, Sankeerna,
  Other…). A chip picks the first nadai.
  - Picking only the Tala's own nadai leaves the list empty. It is allowed between others, since
    a mridangist does return to it between khanda and tisra passages.
  - "?" records a nadai that changed and couldn't be named, spoken "A nadai I couldn't name". An
    empty list means only the Tala's was heard.
- **With nadais set:**
  - They stand in a line under the title, each a 48px target, the comma in the gap between
    them.
  - One is selected: 600, with an ink underline; the others have the faint value underline. The
    first is selected by default, and tapping another selects it. It is spoken "Tisra, nadai 2 of
    2, selected".
  - Then the chips, whose pressed chip is the selected nadai. A chip changes the selected nadai.
  - Then "← Earlier" and "Later →" (only with two or more, in fixed places, one dimmed at either
    end) and "Remove" at the right, each a whole 48px target. "Remove" offers Undo ("Nadai
    removed · Undo"). Removing the last goes back to the Tala's.
  - Then a quiet "+ Another nadai". It clears the selection, and the next chip appends a nadai.
    Closing the sheet without a pick leaves the list unchanged.
- "Other…" opens the Nadai's own sheet, as built.

**The data model** changes from one nadai to a list, in the same ADR as Manodharma's Raga lists.
The migration: a set nadai becomes a list of one, and "not applicable" becomes an empty list.

Not chosen:

- **P2:** its own fold, which takes two taps to turn on.
- **P3:** a value cell beside Form. It reads as a fact of the composition and hides its Note in a
  sheet.

## 6. The rest of the editor, settled

Settled here and not asked; open to the user's veto.

- **The title block** is unchanged. The eyebrow "Item 6" sits in caption over the title, which is
  24/32 700, underlined, a 48px target that opens the Composition sheet. It is 8px under the bar
  and 24px to the Details panel.
- **What the title says**, unchanged:
  - The song.
  - A Raga-only Item: its Raga, which the Raga line repeats.
  - A form: its name, which Form repeats.
  - "? Don’t know": "?".
  - Typed text: as typed.

  The title names the Item as the running order does, so the repeats stay.
- **The Tala's text** leaves out a Nadai it can't name: an unknown Tala with an unknown Nadai
  reads "?", not "? (? nadai)". A known Tala with an unknown Nadai stays "Adi (? nadai)".
- **New Item** is unchanged: "Item 12" and the docked search (search.md).
- **The bottom bar** is unchanged: "Next Item →" outlined at the left, "Done" filled at the
  right, 56px, on the 8px edge.
- **Detail sheets** are unchanged except for the Raga's (§3). A Manodharma part's sheet and the
  Layavinyasam's are new (§4, §5).
- **Focus on open** is unchanged. A new Item focuses its search box (the recorded exception); the
  edit page focuses its title block.
- **Delete** is unchanged: ⋯ → "Delete Item", back to the Concert, with the Undo bar.
- **Undo copy:** "Raga removed", "Alapana removed" (the part's name), "Layavinyasam removed" and
  "Nadai removed", on the existing Undo bar. In a part's sheet, "Remove" on one of its own Ragas
  reads "Raga removed", and "Use the Item’s Raga only" reads "Ragas removed" (the user,
  2026-11-20, at the build).
- **The Tala's nadai** ("Tala’s nadai: Chatusra", "Chatusra   + Nadai") is the Tala's Nadai when
  one is set, and otherwise Chatusra for every known Tala, chapu talas included (the user,
  2026-11-20, at the build: "Keep Chatusra"). With the Tala "?" or "N/A", or its Nadai "?", none
  is shown.
- **The Nadai chips** read in sentence case ("Tisra", "Khanda"), as the Roles do, in the
  Layavinyasam's sheet and the Tala's. Today the Tala's read "tisra". Values in running text stay
  lower case ("Adi (khanda nadai)").
- **Words:** "Manodharma", "Kalpanaswaram" and "Layavinyasam" everywhere on screen, in spoken
  names and in DESIGN.md (the user, 2026-11-19). The code's internal keys stay as they are.

## 7. States and edge cases

| State | What shows |
| --- | --- |
| New, before typing | "Item 12", the pinned rows, the box (search.md) |
| New, a failed pick | "Item 12 · Kalyani" and "Not saved", the search kept |
| A song | Title, then the panel: Raga, then Tala, Composer, Language, Subject and Form |
| Raga-only | Title "Kalyani", Raga "Kalyani", the rest "?" |
| "? Don’t know" | Title "?", every value "?" |
| Typed ("Tillana") | Title as typed, every value "?" |
| A form (RTP) | Title "RTP", Form "RTP", Composer "Not applicable" |
| Ragamalika, six Ragas | The Raga line wraps at 48px steps, with the + after the last |
| An override | "catalog: Todi" under the value, and the cell grows 16 |
| Unresolved | "not matched" under the value |
| A guess | "Vararaga (?)", spoken "guess" |
| Long value | Wraps in its cell; the line grows 24 per extra line |
| 200% text | One column of cells; "Remove" on its own line in a Raga's sheet; a part's Raga line wraps under its name |
| Manodharma, none | The fold closed, "Manodharma" with its chevron |
| Manodharma, following | The fold open; parts that are on are one line with a check |
| Manodharma, own Ragas | That part's second line: "Kharaharapriya, Kalyani, Kanada" |
| Manodharma in an RTP | Every part that is on shows its Raga line, muted while it follows |
| The first part ever turned on | "Kharaharapriya · tap to change" under it, once |
| Layavinyasam, off | One row "Layavinyasam" on its own panel |
| Layavinyasam, on | "Chatusra · + Nadai" (or "+ Nadai" with no Tala), the Note under it |
| Layavinyasam with nadais | "Khanda, Tisra"; with a note, its check goes to the note first |
| Not saved | "Not saved" under the value, the value as entered |
| Not on this phone | "This Item is not on this phone." |

## 8. Raised, not changed

From the council, for later:

- **A pressed chip's check:** a check before a pressed chip's word, for every chip (the Item
  kinds, Roles, Nadais, "?", "Not sure", "N/A"). All three reviewers recommended it, since
  pressed is told apart only by weight, an ink outline and a faint fill. In light, an off chip's
  outline nearly disappears on a panel. It belongs to the phase-4 consistency pass. Mocked on the
  spec's page.
- **Contrast at low brightness:** the value underline on the panel, which with no lines inside is
  the only sign a cell can be tapped (3:1 asked); muted values against muted labels; and the dark
  panel against the page.
- **The empty cell beside Form,** and Form repeating a special form's title.
- **A lone "?" value** has a 5px underline. The whole cell is the target, but the mark is weak.
- **A missed Raga in the middle** of a ragamalika takes + and then several "Earlier"s. Perhaps
  "Add before" in a Raga's sheet.
- **A ragamalika kriti could take its Ragas, in order, from the catalog,** so ordering is left
  for RTPs and viruttams.
- **The gap between wrapped Raga lines** equals the gap to the Tala label below, so a second line
  can read as loosely attached.
- **The niraval's line:** which sahitya line it was sung on may deserve a field.
- **"Layavinyasam" or "Tani avartanam":** test which word rasikas look for.
- **Changing the Tala after nadais are set:** if the new Tala's own nadai is in the list (Adi to
  Khanda Chapu with Khanda listed), decide whether it leaves quietly or stays.
- **The closed fold could summarise its parts** ("Manodharma · Alapana, Kalpanaswaram").
- **The Layavinyasam's note rule** could go, now that every turn-off offers Undo with its note.
  This is the user's call; it stays as decided on 2026-11-05.
- **A "Remove Alapana" in a part's sheet,** for anyone who taps the row and never finds the check.
- **An off part's row** has no sign that a tap turns it on. Watch first use.
- **Long-press a part** as an expert's way to its sheet.
- **Hide Tanam, or the Layavinyasam,** on forms that never carry them (a Viruttam / Slokam).
- **The Layavinyasam on the concert:** the Event's Item row could carry it as a kind word, and
  a second one in a concert might deserve a quiet note.
- **The Layavinyasam's players** (mridangam, ghatam, khanjira, morsing) and a koraippu round, as
  fields beyond the Note.
- **"Other…" nadais:** combined nadais and gati changes inside one.
- **The Details sit in the hardest thumb zone.** A matter for integration.

## 9. Proposed DESIGN.md change

[item-editor-design-md.diff](item-editor-design-md.diff), applied to DESIGN.md on 2026-11-19. It rewrites:

- "Item editor (DD4)": the Details panel, Manodharma, a part's sheet and the Layavinyasam;
- "Detail input": a ragamalika's Ragas, moved and removed in their sheet; the Nadai chips in
  sentence case;
- "Values": the label in `sub`, the cells on one panel;
- "Chips": Manodharma's parts and the Layavinyasam leave the list;
- "The Laya vinyasam", now "The Layavinyasam", its own row;
- "The row": a check as a List row's nested control;
- the word "Layavinyasam" where DESIGN.md names it;
- the Decisions Log, with a row for 2026-11-19.
