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
  list-row-height: '68px two lines, 88px three, 48px one'
  fill-edge: '8px'
  text-edge: '24px'
  fill-radius: '16px'
  row-padding: '12px'
  section-gap: '32px'
  label-gap: '8px'
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
- **Depth by lightness, not shadow** (dark): background → panel (a section's rows, the
  quietest step: "The section pattern") → surface (the Now card) → surface-raised (chips, the
  search field, the best search match, sheets). List rows have no fill (Shapes). On a sheet, the
  search results' panel is the page colour, one step under the sheet (docs/design/search.md,
  2026-11-17); in light it is `panel` on a sheet too (decided 2026-11-17).

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
canvas, so a Schedule of forty cards opens one context, and nothing else animates or keeps
running (first launch's Silk is the one moving mark).
Each mark is softened by a CSS blur of 7% of its shorter side (Safari has no canvas filter),
drawn larger than its box and clipped, to smooth the seams where two tones meet. Each colour's
distance is softened at its centre (√(d² + 0.03²)), since Paper's mesh spikes to a sharp point
there, which showed as a pinch, a bright dot under a dark notch, wherever Silk's folds swept over
a centre (2026-11-21). The shader runs at `highp`: at sharp mixing its weights overflow a phone
GPU's 16-bit `mediump`. No grain. With no WebGL2 nothing is drawn and the surface under it shows. About 4.5 KB of the first
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
  soft rendering. Bowed (violin, viola, dance): one long fold. Plucked (veena, chitravina,
  madhuraveena, mandolin, guitar, keyboard, piano, sitar, sarod, santoor, jalatarangam): ripples. Struck
  (mridangam, ghatam, kanjira, morsing, thavil, tabla, konnakol, nattuvangam): several small
  glows, like beats. Breath (voice, flute, nagaswaram, saxophone, clarinet, harmonium,
  presenter): one soft swell.
- **First launch's field** (the logo is the kolam, "The mark" below): Silk, one fixed
  field of long rose-and-ink folds, kept sharp (blur 1.2%, not 7%). Chosen by the Maintainer
  from four bolder fields on 2026-11-07: the one place the motif may be as wavy and vivid as it
  likes.

**Where it appears, and nowhere else:**

- **Season, as a curtain, and only there** (the Maintainer, 2026-11-11: only the hub has a
  curtain; the Shortlist and the Diary take a plain tab header): full-bleed from the very top
  of the screen behind the hero, the rasika's concert (or with none the title, "Season",
  `heading`), with the page drawn up over it as a sheet with 18px top corners. The field fades
  halfway to the page over its bottom 80px, so the title holds at least 7:1 (measured again on
  2026-11-14: 10:1 or better in dark and light, and every line of the hero 7.5:1 or better).
  The council's flat fade with no sheet edge shipped on 2026-11-13 and was reverted the next
  day (the Maintainer, 2026-11-14, having seen it live). The first section's header stands
  between the sheet's corner and its panel's, 66px apart at 375px, so the two never meet. On
  an installed iPhone it draws up under the clock and the
  Dynamic Island, with the safe area as padding inside it ("The status bar"). An installed
  Android web app can't draw under the status bar; the dark ground is the page colour, so
  there is no seam. In a phone's browser tab it is drawn too: the install strip sits above the
  tab bar now, so the hero no longer yields to it (2026-11-11).
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
| caption   | 13 / 16            | 400                 | The instrument after a name, a search row's kind word ("Raga"), the eyebrow, the strip's weekday, tab words; one line |
| secondary | 15 / 20            | 400                 | Every second line, counts and times, facts, field labels, rows inside a panel, chips |
| body      | 17 / 24            | 400; 600 "strong"   | Row names and text; strong: every label above a panel, an Item's title, buttons |
| title     | 20 / 28            | 600                 | Sheet and dialog titles, a hero choice's names             |
| heading   | 24 / 32            | 700                 | Every page's title, the curtain's "Season" and its hero    |
| display   | 32 / 40            | 700                 | Wrapped headline numbers ("39 Events · 241 Items")         |

- **Place decides level** (foundations, 2026-11-16, [docs/design/foundations.md](docs/design/foundations.md)): a label above a
  panel is body 600; a label inside one is a row; a time or count is never a caption.
