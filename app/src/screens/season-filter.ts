// Season's filter (the Maintainer, 2026-11-09; DESIGN.md "Season"): one box, "Artist or Sabha…",
// suggesting from the names in this Season's Schedule and the rasika's own Events: billed Artists,
// groups by their group name, and Sabhas with their Aliases (KGS finds Krishna Gana Sabha). A
// pick is a chip. Picks of one sort widen the list (TM Krishna or Sanjay); picks of different
// sorts narrow it (TM Krishna at the Academy). The kinds sit with them as toggles: Dance, Lecdem
// and Harikatha (Mine went on 2026-11-11: the Shortlist is its own tab). Every rule applies
// alike to the rasika's own Events and to the Schedule's listings. Framework-free, so the rules are
// unit-tested (tests/screens/season-filter.test.ts).

import { fold } from '../catalog/fold';
import type { EventKind, OwnEntry, SharedEntry } from '../model';
import type { EventSummary, ResolvedEntry, ScheduleListing } from '../store/queries';
import { rank } from '../store/people';
import type { TimelineDay } from './timeline';

/** An Artist or Sabha as the rasika's and the shared lists know it: its name and Aliases. */
export interface Known {
  name: string;
  aliases: string[];
}

/** Finds the entry a printed name (or a Shared id) means, by its fold, as the Schedule does. */
export type Lookup = (kind: 'artist' | 'sabha', name: string) => Known | undefined;

/** The lists of one kind, as `loadEntries` reads them. */
export interface Directory {
  own: OwnEntry[];
  shared: SharedEntry[];
  resolve(id: string): ResolvedEntry | undefined;
}

/**
 * A Lookup over the rasika's and the shared lists: each entry by its id and by the fold of its
 * name and every Alias. A shared entry wins a name over an own one, and an own one the
 * Maintainer promoted reads as the shared one (ADR 0005), as the Schedule matches names.
 */
export function lookupOver(lists: { artist: Directory; sabha: Directory }): Lookup {
  const index = (directory: Directory) => {
    const found = new Map<string, Known>();
    const offer = (key: string, known: Known) => {
      if (!found.has(key)) found.set(key, known);
    };
    for (const entry of directory.shared) {
      const known = { name: entry.name, aliases: entry.aliases };
      offer(entry.id, known);
      for (const name of [entry.name, ...entry.aliases]) offer(fold(name), known);
    }
    for (const entry of directory.own) {
      if (entry.deletedAt !== null || entry.mergedIntoId !== null) continue;
      const resolved = directory.resolve(entry.id);
      if (!resolved) continue;
      const known = {
        name: resolved.name,
        aliases: [...new Set([...resolved.aliases, entry.name, ...entry.aliases])],
      };
      offer(entry.id, known);
      for (const name of [entry.name, ...entry.aliases, resolved.name, ...resolved.aliases]) {
        offer(fold(name), known);
      }
    }
    return found;
  };
  const artists = index(lists.artist);
  const sabhas = index(lists.sabha);
  return (kind, name) => {
    const found = kind === 'artist' ? artists : sabhas;
    return found.get(name) ?? found.get(fold(name));
  };
}

/** A Lookup that knows no list: each name stands for itself. */
export const noLookup: Lookup = () => undefined;

/** What a suggestion is: an Artist, a group by its group name, or a Sabha. */
export type NameSort = 'artist' | 'group' | 'sabha';

/** A name the box suggests, and a pick once chosen. */
export interface SeasonName {
  /** Its sort and folded name: one suggestion for each, however often it is billed. */
  key: string;
  sort: NameSort;
  name: string;
  aliases: string[];
  /** The fold of its name and every Alias: a row naming any of them matches it. */
  folds: string[];
}

export interface Filter {
  picks: SeasonName[];
  kinds: EventKind[];
}

export const NO_FILTER: Filter = { picks: [], kinds: [] };

export const isFiltering = (filter: Filter) => filter.picks.length > 0 || filter.kinds.length > 0;

/** The kinds that get a quick chip, in the order they show; a Concert is the default. */
export const QUICK_KINDS = ['dance', 'lecdem', 'harikatha'] as const satisfies EventKind[];

const nameOf = (sort: NameSort, printed: string, lookup: Lookup): SeasonName => {
  const known = sort === 'group' ? undefined : lookup(sort, printed);
  const name = known?.name ?? printed;
  const aliases = known?.aliases.filter((alias) => alias !== name) ?? [];
  return {
    key: `${sort}:${fold(name)}`,
    sort,
    name,
    aliases,
    folds: [...new Set([name, ...aliases].map(fold))],
  };
};

/** What a row is found by: the folds of its Artists and groups, and of its Sabha. */
interface RowNames {
  artists: Set<string>;
  sabhas: Set<string>;
}

function* listingNames(listing: ScheduleListing, lookup: Lookup) {
  const { entry } = listing;
  for (const person of entry.billed) {
    yield nameOf('artist', person.name, lookup);
    if (person.group) yield nameOf('group', person.group, lookup);
  }
  yield nameOf('sabha', entry.sabha, lookup);
}

