// Required tests (constitution IV, nothing lost; ADR 0012). A Raga, a Manodharma part, a part's
// own Ragas, a nadai or the Layavinyasam is removed at once, with no Undo: Undo is only for whole
// things (the Maintainer, 2026-11-25). Each removal takes out that one piece and nothing more, in
// one transaction with its outbox entry, and holds after a reload; one that fails changes nothing.

import { describe, expect, it } from 'vitest';
import { catalogValue, unknownValue, type DetailValue } from '../../src/model';
import { createEvent } from '../../src/store/events';
import {
  addItem,
  LAYA_NOTE_TYPED,
  removePartRagas,
  removePiece,
  setImprovised,
  setLayaNadais,
  setLayaNote,
  setLayaVinyasam,
  setRagas,
} from '../../src/store/items';
import type { WrappedDB } from '../../src/store/db';
import { listReceipts, pruneReceipts } from '../../src/store/receipts';
import { RuleError } from '../../src/store/rules';
import { freshDb, reopen } from '../helpers';

const raga = (name: string): DetailValue => catalogValue(name.toLowerCase(), name);
const nadai = (key: string): DetailValue => catalogValue(key, key);

async function itemWith() {
  const db = freshDb();
  const event = await createEvent({ kind: 'concert' }, { db });
  const item = await addItem(event.id, {}, { db });
  return { db, event, item };
}

/** Every receipt kept in the store, of any kind. */
async function receipts(db: WrappedDB) {
  return db.meta.where('key').startsWith('receipt:').toArray();
}

