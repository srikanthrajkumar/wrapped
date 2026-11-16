# UI inventory (phase 1)

What is on screen in the app at `main` 2be3465, as it is live. Phase 1 of the design process:
observe and name differences only. Nothing here proposes a fix. Phase 2 writes one spec per unit,
phase 3 composes them per screen, phase 4 makes each kind of unit the same everywhere.

**How it was taken.** The production build in Chromium at 375 × 812 (2x), dark, with the
hill-climb seed (`app/e2e/hill-climb/SEED.md`) plus five listings on the seed's "today", and the
clock fixed at Mon 14 Dec 2026, 7:30 pm in Chennai. One phone was a browser tab (the install
strip shows, first launch, the empty Season), the other installed (no strip). The script is
`app/e2e/inventory/shots.ts` (not committed). Screenshots are named `view` below and live only in
the Artifact page, not in git.

**What the shots can't show:**

- **The status band.** A headless browser has no top inset, so nothing draws there.
- **The keyboard.** It isn't drawn.
- **The amber Settings dot.** It shows in every installed shot because the test browser never
  promises to keep storage ("Storage not protected"). A real phone usually won't show it.
- **The focus ring on the Event heading.** In `event`, `event-bare` and `event-long` it is a
  test artefact: the browser counts the scripted tap as keyboard use. The same goes for the ring
  on the calendar button in `whatson-nomatch`.
- **States not shot:** the update or new-catalog row, Android's install strip, a failed Undo bar,
  "Still opening your season…", the Clear sheet, "None of the rest" (answering Yes also settled
  the other concert in that slot, as designed), the save highlight, and a dragged row.

## Summary

- **48 units.** Every one has an entry below (U01 to U48).
- **Top five inconsistencies, by how often a rasika meets them:**
  1. **The text column jumps between 24px and 16px.** On the hub every label and row starts 24px
     in, with rows on a panel. Every other page puts text on the 16px gutter with flat,
     hairlined rows. You meet it on every tab switch (`hub-now` against `whatson`, `shortlist`,
     `diary`).
  2. **Section labels come in five styles.** The hub uses a 20px/600 header with a count and a
     chevron. The Event, What's on days, Shortlist days and folds use a 15px/600 muted label.
     Slots and lapsed days use a 13px caption. "Earlier today" is 15px at 400. You meet it on
     every screen (U11, U13).
  3. **A list row is built eight ways.** Concert row, hub Diary row, lapse row, Item row, Stage
     row, Settings row, and two kinds of search result row. They differ in padding (10px vs 8px),
     gap (8 vs 12), title weight (400 vs 600), divider and container. You meet it in every list
     (U14 to U19).
  4. **The page title has four sizes and spacings.** The curtain title is 24/700 on the curtain.
     Tab pages put a 24/700 title 16px from the top. What's on puts it 8px under a back bar. The
     Event title is 20/600 and the Item title is 20/600 with an eyebrow. You meet it on every
     navigation (U07, U08).
  5. **Searching works three ways.** What's on's bar opens a sheet with the field on top and
     results top-down, with no best match. The Item, Artist, Sabha and Detail pickers dock the
     field at the bottom with results bottom-up and the best match filled. "No match" is written
     and placed differently in each. You meet it on every search (U21 to U23).
