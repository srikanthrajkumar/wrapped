// Required tests (constitution IV, nothing lost; ADR 0012). A Raga, a Manodharma part, a nadai or
// the Layavinyasam is removed with Undo. Undo puts the piece back into the Item as it is now, so
// nothing done in the 5 seconds between is lost, and a stale or used receipt restores nothing.

import { describe, expect, it } from 'vitest';
import { catalogValue, unknownValue, type DetailValue } from '../../src/model';
import { createEvent } from '../../src/store/events';
import {
  addItem,
  ON_AGAIN,
  repickItem,
  SONG_CHANGED,
  removeItem,
  removePartRagas,
  removePiece,
  restorePiece,
  setImprovised,
  setLayaNadais,
  setLayaNote,
  setLayaVinyasam,
  setRagas,
} from '../../src/store/items';
import { save } from '../../src/store/mutate';
import { listReceipts } from '../../src/store/receipts';
import { RuleError } from '../../src/store/rules';
import { freshDb } from '../helpers';

const raga = (name: string): DetailValue => catalogValue(name.toLowerCase(), name);
const nadai = (key: string): DetailValue => catalogValue(key, key);

async function itemWith() {
  const db = freshDb();
  const event = await createEvent({ kind: 'concert' }, { db });
  const item = await addItem(event.id, {}, { db });
  return { db, event, item };
}

