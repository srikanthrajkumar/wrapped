// What a blank Concert offers (docs/design/log-entry.md): the listings near its own date and
// time, the Schedule's span for "Search What's on…", and that search's order. Cases from the
// real 2026-27 feed's shapes: Sat 19 Dec at 4:10 pm, four concerts began at 4:00.

import { describe, expect, it } from 'vitest';
import type { Event, ScheduleEntry } from '../../src/model';
import {
  inScheduleSpan,
  isNow,
  nearListings,
  searchListings,
} from '../../src/screens/near-listings';
import { concerts } from '../../src/screens/spine';
import type { EventSummary, ScheduleListing } from '../../src/store/queries';

const DAY = '2026-12-19';
const at = (time: string, date = DAY) => new Date(`${date}T${time}:00`);

const own = (id: string, entryId: string, fields: Partial<Event> = {}) =>
  ({
    event: {
      id,
      kind: 'concert',
      date: DAY,
      startTime: '16:00',
      sabhaId: null,
      status: 'planned',
      cancelled: false,
      source: 'schedule',
      scheduleEntryId: entryId,
      scheduleVersionSeen: null,
      scheduleChanged: false,
      touched: false,
      title: null,
      note: null,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
      ...fields,
    },
    sabha: null,
    knownBy: id,
    known: [id],
    stage: [],
    accompanists: [],
    type: null,
    itemCount: 0,
    cancelled: false,
  }) as EventSummary;

const listing = (
  id: string,
  startTime: string | null,
  sabha: string,
  fields: Partial<ScheduleEntry> = {},
  event: EventSummary | null = null,
): ScheduleListing => ({
  entry: {
    id,
    version: 1,
    date: DAY,
    startTime,
    sabha,
    kind: 'concert',
    billed: [{ name: id, role: 'vocal', group: null, support: false }],
    title: null,
    cancelled: false,
    ...fields,
  },
  plannedId: event?.event.id ?? null,
  status: event?.event.status ?? null,
});

// Sat 19 Dec as the feed has it around 4 pm.
const afternoon = [
  listing('Krupaa Lakshmi', '13:30', 'Mylapore Fine Arts'),
  listing('Amritha Murali', '15:00', 'Bharat Kalachar'),
  listing('Anahita', '15:30', 'Kartik Fine Arts'),
  listing('Sriram Parasuram', '16:00', 'Narada Gana Sabha'),
  listing('S. Mahathi', '16:00', 'Brahma Gana Sabha'),
  listing('NJ Nandini', '16:00', 'Music Academy'),
  listing('Bombay Jayashri', '16:00', 'Parthasarathy Swami Sabha'),
  listing('Sanjay Subrahmanyan', '18:00', 'Music Academy'),
  listing('TM Krishna', '18:30', 'Krishna Gana Sabha'),
];

const keys = (rows: { key: string }[]) => rows.map((row) => row.key);
const near = (listings: ScheduleListing[], when: Date, summaries: EventSummary[] = []) =>
  keys(nearListings(concerts(summaries, listings, when), when));

describe('the listings near the Concert’s time', () => {
  it('offers the four 4:00 concerts at 4:10, nearest first, a slot in Sabha order', () => {
    expect(near(afternoon, at('16:10'))).toEqual([
      'S. Mahathi',
      'NJ Nandini',
      'Sriram Parasuram',
      'Bombay Jayashri',
    ]);
  });

  it('offers what starts within the hour 10 minutes before, and what began before it', () => {
    expect(near(afternoon, at('15:50'))).toEqual([
      'S. Mahathi',
      'NJ Nandini',
      'Sriram Parasuram',
      'Bombay Jayashri',
    ]);
    // 5:30: the 6:00 and 6:30 within the hour first, then the 4:00s, 90 min in.
    expect(near(afternoon, at('17:30'))).toEqual([
      'Sanjay Subrahmanyan',
      'TM Krishna',
      'S. Mahathi',
      'NJ Nandini',
    ]);
  });

  it('puts the rasika’s Shortlisted one first, wherever it falls', () => {
    const mine = own('e1', 'Anahita', { startTime: '15:30' });
    const listings = afternoon.map((one) =>
      one.entry.id === 'Anahita' ? listing('Anahita', '15:30', 'Kartik Fine Arts', {}, mine) : one,
    );
    expect(near(listings, at('16:10'), [mine])[0]).toBe('Anahita');
  });

  it('leaves out a listing the rasika has heard, and a cancelled one', () => {
    const heard = own('e2', 'NJ Nandini', { status: 'attended' });
    const listings = afternoon.map((one) =>
      one.entry.id === 'NJ Nandini'
        ? listing('NJ Nandini', '16:00', 'Music Academy', {}, heard)
        : one.entry.id === 'S. Mahathi'
          ? listing('S. Mahathi', '16:00', 'Brahma Gana Sabha', { cancelled: true })
          : one,
    );
    expect(near(listings, at('16:10'), [heard])).toEqual([
      'Sriram Parasuram',
      'Bombay Jayashri',
      'Anahita',
      'Amritha Murali',
    ]);
  });

  it('offers nothing when nothing is near, and never a listing with no time', () => {
    expect(near(afternoon, at('23:30'))).toEqual([]);
    expect(near([listing('No time', null, 'Music Academy')], at('16:10'))).toEqual([]);
  });

  it('re-centres on a late log: the Concert’s time set back to 4:00 the next morning', () => {
    // Logged at 9 am Sunday, the time set to Saturday 4:00 pm.
    const when = at('16:00');
    expect(near(afternoon, when)).toEqual([
      'S. Mahathi',
      'NJ Nandini',
      'Sriram Parasuram',
      'Bombay Jayashri',
    ]);
  });

  it('reaches across midnight', () => {
    const late = [
      listing('Late', '23:00', 'Music Academy'),
      listing('Early', '00:45', 'Music Academy', { date: '2026-12-20' }),
    ];
    expect(near(late, at('00:30', '2026-12-20'))).toEqual(['Early', 'Late']);
  });

  it('shows at most four', () => {
    expect(nearListings(concerts([], afternoon, at('16:10')), at('16:10'))).toHaveLength(4);
  });
});

