# iPhone walkthrough, November 2026

The Maintainer tries one workflow at a time on the iPhone 16, installed from the test address
(`wrapped.srikanthrajkumar26.workers.dev`, ADR 0008), and reports what didn't work well and
when it would fail. Feedback is logged here as given and isn't acted on until the synthesis
is agreed.

## Tags

Each piece of feedback gets one **kind** letter and one **weight** number, as in `F2`.

| Kind | Covers |
|---|---|
| **B** Bug | Something broken: a wrong result, a crash, a value lost |
| **F** Flow | The steps: too many taps, the wrong order, getting stuck, not knowing what's next |
| **U** UI | How it looks: layout, size, spacing, colour, touch targets, dark hall readability |
| **W** Words | On-screen text: too much, unclear, wrong term |
| **D** Data | The catalog: search misses, wrong raga or composer, a missing Sabha or Artist |
| **S** Speed | Anything that feels slow or makes you wait |
| **I** Idea | Something new you'd want, not a fix |

| Weight | Means |
|---|---|
| **1** | Would stop or spoil logging in the hall |
| **2** | Annoying, but you'd get through |
| **3** | Polish |

Add **when** it fails if it isn't always: one hand, dark hall, mid-song, no signal, a
long name, a second Concert the same day.

## Workflows

| # | Workflow | Status |
|---|---|---|
| W1 | Install and first launch | done (iPhone 16) |
| W2 | Start a Concert: date, time, Sabha | done (iPhone 16) |
| W3 | Add the Artists, their roles and Colours | done (iPhone 16) |
| W4 | Add Items: find a Composition, set raga, tala, composer | done (iPhone 16, partly in a Safari tab) |
| W5 | Change, reorder and delete Items; undo | partly done (iPhone 16); delete and undo not reported, worth a second pass |
| W6 | Notes and the Laya vinyasam | done (iPhone 16) |
| W7 | A whole Concert in airplane mode, force-close, reopen | done (iPhone 16, 2nd pass): worked |
| W8 | Settings: offline state, storage, Export, theme | not yet |
| W9 | Delete a Concert | not yet |
| 2nd pass | Several workflows at once, on the build with PR #12 | done (iPhone 16). "Some of the risky workflows seem to work… All worked neatly"; which of W5, W8 and W9 wasn't said |

## Feedback

<!-- One line per piece: id, workflow, tag, what happened, when it fails. -->