- **What DESIGN.md says nothing about:**
  - the Placeholder pages ("Tidy", "Review", "Not found");
  - the Composition sheet (tap an Item's title);
  - the Clear sheet's layout;
  - the Undo bar's look (only its behaviour is written down);
  - the native clear (×) inside the search fields, which in the What's on search sheet stands
    beside the sheet's own close ×;
  - the Item editor's Raga "Edit order" controls;
  - First launch's progress bar.

  The unit table marks partial descriptions too.

## Unit index

| #   | Unit                                    | Code                                           | Versions | DESIGN.md                                |
| --- | --------------------------------------- | ---------------------------------------------- | -------- | ---------------------------------------- |
| U01 | Status band                             | `App.tsx:217`, `app.css:37`                    | 2        | Described; not observable here           |
| U02 | Tab bar                                 | `App.tsx:51`                                   | 2        | Described; matches                       |
| U03 | Install strip                           | `InstallRow.tsx`                               | 2        | Described; matches                       |
| U04 | Bottom bar frame                        | `layout.tsx:97` ActionBar                      | 4        | Described (FB-45); matches               |
| U05 | Curtain                                 | `layout.tsx:284`                               | 2        | Described; matches                       |
| U06 | Hero                                    | `HubScreen.tsx:340`                            | 5        | Described; matches                       |
| U07 | Tab header                              | `layout.tsx:250`                               | 3        | Described; matches                       |
| U08 | Pushed top bar and page title           | `layout.tsx:197`, screens                      | 5        | Partly; titles differ                    |
| U09 | Section header                          | `layout.tsx:382`                               | 5        | Described; matches, but only the hub uses it |
| U10 | Panel                                   | `layout.tsx:437`                               | 3        | Described; corners differ (18 vs 16)     |
| U11 | Section label (older)                   | `layout.tsx:345` + hand-built                  | 5        | Partly                                   |
| U12 | Caption label                           | `HubScreen.tsx:464`, `ShortlistScreen.tsx:88`  | 2        | Described (Shortlist)                    |
| U13 | Fold / accordion                        | `fold.tsx`, `WhatsOnScreen.tsx:1105`           | 4        | Described; "Earlier today" doesn't match |
| U14 | Concert row                             | `ConcertRow.tsx`                               | 9        | Described; matches                       |
| U15 | Hub Diary row                           | `HubScreen.tsx:305`                            | 1        | Described as "one row"; hand-built       |
| U16 | Lapse question                          | `HubScreen.tsx:422`                            | 2        | Described; "Yes" is a pill               |
| U17 | Item row                                | `EventScreen.tsx:357`                          | 3        | Described                                |
| U18 | Stage row                               | `EventScreen.tsx:684`                          | 2        | Described                                |
| U19 | Settings row                            | `SettingsScreen.tsx:34`                        | 4        | Described; matches                       |
| U20 | Strip of days                           | `WhatsOnScreen.tsx:424`                        | 3        | Described; matches                       |
| U21 | What's on search bar                    | `WhatsOnScreen.tsx:795`                        | 2        | Described; matches                       |
| U22 | What's on search sheet                  | `WhatsOnScreen.tsx:892`                        | 3        | Described; no-match isn't the Empty      |
| U23 | Docked search                           | `DockedSearch.tsx`                             | 5        | Described; matches                       |
| U24 | Search result rows                      | `DockedSearch.tsx:104`, `WhatsOnScreen.tsx:1025` | 3      | Described                                |
| U25 | Sheet (frame)                           | `ui/sheet.tsx`, `sheet-frame.tsx`              | 4        | Described                                |
| U26 | Listing sheet                           | `ListingSheet.tsx`                             | 4        | Described; matches                       |
| U27 | Calendar sheet                          | `WhatsOnScreen.tsx:659`                        | 1        | Described; matches                       |
| U28 | Event facts sheet                       | `EventScreen.tsx:959`                          | 1        | Described (T119 to T122)                 |
| U29 | Name picker (Artist, Sabha)             | `NamePicker.tsx`                               | 3        | Described; titles not a pair             |
| U30 | Artist sheet                            | `EventScreen.tsx:810`                          | 1        | Described; matches                       |
| U31 | Colour sheet and swatch                 | `ColourPicker.tsx:124`                         | 2        | Described; matches                       |
| U32 | Colour dot                              | `ColourPicker.tsx:65`                          | 4        | Described; matches                       |
| U33 | Detail input sheet                      | `DetailInput.tsx`                              | 2        | Described; matches                       |
| U34 | Schedule changed (hint and sheet)       | `ConcertRow.tsx:205`, `ScheduleChanged.tsx`    | 2        | Described; matches                       |
| U35 | Concert summary                         | `ConcertSummary.tsx`                           | 2        | Described; time wraps                    |
| U36 | Empty state                             | `ui/empty.tsx` + inline                        | 9        | Described; several differ                |
| U37 | Button                                  | `ui/button.tsx`                                | 6        | Described; matches                       |
| U38 | The + (every one)                       | various                                        | 6        | Partly                                   |
| U39 | Quiet text button                       | `layout.tsx:454`                               | 3        | Described ("Edit order")                 |
| U40 | Underlined value                        | `ItemEditor.tsx:859` and 4 more                | 5        | Described (Values); heights differ       |
| U41 | Chip                                    | `DockedSearch.tsx:192`                         | 7        | Described; matches                       |
| U42 | Text toggle                             | `WhatsOnScreen.tsx:945`                        | 1        | Described; matches                       |
| U43 | Theme track                             | `SettingsScreen.tsx:243`                       | 1        | Described ("one track")                  |
| U44 | Undo bar                                | `UndoBar.tsx`                                  | 2        | Behaviour only                           |
| U45 | Feedback rows                           | `feedback.tsx`, `HubScreen.tsx:238`            | 5        | Described                                |
| U46 | "⋯" menu                                | `ui/dropdown-menu.tsx`                         | 2        | Described; Delete isn't red              |
| U47 | Small marks (kind, star, dot, cancelled) | `kind-mark.tsx`, `ConcertRow.tsx`             | 6        | Described; matches                       |
| U48 | First launch and rescue screens         | `FirstLaunch.tsx`, `RescueScreen.tsx`          | 4        | Described; consent steps not built       |

Not a unit, but asked about: **there is no toast anywhere.** DESIGN.md forbids one for a save,
and the app has none. Its feedback is the Undo bar (U44), the "Not saved" rows (U45) and, after a
Concert, the summary dialog (U35).

**About the 2x grid.** Many values that read as off-grid are deliberate optical alignments, not
drift:

- A 10px row padding makes a two-line row exactly 64px (10 + 24 + 20 + 10).
- A −14px margin puts a 20px mark inside a 48px target on the gutter.
- 22px chevrons and tab icons are the size Tabler draws them.

Each entry lists the values that differ between versions of the same unit. The deliberate
offsets are named only where they differ from one version to the next.

---

## Units

### U01 Status band

- **Code:** `App.tsx:217`; `app.css:37` (`status-band`) and `app.css:52` (`status-wash`).
- **Where:** every screen once first launch is done.
- **Versions:**
  - **Dark:** in the page colour.
  - **Light:** a rose ink, `oklch(0.24 0.045 12)`. Over the curtain it turns clear and fades
    back in over 150ms.
- **Shots:** none. The band only draws with a top inset (an installed iPhone app).
- **DESIGN.md:** "The status bar" describes it, and the code matches the description.

### U02 Tab bar

- **Code:** `App.tsx:51`.
- **Where:** every screen except the Item editor and first launch.
- **Versions:**
  - One tab on, at 600 in the text colour.
  - The rest in `--tab-idle`.
  - Settings may carry a 10px amber dot.
- **Shots:** `hub-now`, `shortlist`, `settings`.
- **How they differ:**
  - Height 56px; icon 22px over a word.
  - The word is capped at 18px of caption text, 16px line, with 2px between icon and word.
  - A real `border-t` line, where lists elsewhere use the inset hairline.
- **DESIGN.md:** described under "Navigation", and the code matches.

### U03 Install strip

- **Code:** `InstallRow.tsx`.
- **Where:** above the tab bar on every tab, in a browser tab only.
- **Versions:**
  - **iPhone:** 36px, "Add to Home Screen:" with the Share, › and Add marks at 1.33em.
  - **Android:** 44px, with an "Install" text button. Not shot.
- **Shots:** `hub-empty`, `shortlist-empty`, `event-new`.
- **How they differ:**
  - Heights are 36 and 44, set by DESIGN.md itself.
  - Android's Install target is 44px, under the 48px used everywhere else.
- **DESIGN.md:** described under "Install", and the code matches.

### U04 Bottom bar frame

- **Code:** `layout.tsx:97` (ActionBar) and `layout.tsx:176` (BottomDock).
- **Where:** in the bottom stack, above the strip and the tabs.
- **Versions:**
  - **What's on:** the search bar, with no line above it and the list fading out.
  - **Event:** "Add Item"; while reordering, "Done".
  - **Item editor:** "Next Item →" and "Done".
  - **Elsewhere:** hidden (hub, Shortlist, Diary, Settings).
- **Shots:** `whatson`, `event`, `event-order`, `item`.
- **How they differ:** an 8px pad around a 56px button gives a 72px frame. With the 48px search
  bar the frame is 64px. A real `border-t`, except over the search bar.
- **DESIGN.md:** described under "Motion" (FB-45) and "Thumb zone", and the code matches.

### U05 Curtain

- **Code:** `layout.tsx:284`; its art is `SeasonArt`.
- **Where:** hub only.
- **Versions:** dark (ink with rose) and light (a pink field plus a rose-ink wash under the
  clock).
- **Shots:** `hub-now`, `hub-now.light`, `hub-empty`, `hub-nothing-ahead.light`.
- **How they differ:**
  - The edge has 18px corners, and the fade covers the bottom 80px at 50%.
  - The minimum height is the top inset plus 96px.
  - The content starts 8px under the safe area, 24px in from each side.
  - In light the field is much brighter, a large pink area (`hub-lapsed.light`).
- **DESIGN.md:** described under "The motif" (2026-11-14), and the code matches.

### U06 Hero

- **Code:** `HubScreen.tsx:340` (HubHero) and `HubScreen.tsx:382` (HeroConcert).
- **Where:** on the curtain.
- **Versions:**
  1. **Title only:** "Season", 24/700 (`hub-empty`, `hub-nothing-ahead`).
  2. **Now:** the Concert being logged (`hub-now`).
  3. **Next:** "Today · 4:00 pm" (`hub-next`).
  4. **Next inside the hour:** "in 20 min", in full ink (`hub-inhour`).
  5. **Choice:** "Pick your dusk", two concerts (`hub-choice`, `hub-tomorrow`).
- **How they differ:**
  - The word is 15/600 on a 48px row.
  - A single concert is 24/700 over a 15px line at 80% ink. Each concert in a choice is 20/600,
    12px apart.
  - The time is "in 20 min" today inside the hour, "Today · 4:00 pm" for a later time today,
    and "Tue 15 Dec · 4:00 pm" for another day (`hub-tomorrow`).
  - The hero's concert also appears as the first row under Today or Tomorrow (`hub-next`,
    `hub-choice`, `hub-tomorrow`). That is the repeat parked for phase 3.
