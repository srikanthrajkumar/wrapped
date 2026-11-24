# What's on

The second screen of phase 3, integration. **Signed off** by the user on 2026-11-24, with decisions 1 (B), 2 (C), 3 (B) and 4 (C). Code: `WhatsOnScreen.tsx`,
`timeline.ts`, `spine.ts` (`isOver`, `underWay`), `format.ts`.

**Builds on**, as signed off and built on main at 0ac60f6:
[foundations.md](../foundations.md), [row.md](../row.md), [search.md](../search.md) and
[hub.md](hub.md). Also [log-entry.md](../log-entry.md) (commit 458333e, taken as landed first): its
"Not listed? Start a Concert" row on a search with no match stays as it is.
[instrument-picker.md](../instrument-picker.md) and [item-editor.md](../item-editor.md) don't
appear here.

**Council** (two Claude reviewers and Codex), scoring each recommended option:

| Decision | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| 1, what's on now (B) | 7, 7, 6 | 8, 8, 8 | 9, 8, 9 |
| 2, the day labels (C) | 8, 8, 9 | 9, 8, 9 | |
| 3, an empty list and the days gone (B) | 8, 7, 8 | 9, 8, 9 | |
| 4, Today under a filter (B in round 1, C after) | 9, 9, 8 | 7, 7, 8 | 8, 8, 9 |

Round 3 rescored decisions 1 and 4 only, after "Earlier today" was made to start open when it is
all the list shows.

**What was looked at:** the production build of 458333e in Chromium at 390 × 844 (2x), dark and
light, installed, with the hill-climb seed (`app/e2e/hill-climb/SEED.md`) plus the Hub's five
listings on Mon 14 Dec. A second run adds the real 2026-27 feed from 13 Dec to 1 Jan (the peak:
22 listings a day, 32 on 29 Dec). Sixteen states: arriving from the Hub's Today header, and from
its Tomorrow header; "Earlier today" open; scrolled, the strip pinned; the calendar; Past; the
search before typing, typed and with no match; a filter, and a filter that leaves nothing; nothing
ahead; nothing listed; a peak day at 9:00 am, 4:10 pm and 7:30 pm. Shortlisted rows are in most.
The options are mocked on the built page. The script is `app/e2e/screens/whats-on-shots.ts` (not
committed). The shots, mocks and scores are on the review page,
https://claude.ai/artifact/UMTDPXSWmK5nP21muUR48E.

## 1. How the signed-off components compose here

Top to bottom, as built. Nothing in this section changes.

| Place | Component | Spec |
| --- | --- | --- |
| Top bar | "‹ Season" | foundations U08 |
| Title | "What's on", Page title, 8 under the bar | foundations §3 |
| Strip of days | Past (only while the days gone show), Today, each date ahead with anything on, the calendar mark at the right; pinned under the top as the page scrolls | DESIGN.md "The strip of days"; foundations U20 |
| Each day | Its label (Strong, sticking under the strip), then one panel of Concert rows by start time | foundations §1 "Which lists get panels"; row.md §2 "When" |
| Today | "Earlier today" (Sub row, count, chevron) first in its panel; a concert under way leads its line with the dot and its time in 600 ink | foundations U13; row.md §3 "Live" |
| Rows | Concert rows: the star when Shortlisted, "· N Items" once heard, "Cancelled" in place of the time. Nobody billed: the Sabha is the name ("Kalakshetra Foundation", "6:00 pm") | row.md §1 to §3 |
| Empty | A tile, a Strong title, and "Clear filters" under a filter | DESIGN.md "Empty states" |
| Search bar | In the bottom stack over the tab bar; with a filter on, it reads the filter and has an × | foundations U21 |
| Search | The docked search: kinds as text toggles, "Often heard" before typing, names as List rows; with no match, "Not listed? Start a Concert" pinned over "Nothing matches “…”" | search.md; log-entry.md (E2) |
| Sheets | Listing, calendar, Schedule changed | foundations U26, U27, U34 |

Measured at 390 × 844: the title at y 48, the strip from 100 to 164, the first day's label at 164
and its panel at 200. The search bar's top is at about 731, so a row shows whole down to about
y 700. Rows are 68px with two lines, 88 with three.

## 2. Inventory differences on this screen

