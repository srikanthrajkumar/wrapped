// Required (constitution IV, data-loss paths; docs/design/log-entry.md): a blank Concert filled
// from a listing. The fill is one transaction, so a forced close mid-way leaves the blank one as
// it was; Items moved to a Shortlisted Event reach the server once each, never before their
// Event; and Undo after the fill reached the server puts everything back, on the server too.

import { describe, expect, it, vi } from 'vitest';
import type { Event, Item, PushAck, RasikaRow } from '../../src/model';
import type { OutboxEntry, WrappedDB } from '../../src/store/db';
import { createEvent, editEvent } from '../../src/store/events';
import { addItem, draftKey, saveItemDraft } from '../../src/store/items';
import { noteLogging, readLoggingNote } from '../../src/store/logging-note';
import { acknowledge, claimBatch } from '../../src/store/outbox';
import { addAppearance, createArtist } from '../../src/store/people';
import { peekReceipt } from '../../src/store/receipts';
import { RuleError } from '../../src/store/rules';
import {
  addFromSchedule,
  DRAFT_ON_BOTH,
  FILL_CHANGED,
  fillFromSchedule,
  NOT_BLANK,
  readScheduleFile,
  storeSchedule,
  undoFill,
} from '../../src/store/schedule';
import { freshDb, reopen } from '../helpers';
import { fileOf, raw } from './schedule-fixtures';

const ENTRY = 'music-academy-2026-12-15-1600';
const LEAD = 'Malladi Brothers';

async function withSchedule(db: WrappedDB) {
  await storeSchedule(readScheduleFile(fileOf([raw()]))!, null, { db });
}

/** A blank Concert, as Season's + makes it: dated now, nothing else. */
const blankConcert = (db: WrappedDB) =>
  createEvent({ kind: 'concert', date: '2026-12-15', startTime: '16:10' }, { db });

/**
 * A stand-in for the server's push: one row per record, each opId applied once, and, as the
 * server does, an Appearance or Item refused unless its Event is already there (live, for a
 * live row).
 */
class FakeServer {
  rows = new Map<string, RasikaRow>();
  refused: string[] = [];
  private processed = new Map<string, number>();
  private seq = 0;

  push(entries: OutboxEntry[]): PushAck[] {
    const acks: PushAck[] = [];
    for (const entry of entries) {
      const seen = this.processed.get(entry.opId);
      if (seen !== undefined) {
        acks.push({ opId: entry.opId, seq: seen });
        continue;
      }
      const row = entry.row as RasikaRow & { eventId?: string; deletedAt: string | null };
      if (entry.table === 'items' || entry.table === 'appearances') {
        const parent = this.rows.get(row.eventId!) as Event | undefined;
        if (!parent || (row.deletedAt === null && parent.deletedAt !== null)) {
          this.refused.push(entry.opId);
          continue;
        }
      }
      this.seq += 1;
      this.rows.set(entry.recordId, structuredClone(entry.row));
      this.processed.set(entry.opId, this.seq);
      acks.push({ opId: entry.opId, seq: this.seq });
    }
    return acks;
  }
}

/** Push until the outbox is empty, as the sync loop will; a refusal stops it. */
async function syncAll(db: WrappedDB, server: FakeServer) {
  for (let batch = await claimBatch(200, db); batch.length > 0; batch = await claimBatch(200, db)) {
    const acks = server.push(batch);
    expect(server.refused).toEqual([]);
    await acknowledge(
      acks.map((ack) => ack.opId),
      db,
    );
  }
}

const liveItems = async (db: WrappedDB, eventId: string) =>
  (await db.items.where('eventId').equals(eventId).toArray())
    .filter((item) => item.deletedAt === null)
    .sort((a, b) => a.position - b.position);

