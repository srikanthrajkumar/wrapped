// Required (constitution IV, data-loss paths; docs/design/log-entry.md): a blank Concert is
// filled from a listing only once everything entered for it is in the store, here or in another
// tab; a double tap fills it once; and its Undo waits for what is typed on the filled Event and
// holds the blank Concert, so no tab's sweep takes it back before its page opens.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleEntry } from '../../src/model';
import { lockManager } from './locks';

vi.mock('../../src/catalog/use-catalog', () => ({ readyCatalog: async () => null }));

/** localStorage, shared by the journal, the new-Concert notes and the Undo bar, as tabs share it. */
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  get length() {
    return storage.size;
  },
  key: (index: number) => [...storage.keys()][index] ?? null,
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
});
const locks = lockManager();
vi.stubGlobal('navigator', { locks });

const { db } = await import('../../src/store/db');
const { editEvent } = await import('../../src/store/events');
const { addFromSchedule, readScheduleFile, storeSchedule } =
  await import('../../src/store/schedule');
const { fileOf, raw } = await import('../store/schedule-fixtures');
const { saveFeedback, NOT_SAVED_PREFIX } = await import('../../src/screens/save-feedback');
const { fillFromListing, addTarget } = await import('../../src/screens/listing-event');
const { startConcert } = await import('../../src/screens/start-concert');
const { dropNewConcert, isNewConcert, sweepNewConcerts } =
  await import('../../src/screens/new-concert');
const { undo, undoOffers, dismissUndo } = await import('../../src/screens/undo');

const ENTRY = 'music-academy-2026-12-15-1600';
const LEAD = 'Malladi Brothers';
let entry: ScheduleEntry;

beforeEach(async () => {
  for (const offer of undoOffers()) dismissUndo(offer.receipt.id);
  storage.clear();
  await Promise.all(db.tables.map((table) => table.clear()));
  await storeSchedule(readScheduleFile(fileOf([raw()]))!, null);
  entry = (await db.schedule.get(ENTRY))!;
});

/** A blank Concert as Season's +  makes it, its page not open (the + tap's hold let go). */
async function blank() {
  const made = (await startConcert())!;
  dropNewConcert(made.id);
  return made;
}

const note = (id: string) => ({ table: 'events' as const, id, field: 'note' });
const listingEvents = () => db.events.where('scheduleEntryId').equals(ENTRY).toArray();

function deferred() {
  let settle!: { resolve(): void; reject(error: Error): void };
  const promise = new Promise<void>((resolve, reject) => (settle = { resolve, reject }));
  return { promise, ...settle };
}

describe('a fill waits for what was entered on the blank Concert (required)', () => {
  it('a Note still being written, then failing, keeps the blank Concert to try again on', async () => {
    const concert = await blank();
    const write = deferred();
    const saving = saveFeedback.track(note(concert.id), 'Front row', async () => {
      await write.promise;
      return editEvent(concert.id, { note: 'Front row' });
    });
    const filled = fillFromListing(concert.id, entry, LEAD);
    write.reject(new Error('disk full'));
    await saving;

    expect(await filled).toBeNull();
    expect((await db.events.get(concert.id))?.deletedAt).toBeNull();
    expect(await listingEvents()).toEqual([]);
    expect(saveFeedback.get(note(concert.id))).toMatchObject({ status: 'failed' });
    saveFeedback.drop(note(concert.id));
  });

  it('a Note still being written, then saved, goes with the fill', async () => {
    const concert = await blank();
    const write = deferred();
    const saving = saveFeedback.track(note(concert.id), 'Front row', async () => {
      await write.promise;
      return editEvent(concert.id, { note: 'Front row' });
    });
    const filled = fillFromListing(concert.id, entry, LEAD);
    write.resolve();
    await saving;

    expect(await filled).toMatchObject({ scheduleEntryId: ENTRY, note: 'Front row' });
    saveFeedback.drop(note(concert.id));
  });

  it('a Note typed in another tab and not yet written keeps the blank Concert', async () => {
    const concert = await blank();
    // The other tab's journal, as it copies it to the shared storage.
    storage.set(
      `${NOT_SAVED_PREFIX}events:${concert.id}:note`,
      JSON.stringify({
        ...note(concert.id),
        value: 'Typed in the other tab',
        enteredAt: new Date().toISOString(),
        state: 'typed',
        kind: 'value',
      }),
    );

    expect(await fillFromListing(concert.id, entry, LEAD)).toBeNull();
    expect((await db.events.get(concert.id))?.deletedAt).toBeNull();
    expect(await listingEvents()).toEqual([]);
  });

  it('an Item whose add failed keeps the blank Concert, so its Try again still has it', async () => {
    const concert = await blank();
    const item = { table: 'items' as const, id: 'failed-item', field: '*' };
    await saveFeedback.track(item, { eventId: concert.id, title: 'Vatapi' }, () =>
      Promise.reject(new Error('disk full')),
    );

    expect(await fillFromListing(concert.id, entry, LEAD)).toBeNull();
    expect((await db.events.get(concert.id))?.deletedAt).toBeNull();
    saveFeedback.drop(item);
  });
});

