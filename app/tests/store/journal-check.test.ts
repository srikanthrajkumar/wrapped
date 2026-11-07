// Required test (constitution IV; ADR 0007): a journal entry leaves only once the phone store is
// read and seen holding its value. Each field compares the value as entered with the stored
// column the way the store keeps it, so an entry is neither dropped too soon nor kept forever.

import { describe, expect, it } from 'vitest';
import { catalogValue, notApplicableValue, unresolvedValue } from '../../src/model';
import type { JournalEntry } from '../../src/screens/save-feedback';
import { createEvent, editEvent, setStatus } from '../../src/store/events';
import {
  addItemFrom,
  describePick,
  removeItem,
  repickItem,
  saveItemDraft,
  setDetail,
  setImprovised,
  setLayaNadai,
  setLayaNote,
  setLayaVinyasam,
  setRagas,
} from '../../src/store/items';
import { holdsValue, storedHolds } from '../../src/store/journal-check';
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

  it('Colours, the note, a legacy Done with this Concert and a new record', async () => {
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

    // "Done with this Concert" is gone (walkthrough S13): an entry left from before leaves.
    expect(await holdsValue(entry('events', event.id, 'logging', 'done'), db)).toBe(true);

    expect(await holdsValue(entry('appearances', appearance.id, '*', {}), db)).toBe(true);
    expect(await holdsValue(entry('events', 'missing', '*', {}), db)).toBe(false);
  });

  it('the "schedule changed" hint answered, held once it is clear or set again by a newer version', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const kept = entry('events', event.id, 'scheduleChanged', { answer: 'keep', version: 2 });
    expect(await holdsValue(kept, db)).toBe(true);
    await db.events.update(event.id, { scheduleChanged: true, scheduleVersionSeen: '2' });
    expect(await holdsValue(kept, db)).toBe(false);
    await db.events.update(event.id, { scheduleVersionSeen: '10' });
    expect(await holdsValue(kept, db)).toBe(true);
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

describe('the journal, checked against each writer (fourth review)', () => {
  /** Whether `check` is held after `write` and not before. */
  async function heldOnlyAfter(
    check: JournalEntry,
    write: () => Promise<unknown>,
    db: ReturnType<typeof freshDb>,
  ) {
    expect(await holdsValue(check, db)).toBe(false);
    await write();
    expect(await holdsValue(check, db)).toBe(true);
  }

  it('a new Item is held only with the pick entered, not another made with its id', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const item = await addItemFrom(event.id, { kind: 'unknown' }, { db });
    const typed = {
      eventId: event.id,
      pick: { kind: 'typed', text: 'Bhavayami' },
      label: 'Bhavayami',
    };
    expect(await holdsValue(entry('items', item.id, '*', typed), db)).toBe(false);
    const unknown = { eventId: event.id, pick: { kind: 'unknown' }, label: '?' };
    expect(await holdsValue(entry('items', item.id, '*', unknown), db)).toBe(true);
  });

  it('Ragas, Improvised in any order, the Laya vinyasam and its note, a delete', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const item = await addItemFrom(event.id, { kind: 'unknown' }, { db });
    const ragas = [unresolvedValue('Todi'), unresolvedValue('Kalyani')];
    await heldOnlyAfter(
      entry('items', item.id, 'ragas', ragas),
      () => setRagas(item.id, ragas, { db }),
      db,
    );

    // Entered tanam first; the store keeps the concert order.
    const heard = [
      { kind: 'tanam', raga: null },
      { kind: 'alapana', raga: unresolvedValue('Todi') },
    ] as const;
    await heldOnlyAfter(
      entry('items', item.id, 'improvised', heard),
      () => setImprovised(item.id, [...heard], { db }),
      db,
    );

    const nadai = { nadai: notApplicableValue() };
    await heldOnlyAfter(
      entry('items', item.id, 'layaVinyasam', nadai),
      () => setLayaNadai(item.id, notApplicableValue(), { db }),
      db,
    );
    await heldOnlyAfter(
      entry('items', item.id, 'layaNote', 'tisram'),
      () => setLayaNote(item.id, 'tisram', { db }),
      db,
    );
    // An emptied note is stored as null; a note never changes the Nadai, nor the Nadai the note.
    await setLayaNote(item.id, '', { db });
    expect(await holdsValue(entry('items', item.id, 'layaNote', ''), db)).toBe(true);
    await setLayaNote(item.id, 'khanda', { db });
    await setLayaNadai(item.id, unresolvedValue('khanda'), { db });
    expect((await db.items.get(item.id))?.layaVinyasam).toEqual({
      nadai: unresolvedValue('khanda'),
      note: 'khanda',
    });
    await heldOnlyAfter(
      entry('items', item.id, 'layaVinyasam', null),
      () => setLayaVinyasam(item.id, null, { db }),
      db,
    );

    await heldOnlyAfter(
      entry('items', item.id, 'deletedAt', { label: 'Item 1' }),
      () => removeItem(item.id, { db }),
      db,
    );
  });

  it('a repick of each kind', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const item = await addItemFrom(event.id, { kind: 'typed', text: 'Bhavayami' }, { db });
    const song = v1.songByKritiId.get('c0004')!;
    const raga = [...v1.ragaByKey.values()][0]!;
    const picks = [
      { kind: 'song', song },
      { kind: 'raga', raga },
      { kind: 'form', form: 'rtp' },
      { kind: 'unknown' },
      { kind: 'typed', text: 'Nagumomu' },
    ] as const;
    for (const pick of picks) {
      const check = entry('items', item.id, 'pick', { pick: describePick(pick) });
      await heldOnlyAfter(check, () => repickItem(item.id, pick, { db, catalog: v1 }), db);
    }
  });

  it('a new Artist and Sabha, the status, a role, the date and time', async () => {
    const db = freshDb();
    await heldOnlyAfter(
      entry('artists', 'a1', '*', 'Sanjay'),
      () => createArtist('Sanjay', { db, id: 'a1' }),
      db,
    );
    await heldOnlyAfter(
      entry('sabhas', 's1', '*', 'Music Academy'),
      () => createSabha('Music Academy', { db, id: 's1' }),
      db,
    );
    const event = await createEvent(
      { kind: 'concert', date: '2026-12-14', source: 'plan' },
      { db },
    );
    await heldOnlyAfter(
      entry('events', event.id, 'status', 'attended'),
      () => setStatus(event.id, 'attended', { db }),
      db,
    );
    await heldOnlyAfter(
      entry('events', event.id, 'date', '2026-12-20'),
      () => editEvent(event.id, { date: '2026-12-20' }, { db }),
      db,
    );
    await heldOnlyAfter(
      entry('events', event.id, 'startTime', '18:30'),
      () => editEvent(event.id, { startTime: '18:30' }, { db }),
      db,
    );
    const appearance = await addAppearance(event.id, 'a1', {}, { db });
    await heldOnlyAfter(
      entry('appearances', appearance.id, 'role', 'vocal'),
      () => editAppearance(appearance.id, { role: 'vocal' }, { db }),
      db,
    );
  });

  it('what a screen reads back is checked the same way, so a saved value stops showing over it', () => {
    const target = { table: 'items', id: 'i1', field: 'tala' } as const;
    const tala = catalogValue('rupakam', 'Rupakam');
    expect(storedHolds(target, tala, { ...tala, state: 'override' })).toBe(true);
    expect(storedHolds(target, tala, unresolvedValue('Adi'))).toBe(false);
    const heard = { table: 'items', id: 'i1', field: 'improvised' } as const;
    const tanam = { kind: 'tanam', raga: null };
    const alapana = { kind: 'alapana', raga: null };
    expect(storedHolds(heard, [tanam, alapana], [alapana, tanam])).toBe(true);
  });

  it("a new Item's search text is held once its draft is stored, or the Item is made", async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const typed = entry('items', 'd1', 'draft', { eventId: event.id, text: 'Bhava' });
    await heldOnlyAfter(
      typed,
      () => saveItemDraft({ id: 'd1', eventId: event.id, text: 'Bhava' }, { db }),
      db,
    );
    expect(await holdsValue({ ...typed, value: { eventId: event.id, text: 'Bhavay' } }, db)).toBe(
      false,
    );
    await addItemFrom(event.id, { kind: 'typed', text: 'Bhavayami' }, { db, id: 'd1' });
    expect(await holdsValue({ ...typed, value: { eventId: event.id, text: 'Bhavay' } }, db)).toBe(
      true,
    );
  });
});
