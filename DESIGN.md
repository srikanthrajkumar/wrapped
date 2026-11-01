---
# gstack: design-md-format=spec
name: Carnatic Wrapped
base: "shadcn preset b51rn04Qt (style Rhea, Mist neutrals, rose charts, Tabler icons)"
colors:
  dark:
    background: "oklch(0.148 0.004 228.8)"
    surface: "oklch(0.218 0.008 223.9)"
    surface-raised: "oklch(0.275 0.011 216.9)"
    foreground: "oklch(0.88 0.014 80)"
    muted-foreground: "oklch(0.72 0.014 75)"
    primary: "oklch(0.88 0.014 80)"
    primary-foreground: "oklch(0.218 0.008 223.9)"
    border: "oklch(1 0 0 / 10%)"
    input: "oklch(1 0 0 / 15%)"
    ring: "oklch(0.56 0.021 213.5)"
    destructive: "oklch(0.704 0.191 22.216)"
  light:
    background: "oklch(1 0 0)"
    surface: "oklch(1 0 0)"
    surface-raised: "oklch(0.963 0.002 197.1)"
    foreground: "oklch(0.2 0.014 60)"
    muted-foreground: "oklch(0.5 0.016 60)"
    primary: "oklch(0.218 0.008 223.9)"
    primary-foreground: "oklch(0.987 0.002 197.1)"
    border: "oklch(0.925 0.005 214.3)"
    input: "oklch(0.925 0.005 214.3)"
    ring: "oklch(0.723 0.014 214.4)"
    destructive: "oklch(0.577 0.245 27.325)"
  chart:
    chart-1: "oklch(0.81 0.117 11.638)"
    chart-2: "oklch(0.645 0.246 16.439)"
    chart-3: "oklch(0.586 0.253 17.585)"
    chart-4: "oklch(0.514 0.222 16.935)"
    chart-5: "oklch(0.455 0.188 13.697)"
typography:
  family: "'Source Sans 3', sans-serif"
  weights: "400, 600, 700"
  caption: "13px / 1.3"
  secondary: "15px / 1.35"
  body: "17px / 1.4"
  title: "20px / 1.3"
  heading: "24px / 1.25"
  display: "32px / 1.15"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
components:
  touch-target: "48px"
  primary-action-height: "56px"
  search-result-min-height: "60px"
  screen-gutter: "16px"
  motion-press: "100ms ease-out"
  motion-state: "150ms ease-out"
  motion-sheet: "220ms cubic-bezier(0.2, 0, 0, 1)"
  save-highlight: "1200ms"
  undo-window: "5000ms"
---

# Carnatic Wrapped

The design system for the season logger and its Wrapped. It turns the decisions in
[plan.md](specs/001-season-logger/plan.md) ("Design decisions", "Information priorities" and
"Design system") into tokens and rules for the screen tasks (T040 onward). Where this file and
plan.md disagree, plan.md's dated decisions win and this file is corrected.

## Overview

**The one thing to remember: "My season, seen whole."** Every choice is checked against it.

The app has two surfaces with opposite jobs:

- **The logging screens** are a tool, used one-handed in a dark concert hall while the music
  plays. They recede: dark, quiet, nearly colourless, with large targets low on the screen.
  Logging the next Item is never more than one tap away, and nothing stands in front of it.
- **The Wrapped cards** are shared. They should look like the rasika's own season, not like the
  app (proposed: coloured by the outfits the Artists wore; settled with the Cards, T088 to T096).

Built with shadcn/ui on Tailwind ([ADR 0006](docs/adr/0006-shadcn-and-tailwind-for-the-screens.md)),
starting from preset `b51rn04Qt`. The preset's values are the base; this file records where the
app departs from them (warm text, the type scale, touch targets, motion). Every colour reaches
the screens as one of shadcn's CSS variables, defined for both themes: `surface` is `--card`
and `--popover`; `surface-raised` is `--secondary`, `--muted` and `--accent`; the rest keep
their names (`--background`, `--foreground`, `--muted-foreground`, `--primary`, `--border`,
`--input`, `--ring`, `--destructive`, `--chart-1` to `--chart-5`). No component uses a raw
colour value; the outfit swatches below are
data a rasika picks, not theme colours.