describe('a double tap on a listing (required)', () => {
  it('fills once, and shows no "Not saved"', async () => {
    const concert = await blank();
    const [first, second] = await Promise.all([
      fillFromListing(concert.id, entry, LEAD),
      fillFromListing(concert.id, entry, LEAD),
    ]);
    expect(first).not.toBeNull();
    expect(second?.id).toBe(first!.id);
    expect(saveFeedback.get(addTarget(first!.id))?.status).not.toBe('failed');
    expect(saveFeedback.notSaved().filter((one) => one.state === 'failed')).toEqual([]);
    expect(await listingEvents()).toHaveLength(1);
    // And a tap after it was filled finds nothing left to fill, and fails nothing.
    expect(await fillFromListing(concert.id, entry, LEAD)).toBeNull();
    expect(saveFeedback.notSaved().filter((one) => one.state === 'failed')).toEqual([]);
  });
});

describe('Undo of a fill (required)', () => {
  const fillOffer = () => undoOffers().find((offer) => offer.receipt.kind === 'fill')!;

  it('waits for a Note typed on the filled Event, keeping it', async () => {
    const concert = await blank();
    const event = (await fillFromListing(concert.id, entry, LEAD))!;
    saveFeedback.hold(note(event.id), 'Sat by the pillar');

    expect(await undo(fillOffer().receipt)).toBe(false);
    expect(fillOffer()).toMatchObject({ failed: true, refused: 'it was changed since' });
    expect((await db.events.get(event.id))?.deletedAt).toBeNull();
    expect(await db.events.get(concert.id)).toBeUndefined();
    saveFeedback.drop(note(event.id));
  });

  it('holds the blank Concert it brings back: a sweep meanwhile leaves it, noted as new', async () => {
    const concert = await blank();
    await fillFromListing(concert.id, entry, LEAD);
    expect(isNewConcert(concert.id)).toBe(false);

    expect(await undo(fillOffer().receipt)).toBe(true);
    // Season opens in another tab before this one's page of the blank Concert does.
    await sweepNewConcerts();
    expect((await db.events.get(concert.id))?.deletedAt).toBeNull();
    expect(isNewConcert(concert.id)).toBe(true);
    dropNewConcert(concert.id);
  });
});

/** A Note typed in another tab, as that tab copies its journal to the shared storage. */
function typedInAnotherTab(eventId: string, value: string) {
  storage.set(
    `${NOT_SAVED_PREFIX}events:${eventId}:note`,
    JSON.stringify({
      ...note(eventId),
      value,
      enteredAt: new Date().toISOString(),
      state: 'typed',
      kind: 'value',
    }),
  );
}

/** Run `typed` once, while the store's transaction writes an Event: another tab types then. */
function whileWriting(typed: () => void) {
  let once = false;
  const during = () => {
    if (once) return;
    once = true;
    typed();
  };
  db.events.hook('creating', during);
  db.events.hook('updating', during);
  db.events.hook('deleting', during);
  return () => {
    db.events.hook('creating').unsubscribe(during);
    db.events.hook('updating').unsubscribe(during);
    db.events.hook('deleting').unsubscribe(during);
  };
}

