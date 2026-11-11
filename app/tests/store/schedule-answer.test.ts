// The "schedule changed" hint answered (the Maintainer, 2026-11-07). Required: "take it" writes
// over values the rasika changed, so it must change nothing the new version doesn't name, and
// "keep mine" must change nothing at all but the hint.

import { describe, expect, it } from 'vitest';
import type { Event, ScheduleEntry } from '../../src/model';
import { editEvent, restoreTitle, setStatus } from '../../src/store/events';
import { addItem } from '../../src/store/items';
import { addAppearance, createArtist, editAppearance } from '../../src/store/people';
import { listAppearances } from '../../src/store/queries';
import { TOO_MANY_PRESENTERS } from '../../src/store/rules';
import {
  addFromSchedule,
  applySchedule,
  ENTRY_MOVED,
  keepMine,
  scheduleChanges,
  storeSchedule,
  takeSchedule,
} from '../../src/store/schedule';
import type { WrappedDB } from '../../src/store/db';
import { freshDb, reopen } from '../helpers';

const entry = (fields: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
  id: 'music-academy-2026-12-15-1600',
  version: 1,
  date: '2026-12-15',
  startTime: '16:00',
  sabha: 'Music Academy',
  kind: 'concert',
  title: null,
  billed: [
    { name: 'Malladi Sreeramprasad', role: 'vocal', group: 'Malladi Brothers' },
    { name: 'Malladi Ravikumar', role: 'vocal', group: 'Malladi Brothers' },
    { name: 'Pakkala Ramadas', role: 'violin', group: null },
  ],
  cancelled: false,
  ...fields,
});

let published = 0;
async function publish(db: WrappedDB, ...entries: ScheduleEntry[]) {
  published += 1;
  // Each file an hour after the last, so every publishedAt is a real instant.
  const at = new Date(Date.UTC(2026, 10, 1, published)).toISOString();
  await storeSchedule({ season: '2026-27', publishedAt: at, entries }, null, { db });
  return applySchedule({ db });
}

/** Everything of the rasika's for one Event, as stored, keyed so a test can compare it whole. */
async function snapshot(db: WrappedDB, eventId: string) {
  const byId = <T extends { id: string }>(rows: T[]) =>
    Object.fromEntries(rows.map((row) => [row.id, row]));
  return {
    event: (await db.events.get(eventId))!,
    appearances: byId(await db.appearances.where('eventId').equals(eventId).toArray()),
    items: byId(await db.items.where('eventId').equals(eventId).toArray()),
    artists: byId(await db.artists.toArray()),
    sabhas: byId(await db.sabhas.toArray()),
  };
}

const stageOf = async (db: WrappedDB, eventId: string) =>
  (await listAppearances(eventId, db)).map((a) => [a.artist?.name, a.role, a.group, a.billed]);

const v2 = entry({
  version: 2,
  date: '2026-12-16',
  startTime: '18:30',
  sabha: 'Narada Gana Sabha',
  kind: 'dance',
  title: 'Margam',
  billed: [
    { name: 'Alarmel Valli', role: 'dancer', group: null },
    { name: 'Malladi Ravikumar', role: 'vocal', group: null },
  ],
});

/**
 * A Planned Event from the Schedule the rasika made theirs: a note, an Artist of their own, a
 * Colour on two billed Artists, and an Item. Then version 2 sets the hint.
 */
async function hinted(db: WrappedDB) {
  await publish(db, entry());
  const event = await addFromSchedule(entry().id, { db });
  await editEvent(event.id, { note: 'front row' }, { db });
  const stage = await db.appearances.where('eventId').equals(event.id).sortBy('position');
  await editAppearance(stage[1]!.id, { colourPrimary: 'blue' }, { db });
  await editAppearance(stage[2]!.id, { colourPrimary: 'red' }, { db });
  const mridangam = await createArtist('Patri Satish Kumar', { db });
  await addAppearance(event.id, mridangam.id, { role: 'mridangam' }, { db });
  await addItem(event.id, { title: 'Vatapi' }, { db });
  // The first Item makes it Heard (ADR 0010). Put back, it is a Shortlisted Event that holds an
  // Item, as a build before that rule could leave one: the hint must still spare the Item.
  await setStatus(event.id, 'planned', { db });
  expect(await publish(db, v2)).toMatchObject({ flagged: 1 });
  return { event, stage };
}