Names are shown in plain English spelling: "Todi", "Kaddanuvariki", "Tyagaraja", never "Tōḍi" or
karnatik's "tODi" (catalog-snapshot contract).

## Colors

**Dark is the default** and the theme the screens are designed in. Light is offered in Settings.

- **Warm text.** Foreground and muted text carry a slight warm cast (hue 75–80) instead of Mist's
  cool grey, which reads as clinical under hall lighting. Surfaces keep Mist's cool near-black.
  In the dark theme the text is also softened (decided 2026-11-01): `foreground` at lightness
  0.88 and `muted-foreground` at 0.72, down from 0.955 and 0.76, to cut glare and halo in a dark
  hall while staying far above the 4.5:1 minimum. The dark `primary` fill matches the softened
  text (warm 0.88), so no button is brighter than the text.
- **Restrained.** The app uses greys, the near-white (dark) or near-black (light) primary for
  actions, and the destructive red only for delete. **Rose appears only in charts** on the Wrapped
  screen. Rose replaced the preset's emerald because black with green is Spotify's look.
- **Depth by lightness, not shadow** (dark): background → surface (the Now block, the best
  search result) → surface-raised (chips, the search field, sheets). List rows have no fill
  (Shapes).

Contrast, measured (WCAG 2.x ratios):

| Pair | Dark | Light |
|---|---|---|
| foreground on background | 13.7 | 18.1 |
| muted-foreground on background | 7.9 | 6.0 |
| muted-foreground on surface-raised | 6.0 | 5.4 |
| destructive on background | 6.8 | 4.8 |

**Browser surfaces are themed** (decided 2026-11-01): the text caret uses `foreground`;
selected text gets `foreground` at 25%; the focus ring is a 2px `ring` outline with a 2px
offset, on `:focus-visible` only; scrollbars follow `color-scheme`. No browser-default blue
anywhere, in either theme.

**No white flash.** The page background is set before any script runs (inline `background` on
`html` and a matching `theme-color` meta for each scheme), so launching, navigating and the
splash never show white in dark mode.

### Outfit colours (the 12 swatches)

The palette is the 12 colours in last season's Colours sheet (data-model.md). Each swatch is
drawn with its name below it and a 1px `border` ring, so white shows on light and black on dark.

*Values confirmed 2026-11-01 for the Colour sheet (T042); they may be retuned when the Cards are
designed (T088 to T096):*

| Colour | Value | Colour | Value |
|---|---|---|---|
| White | `#F5F3EE` | Brown | `#7A4A2A` |
| Red | `#C62828` | Pink | `#E87FA8` |
| Blue | `#1E5AA8` | Beige | `#D9C7A3` |
| Orange | `#E8711A` | Green | `#2E7D4F` |
| Yellow | `#F2C230` | Purple | `#6A3D9A` |
| Black | `#111111` | Grey | `#8C8C8C` |

## Typography

**Source Sans 3 everywhere**, app and Cards, self-hosted and trimmed (ADR 0006). Of 16 Google
Fonts tested, only Source Sans 3 and Noto Sans cover all 39 IAST and ISO 15919 letters a rasika
may type; the catalog itself is now plain English. Headings use the same family. Tamil and
Devanagari fall back to the phone's own fonts on screens; the Cards' fallback depends on the
renderer (T088).

| Role | Size / line height | Weight | Used for |
|---|---|---|---|
| caption | 13 / 1.3 | 400 | Badges ("Raga", "Laya vinyasam"), the "not matched" note |
| secondary | 15 / 1.35 | 400 | Raga · Composer · Tala lines, Appearance roles, chips |
| body | 17 / 1.4 | 400, 600 for titles | Everything else; Item titles in 600 |
| title | 20 / 1.3 | 600 | Screen headers, the Now block's Sabha |
| heading | 24 / 1.25 | 700 | Section heads on home and the Wrapped |
| display | 32 / 1.15 | 700 | Wrapped headline numbers ("39 Events · 241 Items") |

