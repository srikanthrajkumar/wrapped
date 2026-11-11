// The Season spine's data change (ADR 0010). Required: these are the paths where a mistake
// would lose or falsify a rasika's record. No stored Event is rewritten on upgrade; the first
// Item makes a Shortlisted Event Heard in the Item's own transaction; a lapsed one is settled
// by an ordinary save with its outbox entry and is never deleted; a Missed one is kept, in the
// store and in the Export, and can be Shortlisted again as the same Event.

import { describe, expect, it } from 'vitest';
import type { Event, ScheduleEntry } from '../../src/model';
import type { WrappedDB } from '../../src/store/db';
import { createEvent, removeShortlisted, setStatus } from '../../src/store/events';
import { buildExport } from '../../src/store/export';
import { addItem, addItemFrom, removeItem, restoreItem } from '../../src/store/items';
import {
  hasLapsed,
  lapseVerdict,
  letGo,
  sameSlot,
  settleLapsed,
  wasThere,
} from '../../src/store/lapse';
import { listEventSummaries, listSchedule } from '../../src/store/queries';
import { addFromSchedule, applySchedule, storeSchedule } from '../../src/store/schedule';
import { freshDb, reopen } from '../helpers';

const entry = (fields: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
  id: 'academy-1600',
  version: 1,
  date: '2026-12-20',
  startTime: '16:00',
  sabha: 'Music Academy',
  kind: 'concert',
  title: null,
  billed: [
    { name: 'S. Sowmya', role: 'vocal', group: null, support: false },
    { name: 'Embar Kannan', role: 'violin', group: null, support: false },
  ],
  cancelled: false,
  ...fields,
});

async function publish(db: WrappedDB, ...entries: ScheduleEntry[]) {
  await storeSchedule(
    { season: '2026-27', publishedAt: '2026-11-01T00:00:00.000Z', entries },
    null,
    { db },
  );
  await applySchedule({ db });
}

const at = (time: string, date = '2026-12-20') => new Date(`${date}T${time}:00`);
const outboxOf = async (db: WrappedDB, id: string) =>
  (await db.outbox.where('recordId').equals(id).toArray()).map((queued) => queued.op);

describe('the stored status (ADR 0010)', () => {
  it('rewrites nothing on upgrade: Shortlisted is the stored planned, as it was', async () => {
    const db = freshDb();
    // Rows as a 0.2.0 build stored them, put straight into the tables: a Planned Event from
    // the Schedule, a Missed one, an Attended one, and an outbox entry never sent.
    const row = (id: string, status: Event['status'], fields: Partial<Event> = {}): Event => ({
      id,
      kind: 'concert',
      date: '2026-11-20',
      startTime: '18:30',
      sabhaId: null,
      status,
      cancelled: false,
      source: 'schedule',
      scheduleEntryId: `entry-${id}`,
      scheduleVersionSeen: '1',
      scheduleChanged: false,
      touched: false,
      title: null,
      note: null,
      createdAt: '2026-11-08T10:00:00.000Z',
      updatedAt: '2026-11-08T10:00:00.000Z',
      deletedAt: null,
      ...fields,
    });
    const rows = [row('p', 'planned'), row('m', 'missed'), row('a', 'attended', { touched: true })];
    await db.events.bulkPut(rows);
    await db.outbox.add({
      opId: 'op-1',
      table: 'events',
      recordId: 'p',
      op: 'save',
      row: rows[0]!,
      queuedAt: '2026-11-08T10:00:00.000Z',
      firstSentAt: null,
    });
    const queued = await db.outbox.toArray();

    // The new build opens the store and reads it, as every screen does: nothing is written.
    const again = reopen(db);
    await listEventSummaries(again);
    await listSchedule('', again);
    expect(await again.events.toArray()).toEqual(expect.arrayContaining(rows));
    expect(await again.events.count()).toBe(3);
    expect(await again.outbox.toArray()).toEqual(queued);
    // No record changed shape, so the store's version is the one 0.2.0 opened.
    expect(again.verno).toBe(4);
  });

  it('keeps a Missed Event in the store, the summaries and the Export', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert', source: 'plan', note: 'kept' }, { db });
    await setStatus(event.id, 'missed', { db });
    const exported = await buildExport({ db, appVersion: 'test' });
    expect(exported.events).toEqual([
      expect.objectContaining({ id: event.id, status: 'missed', note: 'kept', deletedAt: null }),
    ]);
    expect((await listEventSummaries(db)).map((s) => s.event.status)).toEqual(['missed']);
    expect((await db.events.get(event.id))!.deletedAt).toBeNull();
  });
});