- **One emphasis rule:** what is live (under way, within the hour, the hero's word) or selected
  (the chosen day, the tab that is on, a pressed chip) is 600 in ink at its own size. Weights are
  400, 600 and 700 only.

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

- **Spacing** on an 8px grid with 4px half-steps (foundations, 2026-11-16). Two edges, plus the
  safe-area inset: every fill (panel, field, bottom button) stands 8px from the screen with 16px
  corners, and all text 24px from it. Rows have 12px above and below; sections are 32px apart,
  a label 8px over its panel, the first section 16px under the curtain or strip, a page title
  24px over its content, all measured between line boxes. A 48px target may reach into a gap.
  - The grid is 8px, with 4px for tight inner gaps (decided 2026-11-04, after the Carbon-like
    2x grid the Maintainer asked for). Two-line rows are 64px and one-line rows 48px; the
    hairline is drawn inside the row (`hairline-t`, `hairline-b`), so it never adds a pixel.
  - A section label sits 32px under the block above it and 8px over its first row; an action
    beside it (Edit order) keeps its 48px tap area by reaching past the line, not by pushing it.
  - Text sits on the 16px gutter. A fill that marks one row (the best search match) reaches
    8px past the text into the gutter instead of pushing the text in, and a text button's
    label (Remove Layavinyasam, Edit order) starts or ends on the gutter.
- **Thumb zone.** Primary actions sit in the bottom third: the fixed "Add Item" bar, the
  docked search box, "Done" and "Next Item →". What's on's bottom bar holds its search bar
  (2026-11-09); Season's + sits at the hero's right. The page keeps room for everything docked at the
  bottom (the action, any Undo bars, the tab bar): a field moved to behind them scrolls up above
  them.
- **Pushed screens' top bar** (decided 2026-11-01). The top centre belongs to the Dynamic Island,
  so there is no centred bar title. Below the safe area, the bar holds only a back chevron at
  the left, labelled with its destination ("‹ Season", "‹ Music Academy"), and at most one
  item at the right: a "⋯" actions menu or a text action such as "Done". What the screen is
  about is its first content block, in large type.
- **Navigation (DD1; the Season spine, the Maintainer, 2026-11-11 and 2026-11-13).** Four
  bottom tabs: one per stage of a concert, **Season** (the hub), **Shortlist** and **Diary**,
  then **Settings** (a tab since 2026-11-13; it was a mark on the hub's curtain). What's on is
  one tap below Season, never a tab. Event and Item are pushed screens with a back gesture.
  Each tab keeps its own back stack: What's on, then Shortlist, then back to Season finds
  What's on where it was left. The tab bar stays on an Event and hides only while the Item
  editor is open. Tapping the tab that is on returns it to its top. **The tab that is on** is
  in the text colour, its word in 600; the others are a step dimmer than muted text
  (`--tab-idle`, 5.4:1 in dark; the council, 2026-11-13: in a dim hall the one that is on
  hardly stood out). **Settings' tab carries a 10px amber dot** on its mark, spoken "Settings,
  something to fix", while a Settings row is amber. The tab bar keeps its top line, the one
  line between the page and the chrome; the bar above it has only its fade (the user,
  2026-11-17).
- **The Season spine** (the Maintainer, 2026-11-11, on
  [docs/designs/season-spine.md](docs/designs/season-spine.md), approved 2026-11-10; it
  replaces "Season (home, DD2)" below wherever the two differ):
  - **Words.** Home is Season; "Interested" is Shortlist (the tab, the listing sheet's
    "Shortlist" then "Shortlisted", the state); the tab of heard concerts is the Diary.
    "Wrapped" names only the stats and Cards that come later at the Diary's top, and "Season"
    only the tab. The store keeps `planned` for Shortlisted (ADR 0010).
  - **Only the hub has a curtain.** Shortlist and Diary take the plain tab header.
  - **Three chevrons on the hub, and no more:** one on each section's header, Today (What's
    on), Shortlist and Diary ("The section pattern"). A chevron means "this opens a page". The
    hero has none, though the whole hero opens its Event; rows have none.
  - **The bottom stack** is one frame, the same on every tab: the search bar (What's on
    only; the Maintainer took it off the hub on seeing the mockup, since it filtered nothing
    the hub shows), then the install strip (FB-46: thin, only in a browser tab), then the tab
    bar. It is fixed to the screen's bottom edge, with its height kept as room at the page's
    end; never sticky, which Safari on iOS 26 leaves where its toolbar was once the toolbar
    hides.
  - **On now is a dot.** A concert under way keeps its start time, in full ink, with an 8px
    ink dot before it, spoken "On now"; no "Now, since" (the Maintainer, 2026-11-11, option B
    of two mockups, "for now"). The dot is ink, never rose, and never moves. **On the hub the
    row says how close a concert is instead** (the Maintainer, 2026-11-13): "in 25 min" inside
    the hour and the dot with the words "On now" once it has started, both in full ink ("The
    row").
  - **The status bar.** The hub's curtain draws up under the clock and the Dynamic Island
    (`black-translucent`, with the safe area as padding inside the curtain). Every other screen
    paints that band in its own surface colour, in dark and light.
  - **Empty states** are shadcn's Empty, in our tokens, only where something is truly empty: an
    Event with no Items, the hub with nothing listed ahead, an empty Shortlist or Diary tab, a
    What's on filter that leaves nothing.
  - **Shared parts, built once:** the tab header (plain or curtain), the section header and
    its panel ("The section pattern"), the list row, the listing sheet, the empty state, the
    bottom stack and the safe areas.
  - **The section pattern** (the Maintainer, 2026-11-13, from a mockup taken through two
    council rounds, https://claude.ai/artifact/KvyNbu8WzuukzfAmy24Yr8; built for the hub, and
    since the foundations of 2026-11-16 the pattern of every page: each What's on and Shortlist
    day, the Event's Items and Stage, Settings' groups; `SectionHeader` and `Panel` in
    `app/src/screens/components/layout.tsx`). A section is a header and, below it, its rows.
    - **The header** is one row, at least 48px: the label in `body` 600 (17/24, ink), and at the
      right, on the label's line, a count in `sub`, muted and tabular, when it is above zero,
      then a chevron, muted. The whole row is one link to the section's page. A header that
      opens nothing has no chevron (the hub's "Were you at any of these?").
    - **The panel** holds the section's rows and nothing else: a quiet surface one step above
      the page (`--panel`: oklch(0.195 0.006 226) in dark, oklch(0.965 0 0) in light; far
      quieter than `surface-raised`, which was too heavy for it), with 16px corners. A row's
      own hairline divides it from the next; the last row has none.
    - **A section with no rows has no panel.** It says what it holds in one `sub` muted line
      under its label, inside the header row (the Shortlist's "1 in 20 min · 1 on Mon"; "Nothing
      yet"). A panel around one grey line read as a disabled field (the council, 2026-11-13).
    - **One column.** The page's gutter stays 16px. A panel reaches 8px past it and holds its
      rows 16px in; a header stands 8px in. So every label and every row's text starts 24px
      from the screen's left edge, and every count, chevron tip, star and the hub's + end 24px
      from its right. Edges and gaps are on the 8px grid: 8, 16, 24; 32px between sections.
    - A row on a panel has 16px less room than one on the page, and its accompanists are fitted
      to that ("The row").
  - **Craft.** Spacing on the 8px grid with 4px half-steps; line heights on the 4px grid;
    Tabler icons wherever one says it, each with an accessible name, and a word kept wherever an
    icon alone would be ambiguous; every tap target at least 44px.

**Screen layouts** (top to bottom; the full rules are DD2–DD5 in plan.md):

- **Season, the hub** (the Maintainer, 2026-11-11, on the Season spine approved 2026-11-10 and
  its mockup; it replaces option C of 2026-11-09, one page holding the hero and the whole
  Schedule): the pick is made on the move, at any hour, so Season answers "what can I still
  catch" on open, as a few small things. Top to bottom: the curtain with the hero; the status
  rows ("Getting ready for offline…", the failures no field shows, the new-catalog row); the
  question about lapsed concerts, when there is one; then three sections in one pattern ("The
  section pattern"; the Maintainer, 2026-11-13, after a day with 0.3.0 on an iPhone): Today,
  Shortlist, Diary. All of it stands on the pattern's 24px column, the curtain included. It
  opens at
  its top, and is found where it was left when come back to. Its bottom stack holds no search
  bar. **Nothing sits above the curtain** (the Maintainer, 2026-11-08), and the curtain is the
  one block in every state, the empty Season included, so the + is in view on open.
  - **The hero** (Part 7; the Maintainer, 2026-11-09 and 2026-11-11). On the curtain: first a
    48px row, 8px clear of the safe area, holding the hero's word in `sub` 600 at the left
    ("Now", "Next", or for a choice "Pick your dusk") and at the right the +. Under it the
    concert: its title in `heading` 700, the Artists it is known by (else its Sabha, else "No
    Sabha yet"), its lines balanced and never broken after an "&" or an initial, starting on the
    column (4 or more presenters as 2 names then "+N", as a row has them, ADR 0013); **after
    the name, as a row has them** (docs/design/screens/hub.md, decision 3, the user, 2026-11-21), its kind's 20px mark and its instrument word ("Flute") in `sub` at 80%,
    kept with the name's last word. 4px under it a line in `sub` at 80% of the text colour,
    **time first, as a row's**: the day ("Today", "Tomorrow", else its date; none for a choice
    of today, named by its slot), the time, the Sabha, and once Heard the Item count when it has
    any. **Inside the hour "in 20 min" leads, in 600 at full ink**, as its row says it (the
    council, 2026-11-13: the most urgent fact on the screen had the least weight). **Under way
    it is the start time with no dot**, an exception to "On now is a dot": the hero's word
    already says "Now". The line breaks at a "·" first; one fact wider than the line wraps
    between its words, never cut. **No chevron**: the whole
    concert opens its Event, ready for its first Item. A long name wraps at the same size,
    never cut or shrunk. Which concert: the one the rasika is logging now; else one of theirs
    under way (a Heard one before a Shortlisted one; under way is from its start until 2½
    hours after it, SF-D30); else their soonest ahead, one with no time counting all its day. A
    cancelled, Missed or lapsed one never. With none, the row holds the tab's title, "Season",
    in `heading` 700 in the word's place, and the title is the page's heading for screen
    readers either way.
  - **A choice, never a pick** (SF-D19, SF-D33): two or more Shortlisted concerts in one slot,
    starting within 30 minutes of each other (4:00 and 4:30 clash; 4:00 and 6:00 don't), read
    as a choice. The word names the slot ("Pick your dusk": morning before 11:30, afternoon
    before 3:30, dusk before 5:30, then evening; placeholder words), and each concert is its
    own way in, 12px apart: its name in `title` 600 over its line. A Heard concert is never
    part of a choice: it is the one the rasika chose.
  - **The +** (the Maintainer, 2026-11-08 and 2026-11-13) starts a Concert that is not on the
    Schedule straight into logging, spoken "Log a Concert": a 28px mark in a 48px target, its
    right arm on the hub's column. It still starts another, a past one included, while one is
    in progress, one per tap. Settings has left the curtain for the tab bar ("Navigation").
  - **Today** (SF-D26, SF-D27, SF-D37; the Maintainer, 2026-11-13, replacing "Starting soon"
    and its door): the first section, always labelled "Today" while anything is on or ahead.
    Its header opens What's on and counts today's concerts not yet over; its panel holds up to
    four rows ("The row"), each saying how close it is. Only concerts under way or in the next
    slot qualify: the next start time today and any within 30 minutes of it, however far off
    (at 4:10 it shows the 6:00 to 6:30 slot, never nothing while today has one). The rasika's
    Shortlisted ones among them come first, then the rest of the next slot by time and Sabha,
    then the others under way, the latest to start first, so the pick at 3:40 is never pushed
    out by concerts long under way. **The hero's concerts are left out**, its one or a choice's
    two (docs/design/screens/hub.md, decision 1, the user, 2026-11-21, over the Maintainer's
    "always labelled Today" of 2026-11-13): the hub never shows one concert twice. Once nothing
    besides the hero is left today, the section is the next day's, as it was already while the
    hero was being logged. The header's count is still the day's, the hero's included.
  - **Tomorrow** (the Maintainer, 2026-11-13): once nothing is left today the first section is
    the next day's with a concert, labelled "Tomorrow", or by its day when it is further off:
    its first four rows in start order, with their clock times, a Shortlisted one marked where
    it falls; **the hero's concerts taken out first** (decision 1, 2026-11-21), and a day whose
    only concert is the hero's passed over for the next. The header counts that day's concerts
    and opens What's on at that day. No large empty state stands there.
  - **Shortlist**: its header alone, as it has no rows ("The section pattern"). Its count, and
    under its label when: today's by slot ("1 in 20 min" and "1 on now" in full ink, "2 at
    6:45 pm"), tomorrow's as "1 tomorrow", the days further ahead by day ("1 on Wed"); three
    parts at most. With nothing
    Shortlisted, "Nothing yet" and no count. It opens the Shortlist.
  - **Diary**: its header, with the count of concerts heard, opening the Diary; on its panel
    the last concert heard as one row, its name over "day · time · Sabha · N Items" (nothing
    about Items when it has none), opening its Event; never the hero's own (decision 1,
    2026-11-21), so with only the hero heard it is the header and its count alone. With nothing heard it is the header alone,
    saying "Nothing heard yet", so the hub is the same three sections on day one (the council,
    2026-11-13). No graph and no stats (the Maintainer, 2026-11-11).
  - **Three chevrons, and no more**: one on each of the three headers.
  - **One word for one day** (docs/design/screens/hub.md, decision 2, the user, 2026-11-21):
    wherever the hub names today or tomorrow, it says "Today" or "Tomorrow" (the hero, the
    first section's header, the lapse question, the Shortlist line, the Diary row). Other days
    keep their date or weekday; there is no "Yesterday". A day is the phone's calendar day, the
    clock every start time is read by; the hub redraws every 30 seconds and on coming back into
    view. Other screens keep their own words until phase 4.
  - **The question about lapsed concerts** (SF-D24, SF-D39; ADR 0010; in the section pattern
    since 2026-11-13): above Today, when a Shortlisted concert's window ended (four hours after
    its start) with nothing logged. Its header is the question, "Were you at any of these?",
    with no chevron, and under it the day (several days are each said above their own
    concerts, in `sub`); today is "Today", any other its date, never "Yesterday". On its panel each lapsed concert, as a Concert row, and at its
    right a 48px outline button with the word "Yes", spoken "Yes, I was at …", which makes it
    Heard (Items optional). The row is one tap: it opens the concert, as a What's on row does,
    and "Yes" is its own target (the user, 2026-11-17). A word, not a tick: three reviewers read a tick in
    a ring as already answered. Under the last row's line, "None of these" in `body` 600, the
    panel's whole width, lets the rest go (it reads "None of the rest" once one has been
    answered "Yes", so it never sounds like taking that answer back; the Maintainer,
    2026-11-13): they become Missed, kept and shown nowhere. One in
    the same slot as a concert the rasika heard, or cancelled, goes without being asked.
  - **Empty** ("Empty states"): kept for when there is truly nothing. With no Schedule and
    nothing of the rasika's, under the "Today" header: "Nothing listed yet" over its one line.
    With a Schedule that has nothing ahead, "Nothing more today"; with nothing ahead but the
    hero's concert, "Nothing else ahead" (decision 1, 2026-11-21). Its mark is the bare glyph,
    28px, muted: on a filled tile it read as a button (the council, 2026-11-13).
  - **New catalog prompt** (decided 2026-11-01; FR-038): one row at the top of the hub's sheet, under
    the status rows: "An updated song catalog is ready." with "Update" and "Later". It never
    shows while a Concert is being logged. "Later" hides it until the next
    launch.
- **What's on** (Part 3; the Maintainer, 2026-11-09 and 2026-11-11): the full list, one tap
  below Season, never a tab, and it must breathe: it is the most important list. A pushed page:
  its top bar ("‹ Season"), its name in `heading` 700, the strip of days, then every day from
  today on, by day; in the bottom stack, its search bar. Opened from the hub it starts from
  today, at its very top, whatever was picked before; coming back from an Event, a sheet or
  another tab finds it as it was left, on the days gone or from today, at the same place: kept
  by the day at the top of the screen as the page goes and held there before the first paint
  while the days above draw at their real heights, until the rasika scrolls (its anchor found
  again at each correction, let go once gone, and held on through a page still too short to
  reach its place), so nothing slides even where the browser has no scroll anchoring. The old
  `/earlier` link opens it on the days gone, at its top; `/schedule` opens it from today.
  - **The strip of days** (the Maintainer, 2026-11-09, and their review of it; builder's calls
    marked): one row under What's on's name, sliding sideways, with no line under it: **Today**, then
    each date from tomorrow with anything on, slim, never a pill: its weekday in
    `caption`, muted, over its number in `body` ("Tue" / "15"), the month beside the number at
    the first date and where the month turns ("15 Dec", then "16"; builder: the number alone is
    enough within a month). Today keeps the same shape, an empty line over its word, so the word sits on the
    numbers' line. **Past is not on the strip** (SF-D32, 2026-11-11): a day gone is two taps
    away, the calendar and then the day, for a late log; while the days gone are the ones
    shown, a Past stop stands at the strip's left, in the same shape, so the strip still says
    where the rasika is, and Today brings the list back. Each stop is 48px tall and at least 44px wide, 8px
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
    marked. A date tapped **starts the list at that day** and takes the page back to its top, so the
    header stays where it is and the day sits just under the strip (the Maintainer's iPhone,
    2026-11-09: a jump that scrolled the header away read as a glitch, and the same tap landed
    differently from different places); the days before it are a tap on Today away. Today starts
    the list from today again. Each day's label sticks under the strip while its day is on the
    screen, as a festival schedule's do, and fades the rows passing under it over 24px as they
    pass, so none shows half cut (the council, 2026-11-09), but none under a day resting just
    under the strip, whose first row is under nothing (the Maintainer's iPhone, 2026-11-09: that
    row read dimmer than the rest). A stop shows a focus ring only from
    the keyboard, rounded and inside it. With a filter on, dates with no match drop out
    (builder).
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
    it looked too different): 14px corners, the search mark 12px in and the text at 40px, in the shell's bottom stack above the
    install strip and the tab bar, in thumb reach, on What's on only (the Maintainer took it off
    the hub on 2026-11-11: there it filtered nothing in view), while there is anything in the
    Season. The shell's bar
    keeps the page clear of it (the last row scrolls up above it) and sits on the safe area; on
    What's on it has no line over it, the list fading out above it over 24px, as under the strip
    (the council, 2026-11-09). It reads "Artist or Sabha…" in muted text after a search mark, on `surface-raised` in both
    themes (builder: in dark that is the search field's own fill, one step lighter than the page,
    with no border or shadow, depth by lightness). Tapped, it opens the search sheet. With a
    filter on it reads the filter as plain text in full contrast, "T M Krishna · Music Academy":
    as many parts as fit whole, then "+N" for the rest ("Music Academy +1"), so no name is ever
    cut and more being on always shows (the council, 2026-11-09; only a first part too long
    alone ends in an ellipsis), and one 48px x at its right, spoken "Clear
    filters", that clears it all. While What's on loads, the bar keeps what it showed, so the page
    never moves under the place it is held at.
  - **The search sheet** (docs/design/search.md, 2026-11-17, replacing the sheet of
    2026-11-09): the docked search ("Search box", "Search result", "Search states"), opened from
    the bar with its field focused at the foot, where the bar was, so the keyboard rises at once
    (builder, 2026-11-09: tapping a search bar says "I'll type", as in Maps; the second recorded
    exception to no autofocus, after the Item editor's). The sheet fits its content, standing on
    the keyboard. No title. Its head is the kinds the Schedule has (Dance, Lecdem, Harikatha) as
    text toggles, sharing the close's row: off in muted text, on in full contrast and 600 with a
    check after the word, never a filled pill, each as wide on as off so turning one on moves
    nothing (the Maintainer, 2026-11-09 and 2026-11-10). Under them, the names picked, pinned rows
    in the order picked, each its name, its sort ("Artist", "Group", "Sabha") and a check; they
    stay while the rasika types, and a picked name is not repeated in the results. Before typing,
    up to five names under the caption "Often heard": the Artists, groups and Sabhas the rasika
    has heard most often, an Artist counting once per concert they led (accompanists are left
    out; the leads are those the concert is known by, so a duo counts both and a group whose
    members lead counts once, as the group: decided 2026-11-17), only names with a listing today
    or later and none already picked, the most heard next to the field, as many as fit whole;
    nothing shaded, and Enter does nothing until something is typed. With nothing heard yet, only the toggles and the field. As the rasika types, the
    suggestions from the names in this Season's Schedule and their own Events, billed Artists
    (accompanists included), groups by their group name and Sabhas with their Aliases ("KGS"
    finds Krishna Gana Sabha), ranked as the Artist and Sabha pickers rank names, each a List row
    of the name and its sort at the right on the text column, with no room kept for a check. A
    name tapped, or the best match by Enter, is picked and the sheet closes onto its days
    (builder: most searches are one name); the best match is never a name already picked. A
    picked row tapped is taken off and stays where it is, unticked, until the sheet closes, so
    nothing moves under the thumb; a toggle tapped also keeps the sheet open.
    Picks of one sort widen the list (TM Krishna or Sanjay; an Artist and a group are one sort,
    the performers); picks of different sorts narrow it (TM Krishna at the Academy); kinds
    picked together widen each other. Every filter applies to the days ahead and the days gone
    alike, to own Events as to listings, and prunes the strip and the calendar's dots; the hub
    is never filtered (builder). A list the filter empties
    shows the empty state, "Nothing here matches" ("Nothing ahead matches" from today), with
    one outline "Clear filters" under it, which turns every filter off; from today, when the
    days gone match, an outline "Show Past" stands above it (docs/design/screens/whats-on.md
    decision 3). Filters last while the app is open, across the days gone and Events, and
    **not across launches** (builder): What's on opens whole each time, so a filter set yesterday
    never hides a Concert today without being seen.
  - **Each day:** its label (sticking under the strip), then every concert that day once, **by
    start time** (then Sabha), the rasika's own among the rest (SF-D31), each as "The row". A
    listing the rasika Shortlisted or heard shows once, as theirs. Today's and tomorrow's
    labels say the Hub's word and the date, "Today · Mon 14 Dec" and "Tomorrow · Tue 15 Dec",
    spoken "Today, Monday 14 December"; any other day its date alone, and no "Yesterday"
    (docs/design/screens/whats-on.md decision 2). **Today starts from now**, with or without a
    filter (decision 4: a filter only narrows its rows), in two folds, each a 48px `sub` row
    with its count and a down chevron, open at a tap, heading its own rows
    (docs/design/screens/whats-on.md decision 1):
    - **"Earlier today"**: what is over (2½ hours after its start, unless the rasika is still
      logging it), and a cancelled concert once its start has passed.
    - **"On now"**, with the dot and its word in 600 ink: what is under way, the Concert being
      logged included, once three or more are and something is still to come today (a
      concert with no time counts). Fewer, or nothing still to come, they show as rows; a
      concert under way carries the dot.
    - Then what is still to come. Rows move between the folds on the clock's tick; the page
      holds its place.
    - Both folds are kept, open or closed, with the place; opened from the hub, both start
      closed, except that "Earlier today" starts open when it would be all the list shows,
      checked then and as the filter changes, never on the tick.

    A day gone and a day ahead show whole. A day with nothing in it is not shown. Rows far from
    the screen aren't drawn until scrolled near, each day's held at their likely height (a
    64px row each, and 20px more for a printed title and for the accompanists); the label is
    always drawn, outside what skips drawing, since Safari moves a sticky label inside it only
    once a fling's frame is done and the rows ran over it at a day's change (the Maintainer's
    iPhone, 2026-11-10).
  - **Empty**: a list the filter empties, and a Season with nothing listed, show the empty
    state ("Empty states"); the days gone with nothing say "Nothing yet". From today, with
    nothing to show and anything in the days gone (matching the filter, when one is on), the
    Empty offers an outline "Show Past" first: it opens the days gone at their top, the filter
    kept, focus on the first day's label (decision 3). Past needs none: its strip shows Today.
  - **The rasika's rows and the Schedule** (the Maintainer, 2026-11-07; T061): a Shortlisted Event
    whose Schedule entry is cancelled stays in its day until the rasika removes it (Delete
    Event) or its time passes (it then lapses to Missed unasked, ADR 0010),
    its title muted, "Cancelled" in its time's place, and a cancelled mark (a calendar with a
    cross) at the row's right, spoken "Cancelled". One the Schedule changed after the rasika edited it carries a calendar with "!"
    there, spoken "Schedule changed": a 48px button of its own beside the row, which opens what
    changed (2026-11-07), on a cancelled row as on any other. An Attended or Missed Event never
    gets it: it is the rasika's record of what happened. The sheet, titled "Schedule changed",
    lists only the fields that differ, each led by its mark (calendar, clock, building,
    category, "T", a ban sign for cancelled or on, people) and spoken by its name: the Event's
    value muted, an arrow, the Schedule's. Cancelled and on are a calendar with a cross and one
    with a check. Billed Artists list a name per line, the Role under it. Two buttons share the
    bottom: "Keep mine" (outline, an X) and "Take it" (primary, a check). Either closes the
    sheet once saved; a failure shows its row in the sheet. A change to Concert that takes a
    typed title takes it at once, with no Undo, as a kind change does. A cancelled Event is never
    hidden while it is ahead, and is never on now.
- **The row** (Part 4; ADR 0011; the shared list row, on the hub, What's on, the
  Shortlist and the Diary): the lead in `body`, in the text colour, then its kind's mark
  and, when the concert isn't vocal, its type in `caption`, muted, both after it ("Flute",
  "Veena", "Jugalbandi"); a printed title on its own `sub` muted line; the accompanists on a
  `sub` muted line, joined by " · "; then the facts in `sub`, muted, time first, "time · Sabha" (the Maintainer, 2026-11-16; docs/design/row.md), leaving out what its label already says: the day under a day label, the time under a time label. 12px above and below:
  68px with two lines, then 24px more for a wrapped lead line and 20px for each `sub` line
  added, the hairline drawn inside; on a panel on
  every page (foundations, 2026-11-16). No faces, no
  button on the row, and no chevron. **How each line holds its shape** (the Maintainer,
  2026-11-11, from a mockup of every variant, measured on the Season's 542 listings at 390px):
  the **lead** wraps and is never cut, its lines balanced, never broken after an "&" or an
  initial (2026-11-13: a pair breaks before its "&"), and its type stays on the line of its
  last word, never alone; 4 or more presenters (a Lecdem's, a Harikatha's) show 2 whole names,
  then "+N", spoken "and N more", and up to 3 show in full (the user, 2026-11-24, ADR 0013); a
  **printed title** takes two lines at most, then "…"; the **accompanists** take one
  line, as many whole names as fit, in Stage order, then "+N" for the rest ("Thiruvizha Sri.
  Viju. S. Anand · R. Sankaranarayanan +1", option B of three mockups: no name is ever cut and
  the line never wraps; one name always shows; one listing in four with accompanists carries a
  count, nearly all "+1"); the **last line** breaks only between its facts (the "·" at a
  break dropped), takes two lines at most, and on its second cuts the Sabha with "…" before
  anything else, so the Item count always shows ("Sun 13 Dec · 6:45 pm" / "Sri Parthasarathy
  Swami… · 3 Items"; the user, 2026-11-17). On a panel the fit is to the panel's
  narrower column. Nothing else is cut: the sheet
  has it all. A row carries at most one button, at its right (the Schedule-changed hint, the
  lapse question's "Yes"), and the lines give way to it. The rasika's own carry a quiet mark, never bold or a card
  (SF-D31): a 16px filled star once Shortlisted, spoken "Shortlisted", **at the end of the
  lead's first line in its own column** (the Maintainer, 2026-11-13: after the time it moved
  with the text; in a column the stars can be scanned down a list), the lead wrapping before it
  and never under it; it is a mark, not a button. The Item count once Heard ("· 9 Items"), and
  nothing when it has none. **On the hub, closeness** (the Maintainer, 2026-11-13): a row of
  today says "in 25 min" in place of the time inside the hour, in full ink, and once started
  the dot and the words "On now", the dot standing where the "·" would. It is worked out from
  the clock and the start time; nothing is stored. Under a Shortlist slot's time label,
  where no time shows, a concert under way reads "● On now · Sabha" (the user, 2026-11-17).
  Everywhere else the row keeps the clock time, which a timeline is read by. **On now is a dot** (the Maintainer, 2026-11-11, option B of
  two mockups, "for now"): a concert under way keeps its start time, in the text colour, with
  an 8px ink dot before it, spoken "On now"; never "Now, since", never rose, and it never
  moves. One exception: the hub's hero under way shows its start time with no dot, as its word
  says "Now" (the hub spec, 2026-11-21). A cancelled one is dimmed to 60%, star included, says "Cancelled" in its time's place, and keeps the cancelled mark at its right. A tap opens
  the listing sheet; a Heard row, or one the rasika made by hand, opens its Event.
  **Four kinds of row** (the row spec, 2026-11-16): Concert (this one), Item (the Event's
  numbered Items), List (anything else that names a thing: Stage, Settings, search results) and
  Action (a one-line reply to its group: "None of these", "? Don't know", "Use what I typed").
  Each is one tap, with at most one nested 48px control at its right. A row's trailing column is
  48px: the star on the name's first line, the cancelled mark or the one control on its last.
  A List row's control (the Stage colour dot) is centred on the row's text, however many lines
  it takes (the Maintainer, 2026-11-20, in place of the last line of 2026-11-17). A check
  may be a List row's nested control, meaning "on; tap to turn off" (the Item editor's
  Manodharma and Layavinyasam rows, 2026-11-19); a trailing check without a target means
  "picked". A field inside a panel sits on the panel's text column.
- **The listing sheet** (Parts 1 and 5; the Maintainer, 2026-11-08 and 2026-11-11, replacing
  "+ Add" and "Planned"): titled by the concert's lead with its kind's mark, every fact led by
  its mark (a "T" for the title, calendar, clock, building, people): the date, time, Sabha and
  each billed Artist with their Role and group under the name. Two 56px buttons share the
  bottom. **Shortlist**, outlined, with a star: it makes the rasika's Event (one id per
  attempt, ADR 0007, and a new attempt once its Event was deleted) and then reads
  **Shortlisted**, the star filled; tapped again it takes the concert off the Shortlist,
  deleting that Event, synced, with Undo (SF-D22). **"I'm here"** (placeholder words), filled:
  it opens the Event ready for its first Item, Shortlisting it first if need be; the first
  Item makes it Heard (ADR 0010). A concert whose window has passed offers only that button,
  as "I was there". A cancelled entry shows the cancelled mark and has neither.
- **Shortlist** (Part 6): a plain tab header, then the concerts the rasika Shortlisted, by
  day, today first ("Today", then "Mon 21 Dec"), each as "The row"; a row opens its sheet,
  where Shortlisted takes it off. Concerts starting within 30 minutes of each other are one
  slot: a slot of two or more is led by a `caption` line, its time at the left and its count at
  the right, so a clash is simply one slot with two rows. One whose time has passed is not
  here: the hub asks about it once. Empty, it shows the empty state, with one outline button
  to What's on.
- **Diary** (Part 8, cut to its list by the Maintainer on 2026-11-11): a plain tab header,
  then every concert the rasika has heard, newest first, each as "The row" with its day in the
  time's place ("Sat 19 Dec · 6:30 pm · 9 Items"), opening its Event. Empty, it shows the
  empty state. The Wrapped's stats and Cards come later, at its top; their "Your Season so
  far" header takes another title, so "Season" names only the tab.
- **Empty states** (the Maintainer, 2026-11-11): shadcn's Empty, in the app's tokens
  (`app/src/components/ui/empty.tsx`), only where something is truly empty: a 48px mark on
  `surface-raised` with 14px corners, a `body` 600 title, one `sub` muted line, and at most
  one outline button, centred, 32px above and below. An Event with no Items ("No Items yet",
  where logging starts, Add Item right under it in the bar); an empty Shortlist tab; an empty
  Diary tab; a What's on filter that leaves nothing; the hub with nothing listed ahead, where the mark is the
  bare glyph ("Season, the hub"). The hub with nothing left today is not one: its first
  section becomes the next day's (the Maintainer, 2026-11-13).
- **Event (DD3):** top to bottom, heading → Items → Stage → Note (the Maintainer, 2026-11-11,
  restoring the order before 2026-11-04, when the walkthrough's S2 and S3 had put Stage and
  Note first: what was sung leads, and the page lost its doubled lines). Each section is a
  `sub` 600 muted label, a hairline, its rows, and the last row's hairline; nothing draws a
  second line against that one, so Note, the last section, has none above it.
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
    under the Artists (the Maintainer, 2026-11-10). Each Artist's row ends in their Colours, a
    20px dot in a 48px target on the gutter: empty and dashed until they are set, never the
    word "Colours" (the Maintainer, 2026-11-11; see "Colour sheet").
  - **Items**, first under the heading: numbered rows, title then Raga · Composer, under the
    label "Items" (walkthrough S12). With none, the empty state stands in their place.
  - **Note**, last, is a fold (walkthrough P6, 2026-11-05): open when it has text, so a note
    written stays in view, and one 48px row when empty, its label where a section's would be.
  - The top bar's "⋯" holds Delete Event (its Export moved to Settings on 2026-11-03). Season's
    + opens this screen at once, started, with the date and time set to now and the Add Item
    bar ready (decided 2026-11-01). Left with nothing entered (only the kind, date and time it
    was made with), by the back gesture, the top bar or a tab, even after a reload, it leaves no
    trace: no row, no Undo bar, no "Not saved" (the Maintainer, 2026-11-08). Anything entered keeps it, an edit that failed to save included. It leaves no row only with proof it never left the phone (its birth still queued and never sent, and nothing heard from the server); otherwise it is deleted as a tombstone that syncs, so the server keeps no empty Concert. No page anywhere may have it open: from the + tap, before it is written, every open page of it in any tab holds a lock named for it, shared, and taking it back needs that lock alone and at once, so a tab with it open, or another tab's Season sweeping as it is born, never loses it; with no Web Locks it is kept. When unsure it is kept too: a new Sabha or Artist still typed, being written or failed, whose entry names no Concert, keeps it (PR #30 reviews).
  - A fixed full-width 56px bar at the bottom holds "Add Item", whatever the Event's stage
    (the Season spine, 2026-11-11, replacing "Start logging" on a Planned Event, DD7): the first
    Item makes a Shortlisted concert Heard (ADR 0010), so nothing stands before logging. An
    Event with no Items shows the empty state where its Items go, "No Items yet", under the
    heading. Nothing follows the last Item: a Concert ends on its own (walkthrough S13; see
    "Finishing a Concert").
  - Its top bar's back chevron names the page it was opened from, in its tab: "‹ Season",
    "‹ What's on", "‹ Shortlist" or "‹ Diary" ("Navigation"). The tab bar stays in view.
- **Item editor (DD4):** top bar "‹ Music Academy" (the Event's Sabha). The bottom bar holds
  "Next Item →", outlined, at the left and "Done", the filled main action, at the right
  (walkthrough S9, decided 2026-11-04). Once picked, the title is the first content line, with
  "Item 8" as a small muted eyebrow above it in `caption` (walkthrough S10); before a pick, the
  heading is "Item 8". A field's label sits 8px above its chips ("Nadai"; walkthrough
  S11). "Done" goes back to the Concert, "done for now" (walkthrough P1). The search
  is the docked search ("Search states"), its pinned rows the special-form chips (RTP,
  Viruttam / Slokam, Medley), "? Don't know" and "Use what I typed: …". After a pick
  (docs/design/item-editor.md, 2026-11-19), the Details sit on one panel, 24px under the title
  block, with no lines inside: the Raga line full width, then Tala | Composer, Language |
  Subject, and Form, each a value cell (see "Values"). The Raga line has no "Edit order": a
  Raga's order and removal are in its sheet ("Detail input").
  - **Manodharma** (the user, 2026-11-19, replacing the fold "Improvised"; walkthrough S14): a
    fold holding Alapana, Tanam, Niraval and Kalpanaswaram as List rows with a check, open when
    the Item has any. The fold is its own panel (the user, 2026-11-21): closed, one 48px row,
    "Manodharma" with its chevron, as the Layavinyasam's one-row panel under it; opening grows
    that panel by the parts, a hairline under the title. Off, one line a tap turns on. On, a
    part silently follows the Item's Raga
    (its first, the main one, live): one line, its name and the check, no Raga shown, since a
    Raga beyond the Item's is rare ("1 in every 10-15 compositions", mostly RTPs). A part with
    its own Ragas shows them as a second line in ink, plain text ("Kharaharapriya, Kalyani,
    Kanada"). In an RTP every part that is on shows its Raga line, muted while it follows. The
    first time on a phone that a part is turned on, its row reads "Kharaharapriya · tap to
    change" until a part's sheet is opened or the Item is left, then never again. The row's tap
    opens the part's one sheet; the check, centred on the row's text, is its one nested control,
    turning it off at once, with no Undo (2026-11-25). For 500ms after a row turns
    on, another tap on it does nothing; a row grows over `motion-grow`. Screen readers meet one
    switch per part: the row while off ("Tanam, off"), its check while on ("Alapana, on").
  - **A part's sheet:** following, "Item’s Raga: Kharaharapriya", "?" and "Not sure", a quiet
    "+ Another Raga" and the box "Change Raga…": changing is the box, adding the lesser act, and
    adding starts the part's list with the Item's Raga, kept live ("Kharaharapriya (Item’s)")
    until changed in its slot. With its own Ragas, they stand in a line, one selected (600, ink,
    underlined; the first by default), then "?" and "Not sure", then "← Earlier", "Later →" and
    "Remove" for the selected one, a quiet "+ Another Raga", the Action row "Use the Item’s Raga
    only", and the box "Change Kalyani…". Each removal saves at once, with no Undo. A list cut back to the Item's Raga alone
    goes back to following.
  - **The Layavinyasam** (one word; out of Manodharma, the user, 2026-11-19): its own one-row
    panel, 32px under Manodharma, always shown, a List row with a check. On, its nadais show more
    plainly than a part's Ragas: "Chatusra   + Nadai" (the Tala's muted, "+ Nadai" in ink) while
    none is set, "+ Nadai" alone with no Tala, then the nadais it moved through besides the
    Tala's, in ink ("Khanda, Tisra"). Its Note opens under the row at one line and grows. Its
    sheet shows "Tala’s nadai: Chatusra", the nadais in a line with one selected, the Nadai
    chips (a chip changes the selected nadai; picking only the Tala's own leaves the list empty;
    "?" records a nadai that changed and couldn't be named), "← Earlier", "Later →" and
    "Remove" (at once, with no Undo), and a quiet "+ Another nadai" whose next chip appends one.

  Bottom bar: "Done", "Next Item →".
- **Wrapped (DD5):** headline numbers → the range as a quiet subtitle → a vertical list of 9:16
  Card previews, each with its own Share. Not built yet: it joins the Diary, at its top (the
  Season spine, 2026-11-11).
- **First launch (decided 2026-11-01; FR-050, FR-042, FR-049):** one step per screen, in order:
  Welcome (wordmark, one sentence, "Continue with Google" as the 56px primary) → Google sign-in
  → Consent 1 → Consent 2 → "Getting ready to log offline" with real progress → the empty home.
  Each consent screen asks one question with its one-line reason and two equal 56px buttons, Yes
  and No, with neither styled as the default and nothing pre-selected. "Ready to log offline"
  shows only once the catalog is stored. Each failure (sign-in cancelled, no signal, a Google
  error, the download stopping) is one line of text and one "Try again", on the step it
  happened, keeping the answers already given.
- **Settings** (laid out 2026-11-03 for Phase 4; the fourth tab since 2026-11-13, with a
  plain tab header, its name in `heading`, and no way back to give): the
  season first, as three icon-led rows,
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

## The status bar

Decided by the Maintainer on 2026-11-11. An installed iPhone app draws under the clock and the
Dynamic Island (`apple-mobile-web-app-status-bar-style: black-translucent` in
`app/index.html`), so the app, not iOS, paints that band.

- **The hub's curtain reaches the top of the screen**, with the safe area as padding inside
  it, so the motif shows under the clock.
- **Every other screen paints the band itself**: a fixed strip as tall as the top inset, in
  `--status-band`, above what scrolls, so no row passes under the clock. Over the hub's curtain
  the band is clear, and takes its colour once the sheet has scrolled up to it (150ms).
- **Dark:** `--status-band` is the page colour, `background`, the screen's own surface.
- **Light:** iOS draws the clock white whenever the page goes under it, and can't draw it dark
  for one theme only, so a white band would hide it. `--status-band` is the motif's blush,
  oklch(0.8 0.1 12) (`--motif-blush`), on every screen; and the hub's light curtain takes a
  wash of the same blush under the clock, fading to clear over 1.6 times the inset. The white
  clock is faint on it (2:1): the Maintainer chose the soft rose over a darker band that reads
  well (2026-11-17, from four options at 393px). This departs, in light only, from "each
  screen's own surface colour".
- Nothing is drawn where there is no top inset: a browser tab, Android, a desktop.
- **The page is as tall as the whole screen** (2026-11-13). An installed iPhone app that
  draws under the clock is sized a status bar short by iOS: 100dvh, 100% and `innerHeight` all
  come back less than the screen by the top inset, so on the Maintainer's iPhone the tab bar
  sat 59pt above the bottom edge. Only the large viewport is the whole screen there. So the
  app sizes itself by `--app-height` (`app/src/styles/base.css`): 100dvh, and 100lvh in an
  installed iPhone app (`data-ios-app` on the root, set in `app/index.html` before anything
  draws), which has no browser chrome to track. Everything sized to the screen uses it: the
  shell, the Item editor, the sheets, First launch. A "Screen" line under Settings' versions
  said how the phone sized the page until the fix was seen on the phone (removed 2026-11-17).
- iOS reads the setting when the app is added to the Home Screen: an app added before
  2026-11-11 keeps its black bar until it is removed and added again. On an iOS that reports
  no top inset to an installed app (WebKit bug 301994, seen on 26.1), the curtain simply
  starts under the bar.

## Elevation & Depth

- **Dark:** no shadows. Layers are told apart by lightness (background, surface,
  surface-raised) and the 10% white border.
- **Light:** borders do the same job; only sheets and menus take a soft shadow.
- **Sheets** (Colour picker, edit menus) rise from the bottom over a 50% black scrim. Menus use
  the preset's inverted translucent style. The Concert summary is shadcn's Dialog: centred,
  `surface` with 18px corners, over its own blurred scrim (50% black, the page behind in grey).

## Shapes

- Radius base 10px (preset `--radius: 0.625rem`), scaled: 6 / 8 / 10 / 14 / 18px.
- **Lists are rows on a panel** (foundations, 2026-11-16, replacing "rows, not cards" of
  2026-11-01): every group of rows under one label sits on the quiet panel, divided by the
  `border` hairline inside it; a row itself has no fill. A fill on a row still means "this one
  is different": the best search match.
- Every fill on the 8px edge (panels, fields, bottom buttons, the Undo bar): 16px. The curtain's
  sheet edge: 18px (the Maintainer, 2026-11-14).
- Chips and the outfit swatches: fully round. A chip is a fill: a row of chips stands on the 8px
  edge, its first chip's word on the 24px column (a 1px border and 15px padding), in a sheet as
  on a page (the Maintainer, 2026-11-20).
- Badges: 8px.
- Icons: Tabler, 20–22px, 2px stroke, always next to a text label unless the meaning is
  universal (back chevron, search). One exception (FB-27): an Item row marks its Layavinyasam
  with the muted metronome mark, named "Layavinyasam" to screen readers, in place of the pill.

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
    for another, its ink 8px after the last; each opens the same sheet, spoken "Kanada, Raga 2
    of 3". Wrapped lines step 48px, so every target is whole. A Raga's order and removal live
    in its sheet (docs/design/item-editor.md, 2026-11-19; "Edit order" leaves the Item editor):
    with two or more, its chips are "?" and "Not sure" ("N/A" means nothing for one Raga of
    several), then "← Earlier", "Later →" and "Remove" share a line, in fixed places, one dimmed
    and aria-disabled at either end; "Remove" at the right, on its own line at 200% text. After
    a move the sheet stays open, its title and placeholder following ("Raga 2" becomes "Raga
    1"), the Raga reordering behind with the save highlight, and screen readers hear "Kanada,
    now Raga 1 of 3". "Remove" closes it and removes the Raga at once, with no Undo, focus going
    to the Raga that took its place, or to the "+". A lone Raga's sheet, and one being added, have
    none of the three.
  - Tala opens its search, then a row of Nadai chips: "?", the five nadais and "Other…", in
    sentence case like the Roles ("Tisra"; 2026-11-19).
    With none picked, the Nadai stays Not applicable, which means the Tala's usual nadai (the
    store's default) and shows nothing extra: "Adi", not "Adi (chatusra nadai)". "Other…"
    opens the Nadai's own sheet, the same pattern as every Detail ("?", "Not sure", "N/A",
    free text), as the Layavinyasam's does (2026-11-02).
  - Manodharma and the Layavinyasam use one sheet each for their Ragas and nadais (see "Item
    editor (DD4)").
  - **The Layavinyasam** (walkthrough S14, decided 2026-11-05; its own row since 2026-11-19, see
    "Item editor (DD4)"): its check removes it, nadais and note, at once with no Undo, but
    never with a note typed under it: one tap would lose the text, so the tap goes to the note
    instead, its text selected, to clear it first, and the check is spoken "Clear the note to
    turn off Layavinyasam". Its nadais start as the Tala's usual nadai, since many rasikas won't
    know them (FB-29).
- **Artist and Sabha pickers** (decided 2026-11-01; T041, FR-004, FR-005): the same docked
  search. Before typing it lists the rasika's recent Sabhas or Artists; as they type, matches
  from their own and the shared lists, and the names the Season's Schedule prints that no list
  holds yet, each once (the Maintainer's iPhone, 2026-11-09: Add Artist found nothing for an
  Artist billed all Season), after the names the lists hold at the same closeness, an Artist's
  line the Role they are billed in most (the council, 2026-11-09). Picked, such a name becomes
  an own entry, as planning its listing would make it. Each result shows a distinguishing line (an Artist's
  usual Role, when known), so similar names can be told apart. Once something is typed, "Add
  “what you typed” as a new Sabha" (or Artist) is a pinned row under the title (2026-11-17; it was
  the last row, between the best match and the box), so a new entry is a deliberate choice, never
  a typo's side effect, and the best match sits next to the box.
  - After an Artist is picked, the instrument picker: Role chips, capitalised like the other
    chips (docs/design/instrument-picker.md, 2026-11-19). Eight show first, the ones the
    Season's listings bill most, in Stage order: Vocal, Veena, Flute, Violin, Mridangam,
    Ghatam, Kanjira, Morsing; right after adding, "Not sure"; then "More Roles ⌄", a quiet
    text line (not a chip) with its word on the 24px column. At a Dance, Dancer and Nattuvangam
    lead the first chips; at a Lecdem or a Harikatha, Presenter ends them. More Roles opens every
    other Role below it, in Stage order, and stays where it is as "Fewer Roles ⌃", which folds
    them again (the Maintainer, 2026-11-20): the first chips never move, and focus stays on the
    line. Every instrument has its own Role and there is no "Other" chip: an
    instrument not yet listed is left blank ("Not sure") and added to the list. An Appearance
    stored as `other` before 2026-11-19 shows "Other" pressed, last, with every Role shown,
    until another chip changes it. A Role behind More Roles that
    is the current or usual one shows pressed with every Role shown and no fold, so it is never
    hidden. An Artist
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
    support, veena, chitravina, madhuraveena, flute, nagaswaram, saxophone, clarinet, mandolin,
    guitar, keyboard, piano, sitar, sarod, santoor, jalatarangam, harmonium, violin, viola,
    mridangam, thavil, tabla, ghatam, kanjira, morsing, konnakol, other, presenter, then no
    Role; within a Role, the order added. The Roles added on 2026-11-06 and 2026-11-19 slot in without moving
    the earlier ones. This orders
    what is shown; no Role ranks above another in the Wrapped.
- **Values** (walkthrough P2 to P4, 2026-11-05; FB-32, FB-33, FB-35, FB-42). Every value is one
  kind of cell: a muted label (`sub`) tight over the value as text, underlined in `border`
  with a 4px offset, so everything that can be changed reads as such. In the Item editor
  (docs/design/item-editor.md, 2026-11-19) the cells sit on one panel with no lines inside:
  12px, the label, the value, 12px, 68px at least, growing 24px for each wrapped value line and
  16px for a note ("not matched", "catalog: Todi"); two equal columns 16px apart, one column
  once a column would be narrower than 8 em. A cell is one target and one spoken element
  ("Composer, Tyagaraja"), the two targets of a line splitting at the middle of the gap; screen
  readers read them row by row. The Concert's facts line
  takes the same underline. Importance is weight and contrast, never a fill: the Composition in
  600, Raga and Tala in full contrast, Composer, Language, Subject and Form muted. Adding a value
  is a muted "+" (with its word only where the "+" alone wouldn't say what, as "+ Nadai"), never
  an "Add" pill.
  - **Chips** are only for picking from a short fixed set: the Item kinds (RTP, Viruttam /
    Slokam, Medley), Roles, Nadais, and "?", "Not sure", "N/A". Manodharma's parts and the
    Layavinyasam are List rows with a check (2026-11-19). A chip always means "pick one of these"; a Raga is never a chip. Season's
    filter has none (2026-11-09): its toggles are text, and what is on reads in its search bar.
  - **Forms** show in sentence case, like the Roles: "Kriti", "Javali", "Varnam" (the catalog
    keeps "kriti"); the project's own keep their names ("RTP", "Slokam").
- **Search box:** 48px, surface-raised fill, 16px corners, on the 8px edge, the search mark on
  the 24px column, a 2px `ring` inset while focused. Its clear mark is a small filled circle with
  an × in it, muted, 20px in a 48px target, spoken "Clear search", so it is never taken for a
  sheet's close (2026-11-17). It is the one element allowed to autofocus on mobile: the Item
  editor opens with it focused (DD4, the recorded exception to T110's rule), and What's on's
  search sheet is the second.
- **The docked search** (docs/design/search.md, 2026-11-17): every search in the app is one
  component. Top to bottom: the sheet's title and close (on What's on, the kind toggles and the
  close), any note, the pinned rows (chips; the Action rows "? Don't know", "Use what I typed",
  "Add “…” as a new …"; What's on's picks), the results panel, then the box, standing on the
  keyboard. Only the results scroll. The sheet fits its content, growing upward to just under
  the top of the screen; with the keyboard down it stands on the screen's foot, the box its last
  line, and the list comes back to rest at its foot whenever the room changes, unless the rasika
  has scrolled it. The reading order for screen readers is the same top-to-bottom order, the
  results list labelled "best match last".
- **Search result:** the results sit on a panel, 8px from the screen with 16px corners, its top
  edge the break from the pinned rows; no divider is drawn above it, and none at all when nothing
  is pinned. On a page the panel is `panel`; on a sheet it is the page colour, one step under the
  sheet. Each result is a List row (docs/design/row.md), 68px with two lines and 48px with one,
  divided by the hairline; title in body (400), then the secondary line; a kind word ("Raga",
  "Artist") at the right on the title's line, in muted caption, not a filled badge (a fill on
  every row says nothing; 2026-11-04). The results run from weakest at the top to best at the
  foot. The best match is the one shaded row, `surface-raised`, the panel's full width as its last
  row, so it stands 8px from the screen like every fill and shares the panel's bottom corners (a
  single result takes all four), its text on the 24px column; it must stand out as clearly on a
  page as on a sheet. On a page it takes one step more, oklch(0.31 0.011 216.9) in dark: dimmed,
  surface-raised over the lighter panel read 1.33:1 against the sheet's 1.48:1 (decided
  2026-11-17, from the build). In light, where a sheet is as white as the page, the panel is `panel` on a sheet
  too and the shading oklch(0.9 0.004 214), a step under surface-raised, which over that panel
  didn't show (1.01:1; decided 2026-11-17). Enter picks it. Rows scrolled under the panel's top edge fade inside the
  panel, in its colour: solid for the first 16px, then fading over 24px, only while something is
  under it. The fixed rows above are Action rows, in body 600; the hairline under the Item kinds'
  chips sits their own 8px gap below them (walkthrough P5).