- Body is 17px, so every input is above iOS's 16px zoom threshold (base.css keeps the floor).
- Numbers that line up in a column (Item numbers, counts) use `font-variant-numeric: tabular-nums`.
- Text never goes below 13px.

## Layout

Phone width only, one column, built at 390px and checked from 320px to 430px.

- **Larger text** (decided 2026-11-01): type sizes follow the phone's text setting up to 200%.
  The px values in this file are the sizes at the default setting; build them in `rem` from a
  root that follows the platform (on iOS, `font: -apple-system-body` on the root; Android
  Chrome scales by itself). At large sizes the Details grid becomes one column, rows and
  headers wrap instead of truncating, and control heights are minimums that grow with their
  text. Every fixed bottom bar reserves its own height plus the safe-area inset, so the last
  row is never hidden. Each screen is checked at 320px wide and 200% text with the keyboard
  open.

- **Spacing** on a 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48. The screen gutter is 16px plus
  the safe-area inset. Related lines sit 4px apart; rows 8px; sections 24–32px.
- **Thumb zone.** Primary actions sit in the bottom third: the fixed "Add Item" bar, the
  docked search box, "Done" and "Next Item →".
- **Pushed screens' top bar** (decided 2026-11-01). The top centre belongs to the Dynamic Island,
  so there is no centred bar title. Below the safe area, the bar holds only a back chevron at
  the left, labelled with its destination ("‹ Season", "‹ Music Academy"), and at most one
  item at the right: a "⋯" actions menu or a text action such as "Done". What the screen is
  about is its first content block, in large type.
- **Navigation (DD1).** Three bottom tabs: Season (home), Wrapped, Settings. Event and Item are
  pushed screens with a back gesture. The tab bar hides while the Item editor is open.

**Screen layouts** (top to bottom; the full rules are DD2–DD5 in plan.md):

- **Season (home, DD2):** Now (one large block with one primary action, "Start logging" or
  "Continue: N Items"; with nothing on, "Log a Concert now" and a smaller "Lecdem") → Next
  (upcoming Planned Events by day) → Season so far (Attended Events, newest first, with Item
  counts, and one line to the Wrapped).
  - **Empty home** (decided 2026-11-01): a section with nothing in it is not shown, so on day
    one home is the Now block alone ("Log a Concert now", with "Lecdem" smaller). Next and
    Season so far appear as soon as they have content.
  - **New catalog prompt** (decided 2026-11-01; FR-038): one row at the top of home, under
    the status line: "An updated song catalog is ready." with "Update" and "Later". It never
    shows while a Concert holds Now through logging activity. "Later" hides it until the next
    launch.
  - **Which Event is Now** (decided 2026-11-01; D3, refined by D17): an Event being logged (an
    Item added or changed in the last 60 minutes, and not ended with "Done with this Concert")
    holds Now while it is inside its window. Otherwise the Event with the nearest start holds
    it. Any other Event in its window shows as one smaller line under the block, tapped to open.
    Nothing depends on "Done": a Concert lets go of Now by itself after an hour without logging
    or at the end of its window.
- **Event (DD3):** the concert as the first block (decided 2026-11-01, replacing DD3's one-line
  header): the Sabha on its own line in `title`, wrapping rather than truncating, then "Sat 14
  Dec · 6:30 pm · first-billed Artist" in `secondary`; tapping the block edits the Event's facts.
  The top bar's "⋯" holds Export and Delete Event. "Log a Concert now" opens this screen at once,
  started, with the date and time set to now and the Add Item bar ready (decided 2026-11-01);
  the concert block shows a tappable "Add Sabha" and Stage an "Add Artist" row, both filled in
  whenever the rasika likes. Lists show such a Concert as "No Sabha yet". → running order (numbered rows: title, then
  Raga · Composer) → Stage (Appearances in billing order, Colours optional) →
  the note. A fixed full-width 56px bar at the bottom holds the one action for the Event's state
  (decided 2026-11-01): "Start logging" on a Planned Event that is only being viewed (DD7), "Add
  Item" once it is started. "Done with this Concert" is an optional full-width secondary row
  directly after the last Item, shown once the running order has at least one Item; it never
  sits in the bar.
