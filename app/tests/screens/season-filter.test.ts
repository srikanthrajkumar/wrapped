// Season's filter (the Maintainer, 2026-11-09): picks of one sort widen the list, picks of
// different sorts narrow it, a Sabha's Aliases find it, and every rule applies to the rasika's
// own Events as to the Schedule's listings. (Mine went on 2026-11-11: the Shortlist is a tab.)

import { describe, expect, it } from 'vitest';
import type { Event, OwnEntry, ScheduleEntry, SharedEntry } from '../../src/model';
import {
  filterDays,
  lookupOver,
  NO_FILTER,
  noLookup,
  rowTest,
  seasonNames,
  suggest,
  type Directory,
  type Filter,
  type Lookup,
  type SeasonName,
} from '../../src/screens/season-filter';
import { timeline } from '../../src/screens/timeline';
import type { EventSummary, ResolvedEntry, ScheduleListing } from '../../src/store/queries';

// Before any Event below has lapsed, so each is shown.
const EARLY = new Date('2026-12-01T08:00:00');

const listing = (id: string, fields: Partial<ScheduleEntry> = {}): ScheduleListing => ({
  entry: {
    id,
    version: 1,
    date: '2026-12-15',
    startTime: '18:00',
    sabha: 'Music Academy',
    kind: 'concert',
    billed: [],
    title: null,
    cancelled: false,
    ...fields,
  },
  plannedId: null,
  status: null,
});

const billed = (...names: string[]) =>
  names.map((name) => ({ name, role: 'vocal' as const, group: null }));

const own = (
  id: string,
  fields: Partial<Event> = {},
  stage: EventSummary['stage'] = [],
  sabha: string | null = null,
  sabhaAliases: string[] = [],
): EventSummary => ({
  event: {
    id,
    kind: 'concert',
    date: '2026-12-15',
    startTime: '19:00',
    sabhaId: sabha ? `s-${sabha}` : null,
    status: 'planned',
    cancelled: false,
    source: 'spot',
    scheduleEntryId: null,
    scheduleVersionSeen: null,
    scheduleChanged: false,
    touched: true,
    title: null,
    note: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    ...fields,
  },
  sabha: sabha
    ? { id: `s-${sabha}`, name: sabha, aliases: sabhaAliases, shared: false, own: null }
    : null,
  knownBy: null,
  stage,
  accompanists: [],
  type: null,
  itemCount: 0,
  cancelled: false,
});

const shared = (id: string, name: string, aliases: string[] = []): SharedEntry => ({
  id,
  name,
  aliases,
  listVersion: 1,
});

const directory = (entries: SharedEntry[]): Directory => ({
  own: [] as OwnEntry[],
  shared: entries,
  resolve: (): ResolvedEntry | undefined => undefined,
});

const KGS = shared('kgs', 'Krishna Gana Sabha', ['KGS', 'Sri Krishna Gana Sabha']);
const lookup: Lookup = lookupOver({
  artist: directory([shared('tmk', 'T M Krishna', ['TM Krishna'])]),
  sabha: directory([KGS, shared('academy', 'Music Academy', ['The Academy'])]),
});

const listings = [
  listing('tmk-academy', { billed: billed('TM Krishna') }),
  listing('tmk-kgs', { billed: billed('T M Krishna'), sabha: 'Sri Krishna Gana Sabha' }),
  listing('sanjay-academy', { billed: billed('Sanjay Subrahmanyan') }),
  listing('sanjay-narada', { billed: billed('Sanjay Subrahmanyan'), sabha: 'Narada Gana Sabha' }),
  listing('malladi', {
    sabha: 'Krishna Gana Sabha',
    billed: [
      { name: 'Malladi Sreeramprasad', role: 'vocal', group: 'Malladi Brothers' },
      { name: 'Malladi Ravikumar', role: 'vocal', group: 'Malladi Brothers' },
    ],
  }),
  listing('dance', { kind: 'dance', billed: billed('Alarmel Valli') }),
  listing('lecdem', { kind: 'lecdem', billed: billed('Sanjay Subrahmanyan') }),
];
const summaries = [
  own('mine-tmk', {}, [{ name: 'TM Krishna', aliases: [], group: null }], 'Music Academy'),
  own('mine-bare'),
  own('mine-kgs', { kind: 'harikatha' }, [], 'Krishna Gana Sabha', ['KGS']),
];

const names = seasonNames(summaries, listings, lookup);
const named = (query: string) => suggest(names, query, [], 20);
const find = (query: string): SeasonName => named(query)[0]!;

/** The ids of the rows a filter lets in, own first, as Season lists them. */
function shown(filter: Filter, with_: Lookup = lookup) {
  const days = filterDays(timeline(summaries, listings, EARLY), rowTest(filter, with_));
  return days.flatMap((day) => [
    ...day.own.map((s) => s.event.id),
    ...day.listings.map((l) => l.entry.id),
  ]);
}

