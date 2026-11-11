// What's on as days (the Maintainer, 2026-11-08; the Season spine, 2026-11-11): every day in date
// order, each with the rasika's own Events shown that day and the Schedule's other listings; a
// listing they Shortlisted or heard shown once, as theirs. Required (the Maintainer, 2026-11-07):
// a cancelled Shortlisted Event stays in its day, marked, until the rasika deletes it or its time
// passes. Required (ADR 0010): a Missed Event, or a Shortlisted one whose time has passed, is
// shown nowhere, and its entry reads as a plain listing again.

import { describe, expect, it } from 'vitest';
import type { Event, ScheduleEntry } from '../../src/model';
import { listingFacts, timeline } from '../../src/screens/timeline';
import type { EventSummary, ScheduleListing } from '../../src/store/queries';

const event = (fields: Partial<Event>): Event => ({
  id: 'e1',
  kind: 'concert',
  date: '2026-12-15',
  startTime: '16:00',
  sabhaId: null,
  status: 'planned',
  cancelled: false,
  source: 'schedule',
  scheduleEntryId: 'academy-1',
  scheduleVersionSeen: '1',
  scheduleChanged: false,
  touched: true,
  title: null,
  note: null,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  ...fields,
});

const summary = (fields: Partial<Event>, cancelled: boolean): EventSummary => ({
  event: event(fields),
  sabha: null,
  knownBy: null,
  stage: [],
  accompanists: [],
  type: null,
  itemCount: 0,
  cancelled,
});

const listing = (
  fields: Partial<ScheduleEntry>,
  plannedId: string | null = null,
  status: Event['status'] | null = plannedId ? 'planned' : null,
): ScheduleListing => ({
  entry: {
    id: 'entry',
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
  plannedId,
  status,
});

const shape = (days: ReturnType<typeof timeline>) =>
  days.map((day) => [
    day.date,
    day.own.map((s) => s.event.id),
    day.listings.map((l) => l.entry.id),
  ]);

// Before any of the Events below has lapsed.
const at = new Date('2026-12-01T08:00:00');

describe('the timeline', () => {
  it('runs in date order, each day with its own Events by start time and its other listings', () => {
    const days = timeline(
      [
        summary({ id: 'late', date: '2026-12-15', startTime: '19:00' }, false),
        summary({ id: 'early', date: '2026-12-15', startTime: '09:00', status: 'attended' }, false),
        summary({ id: 'untimed', date: '2026-12-15', startTime: null, source: 'spot' }, false),
        summary({ id: 'gone', date: '2026-11-20', status: 'attended' }, false),
      ],
      [listing({ id: 'l-15', date: '2026-12-15' }), listing({ id: 'l-20', date: '2026-12-20' })],
      at,
    );
    expect(shape(days)).toEqual([
      ['2026-11-20', ['gone'], []],
      ['2026-12-15', ['early', 'late', 'untimed'], ['l-15']],
      ['2026-12-20', [], ['l-20']],
    ]);
  });

  it('shows a Shortlisted listing once, as the rasika’s Event, even on a date they changed', () => {
    const days = timeline(
      [summary({ id: 'mine', date: '2026-12-16', scheduleEntryId: 'l-1' }, false)],
      [listing({ id: 'l-1', date: '2026-12-15' }, 'mine')],
      at,
    );
    expect(shape(days)).toEqual([['2026-12-16', ['mine'], []]]);
  });

  it('keeps a cancelled Event in its day after its start', () => {
    const days = timeline(
      [summary({ id: 'off', date: '2026-12-01', startTime: '06:00' }, true)],
      [],
      at,
    );
    expect(shape(days)).toEqual([['2026-12-01', ['off'], []]]);
  });

  it('shows a Missed Event nowhere, its entry a plain listing again (ADR 0010)', () => {
    const days = timeline(
      [summary({ id: 'missed', status: 'missed', scheduleEntryId: 'l-1' }, false)],
      [listing({ id: 'l-1' }, 'missed', 'missed')],
      at,
    );
    expect(shape(days)).toEqual([['2026-12-15', [], ['l-1']]]);
  });

  it('shows a Shortlisted Event whose time has passed nowhere, and a Heard one for good', () => {
    const lapsed = summary({ id: 'lapsed', scheduleEntryId: 'l-1' }, false);
    const heard = summary({ id: 'heard', status: 'attended', scheduleEntryId: 'l-2' }, false);
    const listings = [
      listing({ id: 'l-1' }, 'lapsed'),
      listing({ id: 'l-2' }, 'heard', 'attended'),
    ];
    // Four hours after its 4:00 pm start it is still shown; a minute later it has lapsed.
    expect(shape(timeline([lapsed, heard], listings, new Date('2026-12-15T20:00:00')))).toEqual([
      ['2026-12-15', ['lapsed', 'heard'], []],
    ]);
    expect(shape(timeline([lapsed, heard], listings, new Date('2026-12-15T20:01:00')))).toEqual([
      ['2026-12-15', ['heard'], ['l-1']],
    ]);
  });
});

// The row's type and accompanists (ADR 0011), read from the billing each time.
describe('a listing’s type and accompanists', () => {
  const facts = (billed: ScheduleEntry['billed'], kind: ScheduleEntry['kind'] = 'concert') =>
    listingFacts(listing({ billed, kind }).entry);
  const artist = (
    name: string,
    role: ScheduleEntry['billed'][number]['role'],
    support = false,
  ) => ({
    name,
    role,
    group: null,
    support,
  });

  it('names no type for a vocal concert, and lists everyone else as accompanists', () => {
    expect(
      facts([
        artist('Embar Kannan', 'violin'),
        artist('S. Sowmya', 'vocal'),
        artist('Neyveli Narayanan', 'mridangam'),
      ]),
    ).toEqual({ type: null, accompanists: ['Embar Kannan', 'Neyveli Narayanan'] });
  });

  it('names the lead’s Role, and a Jugalbandi for two leads of different Roles', () => {
    expect(facts([artist('Shashank', 'flute'), artist('Patri', 'mridangam')]).type).toBe('flute');
    expect(facts([artist('A', 'veena'), artist('B', 'flute'), artist('C', 'ghatam')])).toEqual({
      type: 'jugalbandi',
      accompanists: ['C'],
    });
  });

  it('reads a nagaswaram with its thavil, and a singer with vocal support, as one lead', () => {
    expect(facts([artist('N', 'nagaswaram'), artist('T', 'thavil')])).toEqual({
      type: 'nagaswaram',
      accompanists: ['T'],
    });
    expect(facts([artist('V', 'vocal'), artist('S', 'support')]).type).toBeNull();
    expect(facts([artist('V', 'vocal'), artist('F', 'flute', true)]).type).toBeNull();
  });

  it('names Violin only when no other lead is billed', () => {
    expect(facts([artist('A', 'violin'), artist('B', 'violin'), artist('M', 'mridangam')])).toEqual(
      { type: 'violin', accompanists: ['M'] },
    );
    expect(facts([artist('A', 'violin'), artist('V', 'vocal')]).type).toBeNull();
  });

  it('names none with no Roles, nobody billed, or a kind that has its own mark', () => {
    expect(facts([artist('A', null), artist('B', null)]).type).toBeNull();
    expect(facts([])).toEqual({ type: null, accompanists: [] });
    expect(facts([artist('D', 'dancer')], 'dance').type).toBeNull();
    expect(facts([artist('P', 'presenter'), artist('F', 'flute')], 'lecdem').type).toBeNull();
  });
});