describe('removing a piece of an Item, and its Undo (required, ADR 0012)', () => {
  it('a Raga comes back at its place, whatever was added since', async () => {
    const { db, event, item } = await itemWith();
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada'), raga('Behag')], { db });

    const removed = await removePiece(item.id, { field: 'ragas', index: 1 }, { db });
    expect(removed?.item.ragas).toEqual([raga('Kalyani'), raga('Behag')]);
    // A piece's Undo is never under "Recently deleted".
    expect(await listReceipts(event.id, db)).toEqual([]);
    await setRagas(item.id, [raga('Kalyani'), raga('Behag'), raga('Sindhubhairavi')], { db });

    const restored = await restorePiece(removed!.receipt.id, { db });
    expect(restored?.ragas).toEqual([
      raga('Kalyani'),
      raga('Kanada'),
      raga('Behag'),
      raga('Sindhubhairavi'),
    ]);
    // Used once, it restores nothing again.
    expect(await restorePiece(removed!.receipt.id, { db })).toBeNull();
  });

  it('a Raga removed from the end of a list now shorter goes back at the end', async () => {
    const { db, item } = await itemWith();
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada'), raga('Behag')], { db });
    const removed = await removePiece(item.id, { field: 'ragas', index: 2 }, { db });
    await setRagas(item.id, [raga('Kalyani')], { db });
    expect((await restorePiece(removed!.receipt.id, { db }))?.ragas).toEqual([
      raga('Kalyani'),
      raga('Behag'),
    ]);
  });

  it('a Manodharma part comes back with its Ragas, the Item’s Raga still live', async () => {
    const { db, item } = await itemWith();
    await setImprovised(
      item.id,
      [
        { kind: 'alapana', ragas: [null, raga('Kanada')] },
        { kind: 'tanam', ragas: [] },
      ],
      { db },
    );
    const removed = await removePiece(item.id, { field: 'improvised', kind: 'alapana' }, { db });
    expect(removed?.item.improvised).toEqual([{ kind: 'tanam', ragas: [] }]);
    // Meanwhile Niraval is turned on: Undo keeps it.
    await setImprovised(
      item.id,
      [
        { kind: 'tanam', ragas: [] },
        { kind: 'niraval', ragas: [] },
      ],
      { db },
    );

    const restored = await restorePiece(removed!.receipt.id, { db });
    expect(restored?.improvised).toEqual([
      { kind: 'alapana', ragas: [null, raga('Kanada')] },
      { kind: 'tanam', ragas: [] },
      { kind: 'niraval', ragas: [] },
    ]);
  });

  it('a part turned on again takes the removed list while it follows, and is left once it has Ragas of its own', async () => {
    const { db, item } = await itemWith();
    await setImprovised(item.id, [{ kind: 'alapana', ragas: [raga('Kanada')] }], { db });
    const first = await removePiece(item.id, { field: 'improvised', kind: 'alapana' }, { db });
    await setImprovised(item.id, [{ kind: 'alapana', ragas: [] }], { db });
    expect((await restorePiece(first!.receipt.id, { db }))?.improvised).toEqual([
      { kind: 'alapana', ragas: [raga('Kanada')] },
    ]);

    const second = await removePiece(item.id, { field: 'improvised', kind: 'alapana' }, { db });
    await setImprovised(item.id, [{ kind: 'alapana', ragas: [raga('Behag')] }], { db });
    await expect(restorePiece(second!.receipt.id, { db })).rejects.toEqual(
      new RuleError([ON_AGAIN]),
    );
    expect((await db.items.get(item.id))?.improvised).toEqual([
      { kind: 'alapana', ragas: [raga('Behag')] },
    ]);
  });

  it('a nadai comes back at its place; the last removed leaves the Tala’s', async () => {
    const { db, item } = await itemWith();
    await setLayaNadais(item.id, [nadai('khanda'), unknownValue(), nadai('tisra')], { db });
    const middle = await removePiece(item.id, { field: 'nadais', index: 1 }, { db });
    expect(middle?.item.layaVinyasam?.nadais).toEqual([nadai('khanda'), nadai('tisra')]);
    await setLayaNote(item.id, 'koraippu', { db });
    const restored = await restorePiece(middle!.receipt.id, { db });
    expect(restored?.layaVinyasam).toEqual({
      nadais: [nadai('khanda'), unknownValue(), nadai('tisra')],
      note: 'koraippu',
    });

    await setLayaNadais(item.id, [nadai('misra')], { db });
    const last = await removePiece(item.id, { field: 'nadais', index: 0 }, { db });
    expect(last?.item.layaVinyasam).toEqual({ nadais: [], note: 'koraippu' });
  });

  it('the Layavinyasam comes back with its nadais and note, unless it is on again with its own', async () => {
    const { db, item } = await itemWith();
    await setLayaVinyasam(item.id, { nadais: [nadai('khanda')], note: 'with ghatam' }, { db });
    const removed = await removePiece(item.id, { field: 'layaVinyasam' }, { db });
    expect(removed?.item.layaVinyasam).toBeNull();
    // Turned on again and still empty: the removed one takes its place.
    await setLayaNadais(item.id, [], { db });
    expect((await restorePiece(removed!.receipt.id, { db }))?.layaVinyasam).toEqual({
      nadais: [nadai('khanda')],
      note: 'with ghatam',
    });

    const again = await removePiece(item.id, { field: 'layaVinyasam' }, { db });
    await setLayaNote(item.id, 'new', { db });
    await expect(restorePiece(again!.receipt.id, { db })).rejects.toEqual(
      new RuleError([ON_AGAIN]),
    );
    expect((await db.items.get(item.id))?.layaVinyasam).toEqual({ nadais: [], note: 'new' });
  });

  it('restores nothing once the Item is deleted, and removes nothing that is not there', async () => {
    const { db, item } = await itemWith();
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada')], { db });
    expect(await removePiece(item.id, { field: 'ragas', index: 5 }, { db })).toBeUndefined();
    expect(await removePiece(item.id, { field: 'layaVinyasam' }, { db })).toBeUndefined();
    const removed = await removePiece(item.id, { field: 'ragas', index: 0 }, { db });
    await removeItem(item.id, { db });
    expect(await restorePiece(removed!.receipt.id, { db })).toBeNull();
  });

  it('each removal and each Undo is queued for the server', async () => {
    const { db, item } = await itemWith();
    await setImprovised(item.id, [{ kind: 'tanam', ragas: [] }], { db });
    await db.outbox.clear();
    const removed = await removePiece(item.id, { field: 'improvised', kind: 'tanam' }, { db });
    expect((await db.outbox.toArray()).map((entry) => entry.row)).toEqual([removed!.item]);
    const restored = await restorePiece(removed!.receipt.id, { db });
    expect((await db.outbox.toArray()).map((entry) => entry.row)).toEqual([restored]);
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
    expect(again?.item.ragas).toEqual([raga('Todi'), raga('Kalyani'), raga('Behag')]);
    expect(
      await removePiece(item.id, { field: 'ragas', index: 1, value: raga('Kanada') }, { db }),
    ).toBeUndefined();
  });
});

