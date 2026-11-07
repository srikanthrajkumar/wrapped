// T122 (required): a kind change must not lose a typed title. A change to Concert, whose title
// is null, takes the title away only with a receipt that Undo restores it from, written in one
// transaction with the Event and its outbox entry.

import { describe, expect, it } from 'vitest';
import {
  changeKind,
  createEvent,
  deleteEvent,
  editEvent,
  restoreEvent,
  restoreTitle,
} from '../../src/store/events';
import { addAppearance, createArtist, editAppearance } from '../../src/store/people';
import { listReceipts, peekReceipt } from '../../src/store/receipts';
import { EVENT_DELETED, KIND_CHANGED, RuleError, TOO_MANY_PRESENTERS } from '../../src/store/rules';
import type { WrappedDB } from '../../src/store/db';
import { freshDb, reopen } from '../helpers';

async function queued(db: WrappedDB, id: string) {
  return (await db.outbox.where('recordId').equals(id).toArray()).at(-1)?.row;
}

describe('a change to Concert keeps the title it takes (required)', () => {
  it('takes the title with a receipt, and Undo brings kind and title back', async () => {
    const db = freshDb();
    const lecdem = await createEvent({ kind: 'lecdem', title: 'On Begada' }, { db });

    const { event, receipt } = await changeKind(lecdem.id, 'concert', { db });

    expect(event).toMatchObject({ kind: 'concert', title: null, touched: true });
    expect(await queued(db, lecdem.id)).toEqual(event);
    expect(receipt).toMatchObject({
      kind: 'title',
      eventId: lecdem.id,
      title: { kind: 'lecdem', title: 'On Begada' },
    });
    // Listed under the Event's "Recently deleted" until the rasika leaves it.
    expect((await listReceipts(lecdem.id, db)).map((r) => r.id)).toEqual([receipt!.id]);

    const restored = await restoreTitle(receipt!.id, { db });
    expect(restored).toMatchObject({ kind: 'lecdem', title: 'On Begada' });
    expect(await queued(db, lecdem.id)).toEqual(restored);
    expect(await db.events.get(lecdem.id)).toEqual(restored);
    // Used once.
    expect(await restoreTitle(receipt!.id, { db })).toBeNull();
  });

  it('keeps the receipt through a force-close', async () => {
    const db = freshDb();
    const dance = await createEvent({ kind: 'dance', title: 'Margam' }, { db });
    const { receipt } = await changeKind(dance.id, 'concert', { db });

    const again = reopen(db);
    expect(await peekReceipt(again, receipt!.id)).toEqual(receipt);
    expect(await restoreTitle(receipt!.id, { db: again })).toMatchObject({
      kind: 'dance',
      title: 'Margam',
    });
  });

  it('changes nothing when the receipt cannot be written', async () => {
    const db = freshDb();
    const harikatha = await createEvent({ kind: 'harikatha', title: 'Sita Kalyanam' }, { db });
    const before = await db.outbox.count();
    db.meta.hook('creating', (key) => {
      if (String(key).startsWith('receipt:')) throw new Error('disk full');
    });

    await expect(changeKind(harikatha.id, 'concert', { db })).rejects.toThrow('disk full');

    expect(await db.events.get(harikatha.id)).toEqual(harikatha);
    expect(await db.outbox.count()).toBe(before);
  });

  it('never overwrites a title typed since, nor a kind chosen since, and keeps the receipt', async () => {
    const db = freshDb();
    const lecdem = await createEvent({ kind: 'lecdem', title: 'On Begada' }, { db });
    const { receipt } = await changeKind(lecdem.id, 'concert', { db });
    await changeKind(lecdem.id, 'dance', { db, title: 'Tillana' });

    await expect(restoreTitle(receipt!.id, { db })).rejects.toThrow(KIND_CHANGED);
    expect(await db.events.get(lecdem.id)).toMatchObject({ kind: 'dance', title: 'Tillana' });
    // An untitled Harikatha chosen since is the rasika's newer word too.
    await changeKind(lecdem.id, 'harikatha', { db, title: null });
    await expect(restoreTitle(receipt!.id, { db })).rejects.toThrow(KIND_CHANGED);
    expect(await db.events.get(lecdem.id)).toMatchObject({ kind: 'harikatha', title: null });

    // Kept: back to a Concert, the title comes back after all.
    expect(await peekReceipt(db, receipt!.id)).toEqual(receipt);
    await changeKind(lecdem.id, 'concert', { db });
    expect(await restoreTitle(receipt!.id, { db })).toMatchObject({
      kind: 'lecdem',
      title: 'On Begada',
    });
  });

  it('keeps a title receipt refused while its Event is deleted, for after the Event is back', async () => {
    const db = freshDb();
    const dance = await createEvent({ kind: 'dance', title: 'Margam' }, { db });
    const { receipt } = await changeKind(dance.id, 'concert', { db });
    const deleted = await deleteEvent(dance.id, { db });

    await expect(restoreTitle(receipt!.id, { db })).rejects.toThrow(EVENT_DELETED);
    expect(await peekReceipt(db, receipt!.id)).toEqual(receipt);

    await restoreEvent(deleted!.receipt.id, { db });
    expect(await restoreTitle(receipt!.id, { db })).toMatchObject({
      kind: 'dance',
      title: 'Margam',
    });
    expect(await peekReceipt(db, receipt!.id)).toBeUndefined();
  });

  it('loses neither title when two changes to Concert are undone in either order', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'lecdem', title: 'X' }, { db });
    const first = (await changeKind(event.id, 'concert', { db })).receipt!;
    await changeKind(event.id, 'lecdem', { db, title: 'Y' });
    const second = (await changeKind(event.id, 'concert', { db })).receipt!;

    // The older Undo first: X comes back, and Y waits in its receipt.
    expect(await restoreTitle(first.id, { db })).toMatchObject({ kind: 'lecdem', title: 'X' });
    await expect(restoreTitle(second.id, { db })).rejects.toThrow(KIND_CHANGED);
    expect(await db.events.get(event.id)).toMatchObject({ kind: 'lecdem', title: 'X' });
    expect(await peekReceipt(db, second.id)).toEqual(second);

    // Back to Concert, X is kept in a receipt of its own, and Y comes back.
    const third = (await changeKind(event.id, 'concert', { db })).receipt!;
    expect(await restoreTitle(second.id, { db })).toMatchObject({ kind: 'lecdem', title: 'Y' });
    expect(third.title).toEqual({ kind: 'lecdem', title: 'X' });
    expect((await listReceipts(event.id, db)).map((r) => r.id)).toEqual([third.id]);
  });

  it('writes no receipt when there is no title to take', async () => {
    const db = freshDb();
    const dance = await createEvent({ kind: 'dance' }, { db });
    const { event, receipt } = await changeKind(dance.id, 'concert', { db });
    expect(event).toMatchObject({ kind: 'concert', title: null });
    expect(receipt).toBeNull();
    expect(await listReceipts(dance.id, db)).toEqual([]);
  });

  it('keeps the title between the kinds that have one', async () => {
    const db = freshDb();
    const dance = await createEvent({ kind: 'dance', title: 'Margam' }, { db });
    expect((await changeKind(dance.id, 'lecdem', { db })).event).toMatchObject({
      kind: 'lecdem',
      title: 'Margam',
    });
    expect((await changeKind(dance.id, 'harikatha', { db })).event.title).toBe('Margam');
    // A Concert made a Lecdem needs its title with it.
    const concert = await createEvent({ kind: 'concert' }, { db });
    await expect(changeKind(concert.id, 'lecdem', { db })).rejects.toBeInstanceOf(RuleError);
    expect(
      (await changeKind(concert.id, 'lecdem', { db, title: ' On Todi ' })).event,
    ).toMatchObject({ kind: 'lecdem', title: 'On Todi' });
    // An edit never sneaks a title onto a Concert.
    const plain = await createEvent({ kind: 'concert' }, { db });
    await expect(editEvent(plain.id, { title: 'x' }, { db })).rejects.toBeInstanceOf(RuleError);
  });
});

