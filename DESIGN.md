---
# gstack: design-md-format=spec
name: Carnatic Wrapped
base: 'shadcn preset b51rn04Qt (style Rhea, Mist neutrals, rose charts, Tabler icons)'
colors:
  dark:
    background: 'oklch(0.148 0.004 228.8)'
    surface: 'oklch(0.218 0.008 223.9)'
    surface-raised: 'oklch(0.275 0.011 216.9)'
    foreground: 'oklch(0.88 0.014 80)'
    muted-foreground: 'oklch(0.72 0.014 75)'
    primary: 'oklch(0.88 0.014 80)'
    primary-foreground: 'oklch(0.218 0.008 223.9)'
    border: 'oklch(1 0 0 / 10%)'
    input: 'oklch(1 0 0 / 15%)'
    ring: 'oklch(0.56 0.021 213.5)'
    destructive: 'oklch(0.704 0.191 22.216)'
  light:
    background: 'oklch(1 0 0)'
    surface: 'oklch(1 0 0)'
    surface-raised: 'oklch(0.963 0.002 197.1)'
    foreground: 'oklch(0.2 0.014 60)'
    muted-foreground: 'oklch(0.5 0.016 60)'
    primary: 'oklch(0.218 0.008 223.9)'
    primary-foreground: 'oklch(0.987 0.002 197.1)'
    border: 'oklch(0.925 0.005 214.3)'
    input: 'oklch(0.925 0.005 214.3)'
    ring: 'oklch(0.723 0.014 214.4)'
    destructive: 'oklch(0.55 0.245 27.325)'
  chart:
    chart-1: 'oklch(0.81 0.117 11.638)'
    chart-2: 'oklch(0.645 0.246 16.439)'
    chart-3: 'oklch(0.586 0.253 17.585)'
    chart-4: 'oklch(0.514 0.222 16.935)'
    chart-5: 'oklch(0.455 0.188 13.697)'
typography:
  family: "'Source Sans 3', sans-serif"
  weights: '400, 600, 700'
  caption: '13px / 16px'
  secondary: '15px / 20px'
  body: '17px / 24px'
  title: '20px / 28px'
  heading: '24px / 32px'
  display: '32px / 40px'
rounded:
  sm: '6px'
  md: '8px'
  lg: '10px'
  xl: '14px'
  2xl: '18px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
  '12': '48px'
components:
  touch-target: '48px'
  primary-action-height: '56px'
  list-row-height: '64px two lines, 48px one'
  screen-gutter: '16px'
  motion-press: '100ms ease-out'
  motion-state: '150ms ease-out'
  motion-sheet: '220ms cubic-bezier(0.2, 0, 0, 1)'
  motion-grow: '200ms cubic-bezier(0.2, 0, 0, 1)'
  save-highlight: '1200ms'
  undo-window: '5000ms'
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

**The motif** (direction 2026-11-02, designed 2026-11-07; see "The motif" below). One soft mark
of light in Ink and rose runs through the app's edges, drawn in code from the rasika's own data:
the season's Ragas, a Concert's Ragas, an Artist's instrument and name. It is atmosphere, never
illustration, and it stays out of the logging surfaces, which keep receding.

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
- **Amber means "something to fix"** (decided 2026-11-03), and only on Settings' season rows
  ("Storage not protected", offline logging not available): the `warning` token, oklch(0.8 0.15 75) in dark and oklch(0.53 0.12 62) in light. It is never used for a failure to save, which
  stays `destructive`.
- **Depth by lightness, not shadow** (dark): background → surface (the Now card, the best
  search result) → surface-raised (chips, the search field, sheets). List rows have no fill
  (Shapes).

Contrast, measured (WCAG 2.x ratios):

| Pair                                                       | Dark | Light |
| ---------------------------------------------------------- | ---- | ----- |
| foreground on background                                   | 13.7 | 18.1  |
| muted-foreground on background                             | 7.9  | 6.0   |
| muted-foreground on surface-raised                         | 6.0  | 5.4   |
| destructive on background                                  | 6.8  | 5.2   |
| destructive on surface-raised (the failed Undo bar, chips) | 5.1  | 4.6   |
| warning on background                                      | 10.3 | 5.5   |
| warning on surface-raised                                  | 7.8  | 4.9   |

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

_Values confirmed 2026-11-01 for the Colour sheet (T042); they may be retuned when the Cards are
designed (T088 to T096). Twelve may prove too few: a fuller picker, a shade square under a hue
strip, is planned as T118 and changes what a Colour is (2026-11-05)._

| Colour | Value     | Colour | Value     |
| ------ | --------- | ------ | --------- |
| White  | `#F5F3EE` | Brown  | `#7A4A2A` |
| Red    | `#C62828` | Pink   | `#E87FA8` |
| Blue   | `#1E5AA8` | Beige  | `#D9C7A3` |
| Orange | `#E8711A` | Green  | `#2E7D4F` |
| Yellow | `#F2C230` | Purple | `#6A3D9A` |
| Black  | `#111111` | Grey   | `#8C8C8C` |

## The motif

Settled with the Maintainer on 2026-11-07, after three rounds of boards (line hatching, rose
curves and a hand-drawn mist were each turned down). The full board history is in the PR.

**What a mark is.** A soft mesh of light: [Paper Shaders](https://shaders.paper.design)' static
mesh gradient, its two shader strings copied into `app/src/motif/` with Paper's Apache-2.0
licence and notice (no package). One shared WebGL2 context draws every mark once into a still
canvas, so a Schedule of forty cards opens one context, and nothing animates or keeps running.
Each mark is softened by a CSS blur of 7% of its shorter side (Safari has no canvas filter),
drawn larger than its box and clipped, since the mesh leaves a sharp point at every colour's
centre (a streak or a pinhole where two tones meet). The shader runs at `highp`: at sharp mixing
its weights overflow a phone GPU's 16-bit `mediump`. No grain. With no WebGL2 nothing is drawn and the surface under it shows. About 4.5 KB of the first
install.

**Tones: Ink and rose.** Six theme tokens, each defined in both themes: neutral greys and one
rose, nothing cool. A mark names tones, never colours, so it redraws when the theme changes.
`ground` is the field's base (in dark, the page itself, so nothing is darker than the page and
the status bar meets the motif without a seam) and `far` its strongest contrast, kept out of
the fields so they hold no glare.

| Token            | Dark                      | Light                     |
| ---------------- | ------------------------- | ------------------------- |
| `--motif-ground` | oklch(0.148 0.004 228.8)  | oklch(0.975 0 0)          |
| `--motif-near`   | oklch(0.22 0 0)           | oklch(0.92 0 0)           |
| `--motif-mid`    | oklch(0.38 0 0)           | oklch(0.8 0 0)            |
| `--motif-rose`   | oklch(0.6 0.19 16)        | oklch(0.62 0.17 16)       |
| `--motif-blush`  | oklch(0.78 0.1 12)        | oklch(0.8 0.1 12)         |
| `--motif-far`    | oklch(0.8 0 0)            | oklch(0.3 0 0)            |

**Seeds.** The same seed always draws the same mark (`app/src/motif/seed.ts`):

