// The 2024-25 reference import (T045, FR-039, FR-040, SC-005). Reads last season's sheet,
// matches every Item through the app's own matching, reports how many matched a Composition,
// were "?", were special forms with no Composition, or stayed Unresolved, and writes the
// season as a test fixture only, never into a rasika's log, lists or Wrapped.
//
// Run from the repository root, with the private catalog snapshot (CONTRIBUTING.md):
//
//   npx tsx tools/import-2024-25/import.ts [path/to/catalog.<sha256>.json]
//
// Without a path it uses the one snapshot in app/public/catalog/. Writes:
//   app/tests/fixtures/reference-2024-25.json  the season as records, and the four rates
//   tools/import-2024-25/report.md             the rates, and what didn't match, for the Maintainer

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readSheet } from 'read-excel-file/node';
import { CATALOG_FILE, verifySnapshot } from '../../app/src/catalog/load';
import { buildMatcher, type KeptForm } from '../../app/src/catalog/match';
import { buildIndex } from '../../app/src/catalog/search';
import type { Appearance, Event, SharedEntry } from '../../app/src/model';
import {
  convertConcert,
  convertItem,
  convertLecdem,
  People,
  stableId,
  text,
  type ImportedItem,
  type Outcome,
  type Row,
} from './convert';

const ROOT = join(import.meta.dirname, '../..');
const SHEET = join(ROOT, 'docs/reference/wrapped-2024-25.xlsx');
const FIXTURE = join(ROOT, 'app/tests/fixtures/reference-2024-25.json');
const REPORT = join(import.meta.dirname, 'report.md');

function snapshotPath(): string {
  const given = process.argv[2];
  if (given) return given;
  const dir = join(ROOT, 'app/public/catalog');
  const found = (() => {
    try {
      return readdirSync(dir).filter((name) => CATALOG_FILE.test(name));
    } catch {
      return [];
    }
  })();
  if (found.length !== 1) {
    throw new Error('give the snapshot path, or put exactly one snapshot in app/public/catalog/');
  }
  return join(dir, found[0]!);
}

const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const rows = async (sheet: string) => ((await readSheet(SHEET, sheet)) as Row[]).slice(1);

