# The Hub (Season)

The first screen of phase 3, integration. **Signed off** by the user on 2026-11-21, with decisions 1 (B), 2 (B) and 3 (B). Code: `HubScreen.tsx`,
`spine.ts` (`startingSoon`, `hubHero`).

**Builds on**, as signed off and built on main at acc2698:
[foundations.md](../foundations.md), [row.md](../row.md), [search.md](../search.md),
[instrument-picker.md](../instrument-picker.md) and [item-editor.md](../item-editor.md). Search,
the instrument picker and the Item editor don't appear on the Hub; they are listed only so that
nothing here contradicts them.

**Council** (two Claude reviewers and Codex), scoring each recommended option:

| Decision | Round 1 | Round 2 |
| --- | --- | --- |
| 1, the hero repeat (B) | 6, 7, 7 | 7, 8, 8 |
| 2, day words (B) | 8, 7, 9 | 9, 8, 8 |
| 3, the hero line (B) | 8, 7, 8 | 9, 8, 9 |

**What was looked at:** the production build in Chromium at 390 × 844 (2x), dark and light,
installed (no install strip), with the hill-climb seed (`app/e2e/hill-climb/SEED.md`) plus five
listings on Mon 14 Dec. Ten states: day one, logging a Concert (Now), Next later today, Next
inside the hour, a choice, Next tomorrow, the lapse question, nothing listed ahead, a lecdem of yours next, and the hero holding all that's left of today.
The script is `app/e2e/screens/hub-shots.ts` (not committed). The shots and mocks are on the Artifact
page "Wrapped Hub".

## 0. The order of the screens

One screen at a time, in this order:

1. **Hub.** It's what opens, and it's where the section pattern, the curtain and the hero live.
   The other tab pages copy its pattern, so it goes first.
2. **What's on.** You reach it from the Hub's Today header. It holds most of the Concert rows,
   the strip and the search bar.
3. **Shortlist**, then 4. **Diary.** Both are lists built from the same parts (day label, Concert
   row, Empty), and doing them right after What's on keeps the three lists consistent.
5. **Event**, then 6. **Item editor.** This is where data is entered, so the build here carries
   the data-loss tests. They use the most sheets, and they draw on all the phase 2 specs.
7. **Settings.** It's rarely opened and has few parts.
8. **First launch and rescue.** Each is seen about once. The Placeholder pages go to phase 4.

## 1. How the signed-off components compose here

Top to bottom, as built. Nothing in this section changes.

| Place | Component | Spec |
| --- | --- | --- |
| Curtain | Full-bleed chrome; its sheet edge keeps 18px | foundations §1 (U05) |
| Hero | Its word (Sub, 600 ink) and the + on one 48px row; the concert in Page title, or a choice's names in Title; its line in Sub at 80% | foundations §3 (U06) |
| Status rows | "Getting ready for offline…", season feedback, the update row | foundations U45 |
| Lapse question | Section header (Strong, no chevron), with the day as its line when one day is asked about. With several days, each day is a Sub line inside the panel, above its own concerts. Then a panel of Concert rows, each with "Yes" as its one nested control; "None of these" as an Action row | row.md §1, §3 "Lapsed" |
| Today / Tomorrow | Section header (Strong, count, chevron), then a panel of up to 4 Concert rows; on today, closeness ("in 15 min", "● On now", an hour in "● Started at 4:00 pm") in 600 ink | row.md §2 "When" |
| Shortlist | Header only, with its Sub line; no panel | foundations §1 "Which lists get panels" |
| Diary | Header, then a panel holding one Concert row (heard; day · time · Sabha · N Items) | row.md §4 (U15) |
| Empty | Bare 28px moon and a Strong title; "Nothing listed yet" adds a Sub line, "Nothing more today" has none | DESIGN.md "Season, the hub" |

The measurements match the foundations. Text sits 24 from each side, and fills sit 8 from it, with
16px corners. The first section is 16 under the curtain's foot, sections are 32 apart, and a label
is 8 from its panel. A row is 12 above and below its text: 68px for two lines, plus 24 for a
wrapped name and 20 for each extra Sub line. The lapse rows are 72px, set by their 48px "Yes".

## 2. Inventory differences on this screen

Each Hub unit from [inventory.md](../inventory.md), and where it now stands.

