// T122 (required): a kind change must not half-save. A change to Concert, whose title is null,
// takes a typed title away at once, in one transaction with the Event and its outbox entry, with
// no Undo: Undo is only for whole things (the Maintainer, 2026-11-25).

import { describe, expect, it } from 'vitest';
import { changeKind, createEvent, editEvent } from '../../src/store/events';
import { addAppearance, createArtist, editAppearance } from '../../src/store/people';
import { listReceipts } from '../../src/store/receipts';
import { RuleError, TOO_MANY_PRESENTERS } from '../../src/store/rules';
import type { WrappedDB } from '../../src/store/db';
import { freshDb, reopen } from '../helpers';

async function queued(db: WrappedDB, id: string) {
  return (await db.outbox.where('recordId').equals(id).toArray()).at(-1)?.row;
}

/** Every receipt kept in the store, of any kind. */
async function receipts(db: WrappedDB) {
  return db.meta.where('key').startsWith('receipt:').toArray();
}

describe('a change to Concert saves at once, with no Undo (required)', () => {
  it('takes the title, queued, with no receipt, and it holds after a reload', async () => {
    const db = freshDb();
    const lecdem = await createEvent({ kind: 'lecdem', title: 'On Begada' }, { db });

    const event = await changeKind(lecdem.id, 'concert', { db });

    expect(event).toMatchObject({ kind: 'concert', title: null, touched: true });
    expect(await queued(db, lecdem.id)).toEqual(event);
    expect(await receipts(db)).toEqual([]);
    expect(await listReceipts(lecdem.id, db)).toEqual([]);
    const again = reopen(db);
    expect(await again.events.get(lecdem.id)).toEqual(event);
    expect(await queued(again, lecdem.id)).toEqual(event);
  });

  it('changes nothing when the Event cannot be saved', async () => {
    const db = freshDb();
    const harikatha = await createEvent({ kind: 'harikatha', title: 'Sita Kalyanam' }, { db });
    const before = await db.outbox.count();
    db.events.hook('updating', () => {
      throw new Error('disk full');
    });

    await expect(changeKind(harikatha.id, 'concert', { db })).rejects.toThrow('disk full');

    expect(await db.events.get(harikatha.id)).toEqual(harikatha);
    expect(await db.outbox.count()).toBe(before);
  });

  it('keeps the title between the kinds that have one', async () => {
    const db = freshDb();
    const dance = await createEvent({ kind: 'dance', title: 'Margam' }, { db });
    expect(await changeKind(dance.id, 'lecdem', { db })).toMatchObject({
      kind: 'lecdem',
      title: 'Margam',
    });
    expect((await changeKind(dance.id, 'harikatha', { db })).title).toBe('Margam');
    // A Concert made a Lecdem needs its title with it.
    const concert = await createEvent({ kind: 'concert' }, { db });
    await expect(changeKind(concert.id, 'lecdem', { db })).rejects.toBeInstanceOf(RuleError);
    expect(await changeKind(concert.id, 'lecdem', { db, title: ' On Todi ' })).toMatchObject({
      kind: 'lecdem',
      title: 'On Todi',
    });
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

  it('refuses a Harikatha with 7 presenters as a Lecdem, as a 7th presenter is', async () => {
    const db = freshDb();
    const { harikatha, appearances } = await withPresenters(db, 7);
    const before = await db.outbox.count();

    await expect(changeKind(harikatha.id, 'lecdem', { db })).rejects.toThrow(TOO_MANY_PRESENTERS);
    expect(await db.events.get(harikatha.id)).toEqual(harikatha);
    expect(await db.outbox.count()).toBe(before);
    // Its presenters stay editable.
    expect((await editAppearance(appearances[0]!.id, { colourPrimary: 'red' }, { db })).id).toBe(
      appearances[0]!.id,
    );
    // Six are a Lecdem's most.
    const six = await withPresenters(db, 6);
    expect((await changeKind(six.harikatha.id, 'lecdem', { db })).kind).toBe('lecdem');
  });
});