describe('filling a blank Concert from a listing (required)', () => {
  it('makes the Event "I’m here" makes, and leaves no trace of a blank one that never left', async () => {
    const db = freshDb();
    await withSchedule(db);
    const blank = await blankConcert(db);

    const { event, receipt } = await fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD });
    const asHere = await addFromSchedule(ENTRY, { db });
    expect(asHere.id).toBe(event.id);
    expect(event).toMatchObject({
      scheduleEntryId: ENTRY,
      date: '2026-12-15',
      startTime: '16:00',
      source: 'schedule',
      status: 'planned',
    });
    expect(await db.appearances.where('eventId').equals(event.id).count()).toBe(4);
    expect(await db.events.get(blank.id)).toBeUndefined();
    const outbox = await db.outbox.toArray();
    expect(outbox.some((entry) => entry.recordId === blank.id)).toBe(false);
    expect(receipt).toMatchObject({ kind: 'fill', eventId: event.id });
    expect(receipt.fill).toMatchObject({ lead: LEAD, made: true, moved: [] });
  });

  it('is one transaction: a forced close mid-way leaves the blank one with all it held', async () => {
    const db = freshDb();
    await withSchedule(db);
    const blank = await blankConcert(db);
    const first = await addItem(blank.id, { title: 'Vatapi' }, { db });
    const second = await addItem(blank.id, { title: 'Ninnuvina' }, { db });
    await editEvent(blank.id, { note: 'Front row' }, { db });
    const before = {
      events: await db.events.toArray(),
      items: await db.items.toArray(),
      outbox: await db.outbox.toArray(),
      appearances: await db.appearances.count(),
    };

    // The last write, the receipt, fails, as a close mid-way would leave it.
    const put = db.meta.put.bind(db.meta);
    const spy = vi
      .spyOn(db.meta, 'put')
      .mockImplementation((value, key) =>
        value.key?.startsWith('receipt:')
          ? (Promise.reject(new Error('closed')) as ReturnType<typeof put>)
          : put(value, key),
      );
    await expect(fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD })).rejects.toThrow();
    spy.mockRestore();

    const after = reopen(db);
    expect(await after.events.toArray()).toEqual(before.events);
    expect(await after.items.toArray()).toEqual(before.items);
    expect(await after.outbox.toArray()).toEqual(before.outbox);
    expect(await after.appearances.count()).toBe(before.appearances);
    expect((await liveItems(after, blank.id)).map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('refuses a Concert that is no longer blank, writing nothing', async () => {
    const db = freshDb();
    await withSchedule(db);
    const blank = await blankConcert(db);
    const artist = await createArtist('Someone Else', { db });
    await addAppearance(blank.id, artist.id, {}, { db });
    const queued = await db.outbox.count();
    await expect(fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD })).rejects.toThrow(
      new RuleError([NOT_BLANK]),
    );
    expect(await db.outbox.count()).toBe(queued);
    expect(await db.events.where('scheduleEntryId').equals(ENTRY).count()).toBe(0);
  });

  it('moves Items to a Shortlisted Event: synced once each, never before their Event', async () => {
    const db = freshDb();
    const server = new FakeServer();
    await withSchedule(db);
    // Offline: the blank one and its Items first, then the concert Shortlisted on What's on,
    // so its birth is queued after the Items.
    const blank = await blankConcert(db);
    const first = await addItem(blank.id, { title: 'Vatapi' }, { db });
    const second = await addItem(blank.id, { title: 'Ninnuvina' }, { db });
    await saveItemDraft({ id: 'draft-item', eventId: blank.id, text: 'Endaro' }, { db });
    const shortlisted = await addFromSchedule(ENTRY, { db });
    await editEvent(shortlisted.id, { note: 'With Anu' }, { db });
    await editEvent(blank.id, { note: 'Front row' }, { db });

    const { event, receipt } = await fillFromSchedule(blank.id, ENTRY, {
      db,
      id: 'unused-attempt',
      lead: LEAD,
    });
    expect(event.id).toBe(shortlisted.id);
    expect(event.status).toBe('attended');
    expect(event.note).toBe('With Anu\n\nFront row');
    expect((await liveItems(db, event.id)).map((item) => [item.id, item.position])).toEqual([
      [first.id, 1],
      [second.id, 2],
    ]);
    expect(await db.meta.get(draftKey(event.id))).toBeDefined();
    expect(await db.meta.get(draftKey(blank.id))).toBeUndefined();
    expect(await readLoggingNote(event.id, db)).toBeDefined();
    expect(receipt.fill).toMatchObject({ made: false, draft: true, logging: true });

    // Each Item is queued once, after its Event's birth.
    const outbox = await db.outbox.orderBy('seq').toArray();
    const at = (id: string) => outbox.findIndex((entry) => entry.recordId === id);
    expect(outbox.filter((entry) => entry.recordId === first.id)).toHaveLength(1);
    expect(at(first.id)).toBeGreaterThan(at(shortlisted.id));
    expect(at(second.id)).toBeGreaterThan(at(shortlisted.id));

    await syncAll(db, server);
    const items = [first.id, second.id].map((id) => server.rows.get(id) as Item);
    expect(items.map((item) => [item.id, item.eventId, item.deletedAt])).toEqual([
      [first.id, shortlisted.id, null],
      [second.id, shortlisted.id, null],
    ]);
    expect(server.rows.has(blank.id)).toBe(false);
    expect(server.rows.has('unused-attempt')).toBe(false);
  });

  it('moves Items that already reached the server, and the blank one goes as a delete', async () => {
    const db = freshDb();
    const server = new FakeServer();
    await withSchedule(db);
    const blank = await blankConcert(db);
    const item = await addItem(blank.id, { title: 'Vatapi' }, { db });
    await syncAll(db, server);

    const { event } = await fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD });
    await syncAll(db, server);
    expect((server.rows.get(item.id) as Item).eventId).toBe(event.id);
    expect((server.rows.get(blank.id) as Event).deletedAt).not.toBeNull();
    expect((server.rows.get(event.id) as Event).status).toBe('attended');
  });
});

