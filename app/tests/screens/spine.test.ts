// The Season spine's rules (docs/designs/season-spine.md; ADR 0010): one concert per row
// whatever its stage, what is under way, Starting soon's four rows, the hero that never picks
// for the rasika, the Shortlist's slots, the Diary, and whom the lapse card asks about.

import { describe, expect, it } from 'vitest';
import type { Event, ScheduleEntry } from '../../src/model';
import {
  concerts,
  diary,
  hubHero,
  isOver,
  lapsedToAsk,
  shortlist,
  shortlistDays,
  slotName,
  stageOf,
  startingSoon,
  underWay,
} from '../../src/screens/spine';
import type { LoggingNote } from '../../src/store/logging-note';
import type { EventSummary, ScheduleListing } from '../../src/store/queries';

const DAY = '2026-12-20';
const at = (time: string, date = DAY) => new Date(`${date}T${time}:00`);

const own = (id: string, fields: Partial<Event> = {}, more: Partial<EventSummary> = {}) =>
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
      scheduleEntryId: null,
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
    stage: [],
    accompanists: [],
    type: null,
    itemCount: 0,
    cancelled: false,
    ...more,
  }) as EventSummary;

const listing = (
  id: string,
  startTime: string | null,
  fields: Partial<ScheduleEntry> = {},
  event: EventSummary | null = null,
): ScheduleListing => ({
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
  plannedId: event?.event.id ?? null,
  status: event?.event.status ?? null,
});

const notes = (logged: Record<string, string> = {}) =>
  new Map<string, LoggingNote>(
    Object.entries(logged).map(([eventId, lastLoggedAt]) => [eventId, { eventId, lastLoggedAt }]),
  );
const keys = (rows: { key: string }[]) => rows.map((row) => row.key);

describe('one concert per row', () => {
  it('shows a listing the rasika Shortlisted or heard once, as theirs', () => {
    const mine = own('e1', { scheduleEntryId: 'a' });
    const heard = own('e2', { scheduleEntryId: 'b', status: 'attended', startTime: '18:00' });
    const byHand = own('e3', { source: 'spot', status: 'attended', startTime: '09:00' });
    const all = concerts(
      [mine, heard, byHand],
      [listing('a', '16:00', {}, mine), listing('b', '18:00', {}, heard), listing('c', '17:00')],
      at('08:00'),
    );
    expect(all.map((c) => [c.key, stageOf(c)])).toEqual([
      ['e3', 'heard'],
      ['a', 'shortlisted'],
      ['c', 'listed'],
      ['b', 'heard'],
    ]);
    expect(keys(shortlist(all))).toEqual(['a']);
  });

  it('shows a Missed or lapsed Event’s concert as a plain listing again (ADR 0010)', () => {
    const missed = own('e1', { scheduleEntryId: 'a', status: 'missed' });
    const lapsed = own('e2', { scheduleEntryId: 'b', startTime: '09:00' });
    const all = concerts(
      [missed, lapsed],
      [listing('a', '16:00', {}, missed), listing('b', '09:00', {}, lapsed)],
      at('13:01'),
    );
    expect(all.map(stageOf)).toEqual(['listed', 'listed']);
  });
});

describe('under way', () => {
  const [row] = concerts([], [listing('a', '16:00')], at('08:00'));
  it('reads from the start until 2½ hours after it', () => {
    expect(underWay(row!, notes(), at('15:59'))).toBe(false);
    expect(underWay(row!, notes(), at('16:00'))).toBe(true);
    expect(underWay(row!, notes(), at('18:29'))).toBe(true);
    expect(underWay(row!, notes(), at('18:30'))).toBe(false);
    expect(isOver(row!, notes(), at('18:29'))).toBe(false);
    expect(isOver(row!, notes(), at('18:30'))).toBe(true);
  });

  it('holds the rasika’s own for as long as they are still logging it', () => {
    const mine = own('e1', { scheduleEntryId: 'a', status: 'attended' });
    const [logged] = concerts([mine], [listing('a', '16:00', {}, mine)], at('19:00'));
    const hold = notes({ e1: at('18:50').toISOString() });
    expect(underWay(logged!, hold, at('19:20'))).toBe(true);
    expect(isOver(logged!, hold, at('19:20'))).toBe(false);
    // An hour with nothing logged, and it is over like any other.
    expect(isOver(logged!, hold, at('19:51'))).toBe(true);
  });

  it('never reads a cancelled concert as under way', () => {
    const [off] = concerts([], [listing('a', '16:00', { cancelled: true })], at('08:00'));
    expect(underWay(off!, notes(), at('16:30'))).toBe(false);
  });
});

