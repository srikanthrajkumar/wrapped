// Required test (constitution IV; ADR 0007): a journal entry leaves only once the phone store is
// read and seen holding its value. Each field compares the value as entered with the stored
// column the way the store keeps it, so an entry is neither dropped too soon nor kept forever.

import { describe, expect, it } from 'vitest';
import { catalogValue, unresolvedValue } from '../../src/model';
import type { JournalEntry } from '../../src/screens/save-feedback';
import { createEvent, editEvent } from '../../src/store/events';
import { addItemFrom, repickItem, setDetail } from '../../src/store/items';
import { holdsValue } from '../../src/store/journal-check';
import { endLogging } from '../../src/store/logging-note';
import { addAppearance, createArtist, createSabha, editAppearance } from '../../src/store/people';
import { fixtureCatalog, freshDb } from '../helpers';

const v1 = fixtureCatalog('catalog-v1.json');
const entry = (table: JournalEntry['table'], id: string, field: string, value: unknown) =>
  ({ table, id, field, value, enteredAt: '', state: 'failed' }) as JournalEntry;

describe('the journal, checked against the store', () => {
  it('a Sabha kept with its name is held once the Event points at it', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const sabha = await createSabha('Music Academy', { db });
    const chosen = entry('events', event.id, 'sabhaId', { id: sabha.id, name: 'Music Academy' });
    expect(await holdsValue(chosen, db)).toBe(false);
    await editEvent(event.id, { sabhaId: sabha.id }, { db });
    expect(await holdsValue(chosen, db)).toBe(true);
  });

  it('Colours, the note, Done with this Concert and a new record', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const artist = await createArtist('Sanjay', { db });
    const appearance = await addAppearance(event.id, artist.id, {}, { db });
    const colours = { colourPrimary: 'red', colourSecondary: 'blue' };
    const coloursEntry = entry('appearances', appearance.id, 'colours', colours);
    expect(await holdsValue(coloursEntry, db)).toBe(false);
    await editAppearance(appearance.id, { colourPrimary: 'red', colourSecondary: 'blue' }, { db });
    expect(await holdsValue(coloursEntry, db)).toBe(true);

    // An emptied note is stored as null.
    expect(await holdsValue(entry('events', event.id, 'note', ''), db)).toBe(true);
    expect(await holdsValue(entry('events', event.id, 'note', 'Tisram'), db)).toBe(false);

    const done = entry('events', event.id, 'logging', 'done');
    expect(await holdsValue(done, db)).toBe(false);
    await endLogging(event.id, { db });
    expect(await holdsValue(done, db)).toBe(true);

    expect(await holdsValue(entry('appearances', appearance.id, '*', {}), db)).toBe(true);
    expect(await holdsValue(entry('events', 'missing', '*', {}), db)).toBe(false);
  });

  it('a pick, and a Detail the store settled as an Override', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const item = await addItemFrom(event.id, { kind: 'unknown' }, { db });
    const song = v1.songByKritiId.get('c0004')!;
    const pick = entry('items', item.id, 'pick', {
      eventId: event.id,
      pick: { kind: 'song', kritiId: 'c0004', title: song.title },
      label: song.title,
    });
    expect(await holdsValue(pick, db)).toBe(false);
    await repickItem(item.id, { kind: 'song', song }, { db, catalog: v1 });
    expect(await holdsValue(pick, db)).toBe(true);

    // Chosen from the catalog, stored as an Override of the song's Tala: the same value.
    const tala = catalogValue('rupakam', 'Rupakam');
    await setDetail(item.id, 'tala', tala, { db, catalog: v1 });
    expect(await holdsValue(entry('items', item.id, 'tala', tala), db)).toBe(true);
    expect(
      await holdsValue(entry('items', item.id, 'tala', unresolvedValue('Khanda Chapu')), db),
    ).toBe(false);
  });
});