- **DESIGN.md:** described under "The hero" and "A choice, never a pick", and the code matches.

### U07 Tab header

- **Code:** `layout.tsx:250`.
- **Where:** Shortlist, Diary, Settings.
- **Versions:** the same on all three (`shortlist.light` for light).
- **Shots:** `shortlist`, `diary`, `settings`, `diary.light`.
- **How they differ:** a 24/700 title, 16px from the top, then 8px down to the content.
- **DESIGN.md:** "plain tab header", and the code matches. Its `action` slot is unused.

### U08 Pushed top bar and page title

- **Code:** TopBar at `layout.tsx:197`, with titles in each screen.
- **Where:** What's on, the Event, the Item editor, the Placeholder pages.
- **Versions:**
  1. **What's on:** "‹ Season", then an h1 at 24/700, 8px under the bar (`whatson`).
  2. **Event:** "‹ Diary" (or Season, What's on, Shortlist) and "⋯", then an h1 at 20/600 with
     its kind mark and the facts line under it (`event`, `event-long`, `event.light`).
  3. **Event with no Artist:** the h1 is a "+ Add Artist" button (`event-bare`, `event-new`).
  4. **Item editor, new:** "‹ Music Academy", then "Item 12" at 20/600, 4px under the bar
     (`item-search-empty`, `item-search-empty.light`).
  5. **Item editor, edit:** "‹ Music Academy" and "⋯", then the eyebrow "Item 6" in caption over
     the title at 20/600, underlined, 12px under the bar (`item`).
- **How they differ:**
  - Title size: 24/700 on What's on, 20/600 on the Event and the Item.
  - Gap under the bar: 8px (What's on), about 8px (Event), 4px (new Item), 12px (Item).
  - The back label comes from the tab's stack (Event), from the Sabha (Item, falling back to
    "Concert"), or is fixed as "Season" (What's on, Placeholder).
- **DESIGN.md:** "Pushed screens' top bar" matches. The title sizes follow DESIGN.md
  ("heading" for What's on, "title" for the Event), but nothing says they should differ.

### U09 Section header

- **Code:** `layout.tsx:382`.
- **Where:** hub only. Today or Tomorrow, the lapse question, Shortlist, Diary.
- **Versions:**
  1. Label, count and chevron (`hub-now` Today).
  2. Label and a muted line, with a chevron (`hub-empty` Shortlist "Nothing yet").
  3. Label, a line with near parts in full ink, count and chevron (`hub-now-starred`
     Shortlist).
  4. The question with a day line and no chevron (`hub-lapsed`).
  5. "Tomorrow" or a day name (`hub-tomorrow`).
- **How they differ:**
  - The label is 20/600 and the count 15px muted. The chevron is 22px.
  - Space above changes from section to section: First 0, Shortlist 16, Diary 16 with 32
    below, Lapse 16 below.
- **DESIGN.md:** "The section pattern" matches. DESIGN.md calls it the pattern "other pages
  reuse", but no other page uses it yet.

### U10 Panel

- **Code:** `layout.tsx:437`.
- **Where:** hub only. Today's rows, the Diary row, the lapse question.
- **Versions:** rows (`hub-now`), one row (Diary), and the question with its buttons
  (`hub-lapsed`).
- **How they differ:**
  - It reaches 8px past the gutter, and its rows sit 16px in.
  - Corners are `rounded-2xl`, which is **18px**. DESIGN.md says **16px**.
  - In light the panel is a faint grey on white (`hub-choice.light`).
- **DESIGN.md:** described, but the corner value differs.

### U11 Section label (older style)

- **Code:** `layout.tsx:345` (SectionHead), and hand-built at `WhatsOnScreen.tsx:1099` and
  `ShortlistScreen.tsx:64`.
- **Where:** the Event (Items, Stage), What's on (each day), Shortlist (each day).
- **Versions:**
  1. **Event:** "Items" with "Edit order", and "Stage" with a + (`event-full`).
  2. **What's on day:** "Mon 14 Dec", sticky with a 24px fade under it (`whatson`,
     `whatson-pinned`).
  3. **Shortlist day:** "Today" or "Tue 15 Dec", not sticky (`shortlist`).
  4. **The fold title:** "Note", "Improvised" (U13).
  5. **The Settings "Theme" label:** 15px muted at 400 (`settings`).
- **How they differ:**
  - All are 15/600 muted except "Theme" (400) and "Earlier today" (400).
  - The Event's label has a hairline under it. The day labels have none.
  - The words for today differ. What's on labels today "Mon 14 Dec" while its strip says
    "Today". Shortlist and Diary say "Today". The hub says "Today", or "Tomorrow" for the next
    day.
- **DESIGN.md:** describes the Event's labels ("a `sub` 600 muted label, a hairline"). It names
  the day label but not its style or wording.

### U12 Caption label

- **Code:** `ShortlistScreen.tsx:88` (slot) and `HubScreen.tsx:464` (lapse day, several days).
- **Where:** Shortlist slots; the lapse question when more than one day is asked about.
- **Versions:**
  - "4:00 pm … 2" (`shortlist`).
  - A day caption (not shot: needs lapsed concerts on two days).
- **How they differ:** 13px muted, 12px above. The slot caption has a count at its right.
- **DESIGN.md:** describes the Shortlist slot caption, and the code matches.

### U13 Fold / accordion

- **Code:** `fold.tsx` and `ui/accordion.tsx`; "Earlier today" at `WhatsOnScreen.tsx:1105`;
  "More" at `NamePicker.tsx:217`.
- **Where:** the Event's Note, the Item's Improvised, What's on's "Earlier today", the Artist
  sheet's Role "More".
- **Versions:**
  1. **Note:** open when it has text (`event-full`), shut when empty (`event-bare`).
  2. **Improvised:** with a line above it (`item`, `item-rtp` shut).
  3. **"Earlier today":** hand-built (`whatson`, `whatson-earlier`).
  4. **"More":** a chip that vanishes once tapped (`artist-sheet`).
- **How they differ:**
  - **Trigger:** 15/600 muted with a 20px chevron for the accordion; "Earlier today" is 15px
    at 400 with a count.
  - **Motion:** the accordion grows over 200ms. "Earlier today" turns its chevron over 150ms and
    its rows appear at once. "More" doesn't animate and can't be closed.
  - "Earlier today" sits 6px under its day label.
- **DESIGN.md:** "Folds are shadcn's Accordion". "Earlier today" isn't one.

### U14 Concert row

- **Code:** `ConcertRow.tsx`.
- **Where:** hub Today or Tomorrow (on a panel), What's on, Shortlist, Diary.
- **Versions:**
  1. **Hub, closeness:** "in 15 min" or "● On now" (`hub-now`).
  2. **Hub, another day:** clock times (`hub-tomorrow`).
  3. **What's on:** clock time, with a dot before the time for one under way (`whatson`,
     `whatson.light`).
  4. **Shortlisted:** a 16px star in its own column (`hub-now-starred`, `whatson-starred`).
  5. **Cancelled:** at 60%, with the calendar-x mark (`whatson-pinned`, "T. M. Krishna").
  6. **Schedule changed:** a 48px hint button at its right (`schedule-changed-row`).
  7. **Heard:** "· 11 Items" (`whatson`).
  8. **Diary:** the day before the time, "Today · 6:00 pm" (`diary`).
  9. **No Sabha yet:** the lead is "No Sabha yet" and the line is only the time (`diary`,
     `whatson-past`).
- **How they differ:**
  - On the hub the row sits on a panel with 16px less room. Elsewhere it is flat on the page
    with hairlines and no line at the list's top.
  - The on-now dot sits 4 + 8px before "On now" on the hub, and 6px before the time elsewhere.
  - "Nobody billed" reads as the Sabha's name in the lead ("Brahma Gana Sabha", `whatson-pinned`).
- **DESIGN.md:** "The row" describes it, and the code matches.

### U15 Hub Diary row

- **Code:** `HubScreen.tsx:305`.
- **Where:** the hub's Diary section.
- **Versions:** one (`hub-now`, `hub-nothing-ahead`).
- **How it differs from U14:** hand-built, not a ConcertRow. It has no accompanists, title or
  type, and its line is "Sabha · day · N Items". The Diary page uses ConcertRow for the same
  concert, so the same concert shows accompanists there and not here.
- **DESIGN.md:** describes the content ("its name over Sabha · day · N Items"), which matches.
  DESIGN.md calls "the list row" a shared part.

### U16 Lapse question

- **Code:** `HubScreen.tsx:422`.
- **Where:** the hub, above Today.
- **Versions:**
  - One day (`hub-choice`, `hub-lapsed`).
  - Answered (`hub-lapsed-answered`): the card is gone, because answering one settled the other
    concert in its slot.
- **How they differ from other rows:**
  - The row has no minimum height and comes out at 68px (a 48px button plus 10px above and
    below).
  - "Yes" is an outline **pill** (fully round, `h-12`). Every other outline button has 18px
    corners.
  - "None of these" is a hand-built full-width text button at 17/600.
- **DESIGN.md:** described ("a 48px outline button with the word Yes"). DESIGN.md doesn't give
  the pill shape; under "Shapes", fully round means a chip.

### U17 Item row

- **Code:** `EventScreen.tsx:357`; ordering at `EventScreen.tsx:322`.
- **Where:** the Event's Items.
- **Versions:**
  1. Normal (`event-full`).
  2. With the Laya mark, a metronome (`event-full`, Item 6).
  3. Ordering: a bin and a grip, one line each, truncated (`event-order`).
- **How they differ from U14:**
  - Aligned to the top with a 12px gap, a leading number, and the title at **600**.
  - Ordering rows have 8px padding instead of 10px.
- **DESIGN.md:** described ("numbered rows, title then Raga · Composer"; "Reordering"), and the
  code matches.

### U18 Stage row

- **Code:** `EventScreen.tsx:684`; the colour button at `EventScreen.tsx:941`.
- **Where:** the Event's Stage.
- **Versions:** with a colour dot or an empty dot (`event-full`), with long names (`event-long`).
- **How it differs:** **8px** padding (rows elsewhere use 10px), a name over its role in 15px,
  and a 48px colour target at the right.
- **DESIGN.md:** described ("Stage"), and the code matches.

### U19 Settings row

- **Code:** `SettingsScreen.tsx:34`.
- **Where:** Settings.
- **Versions:**
  1. Ready offline.
  2. Getting ready, with a spinner (`settings-getting-ready`).
  3. Amber "Storage not protected".
  4. Export with "—" or "Last: …".
  5. The Maintainer link has a 20px chevron (`settings`).
- **How they differ:** 48px rows with 20px icons and a 12px gap. The Maintainer row has a line
  above and below (`hairline-y`). Its chevron is 20px where the hub's are 22px.
- **DESIGN.md:** described under "Settings", and the code matches.

### U20 Strip of days

- **Code:** `WhatsOnScreen.tsx:424`.
- **Where:** What's on.
- **Versions:**
  - Today on (`whatson`).
  - Pinned while scrolling, with a later day chosen (`whatson-pinned`).
  - With "Past" at its left (`whatson-past`).
- **How it differs:**
  - Stops are 48px tall and at least 44px wide.
  - The chosen stop is weight 500, the only 500 in the app.
  - Ink fades with time.
  - A 48px calendar button sits at the right.
- **DESIGN.md:** described at length, and the code matches.

### U21 What's on search bar

- **Code:** `WhatsOnScreen.tsx:795`.
- **Where:** What's on's bottom bar.
- **Versions:** empty, "Artist or Sabha…" (`whatson`); filtered, "Music Academy +1" with an ×
  (`whatson-filtered`).
- **How it differs:** it is a button drawn as a field: 48px, 14px corners, `surface-raised`.
- **DESIGN.md:** described ("Maps-style"), and the code matches.

### U22 What's on search sheet

- **Code:** `WhatsOnScreen.tsx:892`.
- **Where:** opened from U21.
- **Versions:**
  1. Before typing, with the Season's names A to Z (`whatson-search`, `whatson-search.light`).
  2. Typed (`whatson-search-typed`).
  3. No match (`whatson-search-none`).
- **How it differs:**
  - The field is on top, focused, and the sheet is 85% tall.
  - The native clear × inside the field sits next to the sheet's close ×, so two × marks stand
    side by side.
  - Rows are 48px: the name at 17/400, a muted kind word, and a check when picked.
  - "No Artist or Sabha by that name." is an inline 15px line.
- **DESIGN.md:** described. It also says "a search with no match" takes the Empty state, which
  this doesn't.

### U23 Docked search

- **Code:** `DockedSearch.tsx`.
- **Where:** Item editor (new Item, Composition sheet), Artist picker, Sabha picker, every Detail
  sheet.
- **Versions:**
  1. Item, before typing: chips and "? Don't know" pinned above the box (`item-search-empty`).
  2. Item, typed: results with the best match filled, nearest the box (`item-search`,
     `item-search.light`).
  3. Item, no match: "No match in the catalog" (`item-search-none`).
  4. Artist or Sabha picker: recent names, then matches, then "Add "…" as a new Artist"
     (`artist-picker`, `artist-picker-typed`, `sabha-picker`).
  5. Detail: state chips above the box (`raga-sheet`, `tala-sheet`).
- **How they differ:**
  - The field is identical everywhere (48px, 14px corners, a 2px ring when focused). Its class
    string is copied in What's on rather than shared.
  - The no-match note is 15px with 4px of side padding.
- **DESIGN.md:** described ("Search box", "Search result", "Search states"), and the code
  matches.

### U24 Search result rows

- **Code:** `DockedSearch.tsx:104` (results), `DockedSearch.tsx:169` (FixedRow),
  `WhatsOnScreen.tsx:1025` (name rows).
- **Versions:**
  1. **Docked result:** title at 600 over a line, the best match filled.
  2. **Fixed row:** 48px, 17/400 ("? Don't know", "Use what I typed").
  3. **What's on name row:** 17/400 with a kind word and a check.
- **Shots:** `item-search`, `artist-picker-typed`, `whatson-search-typed`.
- **How they differ:**
  - Names are at 600 in the docked list and 400 in What's on.
  - Dividers: a hairline above each docked row; a hairline below each What's on row.
  - Only the docked list fills its best match.
- **DESIGN.md:** describes both.

### U25 Sheet (frame)

- **Code:** `ui/sheet.tsx`, `sheet-frame.tsx`; `ui/dialog.tsx` for the summary.
- **Where:** every sheet.
- **Versions:**
  1. **As tall as its content:** the listing sheet, the facts sheet.
  2. **Tall (92%):** pickers, Detail sheets, Composition.
  3. **Search (85%).**
  4. **Dialog:** the Concert summary.
- **Shots:** `listing-sheet`, `artist-picker`, `whatson-search`, `concert-summary`.
- **How they differ:**
  - Sheet corners are 18px, with a 20px close × (48px target) 2px from the right.
  - The Dialog's close sits 8px from the right, and the Dialog is padded 24px against the
    sheet's 16px.
  - The scrim is 50% black. The Dialog's is also blurred and grey.
  - Titles are 20/600 on a 48px row. The listing sheet copies that style by hand, and the
    calendar's month title is a plain paragraph.
- **DESIGN.md:** "Elevation & Depth", "Motion" and "Sheets" describe it, and the code matches.

### U26 Listing sheet

- **Code:** `ListingSheet.tsx`.
- **Where:** a row tapped on What's on, the hub or Shortlist.
- **Versions:**
  1. Shortlist + "I'm here" (`listing-sheet`, `listing-sheet.light`).
  2. Shortlisted, with a filled star (`listing-sheet-shortlisted`; from the Shortlist, with the
     hint row behind it, `event-planned`).
  3. A concert gone: "I was there" alone (`listing-sheet-past`).
  4. Cancelled: no buttons, just the calendar-x mark (`listing-sheet-cancelled`).
- **How they differ:** facts with 20px marks; two 56px buttons, 8px apart. The cancelled sheet
  ends on a bare icon with no words.
- **DESIGN.md:** described, and the code matches.

### U27 Calendar sheet

- **Code:** `WhatsOnScreen.tsx:659`.
- **Versions:** one (`whatson-calendar`, `whatson-calendar.light`).
- **How it differs:**
  - The month is 20/600, as a plain paragraph.
  - Days are 48px, with 4px dots. Today is in 600, where the strip's chosen day is 500.
- **DESIGN.md:** described, and the code matches.

### U28 Event facts sheet

- **Code:** `EventScreen.tsx:959`.
- **Versions:** one (`event-facts`, `event-facts.light`).
- **How it differs:**
  - Kind chips have their marks.
  - Its fields (Sabha, Date, Start time) are 48px `surface-raised` boxes with a trailing mark.
    That is the only place "field boxes" appear.
  - Field labels are 15px muted. In the Item editor they are 13px.
- **DESIGN.md:** described (T119 to T122, the 2026-11-04 decision on the facts sheet).

### U29 Name picker (Artist, Sabha)

- **Code:** `NamePicker.tsx`.
- **Versions:** Artist before typing (`artist-picker`); Artist typed (`artist-picker-typed`);
  Sabha (`sabha-picker`).
- **How they differ:** the titles are "Add Artist" and "Sabha", not a matching pair. After an
  Artist is picked, the Role chips replace the search (not shot).
- **DESIGN.md:** described ("Artist and Sabha pickers"), and the code matches.

### U30 Artist sheet

- **Code:** `EventScreen.tsx:810`.
- **Versions:** one (`artist-sheet`).
- **How it differs:**
  - The title is the name as an editable field.
  - Role chips sit under a 15px "Role" label, with "More".
  - "Colours" is an outline button with the dot.
  - "Remove" is a red text button with a bin.
- **DESIGN.md:** described, and the code matches.

### U31 Colour sheet and swatch

- **Code:** `ColourPicker.tsx:124` and `ColourPicker.tsx:194`.
- **Versions:** dark (`colour-sheet`) and light (`colour-sheet.light`).
- **How it differs:**
  - 56px round swatches, four to a row, each named below.
  - The picked one has a check and a 2px ring.
  - "?" has no name under it.
  - "Second colour: White" is an outline button and "Remove second colour" a ghost button.
- **DESIGN.md:** described, and the code matches.

### U32 Colour dot

- **Code:** `ColourPicker.tsx:65`.
- **Where:** Stage rows and the Artist sheet's "Colours" button.
- **Versions:** one colour, two-tone, none (a dashed ring), and "?" (`not-saved` shows all four).
- **How they differ:** 20px. "?" is drawn as a bordered circle with a 13px question mark, not as
  part of the SVG.
- **DESIGN.md:** described ("The dot is one drawing"), and the code matches.

### U33 Detail input sheet

- **Code:** `DetailInput.tsx`.
- **Versions:** Raga (`raga-sheet`); Tala with Nadai chips (`tala-sheet`).
- **How it differs:** the title is followed by "Now: …". The ?, Not sure and N/A chips sit above
  the box. Nadai chips go under a 13px "Nadai" label.
- **DESIGN.md:** described ("Detail input"), and the code matches.

### U34 Schedule changed

- **Code:** `ConcertRow.tsx:205` (hint) and `ScheduleChanged.tsx` (sheet).
- **Versions:** the hint on a row (`schedule-changed-row`); the sheet, "4:00 pm → 6:00 pm"
  (`schedule-changed-sheet`).
- **How it differs:** the buttons are "Keep mine" (outline, ×) and "Take it" (primary, check),
  16px under the facts. The listing sheet's buttons use a margin where these use padding;
  visually the same.
- **DESIGN.md:** described, and the code matches.

### U35 Concert summary

- **Code:** `ConcertSummary.tsx`.
- **Versions:** dark and light (`concert-summary`, `concert-summary.light`).
- **How it differs:**
  - A Dialog, not a sheet: a 96px band of the motif with an 18px edge.
  - Two 32px numbers.
  - "First Ragas" and "New Composers" with names.
  - The facts line breaks inside the time: "6:00 / pm". Rows never break a time.
- **DESIGN.md:** described ("Finishing a Concert"). DESIGN.md doesn't mention the time breaking.

### U36 Empty state

- **Code:** `ui/empty.tsx`; inline lines in screens.
- **Versions:**
  1. **Hub, no Schedule:** a bare 28px moon, "Nothing listed yet" and a line, 24px above
     (`hub-empty`, `hub-empty.light`).
  2. **Hub, nothing ahead:** the bare moon and "Nothing more today", with no line
     (`hub-nothing-ahead`).
  3. **Shortlist:** a 48px tile, the title, a line and an outline "What's on", centred in the
     page (`shortlist-empty`, `shortlist-empty.light`).
  4. **Diary:** the tile, title and line, centred (`diary-empty`).
  5. **What's on, nothing listed:** the tile, centred (`whatson-empty`).
  6. **What's on, filter matches nothing:** the tile, "Nothing here matches" and "Clear
     filters", 32px above (`whatson-nomatch`).
  7. **Event, no Items:** the tile, title and line, 40px above and 8px below (`event-bare`).
  8. **Inline 15px line:** the hub sections ("Nothing yet", "Nothing heard yet"), the search
     sheet ("No Artist or Sabha by that name."), docked search ("No match in the catalog").
  9. **Inline 17px line:** "This Concert is not on this phone." (not shot).
- **How they differ:**
  - The mark is bare on the hub and a tile everywhere else.
  - Space above is 24, 32, 40, or centred in the page.
  - "Nothing yet" means "nothing Shortlisted" on the hub and "no days gone" in What's on.
- **DESIGN.md:** describes the Empty with 32px above and below. The Event (40/8) and the tab
  pages (centred) don't match that, and the two searches with no match use inline text where
  DESIGN.md lists "a search with no match" as an Empty.

### U37 Button

- **Code:** `ui/button.tsx`.
- **Versions:**
  1. Primary 56px ("Add Item", "Done", "I'm here").
  2. Outline 56px ("Next Item", "Shortlist", "Keep mine").
  3. Outline 48px ("What's on", "Clear filters", "Colours").
  4. Ghost (Undo, ×, ⋯).
  5. Destructive as red text ("Remove").
  6. The outline pill ("Yes", U16).
- **Shots:** `listing-sheet`, `item`, `shortlist-empty`, `artist-sheet`, `hub-lapsed`.
- **How they differ:** 18px corners, 17/600 labels, 20px icons. The pill is fully round.
  `secondary` and `link` are unused.
- **DESIGN.md:** described ("Buttons"), and the code matches.

### U38 The + (every one)

- **Code:**
  - Hub: `HubScreen.tsx:202`.
  - Stage: `EventScreen.tsx:385`.
  - "+ Add Artist": `EventScreen.tsx:558`.
  - "+ Add Sabha": `EventScreen.tsx:587`.
  - Raga + and "+ Nadai": `ItemEditor.tsx:876`.
  - "Add Item": `EventScreen.tsx:434`.
- **Versions:**
  1. Hub: a 28px mark in a 48px target, in ink (`hub-now`).
  2. Stage: a 20px mark in a 48px target, in ink (`event-full`).
  3. "+ Add Artist" as the page title: 20px, 20/600 text in ink (`event-bare`).
  4. "+ Add Sabha": 20px, 17px muted, 56px tall (`event-bare`).
  5. Raga + and "+ Nadai": 20px, muted, 15px text, 4px gap (`item`, `item-improvised`).
  6. Inside "Add Item": 20px on the primary button.
- **How they differ:**
  - Mark size: 28px on the hub, 20px everywhere else.
  - Ink: full on the hub and Stage, muted on the Item editor and "+ Add Sabha".
  - Gap to its word: 8px or 4px.
  - "+ Add Artist" and the Stage + open the same picker in two styles.
- **DESIGN.md:** describes the hub +, the Stage + and the muted "+" for values. It doesn't say
  why they differ.

### U39 Quiet text button

- **Code:** `layout.tsx:454`.
- **Where:** "Edit order" on the Event and on Ragas; "Done" on Ragas; "Remove this Raga" and "In
  the Item's Raga" in Detail sheets.
- **Versions:** Event "Edit order" (`event-full`); Ragas "Edit order" (`item-rtp`).
- **How they differ:** 15px muted. The Event's "Edit order" switches the bottom bar to "Done".
  The Ragas' "Edit order" turns into an inline "Done", with arrows instead of a grip.
- **DESIGN.md:** describes "Edit order" for Items. The Raga ordering is described only as "its
  own move controls".

### U40 Underlined value

- **Code:**
  - ValueButton: `ItemEditor.tsx:859`.
  - Item title: `ItemEditor.tsx:501`.
  - Detail cell: `ItemEditor.tsx:930`.
  - Event facts line: `EventScreen.tsx:600`.
  - Artist name: `EventScreen.tsx:803`.
- **Versions:** the five above (`item`, `event`, `artist-sheet`).
- **How they differ:** the same underline (the `border` colour, 4px offset) at 48, 56 and 64px
  heights.
- **DESIGN.md:** "Values" describes it, and the code matches.

### U41 Chip

- **Code:** `DockedSearch.tsx:192`.
- **Versions:**
  1. Item kinds (RTP, Viruttam / Slokam, Medley).
  2. ?, Not sure, N/A.
  3. Nadai.
  4. Role, with "More".
  5. Event kinds, with marks.
  6. Improvised parts.
  7. Laya vinyasam.
- **Shots:** `item-search-empty`, `tala-sheet`, `artist-sheet`, `event-facts`, `item`.
- **How they differ:** all are 48px, fully round, 15px text. When pressed: a foreground border, a
  `surface-raised` fill and 600. "Not sure" is disabled by opacity alone.
- **DESIGN.md:** described ("Chips"), and the code matches.

### U42 Text toggle

- **Code:** `WhatsOnScreen.tsx:945`.
- **Versions:** off and on; Dance and Lecdem in the shots (`whatson-search`).
- **How it differs from U41:** no border or fill, 17px text where chips are 15px, and a check
  after the word when on.
- **DESIGN.md:** described ("as text toggles … never a filled pill"), and the code matches.

### U43 Theme track

- **Code:** `SettingsScreen.tsx:243`.
- **Versions:** one (`settings`, `settings.light`).
- **How it differs:** a segmented control with 18px outer corners and 14px inner ones; the option
  that is on is filled. It is the only segmented control in the app.
- **DESIGN.md:** "one track holding both choices", and the code matches.

### U44 Undo bar

- **Code:** `UndoBar.tsx`.
- **Versions:**
  - Normal: "Concert deleted · Undo", over the tab bar (`undo-bar`).
  - Failed: red, with retry and dismiss (not shot).
- **How it differs:**
  - 56px, `surface-raised`, 14px corners. Its text starts 16px in.
  - Taking a concert off the Shortlist reads "Concert deleted".
- **DESIGN.md:** describes the behaviour and the copy, but not the look.

### U45 Feedback rows

- **Code:** `feedback.tsx` (SafetyRow, SeasonFeedback) and `HubScreen.tsx:238` ("Getting
  ready").
- **Versions:**
  1. "Not saved" with retry and Export, under the Note (`not-saved`).
  2. The hub's "Getting ready for offline…" with a spinner (`hub-empty`).
  3. Settings' getting-ready row (`settings-getting-ready`).
  4. The update or new-catalog row (not shot).
  5. "Still opening" (not shot).
- **How they differ:**
  - The spinner rows differ: the hub's is 15px with an 8px gap, Settings' is 17px with a 12px
    gap.
  - The "Not saved" row is 44px without buttons and 48px with them.
  - The update row has a real top and bottom border.
- **DESIGN.md:** described ("Save failure", "Status", "Messages"), and the code matches.

### U46 "⋯" menu

- **Code:** `ui/dropdown-menu.tsx`.
- **Where:** the Event and the Item editor.
- **Versions:** Event, "Delete Event" (`event-menu`); Item, "Delete Item".
- **How it differs:**
  - Always dark and translucent, in both themes.
  - Items are 48px.
  - "Delete" is drawn in the text colour, not red.
- **DESIGN.md:** "the preset's inverted translucent style", which matches. "The destructive red
  only for delete" isn't followed here.

### U47 Small marks

- **Code:** `kind-mark.tsx`; star, dot and cancelled in `ConcertRow.tsx`; amber dot at
  `App.tsx:89`.
- **Versions:**
  1. Kind mark, 20px muted: Lecdem, Dance, Harikatha.
  2. Star, 16px filled.
  3. On-now dot, 8px.
  4. Cancelled, the calendar-x, 20px.
  5. Laya metronome, 20px.
  6. Amber dot, 10px.
- **Shots:** `whatson-pinned` (kind, star, cancelled), `hub-now` (dot, amber), `event-full`
  (metronome).
- **How they differ:** the kind mark sits 6px before the name in rows and sheets, and 8px in the
  Event title.
- **DESIGN.md:** all described, and the code matches.

### U48 First launch and rescue screens

- **Code:** `FirstLaunch.tsx`, `RescueScreen.tsx`.
- **Versions:**
  1. **Welcome**, dark and light (`first-launch-welcome`, `first-launch-welcome.light`).
  2. **Getting ready / Ready to log offline**, with Start (`first-launch-getting-ready`, shot in
     light).
  3. **Rescue:** "Can't open your season" (`rescue`).
  4. **"A newer version is open in another tab"** (not shot).
- **How they differ:**
  - Titles: 32/700 (Welcome), 20/600 (Getting ready), 20/600 centred under a 40px mark (rescue).
  - The buttons are 56px.
  - Progress is an 8px bar.
- **DESIGN.md:** described. DESIGN.md lists two consent steps that aren't built yet (they come
  with sign-in, Phase 7). The progress bar isn't described.

---

## Duplicates: two or more parts doing one job

These feed the phase 4 "every X should be the same" passes.

1. **Search (three ways).**
   - What's on: a bar, then a sheet with the field on top, results top-down, no best match, names
     at 400.
   - The docked search: the field at the bottom, results bottom-up, the best match filled, names
     at 600. It serves the Item editor, Artist, Sabha and Details.
   - The input's classes are copied, not shared.
   - No-match copy and place differ.
2. **Rows (eight).**
   - ConcertRow, the hub Diary row, the lapse row, the Item row, the Stage row, the Settings row,
     the docked result row and the What's on name row.
   - Padding is 10px or 8px, and the gap 8 or 12.
   - The title is at 400 or 600.
   - Dividers sit below or above the row.
   - Rows go on a panel (hub) or straight on the page.
3. **Section labels (five).**
   - The hub's SectionHeader (20/600, count, chevron).
   - SectionHead on the Event (15/600 muted, hairline).
   - Hand-built day labels on What's on and Shortlist (15/600 muted, no hairline).
   - The accordion trigger (15/600 muted, 48px).
   - "Earlier today" (15/400).
   - Captions for slots and lapsed days (13).
4. **Empty states (four looks).** The Empty with a tile, the Empty with a bare glyph, an inline
   15px line, and an inline 17px line. The Empty's space above is 24, 32, 40, or centred. The
   phrase "Nothing yet" carries two meanings.
5. **The + (six).** 28px or 20px; ink or muted; a word or none; a 48px or 56px target. "+ Add
   Artist" and the Stage + open the same picker.
6. **Page titles (four).** The hub title on the curtain, TabHeader, What's on's hand-built h1
   under TopBar, and the Event and Item titles at 20/600. The back label is worked out three
   ways.
7. **Folds (four).** The accordion (Note, Improvised), the hand-built "Earlier today", the Role
   "More" chip, and the Laya note growing in.
8. **Ordering (two).** Items: grip, bin, and the bar switching to "Done". Ragas: arrows and an
   inline "Done".
9. **Sheet titles (four).** SheetTitle, the listing sheet's hand copy of it, the calendar's
   plain paragraph, and the Artist sheet's editable field. Heights are content, 92% and 85%. Two
   buttons sit side by side (Listing, Schedule changed) or stacked (Clear).
10. **"Getting ready" (three).** The hub row (15px, 8px gap), the Settings row (17px, 12px gap),
    and SafetyRow's waiting state.
11. **Selected state (seven looks).**
    - Chips: border, fill and 600.
    - Theme track: fill and 600.
    - Text toggles: 600 and a check.
    - Name rows: a check.
    - Strip: 500 and full ink.
    - Calendar today: 600.
    - Best match: fill.
12. **Lines (two kinds).** Real borders: the tab bar, the bottom bar, the update row, the theme
    track, chips, and the docked search's divider. Every list divider is the inset hairline.
13. **Day words.** For the same date: "Today" (strip, Shortlist, Diary, hub), "Mon 14 Dec"
    (What's on's day label, the listing sheet), "Tomorrow" or "Wed" (hub), "Tue 15 Dec" (the
    hero on another day).
14. **Inline text buttons (four).** The quiet button (15px muted), Android's "Install" (44px,
    600), "None of these" (17/600, full width), and ghost Buttons (17/600, 18px corners).