describe('Starting soon', () => {
  // 3:40 pm: three under way, five in the 4:00 slot, one at 4:30 and one at 6:00.
  const sowmya = own('sowmya', { scheduleEntryId: 'f4' });
  const murthy = own('murthy', { scheduleEntryId: 'i6', startTime: '18:00' });
  const all = concerts(
    [sowmya, murthy],
    [
      listing('a1', '13:30'),
      listing('b3', '15:00'),
      listing('c3', '15:30'),
      listing('d4', '16:00'),
      listing('e4', '16:00'),
      listing('f4', '16:00', {}, sowmya),
      listing('g4', '16:00'),
      listing('h4', '16:30'),
      listing('i6', '18:00', {}, murthy),
      listing('z', '09:00', { date: '2026-12-21' }),
    ],
    at('15:40'),
  );

  it('puts the rasika’s Shortlisted ones first, then the next slot, then others under way', () => {
    const soon = startingSoon(all, notes(), at('15:40'));
    expect(keys(soon.rows)).toEqual(['f4', 'd4', 'e4', 'g4']);
    // The 4:30 one is in the 4:00 slot; the three under way wait behind it, latest first.
    expect(soon.more).toBe(4);
    expect(soon.next).toBeNull();
  });

  it('shows the next slot however far off, never nothing while today has one', () => {
    const soon = startingSoon(all, notes(), at('17:10'));
    // Only the 6:00 slot is ahead. The rasika's own come first, the one under way and the one
    // ahead; then the others under way, the latest to start first.
    expect(keys(soon.rows)).toEqual(['f4', 'i6', 'h4', 'g4']);
    expect(soon.more).toBe(4);
  });

  it('leaves out a Shortlisted concert outside the set, a cancelled one, and the hero’s own', () => {
    expect(keys(startingSoon(all, notes(), at('15:40')).rows)).not.toContain('i6');
    const off = concerts([], [listing('x', '16:00', { cancelled: true })], at('15:40'));
    expect(startingSoon(off, notes(), at('15:40')).rows).toEqual([]);
    expect(keys(startingSoon(all, notes(), at('15:40'), 'sowmya').rows)).not.toContain('f4');
  });

  it('points to the next day’s first concert once nothing is left today', () => {
    const soon = startingSoon(all, notes(), at('21:00'));
    expect(soon.rows).toEqual([]);
    expect(soon.next?.key).toBe('z');
  });
});