describe('removing a piece of an Item saves at once, with no Undo (required)', () => {
  it('each removal takes out its one piece, writes no receipt, and holds after a reload', async () => {
    const { db, event, item } = await itemWith();
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada'), raga('Behag')], { db });
    await setImprovised(
      item.id,
      [
        { kind: 'alapana', ragas: [null, raga('Kanada')] },
        { kind: 'tanam', ragas: [raga('Kalyani'), raga('Kanada')] },
        { kind: 'niraval', ragas: [] },
      ],
      { db },
    );
    await setLayaVinyasam(
      item.id,
      { nadais: [nadai('khanda'), unknownValue(), nadai('tisra')], note: 'with ghatam' },
      { db },
    );

    // A Raga.
    let now = await removePiece(item.id, { field: 'ragas', index: 1 }, { db });
    expect(now?.ragas).toEqual([raga('Kalyani'), raga('Behag')]);
    // A part's own Raga; the other parts stay.
    now = await removePartRagas(item.id, 'tanam', { index: 0, value: raga('Kalyani') }, { db });
    expect(now?.improvised).toEqual([
      { kind: 'alapana', ragas: [null, raga('Kanada')] },
      { kind: 'tanam', ragas: [raga('Kanada')] },
      { kind: 'niraval', ragas: [] },
    ]);
    // A part turned off, with its Ragas.
    now = await removePiece(item.id, { field: 'improvised', kind: 'alapana' }, { db });
    expect(now?.improvised).toEqual([
      { kind: 'tanam', ragas: [raga('Kanada')] },
      { kind: 'niraval', ragas: [] },
    ]);
    // A nadai; the note stays.
    now = await removePiece(item.id, { field: 'nadais', index: 1 }, { db });
    expect(now?.layaVinyasam).toEqual({
      nadais: [nadai('khanda'), nadai('tisra')],
      note: 'with ghatam',
    });
    // The rest of the Item is as it was.
    expect(now?.ragas).toEqual([raga('Kalyani'), raga('Behag')]);

    expect(await receipts(db)).toEqual([]);
    expect(await listReceipts(event.id, db)).toEqual([]);
    const again = reopen(db);
    expect(await again.items.get(item.id)).toEqual(now);
  });

  it('the Layavinyasam goes with its nadais, and holds after a reload', async () => {
    const { db, item } = await itemWith();
    await setLayaVinyasam(item.id, { nadais: [nadai('khanda')], note: null }, { db });
    const removed = await removePiece(item.id, { field: 'layaVinyasam' }, { db });
    expect(removed?.layaVinyasam).toBeNull();
    expect(await receipts(db)).toEqual([]);
    expect((await reopen(db).items.get(item.id))?.layaVinyasam).toBeNull();
  });

  it('the Layavinyasam is never turned off with a note under it, so a Try again keeps a note saved since', async () => {
    const { db, item } = await itemWith();
    await setLayaVinyasam(item.id, { nadais: [nadai('khanda')], note: null }, { db });
    // The first try failed; meanwhile a note was saved, from another tab.
    await setLayaNote(item.id, 'tisram, then khandam', { db });
    const before = { item: await db.items.get(item.id), outbox: await db.outbox.count() };

    await expect(removePiece(item.id, { field: 'layaVinyasam' }, { db })).rejects.toEqual(
      new RuleError([LAYA_NOTE_TYPED]),
    );

    expect(await db.items.get(item.id)).toEqual(before.item);
    expect(await db.outbox.count()).toBe(before.outbox);
    // Cleared first, it goes.
    await setLayaNote(item.id, '', { db });
    expect(
      (await removePiece(item.id, { field: 'layaVinyasam' }, { db }))?.layaVinyasam,
    ).toBeNull();
  });

  it('"Use the Item’s Raga only" clears a part’s own Ragas, and holds after a reload', async () => {
    const { db, item } = await itemWith();
    const own = [raga('Kalyani'), null, raga('Kanada')];
    await setImprovised(item.id, [{ kind: 'kalpana_swaram', ragas: own }], { db });
    const removed = await removePartRagas(item.id, 'kalpana_swaram', 'all', { db });
    expect(removed?.improvised).toEqual([{ kind: 'kalpana_swaram', ragas: [] }]);
    expect(await receipts(db)).toEqual([]);
    expect((await reopen(db).items.get(item.id))?.improvised).toEqual(removed?.improvised);
  });

  it('a part cut back to the Item’s Raga alone follows it again', async () => {
    const { db, item } = await itemWith();
    await setImprovised(item.id, [{ kind: 'alapana', ragas: [null, raga('Kanada')] }], { db });
    const removed = await removePartRagas(
      item.id,
      'alapana',
      { index: 1, value: raga('Kanada') },
      { db },
    );
    expect(removed?.improvised).toEqual([{ kind: 'alapana', ragas: [] }]);
  });

  it('the last nadai removed leaves the Tala’s', async () => {
    const { db, item } = await itemWith();
    await setLayaNadais(item.id, [nadai('misra')], { db });
    const last = await removePiece(item.id, { field: 'nadais', index: 0 }, { db });
    expect(last?.layaVinyasam).toEqual({ nadais: [], note: null });
  });

  it('removes nothing that is not there', async () => {
    const { db, item } = await itemWith();
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada')], { db });
    const outbox = await db.outbox.count();
    expect(await removePiece(item.id, { field: 'ragas', index: 5 }, { db })).toBeUndefined();
    expect(await removePiece(item.id, { field: 'layaVinyasam' }, { db })).toBeUndefined();
    expect(
      await removePiece(item.id, { field: 'improvised', kind: 'tanam' }, { db }),
    ).toBeUndefined();
    expect(await removePartRagas(item.id, 'alapana', 'all', { db })).toBeUndefined();
    expect(await db.outbox.count()).toBe(outbox);
  });

  it('each removal is queued for the server', async () => {
    const { db, item } = await itemWith();
    await setImprovised(item.id, [{ kind: 'tanam', ragas: [] }], { db });
    await db.outbox.clear();
    const removed = await removePiece(item.id, { field: 'improvised', kind: 'tanam' }, { db });
    expect((await db.outbox.toArray()).map((entry) => entry.row)).toEqual([removed]);
  });

  it('a removal that can’t be saved leaves the Item and the outbox as they were', async () => {
    const { db, item } = await itemWith();
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada')], { db });
    const before = { item: await db.items.get(item.id), outbox: await db.outbox.toArray() };
    db.items.hook('updating', () => {
      throw new Error('disk full');
    });

    await expect(removePiece(item.id, { field: 'ragas', index: 1 }, { db })).rejects.toThrow();

    expect(await db.items.get(item.id)).toEqual(before.item);
    expect(await db.outbox.toArray()).toEqual(before.outbox);
  });
});