---

## Screen map (top to bottom)

- **Hub** (`hub-now-full`):
  - Status band (U01), curtain (U05), hero (U06) with the + (U38).
  - Getting ready (U45) and season feedback (U45); update row (U45).
  - Lapse question (U16: U09, U10, U12, U37).
  - Today or Tomorrow (U09, then U10 with U14, or U36).
  - Shortlist (U09, line only).
  - Diary (U09, then U10 with U15).
  - Install strip (U03), tab bar (U02).
  - Sheets: listing (U26), schedule changed (U34). Dialog: summary (U35).
- **What's on** (`whatson`):
  - Top bar (U08), title (U08).
  - Strip of days (U20) with the calendar button (U37).
  - Per day: day label (U11), "Earlier today" (U13) on today, rows (U14); or an Empty (U36).
  - Bottom bar (U04) with the search bar (U21), install strip (U03), tab bar (U02).
  - Sheets: calendar (U27), search (U22: U42, U24), listing (U26), schedule changed (U34).
- **Shortlist** (`shortlist`):
  - Tab header (U07).
  - Per day: day label (U11), slot caption (U12), rows (U14); or an Empty (U36).
  - Undo bar (U44), install strip (U03), tab bar (U02).
  - Sheet: listing (U26).
- **Diary** (`diary`):
  - Tab header (U07).
  - Rows (U14) with the day; or an Empty (U36).
  - Install strip (U03), tab bar (U02).