| Unit | Difference in the inventory | Now |
| --- | --- | --- |
| U08 Top bar and title | Gap and title size | **Done in phase 2.** |
| U11 Day label | 15/600 muted, no panel | **Done in phase 2** (Strong, 8 to its panel). |
| U11 / dup. 13 | The strip says "Today"; the label under it says "Mon 14 Dec". The Hub's "Today" header opens a page whose label says "Mon 14 Dec". | **Decision 2.** |
| U13 "Earlier today" | Hand-built, 15/400 | **Done in phase 2** (a Sub row, first in the panel). Its motion goes to phase 4's folds pass. |
| U14 Concert row | Padding, time first, the trailing column | **Done in phase 2.** |
| U14 | Under a filter, today's rows lose the dot, and a concert that's over reads like one ahead | **Decision 4.** |
| U20 Strip | The chosen day at 500 | **Done in phase 2** (600). |
| U21 Search bar | 14px corners | **Done in phase 2** (16). |
| U22 Search sheet | Field on top, A to Z | **Replaced** by the docked search (search.md). |
| U27 Calendar | Title as a paragraph | **Done in phase 2** (Title). |
| U36 Empty | A tile here; spacing differs between Empties | **Phase 4**, Empty pass. What an Empty offers here is **decision 3**. |
| — | At the peak, what's under way fills the first screen | **Decision 1.** New here, from the real feed. |
| U01, U02, U03 | Status band, tab bar, install strip | Not specific to What's on. Unchanged. |

## 3. Decision 1: what's on now

**Today.** Today's panel opens with "Earlier today" (over: 2½ hours after the start), then every
concert under way, then what's still to come. The Hub's Today header leads here. At the peak,
what's under way fills the first screen and pushes the next start below it.

Measured on the real feed's peak days (15 Dec to 1 Jan, 18 days), arriving at the top of What's
on. "On screen" means the whole first concert still to come is above y 700.

| Opened at | Under way (median, most) | Next start's top y: A | B | On screen: A | B | B folds on |
| --- | --- | --- | --- | --- | --- | --- |
| 10:10 am | 1, 3 | 288 | 288 | 18 of 18 | 18 of 18 | 1 day |
| 12:00 pm | 2, 5 | 424 | 414 | 17 of 18 | 18 of 18 | 6 days |
| 4:10 pm | 7, 9 | 824 | 296 | **0 of 18** | 18 of 18 | 18 days |
| 6:10 pm | 6, 9 | 756 | 296 | **2 of 18** | 18 of 18 | 18 days |

**Options:**

- **A. As now.**
- **B. Fold what's on now, from 3.** When 3 or more concerts are under way and something is still
  to come today, they fold into one Sub row under "Earlier today": the dot, "On now" in 600 ink,
  the count and a chevron. One tap opens it.
  - **Fewer than 3, or nothing still to come:** the rows show as now, each with its dot and 600
    time, with no fold. A concert with no time counts as still to come.
  - **"Earlier today" starts open when it would be all the list shows**, with or without a
    filter ("On now" never is: it folds only with something still to come). This wins over
    "Opened from the Hub, both start closed". It is checked when the page opens and when a filter
    is set, changed or cleared, never on the tick, so nothing pops open mid-view. A fold the
    rasika closes stays closed until the next of those moments.
  - **Order.** Each fold heads its own rows: "Earlier today" and its rows, then "On now" and its
    rows, each by start time, then what's still to come. (A Concert being logged stays under way
    past 2½ hours, so the two sets can interleave by start time; they don't mix.)
  - **What's in it:** what `underWay` says, the Concert being logged included (the Hub's hero
    holds it as Now). A Shortlisted one goes in with its star; the hero names it too.
  - **Cancelled:** a cancelled concert never is on now. Once its start has passed, it goes in
    "Earlier today", so it never stands first after the folds.
  - **No time:** never on now, as now.
  - **The clock.** On the 30-second tick, rows move from "On now" to "Earlier today" and from
    what's to come into "On now"; counts change. The page holds its place as it does now (nothing
    slides). When "On now" drops under 3, its row goes and its rows show; that's accepted, as
    "Earlier today" already moves rows on the tick.
  - **Open or closed** is kept, for both folds, with the page's place: back from an Event (after
    "I'm here") or another tab, it's as left. Opened from the Hub, both start closed.
  - **Spoken:** a button, "On now, 6", expanded or collapsed. The dot is hidden from screen
    readers.
  - **Today only, without a filter**, as "Earlier today" (but see decision 4).
  - It changes DESIGN.md's "a concert under way carries the dot" rows on today's list: three or
    more sit behind one row.