- **Search states** (decided 2026-11-01; revised 2026-11-17): before anything is typed, the
  Item editor and the Detail pickers show only their pinned rows, the Artist and Sabha pickers
  the rasika's recent names (the most recent next to the box, shaded), and What's on its "Often
  heard" names, unshaded. With no match, one muted line, "Nothing matches “…”", sits on the
  panel in the best match's place, the same words in every search, so "Use what I typed" or
  "Add new" is one row up; screen readers hear "No matches". Without the catalog on the phone,
  the box still works and one muted line at the top reads "Catalog not on this phone yet. What
  you type is kept and can be matched later in Tidy."
  - **When the room is short** (decided 2026-11-15, from the Maintainer's iPhone): the best
    match is never the row that is cut. With a keyboard up on a short screen the room left under
    the pinned rows can be less than one result. Then, once something is typed, every pinned row
    but "Use what I typed" steps aside: the kind chips and "? Don't know" in the Item editor;
    the "?", "Not sure" and "N/A" chips, the Nadai chips and a Raga's move and remove in a Detail
    picker; What's on's picks; "Add new" in the pickers. The best match stands whole and unfaded
    by the box, "Use what I typed" pinned over the results. The rows come back when the box is
    cleared or the room returns.
  - They step aside only for a best match that would otherwise be cut or faded. In the pickers,
    "Add new" steps aside along with the picks; only "Use what I typed", in Item search, always
    stays. With room for the best match, nothing changes.
  - With too little room even then (text at 200%), everything above the box scrolls as one,
    resting at its foot, with nothing hidden.
  - Before that, the fade's soft part shortens to end at the best match's top, keeping its solid
    16px, so the best match is whole and clear of it and "Use what I typed" stays (decided
    2026-11-17, from the build: on a 664px phone with the keyboard up the Item editor has 152px above the box,
    and a two-line best match with the full fade and "Use what I typed" needs 164).
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
  No "Are you sure?". Undo only for whole things: Concert, Item, Artist, Shortlist (the
  Maintainer, 2026-11-25). A piece of an Item (a Raga, a Manodharma part or its Ragas, a nadai,
  the Layavinyasam) and a title taken by a change to Concert go at once, saved, with no Undo bar.
  Behaviour (decided 2026-11-01):
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
    rule refuses the Undo, the bar says which ("Undo failed · Artist · a Lecdem has at most 6
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
  - **The dot is one drawing** (the Maintainer, 2026-11-11): every dot is 20px across, ring
    included, whatever it holds, and the halves meet on one clean line (as a bordered box with
    a gradient, a sliver of each colour showed on the other's side). With no Colours it is the
    same circle with no fill, its 1.5px muted ring dashed: a plain ring is what Black looks
    like on the dark page and White on the light one. "?" keeps its mark.
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
  every screen but the Item editor shows one thin persistent strip directly above the tab bar,
  the same on every tab, with no dismiss (the Maintainer, 2026-11-11, replacing the row under
  each title; where What's on's search bar is, the stack is search bar, strip, tab bar). On iPhone it draws
  Safari's steps as marks (the Share glyph, then Add to Home Screen); on Android it has one
  Install button that opens the browser's prompt. Installed, or on a desktop, it shows nothing.
  Why it stays: Safari can clear a website's storage after 7 days without a visit, and leaves
  installed apps alone. It is part of the shell's bottom stack, so it sits at the same place on every screen
  (FB-46): a 36px strip on iPhone, 44px on Android where it holds a button, in `sub`, muted,
  its hairline drawn inside at its top, its text on the gutter. As drawn 2026-11-03 and moved
  2026-11-11:
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
- **Something opening in place** (the Layavinyasam's note under its row) grows to its height
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

**The Season spine's words are placeholders** (2026-11-11): the Maintainer has approved the
tabs' names (Season, Shortlist, Diary) and "Shortlist" / "Shortlisted", and none of the rest.
They live in `MESSAGES.spine` (`app/src/screens/messages.ts`) and join this table once
approved: "Pick your dusk" (and morning, afternoon, evening), "On now", "in 25 min", "I'm
here", "I was there", "Earlier today", "Nothing yet", "2 at 4:00 pm", "1 in 20 min", "1 on
Mon", "1 on now", "Were you at any of these?", "Yes", "Yes, I was at …", "None of these", "None of the rest",
"Nothing more today", "Tomorrow", "Nothing listed yet",
"Concerts show here once the Schedule is out.", "Nothing shortlisted", "Shortlist a concert
from What's on to keep it here.", "Nothing heard yet", "Every concert you log is kept here.",
"No Items yet", "Add each piece as it is sung.", "Nothing here matches", "Nothing ahead
matches", "Show Past", "What's on",
"Settings, something to fix".

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
| Any screen, top              | Failures no field on screen shows (a new Concert, a Shortlist, an added Artist, values from before a relaunch). One is named by what it was, as Not saved · Concert, Mon 2 Nov, 9:17 am; several are counted | "2 not saved" · "2 changes not saved on this phone."                                                                                                                                                                      | Try again · Export · Clear |
| Clear's sheet                | Before Clear removes anything                                                                                                                                                                                  | "Is the Export saved where you can find it?" · "Clearing removes 2 changes from this phone."                                                                                                                              | Yes, clear · Not yet       |
| Any screen, top              | The Export file can't be made at all                                                                                                                                                                           | "Export failed" · "The Export couldn't be made on this phone."                                                                                                                                                            | Try again                  |
| Export button                | Handed over: a check on the button; from a store that couldn't be read, its name says so                                                                                                                       | "Exported" · "This Export holds only the changes not saved. The stored season couldn't be read; it's still on this phone."                                                                                                |                            |
| Any screen, top              | The phone's database is still opening after 10 s; the screen stays                                                                                                                                             | "Still opening your season…"                                                                                                                                                                                              | Export                     |
| Rescue screen                | The phone's database won't open; the alert mark above the title                                                                                                                                                | "Can't open your season"                                                                                                                                                                                                  | Try again · Export         |
| Home                         | New catalog (FR-038)                                                                                                                                                                                           | "An updated song catalog is ready."                                                                                                                                                                                       | Update · Later             |
| Any search                   | No match                                                                                                                                                                                                       | "Nothing matches “…”"                                                                                                                                                                                                     |                            |
| Item search                  | No catalog                                                                                                                                                                                                     | "Catalog not on this phone yet. What you type is kept and can be matched later in Tidy."                                                                                                                                  |                            |
| Undo bar                     | After a delete                                                                                                                                                                                                 | "Item 5 deleted" (or "Artist removed", "Concert deleted")                                                                                                                                                                 | Undo                       |
| Undo bar                     | The Undo itself failed to save. Only the newest failed bar shows, with "+1" for older ones                                                                                                                     | "Undo failed · Concert" (or "Item 5", "Artist") · "Undo failed: Concert. Not saved on this phone." · "+1"                                                                                                                 | Try again · Dismiss        |
| Undo bar                     | A rule refuses the Undo                                                                                                                                                                                        | "Undo failed · Artist · a Lecdem has at most 6 presenters" · "Undo failed: Artist, a Lecdem has at most 6 presenters."                                                                                                    | Try again · Dismiss        |
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
| 2026-11-11 | The hub's mockup (https://claude.ai/artifact/9M5ghrqKMGgMiJ57bQDicb) accepted by the Maintainer, with two changes: no search bar on the hub (it stays on What's on), and a concert under way shows an ink dot before its start time, in full ink, never "Now, since" (option B of two mockups, "for now"). Built as one change with the Season spine: the hub, What's on, the row, the listing sheet (Shortlist, "I'm here"), the Shortlist and the Diary, the lapse card, the tab bar with an icon over each word, the install strip above it, and the band under the iOS status bar (a rose ink in light, where the clock is white). One council round at 390px (two Claude reviewers and Codex): built, the hero's row at one place in every state, accompanists' names never broken mid-name, a clash set apart on the Shortlist, "None of these" in the text colour, room under an Event's empty state, the row's focus ring inside it; not built, as against a decision of the Maintainer's, the time in ink on every row, the clash left out of Starting soon, an ink Settings mark, and no separator before the dot. Codex's review of the data change: the app never changes a status by itself, taking a star off never deletes a log, and a log is never hidden (ADR 0010). |
| 2026-11-11 | The row's lines, from a mockup of every variant (the same artifact) measured on the Season's 542 listings at 390px: accompanists that don't fit one line show as many whole names as fit, then "+N" (the Maintainer chose B of three: A kept wrapping, C cut with "…"); with it, the lead wraps and is never cut and its type stays with its last word, a printed title stops at two lines, and the last line breaks only between its facts. Not built, shown as further ideas only: the time first on the last line, and one mark for a row both cancelled and changed. |
| 2026-11-11 | The Event's page, from the Maintainer's screenshot of it: Items, then Stage, then Note, restoring the order before 2026-11-04, so no two lines stand against each other (Note draws none above itself); an Artist's Colours are a 20px dot in place of the word, empty and dashed until set (dashed, since a plain ring reads as Black on the dark page and White on the light one); and the dot is drawn as one SVG, every dot the same size and a two-tone one's halves exact, where the bordered gradient let a sliver of each colour show on the other's side. |
| 2026-11-13 | Hub polish, after the Maintainer's day with 0.3.0 on an iPhone, mocked and taken through two council rounds (https://claude.ai/artifact/KvyNbu8WzuukzfAmy24Yr8; two Claude reviewers and Codex scored it 8.2, 7 and 7, then 9, 7.5 and 7; all three chose panels over flat). **One section pattern** for the hub and the pages to come: a header (label in `title`, a count, a chevron; the whole row opens the page) over its rows on a quiet panel, all text on one column 24px from each edge; a section with no rows carries one line under its label and no panel (the Maintainer had asked that all three sections get a panel; a panel around one grey line read as a disabled field to two reviewers, so the Shortlist has none). The first section is always **"Today"**, its rows saying "in 25 min" inside the hour and "On now" once started, from the clock alone; with nothing left today it is **"Tomorrow"**, in start order, in place of the large empty state. The Diary section always shows. **Settings is the fourth tab**, with an amber dot while a row needs fixing; the + is a 28px mark; the curtain gives its title more room and fades into the page with no sheet edge. **The star** ends the lead's line in its own column. A Diary row never says "0 Items". The question about lapsed concerts takes the pattern, with "Yes" in place of a tick. Tabs that aren't on are a step dimmer. Not changed, though three reviewers asked: the hero's concert is still the first Today row (the Maintainer's earlier call). |
| 2026-11-13 | The tab bar stays at the foot of the screen. On the Maintainer's iPhone it sat a keyboard's height (336pt) up the hub with no keyboard showing: the bottom stack rides on the keyboard's height as the visual viewport reports it, and that number was stale, since a field that leaves the page with its screen fires no blur and nothing read it again. Now a keyboard counts only while a field holds the focus, and while one does the height is read again four times a second (`app/src/hooks/use-keyboard-inset.ts`). |
| 2026-11-13 | The tab bar off the bottom edge on the Maintainer's iPhone, once the app was added again and drew under the clock: 59pt up, the height of the top inset. An installed iPhone app with `black-translucent` reports 100dvh, 100% and `innerHeight` short of the screen by that inset (reported by several projects on iOS 26 and 27; not in Apple's notes), and only 100lvh is the whole screen. The app now sizes itself by `--app-height`: 100dvh, and 100lvh in an installed iPhone app. Not provable off the phone, so Settings closes with a "Screen" line that says how the phone sized the page. |
| 2026-11-14 | Maintainer 2026-11-14: the curtain keeps its sheet edge and half fade; the council's flat fade is reverted. Seen live on 2026-11-13 and not liked ("Please bring back the old kind of curtain"). Back: the 18px sheet edge, the fade halfway to the page, and the curtain's 96px. Kept from that round, as the Maintainer's own asks: the 24px column and the 8px more above the title, the 28px +, Settings as a tab. The council's worry, a sheet corner against a panel's, was checked at 375px in dark and light: the section's header stands between them, 66px apart, and they don't meet. |
| 2026-11-16 | The foundations (docs/design/foundations.md), signed off by the Maintainer one decision at a time, each taken through two council rounds: panels everywhere, every fill 8px from the screen with 16px corners and all text 24px from it; one rhythm, rows 12px top and bottom (68px for two lines), sections 32px apart, a label 8px over its panel; one type scale, every label above a panel in body 600, every page title in heading 700, live or selected in 600 ink, times and counts never in caption, 500 retired. |
| 2026-11-16 | The list row (docs/design/row.md), signed off by the Maintainer one decision at a time, each through council rounds: four kinds of row (Concert, Item, List, Action), one tap each with at most one nested control; every name on the column, the kind mark after it; the facts line time first, leaving out what its label says; chevrons only on List rows that open a page; a facts line two lines at most, cut with "…"; dividers across the text column; a cancelled row says "Cancelled" in its time's place. |
| 2026-11-17 | The open questions from the foundations and row build, answered by the user: a lapse row opens its concert, with "Yes" its own target; under a Shortlist slot's time a concert under way reads "● On now · Sabha"; a List row's nested control (the Stage colour dot) sits on its last line; on a facts line's second line the Sabha is cut first, so the Item count always shows; the Concert summary's "First Ragas" and "New Composers" labels are `sub`. Kept as built: the fade alone above the bottom bar, the ramped top fade and the tab bar's top line; the 16px gap after a clash; the Laya note field inside its panel, on the text column; the fade starting 24px above the bar. Row height worded as +24 for a wrapped Body line and +20 for each `sub` line. Deferred: the search kind word (search spec) and the Raga row (Item editor spec). |
| 2026-11-17 | The search (docs/design/search.md, https://claude.ai/artifact/87wzk7mxDwMwWbUh9mAv4p), signed off by the user one decision at a time, each through two council rounds (two Claude reviewers and Codex): one docked search everywhere, What's on included ("Prefer it all look more like Item search"), its field at the foot on the keyboard and the best match shaded next to it; "Add new" a pinned row in the pickers, so the best match always touches the box; before typing, What's on shows up to five names heard most often, under "Often heard" (lead Artists only, names with a listing ahead only, nothing shaded), and the A-to-Z list goes; picked names pinned at the top, kind word then check, the toggles in the close's row, a pick taken off staying in place until the sheet closes; results on a panel (on a sheet, one step darker), the best match's shading the panel's full width at its foot, one no-match line "Nothing matches “…”" in its place, and a filled clear mark. PR 46's rule for a short room is part of it. Not chosen: the field at the foot with the best match at the top; two layouts as built; the A-to-Z list kept; nothing before typing; the toggles in a strip by the field; the kinds as chips (against the Maintainer's call of 2026-11-10); results flat; a second panel for the pinned rows. |
| 2026-11-17 | The band under the clock in light, and the "Screen" line, from the Maintainer's iPhone screenshot of Settings. The band was a dark rose ink and "needs to change"; iOS draws the clock white in an installed app whatever the theme (`black-translucent`), so a lighter band costs the clock's legibility. Four options mocked at 393px in light (a mid rose at 4.6:1, the blush at 2:1, the page's white at 1:1, a mid grey at 4.9:1); the Maintainer chose the blush, `--motif-blush`, for the band and the hub's light wash under the clock. The "Screen" line (2026-11-13) is gone from Settings: the Maintainer's screenshot showed the page the whole screen and the tab bar at its foot, so it had done its work; it was not moved behind the Maintainer page. |
| 2026-11-19 | The Item editor (docs/design/item-editor.md, https://claude.ai/artifact/9yR1gM5UBA1KbUS9p54EVS), signed off by the user one decision at a time, each through council rounds (two Claude reviewers and Codex): the Details on one panel with no lines inside, each value a 68px label-over-value cell, the whole cell its target, the Raga's value as tight under its label as the rest (the Raga row deferred on 2026-11-17); no "Edit order" on the Raga line: a Raga's order and removal in its sheet, "← Earlier", "Later →" and "Remove" in fixed places, the sheet staying open after a move, Undo after a removal, no "N/A" for one Raga of several; "Improvised" becomes Manodharma (Alapana, Tanam, Niraval, Kalpanaswaram) as List rows with a check (the user's choice over the council's chips), reopened by the user the same day: a part can go through several Ragas but silently follows the Item's, since a Raga beyond it is rare ("1 in every 10-15 compositions"), shown once by a hint and always in an RTP, changing before adding in one sheet per part; the Layavinyasam (one word) leaves it for its own one-row panel, its nadais a list shown more plainly ("Chatusra   + Nadai", then "Khanda, Tisra"); every turn-off offers Undo. Parts' Raga lists and the Layavinyasam's nadai list need a store change and an ADR. Not chosen: the Details flat on the page, the panel with hairlines, label-column rows; "Edit order" turning the Ragas into rows, the arrows inline as built; a row per part with its chip, the chips together; no hint, a "Ragas" mode on the fold's label; the Layavinyasam in its own fold or as a cell beside Form. For later: a check in every pressed chip (all three reviewers), the phase-4 contrast pass on underlines and muted values, the Layavinyasam's note rule now that every turn-off offers Undo. |
| 2026-11-19 | The instrument picker (docs/design/instrument-picker.md), decided by the user: every instrument the logger has seen gets its own Role (madhuraveena, clarinet, guitar, keyboard, piano, sitar, sarod, santoor, jalatarangam, harmonium, viola, tabla, konnakol join the eighteen), so none is pushed under "Other"; the list stays closed, and an instrument not yet on it is left blank and added, never typed in. Eight chips show first, the ones the Season bills most (Vocal, Veena, Flute, Violin, Mridangam, Ghatam, Kanjira, Morsing); More opens the rest after them without moving them. "Other" is no longer offered; rows stored as `other` keep it. HandSonic (an electronic pad) and a conductor get no Role and stay blank. The drum shows as "Kanjira", as the listings print it; the stored key stays `khanjira`. |
| 2026-11-20 | The Item editor's build (docs/design/item-editor.md §6), two choices the spec left open, answered by the user: the Tala's nadai is shown as Chatusra for every known Tala with no Nadai set, chapu talas included ("Keep Chatusra"); and in a Manodharma part's sheet, "Remove" on one of its own Ragas offers "Raga removed · Undo", and "Use the Item’s Raga only" offers "Ragas removed · Undo". |
| 2026-11-20 | The Maintainer's alignment fixes from iPhone shots of the Composer, Tala and Artist sheets and the Stage row, measured on 0.4.0 at 393px and decided one at a time from mocks, the council split on the first two: a chip is a fill, so a chip row stands on the 8px edge with its first word on the 24px column (a 1px border and 15px padding), as the search field and the Colours button do, on every chip row (the Detail sheets, the Layavinyasam's, the Role picker, the Event's kinds, the Item editor's form chips); a List row's one control (the Stage colour dot, the Manodharma and Layavinyasam checks) centred on the row's text rather than its last line; the Role label 8px above its chips, as "Nadai". More becomes "More Roles ⌄", a quiet text line under the first chips that stays in place as "Fewer Roles ⌃" and folds the other Roles again (council 9, 8, 8 over "Fewer" at the end, and over a toggle beside "Role"); "Not sure" moves before it; a pressed Role behind it shows every Role with no fold. Not chosen: the field and Colours pulled in to the 24px column; the dot kept on the last line; a "Fewer" chip at the list's end or in More's place. |
| 2026-11-21 | The Hub, the first screen of phase 3 (docs/design/screens/hub.md, https://claude.ai/artifact/EPYctkjFMgsjTmFBqMDYyf), signed off by the user one decision at a time, each through two council rounds (two Claude reviewers and Codex) with real renders at 390 × 844: the hero's concerts are never shown again under Today, another day or as the Diary's row (B, over two of the Maintainer's rules of 2026-11-13; "Nothing else ahead" when only the hero is ahead); "Today" and "Tomorrow" wherever the hub names those days, no "Yesterday" (B); the hero written as a row, time first, its kind's mark and instrument word after the name, under way its start time with no dot (B). Applied from foundations U45: the update row's words in Sub. Left for phase 4: the "Yes" pill, the Empty's spacing, the 28px +, real lines against hairlines, and day words on other screens. |
| 2026-11-21 | Manodharma's panel (docs/design/manodharma-panel.md, https://claude.ai/artifact/Ba4YBkZYc19bmbCi5XjXvA), decided by the user from shots of the built app: closed, the fold was a bare label beside the Layavinyasam's one-row panel, so the fold becomes its own panel, one row closed, grown by the parts when open, the panels 32px apart. Not chosen: always open (212px taller on a plain kriti); as built. |
| 2026-11-24 | What's on, the second screen of phase 3 (docs/design/screens/whats-on.md, https://claude.ai/artifact/UMTDPXSWmK5nP21muUR48E), signed off by the user ("Sign off all four") after three council rounds (two Claude reviewers and Codex) on renders at 390 × 844 with the hill-climb seed and the real 2026-27 feed: three or more concerts under way, with something still to come today, fold into one "On now" row under "Earlier today" (B; at 4:10 pm on peak days the next start had been below the first screen on 18 of 18 days), and "Earlier today" starts open when it would be all the list shows; today's and tomorrow's labels read "Today · Mon 14 Dec" and "Tomorrow · Tue 15 Dec" (C, the Hub's day words brought forward for What's on); from today, an empty list offers "Show Past" when the days gone hold anything, and under a filter reads "Nothing ahead matches" (B); today reads the same with or without a filter, its folds and dot kept (C, replacing "a list a filter narrowed shows whole" for today). Not chosen: opening at the next start (against the Maintainer's rule of 2026-11-09), "Today" alone, Past always on the strip (against SF-D32), the dot alone under a filter. |
| 2026-11-25 | The bottom stack sits on the screen's bottom edge. On the Maintainer's iPhone, in a Safari tab, it sat about 85pt up once Safari's toolbar had hidden, What's on's rows scrolling under the tab bar, and flickered as the page moved: Safari on iOS 26 leaves a sticky bottom where the toolbar's top was (Apple developer forums thread 801028). The user chose to keep the page scrolling as it does and pin the stack to the screen (`position: fixed`), a spacer keeping its height at the page's end; a frame where only the middle scrolls would have kept Safari's toolbar from ever hiding. |
| 2026-11-25 | Undo only for whole things: Concert, Item, Artist, Shortlist (the Maintainer, 2026-11-25: "remove the undo sonner on layavinyasam, manodharma etc. Kinda annoying. It's okay if they lose it out."). A Raga, a Manodharma part turned off, a part's own Ragas ("Remove", "Use the Item’s Raga only"), a nadai, the Layavinyasam, and a title taken by a change to Concert (a kind change or "Take it", T122) save at once, journalled as before, with no Undo bar. A piece or title Undo kept on a phone by an earlier build is dropped quietly. |
