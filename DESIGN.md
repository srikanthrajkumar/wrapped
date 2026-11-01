---
# gstack: design-md-format=spec
name: Carnatic Wrapped
base: "shadcn preset b51rn04Qt (style Rhea, Mist neutrals, rose charts, Tabler icons)"
colors:
  dark:
    background: "oklch(0.148 0.004 228.8)"
    surface: "oklch(0.218 0.008 223.9)"
    surface-raised: "oklch(0.275 0.011 216.9)"
    foreground: "oklch(0.955 0.014 80)"
    muted-foreground: "oklch(0.76 0.014 75)"
    primary: "oklch(0.925 0.005 214.3)"
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
app departs from them (warm text, the type scale, touch targets, motion).

Names are shown in plain English spelling: "Todi", "Kaddanuvariki", "Tyagaraja", never "Tōḍi" or
karnatik's "tODi" (catalog-snapshot contract).

## Colors

**Dark is the default** and the theme the screens are designed in. Light is offered in Settings.

- **Warm text.** Foreground and muted text carry a slight warm cast (hue 75–80) instead of Mist's
  cool grey, which reads as clinical under hall lighting. Surfaces keep Mist's cool near-black.
- **Restrained.** The app uses greys, the near-white (dark) or near-black (light) primary for
  actions, and the destructive red only for delete. **Rose appears only in charts** on the Wrapped
  screen. Rose replaced the preset's emerald because black with green is Spotify's look.
- **Depth by lightness, not shadow** (dark): background → surface (rows, cards, the best search
  result) → surface-raised (chips, the search field, sheets).

Contrast, measured (WCAG 2.x ratios):

| Pair | Dark | Light |
|---|---|---|
| foreground on background | 17.3 | 18.1 |
| muted-foreground on background | 9.2 | 6.0 |
| muted-foreground on surface-raised | 6.9 | 5.4 |
| destructive on background | 6.8 | 4.8 |

**No white flash.** The page background is set before any script runs (inline `background` on
`html` and a matching `theme-color` meta for each scheme), so launching, navigating and the
splash never show white in dark mode.

### Outfit colours (the 12 swatches)

The palette is the 12 colours in last season's Colours sheet (data-model.md). Each swatch is
drawn with its name below it and a 1px `border` ring, so white shows on light and black on dark.

*Proposed values, to confirm in `/plan-design-review`:*

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

Phone width only (360–430px), one column, built and checked at 390px.

- **Spacing** on a 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48. The screen gutter is 16px plus
  the safe-area inset. Related lines sit 4px apart; rows 8px; sections 24–32px.
- **Thumb zone.** Primary actions sit in the bottom third: the fixed "Add Item" bar, the
  docked search box, "Done" and "Next Item →". Headers hold only the back button and a title.
- **Navigation (DD1).** Three bottom tabs: Season (home), Wrapped, Settings. Event and Item are
  pushed screens with a back gesture. The tab bar hides while the Item editor is open.

**Screen layouts** (top to bottom; the full rules are DD2–DD5 in plan.md):

- **Season (home, DD2):** Now (one large block with one primary action, "Start logging" or
  "Continue: N Items"; with nothing on, "Log a Concert now" and a smaller "Lecdem") → Next
  (upcoming Planned Events by day) → Season so far (Attended Events, newest first, with Item
  counts, and one line to the Wrapped).
- **Event (DD3):** one-line header (Sabha · date · time, tap to edit) → running order (numbered
  rows: title, then Raga · Composer) → Stage (Appearances in billing order, Colours optional) →
  the note. "Add Item" is a fixed full-width 56px bar at the bottom.
- **Item editor (DD4):** search box docked above the keyboard, results growing upward with the
  best match nearest the box, then the fixed rows ("Use what I typed", "? Don't know", RTP,
  Viruttam / Slokam, Medley). After a pick, the Details as a grid of tappable values, with the
  Laya vinyasam and improvised Details folded underneath. Bottom bar: "Done", "Next Item →".
- **Wrapped (DD5):** headline numbers → the range as a quiet subtitle → a vertical list of 9:16
  Card previews, each with its own Share.
- **Settings:** theme, offline readiness, Export, sync and account, consent; the Maintainer's
  `/admin` link. *Outline only; laid out in the review.*

## Elevation & Depth

- **Dark:** no shadows. Layers are told apart by lightness (background, surface,
  surface-raised) and the 10% white border.
- **Light:** borders do the same job; only sheets and menus take a soft shadow.
- **Sheets** (Colour picker, edit menus) rise from the bottom over a 50% black scrim. Menus use
  the preset's inverted translucent style.

## Shapes

- Radius base 10px (preset `--radius: 0.625rem`), scaled: 6 / 8 / 10 / 14 / 18px.
- Rows and buttons: 14–18px, so tap areas read as soft blocks in the dark.
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
- **Search box:** 48px, surface-raised fill, a 2px `ring` inset while focused. It is the one
  element allowed to autofocus on mobile: the Item editor opens with it focused (DD4, the
  recorded exception to T110's rule).
- **Search result:** at least 60px; title in body 600, then the secondary line. The best match
  sits on `surface`. A Raga result carries a "Raga" badge and the line "Start this Item with
  only its Raga".
- **Buttons:** primary fills with `primary`; secondary is a 1px border on transparent. Every
  target is at least 48px; the main action on a screen is 56px. Pressed state: opacity 0.6
  (base.css), with no hover styles outside `(hover: hover) and (pointer: fine)`.
- **Saving:** no Save button and no toast. A changed or new row takes a surface-raised
  highlight that fades out over 1.2s.
- **Deleting:** removes at once and shows an Undo bar above the bottom actions for 5 seconds.
  No "Are you sure?".
- **Reordering:** a separate edit mode on the Event screen with explicit move controls. No drag
  during a Concert.
- **Colour sheet:** a grid of the 12 labelled swatches plus "?", then an optional second colour
  for a two-tone outfit.
- **Finishing a Concert:** "Done with this Concert" shows a short summary of the Concert and
  what it changed in the season (a first Raga, a new Composer). It does not link into the
  Wrapped.
- **Status:** saving and sync show only a quiet indicator on logging screens; messages and
  details live in Settings (DD6).

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

## Still open (for `/plan-design-review`)

From the deferred findings in plan.md, not yet designed:

- The first launch: a welcome screen before sign-in, and the empty home (finding 5).
- "Did you go?" for past Planned Events never opened (finding 8).
- "Ready for offline": logging versus share images (finding 9).
- The restore banner (finding 10) and the conflict screen (finding 11).
- The Card template: safe zones, one headline per Card, the wordmark, the white swatch, minimum
  data, the empty Wrapped (finding 12).
- The wording of system and sync messages (DD6, finding 15).
- Smaller states: cancelled versus "schedule changed", the catalog-update prompt, consent
  toggles offline, Share in progress or failed (finding 16).
- The outfit swatch values above, and the Settings layout.

## Decisions Log

| Date | Decision |
|---|---|
| 2026-10-31 | Preset `b51rn04Qt`; shadcn/ui and Tailwind (ADR 0006); Source Sans 3 everywhere; rose for charts. |
| 2026-11-01 | Warm text; dark by default; the six Detail states; screen behaviour (save, delete, reorder, colour sheet, finishing a Concert); plain English names. |
| 2026-11-01 | Preview of the Event screen and Item editor approved. |
| 2026-11-01 | Tokens: 17px body on a 13–32 scale, 4px spacing, 48px targets and 56px main actions, the motion rules. |