- **Item editor (DD4):** top bar "‹ Music Academy" (the Event); "Done" and "Next Item →" stay in
  the bottom bar as DD4 says. The first content
  line is the Item's number and, once picked, its title ("Item 8 · Kaddanuvariki"). The search
  box is docked above the keyboard, results growing upward with the
  best match nearest the box. The stack is bottom-aligned and reads, top to bottom (decided
  2026-11-01, as in the approved preview): the special-form chips (RTP, Viruttam / Slokam,
  Medley), "? Don't know", "Use what I typed: …", a divider, the results from weakest to best,
  then the box. The fixed rows stay pinned; only the results scroll. With few or no results the
  stack shrinks, so the fixed rows sit just above the box. The reading order for screen readers
  is the same top-to-bottom order, and the results list is labelled "best match last". After a pick, the Details as a grid of tappable values, with the
  Laya vinyasam and improvised Details folded underneath. Bottom bar: "Done", "Next Item →".
- **Wrapped (DD5):** headline numbers → the range as a quiet subtitle → a vertical list of 9:16
  Card previews, each with its own Share.
- **First launch (decided 2026-11-01; FR-050, FR-042, FR-049):** one step per screen, in order:
  Welcome (wordmark, one sentence, "Continue with Google" as the 56px primary) → Google sign-in
  → Consent 1 → Consent 2 → "Getting ready to log offline" with real progress → the empty home.
  Each consent screen asks one question with its one-line reason and two equal 56px buttons, Yes
  and No, with neither styled as the default and nothing pre-selected. "Ready to log offline"
  shows only once the catalog is stored. Each failure (sign-in cancelled, no signal, a Google
  error, the download stopping) is one line of text and one "Try again", on the step it
  happened, keeping the answers already given.
- **Settings:** theme, offline readiness, Export, sync and account, consent; the Maintainer's
  `/admin` link. *Outline only; laid out in the review.*

- **Screen-reader and keyboard focus** (decided 2026-11-01):
  1. A pushed screen moves focus to its first block (the concert's name, or "Item 8"). The Item
     editor is the one exception and focuses its search box.
  2. Sheets (the Colour sheet, Detail input) keep focus inside until closed, then return it to
     the control that opened them.
  3. Search announces its result count once, after typing pauses ("5 results"), never per
     keystroke.
  4. A Detail's spoken name carries field, value and state: "Raga, Todi, guess".
  5. Headings, lists and buttons use their real HTML roles; folds announce expanded or
     collapsed.

  Each screen gets a VoiceOver and a TalkBack pass before it is called done.

## Elevation & Depth

- **Dark:** no shadows. Layers are told apart by lightness (background, surface,
  surface-raised) and the 10% white border.
- **Light:** borders do the same job; only sheets and menus take a soft shadow.
- **Sheets** (Colour picker, edit menus) rise from the bottom over a 50% black scrim. Menus use
  the preset's inverted translucent style.

## Shapes

- Radius base 10px (preset `--radius: 0.625rem`), scaled: 6 / 8 / 10 / 14 / 18px.
- **Lists are rows, not cards** (decided 2026-11-01): Next, Season so far, the running order
  and Stage are rows on the background, divided by the `border` hairline, with no fill and no
  rounding. A fill means "this one is different": the Now block, the best search match, sheets.
- Buttons and the Now block: 14–18px, so tap areas read as soft blocks in the dark.
- Chips and the outfit swatches: fully round.
- Badges: 8px.
- Icons: Tabler, 20–22px, 2px stroke, always next to a text label unless the meaning is
  universal (back chevron, search).

## Components

- **Detail values and their six states** (decided 2026-11-01). Each state also has a spoken
  label, so none relies on a mark or colour alone.
  - **Matched:** plain text.
  - **Guess:** "Vararaga (?)", the "(?)" in muted-foreground.
  - **Unknown:** a lone "?". It never collides with a Guess, which always has a name first.
  - **Unresolved:** as typed; the Item editor adds a muted "not matched" under it.
  - **Override:** plain text; the Item editor adds a muted "catalog: Todi".
  - **Not applicable:** left out of lists ("Viruttam · Kambhoji"); the editor shows a muted
    "Not applicable".
- **Detail input** (decided 2026-11-01; T040, FR-007 to FR-011, FR-051): one pattern for every
  Detail. Tapping a Detail in the grid opens the same docked search, scoped to that Detail
  ("Raga…"). Three chips sit pinned above the keyboard: "?" (Unknown), "Not sure" (marks the
  current value a Guess; tapped again, clears it) and "N/A" (Not applicable). Every state is
  two taps from the grid.
  - Picking a value different from the catalog's makes it an Override automatically; the
    editor shows "catalog: Todi" with "Use catalog value" under it.
  - "Use what I typed" gives Unresolved, as in the Item search.
  - A ragamalika's Ragas show as an ordered row of chips with "+ Raga"; each chip opens the
    same sheet, and the row has its own move controls.
  - Tala opens its search, then a row of Nadai chips. With none picked, the Nadai stays Not
    applicable, which means the Tala's usual nadai (the store's default) and shows nothing
    extra: "Adi", not "Adi (chatusra nadai)".
  - The Laya vinyasam and improvised folds use the same sheet for each Detail inside them.