describe('a second tab typing while the fill or its Undo is written (required)', () => {
  it('a Note typed on the blank Concert mid-fill rolls the fill back', async () => {
    const concert = await blank();
    const stop = whileWriting(() => typedInAnotherTab(concert.id, 'Typed mid-fill'));
    const filled = await fillFromListing(concert.id, entry, LEAD);
    stop();

    expect(filled).toBeNull();
    expect((await db.events.get(concert.id))?.deletedAt).toBeNull();
    expect(await listingEvents()).toEqual([]);
    expect(await db.meta.filter((row) => row.key.startsWith('receipt:')).count()).toBe(0);
  });

  it('a Note typed on the filled Event mid-Undo rolls the Undo back', async () => {
    const concert = await blank();
    const event = (await fillFromListing(concert.id, entry, LEAD))!;
    const offer = undoOffers().find((one) => one.receipt.kind === 'fill')!;
    const stop = whileWriting(() => typedInAnotherTab(event.id, 'Typed mid-Undo'));
    const undone = await undo(offer.receipt);
    stop();

    expect(undone).toBe(false);
    expect((await db.events.get(event.id))?.deletedAt).toBeNull();
    expect(await db.events.get(concert.id)).toBeUndefined();
  });
});

describe('Undo of a fill into the rasika’s own Event (required)', () => {
  it('goes ahead with a date typed on it before the fill, and keeps that date typed', async () => {
    const shortlisted = await addFromSchedule(ENTRY);
    const date = { table: 'events' as const, id: shortlisted.id, field: 'date' };
    saveFeedback.hold(date, '2026-12-16');
    const concert = await blank();
    await fillFromListing(concert.id, entry, LEAD);
    const offer = undoOffers().find((one) => one.receipt.kind === 'fill')!;

    expect(await undo(offer.receipt)).toBe(true);
    expect((await db.events.get(concert.id))?.deletedAt).toBeNull();
    expect((await db.events.get(shortlisted.id))?.deletedAt).toBeNull();
    expect(saveFeedback.get(date)).toMatchObject({ status: 'typed', value: '2026-12-16' });
    saveFeedback.drop(date);
    dropNewConcert(concert.id);
  });

  it('goes ahead with a Note typed on it before a fill that left its Note as it was', async () => {
    const shortlisted = await addFromSchedule(ENTRY);
    saveFeedback.hold(note(shortlisted.id), 'Typed before');
    const concert = await blank();
    await fillFromListing(concert.id, entry, LEAD);
    const offer = undoOffers().find((one) => one.receipt.kind === 'fill')!;

    expect(await undo(offer.receipt)).toBe(true);
    expect((await db.events.get(concert.id))?.deletedAt).toBeNull();
    expect(saveFeedback.get(note(shortlisted.id))).toMatchObject({
      status: 'typed',
      value: 'Typed before',
    });
    saveFeedback.drop(note(shortlisted.id));
    dropNewConcert(concert.id);
  });

  it('waits for a Note typed on it after the fill added the blank Concert’s, which Undo would put back', async () => {
    const shortlisted = await addFromSchedule(ENTRY);
    const concert = await blank();
    await editEvent(concert.id, { note: 'Front row' });
    await fillFromListing(concert.id, entry, LEAD);
    expect((await db.events.get(shortlisted.id))?.note).toBe('Front row');
    saveFeedback.hold(note(shortlisted.id), 'Front row, by the pillar');
    const offer = undoOffers().find((one) => one.receipt.kind === 'fill')!;

    expect(await undo(offer.receipt)).toBe(false);
    expect(await db.events.get(concert.id)).toBeUndefined();
    expect((await db.events.get(shortlisted.id))?.note).toBe('Front row');
    saveFeedback.drop(note(shortlisted.id));
  });
});
