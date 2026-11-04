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

| Case          | Event                                                                     | What's in it                                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty season  | none                                                                      | Shot before the seed goes in (`season-empty`).                                                                                                                                                                                                                           |
| In progress   | Music Academy, today 6:00 pm                                              | A vocal duo (Ranjani & Gayatri) and four accompanists (violin, mridangam, ghatam, khanjira); the event note; 11 Items: nine catalog songs (one tala marked a guess), an RTP in Kalyani and Kanada, and a typed "Tillana". Chakkani Raja has a Laya vinyasam with a note. |
| Long names    | Sri Parthasarathy Swami Sabha, Vidya Bharathi Kalyana Mandapam, yesterday | Three Artists with names that wrap; two songs and a typed Item with a long title.                                                                                                                                                                                        |
| No Artist yet | no Sabha, Sat 12 Dec                                                      | Attended, nothing added: the "Add Artist" heading and "Add Sabha".                                                                                                                                                                                                       |
| Next          | Sri Krishna Gana Sabha 15 Dec; Narada Gana Sabha 16 Dec                   | Planned, one Artist each.                                                                                                                                                                                                                                                |

**Colours:** all 12 swatches and "didn't notice" appear across the Stage rows. Two-tone:
red and white, blue and orange, green and beige, brown and pink. One colour: yellow, black,
purple, grey. Didn't notice: the khanjira.

## Views

`season-empty`, `season`, `concert`, `concert-full` (whole page), `concert-bare`,
`concert-long` (whole page), `concert-order` (Edit order on), `concert-facts` (date and time
sheet), `artist-picker` (Add Artist, "S" typed), `artist-sheet` (Gayatri), `colour-sheet`
(Ranjani, two-tone), `item-search` (new Item, "rama" typed), `item` (Chakkani Raja, whole page,
Laya vinyasam open), `item-rtp` (two Raga chips), `raga-sheet`, `tala-sheet`, `settings`.

Each at 390×844 and 393×852 (iPhone 16), dark and light. The keyboard isn't drawn: Chromium
has none, so search views show the results with the box at the bottom.

**Motion strips** (`rig.ts motion`): `sheet-open` (the Colour sheet rising), `colour-pick` (a
swatch chosen, the save highlight), `laya-mark` (marking the Laya vinyasam, FB-28's flash),
`add-item` (Add Item to the Item editor), `item-done` (Done back to the Concert). Each strip is
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
