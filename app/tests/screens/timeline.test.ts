// Season's timeline (the Maintainer, 2026-11-08): every day in date order, the rasika's own
// Events first, then the Schedule's other listings, a planned listing shown once, as theirs.
// Required (the Maintainer, 2026-11-07): a cancelled Planned Event stays in its day, marked,
// until the rasika deletes it, even once its start time has passed; and it is never Now.

import { describe, expect, it } from 'vitest';
import type { Event, ScheduleEntry } from '../../src/model';
import { asNowReads, timeline } from '../../src/screens/timeline';
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

  it('keeps a cancelled Event in its day after its start, and leaves out one shown apart', () => {
    const days = timeline(
      [summary({ id: 'off', date: '2026-12-01' }, true), summary({ id: 'now' }, false)],
      [],
      new Set(['now']),
    );
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