describe('the hero', () => {
  const hero = (summaries: EventSummary[], time: string, logged = notes()) => {
    const found = hubHero(summaries, logged, at(time));
    if (!found) return null;
    return found.kind === 'pick'
      ? ['pick', ...found.summaries.map((s) => s.event.id)]
      : [found.kind, found.summary.event.id];
  };

  it('is the concert being logged, over anything else', () => {
    const logging = own('logging', { status: 'attended', startTime: '11:45' });
    const next = own('next', { startTime: '16:00' });
    expect(hero([logging, next], '15:00', notes({ logging: at('14:50').toISOString() }))).toEqual([
      'now',
      'logging',
    ]);
  });

  it('else one of theirs under way, then their soonest ahead', () => {
    const on = own('on', { startTime: '15:00' });
    const later = own('later', { startTime: '18:00' });
    expect(hero([on, later], '15:40')).toEqual(['now', 'on']);
    // Under way only for 2½ hours: then the next one ahead.
    expect(hero([on, later], '17:31')).toEqual(['next', 'later']);
  });

  it('reads Shortlisted concerts within 30 minutes of each other as a choice', () => {
    const a = own('a', { startTime: '16:00' });
    const b = own('b', { startTime: '16:30' });
    const c = own('c', { startTime: '18:00' });
    expect(hero([a, b, c], '15:40')).toEqual(['pick', 'a', 'b']);
    // Still a choice once both are under way; 4:00 and 6:00 never clash.
    expect(hero([a, b, c], '16:40')).toEqual(['pick', 'a', 'b']);
    expect(hero([a, c], '15:40')).toEqual(['next', 'a']);
  });

  it('never reads a Heard concert as a choice', () => {
    const heard = own('heard', { status: 'attended', startTime: '16:00' });
    const other = own('other', { startTime: '16:00' });
    expect(hero([heard, other], '16:10')).toEqual(['now', 'heard']);
  });

  it('never shows a cancelled, Missed or lapsed one, and is none with nothing', () => {
    const off = own('off', { startTime: '18:00' }, { cancelled: true });
    const missed = own('missed', { status: 'missed', startTime: '18:00' });
    const lapsed = own('lapsed', { startTime: '09:00' });
    expect(hero([off, missed, lapsed], '15:40')).toBeNull();
    expect(hero([own('sometime', { startTime: null })], '15:40')).toEqual(['next', 'sometime']);
  });

  it('names the slot by its start', () => {
    expect(['09:00', '13:30', '16:00', '18:45'].map(slotName)).toEqual([
      'morning',
      'afternoon',
      'dusk',
      'evening',
    ]);
  });
});

describe('the Shortlist and the Diary', () => {
  it('groups the Shortlist by day, then by slots of 30 minutes', () => {
    const mine = [
      own('a', { scheduleEntryId: 'a', startTime: '16:00' }),
      own('b', { scheduleEntryId: 'b', startTime: '16:30' }),
      own('c', { scheduleEntryId: 'c', startTime: '18:00' }),
      own('d', { scheduleEntryId: 'd', date: '2026-12-21', startTime: '16:00' }),
    ];
    const days = shortlistDays(shortlist(concerts(mine, [], at('08:00'))));
    expect(days.map((day) => [day.date, day.slots.map(keys)])).toEqual([
      [DAY, [['a', 'b'], ['c']]],
      ['2026-12-21', [['d']]],
    ]);
  });

  it('lists the Heard concerts newest first, and only those', () => {
    const heard = (id: string, date: string, startTime: string) =>
      own(id, { status: 'attended', date, startTime });
    expect(
      diary([
        heard('older', '2026-12-18', '16:00'),
        own('shortlisted'),
        heard('evening', '2026-12-19', '18:45'),
        heard('afternoon', '2026-12-19', '13:30'),
        own('missed', { status: 'missed' }),
      ]).map((summary) => summary.event.id),
    ).toEqual(['evening', 'afternoon', 'older']);
  });
});

describe('the lapse card', () => {
  it('asks only about those the store leaves to the rasika, newest day first', () => {
    const heard = own('heard', { status: 'attended', date: '2026-12-19', startTime: '16:00' });
    const sameSlot = own('same-slot', { date: '2026-12-19', startTime: '16:30' });
    const evening = own('evening', { date: '2026-12-19', startTime: '18:45' });
    const older = own('older', { date: '2026-12-18', startTime: '18:00' });
    const off = own('off', { date: '2026-12-19', startTime: '11:00' }, { cancelled: true });
    const withItem = own('with-item', { date: '2026-12-19', startTime: '09:00' }, { itemCount: 1 });
    const ahead = own('ahead', { startTime: '18:00' });
    expect(
      lapsedToAsk([heard, sameSlot, evening, older, off, withItem, ahead], at('09:00')).map(
        (summary) => summary.event.id,
      ),
    ).toEqual(['evening', 'older']);
  });
});