async function main() {
  const path = snapshotPath();
  const bytes = readFileSync(path);
  const catalog = await verifySnapshot(
    basename(path),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  const keptForms = json<KeptForm[]>(join(ROOT, 'app/src/reference/forms.json'));
  const matcher = buildMatcher(catalog, keptForms);
  const people = new People(
    json<{ artists: SharedEntry[]; sabhas: SharedEntry[] }>(
      join(ROOT, 'app/src/reference/shared-lists.seed.json'),
    ),
  );

  const eventIdFor = (concert: number) => stableId(`concert:${concert}`);
  const main = (await rows('Main')).filter((row) => text(row[0]) !== '');
  const colours = new Map((await rows('Colours')).map((row) => [Number(row[0]), row]));
  const events: Event[] = [];
  const appearances: Appearance[] = [];
  for (const row of main) {
    const concert = convertConcert(
      row,
      colours.get(Number(row[0])),
      people,
      eventIdFor(Number(row[0])),
    );
    events.push(concert.event);
    appearances.push(...concert.appearances);
  }

  const compositions = (await rows('Compositions')).filter((row) => text(row[0]) !== '');
  const positions = new Map<number, number>();
  const imported: ImportedItem[] = compositions.map((row) => {
    const concert = Number(row[1]);
    const position = (positions.get(concert) ?? 0) + 1;
    positions.set(concert, position);
    return convertItem(row, position, { catalog, matcher, keptForms, eventIdFor });
  });

  // Concerts with Items but no row in Main get an Event with nothing else known.
  const known = new Set(main.map((row) => Number(row[0])));
  const missing = [...positions.keys()].filter((concert) => !known.has(concert));
  for (const concert of missing) {
    events.push(convertConcert([concert], undefined, people, eventIdFor(concert)).event);
  }

  for (const row of (await rows('Lecdems')).filter((row) => text(row[5]) !== '')) {
    const lecdem = convertLecdem(row, people);
    events.push(lecdem.event);
    appearances.push(...lecdem.appearances);
  }

  const outcomes: Outcome[] = ['composition', 'unknown', 'special', 'unresolved'];
  const rates = Object.fromEntries(
    outcomes.map((outcome) => [outcome, imported.filter((i) => i.outcome === outcome).length]),
  ) as Record<Outcome, number>;
  const total = imported.length;
  const resolved = rates.composition + rates.unknown + rates.special;

  writeFileSync(
    FIXTURE,
    `${JSON.stringify(
      {
        about:
          'Last season (2024-25) from docs/reference/wrapped-2024-25.xlsx, as app records: a test fixture only, never part of a rasika log, list or Wrapped (FR-040). Written by tools/import-2024-25/import.ts.',
        catalogVersion: catalog.version,
        concertDatesKnown: false,
        rates: { total, ...rates },
        events,
        appearances,
        items: imported.map((i) => i.item),
        artists: [...people.artists.values()],
        sabhas: [...people.sabhas.values()],
      },
      null,
      2,
    )}\n`,
  );

  // What the search box would offer for the same typing: the top 3 for each title.
  const index = buildIndex(catalog);
  const top3 = (title: string) =>
    index
      .search(title, 3)
      .map((result) =>
        result.kind === 'song'
          ? `${result.song.title} (${result.song.raga?.display ?? result.song.ragamalika.map((r) => r.display).join(', ')}, ${result.song.composer?.display ?? '?'})`
          : `raga ${result.raga.display}`,
      );
  const matched = imported.filter((i) => i.outcome === 'composition');
  const offered = matched.filter((i) =>
    index
      .search(i.item.title, 3)
      .some((r) => r.kind === 'song' && r.song.kritiId === i.item.compositionKey),
  ).length;
  // A rough stand-in for "the search box would have offered it" when no answer is known: the
  // top 3 holds a song in a Raga logged with the Item.
  const unresolvedItems = imported.filter((i) => i.outcome === 'unresolved');
  const inLoggedRaga = unresolvedItems.filter((i) => {
    const logged = new Set(i.item.ragas.flatMap((r) => (r.key ? [r.key] : [])));
    return index
      .search(i.item.title, 3)
      .some(
        (r) =>
          r.kind === 'song' &&
          [r.song.raga, ...r.song.ragamalika].some((raga) => raga && logged.has(raga.key)),
      );
  }).length;

  const fields = ['tala', 'composer', 'language', 'subject'] as const;
  const detailRows = [
    ['raga', imported.flatMap((i) => i.item.ragas)] as const,
    ...fields.map((field) => [field, imported.map((i) => i.item[field])] as const),
  ].map(([field, values]) => {
    const count = (state: string) => values.filter((v) => v.state === state).length;
    const unresolved = new Map<string, number>();
    for (const v of values)
      if (v.state === 'unresolved') unresolved.set(v.text, (unresolved.get(v.text) ?? 0) + 1);
    const list = [...unresolved]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t, n]) => (n > 1 ? `${t} (${n})` : t))
      .join(', ');
    return `| ${field} | ${values.length} | ${count('catalog') + count('override')} | ${count('unknown')} | ${count('na')} | ${count('unresolved')} | ${list} |`;
  });

  const pct = (n: number) => `${((100 * n) / total).toFixed(1)}%`;
  const sheetItem = (i: ImportedItem) =>
    `| ${i.sheetRow} | ${i.item.title} | ${i.item.ragas.map((r) => r.text).join(' + ')} | ${i.item.composer.text} | ${i.why} | ${top3(i.item.title).join('; ')} |`;
  const report = `# 2024-25 reference import

Written by \`tools/import-2024-25/import.ts\` (T045) against catalog ${catalog.version}. Every Item
of last season's sheet went through the app's matching (\`app/src/catalog/match.ts\`): a title
matches a Composition only when it folds to exactly one song's title or title alias, or when
the Raga and Composer logged with it pick one out of several songs of that title.

## The four rates (SC-005)

| Outcome | Items | Share |
|---|---|---|
| Matched a Composition | ${rates.composition} | ${pct(rates.composition)} |
| "?" | ${rates.unknown} | ${pct(rates.unknown)} |
| Special form, no Composition | ${rates.special} | ${pct(rates.special)} |
| Unresolved | ${rates.unresolved} | ${pct(rates.unresolved)} |
| **Resolved without cleanup** | **${resolved} of ${total}** | **${pct(resolved)}** (target 90%) |

Search: for ${offered} of the ${matched.length} matched Items, typing the title as the sheet has it
puts the matched song in the search box's top 3. For ${inLoggedRaga} of the ${unresolvedItems.length} Unresolved
Items, the top 3 holds a song in the Raga logged with it, a rough sign the search box would have
offered the right song where exact matching could not.

## Details

How each Detail as typed in the sheet matched (an Item's Ragas each count once).

| Detail | Values | Matched | "?" | Not applicable | Unresolved | Unresolved as typed |
|---|---|---|---|---|---|---|
${detailRows.join('\n')}

## Unresolved Items

Each with why, and what the search box offers for the title as typed.

| Row | Title | Raga | Composer | Why | Search top 3 |
|---|---|---|---|---|---|
${unresolvedItems.map(sheetItem).join('\n')}

## Notes

- Exact matching is deliberate (constitution III, never guess); closer matching is the
  phonetic-search work (T027). Two Ragas or Composers whose names fold alike are refused, so
  catalog near-duplicates (for example "Hamsadhvani" and "Hamsadvani", or "Ragamalika" beside
  "Ragamalika?") leave a typed name Unresolved. Songs listed twice with the same Raga and Composer
  leave their title Unresolved the same way.
- The sheet has no Concert dates, so every Concert in the fixture is dated 2024-12-01.
${missing.map((concert) => `- Concert ${concert} has Items but no row in the Main tab, so it has no Artists or Sabha.`).join('\n')}
`;
  writeFileSync(REPORT, report);

  console.log(
    `${total} Items: ${rates.composition} Composition, ${rates.unknown} "?", ${rates.special} special form, ${rates.unresolved} Unresolved; ${pct(resolved)} resolved (target 90%).`,
  );
  console.log(`Search top 3 offers the matched song for ${offered} of ${matched.length}.`);
  console.log(
    `For ${inLoggedRaga} of ${unresolvedItems.length} Unresolved, search top 3 holds a song in the logged Raga.`,
  );
  console.log(`Wrote ${FIXTURE} and ${REPORT}`);
}

await main();