describe('the first Item makes a concert Heard', () => {
  it('moves a Shortlisted Event to Attended in the Item’s own transaction', async () => {
    const db = freshDb();
    await publish(db, entry());
    const event = await addFromSchedule(entry().id, { db });
    expect(event).toMatchObject({ status: 'planned', touched: false });
    await db.outbox.clear();

    const item = await addItemFrom(event.id, { kind: 'unknown' }, { db });
    const heard = (await db.events.get(event.id))!;
    expect(heard).toMatchObject({
      id: event.id,
      status: 'attended',
      touched: true,
      scheduleChanged: false,
      source: 'schedule',
      scheduleEntryId: entry().id,
      date: event.date,
      startTime: event.startTime,
      sabhaId: event.sabhaId,
    });
    // Both writes are queued for the server, the Event's among them.
    expect(await outboxOf(db, event.id)).toEqual(['save']);
    expect(await outboxOf(db, item.id)).toEqual(['save']);
    // A second Item changes the Event no further.
    const stamped = heard.updatedAt;
    await addItem(event.id, { title: 'Vatapi' }, { db });
    expect((await db.events.get(event.id))!.updatedAt).toBe(stamped);
  });

  it('leaves the Event Shortlisted when the Item is refused: both writes or neither', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert', source: 'plan' }, { db });
    await db.outbox.clear();
    // A title that is not text breaks a rule, after the Event's save in the same transaction.
    await expect(addItem(event.id, { title: 5 as unknown as string }, { db })).rejects.toThrow();
    expect((await db.events.get(event.id))!).toMatchObject({ status: 'planned', touched: false });
    expect(await db.items.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('stays Heard once its only Item is deleted: Items are optional', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert', source: 'plan' }, { db });
    const item = await addItem(event.id, {}, { db });
    await removeItem(item.id, { db });
    expect((await db.events.get(event.id))!.status).toBe('attended');
  });

  it('makes its concert Heard when an Item is brought back by Undo', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert', source: 'plan' }, { db });
    const item = await addItem(event.id, {}, { db });
    const removed = (await removeItem(item.id, { db }))!;
    // Let go meanwhile, with no Item left: Missed, and hidden.
    await setStatus(event.id, 'planned', { db });
    await setStatus(event.id, 'missed', { db });
    await restoreItem(removed.receipt.id, { db });
    expect((await db.events.get(event.id))!).toMatchObject({ status: 'attended', touched: true });
    expect((await db.items.get(item.id))!.deletedAt).toBeNull();
  });

  it('makes a Missed Event Heard too, never leaving one with an Item hidden', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert', source: 'plan' }, { db });
    await setStatus(event.id, 'missed', { db });
    await addItem(event.id, {}, { db });
    expect((await db.events.get(event.id))!.status).toBe('attended');
  });

  it('stops the Schedule changing it once Heard', async () => {
    const db = freshDb();
    await publish(db, entry());
    const event = await addFromSchedule(entry().id, { db });
    await addItem(event.id, {}, { db });
    await publish(db, entry({ version: 2, startTime: '18:30' }));
    expect((await db.events.get(event.id))!).toMatchObject({
      startTime: '16:00',
      scheduleChanged: false,
    });
  });
});

describe('Shortlisting again', () => {
  it('brings a Missed Event back as the same Event, and never makes a second', async () => {
    const db = freshDb();
    await publish(db, entry());
    const event = await addFromSchedule(entry().id, { db });
    await setStatus(event.id, 'missed', { db });
    expect((await listSchedule('', db))[0]).toMatchObject({
      plannedId: event.id,
      status: 'missed',
    });

    const again = await addFromSchedule(entry().id, { db });
    expect(again).toMatchObject({ id: event.id, status: 'planned' });
    expect(await db.events.count()).toBe(1);
    expect((await outboxOf(db, event.id)).at(-1)).toBe('save');
  });

  it('brings it back by the sheet’s own attempt id too', async () => {
    const db = freshDb();
    await publish(db, entry());
    const event = await addFromSchedule(entry().id, { db, id: 'attempt-1' });
    await setStatus(event.id, 'missed', { db });
    // The sheet stayed open and keeps its id for the entry: the same tap again.
    expect(await addFromSchedule(entry().id, { db, id: 'attempt-1' })).toMatchObject({
      id: 'attempt-1',
      status: 'planned',
    });
  });
});