| Unit | Difference in the inventory | Now |
| --- | --- | --- |
| U05 Curtain | Content 24 in; first section placing | **Done in phase 2.** The first section sits 16 under the foot. |
| U06 Hero | Its word and line sizes | **Done in phase 2** (Sub 600; Sub). |
| U06 Hero | **The hero's concert repeats as a row under Today or Tomorrow** | **Decision 1.** |
| U06 Hero | Its line runs "Sabha · day · time", where every row now runs time first; its kind mark comes *before* the name, where rows put it after; it has no instrument word ("Veena") | **Decision 3.** |
| U09 Section header | 20/600; spacing between sections changed from one section to the next | **Done in phase 2** (Strong; 32 between, 8 to the panel). |
| U10 Panel | 18px corners | **Done in phase 2** (16). |
| U12 Caption label | Lapse days at 13px | **Done in phase 2** (Sub). One day is the header's line; several days are each a line inside the panel. |
| U14 Concert row | Padding, hub-only width | **Done in phase 2.** |
| U15 Hub Diary row | Hand-built, no accompanists | **Done in phase 2.** It is now a Concert row. |
| U16 Lapse question | 68px rows; a hand-built "None of these" | **Done in phase 2** (72px at least, set by "Yes"; an Action row). |
| U16 / U37 | "Yes" is a fully round **pill**, where other outline buttons have 16px corners | **Phase 4**, buttons pass. No button spec exists yet, and the pill shows up only here. |
| U36 Empty | Bare mark here, a tile elsewhere; 24 above here, 32 in DESIGN.md | **Phase 4**, Empty pass. The bare mark here was the Maintainer's call (2026-11-13). The spacing goes with every Empty. |
| U38 The + | 28px here, 20px elsewhere | **Phase 4**, + pass (duplicate 5). The 28px was the Maintainer's call (2026-11-13). |
| U45 Feedback | The update row's words are Body (17), with a real line above and below | **Applied here** from foundations U45, which is signed off: its words become Sub. The lines go to the phase 4 lines pass (duplicate 12). |
| Dup. 13 Day words | The same day is named three ways on one screen: at 11:30 pm Monday the header says "Tomorrow", the hero "Tue 15 Dec" and the Shortlist line "1 on Tue". At 9:30 pm Tuesday, the lapse line names today "Tue 15 Dec", though the Hub says "Today" for today everywhere else (the hero, the Diary row, the header). | **Decision 2**, for the Hub only. Other screens follow in phase 4. |
| U01, U02, U03 | Status band, tab bar, install strip | Not Hub-specific. Unchanged here. |

## 3. Decision 1: the hero repeat

**Today.** The hero shows your concert: Next, Now (under way), or a choice. The first section
then lists the same concert again as a row. The one exception is the Concert you're logging,
which is already left out. Measured at 390 × 844:

| State | Repeated | Shortlist header y: A | B | C |
| --- | --- | --- | --- | --- |
| Next, later today (Tue 9:00 am) | 1 row, 68px | 390 | 322 | 322 |
| Next, inside the hour (3:40 pm) | 1 row, 68px | 390 | 322 | 322 |
| A choice (3:00 pm) | **the whole Today panel**, 2 rows (156px) | 450 | 382 | 382 |
| Next tomorrow (Mon 11:30 pm) | 1 row of 3, 68px | 478 | 410 | 478 |
| Lapse question, Next on Wed | 1 row of 4, 68px | 838 | 770 | 838 |
| Next is a lecdem of yours (Thu 9:30 am) | 1 row, 88px (it has a title) | 390 | 370 | 370 |
| The hero holds all that is left today (Thu 2:00 pm) | 1 row, 68px; under B and C Today gives way to Tomorrow | 334 | 334 | 334 |
| Logging a Concert (7:30 pm) | none (already left out) | 566 | 566 | 566 |

In the choice, Today shows exactly the two concerts the hero shows. The third concert of the day
(the 6:30 pm Dance) never appears.

The two copies also behave differently. Tapping the hero opens the concert's Event, ready for an
Item. Tapping the row opens the listing sheet.

**Options:**

- **A. As now.** The hero's concert repeats under Today or Tomorrow, starred when it's
  Shortlisted.
