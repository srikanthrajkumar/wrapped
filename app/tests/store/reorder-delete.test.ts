// Required test (constitution IV, "delete and reorder reaching the server"; T035). A reorder
// renumbers the affected Items in one transaction, each with its own outbox entry; a delete is a
// tombstone with an entry; positions stay unique among an Event's live Items; both survive a
// reopen.

import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/model';
import type { WrappedDB } from '../../src/store/db';
import { createEvent } from '../../src/store/events';
import { addItem, moveItem, removeItem } from '../../src/store/items';
import { acknowledge, claimBatch } from '../../src/store/outbox';
import { listItems } from '../../src/store/queries';
import { RuleError } from '../../src/store/rules';
import { freshDb, reopen } from '../helpers';

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