describe('"take it" (required)', () => {
  it('shows only the fields the version changes, old beside new', async () => {
    const db = freshDb();
    const { event } = await hinted(db);
    expect(await scheduleChanges(event.id, db)).toEqual({
      version: 2,
      changes: [
        { field: 'date', from: '2026-12-15', to: '2026-12-16' },
        { field: 'startTime', from: '16:00', to: '18:30' },
        { field: 'sabha', from: 'Music Academy', to: 'Narada Gana Sabha' },
        { field: 'kind', from: 'concert', to: 'dance' },
        { field: 'title', from: null, to: 'Margam' },
        {
          field: 'billed',
          from: [
            { name: 'Malladi Sreeramprasad', role: 'vocal', support: false },
            { name: 'Malladi Ravikumar', role: 'vocal', support: false },
            { name: 'Pakkala Ramadas', role: 'violin', support: false },
          ],
          to: [
            { name: 'Alarmel Valli', role: 'dancer', support: false },
            { name: 'Malladi Ravikumar', role: 'vocal', support: false },
          ],
        },
      ],
    });
    // Only the time moved: only the time is shown.
    await publish(db, { ...v2, version: 3, startTime: '19:00' });
    const later = (await scheduleChanges(event.id, db))!;
    expect(later.changes.find((c) => c.field === 'startTime')).toEqual({
      field: 'startTime',
      from: '16:00',
      to: '19:00',
    });
    expect(await scheduleChanges('no-such-event', db)).toBeNull();
  });

  it('takes what the version names and changes nothing else', async () => {
    const db = freshDb();
    const { event, stage } = await hinted(db);
    const before = await snapshot(db, event.id);

    const { event: taken, receipt } = await takeSchedule(event.id, 2, { db });
    expect(receipt).toBeNull();
    const after = await snapshot(db, event.id);

    // The Event: the named fields, and the hint answered; the rest as it was.
    expect(after.event).toEqual({
      ...before.event,
      date: '2026-12-16',
      startTime: '18:30',
      sabhaId: after.event.sabhaId,
      kind: 'dance',
      title: 'Margam',
      scheduleChanged: false,
      scheduleVersionSeen: '2',
      updatedAt: after.event.updatedAt,
    });
    expect(taken).toEqual(after.event);
    expect((await db.sabhas.get(after.event.sabhaId!))?.name).toBe('Narada Gana Sabha');
    expect(after.event).toMatchObject({ note: 'front row', status: 'planned', touched: true });

    // The Stage: billed in billing order, the rasika's Colour kept on the Artist billed again,
    // the coloured Artist the version dropped kept unbilled, the uncoloured one removed, and the
    // rasika's own Artist untouched.
    expect(await stageOf(db, event.id)).toEqual([
      ['Alarmel Valli', 'dancer', null, true],
      ['Malladi Ravikumar', 'vocal', null, true],
      ['Pakkala Ramadas', 'violin', null, false],
      ['Patri Satish Kumar', 'mridangam', null, false],
    ]);
    // The Schedule's rows in billing order among their places; the rasika's keep theirs.
    const own = Object.values(before.appearances).find((a) => !a.billed)!;
    expect(after.appearances[own.id]!.position).toBe(own.position);
    const valli = Object.values(after.appearances).find(
      (a) => a.deletedAt === null && a.role === 'dancer',
    )!;
    expect(valli.position).toBeLessThan(after.appearances[stage[1]!.id]!.position);
    const [sreeramprasad, ravikumar, pakkala] = stage.map((a) => after.appearances[a.id]!);
    expect(sreeramprasad!.deletedAt).not.toBeNull();
    expect(ravikumar).toMatchObject({ colourPrimary: 'blue', deletedAt: null });
    expect(pakkala).toMatchObject({ colourPrimary: 'red', billed: false, deletedAt: null });
    expect(after.appearances[own.id]).toMatchObject({
      artistId: own.artistId,
      role: own.role,
      colourPrimary: own.colourPrimary,
      billed: false,
    });

    // Items and every Artist and Sabha already stored: unchanged.
    expect(after.items).toEqual(before.items);
    for (const [id, artist] of Object.entries(before.artists)) {
      expect(after.artists[id]).toEqual(artist);
    }
    for (const [id, sabha] of Object.entries(before.sabhas)) {
      expect(after.sabhas[id]).toEqual(sabha);
    }

    // Every record changed is queued as stored, and kept through a force-close.
    const again = reopen(db);
    expect(await again.events.get(event.id)).toEqual(after.event);
    for (const appearance of Object.values(after.appearances)) {
      if (before.appearances[appearance.id]?.updatedAt === appearance.updatedAt) continue;
      const queued = await again.outbox.where('recordId').equals(appearance.id).last();
      expect(queued?.row).toEqual(appearance);
    }
    expect((await again.outbox.where('recordId').equals(event.id).last())?.row).toEqual(
      after.event,
    );
  });

  it("keeps the rasika's time, title and Artists when the version gives none", async () => {
    const db = freshDb();
    await publish(db, entry({ kind: 'dance', title: 'Margam' }));
    const event = await addFromSchedule(entry().id, { db });
    await editEvent(event.id, { startTime: '17:00', title: 'Varnam evening' }, { db });
    const stage = await stageOf(db, event.id);
    await publish(
      db,
      entry({
        version: 2,
        kind: 'dance',
        title: null,
        startTime: null,
        billed: [],
        date: '2026-12-20',
      }),
    );

    expect((await scheduleChanges(event.id, db))!.changes).toEqual([
      { field: 'date', from: '2026-12-15', to: '2026-12-20' },
    ]);
    await takeSchedule(event.id, 2, { db });
    expect(await db.events.get(event.id)).toMatchObject({
      date: '2026-12-20',
      startTime: '17:00',
      title: 'Varnam evening',
      scheduleChanged: false,
    });
    expect(await stageOf(db, event.id)).toEqual(stage);
  });

  it('refuses a version that breaks a rule whole, leaving the Event and the hint', async () => {
    const db = freshDb();
    const { event } = await hinted(db);
    const four = Array.from({ length: 4 }, (_, i) => ({
      name: `Presenter ${i}`,
      role: 'presenter' as const,
      group: null,
    }));
    await publish(db, { ...v2, version: 3, kind: 'lecdem', title: 'On Todi', billed: four });
    const before = await snapshot(db, event.id);
    const outbox = await db.outbox.count();

    await expect(takeSchedule(event.id, 3, { db })).rejects.toThrow(TOO_MANY_PRESENTERS);
    expect(await snapshot(db, event.id)).toEqual(before);
    expect(await db.outbox.count()).toBe(outbox);
    expect(await db.artists.count()).toBe(Object.keys(before.artists).length);
  });

  it('refuses once the stored entry is another version than the sheet showed', async () => {
    const db = freshDb();
    const { event } = await hinted(db);
    await publish(db, { ...v2, version: 3, startTime: '19:00' });
    const before = await snapshot(db, event.id);
    await expect(takeSchedule(event.id, 2, { db })).rejects.toThrow(ENTRY_MOVED);
    expect(await snapshot(db, event.id)).toEqual(before);
  });

  it('takes it once, however often tapped or retried', async () => {
    const db = freshDb();
    const { event } = await hinted(db);
    const [a, b] = await Promise.all([
      takeSchedule(event.id, 2, { db }),
      takeSchedule(event.id, 2, { db }),
    ]);
    expect(b.event).toEqual(a.event);
    const outbox = await db.outbox.count();
    const stage = await stageOf(db, event.id);
    await takeSchedule(event.id, 2, { db });
    expect(await db.outbox.count()).toBe(outbox);
    expect(await stageOf(db, event.id)).toEqual(stage);
  });

  it('keeps a title a change to Concert takes, for Undo, as a kind change does', async () => {
    const db = freshDb();
    await publish(db, entry({ kind: 'lecdem', title: 'On Begada', billed: [] }));
    const event = await addFromSchedule(entry().id, { db });
    await editEvent(event.id, { title: 'On Begada and Saveri' }, { db });
    await publish(db, entry({ version: 2, billed: [] }));

    const { event: taken, receipt } = await takeSchedule(event.id, 2, { db });
    expect(taken).toMatchObject({ kind: 'concert', title: null });
    expect(receipt).toMatchObject({
      kind: 'title',
      title: { kind: 'lecdem', title: 'On Begada and Saveri' },
    });
    expect(await restoreTitle(receipt!.id, { db })).toMatchObject({
      kind: 'lecdem',
      title: 'On Begada and Saveri',
    });
  });
});