/** A name with more Aliases, found by them too. */
const withAliases = (named: SeasonName, more: readonly string[]): SeasonName => {
  const aliases = [...new Set([...named.aliases, ...more])].filter((alias) => alias !== named.name);
  return { ...named, aliases, folds: [...new Set([...named.folds, ...aliases.map(fold)])] };
};

function* ownNames(summary: EventSummary, lookup: Lookup) {
  for (const person of summary.stage) {
    yield withAliases(nameOf('artist', person.name, lookup), person.aliases);
    if (person.group) yield nameOf('group', person.group, lookup);
  }
  if (summary.sabha) {
    yield withAliases(nameOf('sabha', summary.sabha.name, lookup), summary.sabha.aliases);
  }
}

const rowNames = (names: Iterable<SeasonName>): RowNames => {
  const row: RowNames = { artists: new Set(), sabhas: new Set() };
  for (const named of names) {
    const into = named.sort === 'sabha' ? row.sabhas : row.artists;
    for (const folded of named.folds) into.add(folded);
  }
  return row;
};

/**
 * Every name in the Season, the days gone included, for the box to suggest: one per Artist,
 * group and Sabha, by the name its list knows it by, with that entry's Aliases.
 */
export function seasonNames(
  summaries: readonly EventSummary[],
  listings: readonly ScheduleListing[],
  lookup: Lookup,
): SeasonName[] {
  const names = new Map<string, SeasonName>();
  const add = (named: SeasonName) => {
    const seen = names.get(named.key);
    // The same entry printed two ways: either spelling finds it.
    names.set(named.key, seen ? withAliases(seen, named.aliases) : named);
  };
  for (const listing of listings) for (const named of listingNames(listing, lookup)) add(named);
  for (const summary of summaries) for (const named of ownNames(summary, lookup)) add(named);
  return [...names.values()];
}

const SORT_ORDER: Record<NameSort, number> = { artist: 0, group: 1, sabha: 2 };

/**
 * The names that match what was typed, closest first, as the Artist and Sabha pickers rank them
 * (the whole name, its start, a later word's start, anywhere), by the best of its name and
 * Aliases; Artists before groups before Sabhas at the same rank. Those already picked are left
 * out.
 */
export function suggest(
  names: readonly SeasonName[],
  query: string,
  picked: readonly SeasonName[],
  limit = 6,
): SeasonName[] {
  const needle = fold(query);
  if (needle === '') return [];
  const taken = new Set(picked.map((name) => name.key));
  const ranked: { name: SeasonName; rank: number }[] = [];
  for (const name of names) {
    if (taken.has(name.key)) continue;
    let best: number | null = null;
    for (const folded of name.folds) {
      const r = rank(folded, needle);
      if (r !== null && (best === null || r < best)) best = r;
    }
    if (best !== null) ranked.push({ name, rank: best });
  }
  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        SORT_ORDER[a.name.sort] - SORT_ORDER[b.name.sort] ||
        a.name.name.localeCompare(b.name.name),
    )
    .slice(0, limit)
    .map(({ name }) => name);
}

/** Whether a row is in: each sort of pick, and each quick chip, must match it (AND across). */
export interface RowTest {
  own(summary: EventSummary): boolean;
  listing(listing: ScheduleListing): boolean;
}

/**
 * The test a filter puts each row to. Within a sort, any pick matches (OR): an Artist pick and a
 * group pick are one sort, the performers, so "Malladi Brothers or TM Krishna" widens. Across
 * sorts, every one must (AND).
 */
export function rowTest(filter: Filter, lookup: Lookup): RowTest {
  const performers = filter.picks.filter((pick) => pick.sort !== 'sabha');
  const sabhas = filter.picks.filter((pick) => pick.sort === 'sabha');
  const kinds = new Set<EventKind>(filter.kinds);
  const hits = (picks: SeasonName[], found: Set<string>) =>
    picks.length === 0 || picks.some((pick) => pick.folds.some((folded) => found.has(folded)));
  const named = (row: RowNames) => hits(performers, row.artists) && hits(sabhas, row.sabhas);
  const kindOk = (kind: EventKind) => kinds.size === 0 || kinds.has(kind);
  const needsNames = filter.picks.length > 0;
  return {
    own: (summary) =>
      kindOk(summary.event.kind) && (!needsNames || named(rowNames(ownNames(summary, lookup)))),
    listing: (listing) =>
      kindOk(listing.entry.kind) && (!needsNames || named(rowNames(listingNames(listing, lookup)))),
  };
}

/** The days with only the rows the test lets in; a day left with none is dropped. */
export function filterDays(days: readonly TimelineDay[], test: RowTest): TimelineDay[] {
  const kept: TimelineDay[] = [];
  for (const day of days) {
    const own = day.own.filter(test.own);
    const listings = day.listings.filter(test.listing);
    if (own.length + listings.length > 0) kept.push({ ...day, own, listings });
  }
  return kept;
}
