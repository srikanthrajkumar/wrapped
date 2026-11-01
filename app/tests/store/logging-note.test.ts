// Which Event is Now (T048c; eng D2, design D3 and D17): the Event being logged on this phone,
// else the nearest start, with ended Events excluded and a catalog upgrade never counting as
// logging.

import { describe, expect, it } from 'vitest';
import { upgradeCatalog } from '../../src/catalog/upgrade';
import { CATALOG_VERSION_KEY } from '../../src/store/catalog-version';
import { createEvent } from '../../src/store/events';
import { addItem, pickComposition } from '../../src/store/items';
import {
  endLogging,
  nowEvent,
  readLoggingNotes,
  type LoggingNote,
} from '../../src/store/logging-note';
import { listEvents } from '../../src/store/queries';
import type { Event } from '../../src/model';
import { fixtureCatalog, freshDb } from '../helpers';

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return new Date(2026, 11, 14, h, m);
};

function event(id: string, startTime: string | null, fields: Partial<Event> = {}): Event {
  return {
    id,
    kind: 'concert',
    date: '2026-12-14',
    startTime,
    sabhaId: null,
    status: 'planned',
    cancelled: false,
    source: 'plan',
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
  };
}

const notes = (...list: LoggingNote[]) => new Map(list.map((note) => [note.eventId, note]));
const logged = (eventId: string, time: string, doneAt: string | null = null): LoggingNote => ({
  eventId,
  lastLoggedAt: at(time).toISOString(),
  doneAt: doneAt && at(doneAt).toISOString(),
});

describe('nowEvent', () => {
  const four = event('four', '16:00');
  const evening = event('evening', '18:30');

  it('gives Now to the nearest start, with the other as a smaller line', () => {
    const { now, others } = nowEvent([four, evening], notes(), at('17:45'));
    expect(now?.id).toBe('evening');
    expect(others.map((e) => e.id)).toEqual(['four']);
  });

  it('keeps Now on the Concert being logged in the last hour', () => {
    const { now, others } = nowEvent([four, evening], notes(logged('four', '17:10')), at('17:45'));
    expect(now?.id).toBe('four');
    expect(others.map((e) => e.id)).toEqual(['evening']);
  });

  it('lets go after an hour without logging', () => {
    const { now } = nowEvent([four, evening], notes(logged('four', '16:40')), at('17:45'));
    expect(now?.id).toBe('evening');
  });

  it('lets go at the end of the window, logged or not', () => {
    // Four hours after 4 pm is 8 pm.
    const { now, others } = nowEvent([four], notes(logged('four', '20:00')), at('20:05'));
    expect(now).toBeNull();
    expect(others).toEqual([]);
  });

  it('opens the window an hour before the start', () => {
    expect(nowEvent([evening], notes(), at('17:29')).now).toBeNull();
    expect(nowEvent([evening], notes(), at('17:30')).now?.id).toBe('evening');
  });

  it('excludes an Event ended with Done from both paths', () => {
    const done = notes(logged('evening', '19:30', '19:40'));
    const { now, others } = nowEvent([four, evening], done, at('19:45'));
    // The 4 pm is still in its window and takes Now; the ended Concert is not even a line.
    expect(now?.id).toBe('four');
    expect(others).toEqual([]);
    expect(nowEvent([evening], done, at('19:45')).now).toBeNull();
  });

  it('treats a note time in the future as now', () => {
    const { now } = nowEvent([four, evening], notes(logged('four', '23:00')), at('17:45'));
    expect(now?.id).toBe('four');
  });

  it('never gives Now to a Missed or cancelled Event', () => {
    const missed = event('missed', '18:00', { status: 'missed' });
    const cancelled = event('cancelled', '18:00', { cancelled: true });
    expect(nowEvent([missed, cancelled], notes(), at('18:00')).now).toBeNull();
  });

  it('keeps an Event with no start time in its window all day', () => {
    const allDay = event('allDay', null);
    expect(nowEvent([allDay], notes(), at('09:00')).now?.id).toBe('allDay');
    expect(nowEvent([allDay, evening], notes(), at('18:00')).now?.id).toBe('evening');
  });
});

describe('the logging note', () => {
  it('is written by logging, cleared from Done by logging again', async () => {
    const db = freshDb();
    const concert = await createEvent({ kind: 'concert' }, { db });
    await addItem(concert.id, {}, { db });
    expect((await readLoggingNotes(db)).get(concert.id)).toMatchObject({
      lastLoggedAt: expect.any(String),
      doneAt: null,
    });

    await endLogging(concert.id, { db });
    expect((await readLoggingNotes(db)).get(concert.id)?.doneAt).toEqual(expect.any(String));

    await addItem(concert.id, {}, { db });
    expect((await readLoggingNotes(db)).get(concert.id)?.doneAt).toBeNull();
  });

  it('is not touched by a catalog upgrade, so the upgrade makes no Event Now', async () => {
    const db = freshDb();
    const v1 = fixtureCatalog('catalog-v1.json');
    const v2 = fixtureCatalog('catalog-v2.json');
    await db.meta.put({ key: CATALOG_VERSION_KEY, value: v1.version });
    const old = await createEvent(
      { kind: 'concert', source: 'plan', date: '2026-12-14', startTime: '16:00' },
      { db },
    );
    const item = await pickComposition(
      (await addItem(old.id, {}, { db })).id,
      v1.songByKritiId.get('c0005')!,
      { db },
    );
    const evening = await createEvent(
      { kind: 'concert', source: 'plan', date: '2026-12-14', startTime: '18:30' },
      { db },
    );
    // The 4 pm was last logged at 4:30, over an hour before the upgrade runs at 5:45.
    await db.meta.put({ key: `loggingNote:${old.id}`, value: logged(old.id, '16:30') });
    const before = await readLoggingNotes(db);

    expect((await upgradeCatalog(v2, { db })).changed).toBe(1);

    expect(await readLoggingNotes(db)).toEqual(before);
    expect((await db.items.get(item.id))?.ragas[0]?.key).toBe('Dheerasankarabharanam');
    const { now } = nowEvent(await listEvents(db), await readLoggingNotes(db), at('17:45'));
    expect(now?.id).toBe(evening.id);
  });
});
