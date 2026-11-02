// The Concert summary (DESIGN.md "Finishing a Concert"): its Raga count and "What it added".
// Linked Ragas count as one (constitution: analytics aggregate on the linked pair), and each is
// shown by the name the rasika logged.

import { describe, expect, it } from 'vitest';
import { catalogValue, unresolvedValue } from '../../src/model';
import { createEvent } from '../../src/store/events';
import { addItem, setRagas } from '../../src/store/items';
import { countRagas, listItems, whatItAdded } from '../../src/store/queries';
import { fixtureCatalog, freshDb } from '../helpers';

// In v2, Pantuvarali and Kamavardhini are Linked ragas (one groupKey).
const v2 = fixtureCatalog('catalog-v2.json');
const pantuvarali = catalogValue('Pantuvarali', 'Pantuvarali');
const kamavardhini = catalogValue('Kamavardhini', 'Kamavardhini');

describe('Concert summary', () => {
  it('counts Linked ragas as one Raga', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    for (const raga of [pantuvarali, kamavardhini, catalogValue('Todi', 'Todi')]) {
      const item = await addItem(event.id, {}, { db });
      await setRagas(item.id, [raga], { db });
    }
    const typed = await addItem(event.id, {}, { db });
    await setRagas(typed.id, [unresolvedValue('Saveri')], { db });

    expect(countRagas(await listItems(event.id, db), v2)).toBe(3);
  });

  it('adds no "First Raga" for a Raga linked to one heard at an earlier Concert', async () => {
    const db = freshDb();
    const first = await createEvent({ kind: 'concert', date: '2026-12-14' }, { db });
    await setRagas((await addItem(first.id, {}, { db })).id, [pantuvarali], { db });
    const second = await createEvent({ kind: 'concert', date: '2026-12-15' }, { db });
    await setRagas((await addItem(second.id, {}, { db })).id, [kamavardhini], { db });
    await setRagas((await addItem(second.id, {}, { db })).id, [catalogValue('Todi', 'Todi')], {
      db,
    });

    const added = await whatItAdded(second.id, db, v2);

    expect(added.ragas).toEqual(['Todi']);
  });
});
