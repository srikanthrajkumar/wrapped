// Required test (constitution IV, "delete and reorder reaching the server"; T035, T048a). A
// reorder renumbers the affected Items in one transaction, each with its own outbox entry; a
// delete is a tombstone with an entry; positions stay unique among an Event's live Items; both
// survive a reopen. Undo puts back exactly what one delete removed, at its old place, from a
// receipt stored with the delete, and a stale or replayed Undo restores nothing (eng D1, D7).

import { describe, expect, it } from 'vitest';
import { upgradeCatalog } from '../../src/catalog/upgrade';
import type { Item } from '../../src/model';
import { CATALOG_VERSION_KEY } from '../../src/store/catalog-version';
import type { WrappedDB } from '../../src/store/db';
import { createEvent, deleteEvent, restoreEvent } from '../../src/store/events';
import { addItem, moveItem, pickComposition, removeItem, restoreItem } from '../../src/store/items';
import { acknowledge, claimBatch } from '../../src/store/outbox';
import {
  addAppearance,
  createArtist,
  removeAppearance,
  restoreAppearance,
} from '../../src/store/people';
import { listAppearances, listItems } from '../../src/store/queries';
import { clearReceipts, listReceipts } from '../../src/store/receipts';
import { RuleError } from '../../src/store/rules';
import { fixtureCatalog, freshDb, reopen } from '../helpers';

/** A Concert with Items "1" to "8", already pushed, so the outbox starts empty. */
async function concertOfEight(db: WrappedDB) {
  const event = await createEvent({ kind: 'concert' }, { db });
  const items: Item[] = [];
  for (let i = 1; i <= 8; i += 1) items.push(await addItem(event.id, { title: String(i) }, { db }));
  const sent = await claimBatch(500, db);
  await acknowledge(
    sent.map((entry) => entry.opId),
    db,
  );
  return { event, items };
}

const titles = async (eventId: string, db: WrappedDB) =>
  (await listItems(eventId, db)).map((item) => item.title);

function expectUniquePositions(items: Item[]) {
  const positions = items.map((item) => item.position);
  expect(new Set(positions).size).toBe(positions.length);
}

describe('reorder and delete (required)', () => {
  it('renumbers the moved Items in one go, each with its own outbox entry', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);

    // Item 7 moves up to second place: Items 2 to 7 change place, 1 and 8 don't.
    await moveItem(items[6]!.id, 1, { db });

    expect(await titles(event.id, db)).toEqual(['1', '7', '2', '3', '4', '5', '6', '8']);
    const live = await listItems(event.id, db);
    expect(live.map((item) => item.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const outbox = await db.outbox.orderBy('seq').toArray();
    expect(outbox.map((entry) => (entry.row as Item).title).sort()).toEqual(
      ['2', '3', '4', '5', '6', '7'].sort(),
    );
    for (const entry of outbox) {
      const stored = live.find((item) => item.id === entry.recordId)!;
      expect(entry).toMatchObject({ table: 'items', op: 'save' });
      expect((entry.row as Item).position).toBe(stored.position);
    }
  });

  it('renumbers nothing when the move fails part-way', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    let writes = 0;
    // The third Item written in the move fails, as a full disk would.
    db.items.hook('updating', () => {
      writes += 1;
      if (writes === 3) throw new Error('disk full');
    });

    await expect(moveItem(items[7]!.id, 0, { db })).rejects.toThrow('disk full');
    expect(await titles(event.id, db)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(await db.outbox.count()).toBe(0);
  });

  it('refuses a place outside the running order, changing nothing', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    await expect(moveItem(items[0]!.id, 8, { db })).rejects.toThrow(RuleError);
    expect(await titles(event.id, db)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(await db.outbox.count()).toBe(0);
  });

  it('deletes as a tombstone with an outbox entry, and positions stay unique', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);

    await removeItem(items[2]!.id, { db });

    const tombstone = await db.items.get(items[2]!.id);
    expect(tombstone?.deletedAt).toEqual(expect.any(String));
    const outbox = await db.outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ op: 'remove', recordId: items[2]!.id });
    expect((outbox[0]!.row as Item).deletedAt).toBe(tombstone?.deletedAt);
    expect(await titles(event.id, db)).toEqual(['1', '2', '4', '5', '6', '7', '8']);

    // Items added and moved after a delete keep unique positions among the live ones.
    const ninth = await addItem(event.id, { title: '9' }, { db });
    expectUniquePositions(await listItems(event.id, db));
    await moveItem(ninth.id, 0, { db });
    const live = await listItems(event.id, db);
    expectUniquePositions(live);
    expect(live.map((item) => item.title)).toEqual(['9', '1', '2', '4', '5', '6', '7', '8']);
  });

  it('keeps positions unique after every step of a reorder-and-delete session', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    const steps = [
      () => moveItem(items[0]!.id, 7, { db }),
      () => removeItem(items[4]!.id, { db }),
      () => moveItem(items[7]!.id, 0, { db }),
      () => removeItem(items[1]!.id, { db }),
      () => moveItem(items[3]!.id, 2, { db }),
    ];
    for (const step of steps) {
      await step();
      expectUniquePositions(await listItems(event.id, db));
    }
  });

  it('keeps a reorder and a delete across a reopen, with their outbox entries', async () => {
    let db = freshDb();
    const { event, items } = await concertOfEight(db);
    await moveItem(items[3]!.id, 0, { db });
    await moveItem(items[0]!.id, 7, { db });
    await removeItem(items[5]!.id, { db });
    const before = await titles(event.id, db);
    const queued = await db.outbox.count();

    db = reopen(db);

    expect(await titles(event.id, db)).toEqual(before);
    expect(before).toEqual(['4', '2', '3', '5', '7', '8', '1']);
    expect(await db.outbox.count()).toBe(queued);
    expect((await db.items.get(items[5]!.id))?.deletedAt).toEqual(expect.any(String));
  });
});