- **The season** (Season's curtain): the Ragas heard at Attended Events, the most heard first,
  Linked ragas once. The three most heard take the field's voices, each toned by its melakarta's
  chakra (a prati madhyamam melakarta one on); the rest is ground, so the title on it stays
  quiet. Day one is ink with one faint rose; a second rose comes once three Ragas are heard, so
  the field grows with the season and never starts loudest.
- **A Concert** (its summary's edge): its Ragas; mostly ground, one rose glow, toned by the Raga
  heard most.
- **An Artist** (the Schedule tile): the instrument sets the form, the name varies it, all in one
  soft rendering. Bowed (violin, dance): one long fold. Plucked (veena, chitravina, mandolin):
  ripples. Struck (mridangam, ghatam, khanjira, morsing, thavil, nattuvangam): several small
  glows, like beats. Breath (voice, flute, nagaswaram, saxophone, presenter): one soft swell.
- **First launch's field** (the logo is the kolam, "The mark" below): Silk, one fixed
  field of long rose-and-ink folds, kept sharp (blur 1.2%, not 7%). Chosen by the Maintainer
  from four bolder fields on 2026-11-07: the one place the motif may be as wavy and vivid as it
  likes.

**Where it appears, and nowhere else:**

- **Season, as a curtain:** full-bleed from the top of the screen behind the hero, the rasika's
  concert (or with none the title, "Season", `heading`; option C, 2026-11-09), its bottom 16px
  above the sheet, with the page drawn up over it as a sheet with
  18px top corners from 112px under the status bar. The field fades halfway to the page over
  its bottom 80px, so the title holds at least 7:1 (measured). An installed Android web app
  can't draw under the status bar; the dark ground is the page colour, so there is no seam.
  In a phone's browser tab, where the install row shows, Season keeps its hero or title on the
  plain page, without the motif, until the app is installed, so the row stays at one place on every tab (FB-46). What else the shelf
  holds is to be decided.
- **The Concert summary's top edge, as a curtain:** 96px, the summary drawn up over it with
  18px corners. The page behind it goes grey under the scrim, so only this Concert's field
  carries rose.
- **First launch, as a horizon:** Silk, full-bleed from the top over 80% of the screen,
  dissolving into the page above the words; the words and the button sit low, under it. The
  dissolve runs from 45% of its height to its foot, eased (smoothstep) so it leaves and reaches
  the page with no slope and no line shows where it stops. It is
  the only mark that moves: its folds drift back and forth on slow periods (11, 14 and 19
  seconds, so it never visibly loops), drawn in its own WebGL2 context at the screen's CSS
  pixels, at most 30 frames a second, and not at all while the app is hidden, nor where WebGL
  is drawn by the CPU (no GPU, or a headless test browser), which would take the CPU from typing.
  With reduced motion it holds still, also when that is turned on while it moves; a lost GL context stops it
  until the browser restores one. The movement is about 0.4 KB of code; no video. With large
  text the words rise into the silk, so a full-bleed scrim rises behind them from 192px above,
  eased the same way (measured 13.7:1 at 200% text on a 320px phone).
- **No Schedule tile** (2026-11-08): the Schedule card's avatar tile went with the Schedule
  screen; an entry on Season's timeline is a quiet row with no tile.

It is never on the running order, search, Details, Stage, the sheets or any other logging
surface, and never on Artist rows: an avatar on every Artist read as too much (2026-11-07). It
fades in over 300ms when first drawn on Season and first launch, and simply appears with reduced
motion. Only first launch moves. It is decoration: hidden from screen readers.

## The mark

Settled with the Maintainer on 2026-11-10. The logo, favicon and app icons are one **sikku
kolam**: a single closed line drawn round 13 dots in rows of 1-3-5-3-1, never touching one.

**Construction.** On a square grid of pitch `s`, the line runs only on the diagonals through
the midpoints between neighbouring dots, so it passes every dot at `d = s√2/4` (0.354 s). At
each midpoint it crosses at 90° or turns back round its dot in a quarter arc of radius `d`.
Four inner turns, a quarter-turn apart, close it as one line, so the mark has four-fold
rotational symmetry. Stroke 0.12 s, dots 0.10 s.

**Forms** (in `app/public/`):

- **App icon** (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, and
  `icon-maskable-512.png` with the kolam inside Android's safe circle): the kolam in solid
  white glass on a plain ink tile, blushing to rose toward the lower right, its dots pearls.
  Light from the upper left: the rim is strongest on the left and fades out to the right, and
  soft shadows lift the kolam off the tile. No glow on the tile.
- **Browser tab** (`favicon.svg`, `favicon.ico`): the same rules on five dots (rows 1-3-1),
  heavier for 16px; rose line with maroon dots on a light tab, blush dots on a dark one.
- **One colour** (`mask-icon.svg`): the five-dot cut in black, for Safari's pinned tab.

The PNG icons are the second download (`app/src/precache-phases.ts`): the phone reads them when
it installs the app, and logging never needs them.

## Typography

**Source Sans 3 everywhere**, app and Cards, self-hosted and trimmed (ADR 0006). Of 16 Google
Fonts tested, only Source Sans 3 and Noto Sans cover all 39 IAST and ISO 15919 letters a rasika
may type; the catalog itself is now plain English. Headings use the same family. Tamil and
Devanagari fall back to the phone's own fonts on screens; the Cards' fallback depends on the
renderer (T088).

| Role      | Size / line height | Weight              | Used for                                                   |
| --------- | ------------------ | ------------------- | ---------------------------------------------------------- |
| caption   | 13 / 16            | 400                 | The "Raga" kind word, the "not matched" note, field labels |
| secondary | 15 / 20            | 400                 | Raga · Composer · Tala lines, Appearance roles, chips      |
| body      | 17 / 24            | 400, 600 for titles | Everything else; Item titles in 600                        |
| title     | 20 / 28            | 600                 | Screen headers, the Now card's title                       |
| heading   | 24 / 32            | 700                 | Section heads on home and the Wrapped                      |
| display   | 32 / 40            | 700                 | Wrapped headline numbers ("39 Events · 241 Items")         |

- Body is 17px, so every input is above iOS's 16px zoom threshold (base.css keeps the floor).
- Numbers that line up in a column (Item numbers, counts) use `font-variant-numeric: tabular-nums`.
- Text never goes below 13px.
- **Line heights sit on the 4px grid** (decided 2026-11-04, UI hill-climb): 16, 20, 24, 28, 32
  and 40px at the default text size, so a line, a row and the gap between them add up to whole
  grid steps. They scale with the phone's text setting as ratios (24/17 and so on).

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
  - The grid is 8px, with 4px for tight inner gaps (decided 2026-11-04, after the Carbon-like
    2x grid the Maintainer asked for). Two-line rows are 64px and one-line rows 48px; the
    hairline is drawn inside the row (`hairline-t`, `hairline-b`), so it never adds a pixel.
  - A section label sits 32px under the block above it and 8px over its first row; an action
    beside it (Edit order) keeps its 48px tap area by reaching past the line, not by pushing it.
  - Text sits on the 16px gutter. A fill that marks one row (the best search match) reaches
    8px past the text into the gutter instead of pushing the text in, and a text button's
    label (Remove Laya vinyasam, Edit order) starts or ends on the gutter.
- **Thumb zone.** Primary actions sit in the bottom third: the fixed "Add Item" bar, the
  docked search box, "Done" and "Next Item →". Season's bottom bar holds its search bar
  (2026-11-09); its + sits at the hero's right. The page keeps room for everything docked at the
  bottom (the action, any Undo bars, the tab bar): a field moved to behind them scrolls up above
  them.
- **Pushed screens' top bar** (decided 2026-11-01). The top centre belongs to the Dynamic Island,
  so there is no centred bar title. Below the safe area, the bar holds only a back chevron at
  the left, labelled with its destination ("‹ Season", "‹ Music Academy"), and at most one
  item at the right: a "⋯" actions menu or a text action such as "Done". What the screen is
  about is its first content block, in large type.
- **Navigation (DD1; the Season spine, the Maintainer, 2026-11-11).** Three bottom tabs, one
  per stage of a concert: **Season** (the hub), **Shortlist** and **Diary**. Settings is a mark
  on the hub. What's on is one tap below Season, never a fourth tab. Event and Item are pushed
  screens with a back gesture. Each tab keeps its own back stack: What's on, then Shortlist,
  then back to Season finds What's on where it was left. The tab bar stays on an Event and
  hides only while the Item editor is open. Tapping the tab that is on returns it to its top.
- **The Season spine** (the Maintainer, 2026-11-11, on
  [docs/designs/season-spine.md](docs/designs/season-spine.md), approved 2026-11-10; it
  replaces "Season (home, DD2)" below wherever the two differ):
  - **Words.** Home is Season; "Interested" is Shortlist (the tab, the listing sheet's
    "Shortlist" then "Shortlisted", the state); the tab of heard concerts is the Diary.
    "Wrapped" names only the stats and Cards that come later at the Diary's top, and "Season"
    only the tab. The store keeps `planned` for Shortlisted (ADR 0010).
  - **Only the hub has a curtain.** Shortlist and Diary take the plain tab header.
  - **Three chevrons on the hub, and no more:** Starting soon's "+N more" (What's on), the
    Shortlist tile (Shortlist) and the Diary block (Diary). A chevron means "this opens a
    page". The hero has none, though the whole hero opens its Event; rows have none.
  - **The bottom stack** is one frame, the same on every tab: the search bar (Season and
    What's on only), then the install strip (FB-46: thin, only in a browser tab), then the tab
    bar.
  - **The status bar.** The hub's curtain draws up under the clock and the Dynamic Island
    (`black-translucent`, with the safe area as padding inside the curtain). Every other screen
    paints that band in its own surface colour, in dark and light.
  - **Empty states** are shadcn's Empty, in our tokens, only where something is truly empty: an
    Event with no Items, the hub with nothing left today, an empty Shortlist or Diary, a search
    with no match.
  - **Shared parts, built once:** the tab header (plain or curtain), the section header with
    its chevron, the list row, the listing sheet, the empty state, the bottom stack and the
    safe areas.
  - **Craft.** Spacing on the 8px grid with 4px half-steps; line heights on the 4px grid;
    Tabler icons wherever one says it, each with an accessible name, and a word kept wherever an
    icon alone would be ambiguous; every tap target at least 44px.

**Screen layouts** (top to bottom; the full rules are DD2–DD5 in plan.md):

- **Season (home, DD2):** option C (the Maintainer, 2026-11-09, chosen from three mockups,
  replacing the Today · Coming · Past tabs of the same day, and before them one endless
  timeline and the Earlier page): people care most about today, then the days coming, and only
  now and then about the past, and picking which concerts to go to by Artist or Sabha must be
  dead easy. **Nothing sits above the curtain** (the Maintainer, 2026-11-08). The curtain holds
  the hero, the rasika's own concert; then the install row, "Getting ready for offline…" and the
  new-catalog row; then, at the top of the sheet, the strip of days, then every day from today
  on, by day; at the bottom, above the tab bar, the search bar (the Maintainer's review,
  2026-11-09). Past, on the strip, shows the days gone, newest day first, in
  place of that list; Today or a date brings it back. Season opens from today, at the very top,
  with no filter. Coming back from an Event, a sheet or another tab finds Season as it was left,
  on the days gone or from today, at the same place: kept by the day at the top of the screen as
  the page goes and held there before the first paint while the days above draw at their real
  heights, until the rasika scrolls (its anchor found again at each correction, let go once gone,
  and held on through a page still too short to reach its place), so nothing slides even where
  the browser has no scroll anchoring. Pushed screens and the other tabs open at their top. The
  old `/earlier` link opens Season on Past, at its top.
  - **The hero** (the Maintainer, 2026-11-09, and their review of it; builder's calls marked):
    the curtain stops being a title and always shows the rasika's own Event on now, else their
    soonest one still to start, whatever its state (one with no time counts all its day; never a
    cancelled one): one already being logged ahead of its day counts as much as a Planned one
    (the Maintainer's iPhone, 2026-11-09: the hero skipped it for a Planned one weeks later, so it
    and the list's first own row named two different concerts). It sits on a two-column grid, the content and a 24px column at its right, on the 16px
    gutters and 8px steps: first the word "Now" or "Next" in `sub` 600 (builder: the one word that
    tells a concert under way from one ahead), the + in the right column; 8px under it the title
    in `heading` 700, the Artists it is known by (else its Sabha, else "No Sabha yet") with its
    kind's mark, a chevron in the right column centred on the title's first line; 4px under it
    the line in `sub` at 80% of the text colour: the Sabha, the day (for Next, "Today" when it is
    today, so it never reads as on now), the time, and once attended the Item count ("Music
    Academy · 6:00 pm · 11 Items"). The +'s mark and the chevron end on one right edge, the
    gutter; the +'s 48px reaches past its column. The whole hero opens the Event, all but its +,
    so logging starts from the hero. It replaces the Now card in the sheet; the Event also stays
    in its day, since the list is the whole Schedule and the hero a way in (builder). A long
    known-by wraps at the same size, never cut or shrunk (builder: "Larger text", rows and
    headers wrap instead of truncating), the chevron staying on its first line. With no own Event
    on now or ahead, the curtain falls back to the "Season" title with its + at its right
    (builder: the page keeps its name when there is nothing of the rasika's to show, and no nudge
    to add stands in for it); the title is the page's heading for screen readers either way.
  - **The strip of days** (the Maintainer, 2026-11-09, and their review of it; builder's calls
    marked): one row at the top of the sheet, sliding sideways, with no line under it: **Past**
    at its left as text (only when a day gone has anything, or a match with a filter on),
    **Today**, then each date from tomorrow with anything on, slim, never a pill: its weekday in
    `caption`, muted, over its number in `body` ("Tue" / "15"), the month beside the number at
    the first date and where the month turns ("15 Dec", then "16"; builder: the number alone is
    enough within a month). Past and Today keep the same shape, an empty line over their word,
    so the words sit on the numbers' line. Each stop is 48px tall and at least 44px wide, 8px
    apart, with 8px above and below the row and its first stop's text on the gutter (builder:
    real breathing room on the 8px grid). It **stays pinned** under the top inset as the page
    scrolls, on the page's background (builder: it is the list's index, and the "what's on this
    week" scan is lost once it scrolls away); once pinned, the list fades out under it over
    16px, from the page colour to clear, instead of meeting a line. **Time fades** (the Maintainer, 2026-11-09,
    style B): each stop's ink follows time, the whole stop, its weekday in the text colour too.
    Today is in full ink; each day ahead is fainter by 0.13 a day, down to a floor of 0.65; Past
    is the faintest, at 0.6. Asked for at about 0.3 and 0.35, these were raised, since text at
    0.3 reads only 2.0:1 (light) and 2.2:1 (dark): 0.6 is the least that keeps the number at
    4.5:1 or better on the page in both themes (4.7:1 light, 5.4:1 dark, measured from the
    tokens; 0.59 and 0.54 are the exact minimums). The day in view, the first whose rows reach
    below the strip, is **chosen**: always in full ink and a step heavier (500), with no dot and
    no pill; ink and weight change over 250ms, at once with reduced motion (the variable font
    takes 500, and moves to it smoothly). Choosing one moves nothing else. The strip
    slides to keep the mark in view; until the list is scrolled into, the day it starts at is
    marked. A date tapped **starts the list at that day** and takes the page back to its top, so
    the hero stays where it is and the day sits just under the strip (the Maintainer's iPhone,
    2026-11-09: a jump that scrolled the hero away read as a glitch, and the same tap landed
    differently from different places); the days before it are a tap on Today away. Today starts
    the list from today again. Each day's label sticks under the strip while its day is on the
    screen, as a festival schedule's do, and fades the rows passing under it over 24px as they
    pass, so none shows half cut (the council, 2026-11-09), but none under a day resting just
    under the strip, whose first row is under nothing (the Maintainer's iPhone, 2026-11-09: that
    row read dimmer than the rest). A stop shows a focus ring only from
    the keyboard, rounded and inside it. With a filter on, dates with no match drop out, and
    Past shows only with a match there, but stays while it is the one shown, so the strip always
    says where the rasika is (builder).
  - **The calendar** (the Maintainer's review, 2026-11-09; builder's calls marked): a 48px
    calendar mark at the strip's right end, pinned with it, its mark on the gutter, spoken "Pick
    a day". It opens a sheet as tall as one month (builder: the list stays in view above it):
    the month and year in `title` on the gutter, its two 48px arrows together at the right, 8px
    clear of the close (the council, 2026-11-09), then the weekdays, Monday first (builder:
    the season's weekends end each row, read together), then the days, 48px each. A day with
    anything on, with a filter on only a day that matches, carries the same 4px ink dot under its
    number; only those take a tap, the rest muted (builder: a tap on a day with nothing would
    land nowhere). Today's number is 600. The months page sideways, by the arrows or a swipe,
    from the first month with anything to the last, past months included. It opens on the month
    of the day in view. A day tapped starts the list there as a date on the strip does, a day
    gone starting Past at it, and closes the sheet.
  - **The search bar** (the Maintainer's review, 2026-11-09, "Maps-style"; builder's calls
    marked): one bar, 48px, shaped as the app's other search fields (the Maintainer, 2026-11-10:
    it looked too different): 14px corners, the search mark 12px in and the text at 40px, in the shell's bottom bar just above the tab
    bar, in thumb reach, on Season only, while there is anything in the Season. The shell's bar
    keeps the page clear of it (the last row scrolls up above it) and sits on the safe area; on
    Season it has no line over it, the list fading out above it over 24px, as under the strip
    (the council, 2026-11-09). It reads "Artist or Sabha…" in muted text after a search mark, on `surface-raised` in both
    themes (builder: in dark that is the search field's own fill, one step lighter than the page,
    with no border or shadow, depth by lightness). Tapped, it opens the search sheet. With a
    filter on it reads the filter as plain text in full contrast, "T M Krishna · Music Academy":
    as many parts as fit whole, then "+N" for the rest ("Music Academy +1"), so no name is ever
    cut and more being on always shows (the council, 2026-11-09; only a first part too long
    alone ends in an ellipsis), and one 48px x at its right, spoken "Clear
    filters", that clears it all. While Season loads, the bar keeps what it showed, so the page
    never moves under the place it is held at.
  - **The search sheet** (the Maintainer's review, 2026-11-09; builder's calls marked): opened from
    the bar with its field focused, so the keyboard rises at once (builder: tapping a search bar
    says "I'll type", as in Maps; the second recorded exception to no autofocus, after the Item
    editor's), 85% of the screen tall, sitting above the keyboard (the council, 2026-11-09: the
    names need room to browse). No title: the 48px field, "Artist or Sabha…", is its first line,
    level with the close (the council: a title only repeated it); under it Mine (only the
    rasika's own Events; shown once there is a Schedule, since without one every row is theirs)
    and the kinds the Schedule has, Dance, Lecdem and Harikatha, as text toggles, 8px apart: off
    in muted text, on in full contrast and 600 with a check after the word, as on the names under
    them, never a filled pill. Each is as wide on as off, the check's room and the 600 width held
    either way, so turning one on moves nothing (the Maintainer's iPhone, 2026-11-09: Harikatha's
    check and weight pushed into Lecdem), and all four fit one line at 390px (the council,
    2026-11-09: with the check's room held after each, 8px apart sets the words 28px apart). Then the
    names: before typing, those picked, then every other name in the Season, A to Z, to browse
    (the council, 2026-11-09); as the rasika types, the suggestions from the names in
    this Season's Schedule and their own Events, billed Artists, groups by their group name and
    Sabhas with their Aliases ("KGS" finds Krishna Gana Sabha), ranked as the Artist and Sabha
    pickers rank names, each a 48px row of the name and its sort ("Artist", "Group", "Sabha") as
    a muted word, then a check on each one picked, hairlines between rows; typed with no such
    name, one muted line says so. A name tapped, or the first by Enter, is picked and the sheet
    closes onto its days (builder: most searches are one name, so one tap from typing to the
    list); a ticked one tapped is taken off, and a toggle tapped, with the sheet staying open.
    Picks of one sort widen the list (TM Krishna or Sanjay; an Artist and a group are one sort,
    the performers); picks of different sorts narrow it (TM Krishna at the Academy); kinds
    picked together widen each other. Every filter applies to the days ahead and the days gone
    alike, to own Events as to listings, and prunes the strip and the calendar's dots; the hero
    is never filtered, since it is where the rasika logs (builder). A list the filter empties
    says "Nothing here matches." with one outline "Clear filters" under it, which turns every
    filter off. Filters last while the app is open, across Past and Events, and **not across
    launches** (builder): Season opens whole each time, so a filter set yesterday never hides a
    Concert today without being seen. The + brings Season back from today, at its top, even from
    Past (builder): the Concert it makes is today's, and the hero holds it.
  - **Each day:** its label (as Next's were, sticking under the strip), then the rasika's own Events by start time
    (Planned, Attended, being logged, cancelled and kept, and those made by hand), then the Schedule's other entries for that day, quieter: muted and not bold, with no button of
    their own. An entry the rasika planned shows once, as theirs. A day with nothing in it is
    not shown. Rows far from the screen aren't drawn until scrolled near, each day's held at their
    likely height (a 64px row each, and 20px more for a printed title); the label is always drawn,
    outside what skips drawing, since Safari moves a sticky label inside it only once a fling's frame
    is done and the rows ran over it at a day's change (the Maintainer's iPhone, 2026-11-10): at 390px, 56 of the 2026-27 feed's 60 days draw at exactly that height and the rest within 40px, where a name wraps, so a browser with no scroll anchoring moves the page at most that much, once, as such a day first draws; with 391 entries, scrolling at 4x CPU
    slowdown holds p95 under 28ms a frame.
  - **The +** (the Maintainer, 2026-11-08, replacing walkthrough S1's "+ Log a Concert" bar):
    a Concert not on the Schedule is the rarer way in, so it is a 48px + icon button in the
    hero's right column (or at the Season title's right), spoken "Log a Concert", its mark on the gutter.
    The curtain is the one block in every state, the empty Season included, and the page opens
    at its top, so the + is always in view on open. It still starts another Concert, a past one included, while one
    is in progress, one per tap. Season's bottom bar holds only its search bar (2026-11-09).
  - **Now** (walkthrough S1; in the hero since option C, 2026-11-09, no longer a card in the
    sheet): the Event that holds Now is the hero's, tapped to open it. A Planned one opens on its
    Event screen, whose bar holds "Start logging", so the Season page keeps one filled button.
  - **Every Event row** (the hero and the list's own rows) leads with the Artists the Event is known by
    (walkthrough S2; see Event below), the Sabha first on the line under it. Before any Artist,
    the row leads with the Sabha, or "No Sabha yet".
  - **Empty home** (decided 2026-11-01): with nothing logged, planned or listed, home is the
    title with its + alone (2026-11-08), and one quiet calendar mark, no words, at about a third
    of the sheet's height; no strip or filter, as there is nothing to choose between. The days from
    today on with nothing in them, unfiltered, show the same mark, spoken "Nothing ahead" (the
    days gone, "Nothing yet"). Without a Schedule (no feed delivered yet) the list is the
    rasika's own Events alone, in the same order, opening the same way. ("Lecdem" joins with the Lecdem variant, T063; Dance and
    Harikatha with T122.)
  - **New catalog prompt** (decided 2026-11-01; FR-038): one row at the top of home, under
    the status line: "An updated song catalog is ready." with "Update" and "Later". It never
    shows while a Concert holds Now through logging activity. "Later" hides it until the next
    launch.
  - **The rasika's rows and the Schedule** (the Maintainer, 2026-11-07; T061): a Planned Event
    whose Schedule entry is cancelled stays in its day until the rasika removes it (Delete
    Event), even once its start time has passed,
    its title muted and a cancelled mark (a calendar with a cross) at the row's right, spoken
    "Cancelled". One the Schedule changed after the rasika edited it carries a calendar with "!"
    there, spoken "Schedule changed": a 48px button of its own beside the row, which opens what
    changed (2026-11-07), on a cancelled row as on any other. An Attended or Missed Event never
    gets it: it is the rasika's record of what happened. The sheet, titled "Schedule changed",
    lists only the fields that differ, each led by its mark (calendar, clock, building,
    category, "T", a ban sign for cancelled or on, people) and spoken by its name: the Event's
    value muted, an arrow, the Schedule's. Cancelled and on are a calendar with a cross and one
    with a check. Billed Artists list a name per line, the Role under it. Two buttons share the
    bottom: "Keep mine" (outline, an X) and "Take it" (primary, a check). Either closes the
    sheet once saved; a failure shows its row in the sheet. A change to Concert that takes a
    typed title offers Undo, as a kind change does. Season no longer hides a cancelled Event;
    it is never Now.
  - **Which Event is Now** (decided 2026-11-01; D3, refined by D17): an Event being logged (an
    Item added or changed in the last 60 minutes) holds Now while it is inside its window.
    Otherwise the Event with the nearest start holds it. Any other Event in its window shows as
    one smaller line under the block, tapped to open. A Concert lets go of Now by itself after
    an hour without logging or at the end of its window; nothing ends it by hand (walkthrough
    S13, 2026-11-05).
- **Event (DD3):** top to bottom, heading → Stage → Note → Items (walkthrough S2, S3, decided
  2026-11-04, replacing the Sabha-led block and the running order before Stage).
  - **Heading:** the Artists the Event is known by, in `title`, wrapping rather than truncating:
    its vocal, veena, chitravina, flute, nagaswaram, saxophone or mandolin Artists (a Lecdem's
    or Harikatha's presenters, a Dance's dancers), joined with "&" ("Ranjani & Gayatri"; three
    read "A, B & C"); without one, the first Artist on Stage. Members of a Group billed together
    show as the Group's name ("Malladi Brothers"), here, on every Event row and on the Schedule
    card (Maintainer, 2026-11-06). Before any
    Artist, the heading is "+ Add Artist", which opens the Artist picker.
  - **The line under it:** "Music Academy · Sat 14 Dec · 6:30 pm" in body, muted, at least 56px
    tall (walkthrough S11); tapping it edits the Event's facts. Before a Sabha, a "+ Add Sabha"
    button opens the Sabha picker, with the date and time beside it.
  - **Stage**, shown once it has an Artist (before then the heading adds one), with a + at its
    heading's right, spoken "Add Artist", that opens the Artist picker; no "Add Artist" row
    under the Artists (the Maintainer, 2026-11-10). Then **Note**,
    then **Items**: numbered rows, title then Raga · Composer, under the heading "Items"
    (walkthrough S12). The Items come last, so the list ends right above the bar.
  - **Note** is a fold (walkthrough P6, 2026-11-05): open when it has text, so a note written
    stays in view, and one 48px row when empty.
  - The top bar's "⋯" holds Delete Event (its Export moved to Settings on 2026-11-03). Season's
    + opens this screen at once, started, with the date and time set to now and the Add Item
    bar ready (decided 2026-11-01). Left with nothing entered (only the kind, date and time it
    was made with), by the back gesture, the top bar or a tab, even after a reload, it leaves no
    trace: no row, no Undo bar, no "Not saved" (the Maintainer, 2026-11-08). Anything entered keeps it, an edit that failed to save included. It leaves no row only with proof it never left the phone (its birth still queued and never sent, and nothing heard from the server); otherwise it is deleted as a tombstone that syncs, so the server keeps no empty Concert. No page anywhere may have it open: from the + tap, before it is written, every open page of it in any tab holds a lock named for it, shared, and taking it back needs that lock alone and at once, so a tab with it open, or another tab's Season sweeping as it is born, never loses it; with no Web Locks it is kept. When unsure it is kept too: a new Sabha or Artist still typed, being written or failed, whose entry names no Concert, keeps it (PR #30 reviews).
  - A fixed full-width 56px bar at the bottom holds the one action for the Event's state
    (decided 2026-11-01): "Start logging" on a Planned Event that is only being viewed (DD7),
    "Add Item" once it is started. Nothing follows the last Item: a Concert ends on its own
    (walkthrough S13; see "Finishing a Concert").
- **A Schedule entry on Season** (the Maintainer, 2026-11-08, replacing the Schedule screen of T061; its
  route goes to Season): a row of Season's timeline, quieter than the rasika's own: the Artists
  it is billed by (a Group by its name) with its kind's mark, or its Sabha when nobody is billed;
  a printed title under it; then "Sabha · time". No button on the row: a tap opens its sheet,
  titled by the same name, with every fact led by its mark (a "T" for the title, calendar, clock,
  building, people): the date, time, Sabha and each billed Artist with their Role and group
  under the name. One filled "+ Add" at the bottom plans it as the Schedule add did (one id per
  attempt, ADR 0007, and a new attempt once its Event was deleted); once added the row becomes the rasika's in its day, and the sheet's
  button becomes an outlined "Planned" with a calendar check, opening the Event. A cancelled entry stays on its day, dimmed, with the cancelled mark; its sheet shows the mark and has
  no add.
- **Item editor (DD4):** top bar "‹ Music Academy" (the Event's Sabha). The bottom bar holds
  "Next Item →", outlined, at the left and "Done", the filled main action, at the right
  (walkthrough S9, decided 2026-11-04). Once picked, the title is the first content line, with
  "Item 8" as a small muted eyebrow above it in `caption` (walkthrough S10); before a pick, the
  heading is "Item 8". A field's label sits 8px above its chips ("Nadai"; walkthrough
  S11). "Done" goes back to the Concert, "done for now" (walkthrough P1). The search
  box is docked above the keyboard, results growing upward with the
  best match nearest the box. The stack is bottom-aligned and reads, top to bottom (decided
  2026-11-01, as in the approved preview): the special-form chips (RTP, Viruttam / Slokam,
  Medley), "? Don't know", "Use what I typed: …", a divider, the results from weakest to best,
  then the box. The fixed rows stay pinned; only the results scroll. With few or no results the
  stack shrinks, so the fixed rows sit just above the box. The reading order for screen readers
  is the same top-to-bottom order, and the results list is labelled "best match last". After a pick, the Details as values (see "Values"), then one
  fold, Improvised, holding Alapana, Tanam, Niraval, Kalpana swaram and the Laya vinyasam as
  rows of the same kind (walkthrough S14). Bottom bar: "Done", "Next Item →".
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
- **Settings** (laid out 2026-11-03 for Phase 4): the season first, as three icon-led rows,
  each with its words in its accessible name and amber when something is wrong: offline
  readiness ("Ready offline"), persisted storage ("Storage protected", amber "Storage not
  protected" when the browser hasn't promised to keep it), and Export with the date of the last
  one ("Last: 2 Nov", or "—" before the first). Then the theme, as one track holding both
  choices. Then the Maintainer's `/admin` link, a row with a chevron, and last the app and
  catalog versions, small and muted (reordered 2026-11-04, UI hill-climb). Sync, account and
  consent join in Phase 7. As built and accepted 2026-11-03:
  - **Ready offline** leads with an airplane mark. "Getting ready for offline…" has a muted
    spinner and is not amber, since it clears on its own. In a browser with no service worker
    the row is amber, with the alert mark and "Offline logging isn't available in this
    browser…".
  - **Storage** leads with a shield, with a check when protected and the exclamation when not.
    It is asked of the browser each time Settings opens.
  - **Export** leads with the download mark, which takes the check badge once a file goes out
    from this page; its name is then "Exported. Last: 3 Nov". It is never amber. The date is
    kept once a file holding the season is handed over, a rescue Export from a readable store
    included.
  - **Versions:** "App 0.1.0" and "Catalog …" on their own lines; the catalog line shows once a
    catalog version is recorded.
- **Export lives in Settings** (decided 2026-11-03). It is the only thing a rasika does with
  their data before sync, so it isn't pressed on them elsewhere: the Event's "⋯" holds only
  Delete Event. The safety rows keep their own Export, which rescues values not saved
  (docs/adr/0007).

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
  the preset's inverted translucent style. The Concert summary is shadcn's Dialog: centred,
  `surface` with 18px corners, over its own blurred scrim (50% black, the page behind in grey).

## Shapes

- Radius base 10px (preset `--radius: 0.625rem`), scaled: 6 / 8 / 10 / 14 / 18px.
- **Lists are rows, not cards** (decided 2026-11-01): Season's timeline, the running order
  and Stage are rows on the background, divided by the `border` hairline, with no fill and no
  rounding. A fill means "this one is different": the Now card, the best search match, sheets.
- Buttons and the Now card: 14–18px, so tap areas read as soft blocks in the dark.
- Chips and the outfit swatches: fully round.
- Badges: 8px.
- Icons: Tabler, 20–22px, 2px stroke, always next to a text label unless the meaning is
  universal (back chevron, search). One exception (FB-27): an Item row marks its Laya vinyasam
  with the muted metronome mark, named "Laya vinyasam" to screen readers, in place of the pill.

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
  - A ragamalika's Ragas show as values in the order sung, "Kalyani, Kanada", then a muted "+"
    for another; each opens the same sheet, and the row has its own move controls.
  - Tala opens its search, then a row of Nadai chips: "?", the five nadais and "Other…".
    With none picked, the Nadai stays Not applicable, which means the Tala's usual nadai (the
    store's default) and shows nothing extra: "Adi", not "Adi (chatusra nadai)". "Other…"
    opens the Nadai's own sheet, the same pattern as every Detail ("?", "Not sure", "N/A",
    free text), as the Laya vinyasam's Nadai does (2026-11-02).
  - The Improvised fold uses the same sheet for each Detail inside it.
  - **The Laya vinyasam** is one more row of the Improvised fold (walkthrough S14, decided
    2026-11-05): a "Laya vinyasam" chip, pressed while there is one, like Alapana's. Pressed,
    "+ Nadai" sits beside it and its Note grows open under the row; tapped again, it is removed,
    as Alapana takes its Raga with it, but never with a note typed under it: one tap would lose
    the text, so the tap goes to the note instead, to clear it first. Its Nadai stays the Tala's usual nadai until
    "+ Nadai" is tapped, since many rasikas won't know it; once set, it shows in that place as
    "khanda nadai" (FB-29).
- **Artist and Sabha pickers** (decided 2026-11-01; T041, FR-004, FR-005): the same docked
  search. Before typing it lists the rasika's recent Sabhas or Artists; as they type, matches
  from their own and the shared lists, and the names the Season's Schedule prints that no list
  holds yet, each once (the Maintainer's iPhone, 2026-11-09: Add Artist found nothing for an
  Artist billed all Season), after the names the lists hold at the same closeness, an Artist's
  line the Role they are billed in most (the council, 2026-11-09). Picked, such a name becomes
  an own entry, as planning its listing would make it. Each result shows a distinguishing line (an Artist's
  usual Role, when known), so similar names can be told apart. The last row is always "Add
  “what you typed” as a new Sabha" (or Artist), so a new entry is a deliberate choice, never a
  typo's side effect.
  - After an Artist is picked, a row of Role chips appears, capitalised like the other chips
    and in Stage order (Vocal, Veena, Flute, Violin, Mridangam, Ghatam, Khanjira, Morsing,
    Other, Presenter, "Not sure"; walkthrough S8). The common Roles show first and the rest sit
    behind "More" (Maintainer, 2026-11-06): the ten above, then More opening Dancer,
    Nattuvangam, Vocal support, Chitravina, Nagaswaram, Saxophone, Mandolin and Thavil, also in
    Stage order. At a Dance, Dancer and Nattuvangam join the first row. A Role behind More that
    is the current or usual one shows pressed with More open, so it is never hidden. An Artist
    logged before has their usual Role chosen and saved at once, shown pressed (walkthrough
    S6): tapping it or closing the sheet keeps it, another chip changes it, "Not sure" leaves
    the Role blank. A new Artist's chips start with none pressed, and can be skipped.
  - Tapping an Artist on Stage opens their sheet. Its title is the Artist's name as a field:
    a corrected name is journalled as typed, saved when the field is left, Done is pressed or
    the sheet closes (not when the page is hidden, so a half-typed name never stays as an Alias),
    applies in every Concert, and keeps the old name as an Alias, so search still finds it
    (walkthrough S5). A
    shared Artist's name is the Maintainer's and shows as plain text. Under it, the same Role
    chips with the current Role pressed (tapping it again clears it; "Not sure" appears only
    right after adding, 2026-11-02), then Colours, then "Remove" with the bin mark
    (walkthrough S7).
  - **Stage order** (walkthrough S4, decided 2026-11-04): Stage has no "Edit order". Artists
    are listed by Role, as in a printed kutcheri listing: dancer, nattuvangam, vocal, vocal
    support, veena, chitravina, flute, nagaswaram, saxophone, mandolin, violin, mridangam,
    thavil, ghatam, khanjira, morsing, other, presenter, then no Role; within a Role, the order
    added. The Roles added on 2026-11-06 slot in without moving the earlier ones. This orders
    what is shown; no Role ranks above another in the Wrapped.
- **Values** (walkthrough P2 to P4, 2026-11-05; FB-32, FB-33, FB-35, FB-42). Every value is one
  kind of row: a small muted label (`caption`) over the value as text, underlined in `border`
  with a 4px offset, so everything that can be changed reads as such. The Concert's facts line
  takes the same underline. Importance is weight and contrast, never a fill: the Composition in
  600, Raga and Tala in full contrast, Composer, Language, Subject and Form muted. Adding a value
  is a muted "+" (with its word only where the "+" alone wouldn't say what, as "+ Nadai"), never
  an "Add" pill.
  - **Chips** are only for picking from a short fixed set: the Item kinds (RTP, Viruttam /
    Slokam, Medley), the improvised parts and the Laya vinyasam, Roles, Nadais, and "?", "Not
    sure", "N/A". A chip always means "pick one of these"; a Raga is never a chip. Season's
    filter has none (2026-11-09): its toggles are text, and what is on reads in its search bar.
  - **Forms** show in sentence case, like the Roles: "Kriti", "Javali", "Varnam" (the catalog
    keeps "kriti"); the project's own keep their names ("RTP", "Slokam").
- **Search box:** 48px, surface-raised fill, a 2px `ring` inset while focused. It is the one
  element allowed to autofocus on mobile: the Item editor opens with it focused (DD4, the
  recorded exception to T110's rule).
- **Search result:** a row on the gutter, 64px with two lines and 48px with one, divided by the
  hairline; title in body 600, then the secondary line. The best match is the one filled row, on
  `surface-raised` in both themes, on a page or in a sheet, with no border, its fill reaching 8px
  into the gutter. The fixed rows above ("? Don't know", "Use what I typed") are hairline rows too;
  the hairline under the Item kinds' chips sits their own 8px gap below them (walkthrough P5).
  A Raga result is one line, the word "Raga" after its name in muted caption, not a filled badge (a
  fill on every row says nothing; the line "Start this Item with only its Raga" was also cut on
  2026-11-04: fewer words). Results that scroll up under the fixed rows are gone in the first 12px
  and fade in over the next 20, so a row half under them never shows a second rule.
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
  It plays only on values whose change you can't see happen: one set in a sheet, a new or
  restored row. Never on a chip or toggle, whose own state shows the save, nor on typed text or
  a dropped row (walkthrough P7, FB-34, 2026-11-05).
- **Save failure** (decided 2026-11-01, reopening the eng review's D9; simplified 2026-11-02,
  docs/adr/0007): every value is journalled on the phone the moment it is entered and leaves
  only once the store is read back holding it. If a write fails, the value stays on screen as
  entered, with an icon-led row in `destructive`: the alert mark, "Not saved", and icon buttons
  for Try again and Export, whose names carry the sentence ("Not saved on this phone."). It never
  plays the save highlight. Try again writes the value as entered, one at a time in the order
  entered, one line at a time, stopping at the first that fails again. A saved value stays on
  screen until the screen reads the store back holding it. A delete that fails reads "Not
  deleted" ("Not deleted · Concert, Mon 2 Nov" where nothing else names it), and its Try again
  deletes and offers Undo, as the first tap does (decided 2026-11-02); its Dismiss keeps the
  record after all (decided 2026-11-03). A move or a repick is never retried: "Not moved" or "Not
  changed", with Dismiss, and the rasika does it again. Dismiss never takes a failed value. A row shows one kind of failure: a record whose move and delete
  both failed has two rows. Every Export holds every journal entry, labelled "Not saved". Once an
  Export has been handed over, its download icon carries a check badge, and values Try again can
  no longer save get Clear, which first asks "Is the Export saved where you can find it?" and
  then removes only that row's entries the file holds. A failure inside an open sheet shows its
  row in the sheet.
- **The store can't be opened** (decided 2026-11-02): when the phone's database won't open,
  every screen gives way to one rescue screen that needs no database: the alert mark, "Can't open
  your season", Try again (back to the start) and Export. That Export holds only the journal; it
  is named `carnatic-wrapped-<day>-store-unreadable.json`, and once handed over the button keeps
  "Export" and its download icon, with a small check badge (screen readers hear "Exported"). An open still waiting after 10 seconds leaves the screen in place, under the row
  "Still opening your season…" with Export. It is a slow start, not a failure: a muted spinner
  (Tabler IconLoader2, still when reduced motion is asked for) and muted text, no alert mark.
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
  - An Undo that fails to save keeps an icon-led bar in destructive, "Undo failed · Concert" with
    Try again and Dismiss, until it works or the rasika dismisses it, across leaving the Event and a
    reload. Only the newest failed bar shows, with "+1" when older ones wait; "+1" brings the
    next forward, and on the Event screen they are also under "⋯" (decided 2026-11-02). When a
    rule refuses the Undo, the bar says which ("Undo failed · Artist · a Lecdem has at most 3
    presenters"); when the Item's or Artist's Concert is deleted, it says so, with Dismiss
    only. Its 5 seconds stop while the Undo is being written.
- **Reordering:** a separate edit mode on the Event screen. It opens from a muted "Edit order"
  text button at the right of the "Items" heading, shown once there are two or more Items. Only
  Items reorder; Stage follows Role (walkthrough S4). The bottom bar reads "Done" (decided
  2026-11-01). Each row ends in the bin and a grip, its dots on the gutter (FB-26, decided
  2026-11-05):
  - The grip takes the finger at once, with no hold, and the page doesn't scroll under it. The
    row lifts (`surface-raised`, the 8px bleed, a soft shadow in light only) and follows the
    finger; a row steps aside over 200ms once the lifted row's leading edge passes its middle.
    Near the top or bottom of the screen the page scrolls under it.
  - The drop moves the Item once, shown in its new place at once and eased into it; a failed
    move reads "Not moved" and the rows go back to the stored order.
  - Move up and Move down stay for VoiceOver and the keyboard, out of sight until focused, then
    over the row's text beside the bin, so the row never reflows under a tap.
  - Rows hold one title line and one Raga · Composer line while ordering, ending in "…", so
    every row is 64px; the full names show outside it (decided 2026-11-05).
- **Colour sheet:** a grid of the 12 labelled swatches plus "?", then an optional second colour
  for a two-tone outfit. Behaviour (decided 2026-11-01, T042):
  - The sheet's title names the Artist: "Colours · T. M. Krishna".
  - 56px swatches with their names below, four to a row (three at large text sizes), in the
    colour wheel's order: red, orange, yellow, green, blue, purple, pink, then beige and brown,
    then white, grey and black, then "?" (FB-13, decided 2026-11-05).
  - A tap selects and saves at once, like every other value: a check mark plus a 2px
    `foreground` ring. "?" means the rasika didn't notice.
  - Below the grid, "Second colour" opens the same grid; "Remove second colour" appears once
    one is set.
  - Black, White and Grey always carry a 2px `ring` border, so they stand off the sheet in both
    themes.
  - On Stage and on the Artist sheet's Colours button, a two-tone outfit is one 20px circle,
    half and half, first colour on the left, so it reads as one outfit (FB-13, decided
    2026-11-05). It takes the ring border when either half is Black, White or Grey.
- **Finishing a Concert** (walkthrough S13, decided 2026-11-05, replacing "Done with this
  Concert" and the "What it added" card): there is nothing to tap. A Concert ends on its own, by
  its window and the hour's logging hold, and can always be edited, so there is nothing to
  reopen. Its **Concert summary** shows once, as a modal (shadcn Dialog), the next time the app
  opens or comes back after the Concert ends, then never again:
  - Its title is the Artists the Concert is known by, with the Sabha and date under it; then the
    Items and Ragas as two `display` numbers (Linked ragas counted once); then, when there are
    any, "First Raga" and "New Composer" with the names. With no Items there is nothing to say,
    and no modal. It does not link into the Wrapped.
  - It is due once the Concert is over by both clocks: an hour after its last Item changed on
    this phone, so a past Concert being filled in is never interrupted, and past its window, so
    a long piece with no logging never brings a summary of half a Concert. It waits while any
    Concert was logged in the last hour, so it never stands between the rasika and the next
    Item. One shows per open, the one that ended first.
  - "Shown" is kept per Event on this phone (`db.meta`) and never synced: a restored season shows
    none. It is written only once the summary has been read and is still due, just before it
    opens, so one that can't be read (or whose catalog is still opening, needed to count Linked
    ragas once) stays due for the next open. The first time a phone runs this, Concerts
    that had already ended, or were ended with the old "Done", are marked shown rather than
    shown. Otherwise a legacy "Done" in a logging note is read by nothing.
- **Status** (decided 2026-11-01, settling DD6's placement; narrowed 2026-11-03): until sync
  exists (Phase 7), home shows no status line, since every change would count as not backed up.
  With sync it shows one muted line under its title, "Saved on this phone · 4 changes not yet
  backed up" or "All backed up" (FR-016), which opens the sync details in Settings. While the
  app isn't ready for offline (a first download or an update still coming), home shows one muted
  line with a spinner, "Getting ready for offline…", which clears on its own; Settings always
  shows the state. The Event screen and Item editor show nothing while all is
  well. When something needs the rasika ("Sign in again", "This phone is no longer the writer"),
  one line with its action button appears under the top bar on every screen until it is
  resolved; it never covers or disables Add Item. Its exact wording is settled with the rest of
  the system messages.
- **Install** (eng review D15, drawn 2026-11-03): on a phone with the app open in a browser tab,
  every screen shows one persistent row under its title, with no dismiss. On iPhone it draws
  Safari's steps as marks (the Share glyph, then Add to Home Screen); on Android it has one
  Install button that opens the browser's prompt. Installed, or on a desktop, it shows nothing.
  Why it stays: Safari can clear a website's storage after 7 days without a visit, and leaves
  installed apps alone. On Season, Wrapped and Settings one tab header draws it 8px under the
  title, so it sits at the same place on each tab (FB-46): a 48px row with its hairline drawn
  inside, its text on the gutter. As built and accepted 2026-11-03:
  - **iPhone** (and iPad): "Add to Home Screen:", then Tabler IconShare2 (Safari's Share glyph),
    a small › for "then", and IconSquarePlus (Add to Home Screen). The marks grow with the text
    and wrap together. The row is read as "Install the app so your season stays on this phone.
    Tap Share, then Add to Home Screen."
  - **Android:** IconSquarePlus, "Install on this phone", and an Install button named "Install.
    Install the app so your season stays on this phone.", without Safari's steps. The row shows
    only while Chrome offers its install prompt; once the prompt is used (or before Chrome
    offers it), there is nothing to tap, so the row waits for the next offer.
  - Not on first launch or the rescue screen, which come before the app's own screens.

## Motion

Motion explains a change and is otherwise absent. One exception (the Maintainer, 2026-11-07): the motif on the
first-launch screens drifts slowly, back and forth, since nothing is being logged there ("The
motif"). Reopened 2026-11-04 by FB-30 ("fast but
finicky"): every change of place now moves, briefly, in CSS only, and nothing waits on it.

- Press feedback: 100ms. State changes (a value updating): 150ms ease-out.
- **Pushed screens** (decided 2026-11-04): going into an Event or an Item, the screen enters
  from 24px to the right at 60% opacity (from 40% it read as a blink, from 80% as a cut);
  coming back, from the left; 240ms, `cubic-bezier(0.32, 0.72, 0, 1)`, so the move is seen
  rather than over in its first 50ms. The bottom bar is the shell's and never moves, empties
  or shrinks (FB-45): while the next screen loads it keeps its last action, and when the action
  changes only the label fades in (150ms ease-out) inside the same button. The first screen, a
  tab switch and a move at the same depth (a first pick, Next Item) just appear. The page clips what slides
  past its sides, so a screen sliding in never widens it or scrolls it.
- **A dragged row** follows the finger with no easing; the rows it passes step aside over 200ms
  with the same curve, and the dropped row eases into its place. Reduced motion: rows jump.
- **A shadcn primitive wherever one exists, with its own motion** (walkthrough P9, FB-38,
  decided 2026-11-05): Sheet, Dialog, DropdownMenu and Accordion, so the parts look and move as
  one system. Hand-made parts stay only where shadcn has none (the docked search, the swatches,
  the drag).
- **Sheets** rise opaque from below the screen over 220ms with the same curve; only the scrim
  fades. A sheet never shows the page through it. Closing, it slides back down the same way
  (P8, FB-44): a screen keeps the sheet it last opened drawn while it closes, so it never just
  vanishes. A closing sheet takes no taps, and focus stays in a sheet opening as another closes.
- **Folds** are shadcn's Accordion (P8): opening grows to the content's height over 200ms with
  the same curve and closing shrinks back, so what's below slides rather than jumps; the chevron
  turns with it. A fold opens with what's in it when its screen opens; from then on only a tap
  opens or closes it, so emptying it never folds it away under the finger.
- **Something opening in place** (the Laya vinyasam's note under its row) grows to its height
  over 200ms as it fades in.
- **The "⋯" menu** fades and scales in from its button and out again (shadcn's 100ms), from a
  ghost icon button. **The Concert summary** fades and scales in the same way.
- **A swatch picked** settles from 88% and its check grows in (180ms) while the old ring fades
  out and the new one in (150ms), so nothing is ever unchosen; one ring goes out from it and
  fades (360ms): the pick's own confirmation, in view. Only a pick made in the sheet plays, not
  the swatch already chosen when the sheet opens.
- The save highlight: 1.2s, rising over its first 150ms and then fading (FB-28: starting at
  full strength read as a flash), drawn 8px past its block so the text inside keeps its edge.
  Where the change already shows itself, it doesn't play (see "Saving"; a failure still shows
  "Not saved"). The Undo bar: 5s, then it slides away.
- **Settings opens whole** (walkthrough P10, FB-41): measured on a 4x-slowed CPU, its Storage
  and offline rows painted 30-60ms after the page and pushed Export down (layout shift up to
  0.08). What it shows is read when the app opens and drawn from the first frame, re-asked
  behind it; a row still waiting keeps its 48px, so nothing under it moves.
- Under `prefers-reduced-motion: reduce`, nothing moves or grows, and the highlight still shows
  (it carries information), without the fade.
- _Proposed, with the Cards:_ one authored moment, a new stripe weaving into the season's
  fabric when a Concert is finished.

## Do's and Don'ts

**Do**

- Keep "Add Item" and the search box reachable with one thumb at every moment of a Concert.
- Use the glossary's words (Concert, Item, Raga, Appearance, Sabha) in every label.
- Write system messages plainly and briefly, with no exclamation marks.
- Give every Detail state, swatch and icon-only control an accessible name.
- Prefer a mark to a sentence: where an icon, the motif or a familiar shape explains what to
  do, cut the words from the screen. The words move into the accessible name, so VoiceOver and
  TalkBack still read them.

**Don't**

- Don't flash white in dark mode, on launch or between screens.
- Don't use rose, or any accent colour, outside charts and the motif.
- Don't put Colours, the note or sync status between the rasika and the next Item.
- Don't show a toast for a save, a spinner for local work, or a confirmation for a delete.
- Don't autofocus anything except the Item editor's search box.
- Don't mix fonts within a name, and don't show diacritics or karnatik's coding in catalog names.

## Messages

Every system message on the logging screens, drafted 2026-11-01 for the Maintainer to edit
(D28). Builders copy these strings rather than writing their own; tests may assert them. The
voice: plain, short, the glossary's words, no exclamation marks, never blaming the rasika.

| Where                        | When                                                                                                                                                                                                           | Text                                                                                                                                                                                                                      | Action                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Welcome                      | First launch                                                                                                                                                                                                   | **Carnatic Wrapped** · "Log the Concerts you attend this December, even with no signal, and see your season whole."                                                                                                       | Continue with Google       |
| Sign-in                      | Cancelled                                                                                                                                                                                                      | "Sign-in was cancelled. You need to sign in once before logging."                                                                                                                                                         | Try again                  |
| Sign-in                      | No signal                                                                                                                                                                                                      | "No signal. Sign-in needs a connection, once, on this phone."                                                                                                                                                             | Try again                  |
| Sign-in                      | Google error                                                                                                                                                                                                   | "Google couldn't sign you in just now."                                                                                                                                                                                   | Try again                  |
| Consent 1 (FR-042)           | Question                                                                                                                                                                                                       | "Share the Artists, Sabhas and Concerts you add by hand with the person who keeps the shared lists?"                                                                                                                      | Yes · No                   |
| Consent 1                    | Reason line                                                                                                                                                                                                    | "Only the names, with a count of how many rasikas added them. Never who you are or what you logged. You can change this in Settings."                                                                                     |                            |
| Consent 2 (FR-049)           | Question                                                                                                                                                                                                       | "Include your season, without your name, in reports about the whole December season?"                                                                                                                                     | Yes · No                   |
| Consent 2                    | Reason line                                                                                                                                                                                                    | "Reports show totals across rasikas, never one person's log. You can change this in Settings."                                                                                                                            |                            |
| Getting ready                | Downloading                                                                                                                                                                                                    | "Getting ready to log offline…" with a progress bar                                                                                                                                                                       |                            |
| Getting ready                | Done                                                                                                                                                                                                           | "Ready to log offline."                                                                                                                                                                                                   | Start                      |
| Getting ready                | Stopped                                                                                                                                                                                                        | "The download stopped. Logging needs it once, with a connection."                                                                                                                                                         | Try again                  |
| Getting ready                | No service worker (Firefox private mode)                                                                                                                                                                       | "Offline logging isn't available in this browser. You can still log while you have signal."                                                                                                                               | Start                      |
| Home status                  | Changes waiting, once sync exists (Phase 7)                                                                                                                                                                    | "Saved on this phone · 4 changes not yet backed up"                                                                                                                                                                       | (opens sync details)       |
| Home                         | Not ready for offline yet; clears on its own                                                                                                                                                                   | "Getting ready for offline…" (muted, a spinner)                                                                                                                                                                           |                            |
| Any screen, top              | Open in a phone's browser tab, not installed                                                                                                                                                                   | iPhone: "Add to Home Screen:" with the Share and Add marks. Android: the Add mark and "Install on this phone". Accessible name: "Install the app so your season stays on this phone. Tap Share, then Add to Home Screen." | Install (Android)          |
| Any screen, top              | Android's Install button, its name after "Install."                                                                                                                                                            | "Install the app so your season stays on this phone."                                                                                                                                                                     |                            |
| Settings                     | Offline readiness                                                                                                                                                                                              | "Ready offline" · not ready: "Getting ready for offline…" · amber, no service worker: "Offline logging isn't available in this browser. You can still log while you have signal."                                         |                            |
| Settings                     | Persisted storage                                                                                                                                                                                              | "Storage protected" · amber: "Storage not protected"                                                                                                                                                                      |                            |
| Settings                     | Export                                                                                                                                                                                                         | "Export" with "Last: 2 Nov", or "—" before the first; after a handover its name begins "Exported"                                                                                                                         | Export                     |
| Settings                     | Versions, small and muted, each label before its version                                                                                                                                                       | "App" · "Catalog"                                                                                                                                                                                                         |                            |
| Home status                  | All synced                                                                                                                                                                                                     | "All backed up"                                                                                                                                                                                                           |                            |
| Any screen                   | Session ended (FR-050)                                                                                                                                                                                         | "Sign in again to keep backing up. Logging still works."                                                                                                                                                                  | Sign in                    |
| Any screen                   | Another phone writes (FR-022)                                                                                                                                                                                  | "Your season is now being logged on another phone. Changes here are kept."                                                                                                                                                | Details                    |
| Item or Event                | Save failed. An icon-led row: the alert mark and the short label; Try again, Export and Clear are icon buttons whose names carry the sentence. Clear only after an Export, and it asks first                   | "Not saved" · "Not saved on this phone."                                                                                                                                                                                  | Try again · Export · Clear |
| Item                         | A move failed; never retried, the rasika moves it again                                                                                                                                                        | "Not moved" · "Not moved on this phone."                                                                                                                                                                                  | Dismiss                    |
| Any screen, top              | The phone can't keep a copy of values entered (storage full or blocked), or a value's copy failed and only memory holds it                                                                                     | "Not kept on this phone" · "This phone can't keep a copy of what you enter until it's saved. Export now to keep it."                                                                                                      | Export                     |
| Reload screen                | A newer version of the app opened the store in another tab; this tab no longer writes. The alert mark above the title                                                                                          | "A newer version is open in another tab"                                                                                                                                                                                  | Reload · Export            |
| Reload screen                | A reload would lose values only memory holds: Reload asks first, and a second tap reloads                                                                                                                      | "Reloading loses what isn't kept. Export it first."                                                                                                                                                                       | Reload anyway              |
| Rescue screen                | The same, for Try again                                                                                                                                                                                        | "Reloading loses what isn't kept. Export it first."                                                                                                                                                                       | Try again anyway           |
| Home                         | An update is ready, and applying it would lose values only memory holds: Update asks first                                                                                                                     | "Reloading loses what isn't kept. Export it first."                                                                                                                                                                       | Update anyway              |
| Any screen, top              | An Export from "Still opening" timed out: the file holds only the changes not saved, and gets no check badge                                                                                                   | The Export's name, after Export: "This Export holds only the changes not saved. Your season was still opening; export again once it opens."                                                                               | Export                     |
| Item, Artist, any screen top | A delete failed; Try again deletes it and offers Undo, Dismiss keeps it. At the top it is named by what it was, as Not deleted · Concert, Mon 2 Nov                                                            | "Not deleted" · "Not deleted on this phone."                                                                                                                                                                              | Try again · Dismiss        |
| Item                         | A repick failed; never retried, the pick is kept for Export                                                                                                                                                    | "Not changed" · "Not changed on this phone."                                                                                                                                                                              | Export · Dismiss           |
| Any screen, top              | Failures no field on screen shows (a new Concert, Start logging, an added Artist, values from before a relaunch). One is named by what it was, as Not saved · Concert, Mon 2 Nov, 9:17 am; several are counted | "2 not saved" · "2 changes not saved on this phone."                                                                                                                                                                      | Try again · Export · Clear |
| Clear's sheet                | Before Clear removes anything                                                                                                                                                                                  | "Is the Export saved where you can find it?" · "Clearing removes 2 changes from this phone."                                                                                                                              | Yes, clear · Not yet       |
| Any screen, top              | The Export file can't be made at all                                                                                                                                                                           | "Export failed" · "The Export couldn't be made on this phone."                                                                                                                                                            | Try again                  |
| Export button                | Handed over: a check on the button; from a store that couldn't be read, its name says so                                                                                                                       | "Exported" · "This Export holds only the changes not saved. The stored season couldn't be read; it's still on this phone."                                                                                                |                            |
| Any screen, top              | The phone's database is still opening after 10 s; the screen stays                                                                                                                                             | "Still opening your season…"                                                                                                                                                                                              | Export                     |
| Rescue screen                | The phone's database won't open; the alert mark above the title                                                                                                                                                | "Can't open your season"                                                                                                                                                                                                  | Try again · Export         |
| Home                         | New catalog (FR-038)                                                                                                                                                                                           | "An updated song catalog is ready."                                                                                                                                                                                       | Update · Later             |
| Item search                  | No match                                                                                                                                                                                                       | "No match in the catalog"                                                                                                                                                                                                 |                            |
| Item search                  | No catalog                                                                                                                                                                                                     | "Catalog not on this phone yet. What you type is kept and can be matched later in Tidy."                                                                                                                                  |                            |
| Undo bar                     | After a delete                                                                                                                                                                                                 | "Item 5 deleted" (or "Artist removed", "Concert deleted")                                                                                                                                                                 | Undo                       |
| Undo bar                     | The Undo itself failed to save. Only the newest failed bar shows, with "+1" for older ones                                                                                                                     | "Undo failed · Concert" (or "Item 5", "Artist") · "Undo failed: Concert. Not saved on this phone." · "+1"                                                                                                                 | Try again · Dismiss        |
| Undo bar                     | A rule refuses the Undo                                                                                                                                                                                        | "Undo failed · Artist · a Lecdem has at most 3 presenters" · "Undo failed: Artist, a Lecdem has at most 3 presenters."                                                                                                    | Try again · Dismiss        |
| Undo bar                     | The Item's or Artist's Concert is deleted                                                                                                                                                                      | "Undo failed · Item 3 · its Concert is deleted" · "Undo failed: Item 3, its Concert is deleted."                                                                                                                          | Dismiss                    |
| Screen reader                | After a delete                                                                                                                                                                                                 | "Item 5 deleted. Undo available."                                                                                                                                                                                         |                            |
| Screen reader                | Search pauses                                                                                                                                                                                                  | "5 results" / "No matches"                                                                                                                                                                                                |                            |

## Still open

Deferred by the design review of 2026-11-01 (D1: the logging screens first; the rest is designed
in the phase that builds it):

- "Did you go?" for past Planned Events never opened (finding 8): with the Plan screen, T056.
- "Ready for offline" covering share images as well as logging (finding 9): with the Cards.
- The restore banner (finding 10) and the conflict screen (finding 11): with sync, US2.
- The Card template: safe zones, one headline per Card, the wordmark, the white swatch, minimum
  data, the empty Wrapped (finding 12), and the outfit swatches' final tuning: T088 to T096.
- Smaller states: consent toggles offline (with Settings, T082), Share in progress or failed
  (with the Cards). Cancelled and "schedule changed" are marked, and the hint answered (2026-11-07).
- The Lecdem variant of the Event screen (T063). The kind and title are already set in the
  Event's facts (T122).
- The Maintainer's edits to the drafted Messages table above, and the wording of messages for
  the screens deferred here.
- The product's name and where its logo appears (deferred 2026-11-01: the Maintainer is
  considering other names; a logo will appear somewhere). "Carnatic Wrapped" stays the working
  name until then. The mark itself is settled ("The mark", 2026-11-10).
- The motif's remaining uses (T088a): the ground of the Wrapped cards and what the
  Season shelf holds beyond its title. The motif itself was settled on 2026-11-07.

## Decisions Log

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-31 | Preset `b51rn04Qt`; shadcn/ui and Tailwind (ADR 0006); Source Sans 3 everywhere; rose for charts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-11-01 | Warm text; dark by default; the six Detail states; screen behaviour (save, delete, reorder, colour sheet, finishing a Concert); plain English names.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-01 | Preview of the Event screen and Item editor approved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-11-01 | Tokens: 17px body on a 13–32 scale, 4px spacing, 48px targets and 56px main actions, the motion rules.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-01 | Design review (`/plan-design-review`, D3 to D29): Now and Done, the Event and Item editor bars, top bars, first launch, states, save failure, Undo, rows not cards, softened dark text, larger text, focus, Detail input, pickers, Colour sheet, Messages. The record is in `specs/001-season-logger/reviews.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-11-02 | Review of PR #5, the Maintainer's answers: "2 changes not saved on this phone." at the top of any screen for failures no field shows; "The Export couldn't be made on this phone."; "Offline logging isn't available in this browser. You can still log while you have signal." with Start; a failed Undo keeps its bar ("Concert deleted. Not saved on this phone." with Try again); failed values also copied to localStorage for Export after a relaunch; at 150% text and up, the Item search's form chips scroll in one row.                                                                                                                                                                                                                                                                                                            |
| 2026-11-02 | Second review of PR #5, the Maintainer's answers: "Clear" after an Export for values Try again can't save; the rescue screen when the store won't open, and the `-store-unreadable` Export with its line; a failed Undo stays, with "Dismiss", and a new Undo bar stacks under it; a rule's refusal shown on the bar; a failure in an open sheet shows in the sheet. With the same review, the form chips scroll in one row whenever they don't fit, decided by the row itself rather than the text size (Android scales text by zoom); the light `destructive` darkened from 0.577 to 0.55 lightness, so it passes AA on surface-raised (4.6:1); the season-wide line moved under the top bar (under the title on home and Settings).                                                                                                       |
| 2026-11-02 | Third review of PR #5, the Maintainer's answers: the rescue model simplified to one journal (docs/adr/0007); icon-led safety rows (Tabler IconAlertCircle, IconRefresh, IconDownload, IconTrash, IconX) with the short labels "Not saved", "Not moved", "Not changed", "Export failed"; Clear asks "Is the Export saved where you can find it?"; the rescue screen "Can't open your season" with a check on Export; "Still opening your season…"; only the newest failed Undo bar, with "+1"; "Can't undo: its Concert is deleted".                                                                                                                                                                                                                                                                                                          |
| 2026-11-02 | After the round-3 screenshots, the Maintainer's answers: a failed Undo bar names what failed, "Undo failed · Item 2" (not "Item 2 deleted" in red), and never covers a field; "Still opening your season…" is muted, with a spinner and no alert mark; after an Export the download icon stays the button, with a small check badge that is no button of its own, on the rows and the rescue screen.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-02 | Fourth review of PR #5, the Maintainer's answers: fixed by class, not per finding; a failed delete reads "Not deleted" ("Not deleted · Concert, Mon 2 Nov"), and its Try again deletes and offers Undo; a row shows one kind of failure; Dismiss acts only on moves and repicks; "Not kept on this phone" when the phone can't keep a copy of values entered; an Export from "Still opening" that times out is named `-not-saved`, marked `storeTimedOut`, and gets no check badge.                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-02 | Direction, not yet designed: the ethereal rose motif, generated per Concert from its instruments, is the logo and the ground of the Cards, and stays out of the logging surfaces. "Prefer a mark to a sentence." Rose is allowed in the motif as well as charts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-11-03 | After the round-4 screenshots, the Maintainer's answer: a "Not deleted" row offers Try again and Dismiss, not Export; Dismiss keeps the record after all, taking only the delete entry and leaving the store as it is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-03 | Phase 4 design, the Maintainer's answers: Export lives in Settings, with its last date, and the Event's "⋯" keeps only Delete; home shows no status line until sync, and only "Getting ready for offline…" while the app isn't ready; the install row is persistent and drawn as Safari's marks on iPhone and an Install button on Android; Settings puts the season first (offline, storage protected, Export), then the theme, then the versions.                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-04 | The iPhone walkthrough's shape decisions S1 to S12 (`docs/feedback/2026-11-iphone-walkthrough.md`): "+ Log a Concert" always in the Season page's bottom bar, the open Concert a card; Events known by their vocal, veena or flute Artists (a Lecdem's presenters), the Sabha, date and time on the line under them; the Event screen runs heading, Stage, Note, Items; Stage listed by Role with no "Edit order"; an Artist's name corrected from their sheet, the old name kept as an Alias; the usual Role chosen for a known Artist; "Remove" with the bin mark; Role chips capitalised; Done the filled main button at the right of the Item editor's bar; "Item 8" an eyebrow; more room under a field's label and a taller facts line; "Running order" now "Items".                                                                   |
| 2026-11-03 | After the Phase 4 screenshots, the Maintainer's answers: the Settings Export row is never amber; Android's install row leads with the same Add mark as the iPhone row; accepted as built: Android's Install button named without Safari's steps, the row hidden while Chrome offers no install, the › between the iPhone marks, the amber `warning` token (oklch(0.8 0.15 75) dark, oklch(0.53 0.12 62) light), "Getting ready for offline…" with a muted spinner and an amber row where there is no service worker, and the "App" and "Catalog" version lines.                                                                                                                                                                                                                                                                              |
| 2026-11-04 | The UI hill-climb (FB-30, themes 3 and 4), as built for the Maintainer to check on the iPhone: line heights on the 4px grid; 64px and 48px rows with the hairline drawn inside; section labels 32px under the block above; text on the 16px gutter with fills reaching past it; pushed screens and sheets that move; folds that grow open; a softer save highlight (FB-28); the Laya vinyasam as a mark in Item rows (FB-27); Raga results on one line; the facts sheet's date and time written as the app writes them ("Mon 14 Dec", "6:00 pm") over the phone's own pickers; the Artist sheet's Colours button showing the colours.                                                                                                                                                                                                        |
| 2026-11-05 | The iPhone walkthrough's second pass (FB-31 to FB-44), agreed: no "Done with this Concert"; a Concert ends on its own and its summary shows once as a modal on the next open after it ends (S13); one Improvised fold with the Laya vinyasam as a row (S14). The builder's calls, P1 to P10: Done on the Item page stays; one row style for every value (muted label, underlined value, weight and contrast for importance, a muted "+" to add); chips only for short fixed sets; forms in sentence case; the Item kinds' hairline 8px under them; the Note in a fold, open when it has text; no save highlight on chips, toggles, typed text or a dropped row; sheets slide back down and folds are shadcn's Accordion; shadcn primitives with their motion, the "⋯" menu fading and scaling in; Settings drawn whole from its first frame. |
| 2026-11-05 | The Maintainer's answers on the hill-climb's parked choices: Season's title stays smaller than its section heads (DESIGN.md's type roles, as written); Edit order rows hold one line each; Items reorder by dragging a grip, the arrows kept for VoiceOver (FB-26); the Laya vinyasam's Nadai behind "+ Nadai" (FB-29); a two-tone outfit as one circle, half and half (FB-13). The Colour sheet keeps its circles, in the colour wheel's order; a fuller picker (a shade square under a hue strip) is planned as T118, since twelve colours may prove too few.                                                                                                                                                                                                                                                                              |
| 2026-11-06 | The bottom bar is one frame owned by the shell, kept across Season, Concert and Item (FB-45, the flicker on every screen change): a screen supplies only its action, the bar keeps the last one while the next screen loads, and a changed action fades in its label alone (150ms). No whole-bar fade. |
| 2026-11-06 | The schedule-feed decisions (T057): Event kinds Dance and Harikatha; Roles Vocal support, Nagaswaram, Thavil, Mandolin, Chitravina, Saxophone, Dancer and Nattuvangam, with the common Roles first in the Role chips and the rest behind "More"; a Group billed together shows by its name on the Event heading, the Event rows and the Schedule card, while each member keeps their own Appearance. The builder's calls, for the Maintainer to check: where the new Roles sit in Stage order, which ten chips count as common, Dancer and Nattuvangam in the first row at a Dance, and which Roles an Event is known by. |
| 2026-11-07 | The Maintainer's answers for the Schedule (T061): it opens from a calendar icon button beside Season's "Next" heading, as a pushed screen grouped by day with the D5 top bar; each entry is a card with an empty tile at its leading edge kept for the motif, the title, the billed Artists or group, the Sabha and the time, and an add button that puts it in Next as Planned. A cancelled entry stays on its day, dimmed, with a cancelled mark and no add button; a Planned Event whose entry is cancelled stays in Next, marked, until the rasika removes it, so Season no longer hides it. The builder's calls, for the Maintainer to check: Next shows once a Schedule is stored, for its button; a cancelled card gives up its fill for an outline; the marks are Tabler's calendar-x and calendar-exclamation; an added entry's button becomes a check that opens the Event; the Schedule lists from today on; an Event the rasika changed is shown cancelled from its entry while its stored `cancelled` stays false. |
| 2026-11-07 | The Maintainer's answer for the "schedule changed" hint: tapping it opens a sheet of what changed, old beside new, only the fields that differ (date, time, Sabha, kind, title, billed Artists), with two icon-first buttons. "Take it" gives the Event the version's values, in one transaction, its rules checked; "keep mine" changes nothing and clears the hint until a newer version. The builder's calls, for the Maintainer to check: the hint is its own 48px button beside the row; field marks are Tabler's calendar, clock, building-community, category, letter-t and users; a value the version leaves null (time, title) or a version billing no one names nothing, so the rasika's stays; a billed Artist dropped by the version is removed unless the rasika gave them a Colour, when they stay unbilled; "Keep mine" is an outline button with an X, "Take it" the primary with a check. Settled the same day: an Attended or Missed Event never gets the hint; a later version leaves it alone. After the PR #25 review: the hint shows on a cancelled row too, and the sheet lists cancelled or reinstated as a row (Tabler's ban as its mark, calendar-x and calendar-check as its values); a cancelled Planned Event stays in Next past its start time until deleted, and is never Now. |
| 2026-11-06 | T119 to T122, the builder's calls: an Event's kind is a mark before its name on the Season rows and the Event heading, none for a Concert (Presentation for a Lecdem, a figure in movement for a Dance, a book for a Harikatha); the kind is four chips at the top of the Event's facts sheet, which takes the kind's name as its title, with a Title field under them for any kind but a Concert; a title reads first on the facts line, above the Sabha; a change to Concert that takes a title offers "Title removed · Undo" as a delete does; "More" opens in place and stays open; a Group shows by its name only where two or more of the known-by Artists share it. |
| 2026-11-07 | The motif, settled with the Maintainer after three boards: Paper Shaders' static mesh gradient (its shader copied in under Apache-2.0, no package) in Ink and rose, seeded from the rasika's data, one shared WebGL2 context drawing still canvases. Placed as a curtain on Season and the Concert summary's top edge, a horizon on first launch, and the main billed Artist's avatar on the Schedule card's tile; not on Artist rows or any logging surface. One council round (Codex and two Claude reviewers; 6.2, 6 and 5) agreed on a shorter curtain, a quieter day one, no glare or black stops, neutral greys, one soft rendering for avatars, a longer fade on first launch, no top strip, less grain and a grey backdrop behind the summary; all built and checked. The builder's calls: the title on the curtain is `heading`; in a phone's browser tab, where the install row shows, Season keeps its plain title until installed (FB-46 keeps that row at one place on every tab); a card with nobody billed keeps a plain tile; the season's field waits for the catalog and fades in over 300ms. |
| 2026-11-07 | First launch's mark: Silk, picked from four bolder fields (Bloom horizon, Ribbon block, Full bleed, Silk), kept sharp, and moving: its folds drift back and forth on 11, 14 and 19 second periods, the one moving mark and the one exception to "motion explains a change". About 0.4 KB; reduced motion holds it still. Season's colours follow the Ragas logged (the three most heard, a second rose at three), not the day or the number of Concerts. |
| 2026-11-08 | First launch's fades made invisible where they stop (the Maintainer: the line where the black fade ends showed). The silk's dissolve and the scrim behind the words were straight ramps with corners, and the scrim began where the dissolve was steepest, so a shelf showed. Both are now eased (smoothstep, a dozen stops: no slope at either end); the silk's box is 80% of the screen (was 74%), still whole to 45% of its height, so its tail reaches the words; the scrim rises over 192px (was 64px). Measured at 390px: the sharpest bend in the fade falls from 0.163 to 0.136 L* per px² in dark at 100% text, and from 0.449 to 0.103 at 200%; contrast at 200% text holds at 13.75:1 dark, 18.08:1 light (320px). Three council rounds (Codex and two Claude reviewers): lowest scores 6.5, 6, 6.5, every reviewer agreeing no edge shows. Parked for the Maintainer: a curved foot (a second, elliptical mask so the sides lift). |
| 2026-11-08 | The Maintainer: adding a Concert that isn't on the Schedule is now secondary, and the Schedule should be easy to scroll without goading anyone to add. Season becomes one timeline of the whole Season in date order (the days gone above, opening at the header and Now), each day the rasika's own Events then the Schedule's other entries, quieter, with no button on a row; an entry's sheet holds its billing and one add. Next, Season so far, the Schedule screen and its calendar button go; `/schedule` goes to Season. The "+ Log a Concert" bottom bar goes, in every state, for a 48px + at the Season title's right. A Concert made by the + and left with nothing entered leaves no trace. The builder's calls: the header sits between the days gone and today, so the page opens on it with the + in view; the Now card stays under the header; the "Your Wrapped" row went with Season so far (the Wrapped tab remains); entries carry no avatar tile; an untouched new Concert is still made at once and taken back on leaving if the journal and the store show nothing entered (`app/src/screens/new-concert.ts`). |
| 2026-11-08 | The Maintainer, on the live build: "Nothing above the curtain." Season always opens at its very top, the curtain and its title first; the days gone no longer sit above the header and the page never opens scrolled down. They go behind one quiet "Earlier · N" row under the curtain and status rows, above Now, that opens them in place, newest first, and closes them again; it stays as it was coming back from an Event, starts closed at each launch, and isn't there with no days gone. The + stays at the title's right for now. The builder's calls: a history mark and a turning chevron; N counts the days gone with anything in them; the hold that opened the page at the header goes, and the one that brings the rasika back to their place stays, now holding on through a page too short to reach that place while the days above still sit at their likely heights (it had let go there, mistaking the page's stop for the rasika's scroll).                                                                                                                                                                                                                                                                                                                                             |
| 2026-11-09 | The Maintainer, reversing the Earlier row of 2026-11-08: the top of the sheet is prime space, kept for the add or something important. The row and its open/closed state go; the sheet starts at the status rows, then Now, then today and the days ahead, and still opens at its top. The days gone are a page of their own (`/earlier`), opened from a history mark in the curtain's title row just left of the +, at its size and tap, hidden with no days gone; newest first, the rasika's own Events then the past listings, quieter, as on Season, each listing's sheet as on Season. Back returns to Season where it was left; an Event opened from the page goes back to it, where it was left, held while its days draw. The builder's calls: the mark is spoken "Earlier", for the page, with no count; the page's bar and title follow a pushed screen's; it sits between Season and an Event in the motion's depth; where a page was left is noted as it goes, not as it scrolls, so a tap made in the frame a scroll ends in still finds it; with days gone and nothing ahead, Season shows its empty mark, spoken "Nothing ahead".                                                                                                                                                              |
| 2026-11-09 | The Maintainer, from a product view, replacing the endless timeline and the Earlier page of the same day: the scroll was hard to parse; people care most about today, then the days coming, only now and then the past, and picking concerts by Artist or Sabha must be dead easy. Under the curtain, three tabs, Today (Now's card, then today) · Coming (from tomorrow) · Past (newest day first), opening on Today when anything is on today, else on Coming; own Events first in each day, listings quieter. One box, "Artist or Sabha…", suggests billed Artists, groups and Sabhas with their Aliases from this Season's Schedule and own Events; a pick is a removable chip; one sort widens, sorts mixed narrow; quick chips Mine, Dance, Lecdem, Harikatha (each kind only when the Schedule has it); every filter in every tab and on own Events. The history mark, the Earlier page and its back go; `/earlier` opens Past; an Event's back returns to its tab and place. The + stays at the title's right. The builder's calls: tabs drawn as the app's tab bar, with match counts only while filtering; the chips wrap under the box, quick ones first; Mine only with a Schedule; Now's card stays on Today under any filter; an emptied tab says "Nothing here matches." with "Clear filters"; filters last for the app's life, not across launches; with nothing in the Season, no tabs or filter; the + comes back on Today. One council round at 390px (Codex 8.9, Claude reviewers 7 and 6) built two fixes: the suggestions on a filled list laid over the page, and the filter's chips that are on filled in ink. |
| 2026-11-09 | The Maintainer, choosing option C of three mockups, replacing the Today · Coming · Past tabs of the same day. The curtain stops being a title: the hero always shows the rasika's own Event on now, else their next Planned one, large (known-by, Sabha, time, Item count), tapped to open it, so logging starts there; it replaces the Now card. The + stays at its top right. A strip of days replaces the tabs at the top of the sheet: Past · Today · each date ahead with anything on; the list runs from today on, own Events first in each day, listings quieter; a tapped date jumps to its day, and as the rasika scrolls the strip marks the day in view, with sticky day labels, keeping the week's scan; Past shows the days gone, newest first, in place, and Today brings the list back. With a filter on, dates without a match leave the strip and Past shows only with one; "Nothing here matches" with "Clear filters" stays. Back from an Event returns to the same place, past or ahead; `/earlier` opens Past. The filter, its chips and alias matching are kept. The builder's calls: "Now" or "Next" over the hero's title; a long known-by wraps at the same size; with nothing of the rasika's ahead, the "Season" title; the hero's Event also stays in its day; the strip pinned, its stops 48px pills, the day in view filled in ink as the chips that are on; a tapped day stays marked until the rasika scrolls; Today marked at the list's start; Past kept on the strip while shown; jumps made at once; the hero never filtered; the + comes back from today. One council round at 390px (Codex 8.6, Claude reviewers 6 and 6) built four fixes: room under the last day so a jump always lands under the strip (which also ends a stale day label stacked under it), "Today" in a Next hero's line, strip stops marked by fill alone at one size and weight, and the suggestions list shadowed in light. |
| 2026-11-09 | The Maintainer's review of option C, choosing a mockup. The strip loses its line and its pills: slim dates (a small weekday over the number), the day in view a heavier number over a small ink dot, Past as text at its left, real room on the 8px grid, and once pinned the list fades out under it. A calendar at its right end, pinned with it, opens a month sheet: a dot on each day with anything on (only matching days with a filter on), months paging sideways with past ones reachable, a tap jumping the list (or opening Past for a day gone) and closing the sheet. The hero goes on a two-column grid, the content and a 24px column: "Now"/"Next" with the + in the column, the title with a chevron in the column centred on its first line, then the line; the + and chevron share one right edge, and all but the + opens the Event. Search moves to the bottom, Maps-style: one rounded "Artist or Sabha…" bar above the tab bar on Season, opening a sheet with the field, the suggestions (picked ones ticked) and Mine and the kinds as text toggles; with a filter on the bar reads it as text with one x that clears it all; the in-page box and every chip go. The widen and narrow rules, strip pruning and "Nothing here matches" / "Clear filters" stay. The builder's calls: the search sheet as tall as its content, field focused on open, a pick closing it; the bar's first two parts then "+N"; the bar on surface-raised in dark too; the calendar a month tall, Monday first, only days on tappable; the strip's month shown where it turns; the bar kept while Season loads, so the place held on return never moves. One council round at 390px (Codex 8.8 with no fixes, Claude reviewers 6.5 and 6) built seven: the stuck day label fades the rows passing under it; a strip stop's focus ring only from the keyboard, rounded and inside; no line over the search bar, the list fading above it; the bar shows only whole names then "+N"; the calendar's month on the gutter with its arrows together at the right; the search sheet without a title, 85% tall, the Season's names A to Z under the picks to browse. |
| 2026-11-09 | The Maintainer, from mockups, for the strip: no dot and no pill under the chosen day, but style B, "time fades": each stop's ink follows time (Past faint, Today full, each day ahead fainter by about 0.13 a day), the chosen day in full ink and 500, over a brief 250ms change, none with reduced motion. The builder's call, from the contrast check asked for: Past at 0.6 and the floor ahead at 0.65, not 0.3 and 0.35, since 0.6 is the least that keeps the number at 4.5:1 in both themes (4.7:1 light, 5.4:1 dark); the weekday in the text colour, so the stop's one ink governs both lines. |
| 2026-11-09 | Five bugs from the Maintainer's iPhone, fixed at the root. The hero takes the rasika's soonest Event still to start whatever its state, not only a Planned one, so it and the list's first own row never name two different concerts. A date tapped on the strip or the calendar starts the list at that day and takes the page back to its top, so the hero stays where it is and the same tap lands the same way from anywhere; the room kept under the last day for jumps goes. A stuck day label fades the rows under it by how far they have passed, none for a day resting just under the strip. The search sheet's toggles hold the check's room and the 600 width either way, the check after the word, 8px apart, so one turned on moves nothing and all four fit at 390px. The Artist and Sabha pickers offer the names the Season's Schedule prints that no list holds yet. |
| 2026-11-09 | Withdrawn, the same day: one day at a time (the structure mockups' option C, Morning · Afternoon · Evening bands, the rasika's own Events as cards in their slot, a line at now, a swipe between days, Past off the strip) was built and the Maintainer took it back on seeing it: the problem was never a sense of time, which Now and Next already give, and the time line and the highlighted card were not wanted. Season returns to the timeline above, with the five iPhone fixes kept. What the schedule is for goes back to product discovery first. |
| 2026-11-10 | The mark, from four directions riffing on a floral rosette (tala, kolam, padma, swara; the kolam chosen) and then three single-line kolams (13, 17 and 21 dots; the 13 chosen): a sikku kolam on rows 1-3-5-3-1, built as a mirror curve, the line always √2⁄4 s from the dots. The app icon is that kolam in white glass on a plain ink tile, blushing to rose toward the lower right, lifted by soft shadows, its rim strongest on the left and fading out to the right (the Maintainer, after rose glass: no red glow, more white, more lift). The favicon stays the red five-dot cut. |
| 2026-11-10 | The Maintainer, on violin concerts: violinists lead a Concert that bills no singer or lead instrument, as equals, never as fallbacks ("they shouldn't be fallbacks though right. Some of them are equal"), so the Akkarai Sisters or Ganesh and Kumaresh read as both names. Someone the Schedule credits as support (`support: true`, as 11 Nov at Madhuradhwani, "Violin with support") never names the Event but stays on Stage in their Role. |
| 2026-11-10 | The Maintainer's three fixes on the live build. Season's search bar takes the search field's shape (14px corners, the mark 12px in, the text at 40px) in place of a fully round pill: it "looks too different" from the other search bars; Mine and the kinds stay text toggles, unlike the Item chips. A fast fling from one day to the next no longer runs rows over the day's label: the rows, not the day, skip drawing while far from the screen, since Safari moves a sticky label inside paint containment only once a fling's frame is done. On an Event, the "Add Artist" row under Stage goes, and a + at the right of Stage's heading opens the Artist picker, spoken "Add Artist". The builder's call: its 48px reaches past the heading's line, which keeps its height. Asked for as a pencil; one council round at 390px (Codex 7.8, Claude reviewers 8 and 7) agreed that a pencil reads as editing while it opens Add Artist, and the Maintainer chose the + they offered. |
| 2026-11-11 | The Season spine, the Maintainer's decisions on the approved design (docs/designs/season-spine.md): tabs Season · Shortlist · Diary, Settings a mark on the hub; "Interested" is Shortlist and the heard concerts' tab the Diary, "Wrapped" kept for the stats and Cards to come; What's on one tap below Season, never a tab; only the hub has a curtain; exactly three chevrons on the hub (+N more, the Shortlist tile, the Diary block), none on the hero or rows; the install row a thin strip above the tab bar on every tab; the hub's curtain under the iOS status bar and the band painted in each other screen's surface; shadcn Empty for true empties; the shared parts built once; each tab its own back stack, the tab bar kept on an Event, the active tab back to its top. ADR 0010 keeps `planned` as the stored word for Shortlisted and keeps Missed, hidden; ADR 0011 reads a concert's type from its billing. |