describe('a Manodharma part’s own Ragas removed, and their Undo (ADR 0012)', () => {
  it('a part’s Raga comes back in place; cut to the Item’s alone, the part follows until Undo', async () => {
    const { db, item } = await itemWith();
    await setImprovised(item.id, [{ kind: 'alapana', ragas: [null, raga('Kanada')] }], { db });
    const removed = await removePartRagas(
      item.id,
      'alapana',
      { index: 1, value: raga('Kanada') },
      { db },
    );
    expect(removed?.item.improvised).toEqual([{ kind: 'alapana', ragas: [] }]);
    const restored = await restorePiece(removed!.receipt.id, { db });
    expect(restored?.improvised).toEqual([{ kind: 'alapana', ragas: [null, raga('Kanada')] }]);
  });

  it('"Use the Item’s Raga only" comes back whole, unless the part has Ragas of its own again', async () => {
    const { db, item } = await itemWith();
    const own = [raga('Kalyani'), null, raga('Kanada')];
    await setImprovised(item.id, [{ kind: 'kalpana_swaram', ragas: own }], { db });
    const first = await removePartRagas(item.id, 'kalpana_swaram', 'all', { db });
    expect((await restorePiece(first!.receipt.id, { db }))?.improvised[0]?.ragas).toEqual(own);

    const second = await removePartRagas(item.id, 'kalpana_swaram', 'all', { db });
    await setImprovised(item.id, [{ kind: 'kalpana_swaram', ragas: [raga('Behag')] }], { db });
    await expect(restorePiece(second!.receipt.id, { db })).rejects.toEqual(
      new RuleError([ON_AGAIN]),
    );
  });

  it('a part turned off since comes back on with its Ragas', async () => {
    const { db, item } = await itemWith();
    await setImprovised(item.id, [{ kind: 'tanam', ragas: [raga('Kalyani'), raga('Kanada')] }], {
      db,
    });
    const removed = await removePartRagas(
      item.id,
      'tanam',
      { index: 0, value: raga('Kalyani') },
      { db },
    );
    await setImprovised(item.id, [], { db });
    expect((await restorePiece(removed!.receipt.id, { db }))?.improvised).toEqual([
      { kind: 'tanam', ragas: [raga('Kalyani'), raga('Kanada')] },
    ]);
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
    expect(removed?.item.improvised[0]?.ragas).toEqual([
      raga('Todi'),
      raga('Kalyani'),
      raga('Behag'),
    ]);
    expect(await removePartRagas(item.id, 'alapana', target, { db })).toBeUndefined();
    // The Item's-Raga slot is found by its marker.
    await setImprovised(item.id, [{ kind: 'alapana', ragas: [raga('Kanada'), null] }], { db });
    const items = await removePartRagas(item.id, 'alapana', { index: 0, value: null }, { db });
    expect(items?.item.improvised[0]?.ragas).toEqual([raga('Kanada')]);
  });
});

describe('a removal or an Undo that fails leaves everything as it was (required)', () => {
  it('a receipt that can’t be written takes the removal and its outbox entry back with it', async () => {
    const { db, item } = await itemWith();
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada')], { db });
    const before = { item: await db.items.get(item.id), outbox: await db.outbox.toArray() };
    db.meta.hook('creating', (key) => {
      if (String(key).startsWith('receipt:')) throw new Error('disk full');
    });

    await expect(removePiece(item.id, { field: 'ragas', index: 1 }, { db })).rejects.toThrow();

    expect(await db.items.get(item.id)).toEqual(before.item);
    expect(await db.outbox.toArray()).toEqual(before.outbox);
  });

  it('an Undo that can’t be saved keeps its receipt and the Item as they were', async () => {
    const { db, item } = await itemWith();
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada')], { db });
    const removed = await removePiece(item.id, { field: 'ragas', index: 1 }, { db });
    const before = await db.items.get(item.id);
    const failing = (_mods: unknown, primKey: unknown) => {
      if (primKey === item.id) throw new Error('disk full');
    };
    db.items.hook('updating', failing);
    db.items.hook('creating', failing);

    await expect(restorePiece(removed!.receipt.id, { db })).rejects.toThrow();

    expect(await db.items.get(item.id)).toEqual(before);
    db.items.hook('updating').unsubscribe(failing);
    db.items.hook('creating').unsubscribe(failing);
    // The receipt is still there, so Try again brings the Raga back.
    expect((await restorePiece(removed!.receipt.id, { db }))?.ragas).toEqual([
      raga('Kalyani'),
      raga('Kanada'),
    ]);
  });
});

describe('the review’s cases (ADR 0012)', () => {
  it('a removed Raga is not put into another song repicked since', async () => {
    const { db, item } = await itemWith();
    // A song's Item (its Composition as a catalog pick leaves it).
    await save('items', { ...item, compositionKey: 'c0001', title: 'Nidhi chala sukhama' }, { db });
    await setRagas(item.id, [raga('Kalyani'), raga('Kanada')], { db });
    const removed = await removePiece(item.id, { field: 'ragas', index: 1 }, { db });
    await repickItem(item.id, { kind: 'typed', text: 'Tillana' }, { db });
    const before = await db.items.get(item.id);
    await expect(restorePiece(removed!.receipt.id, { db })).rejects.toEqual(
      new RuleError([SONG_CHANGED]),
    );
    expect(await db.items.get(item.id)).toEqual(before);
  });

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
    expect(removed?.item.ragas).toEqual([raga('Kalyani')]);
  });

  it('a piece restored after a catalog upgrade comes back under the catalog in use', async () => {
    const { db, item } = await itemWith();
    const old = catalogValue('Sankarabharanam', 'Sankarabharanam');
    await setImprovised(item.id, [{ kind: 'alapana', ragas: [old] }], { db });
    const removed = await removePiece(item.id, { field: 'improvised', kind: 'alapana' }, { db });
    const remap = { songs: {}, ragas: { Sankarabharanam: 'Dheerasankarabharanam' }, composers: {} };
    const restored = await restorePiece(removed!.receipt.id, {
      db,
      catalog: { remap } as never,
    });
    expect(restored?.improvised[0]?.ragas).toEqual([{ ...old, key: 'Dheerasankarabharanam' }]);
  });
});