- **Artist and Sabha pickers** (decided 2026-11-01; T041, FR-004, FR-005): the same docked
  search. Before typing it lists the rasika's recent Sabhas or Artists; as they type, matches
  from their own and the shared lists. Each result shows a distinguishing line (an Artist's
  usual Role, when known), so similar names can be told apart. The last row is always "Add
  “what you typed” as a new Sabha" (or Artist), so a new entry is a deliberate choice, never a
  typo's side effect.
  - After an Artist is picked, a row of Role chips appears (vocal, violin, veena, flute,
    mridangam, khanjira, ghatam, morsing, other, presenter, "Not sure"). It can be skipped;
    the Role then stays blank.
  - The new Appearance joins Stage at the end of the billing order; billing order changes
    with the same "Edit order" pattern as the running order.
- **Search box:** 48px, surface-raised fill, a 2px `ring` inset while focused. It is the one
  element allowed to autofocus on mobile: the Item editor opens with it focused (DD4, the
  recorded exception to T110's rule).
- **Search result:** at least 60px; title in body 600, then the secondary line. The best match
  sits on `surface`. A Raga result carries a "Raga" badge and the line "Start this Item with
  only its Raga".
- **Search states** (decided 2026-11-01): before anything is typed, only the fixed rows show
  above the box. With no catalog match, one muted line "No match in the catalog" sits above the
  fixed rows, so "Use what I typed" is the next tap, and screen readers hear "No matches".
  Without the catalog on the phone, the box still works and one muted line reads "Catalog not
  on this phone yet. What you type is kept and can be matched later in Tidy."
- **Buttons:** primary fills with `primary`; secondary is a 1px border on transparent. Every
  target is at least 48px; the main action on a screen is 56px. Pressed state: opacity 0.6
  (base.css), with no hover styles outside `(hover: hover) and (pointer: fine)`.
- **A new Item exists from its first pick** (decided 2026-11-01): a song, a Raga, a special
  form, "? Don't know" or "Use what I typed". "Add Item" and "Next Item →" open an empty editor
  without adding a row, and backing out of it leaves the running order unchanged. Text typed
  but not yet picked is restored if the phone locks or the app is backgrounded; backing out
  discards it.
- **Saving:** no Save button and no toast. A changed or new row takes a surface-raised
  highlight that fades out over 1.2s, played only after the write to the phone has succeeded.
- **Save failure** (decided 2026-11-01, reopening the eng review's D9): if a write to the phone
  fails, the value stays on screen as entered, and a persistent line "Not saved on this phone"
  appears beside it in `destructive`, with "Try again" and "Export". It stays until a retry
  succeeds. It never plays the save highlight. That Export includes a labelled "Not saved"
  section with the values the phone couldn't store, read from the screen (eng review D6).
- **Deleting:** removes at once and shows an Undo bar above the bottom actions for 5 seconds.
  No "Are you sure?". Behaviour (decided 2026-11-01):
  - The bar sits directly above the screen's bottom action (the Add Item bar, the editor's
    bottom bar, or on home the tab bar) and never covers it.
  - The 5 seconds pause while the bar has keyboard or screen-reader focus.
  - A second delete inside the window replaces the bar with Undo for the latest; earlier deletes
    in the same Event stay undoable from its "⋯" menu, under "Recently deleted", until the
    rasika leaves the Event.
  - After a delete, focus moves to the row that took the deleted one's place (or the list's
    heading if none), and screen readers hear "Item 5 deleted. Undo available."
  - Deleting the Event itself from its "⋯" menu returns to home with the Undo bar there.
