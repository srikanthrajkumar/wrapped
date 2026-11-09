# The UI hill-climb's seed

The fixed dataset every hill-climb round is shot against (docs/feedback/ui-hill-climb.md §1).
There is no server or account yet: the app is local-first, so the seed is written in the page
through the app's own store actions (`e2e/harness`), never by hand into IndexedDB. It lives in
a throwaway browser profile that the rig creates and discards on each run, so there is nothing
to clean up on any phone or server.

- **Written by:** `e2e/hill-climb/seed.ts`, called by `rig.ts` after first launch.
- **Clock:** fixed at Mon 14 Dec 2026, 7:30 pm in Chennai (`Asia/Kolkata`), so the Concert in
  progress holds Now and the dates never drift between rounds.
- **Catalog:** the local snapshot `catalog.b680de2c….json` in `app/public/catalog/` (gitignored,
  never committed). Songs are looked up by title, Ragas by name.
- **Installed:** `navigator.standalone` is true, so no install row shows, as on the
  Maintainer's iPhone.
- **Ids:** random per run; each run writes them to `<out>/seed-ids.json`.

## What it holds

| Case          | Event                                                                     | What's in it                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty season  | none                                                                      | Shot before the seed goes in (`season-empty`).                                                                                                                                                                                                                                                                                            |
| In progress   | Music Academy, today 6:00 pm                                              | A vocal duo (Ranjani & Gayatri) and four accompanists (violin, mridangam, ghatam, khanjira); the event note; 11 Items: nine catalog songs (one tala marked a guess), an RTP in Kalyani and Kanada, and a typed "Tillana". Chakkani Raja has a Laya vinyasam with a note.                                                                  |
| Long names    | Sri Parthasarathy Swami Sabha, Vidya Bharathi Kalyana Mandapam, yesterday | Three Artists with names that wrap; two songs and a typed Item with a long title.                                                                                                                                                                                                                                                         |
| No Artist yet | no Sabha, Sat 12 Dec                                                      | Attended, nothing added: the "Add Artist" heading and "Add Sabha".                                                                                                                                                                                                                                                                        |
| Next          | Sri Krishna Gana Sabha 15 Dec; Narada Gana Sabha 16 Dec                   | Planned, one Artist each.                                                                                                                                                                                                                                                                                                                 |
| Schedule      | nine entries: one each on 12 and 13 Dec (days gone), seven 15 to 17 Dec   | `SCHEDULE` in seed.ts: two past Concerts, on Season's Past tab; then a vocal group with a violinist, a Dance, a violinist, a veena, a mridangam, one with nobody billed, and one cancelled. Written into the store as a fetched file leaves them (the feed isn't rasika data, so no store action writes it), as e2e/schedule.spec.ts does. |

**Colours:** all 12 swatches and "didn't notice" appear across the Stage rows. Two-tone:
red and white, blue and orange, green and beige, brown and pink. One colour: yellow, black,
purple, grey. Didn't notice: the khanjira.

## Views

`welcome` (first launch, on a phone of its own that never finishes it), `season-empty`, `season-own` (the seed's own Events before the Schedule goes in), `season-own-past` (the same seed's days gone, from the strip's Past), `season` (Season as it opens: the hero holding the Concert in progress, the strip on Today, the search bar), `season-next` (the next morning: the hero holding the next Planned concert), `season-pinned` (scrolled into the days: the strip pinned, the list fading under it), `season-past` (the strip's Past), `season-calendar` (the strip's calendar sheet), `season-search` (the search sheet after a pick, with Dance on), `season-filtered` (two Sabhas picked: the bar reading them, the strip left with their days), `season-nomatch` (Dance on Past, which matches nothing there: the clear), `entry-sheet` (the first Schedule entry's sheet), `concert`, `concert-full` (whole page), `concert-bare`,
`concert-long` (whole page), `concert-order` (Edit order on), `concert-drag` (Item 3 held
mid-drag by its grip), `concert-facts` (date and time sheet), `artist-picker` (Add Artist, "S" typed), `artist-sheet` (Gayatri), `colour-sheet`
(Ranjani, two-tone), `item-search` (new Item, "rama" typed), `item` (Chakkani Raja, whole page,
the Improvised fold open with its Laya vinyasam), `item-rtp` (two Ragas), `raga-sheet`,
`tala-sheet`, `settings`, and last `concert-summary` (the clock three hours on, so the Concert in
progress has ended and its summary shows; "shown" is reset for it on each look).

Each at 390×844 and 393×852 (iPhone 16), dark and light. Chromium runs with software WebGL
(SwiftShader), so the motif draws as it does on a phone. `HC_VIEWS=welcome,season` narrows a
round to some views; `council` then composes only the views shot. The keyboard isn't drawn: Chromium
has none, so search views show the results with the box at the bottom.

**Motion strips** (`rig.ts motion`): `sheet-open` (the Colour sheet rising), `colour-pick` (a
swatch chosen, the save highlight), `laya-mark` (marking the Laya vinyasam, FB-28's flash),
`sheet-close` (the Colour sheet sliding back down), `menu-open` (the "⋯" menu), `fold-close`
(the Note fold closing), `add-item` (Add Item to the Item editor), `item-done` (Done back to the
Concert). Each strip is
the frame before, then the animation held at 0, 15, 30, 50, 75 and 100% of its length, then
settled.

## Running it

```bash
npm run build -w app
```

```bash
npx vite preview --port 4391 --strictPort
```

From `app/`, with the preview running:

```bash
npx tsx e2e/hill-climb/rig.ts shots <out> && npx tsx e2e/hill-climb/rig.ts council <out> [baseline]
```
