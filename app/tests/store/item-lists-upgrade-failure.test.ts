// Required test (constitution IV, nothing lost; ADR 0012): the store's version 5 upgrade runs in
// one transaction. If it fails part-way, every table and the store's version are as they were,
// and the next open runs it again from the start.

import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { newId, unknownValue, type Item } from '../../src/model';
import { WrappedDB } from '../../src/store/db';

// The upgrade throws on the Item titled "boom" while `failing` is set, after it has rewritten
// whatever came before it.
const failing = vi.hoisted(() => ({ on: true }));
vi.mock('../../src/model/item-shape', async (original) => {
  const actual = await original<typeof import('../../src/model/item-shape')>();
  return {
    ...actual,
    upgradeItemShape: <T extends Item>(item: T): T => {
      if (failing.on && item.title === 'boom') throw new Error('killed mid-upgrade');
      return actual.upgradeItemShape(item);
    },
  };
});

const STORES = {
  events: 'id, status, date, sabhaId, scheduleEntryId',
  appearances: 'id, eventId, artistId',
  items: 'id, eventId, [eventId+position]',
  artists: 'id, name, mergedIntoId',
  sabhas: 'id, name, mergedIntoId',
  links: 'id, [ownTable+ownId]',
  sharedArtists: 'id, name',
  sharedSabhas: 'id, name',
  schedule: 'id, date',
  outbox: '++seq, opId, recordId',
  meta: 'key',
  serverSeqs: '[table+id]',
  attention: 'opId, [table+recordId]',
};

function oldItem(title: string, position: number) {
  const now = '2026-12-14T14:00:00.000Z';
  return {
    id: newId(),
    eventId: 'e1',
    position,
    compositionKey: null,
    title,
    form: unknownValue(),
    ragas: [],
    tala: unknownValue(),
    nadai: unknownValue(),
    composer: unknownValue(),
    language: unknownValue(),
    subject: unknownValue(),
    layaVinyasam: {
      nadai: { state: 'catalog', key: 'khanda', text: 'khanda', guess: false },
      note: 'n',
    },
    improvised: [{ kind: 'alapana', raga: null }],
    note: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

describe('the version 5 upgrade fails as a whole (required, ADR 0012)', () => {
  it('leaves every Item and the version as they were, and runs again on the next open', async () => {
    const name = `test-${newId()}`;
    const old = new Dexie(name);
    old.version(4).stores(STORES);
    await old.open();
    const first = oldItem('first', 1);
    const boom = oldItem('boom', 2);
    await old.table('items').bulkPut([first, boom]);
    old.close();

    const db = new WrappedDB(name);
    await expect(db.open()).rejects.toThrow();
    db.close();

    const after = new Dexie(name);
    await after.open();
    expect(after.verno).toBe(4);
    expect(await after.table('items').get(first.id)).toEqual(first);
    expect(await after.table('items').get(boom.id)).toEqual(boom);
    after.close();

    failing.on = false;
    const again = new WrappedDB(name);
    await again.open();
    expect(again.verno).toBe(5);
    expect((await again.items.get(first.id))?.layaVinyasam).toEqual({
      nadais: [{ state: 'catalog', key: 'khanda', text: 'khanda', guess: false }],
      note: 'n',
    });
    expect((await again.items.get(boom.id))?.improvised).toEqual([{ kind: 'alapana', ragas: [] }]);
    await again.delete();
  });
});