| Id | Workflow | Tag | Feedback | When |
|---|---|---|---|---|
| FB-01 | W1 | F2 / U2 | The lone "Add to Home Screen" text with the two icons isn't enough. There should be a page saying the best experience comes from adding it to the home screen, and, for those who haven't, the app should periodically take over the screen to say so. Solutions later. A quick look through the rest of the app in the browser showed how much better the installed experience is. | Using the app in a Safari tab |
| FB-02 | W1 | U2 | If the persistent "Add to Home Screen" row stays on the three pages, design it better and place it somewhere else. | Safari tab, every tab screen |
| FB-03 | W1 | U2 | The row's position shifts slightly between the Season page and the Wrapped page, seemingly because the Wrapped page is empty for now. | Switching tabs in a Safari tab |
| FB-04 | W1 | U3 | "Ready offline" shows, but the rows you can tap should look different from the ones that only show a state. Export, sitting among them as one of the things, could be set apart differently. | Settings |
| FB-05 | W2 | D1 | No Sabhas show in the picker; only "Add … as a new Sabha". *Checked: expected today, not a bug.* The 11 Sabhas from last season's sheet are in `app/src/reference/shared-lists.seed.json`, but shared lists reach the phone only by sync (Phase 7); seeding the phone directly was left as a separate decision (T037 note). | A fresh phone, before sync |
| FB-06 | W2 | U3 | One main action per page is a recurring pattern. Should it always sit in the same place? If so, "Log a Concert now" moves to the bottom, where "Add Item" is. | Season page |
| FB-07 | W2 | U2 / F2 | The Sabha may not be the hero of the Concert; the Artist should be. The Season page makes the Sabha the hero too. | Concert page, Season page |
| FB-08 | W2 | U3 | The row holding date and time looks very thin on iOS. | Concert page |
| FB-09 | W2 | F1 | Can't find how to add a new Concert while one is open; it can't depend on closing the current one first. You may fill in a past Concert while another is going on. | A Concert already in progress |
| FB-10 | W3 | W3 | Not sure whether the Role chips should be capitalised ("vocal", "violin" today). | Artist sheet |
| FB-11 | W3 | F3 | Known Artists and Sabhas are offered again, as they should be. Is there a better way from a known Artist to their Role? Keeping one person with a Role per Appearance is right; not one "TM Krishna" per Role. Only if there's a smart answer. *Checked: the picker already shows each Artist's usual Role under the name (design D26), but the Role chips that follow start with nothing chosen.* | Adding an Artist you've logged before |
| FB-12 | W3 | F2 | Picking Colours isn't predictable and needs too much attention. Wants a UI skill or a hill-climbing improver to fix it, with simple solutions only. | Colour sheet, between songs |
| FB-13 | W3 | U2 | The colours don't look pleasing as laid out. Order them by brightness, or use a colour wheel. A two-tone outfit would read better as one circle, half and half, than as two dots. | Colour sheet; the Stage row |
| FB-14 | W3 | I1 | A photo of the Concert, to recall who was who (faces, outfits). Speed comes first: the first screen mustn't wait for it; photos can load later, or only on a tap. Pipe dream: recognise the faces and fill in Artist and Colours. A simple first step is just a photo to refer to. | Forgetting who wore what |
| FB-15 | W3 | F1 | Ordering the Artists on Stage makes no sense. | Stage, "Edit order" |
| FB-16 | W3 | W2 | "Remove from Stage" is bad copy. | Artist sheet |
| FB-17 | W3 | F2 | No way to correct an Artist's name (Akkarai to Akkarai Subbalakshmi). *Checked: the app has no rename for an Artist today.* | A name typed short or wrong |
| FB-18 | W3 | I1 | Groups: duos and ensembles such as the Trichur Brothers. Everything stays individual people underneath, but adding the group should add its members. Later, once there's a list of Artists. | Brothers, sisters, duets |
| FB-19 | W4 | F2 | In a Safari tab the search is unusable: with the keyboard up, the search bar and the fixed rows above the results (the Item kinds, "Don't know", "Use what I typed") cover the matches. Typing "Ramabhakta" showed no Composition at all. Hopes the list can go fully up, or that in the browser you can scroll all the way up. *Checked: the catalog has "Rama Bhakta Hanuman" and the search indexes titles without spaces, so the matches were most likely there but out of view.* | Safari tab, keyboard up |
| FB-20 | W4 | U1 | Didn't really see the search bar, though it's the hero of the Item and of the other pickers. On the Tala sheet, Nadai sits above it; making Nadai a second step would give it too much airtime. A different, smart solution is needed. | Item search, Tala sheet, other pickers |
| FB-21 | W4 | U2 | The "Raga" label sits too close to its pill. | Item page |
| FB-22 | W4 | U2 | Reverse Done and Next Item: Done is the main action. | Item page, bottom bar |
| FB-23 | W4 | U2 | "Item 1 ·" is too big; it should be an eyebrow. | Item page |
| FB-24 | W4 | U2 | The Add Item button at the bottom, for a list that sits in the middle of the page, felt like the wrong solution. Maybe interchange them. | Concert page |
| FB-25 | W4 | I3 | Like the photo (FB-14), let the rasika record a short excerpt, kept on the phone. To be seen. | Remembering how a piece sounded |
| FB-26 | W5 | U2 | The up and down buttons are the wrong way to reorder; use drag and drop instead. | Reordering Items |
| FB-27 | W5 | U2 | The "Laya vinyasam" pill is too big. A mridangam icon would be ideal, though there isn't one; a star or some other icon would do. | Item rows |
| FB-28 | W6 | U2 | A random flash when marking the Laya vinyasam; it looks bad. *Checked: most likely the save highlight, the 1.2s fade DESIGN.md "Motion" shows after each save.* | Marking the Laya vinyasam |
| FB-29 | W6 | F2 | Nadai should be a second-order choice under the Laya vinyasam, reached with a tap: many rasikas won't know it. Today the Nadai shows straight away. | Laya vinyasam, Tala sheet (see FB-20) |
| FB-30 | all | U2 | Overall the app felt super fast but finicky: the elegance in transitions and the small details isn't there. The aim is fast *and* elegant. Proposes a UI hill-climb for the push (method in `ui-hill-climb.md`). *Checked: the 2-minute CI doesn't cause this. DESIGN.md "Motion" keeps motion nearly absent on purpose ("Motion explains a change and is otherwise absent"), so this is a design rule to revisit, not a speed trade-off.* | Throughout |
| FB-31 | 2nd pass | U1 | The Laya vinyasam and the other sections should look more alike. It isn't clear why they're split into separate folds. | Item page |
| FB-32 | 2nd pass | U1 | Is a pill saying "Add" the best choice? | Item page, empty fields |
| FB-33 | 2nd pass | F1 | Throughout, including on an Item, it isn't clear that a value such as the composer or language can be changed. Maybe they need the underline too. | Item page, other pages |
| FB-34 | 2nd pass | U1 | The flash is still there when tapping a chip such as Alapana (FB-28 again, after PR #12). *Checked: it's the save highlight in `feedback.tsx`, which still plays on chip taps.* | Tapping a chip |
| FB-35 | 2nd pass | W3 | Composition forms should be in sentence case too: Kriti, Javali. | Item page |
| FB-36 | 2nd pass | F1 | After marking a Concert done, it isn't clear how to reopen it. That raises the question of why "Done with this Concert" exists at all. If it's only there to produce "What it added", ask something else. People are too much on the move to remember to do it. | Ending a Concert |
| FB-37 | 2nd pass | F1 | Done on the Item page should mean "done for now", not that the Concert is done. *Checked: it only goes back to the Concert, so the label is what misleads.* | Item page, bottom bar |
| FB-38 | 2nd pass | U2 | It feels as if no shadcn components were used. The three-dots delete button at the top right is blocky and doesn't move; it feels built in 2015. The small movement on Add Item is liked; the motion that exists now makes it feel better. *Checked: the menu is shadcn's DropdownMenu; the app uses only four primitives (badge, button, dropdown-menu, sheet), and the folds are hand-made.* | Concert and Item pages |
| FB-39 | 2nd pass | U2 | Hates the current "What it added". It should be a modal after finishing, and nothing else. | Ending a Concert |
| FB-40 | 2nd pass | F2 | The Note can go in a fold too. | Concert page |
| FB-41 | 2nd pass | S3 | A small lag after tapping Settings, with a small jitter in the UI. | Opening Settings |
| FB-42 | 2nd pass | U2 | Why are there pills for the Raga? It needs consistency. How important a value is can be shown by weight or by brightness or transparency. | Item page |
| FB-43 | 2nd pass | U3 | The horizontal separator between RTP, Virutham and "Don't know" and the others sits too close to the pills; it feels off. | Item kinds |
| FB-44 | 2nd pass | U3 | A sheet opening (the Colours) is very good, but closing it has no motion. It should slide back down the same way, ideally a setting in shadcn. The same goes for closing a fold. *Checked: the folds open and close with no height animation.* | Sheets, folds |

## Synthesis

*Agreed 2026-11-04.* Collection ended after W6; W5 was partly done; W7 to W9 weren't tried.

### Themes

| Theme | Feedback | Weight-1 pieces |
|---|---|---|
| **1. The Concert's shape**: what leads, where the actions sit, getting to another Concert | FB-06, FB-07, FB-08, FB-09, FB-21, FB-22, FB-23, FB-24 | FB-09 |
| **2. The Stage**: Artists without an order, a Role chosen for you, names you can fix | FB-10, FB-11, FB-15, FB-16, FB-17 | FB-15 |
| **3. Search and pickers**: the search as the hero, the keyboard, Nadai as a second step | FB-19, FB-20, FB-29 | FB-20 |
| **4. Feel**: motion and transitions, the colour sheet, the flash, pills and icons, reordering | FB-04, FB-12, FB-13, FB-26, FB-27, FB-28, FB-30 | |
| **5. First run** (open): the install prompt, Sabhas on a fresh phone | FB-01, FB-02, FB-03, FB-05 | FB-05 |
| **6. Later ideas** (open): a photo, an audio excerpt, groups of Artists | FB-14, FB-18, FB-25 | |

### Not yet covered

The paths where a failure loses data: deleting and undoing (W5), airplane mode and force-close
(W7), Settings and Export (W8), deleting a Concert (W9). They need the phone before any rasika
installs.

### Order

Agreed 2026-11-04: **shape first** (themes 1 and 2), then **feel** (themes 3 and 4) by the
UI hill-climb in `ui-hill-climb.md`. The hill-climb changes how screens look, not what they
are, so it comes after the shape changes.

### Decisions: themes 1 and 2 (agreed 2026-11-04)

| # | Feedback | Decision |
|---|---|---|
| S1 | FB-06, FB-09 | The Season page gets the same fixed bottom bar as the Concert page, always holding "+ Log a Concert", whether or not a Concert is open. The open Concert becomes a card you tap to continue. |
| S2 | FB-07 | The main performers lead the Concert page and the Season cards: vocal, veena or flute (or the presenter at a Lecdem), joined with "&" for a duo. Without a main performer, the first Artist in Stage order leads. Before any Artist, the heading is "+ Add Artist". The Sabha, date and time go on the line below. |
| S3 | FB-24 | The Concert page runs: heading, Stage, Note, Items. The Items come last, so the list ends right above the docked Add Item. "Done with this Concert" stays after the last Item. |
| S4 | FB-15 | The Stage has no "Edit order". Artists are listed by Role, as in a printed kutcheri listing: vocal, veena, flute, violin, mridangam, ghatam, khanjira, morsing, other, presenter, then no Role. Ties keep the order added. |
| S5 | FB-17 | The name at the top of the Artist sheet can be edited. The new name applies to that Artist in every Concert, and the old name stays as an alias, so search still finds it. |
| S6 | FB-11 | Adding an Artist you've logged before pre-selects their usual Role. |
| S7 | FB-16 | "Remove from Stage" becomes a bin icon and "Remove". |
| S8 | FB-10 | Role chips are capitalised ("Vocal", "Violin"), like the other chips. |
| S9 | FB-22 | On the Item page, Done is the filled main button on the right; Next Item is the outlined one on the left. |
| S10 | FB-23 | "Item 1" becomes a small muted eyebrow above the Composition's title. |
| S11 | FB-21, FB-08 | More space between a field's label and its pill; a taller date and time row. |
| S12 | — | The "Running order" heading becomes "Items". |

Small visual details beyond these are the builder's call, from DESIGN.md, stated with a reason.

## Outcome

| Themes | Where | State |
|---|---|---|
| 1, 2 (S1 to S12) | PR #11 | Merged 2026-11-04 |
| 3, 4 | PR #12, the UI hill-climb (method in `ui-hill-climb.md`) | Merged 2026-11-05; lowest council score 5.5 to 7 over six rounds |
| 5, 6 | | Open |

The hill-climb's parked choices, answered 2026-11-05: Items reorder by dragging a grip, with
the arrows kept for VoiceOver (FB-26); the Laya vinyasam's Nadai sits behind "+ Nadai"
(FB-29); the Colour sheet keeps circles, in the colour wheel's order, with a two-tone outfit
as one half-and-half circle (FB-13), and more colours are T118.

Still owed on the phone, before any rasika installs: the new build's look and motion, and the
data-loss workflows W5 (delete and undo), W7, W8 and W9.

## Second pass synthesis

*Agreed 2026-11-05.* Covers FB-31 to FB-44, on the build with PR #12.

### Themes

| Theme | Feedback | Weight-1 pieces |
|---|---|---|
| **7. Ending a Concert**: what "done" means, reopening, the summary | FB-36, FB-37, FB-39 | FB-36 |
| **8. One look for values**: fields, pills, folds, the Note | FB-31, FB-32, FB-33, FB-35, FB-40, FB-42, FB-43 | FB-31, FB-32, FB-33 |
| **9. Motion and parts**: the flash, closing motion, shadcn, the Settings jitter | FB-34, FB-38, FB-41, FB-44 | FB-34 |

### What the code does today

- "Done with this Concert" only takes the Concert off the Season page's open card. A Concert
  already stops being open on its own, four hours after its start or an hour after the last
  Item changed, and logging again reopens it. So nothing needs closing, and nothing needs
  reopening.
- "What it added" is a card left permanently at the end of a past Concert.
- Done on an Item page only goes back to the Concert.

### Proposed (the builder's call, with the reason)

| # | Feedback | Proposal | Why |
|---|---|---|---|
| P1 | FB-37 | Keep "Done" on the Item page. | Once the manual end goes (theme 7), nothing else says "done", so there's no clash. |
| P2 | FB-33, FB-42, FB-32 | Every value is one kind of row: a small muted label, the value as text with the underline the Concert's date and Sabha already have. Weight and contrast show importance: the Composition is bold, Raga and Tala are full contrast, Composer, Language, Subject and Form are muted. An empty value shows a muted "+", not an "Add" pill. | One affordance that reads as "tap to change" everywhere; pills stop meaning two things. |
| P3 | FB-42 | Chips stay only for choosing from a short fixed set: the Item kinds, Alapana and the other improvised parts, Roles. | Then a chip always means "pick one of these". |
| P4 | FB-35 | Composition forms in sentence case: Kriti, Javali, Varnam. | Like the Roles (S8). |
| P5 | FB-43 | The separator above the Item kinds and "Don't know" sits on the 8px grid with the pills' own gap above it. | It's the same spacing rule as the rest of the grid. |
| P6 | FB-40 | The Note moves into the same fold, open when it has text, closed when empty. | A note you wrote stays visible; an empty one takes one row. |
| P7 | FB-34 | The save highlight never plays on chips and toggles, only on values whose change you can't see. | The chip's own state already shows the save; the flash is noise. |
| P8 | FB-44 | Sheets slide back down the way they came; folds open and close with a height animation. Both from shadcn (its Sheet's exit state, and its Accordion in place of the hand-made fold). | Motion that explains a change in both directions. |
| P9 | FB-38 | Use a shadcn primitive wherever one exists, with its own motion. The three-dots menu gets shadcn's fade-and-scale and a ghost icon button. DESIGN.md's Motion section says so. | The parts look and move as one system. |
| P10 | FB-41 | Find what Settings waits on when it opens and paint it without the jump. | Measured in the build, not guessed. |

### Decisions (agreed 2026-11-05)

| # | Feedback | Decision |
|---|---|---|
| S13 | FB-36, FB-39 | No "Done with this Concert". A Concert ends on its own (four hours after its start, or an hour after the last Item changed) and can always be edited, so there's nothing to reopen. Its summary (Items, Ragas, firsts, new Composers) shows once as a modal the next time the app opens after the Concert ends, then it's gone from the page. |
| S14 | FB-31 | One fold, Improvised: the Laya vinyasam becomes one more row beside Alapana, Tanam, Niraval and Kalpanaswaram, with its Nadai behind "+ Nadai". |

P1 to P10 above stand as the builder's call.
