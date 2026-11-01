// Required test (constitution IV, "export"; T049): an export taken offline, with unsynced ops,
// contains every live and tombstoned record in the store, and how many ops are unsynced.

import { describe, expect, it } from 'vitest';
import { createEvent, deleteEvent } from '../../src/store/events';
import { buildExport, localTimestamp } from '../../src/store/export';
import { addItem, removeItem } from '../../src/store/items';
import { addAppearance, createArtist, createSabha } from '../../src/store/people';
import { freshDb } from '../helpers';

describe('season export (required)', () => {
  it('holds every live and tombstoned record, and the unsynced count', async () => {
    const db = freshDb();
    const sabha = await createSabha('Music Academy', { db });
    const concert = await createEvent({ kind: 'concert', sabhaId: sabha.id }, { db });
    const artist = await createArtist('T M Krishna', { db });
    const appearance = await addAppearance(concert.id, artist.id, { role: 'vocal' }, { db });
    const kept = await addItem(concert.id, { title: 'Varnam' }, { db });
    const gone = await addItem(concert.id, { title: 'Kriti' }, { db });
    await removeItem(gone.id, { db });
    const deleted = await createEvent({ kind: 'concert' }, { db });
    await deleteEvent(deleted.id, { db });
    await db.links.put({ id: 'l1', ownTable: 'sabha', ownId: sabha.id, sharedId: 's1' });

    const file = await buildExport({ db, appVersion: '1.0.0' });

    expect(file).toMatchObject({ format: 1, appVersion: '1.0.0', catalogVersion: null });
    expect(file.unsyncedOps).toBe(await db.outbox.count());
    expect(file.unsyncedOps).toBeGreaterThan(0);
    const ids = (rows: unknown[]) => rows.map((row) => (row as { id: string }).id).sort();
    expect(ids(file.events)).toEqual([concert.id, deleted.id].sort());
    expect(ids(file.items)).toEqual([kept.id, gone.id].sort());
    expect(ids(file.appearances)).toEqual([appearance.id]);
    expect(ids(file.artists)).toEqual([artist.id]);
    expect(ids(file.sabhas)).toEqual([sabha.id]);
    expect(ids(file.links)).toEqual(['l1']);
    expect(file.items.find((row) => (row as { id: string }).id === gone.id)).toMatchObject({
      deletedAt: expect.any(String),
    });
    expect(file).not.toHaveProperty('notSaved');
    expect(JSON.stringify(file)).not.toMatch(/email|token/i);
  });

  it('stamps the time with the phone offset', () => {
    expect(localTimestamp(new Date(2026, 11, 14, 21, 30))).toMatch(
      /^2026-12-14T21:30:00[+-]\d{2}:\d{2}$/,
    );
  });
});