- **Reordering:** a separate edit mode on the Event screen with explicit move controls. No drag
  during a Concert. It opens from a muted "Edit order" text button at the right of the "Running
  order" heading, shown once there are two or more Items. In edit mode each row has 48px move-up
  and move-down controls and the bottom bar reads "Done" (decided 2026-11-01).
- **Colour sheet:** a grid of the 12 labelled swatches plus "?", then an optional second colour
  for a two-tone outfit. Behaviour (decided 2026-11-01, T042):
  - The sheet's title names the Artist: "Colours · T. M. Krishna".
  - 56px swatches with their names below, four to a row (three at large text sizes).
  - A tap selects and saves at once, like every other value: a check mark plus a 2px
    `foreground` ring. "?" means the rasika didn't notice.
  - Below the grid, "Second colour" opens the same grid; "Remove second colour" appears once
    one is set.
  - Black, White and Grey always carry a 2px `ring` border, so they stand off the sheet in both
    themes.
- **Finishing a Concert:** "Done with this Concert" shows a short summary of the Concert and
  what it changed in the season (a first Raga, a new Composer). It does not link into the
  Wrapped. It is optional (decided 2026-11-01, D17): tapping it also releases Now at once, but
  nothing else depends on it. The same "What it added" lines show at the end of the running
  order of any Concert no longer being logged, so the summary is never missed.