- **C. Open at the next start.** From the Hub's Today header, scroll so the first concert still
  to come sits under the pinned strip. It overrides the Maintainer's rule of 2026-11-09 (opened
  from the Hub it starts at its very top): a jump that scrolled the header away read as a glitch.

**Decided: B** (the user, 2026-11-24: "Sign off all four").

**Recommended: B.** The Hub's first section points ahead: it lists the next start. The page it
opens should show what's still to come without a scroll. B keeps the page at its top and adds one
row in the "Earlier today" style, only when it pays (3 or more).

**What B gives up:**

- At 4:10 pm the 4:00 pm concerts, the ones you could still walk into, are a tap away.
- "I'm here" on a concert under way is one tap more from What's on. Once seated, the blank
  Concert's offer (log-entry.md) is the quicker way: 90% of concerts 10 minutes in are in its four
  rows.

Data: none. This changes what is shown, never what is stored.

## 4. Decision 2: the day labels

- **A. As now.** "Mon 14 Dec" under the strip's "Today".
- **B. "Today" and "Tomorrow"**, as the Hub says them.
- **C. Both: "Today · Mon 14 Dec", "Tomorrow · Tue 15 Dec".** Other days keep their date.
  - The day labels only. The strip is unchanged.
  - No "Yesterday" in Past, as on the Hub.
  - A day is the phone's calendar day. The labels change with the Hub's: on the 30-second tick
    and on coming back to the app. At midnight the page keeps its place.
  - Spoken: "Today, Monday 14 December".
  - With nothing today (or nothing matching today), the first label is "Tomorrow · Tue 15 Dec".
    Today stays on the strip; the chosen mark is on tomorrow's date. Arriving from the Hub's
    Tomorrow header lands on it, so the header and the label agree.
  - A long label wraps; it is never cut.

**Decided: C** (the user, 2026-11-24).

**Recommended: C.** It is the Hub's word (its decision 2), and it keeps the date, which the
strip's Today stop doesn't show. B shows nothing the strip doesn't. This brings phase 4's
day-words pass forward for What's on only; the Shortlist keeps its words until its own spec.

## 5. Decision 3: an empty list and the days gone