describe('the Concert’s time read as now', () => {
  it('is now within five minutes of the clock', () => {
    expect(isNow(at('16:10'), at('16:14'))).toBe(true);
    expect(isNow(at('16:00'), at('16:10'))).toBe(false);
  });
});

describe('the Schedule’s span', () => {
  const span = [
    listing('a', '16:00', 'x', { date: '2026-11-04' }),
    listing('b', '16:00', 'x', { date: '2027-01-17' }),
  ];
  it('runs from the first listing’s day to a week after the last', () => {
    expect(inScheduleSpan(span, '2026-11-03')).toBe(false);
    expect(inScheduleSpan(span, '2026-11-04')).toBe(true);
    expect(inScheduleSpan(span, '2027-01-24')).toBe(true);
    expect(inScheduleSpan(span, '2027-01-25')).toBe(false);
  });
  it('is never, with no Schedule on the phone', () => {
    expect(inScheduleSpan([], '2026-12-19')).toBe(false);
  });
});

describe('searching What’s on from a blank Concert', () => {
  const season = [
    ...afternoon,
    listing('NJ Nandini', '18:00', 'Kartik Fine Arts', { date: '2026-12-22' }),
    listing('Nandini Sharma', '10:00', 'Music Academy', { date: '2026-12-19' }),
  ].map((one, i) => ({ ...one, entry: { ...one.entry, id: `${one.entry.id}#${i}` } }));
  const all = concerts([], season, at('09:00', '2026-12-20'));
  const found = (query: string, day = DAY) =>
    searchListings(all, query, day).map((c) => `${c.listing!.entry.billed[0]!.name} ${c.date}`);

  it('finds by Artist, the Concert’s own day first, then by time', () => {
    expect(found('nandini')).toEqual([
      'Nandini Sharma 2026-12-19',
      'NJ Nandini 2026-12-19',
      'NJ Nandini 2026-12-22',
    ]);
    expect(found('nandini', '2026-12-22')[0]).toBe('NJ Nandini 2026-12-22');
  });

  it('finds by Sabha, and by initials typed either way', () => {
    expect(found('kartik')).toEqual(['Anahita 2026-12-19', 'NJ Nandini 2026-12-22']);
    expect(found('t.m. krishna')).toEqual(['TM Krishna 2026-12-19']);
  });

  it('puts the concert known by the name before one where it is an accompanist’s', () => {
    const accompanied = [
      listing('Rishabh Kaushik', '14:00', 'Bharat Kalachar', {
        date: '2026-12-27',
        billed: [
          { name: 'Rishabh Kaushik', role: 'vocal', group: null, support: false },
          { name: 'Sanjay Swami', role: 'violin', group: null, support: false },
        ],
      }),
      listing('Sanjay Subrahmanyan', '18:45', 'Music Academy', { date: '2026-12-27' }),
    ];
    const rows = searchListings(concerts([], accompanied, at('09:00')), 'sanjay', DAY);
    expect(rows.map((c) => c.lead)).toEqual(['Sanjay Subrahmanyan', 'Rishabh Kaushik']);
  });

  it('finds nothing for a name not listed', () => {
    expect(found('Kapali')).toEqual([]);
  });
});