describe('Undo (required)', () => {
  it('puts a deleted Item back at its place after another was added, places unique', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    const deleted = (await removeItem(items[2]!.id, { db }))!;
    await addItem(event.id, { title: '9' }, { db });

    const restored = await restoreItem(deleted.receipt.id, { db });

    expect(restored).toMatchObject({ id: items[2]!.id, position: 3, deletedAt: null });
    const live = await listItems(event.id, db);
    expectUniquePositions(live);
    expect(live.map((item) => item.title)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(live.map((item) => item.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('keeps places unique when the order was moved between delete and Undo', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    const deleted = (await removeItem(items[2]!.id, { db }))!;
    await moveItem(items[7]!.id, 0, { db });

    await restoreItem(deleted.receipt.id, { db });

    const live = await listItems(event.id, db);
    expect(live.map((item) => item.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // It takes its old number, 3.
    expect(live[2]!.title).toBe('3');
  });

  it('queues the restore and every renumbered Item for the server', async () => {
    const db = freshDb();
    const { items } = await concertOfEight(db);
    const deleted = (await removeItem(items[0]!.id, { db }))!;
    await claimBatch(500, db).then((sent) =>
      acknowledge(
        sent.map((entry) => entry.opId),
        db,
      ),
    );
    await moveItem(items[7]!.id, 0, { db });
    await claimBatch(500, db).then((sent) =>
      acknowledge(
        sent.map((entry) => entry.opId),
        db,
      ),
    );

    await restoreItem(deleted.receipt.id, { db });

    const outbox = await db.outbox.toArray();
    const restoredEntry = outbox.find((entry) => entry.recordId === items[0]!.id);
    expect(restoredEntry).toMatchObject({ op: 'save', row: { deletedAt: null, position: 1 } });
    // Item 8 had moved to first place; it is pushed down to second.
    expect(outbox.find((entry) => entry.recordId === items[7]!.id)?.row).toMatchObject({
      position: 2,
    });
  });

  it('undoes after a restart, from the stored receipt', async () => {
    let db = freshDb();
    const { event, items } = await concertOfEight(db);
    const deleted = (await removeItem(items[4]!.id, { db }))!;

    db = reopen(db);
    expect((await listReceipts(event.id, db)).map((r) => r.id)).toEqual([deleted.receipt.id]);
    await restoreItem(deleted.receipt.id, { db });

    expect(await titles(event.id, db)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(await listReceipts(event.id, db)).toEqual([]);
  });

  it('restores nothing when the same Undo is replayed', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    const deleted = (await removeItem(items[4]!.id, { db }))!;
    await restoreItem(deleted.receipt.id, { db });
    await removeItem(items[4]!.id, { db });
    const queued = await db.outbox.count();

    expect(await restoreItem(deleted.receipt.id, { db })).toBeNull();
    expect(await titles(event.id, db)).toEqual(['1', '2', '3', '4', '6', '7', '8']);
    expect(await db.outbox.count()).toBe(queued);
  });

  it('a stale Undo in another tab never restores a newer delete', async () => {
    const tabA = freshDb();
    const { event, items } = await concertOfEight(tabA);
    const tabB = freshDb(tabA.name);
    const first = (await removeItem(items[1]!.id, { db: tabA }))!;

    // Tab B undoes and the Item is deleted again there.
    await restoreItem(first.receipt.id, { db: tabB });
    const second = (await removeItem(items[1]!.id, { db: tabB }))!;
    // Tab A's old Undo bar is tapped late.
    expect(await restoreItem(first.receipt.id, { db: tabA })).toBeNull();
    expect(await titles(event.id, tabA)).not.toContain('2');
    // The newer delete's own Undo still works.
    expect(await restoreItem(second.receipt.id, { db: tabA })).toMatchObject({ position: 2 });
  });

  it('drops a receipt whose record changed since, restoring nothing', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    const deleted = (await removeItem(items[3]!.id, { db }))!;
    // The tombstone is stamped again (as by a sync of a later delete) after the receipt.
    await db.items.update(items[3]!.id, { deletedAt: '2099-01-01T00:00:00.000Z' });

    expect(await restoreItem(deleted.receipt.id, { db })).toBeNull();
    expect(await listReceipts(event.id, db)).toEqual([]);
  });

  it('brings a restored Item to the catalog upgraded since its delete', async () => {
    const db = freshDb();
    const v1 = fixtureCatalog('catalog-v1.json');
    const v2 = fixtureCatalog('catalog-v2.json');
    await db.meta.put({ key: CATALOG_VERSION_KEY, value: v1.version });
    const event = await createEvent({ kind: 'concert' }, { db });
    // Enduku Peddala, in Sankarabharanam, which v2 merges into Dheerasankarabharanam.
    const item = await pickComposition(
      (await addItem(event.id, {}, { db })).id,
      v1.songByKritiId.get('c0005')!,
      { db },
    );
    const deleted = (await removeItem(item.id, { db }))!;
    await upgradeCatalog(v2, { db });

    const restored = await restoreItem(deleted.receipt.id, { db, catalog: v2 });

    expect(restored?.ragas[0]).toMatchObject({
      key: 'Dheerasankarabharanam',
      text: 'Sankarabharanam',
    });
  });

  it('changes nothing when the restore fails part-way', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    const deleted = (await removeItem(items[0]!.id, { db }))!;
    await moveItem(items[7]!.id, 0, { db });
    const before = await db.items.toArray();
    const queued = await db.outbox.toArray();
    let writes = 0;
    // The restored Item is written; the first renumbered one fails, as a full disk would.
    db.items.hook('updating', () => {
      writes += 1;
      if (writes === 2) throw new Error('disk full');
    });

    await expect(restoreItem(deleted.receipt.id, { db })).rejects.toThrow('disk full');

    expect(await db.items.toArray()).toEqual(before);
    expect(await db.outbox.toArray()).toEqual(queued);
    expect((await listReceipts(event.id, db)).map((r) => r.id)).toEqual([deleted.receipt.id]);
  });

  it('puts back exactly the Items and Appearances one Event delete removed', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    const artist = await createArtist('T M Krishna', { db });
    const vocal = await addAppearance(event.id, artist.id, { role: 'vocal' }, { db });
    // Deleted earlier, on purpose: Undo of the Event must not bring it back.
    await removeItem(items[5]!.id, { db });
    const deleted = (await deleteEvent(event.id, { db }))!;

    const restored = await restoreEvent(deleted.receipt.id, { db });

    expect(restored).toMatchObject({ id: event.id, deletedAt: null });
    expect(await titles(event.id, db)).toEqual(['1', '2', '3', '4', '5', '7', '8']);
    expect((await listAppearances(event.id, db)).map((a) => a.id)).toEqual([vocal.id]);
    expect(await restoreEvent(deleted.receipt.id, { db })).toBeNull();
  });

  it('keeps an Item receipt through its Event delete, usable once the Event is back', async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    const item = (await removeItem(items[1]!.id, { db }))!;
    const concert = (await deleteEvent(event.id, { db }))!;

    expect(await restoreItem(item.receipt.id, { db })).toBeNull();
    await restoreEvent(concert.receipt.id, { db });
    await restoreItem(item.receipt.id, { db });

    expect(await titles(event.id, db)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('puts a removed Appearance back in its billing place', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const names = ['Vocal', 'Violin', 'Mridangam', 'Ghatam'];
    const appearances = [];
    for (const name of names) {
      appearances.push(
        await addAppearance(event.id, (await createArtist(name, { db })).id, {}, { db }),
      );
    }
    const removed = (await removeAppearance(appearances[1]!.id, { db }))!;
    await addAppearance(event.id, (await createArtist('Morsing', { db })).id, {}, { db });

    await restoreAppearance(removed.receipt.id, { db });

    const live = await listAppearances(event.id, db);
    expect(live.map((a) => a.artist?.name)).toEqual([
      'Vocal',
      'Violin',
      'Mridangam',
      'Ghatam',
      'Morsing',
    ]);
    expect(live.map((a) => a.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("forgets an Event's receipts once the rasika leaves it", async () => {
    const db = freshDb();
    const { event, items } = await concertOfEight(db);
    const deleted = (await removeItem(items[0]!.id, { db }))!;
    await removeItem(items[1]!.id, { db });
    expect(await listReceipts(event.id, db)).toHaveLength(2);

    await clearReceipts(event.id, db);

    expect(await listReceipts(event.id, db)).toEqual([]);
    expect(await restoreItem(deleted.receipt.id, { db })).toBeNull();
  });
});
