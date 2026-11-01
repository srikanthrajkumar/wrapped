// Required test (constitution IV, "catalog updates"; T047), with the v1 and v2 snapshots: v2
// merges Sankarabharanam into Dheerasankarabharanam, retires the raga Jonpuri and the song
// c0021. Logged Items keep their meaning: a merged key is rewritten, an Override stays an
// Override, a retired key becomes Unresolved with its text kept, and a row pulled under a v1
// key after v2 is installed is remapped too (outside voice 6).

import { describe, expect, it } from 'vitest';
import { remapPulledRow, upgradeCatalog } from '../../src/catalog/upgrade';
import { catalogValue, type Item } from '../../src/model';
import { CATALOG_VERSION_KEY, upgradeStoredItems } from '../../src/store/catalog-version';
import type { WrappedDB } from '../../src/store/db';
import { createEvent } from '../../src/store/events';
import { addItem, pickComposition, removeItem, setRagas } from '../../src/store/items';
import { acknowledge, claimBatch } from '../../src/store/outbox';
import { fixtureCatalog, freshDb, reopen } from '../helpers';

const v1 = fixtureCatalog('catalog-v1.json');
const v2 = fixtureCatalog('catalog-v2.json');

/** A season logged under v1, already pushed, so the outbox starts empty. */
async function loggedUnderV1(db: WrappedDB) {
  const options = { db, catalog: v1 };
  const event = await createEvent({ kind: 'concert' }, { db });
  const song = (id: string) => v1.songByKritiId.get(id)!;

  // Enduku Peddala, in Sankarabharanam as the catalog says.
  const merged = await pickComposition((await addItem(event.id, {}, { db })).id, song('c0005'), {
    db,
  });
  // Nagumomu (Abheri in the catalog), heard in Sankarabharanam: an Override.
  const nagumomu = await pickComposition((await addItem(event.id, {}, { db })).id, song('c0001'), {
    db,
  });
  const override = await setRagas(
    nagumomu.id,
    [catalogValue('Sankarabharanam', 'Sankarabharanam')],
    options,
  );
  // A free Item in Jonpuri, marked not sure.
  const free = await addItem(event.id, { title: 'Javali' }, { db });
  const retiredRaga = await setRagas(
    free.id,
    [{ ...catalogValue('Jonpuri', 'Jonpuri'), guess: true }],
    options,
  );
  // Kaddanuvariki, a song v2 retires.
  const retiredSong = await pickComposition(
    (await addItem(event.id, {}, { db })).id,
    song('c0021'),
    { db },
  );
  // Vatapi Ganapatim in Hamsadhwani: nothing in it changes.
  const untouched = await pickComposition((await addItem(event.id, {}, { db })).id, song('c0002'), {
    db,
  });
  await db.meta.put({ key: CATALOG_VERSION_KEY, value: v1.version });
  const sent = await claimBatch(500, db);
  await acknowledge(
    sent.map((entry) => entry.opId),
    db,
  );
  return { merged, override, retiredRaga, retiredSong, untouched };
}

describe('catalog upgrade (required)', () => {
  it('rewrites merged keys, keeps Overrides, and makes retired keys Unresolved', async () => {
    const db = freshDb();
    const logged = await loggedUnderV1(db);
    expect(logged.override.ragas[0]).toMatchObject({ state: 'override', key: 'Sankarabharanam' });

    const result = await upgradeCatalog(v2, { db });

    expect(result).toEqual({ from: v1.version, to: v2.version, changed: 4 });
    const get = async (item: Item) => (await db.items.get(item.id))!;

    expect((await get(logged.merged)).ragas).toEqual([
      { state: 'catalog', key: 'Dheerasankarabharanam', text: 'Sankarabharanam', guess: false },
    ]);
    expect((await get(logged.override)).ragas).toEqual([
      { state: 'override', key: 'Dheerasankarabharanam', text: 'Sankarabharanam', guess: false },
    ]);
    expect((await get(logged.retiredRaga)).ragas).toEqual([
      { state: 'unresolved', key: null, text: 'Jonpuri', guess: true },
    ]);
    const retiredSong = await get(logged.retiredSong);
    expect(retiredSong.compositionKey).toBeNull();
    expect(retiredSong.title).toBe('Kaddanuvariki');
    expect(retiredSong.ragas).toEqual(logged.retiredSong.ragas);
    expect(await get(logged.untouched)).toEqual(logged.untouched);
  });

  it('queues each changed Item for the server, and nothing else', async () => {
    const db = freshDb();
    const logged = await loggedUnderV1(db);

    await upgradeCatalog(v2, { db });

    const outbox = await db.outbox.toArray();
    expect(outbox.map((entry) => entry.recordId).sort()).toEqual(
      [logged.merged.id, logged.override.id, logged.retiredRaga.id, logged.retiredSong.id].sort(),
    );
    for (const entry of outbox) {
      expect(entry.row).toEqual(await db.items.get(entry.recordId));
    }
  });

  it('records the version, so a second launch changes nothing', async () => {
    let db = freshDb();
    await loggedUnderV1(db);
    await upgradeCatalog(v2, { db });
    const queued = await db.outbox.count();

    db = reopen(db);
    expect((await db.meta.get(CATALOG_VERSION_KEY))?.value).toBe(v2.version);
    expect(await upgradeCatalog(v2, { db })).toEqual({
      from: v2.version,
      to: v2.version,
      changed: 0,
    });
    expect(await db.outbox.count()).toBe(queued);
  });

  it('leaves every Item and the version as they were when it fails part-way', async () => {
    const db = freshDb();
    const logged = await loggedUnderV1(db);
    const before = await db.items.toArray();
    let rewritten = 0;

    await expect(
      upgradeStoredItems(
        v2.version,
        (item) => {
          rewritten += 1;
          if (rewritten === 3) throw new Error('force-close');
          return { ...item, title: `${item.title} (v2)` };
        },
        { db },
      ),
    ).rejects.toThrow('force-close');

    expect(await db.items.toArray()).toEqual(before);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.meta.get(CATALOG_VERSION_KEY))?.value).toBe(v1.version);
    // And the real upgrade then runs in full.
    expect((await upgradeCatalog(v2, { db })).changed).toBe(4);
    expect((await db.items.get(logged.merged.id))?.ragas[0]?.key).toBe('Dheerasankarabharanam');
  });

  it('skips deleted Items', async () => {
    const db = freshDb();
    const logged = await loggedUnderV1(db);
    const { tombstone } = (await removeItem(logged.merged.id, { db }))!;

    expect((await upgradeCatalog(v2, { db })).changed).toBe(3);
    expect(await db.items.get(logged.merged.id)).toEqual(tombstone);
  });

  it('remaps a row pulled with a v1 key after v2 is installed', async () => {
    const db = freshDb();
    const logged = await loggedUnderV1(db);
    // The server's copy, as pushed under v1: an Override and a retired song.
    const pulledOverride = structuredClone(logged.override);
    const pulledRetired = structuredClone(logged.retiredSong);

    expect(remapPulledRow('items', pulledOverride, v2.remap).ragas).toEqual([
      { state: 'override', key: 'Dheerasankarabharanam', text: 'Sankarabharanam', guess: false },
    ]);
    expect(remapPulledRow('items', pulledRetired, v2.remap).compositionKey).toBeNull();
    // A row with nothing to remap comes back as it was.
    expect(remapPulledRow('items', logged.untouched, v2.remap)).toBe(logged.untouched);
    const event = (await db.events.toArray())[0]!;
    expect(remapPulledRow('events', event, v2.remap)).toBe(event);
  });
});