describe('Undo after a fill (required)', () => {
  it('brings the blank one back, with its Items, after the fill reached the server', async () => {
    const db = freshDb();
    const server = new FakeServer();
    await withSchedule(db);
    const blank = await blankConcert(db);
    const first = await addItem(blank.id, { title: 'Vatapi' }, { db });
    const second = await addItem(blank.id, { title: 'Ninnuvina' }, { db });
    await syncAll(db, server);

    const { event, receipt } = await fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD });
    await syncAll(db, server);
    expect((server.rows.get(blank.id) as Event).deletedAt).not.toBeNull();

    const back = await undoFill(receipt.id, { db });
    expect(back?.id).toBe(blank.id);
    expect(back?.deletedAt).toBeNull();
    expect((await liveItems(db, blank.id)).map((item) => [item.id, item.position])).toEqual([
      [first.id, 1],
      [second.id, 2],
    ]);
    // The Event the fill made goes, with its billed Artists.
    expect((await db.events.get(event.id))?.deletedAt).not.toBeNull();
    const stage = await db.appearances.where('eventId').equals(event.id).toArray();
    expect(stage.every((appearance) => appearance.deletedAt !== null)).toBe(true);

    await syncAll(db, server);
    expect((server.rows.get(blank.id) as Event).deletedAt).toBeNull();
    expect((server.rows.get(first.id) as Item).eventId).toBe(blank.id);
    expect((server.rows.get(second.id) as Item).eventId).toBe(blank.id);
    expect((server.rows.get(event.id) as Event).deletedAt).not.toBeNull();
    // Used once.
    expect(await peekReceipt(db, receipt.id)).toBeUndefined();
    expect(await undoFill(receipt.id, { db })).toBeNull();
  });

  it('brings back a blank one that left no row, and leaves a Shortlisted Event as it was', async () => {
    const db = freshDb();
    await withSchedule(db);
    const shortlisted = await addFromSchedule(ENTRY, { db });
    const blank = await blankConcert(db);
    const { receipt } = await fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD });
    expect(await db.events.get(blank.id)).toBeUndefined();

    const back = await undoFill(receipt.id, { db });
    expect(back).toMatchObject({ id: blank.id, sabhaId: null, startTime: '16:10' });
    const after = await db.events.get(shortlisted.id);
    expect(after).toMatchObject({ status: 'planned', deletedAt: null, note: null });
  });

  it('is refused once the Event was changed after the fill', async () => {
    const db = freshDb();
    await withSchedule(db);
    const blank = await blankConcert(db);
    const { event, receipt } = await fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await addItem(event.id, { title: 'Vatapi' }, { db });

    await expect(undoFill(receipt.id, { db })).rejects.toThrow(new RuleError([FILL_CHANGED]));
    // Refused whole: the receipt is kept, the Event and its Item stay.
    expect(await peekReceipt(db, receipt.id)).toBeDefined();
    expect(await liveItems(db, event.id)).toHaveLength(1);
    expect(await db.events.get(blank.id)).toBeUndefined();
  });

  it('is refused once an Item is being typed on the Event after the fill', async () => {
    const db = freshDb();
    await withSchedule(db);
    const blank = await blankConcert(db);
    const { event, receipt } = await fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await saveItemDraft({ id: 'typed-after', eventId: event.id, text: 'Endaro' }, { db });

    await expect(undoFill(receipt.id, { db })).rejects.toThrow(new RuleError([FILL_CHANGED]));
    expect(await db.meta.get(draftKey(event.id))).toBeDefined();
    expect((await db.events.get(event.id))?.deletedAt).toBeNull();
  });

  it('puts each logging note back as it was', async () => {
    const db = freshDb();
    await withSchedule(db);
    const shortlisted = await addFromSchedule(ENTRY, { db });
    await db.transaction('rw', db.meta, () =>
      noteLogging(db, shortlisted.id, new Date('2026-11-01T15:00:00Z')),
    );
    const blank = await blankConcert(db);
    await addItem(blank.id, { title: 'Vatapi' }, { db });
    const blankNote = await readLoggingNote(blank.id, db);
    const { receipt } = await fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD });
    expect((await readLoggingNote(shortlisted.id, db))?.lastLoggedAt).toBe(blankNote?.lastLoggedAt);

    await undoFill(receipt.id, { db });
    expect(await readLoggingNote(blank.id, db)).toEqual(blankNote);
    expect((await readLoggingNote(shortlisted.id, db))?.lastLoggedAt).toBe(
      '2026-11-01T15:00:00.000Z',
    );
  });
});

describe('an Item being typed on both Concerts (required)', () => {
  it('refuses the fill, so neither draft is lost', async () => {
    const db = freshDb();
    await withSchedule(db);
    const shortlisted = await addFromSchedule(ENTRY, { db });
    const blank = await blankConcert(db);
    await saveItemDraft({ id: 'on-blank', eventId: blank.id, text: 'Endaro' }, { db });
    await saveItemDraft({ id: 'on-event', eventId: shortlisted.id, text: 'Vatapi' }, { db });

    await expect(fillFromSchedule(blank.id, ENTRY, { db, lead: LEAD })).rejects.toThrow(
      new RuleError([DRAFT_ON_BOTH]),
    );
    expect(await db.meta.get(draftKey(blank.id))).toBeDefined();
    expect(await db.meta.get(draftKey(shortlisted.id))).toBeDefined();
    expect((await db.events.get(blank.id))?.deletedAt).toBeNull();
  });
});