describe('taking a concert off the Shortlist', () => {
  it('deletes a Shortlisted Event with nothing logged, as a tombstone that syncs', async () => {
    const db = freshDb();
    await publish(db, entry());
    const event = await addFromSchedule(entry().id, { db });
    const removed = await removeShortlisted(event.id, { db });
    expect(removed?.tombstone.deletedAt).not.toBeNull();
    expect((await outboxOf(db, event.id)).at(-1)).toBe('remove');
  });

  it('never deletes a concert that was logged meanwhile, or is no longer Shortlisted', async () => {
    const db = freshDb();
    await publish(db, entry());
    const event = await addFromSchedule(entry().id, { db });
    // Logged in another tab while the sheet stayed open on "Shortlisted".
    const item = await addItem(event.id, { title: 'Vatapi' }, { db });
    const before = {
      events: await db.events.toArray(),
      items: await db.items.toArray(),
      appearances: await db.appearances.toArray(),
      outbox: await db.outbox.toArray(),
    };
    expect(await removeShortlisted(event.id, { db })).toBeUndefined();
    expect({
      events: await db.events.toArray(),
      items: await db.items.toArray(),
      appearances: await db.appearances.toArray(),
      outbox: await db.outbox.toArray(),
    }).toEqual(before);
    expect((await db.items.get(item.id))!.deletedAt).toBeNull();

    // A Shortlisted Event that holds an Item, as an older build could leave it; and a Missed one.
    await setStatus(event.id, 'planned', { db });
    expect(await removeShortlisted(event.id, { db })).toBeUndefined();
    const missed = await createEvent({ kind: 'concert', source: 'plan' }, { db });
    await setStatus(missed.id, 'missed', { db });
    expect(await removeShortlisted(missed.id, { db })).toBeUndefined();
    expect((await db.events.toArray()).every((one) => one.deletedAt === null)).toBe(true);
  });
});

