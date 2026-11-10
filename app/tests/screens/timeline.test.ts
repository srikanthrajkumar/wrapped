// Season's timeline (the Maintainer, 2026-11-08): every day in date order, the rasika's own
// Events first, then the Schedule's other listings, a planned listing shown once, as theirs.
// Required (the Maintainer, 2026-11-07): a cancelled Planned Event stays in its day, marked,
// until the rasika deletes it, even once its start time has passed; and it is never Now.

import { describe, expect, it } from 'vitest';
import type { Event, ScheduleEntry } from '../../src/model';
import { asNowReads, heroEvent, timeline } from '../../src/screens/timeline';
import { nowEvent } from '../../src/store/logging-note';
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
  itemCount: 0,
  cancelled,
});

const listing = (
  fields: Partial<ScheduleEntry>,
  plannedId: string | null = null,
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
});

const shape = (days: ReturnType<typeof timeline>) =>
  days.map((day) => [
    day.date,
    day.own.map((s) => s.event.id),
    day.listings.map((l) => l.entry.id),
  ]);

describe('the timeline', () => {
  it('runs in date order, own Events first by start time, then the other listings', () => {
    const days = timeline(
      [
        summary({ id: 'late', date: '2026-12-15', startTime: '19:00' }, false),
        summary({ id: 'early', date: '2026-12-15', startTime: '09:00', status: 'attended' }, false),
        summary({ id: 'untimed', date: '2026-12-15', startTime: null, source: 'spot' }, false),
        summary({ id: 'gone', date: '2026-12-01', status: 'attended' }, false),
      ],
      [listing({ id: 'l-15', date: '2026-12-15' }), listing({ id: 'l-20', date: '2026-12-20' })],
    );
    expect(shape(days)).toEqual([
      ['2026-12-01', ['gone'], []],
      ['2026-12-15', ['early', 'late', 'untimed'], ['l-15']],
      ['2026-12-20', [], ['l-20']],
    ]);
  });

  it('shows a planned listing once, as the rasika’s Event, even on a date they changed', () => {
    const days = timeline(
      [summary({ id: 'mine', date: '2026-12-16', scheduleEntryId: 'l-1' }, false)],
      [listing({ id: 'l-1', date: '2026-12-15' }, 'mine')],
    );
    expect(shape(days)).toEqual([['2026-12-16', ['mine'], []]]);
  });

  it('keeps a cancelled Event in its day after its start', () => {
    const days = timeline([summary({ id: 'off', date: '2026-12-01' }, true)], []);
    expect(shape(days)).toEqual([['2026-12-01', ['off'], []]]);
  });
});

describe('Now', () => {
  it('never makes an Event whose entry is cancelled Now, though its stored cancelled is false', () => {
    const at = new Date('2026-12-15T16:30:00');
    const off = summary({ id: 'off' }, true);
    expect(nowEvent(asNowReads([off]), new Map(), at).now).toBeNull();
    expect(nowEvent(asNowReads([summary({ id: 'on' }, false)]), new Map(), at).now?.id).toBe('on');
  });
});

// Season's hero (the Maintainer, 2026-11-09, option C): the rasika's own Event on now, else their
// next Planned one, else none (the title).
describe('the hero', () => {
  const at = new Date('2026-12-15T12:00:00');
  const mine = (id: string, fields: Partial<Event>, cancelled = false) =>
    summary({ id, source: 'plan', scheduleEntryId: null, ...fields }, cancelled);
  const pick = (all: EventSummary[], holder: EventSummary | null = null) => {
    const hero = heroEvent(all, holder, at);
    return hero && [hero.summary.event.id, hero.now];
  };

  it('holds the Event on now, over any Planned one', () => {
    const now = mine('now', { status: 'attended', date: '2026-12-15', startTime: '11:30' });
    const next = mine('next', { date: '2026-12-15', startTime: '18:00' });
    expect(pick([now, next], now)).toEqual(['now', true]);
  });

  it('else their soonest one still to start, soonest first', () => {
    expect(
      pick([
        mine('later', { date: '2026-12-17', startTime: '10:00' }),
        mine('tonight', { date: '2026-12-15', startTime: '18:00' }),
        // Started this morning and not Now: gone by.
        mine('morning', { date: '2026-12-15', startTime: '09:00' }),
        // Cancelled (by its entry or by the rasika) or deleted: never the next.
        mine('off', { date: '2026-12-15', startTime: '13:00' }, true),
        mine('called-off', { date: '2026-12-15', startTime: '13:30', cancelled: true }),
        mine('gone', { date: '2026-12-15', startTime: '14:00', deletedAt: 'x' }),
      ]),
    ).toEqual(['tonight', false]);
    // One with no time counts all its day, today's included.
    expect(pick([mine('sometime', { date: '2026-12-15', startTime: null })])).toEqual([
      'sometime',
      false,
    ]);
  });

  // The Maintainer's iPhone, 2026-11-09: an own Event already being logged ahead of its day
  // (Attended, one Item) was skipped for a Planned one weeks later.
  it('takes the soonest whatever its state, not only a Planned one', () => {
    expect(
      pick([
        mine('planned-later', { date: '2026-12-20', startTime: '18:30' }),
        mine('logged-ahead', { status: 'attended', date: '2026-12-16', startTime: '16:30' }),
      ]),
    ).toEqual(['logged-ahead', false]);
  });

  it('is none with nothing on now or ahead', () => {
    expect(pick([mine('past', { date: '2026-12-14', startTime: '18:00' })])).toBeNull();
    expect(pick([])).toBeNull();
  });
});