- **Event** (`event-full`):
  - Top bar (U08) with ⋯ (U46).
  - Title (U08) or "+ Add Artist" (U38).
  - Facts line (U40) or "+ Add Sabha" (U38).
  - Season feedback (U45).
  - Items: label (U11) with "Edit order" (U39), Item rows (U17); or an Empty (U36).
  - Stage: label (U11) with + (U38), Stage rows (U18) with dots (U32).
  - Note fold (U13), "Not saved" (U45).
  - Undo bar (U44), bottom bar (U04) with "Add Item" or "Done" (U37), install strip (U03), tab
    bar (U02).
  - Sheets: facts (U28: U41), Artist picker (U29: U23), Artist sheet (U30: U41, U37), colour
    (U31), Sabha picker (U29).
- **Item editor, new** (`item-search`):
  - Top bar (U08), "Item N" (U08).
  - Docked search (U23): kind chips (U41), fixed rows (U24), results (U24), field.
  - No tab bar.
- **Item editor, edit** (`item`):
  - Top bar (U08) with ⋯ (U46).
  - Eyebrow and title (U08, U40).
  - Raga label (U11-like, 13px) with "Edit order" (U39), values (U40) with + (U38).
  - Detail cells (U40).
  - Improvised fold (U13) with chips (U41), "+ Nadai" (U38), the Laya note.
  - Bottom bar (U04) with "Next Item" and "Done" (U37). No tab bar.
  - Sheets: Detail (U33: U41, U23), Composition (U23).
- **Settings** (`settings`):
  - Tab header (U07).
  - Rows (U19).
  - "Theme" label (U11), theme track (U43).
  - Maintainer row (U19), versions and Screen line.
  - Install strip (U03), tab bar (U02).
- **First launch** (`first-launch-welcome`): horizon motif, title, line, 56px button (U48).
- **Rescue** (`rescue`): mark, title, Try again, Export (U48).
- **Placeholder** (Tidy, Review, Not found): top bar (U08) and a title. Not shot; not in
  DESIGN.md.