describe('season filter', () => {
  it('lets everything in with no filter', () => {
    expect(shown(NO_FILTER)).toHaveLength(summaries.length + listings.length);
  });

  it('suggests billed Artists, groups by their name, and Sabhas, each once', () => {
    expect(named('malladi').map((n) => [n.name, n.sort])).toEqual([
      ['Malladi Ravikumar', 'artist'],
      ['Malladi Sreeramprasad', 'artist'],
      ['Malladi Brothers', 'group'],
    ]);
    // Billed two ways, known as one: the shared Artist's name.
    expect(named('krishna').filter((n) => n.sort === 'artist')).toEqual([
      expect.objectContaining({ name: 'T M Krishna' }),
    ]);
    expect(named('sanjay')).toHaveLength(1);
  });

  it('finds a Sabha by its Aliases (KGS finds Krishna Gana Sabha)', () => {
    expect(named('KGS').map((n) => n.name)).toEqual(['Krishna Gana Sabha']);
    // Folded as the pickers fold: spellings meet.
    expect(named('krisna gaana').map((n) => n.name)).toContain('Krishna Gana Sabha');
    // Its pick matches a listing printed under an Alias, and the rasika's own Event there.
    expect(shown({ ...NO_FILTER, picks: [find('KGS')] })).toEqual([
      'mine-kgs',
      'tmk-kgs',
      'malladi',
    ]);
  });

  it('takes a name’s Aliases from the lists when the Season names it once', () => {
    const once = [listing('only', { sabha: 'Sri Krishna Gana Sabha', billed: billed('A') })];
    const all = seasonNames([], once, lookup);
    const kgs = suggest(all, 'KGS', [])[0]!;
    expect(kgs.name).toBe('Krishna Gana Sabha');
    expect(rowTest({ ...NO_FILTER, picks: [kgs] }, lookup).listing(once[0]!)).toBe(true);
  });

  it('leaves a pick out of what it suggests next', () => {
    const tmk = find('T M Krishna');
    expect(suggest(names, 'krishna', [tmk], 20).map((n) => n.name)).not.toContain('T M Krishna');
  });

  it('widens with picks of one sort: TM Krishna or Sanjay', () => {
    const tmk = find('T M Krishna');
    const sanjay = find('Sanjay');
    expect(shown({ ...NO_FILTER, picks: [tmk] })).toEqual(['mine-tmk', 'tmk-academy', 'tmk-kgs']);
    expect(shown({ ...NO_FILTER, picks: [tmk, sanjay] })).toEqual([
      'mine-tmk',
      'tmk-academy',
      'tmk-kgs',
      'sanjay-academy',
      'sanjay-narada',
      'lecdem',
    ]);
    // An Artist and a group are one sort, the performers: they widen too.
    expect(shown({ ...NO_FILTER, picks: [tmk, find('Malladi Brothers')] })).toEqual([
      'mine-tmk',
      'tmk-academy',
      'tmk-kgs',
      'malladi',
    ]);
    // Two Sabhas widen.
    expect(shown({ ...NO_FILTER, picks: [find('KGS'), find('Narada')] })).toEqual([
      'mine-kgs',
      'tmk-kgs',
      'sanjay-narada',
      'malladi',
    ]);
  });

  it('narrows with picks of different sorts: TM Krishna at the Academy', () => {
    const academy = find('The Academy');
    expect(academy.name).toBe('Music Academy');
    expect(shown({ ...NO_FILTER, picks: [find('T M Krishna'), academy] })).toEqual([
      'mine-tmk',
      'tmk-academy',
    ]);
    // A kind narrows a pick, and two kinds widen each other.
    expect(shown({ ...NO_FILTER, picks: [find('Sanjay')], kinds: ['lecdem'] })).toEqual(['lecdem']);
    expect(shown({ ...NO_FILTER, kinds: ['dance', 'harikatha'] })).toEqual(['mine-kgs', 'dance']);
  });

  it('matches the rasika’s own Events by any Artist on Stage, their Aliases and group', () => {
    const stage = [
      { name: 'Ravi', aliases: ['Mysore Ravi'], group: null },
      { name: 'Ranjani', aliases: [], group: 'Ranjani & Gayatri' },
    ];
    const mine = [own('violin', {}, stage)];
    const all = seasonNames(mine, [], noLookup);
    const pick = (query: string) => suggest(all, query, [], 1)[0]!;
    const test = (p: SeasonName) => rowTest({ ...NO_FILTER, picks: [p] }, noLookup).own(mine[0]!);
    expect(test(pick('Mysore'))).toBe(true);
    expect(test(pick('Ranjani & Gayatri'))).toBe(true);
    expect(pick('Mysore').name).toBe('Ravi');
  });

  it('drops a day left with nothing in it', () => {
    const days = timeline(
      [],
      [
        listing('a', { date: '2026-12-15', billed: billed('A') }),
        listing('b', { date: '2026-12-16', billed: billed('B') }),
      ],
      EARLY,
    );
    const b = suggest(
      seasonNames(
        [],
        days.flatMap((d) => d.listings),
        noLookup,
      ),
      'B',
      [],
    )[0]!;
    const kept = filterDays(days, rowTest({ ...NO_FILTER, picks: [b] }, noLookup));
    expect(kept.map((day) => day.date)).toEqual(['2026-12-16']);
  });
});