**Today.** The days gone are on the calendar only (SF-D32). From today, an empty list ("Nothing
ahead", or "Nothing here matches" under a filter) says nothing of them. A filter on yesterday's
Artist, to log late, ends there. The calendar's dots show the match, two taps away.

- **A. As now.**
- **B. "Show Past".** From today, when the list shows no day at all and the days gone hold
  something (listings or the rasika's own Events, matching the filter when one is on):
  - An outline "Show Past" in the Empty, first. "Clear filters" stays under it under a filter:
    the filter is what the rasika wants, and the days are what's wrong.
  - It opens the days gone at their top, newest first, as the old `/earlier` link does. The
    filter stays. The strip then shows Past; Today brings the Empty back. Focus moves to the
    first day's label (`tabIndex={-1}`).
  - Under a filter, the title says "Nothing ahead matches" (it was "Nothing here matches"). In
    Past it stays "Nothing here matches".
  - The Empty stays centred, so its tile rises by half the button.
  - No button: with nothing in the Season (the "Nothing listed yet" Empty), with nothing in the
    days gone, or in Past (its strip already shows Today).
  - A filter whose Artist also has days ahead shows those days, with no Empty and no button.
    The calendar's dots stay the way to their days gone.
  - At the Season's end, today's rows that are over still show (open, as decision 1 says), so
    there is no Empty until the next day.
- **C. Past always on the strip.** It reverses SF-D32.

**Decided: B** (the user, 2026-11-24).

**Recommended: B.** One button, only when it leads somewhere. Late logs matter (the user, log-entry
decision 3: "I am sometimes logging concerts that have passed"). It also serves the end of the
Season, when nothing is ahead. No data on how often.

## 6. Decision 4: Today under a filter

**Today.** With a filter on, today shows whole (DESIGN.md). Its rows lose the dot and the 600
time, and a concert that's over reads like one still ahead: filter on Sanjay Subrahmanyan at
7:30 pm and his 4:00 pm row has nothing to say it's over.

- **A. As now.**
- **B. The dot back.** Today stays whole; a concert under way keeps its dot and 600 time.
- **C. Today reads the same with or without a filter.** The filter only narrows the rows:
  "Earlier today" folds what's over, "On now" folds from 3 (decision 1), and the dot shows.
  - "Live" is `underWay`, the same rule as without a filter, on today only (not in Past). A
    cancelled concert never has the dot.
  - "Earlier today" starts open when it would be all the list shows (decision 1). Filter on Sanjay
    Subrahmanyan at 7:30 pm: "Earlier today 1", open, over his 4:00 pm row. A tap closes it, and
    that is kept.
  - Days ahead and days gone stay whole, as now.
  - It replaces DESIGN.md's "a list a filter narrowed shows whole" for today.

**Decided: C** (the user, 2026-11-24). It replaces DESIGN.md's "a list a filter narrowed shows whole" for today.

**Recommended: C.** A row's state is a fact of the concert, not of the filter. One rule for today
is simpler than two.

## 7. Build plan

- `WhatsOnScreen.tsx`:
  - the "On now" fold (decision 1), with both folds' open state kept in `season` beside the place;
  - the cancelled concert past its start goes with "Earlier today";
  - the day labels (decision 2), from a `format.ts` helper shared with the Hub, with a spoken
    form; the calendar's day names (`dayText`) unchanged;
  - "Show Past" and the "Nothing ahead matches" title in the Empty (decision 3);
  - today's folds and dot whatever the filter: the gate is "today, not Past" (decision 4);
  - "Earlier today" starts open when it would be all the list shows.
- Unit tests: the folds at 4:10 pm on a peak day (from the feed's shapes), 2 under way (no fold),
  nothing still to come (no fold), the Concert being logged past 2½ hours, a cancelled one past
  its start, a filter; the labels at 11:59 pm and 12:00 am; "Show Past" with and without a filter,
  and with nothing in the days gone; a filter whose only match today is over (the fold starts
  open, even if it was closed before the filter).
- `e2e`: the fold opens, and is still open back from an Event; "Show Past" opens the days gone
  with the filter kept.
- DESIGN.md, "What's on": "Each day" (the folds, the labels, today under a filter), "Empty", and a
  Decisions Log row.
- Data-loss paths: none are touched.

## 8. For phase 4, or noticed

- "Earlier today" and "On now": motion, as folds.
- The Empty's spacing and tile.
- **Long days.** A peak day is 22 rows (median), 14 start times, a 1,826px panel (2.6 screens). No
  time captions are proposed; with B, the first screen reaches the next start.
- **Search:** "Often heard" lists only names with a listing from today on, so a past Artist must
  be typed. A pick whose only matches are in the days gone could open on Past. That changes
  search.md.
- **Noticed:** a sticky day label stays over the 32px gap after its panel has scrolled away,
  faded under the strip.
- **Noticed:** after a pick by Enter, focus goes back to the search bar and it shows its keyboard
  ring, which makes the × look outside it. Check on the iPhone whether its keyboard's Go does the
  same; any change comes back as its own decision.

## 9. As built (2026-11-24)

- `today-folds.ts`: today's split for the two folds, and when "Earlier today" starts open; pure,
  tested in `tests/screens/today-folds.test.ts` (peak day at 4:10 pm, two under way, nothing to
  come, no time, the Concert being logged, cancelled, a filter, the clock).
- `day-words.ts`: the Hub's `dayName` moved here unchanged, and What's on's `dayLabel` with its
  spoken form; tested in `tests/screens/day-words.test.ts` (midnight, month and year turns).
- `WhatsOnScreen.tsx`: the folds (kept in `season` with the place), the labels, "Show Past" and
  "Nothing ahead matches", today's folds and dot under a filter.
- `e2e/whats-on.spec.ts`: the fold at 4:10 pm and kept across tabs, fewer than three, a filter,
  "Show Past" with the filter kept and focus moved, nothing ahead, tomorrow's label.
  `hub.spec.ts` and `timeline.spec.ts` take the new label and title.

Builder's calls, open to review:

- "Page opens" for the start-open rule means opened from the Hub, when both folds reset. Back
  from an Event or another tab, the folds are as left, closed ones included.
- A filter change re-runs the rule; it opens "Earlier today" but never closes it.