- **Status** (decided 2026-11-01, settling DD6's placement): home shows one muted line under its
  title, "Saved on this phone · 4 changes not yet backed up" or "All backed up" (FR-016), which
  opens the sync details in Settings. The Event screen and Item editor show nothing while all is
  well. When something needs the rasika ("Sign in again", "This phone is no longer the writer"),
  one line with its action button appears under the top bar on every screen until it is
  resolved; it never covers or disables Add Item. Its exact wording is settled with the rest of
  the system messages.

## Motion

Motion explains a change and is otherwise absent.

- Press feedback: 100ms. State changes (a fold opening, a value updating): 150ms ease-out.
- Sheets and pushed screens: 220ms, `cubic-bezier(0.2, 0, 0, 1)`.
- The save highlight: 1.2s fade. The Undo bar: 5s, then it slides away.
- Under `prefers-reduced-motion: reduce`, movement becomes a cross-fade and the highlight still
  shows (it carries information), without the fade.
- *Proposed, with the Cards:* one authored moment, a new stripe weaving into the season's
  fabric when a Concert is finished.

## Do's and Don'ts

**Do**
- Keep "Add Item" and the search box reachable with one thumb at every moment of a Concert.
- Use the glossary's words (Concert, Item, Raga, Appearance, Sabha) in every label.
- Write system messages plainly and briefly, with no exclamation marks.
- Give every Detail state, swatch and icon-only control an accessible name.

**Don't**
- Don't flash white in dark mode, on launch or between screens.
- Don't use rose, or any accent colour, outside charts.
- Don't put Colours, the note or sync status between the rasika and the next Item.
- Don't show a toast for a save, a spinner for local work, or a confirmation for a delete.
- Don't autofocus anything except the Item editor's search box.
- Don't mix fonts within a name, and don't show diacritics or karnatik's coding in catalog names.

## Messages

Every system message on the logging screens, drafted 2026-11-01 for the Maintainer to edit
(D28). Builders copy these strings rather than writing their own; tests may assert them. The
voice: plain, short, the glossary's words, no exclamation marks, never blaming the rasika.

| Where | When | Text | Action |
|---|---|---|---|
| Welcome | First launch | **Carnatic Wrapped** · "Log the Concerts you attend this December, even with no signal, and see your season whole." | Continue with Google |
| Sign-in | Cancelled | "Sign-in was cancelled. You need to sign in once before logging." | Try again |
| Sign-in | No signal | "No signal. Sign-in needs a connection, once, on this phone." | Try again |
| Sign-in | Google error | "Google couldn't sign you in just now." | Try again |
| Consent 1 (FR-042) | Question | "Share the Artists, Sabhas and Concerts you add by hand with the person who keeps the shared lists?" | Yes · No |
| Consent 1 | Reason line | "Only the names, with a count of how many rasikas added them. Never who you are or what you logged. You can change this in Settings." | |
| Consent 2 (FR-049) | Question | "Include your season, without your name, in reports about the whole December season?" | Yes · No |
| Consent 2 | Reason line | "Reports show totals across rasikas, never one person's log. You can change this in Settings." | |
| Getting ready | Downloading | "Getting ready to log offline…" with a progress bar | |
| Getting ready | Done | "Ready to log offline." | Start |
| Getting ready | Stopped | "The download stopped. Logging needs it once, with a connection." | Try again |
| Home status | Changes waiting | "Saved on this phone · 4 changes not yet backed up" | (opens sync details) |
| Home status | All synced | "All backed up" | |
| Any screen | Session ended (FR-050) | "Sign in again to keep backing up. Logging still works." | Sign in |
| Any screen | Another phone writes (FR-022) | "Your season is now being logged on another phone. Changes here are kept." | Details |
| Item or Event | Save failed | "Not saved on this phone." | Try again · Export |
| Home | New catalog (FR-038) | "An updated song catalog is ready." | Update · Later |
| Item search | No match | "No match in the catalog" | |
| Item search | No catalog | "Catalog not on this phone yet. What you type is kept and can be matched later in Tidy." | |
| Undo bar | After a delete | "Item 5 deleted" (or "Artist removed", "Concert deleted") | Undo |
| Screen reader | After a delete | "Item 5 deleted. Undo available." | |
| Screen reader | Search pauses | "5 results" / "No matches" | |

## Still open

Deferred by the design review of 2026-11-01 (D1: the logging screens first; the rest is designed
in the phase that builds it):

- "Did you go?" for past Planned Events never opened (finding 8): with the Plan screen, T056.
- "Ready for offline" covering share images as well as logging (finding 9): with the Cards.
- The restore banner (finding 10) and the conflict screen (finding 11): with sync, US2.
- The Card template: safe zones, one headline per Card, the wordmark, the white swatch, minimum
  data, the empty Wrapped (finding 12), and the outfit swatches' final tuning: T088 to T096.
- Smaller states: cancelled versus "schedule changed" (with the Schedule, T061), consent
  toggles offline (with Settings, T082), Share in progress or failed (with the Cards).
- The Lecdem variant of the Event screen (T063).
- The Settings layout.
- The Maintainer's edits to the drafted Messages table above, and the wording of messages for
  the screens deferred here.
- The product's name and where its logo appears (deferred 2026-11-01: the Maintainer is
  considering other names; a logo will appear somewhere). "Carnatic Wrapped" stays the working
  name until then.

## Decisions Log

| Date | Decision |
|---|---|
| 2026-10-31 | Preset `b51rn04Qt`; shadcn/ui and Tailwind (ADR 0006); Source Sans 3 everywhere; rose for charts. |
| 2026-11-01 | Warm text; dark by default; the six Detail states; screen behaviour (save, delete, reorder, colour sheet, finishing a Concert); plain English names. |
| 2026-11-01 | Preview of the Event screen and Item editor approved. |
| 2026-11-01 | Tokens: 17px body on a 13–32 scale, 4px spacing, 48px targets and 56px main actions, the motion rules. |
| 2026-11-01 | Design review (`/plan-design-review`, D3 to D29): Now and Done, the Event and Item editor bars, top bars, first launch, states, save failure, Undo, rows not cards, softened dark text, larger text, focus, Detail input, pickers, Colour sheet, Messages. The record is in `specs/001-season-logger/reviews.md`. |
