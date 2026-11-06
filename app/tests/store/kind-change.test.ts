// T122 (required): a kind change must not lose a typed title. A change to Concert, whose title
// is null, takes the title away only with a receipt that Undo restores it from, written in one
// transaction with the Event and its outbox entry.

import { describe, expect, it } from 'vitest';
import { changeKind, createEvent, editEvent, restoreTitle } from '../../src/store/events';
import { listReceipts, peekReceipt } from '../../src/store/receipts';
import { RuleError } from '../../src/store/rules';
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

  it('never overwrites a title typed since', async () => {
    const db = freshDb();
    const lecdem = await createEvent({ kind: 'lecdem', title: 'On Begada' }, { db });
    const { receipt } = await changeKind(lecdem.id, 'concert', { db });
    await changeKind(lecdem.id, 'dance', { db, title: 'Tillana' });

    expect(await restoreTitle(receipt!.id, { db })).toBeNull();
    expect(await db.events.get(lecdem.id)).toMatchObject({ kind: 'dance', title: 'Tillana' });
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