describe('a piece or title receipt left by an earlier build (required)', () => {
  it('is never listed, and goes at the next launch whatever its age', async () => {
    const { db, event, item } = await itemWith();
    const at = new Date().toISOString();
    for (const kind of ['piece', 'title']) {
      await db.meta.put({
        key: `receipt:old-${kind}`,
        value: {
          id: `old-${kind}`,
          kind,
          eventId: event.id,
          position: 1,
          records: [{ table: 'items', id: item.id, deletedAt: null }],
          at,
        },
      });
    }
    expect(await listReceipts(event.id, db)).toEqual([]);

    await pruneReceipts(24 * 60 * 60 * 1000, db);

    expect(await receipts(db)).toEqual([]);
    expect(await db.items.get(item.id)).toEqual(item);
  });
});

describe('a removal tried again after its list changed (ADR 0007, ADR 0012)', () => {
  it('removes the value it named where it now is, or nothing, never its neighbour', async () => {
    const { db, item } = await itemWith();
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada'), raga('Behag')], { db });
    // The first try failed; meanwhile a Raga went in before it.
    await setRagas(item.id, [raga('Todi'), raga('Kalyani'), raga('Kanada'), raga('Behag')], {
      db,
    });
    const again = await removePiece(
      item.id,
      { field: 'ragas', index: 1, value: raga('Kanada') },
      { db },
    );
    expect(again?.ragas).toEqual([raga('Todi'), raga('Kalyani'), raga('Behag')]);
    expect(
      await removePiece(item.id, { field: 'ragas', index: 1, value: raga('Kanada') }, { db }),
    ).toBeUndefined();
  });
});

describe('a part’s Raga removed by its place and value (ADR 0007, ADR 0012)', () => {
  it('removes the Raga seen there where it now is, or nothing, never its neighbour', async () => {
    const { db, item } = await itemWith();
    await setImprovised(
      item.id,
      [{ kind: 'alapana', ragas: [raga('Kalyani'), raga('Kanada'), raga('Behag')] }],
      { db },
    );
    // Seen in place 2; meanwhile Todi went in first.
    await setImprovised(
      item.id,
      [{ kind: 'alapana', ragas: [raga('Todi'), raga('Kalyani'), raga('Kanada'), raga('Behag')] }],
      { db },
    );
    const target = { index: 1, value: raga('Kanada') };
    const removed = await removePartRagas(item.id, 'alapana', target, { db });
    expect(removed?.improvised[0]?.ragas).toEqual([raga('Todi'), raga('Kalyani'), raga('Behag')]);
    expect(await removePartRagas(item.id, 'alapana', target, { db })).toBeUndefined();
    // The Item's-Raga slot is found by its marker.
    await setImprovised(item.id, [{ kind: 'alapana', ragas: [raga('Kanada'), null] }], { db });
    const items = await removePartRagas(item.id, 'alapana', { index: 0, value: null }, { db });
    expect(items?.improvised[0]?.ragas).toEqual([raga('Kanada')]);
  });
});

describe('a removal names its value as the screen saw it (ADR 0007)', () => {
  it('finds the value seen even when its keys come back from the server in another order', async () => {
    const { db, item } = await itemWith();
    // As jsonb returns it: keys reordered.
    const reordered = {
      guess: false,
      key: 'kanada',
      state: 'catalog',
      text: 'Kanada',
    } as DetailValue;
    await setRagas(item.id, [raga('Kalyani'), reordered], { db });
    const removed = await removePiece(
      item.id,
      { field: 'ragas', index: 1, value: raga('Kanada') },
      { db },
    );
    expect(removed?.ragas).toEqual([raga('Kalyani')]);
  });
});