- **B. Leave it out, as the logged one already is.** The hero's concerts are left out of the
  first section, the same way the Concert being logged is left out today. The section's own rules
  then run on what's left:
  - Today shows the next start time among what's left, with any concert within 30 minutes of it,
    and the others under way, four rows at most. At 3:40 pm, the Malladi Brothers (also 4:00)
    still show. In the choice, Today moves on to the 6:30 pm Dance.
  - Once nothing besides the hero is left today, the section becomes the next day that has a
    concert, as it already does while logging. The hero then says "Today · 8:00 pm" above
    "Tomorrow".
  - Another day: the hero's concerts are taken out first, then the day's first four are shown. If
    the hero is that day's only concert, the section goes on to the next day.
  - A concert with no time is never a row in this section (as now), so it doesn't hold Today open.
  - With nothing besides the hero ahead at all, the Empty says "Nothing else ahead" in place of
    "Nothing more today", because the hero's concert is still to come, today or later.
  - The Diary row leaves out the hero's concert too (a Heard one under way and not being
    logged), and shows the one heard before it. It already does this for the Concert being
    logged. If the hero is the only one heard, the Diary is its header and count alone.
  - The header's count doesn't change. It counts what its page holds (What's on, for that day),
    the hero's concert included. Count and rows already differ under A: 5 over 4 rows while
    logging, and 3 over 2 in the choice.
  - Cancelled concerts are never rows in this section and never in the hero, so nothing changes
    for them.
  - **It overrides two of the Maintainer's rules of 2026-11-13.**
    - Tomorrow's "a Shortlisted one marked where it falls": your pick for tomorrow is no longer a
      starred row among that day's concerts. The hero above names it, with its time.
    - Today "always labelled Today while anything is on or ahead": once only the hero is left
      today, the section is Tomorrow. That already happens while you log a day's last concert.
- **C. Leave it out of Today only.** As B for today. Another day keeps its first four whole, in
  start order, with the hero's concert starred where it falls, as the Maintainer set it.

**Decided: B** (the user, 2026-11-21: "B: drop it from both"). It overrides the two
Maintainer rules of 2026-11-13 named above.

**Recommended: B.** It is the rule the Hub already follows while you log, applied to every hero,
so the hero and the list never show one concert twice, at any hour. C keeps Tomorrow whole as a
timeline. But at midnight, the starred row under Tomorrow vanishes from what becomes Today
without anything having changed. In the choice, B turns a duplicate panel into the next concert
you could catch.

**What B gives up:**

- The hero has no printed-title or accompanist line. With the row gone, a lecdem's title ("Ragas
  of the morning") isn't on the Hub. It is one tap away, on the Event.
- Once only the hero is left today, the section becomes Tomorrow, so the Hub has no Today
  header to open today's What's on. That is already the case while you log the last concert of a
  day. What's on is still a tap away from the Tomorrow header, one day back.
- The only way into your pick is the hero, at the top of the screen, which is harder to reach with
  one thumb. Its tap area spans y 56 to 120 at 390 × 844 (to 180 for a choice); the thumb reaches easiest
  below about y 420.

Data: none. This changes what is shown, never what is stored.

## 4. Decision 2: day words on the Hub

- **A. As now.** The header says "Today" or "Tomorrow". The hero says "Tue 15 Dec" for tomorrow.
  The lapse line names today by its date. The Shortlist line says "1 on Tue" for tomorrow. The
  Diary row says "Today" for today.
- **B. "Today" and "Tomorrow" wherever the Hub names those days.**
  - Hero line: "Tomorrow · 4:00 pm".
  - Lapse line: "Today". With several days, each day gets its own line, and only today's says
    "Today".
  - Shortlist line: "1 tomorrow". Today's parts keep their times: "1 in 20 min", "2 at 6:45 pm".
  - Every other day keeps its date or weekday: "Wed 16 Dec", "1 on Wed".
  - **No "Yesterday".** Yesterday keeps its date ("Mon 14 Dec") in the lapse line and the Diary
    row.
  - A day is the phone's calendar day, the same clock the app reads every start time by. The Hub
    redraws every 30 seconds and whenever it comes back into view, so all its words change
    together within 30 seconds of midnight.
  - A concert under way never gets a day word. Its hero line is the start time.
  - A choice for today has no day word; its slot word says it ("Pick your dusk"). A choice for
    tomorrow says "Tomorrow · 4:00 pm".
  - A choice further off says its date: "Wed 16 Dec · 4:00 pm".
  - A hero with no time gives its day word and the Sabha: "Today · Music Academy", "Tomorrow ·
    Music Academy", or "Wed 16 Dec · Music Academy".

**Decided: B** (the user, 2026-11-21: "B: Today/Tomorrow").

**Recommended: B.** One screen, one word for one day. When the first section names a day further
off ("Wed 16 Dec"), the Shortlist line still says "1 on Wed". That short form within a week is
kept. What's on and the Shortlist pages keep their own words until phase 4's day-words pass.

## 5. Decision 3: the hero line

- **A. As now.** "Sri Krishna Gana Sabha · Today · 4:00 pm". The kind mark comes before the name,
  and there's no instrument word.
- **B. As a row.**
  - **Time first:** "Today · 4:00 pm · Sri Krishna Gana Sabha". Inside the hour: "in 20 min · Sri
    Krishna Gana Sabha", with "in 20 min" in 600 at full ink and the rest at 80%, as now.
  - **Under way (Now):** the start time, "6:00 pm · Music Academy · 11 Items", with no dot. The
    hero's word already says "Now", so the row's "● On now" would say it twice.
  - **A choice:** each name carries its own line, "4:00 pm · Music Academy" (with "Tomorrow ·"
    before it when it's tomorrow's).
  - **No Artists:** the name falls back to the Sabha, and the line leaves the Sabha out. Under "No
    Sabha yet", the line holds the time.
  - **Mark and instrument word after the name:** kept with its last word, so the name starts on
    the column. The mark is 20px, centred on the name's last line. The instrument word is Sub at
    80%, not the row's Caption, because Caption is too small beside a 24px name. A choice's names
    (Title, 20px) carry them the same way. Spoken, the mark gives its kind ("Lecdem") and the
    instrument word is read once.
  - **Wrapping:** a long name wraps at the same size, never cut, its lines balanced, as now. The
    line breaks at a "·" first and is never cut, because the hero has the room. A single fact
    wider than the line (a long Sabha) wraps between its words.
  - **An exception to "On now is a dot"**, named in DESIGN.md too: the hero under way shows its
    start time with no dot, because its word says "Now".

**Decided: B** (the user, 2026-11-21: "B: like a row").

**Recommended: B.** A concert reads the same in the hero as in the rows below it. It also settles
the foundations' note that a leading mark pushes the name off the column.

## 6. Build plan

- `spine.ts`: `startingSoon` takes the hero's Event ids (B) in place of the logged one's.
  - Unit tests: the choice, Next today with another in its slot, the hero as the only concert
    left today, the hero as the only concert tomorrow, a choice with one concert cancelled, a
    no-time hero, and midnight.
  - The logging case keeps its tests.
- `HubScreen.tsx`:
  - The Diary row leaves out the hero.
  - The Empty's copy, "Nothing else ahead", when the hero holds all that's ahead.
  - The hero line and name (decision 3).
  - The day words (decision 2).
  - The update row's words in Sub.
- Unit test: a concert with no time today, with the hero the only timed one left.
- `e2e/hub.spec.ts`: update the hero cases.
- DESIGN.md, "Season, the hub":
  - the hero, Today, Tomorrow and the Shortlist line, to match;
  - the hero's exception to "On now is a dot";
  - the stale lines already built differently: the Diary row's line is "day · time · Sabha · N
    Items", and lapse days are in Sub, not Caption.
- Data-loss paths: none are touched. The lapse answers and the + are unchanged.

## 7. For phase 4

- The "Yes" pill.
- The Empty's spacing.
- The 28px +.
- Real lines against hairlines.
- Day words on other screens.
- The Empty copy pair: "Nothing more today" (nothing ahead) and "Nothing else ahead" (nothing
  besides the hero). Both ship now; phase 4's copy pass reviews them with every Empty.
- The hero's instrument word in Sub, where rows use Caption.
- Whether a header's count should say what it counts.

**Noticed, not changed:** the Shortlist line still counts a Shortlisted concert that's over but
not yet asked about ("1 at 11:00 am" at 2:00 pm). That's a bug in the line's rule, separate from
this spec, and gets its own fix before What's on copies the line. It stays out of the Hub PR.
