// Today on What's on, split for its two folds (docs/design/screens/whats-on.md, decisions 1 and
// 4): what is over under "Earlier today", what is under way under "On now" from three when
// something is still to come, then the rest; and when "Earlier today" starts open.

import { describe, expect, it } from 'vitest';
import type { Event, ScheduleEntry } from '../../src/model';
import { byStart, listed, owned, type Concert } from '../../src/screens/spine';
import { onlyEarlier, todayParts } from '../../src/screens/today-folds';
import type { LoggingNote } from '../../src/store/logging-note';
import type { EventSummary, ScheduleListing } from '../../src/store/queries';

// Sat 19 Dec, a peak day.
const DAY = '2026-12-19';
const at = (time: string) => new Date(`${DAY}T${time}:00`);
const none = new Map<string, LoggingNote>();

const entry = (id: string, startTime: string | null, fields: Partial<ScheduleEntry> = {}) =>
  ({
    entry: {
      id,
      version: 1,
      date: DAY,
      startTime,
      sabha: `Sabha ${id}`,
      kind: 'concert',
      billed: [{ name: id, role: 'vocal', group: null, support: false }],
      title: null,
      cancelled: false,
      ...fields,
    },
    plannedId: null,
    status: null,
  }) as ScheduleListing;

const day = (...rows: Concert[]) => [...rows].sort(byStart);
const keys = (rows: Concert[]) => rows.map((row) => row.key);
const row = (id: string, time: string | null, fields: Partial<ScheduleEntry> = {}) =>
  listed(entry(id, time, fields));

/** The rasika's own Concert, heard, being logged since `loggedAt`. */
function logging(id: string, startTime: string, loggedAt: string) {
  const event = {
    id,
    kind: 'concert',
    date: DAY,
    startTime,
    sabhaId: null,
    status: 'attended',
    cancelled: false,
    source: 'plan',
    scheduleEntryId: null,
    scheduleVersionSeen: null,
    scheduleChanged: false,
    touched: true,
    title: null,
    note: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  } as unknown as Event;
  const summary = {
    event,
    sabha: null,
    knownBy: id,
    known: [id],
    stage: [],
    accompanists: [],
    type: null,
    itemCount: 3,
    cancelled: false,
  } as unknown as EventSummary;
  const notes = new Map<string, LoggingNote>([
    [id, { eventId: id, lastLoggedAt: at(loggedAt).toISOString() }],
  ]);
  return { concert: owned(summary), notes };
}

describe('todayParts', () => {
  // The shape of the real feed at 4:10 pm on a peak day: what began by 1:30 pm is over, six
  // under way (3:00 to 4:00), and the evening still to come.
  const peak = day(
    row('morning', '10:30'),
    row('noon', '13:30'),
    row('three', '15:00'),
    row('half-three', '15:30'),
    row('four-a', '16:00'),
    row('four-b', '16:00'),
    row('four-c', '16:00'),
    row('four-d', '16:00'),
    row('six', '18:00'),
    row('six-fifteen', '18:15'),
  );

  it('folds six under way at 4:10 pm, with the evening still to come', () => {
    const parts = todayParts(peak, none, at('16:10'));
    expect(keys(parts.over)).toEqual(keys(peak.slice(0, 2)));
    expect(parts.on).toHaveLength(6);
    expect(keys(parts.ahead)).toEqual(keys(peak.slice(8)));
    expect(parts.foldOn).toBe(true);
  });

  it('shows two under way as rows, with no fold', () => {
    const parts = todayParts(
      day(row('a', '11:00'), row('b', '11:30'), row('c', '16:00')),
      none,
      at('12:00'),
    );
    expect(parts.on).toHaveLength(2);
    expect(parts.foldOn).toBe(false);
  });

  it('never folds what is on now when nothing is still to come', () => {
    const late = day(row('a', '18:00'), row('b', '18:15'), row('c', '18:30'));
    const parts = todayParts(late, none, at('19:30'));
    expect(parts.on).toHaveLength(3);
    expect(parts.ahead).toHaveLength(0);
    expect(parts.foldOn).toBe(false);
  });

  it('counts a concert with no time as still to come', () => {
    const rows = day(row('a', '16:00'), row('b', '16:00'), row('c', '16:00'), row('untimed', null));
    const parts = todayParts(rows, none, at('16:10'));
    expect(keys(parts.ahead)).toEqual(keys(rows.filter((r) => r.startTime === null)));
    expect(parts.foldOn).toBe(true);
  });

  it('keeps the Concert being logged under way past 2½ hours', () => {
    const { concert, notes } = logging('mine', '15:00', '17:40');
    const parts = todayParts(day(concert, row('later', '19:00')), notes, at('17:45'));
    expect(keys(parts.on)).toEqual([concert.key]);
    expect(parts.over).toHaveLength(0);
  });

  it('puts a cancelled concert past its start with what is over, never on now', () => {
    const cancelled = row('cancelled', '16:00', { cancelled: true });
    const parts = todayParts(day(cancelled, row('later', '18:00')), none, at('16:10'));
    expect(keys(parts.over)).toEqual([cancelled.key]);
    expect(parts.on).toHaveLength(0);
    // Before its start it stands in its slot, as now.
    expect(keys(todayParts(day(cancelled), none, at('15:00')).ahead)).toEqual([cancelled.key]);
  });

  it('splits a filtered day by the same rules (decision 4)', () => {
    // Filtered to one Artist: his 4:00 pm concert, over at 7:30 pm.
    const parts = todayParts(day(row('sanjay', '16:00')), none, at('19:30'));
    expect(parts.over).toHaveLength(1);
    expect(parts.on).toHaveLength(0);
    expect(parts.ahead).toHaveLength(0);
  });

  it('moves rows from one fold to the next with the clock, nothing else', () => {
    // At 6:30 pm the 4:00 pm ones are over, and the 6:00 pm ones under way.
    const parts = todayParts(peak, none, at('18:30'));
    expect(parts.over).toHaveLength(8);
    expect(parts.on).toHaveLength(2);
    expect(parts.foldOn).toBe(false);
  });
});

describe('onlyEarlier', () => {
  it('opens "Earlier today" when it would be all the list shows', () => {
    const parts = todayParts(day(row('sanjay', '16:00')), none, at('19:30'));
    expect(onlyEarlier(parts, 1)).toBe(true);
    // With days ahead after it, it stays closed.
    expect(onlyEarlier(parts, 2)).toBe(false);
  });

  it('stays closed when anything else is on today', () => {
    const parts = todayParts(day(row('a', '16:00'), row('b', '19:00')), none, at('19:30'));
    expect(onlyEarlier(parts, 1)).toBe(false);
  });
});