describe('a change to Lecdem keeps FR-013 (required)', () => {
  async function withPresenters(db: WrappedDB, count: number) {
    const harikatha = await createEvent({ kind: 'harikatha', title: 'Sita Kalyanam' }, { db });
    const appearances = [];
    for (let i = 1; i <= count; i += 1) {
      const artist = await createArtist(`Presenter ${i}`, { db });
      appearances.push(await addAppearance(harikatha.id, artist.id, { role: 'presenter' }, { db }));
    }
    return { harikatha, appearances };
  }

  it('refuses a Harikatha with 4 presenters as a Lecdem, as a 4th presenter is', async () => {
    const db = freshDb();
    const { harikatha, appearances } = await withPresenters(db, 4);
    const before = await db.outbox.count();

    await expect(changeKind(harikatha.id, 'lecdem', { db })).rejects.toThrow(TOO_MANY_PRESENTERS);
    expect(await db.events.get(harikatha.id)).toEqual(harikatha);
    expect(await db.outbox.count()).toBe(before);
    // Its presenters stay editable.
    expect((await editAppearance(appearances[0]!.id, { colourPrimary: 'red' }, { db })).id).toBe(
      appearances[0]!.id,
    );
    // Three are a Lecdem's most.
    const three = await withPresenters(db, 3);
    expect((await changeKind(three.harikatha.id, 'lecdem', { db })).event.kind).toBe('lecdem');
  });

  it('refuses an Undo that would make a Lecdem of more than 3, and keeps the receipt', async () => {
    const db = freshDb();
    const lecdem = await createEvent({ kind: 'lecdem', title: 'On Todi' }, { db });
    const { receipt } = await changeKind(lecdem.id, 'concert', { db });
    for (let i = 1; i <= 4; i += 1) {
      const artist = await createArtist(`Presenter ${i}`, { db });
      await addAppearance(lecdem.id, artist.id, { role: 'presenter' }, { db });
    }

    await expect(restoreTitle(receipt!.id, { db })).rejects.toThrow(TOO_MANY_PRESENTERS);
    expect(await db.events.get(lecdem.id)).toMatchObject({ kind: 'concert', title: null });
    expect(await peekReceipt(db, receipt!.id)).toEqual(receipt);
  });
});