describe('"keep mine" (required)', () => {
  it('changes nothing but the hint, and a newer version shows it again', async () => {
    const db = freshDb();
    const { event } = await hinted(db);
    const before = await snapshot(db, event.id);

    const kept = await keepMine(event.id, { db });
    const after = await snapshot(db, event.id);
    const unchanged: Event = { ...before.event, scheduleChanged: false, updatedAt: kept.updatedAt };
    expect(after).toEqual({ ...before, event: unchanged });

    // The same version again changes nothing; a newer one sets the hint again, and nothing else.
    expect(await applySchedule({ db })).toMatchObject({ flagged: 0, updated: 0 });
    expect((await db.events.get(event.id))?.scheduleChanged).toBe(false);
    await publish(db, { ...v2, version: 3, startTime: '19:00' });
    const flagged = (await db.events.get(event.id))!;
    expect(flagged).toEqual({
      ...unchanged,
      scheduleChanged: true,
      scheduleVersionSeen: '3',
      updatedAt: flagged.updatedAt,
    });
    expect((await snapshot(db, event.id)).appearances).toEqual(before.appearances);
    // Kept through a force-close.
    expect((await reopen(db).events.get(event.id))?.scheduleVersionSeen).toBe('3');
  });

  it('writes nothing twice when tapped again', async () => {
    const db = freshDb();
    const { event } = await hinted(db);
    await keepMine(event.id, { db });
    const outbox = await db.outbox.count();
    await keepMine(event.id, { db });
    expect(await db.outbox.count()).toBe(outbox);
  });
});