describe('the lapse', () => {
  const timed = (startTime: string | null, date = '2026-12-20') => ({ date, startTime });

  it('lapses a Shortlisted Event four hours after its start, or at the end of an untimed day', () => {
    const planned = { status: 'planned' as const, ...timed('16:00') };
    expect(hasLapsed(planned, at('20:00'))).toBe(false);
    expect(hasLapsed(planned, at('20:01'))).toBe(true);
    expect(hasLapsed({ ...planned, startTime: null }, at('23:59'))).toBe(false);
    expect(hasLapsed({ ...planned, startTime: null }, at('00:01', '2026-12-21'))).toBe(true);
    // Only a Shortlisted one lapses.
    expect(hasLapsed({ ...planned, status: 'attended' }, at('23:00'))).toBe(false);
    expect(hasLapsed({ ...planned, status: 'missed' }, at('23:00'))).toBe(false);
  });

  it('counts starts within 30 minutes of each other as one slot', () => {
    expect(sameSlot(timed('16:00'), timed('16:30'))).toBe(true);
    expect(sameSlot(timed('16:00'), timed('16:31'))).toBe(false);
    expect(sameSlot(timed('16:00'), timed('16:00', '2026-12-21'))).toBe(false);
    // Never across midnight: 11:50 pm and 12:10 am are two days' concerts.
    expect(sameSlot(timed('23:50'), timed('00:10', '2026-12-21'))).toBe(false);
    expect(sameSlot(timed(null), timed('16:00'))).toBe(false);
  });

  it('never calls an Event with an Item Missed', () => {
    const facts = { items: 1, cancelled: true, heard: [timed('16:00')] };
    expect(lapseVerdict(timed('16:00'), facts)).toBe('attended');
    expect(lapseVerdict(timed('16:00'), { ...facts, items: 0 })).toBe('missed');
    expect(lapseVerdict(timed('16:00'), { items: 0, cancelled: false, heard: [] })).toBe('ask');
  });

  async function season(db: WrappedDB) {
    const make = (fields: Partial<Event>) =>
      createEvent({ kind: 'concert', source: 'plan', date: '2026-12-20', ...fields }, { db });
    const heard = await make({ startTime: '16:00' });
    await addItem(heard.id, {}, { db });
    return {
      heard,
      sameSlot: await make({ startTime: '16:30' }),
      evening: await make({ startTime: '18:45' }),
      ahead: await make({ date: '2026-12-21', startTime: '18:45' }),
    };
  }

  it('settles what nobody was asked about, as ordinary saves, and leaves the rest to the card', async () => {
    const db = freshDb();
    await publish(db, entry({ id: 'off', startTime: '11:00', cancelled: false }));
    const off = await addFromSchedule('off', { db });
    await publish(db, entry({ id: 'off', version: 2, startTime: '11:00', cancelled: true }));
    const made = await season(db);
    await db.outbox.clear();

    const ask = await settleLapsed({ db, now: at('09:00', '2026-12-21') });
    expect(ask).toEqual([made.evening.id]);
    const status = async (id: string) => (await db.events.get(id))!.status;
    expect(await status(made.sameSlot.id)).toBe('missed');
    expect(await status(off.id)).toBe('missed');
    expect(await status(made.evening.id)).toBe('planned');
    expect(await status(made.ahead.id)).toBe('planned');
    expect(await status(made.heard.id)).toBe('attended');
    // Each settled Event was saved through the outbox; none was deleted.
    expect(await outboxOf(db, made.sameSlot.id)).toEqual(['save']);
    expect(await outboxOf(db, off.id)).toEqual(['save']);
    expect((await db.events.toArray()).every((event) => event.deletedAt === null)).toBe(true);

    // Run again, it writes nothing more: every row and every queued entry is as it was.
    const before = { events: await db.events.toArray(), outbox: await db.outbox.toArray() };
    expect(await settleLapsed({ db, now: at('09:00', '2026-12-21') })).toEqual([made.evening.id]);
    expect({ events: await db.events.toArray(), outbox: await db.outbox.toArray() }).toEqual(
      before,
    );
  });

  it('judges the empty ones against every concert heard, in one run', async () => {
    const db = freshDb();
    const make = (startTime: string) =>
      createEvent({ kind: 'concert', source: 'plan', date: '2026-12-20', startTime }, { db });
    // Shortlisted with an Item, as an older build could leave it, and an empty one in its slot.
    const withItem = await make('16:00');
    await addItem(withItem.id, {}, { db });
    await setStatus(withItem.id, 'planned', { db });
    const sameSlotEmpty = await make('16:30');
    expect(await settleLapsed({ db, now: at('09:00', '2026-12-21') })).toEqual([]);
    expect((await db.events.get(withItem.id))!.status).toBe('attended');
    expect((await db.events.get(sameSlotEmpty.id))!.status).toBe('missed');
  });

  it('makes a lapsed Event that holds an Item Heard, however it came to hold one', async () => {
    const db = freshDb();
    const event = await createEvent(
      { kind: 'concert', source: 'plan', date: '2026-12-20', startTime: '16:00' },
      { db },
    );
    await addItem(event.id, {}, { db });
    // As a build before ADR 0010 could leave it: Shortlisted, with an Item.
    await setStatus(event.id, 'planned', { db });
    expect(await settleLapsed({ db, now: at('09:00', '2026-12-21') })).toEqual([]);
    expect((await db.events.get(event.id))!.status).toBe('attended');
    expect(await db.items.where('eventId').equals(event.id).count()).toBe(1);
  });

  it('writes nothing until the rasika answers: reading the lapsed changes no row', async () => {
    const db = freshDb();
    await season(db);
    const before = { events: await db.events.toArray(), outbox: await db.outbox.toArray() };
    await listEventSummaries(db);
    await listSchedule('', db);
    expect({ events: await db.events.toArray(), outbox: await db.outbox.toArray() }).toEqual(
      before,
    );
  });

  it('takes the rasika’s word: there makes it Heard, even over a Missed set meanwhile', async () => {
    const db = freshDb();
    const { evening, sameSlot: other } = await season(db);
    expect(await wasThere(evening.id, { db })).toMatchObject({ status: 'attended', touched: true });
    // Settled as Missed on another phone, or by this one, before the tap landed.
    await setStatus(other.id, 'missed', { db });
    expect((await wasThere(other.id, { db })).status).toBe('attended');
    // Already Heard: nothing more is written.
    const queued = await db.outbox.toArray();
    await wasThere(other.id, { db });
    expect(await db.outbox.toArray()).toEqual(queued);
  });

  it('lets one go as Missed, but never one that holds an Item or is no longer Shortlisted', async () => {
    const db = freshDb();
    const { evening, heard, sameSlot: other } = await season(db);
    expect((await letGo(evening.id, { db })).status).toBe('missed');
    expect((await db.events.get(evening.id))!.deletedAt).toBeNull();
    // Heard already: left as it is.
    expect((await letGo(heard.id, { db })).status).toBe('attended');
    // It gained an Item before the tap landed: Heard, never Missed.
    await addItem(other.id, {}, { db });
    await setStatus(other.id, 'planned', { db });
    expect((await letGo(other.id, { db })).status).toBe('attended');
  });
});
