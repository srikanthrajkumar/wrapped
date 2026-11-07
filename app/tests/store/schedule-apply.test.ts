// T059 (required: an overwrite would corrupt the season). A new Schedule version changes only an
// Event the rasika never changed; one they edited, started, or whose Stage they changed keeps
// every value and only gets the "schedule changed" hint (FR-027, contracts/schedule-feed.md).

import { describe, expect, it } from 'vitest';
import type { Event, ScheduleEntry } from '../../src/model';
import { editEvent, setStatus } from '../../src/store/events';
import {
  addAppearance,
  createArtist,
  editAppearance,
  removeAppearance,
} from '../../src/store/people';
import { listAppearances, listEventSummaries } from '../../src/store/queries';
import {
  addFromSchedule,
  applySchedule,
  readScheduleFile,
  scheduleAppearanceId,
  storeSchedule,
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
/** Store a file holding `entries`, each newer file published later, and apply it. */
async function publish(db: WrappedDB, ...entries: ScheduleEntry[]) {
  published += 1;
  // Each file an hour after the last, so every publishedAt is a real instant.
  const at = new Date(Date.UTC(2026, 10, 1, published)).toISOString();
  await storeSchedule({ season: '2026-27', publishedAt: at, entries }, null, { db });
  return applySchedule({ db });
}

async function stageOf(db: WrappedDB, eventId: string) {
  return (await listAppearances(eventId, db)).map((a) => [a.artist?.name, a.role, a.group]);
}

async function planned(db: WrappedDB, first = entry()) {
  await publish(db, first);
  return addFromSchedule(first.id, { db });
}

const changed = entry({
  version: 2,
  date: '2026-12-16',
  startTime: '18:30',
  sabha: 'Narada Gana Sabha',
  kind: 'dance',
  title: 'Margam',
  billed: [
    { name: 'Alarmel Valli', role: 'dancer', group: null },
    { name: 'Malladi Ravikumar', role: 'vocal', group: 'Malladi Brothers' },
  ],
});

describe('a new Schedule version (FR-027, required)', () => {
  it('updates an untouched Planned Event: facts, kind, title, Stage, Roles and groups', async () => {
    const db = freshDb();
    const event = await planned(db);
    expect(await publish(db, changed)).toMatchObject({ updated: 1 });

    const updated = (await db.events.get(event.id))!;
    expect(updated).toMatchObject({
      date: '2026-12-16',
      startTime: '18:30',
      kind: 'dance',
      title: 'Margam',
      status: 'planned',
      touched: false,
      scheduleChanged: false,
      scheduleVersionSeen: '2',
    });
    expect((await db.sabhas.get(updated.sabhaId!))?.name).toBe('Narada Gana Sabha');
    expect(await stageOf(db, event.id)).toEqual([
      ['Alarmel Valli', 'dancer', null],
      ['Malladi Ravikumar', 'vocal', 'Malladi Brothers'],
    ]);
    // The changes are queued for the server as stored.
    const queued = await db.outbox.where('recordId').equals(event.id).last();
    expect(queued?.row).toEqual(updated);
  });

  it('takes a changed group and kind on an untouched Event (T057)', async () => {
    const db = freshDb();
    const event = await planned(db);
    const regrouped = entry({
      version: 2,
      kind: 'harikatha',
      title: 'Sita Kalyanam',
      billed: entry().billed.map((person) => ({
        ...person,
        group: person.group && 'The Malladi Brothers',
      })),
    });
    await publish(db, regrouped);
    expect((await db.events.get(event.id))?.kind).toBe('harikatha');
    expect((await stageOf(db, event.id)).map(([, , group]) => group)).toEqual([
      'The Malladi Brothers',
      'The Malladi Brothers',
      null,
    ]);
  });

  it('never changes an edited Event, and sets the hint', async () => {
    const db = freshDb();
    const event = await planned(db);
    const edited = await editEvent(event.id, { note: 'front row' }, { db });
    const stage = await stageOf(db, event.id);

    expect(await publish(db, changed)).toMatchObject({ flagged: 1, updated: 0 });
    const after = (await db.events.get(event.id))!;
    expect(after).toEqual({
      ...edited,
      scheduleChanged: true,
      scheduleVersionSeen: '2',
      updatedAt: after.updatedAt,
    });
    expect(await stageOf(db, event.id)).toEqual(stage);
  });

  it('never changes an Attended or a Missed Event, nor sets the hint on it', async () => {
    const db = freshDb();
    for (const status of ['attended', 'missed'] as const) {
      const first = entry({ id: `entry-${status}` });
      const event = await planned(db, first);
      await setStatus(event.id, status, { db });
      const before = (await db.events.get(event.id))!;
      const stage = await db.appearances.where('eventId').equals(event.id).toArray();
      const queued = await db.outbox.count();
      expect(await publish(db, { ...changed, id: first.id })).toMatchObject({
        updated: 0,
        flagged: 0,
      });
      // Left alone: not one write, so nothing is queued either.
      expect(await db.events.get(event.id)).toEqual(before);
      expect(await db.appearances.where('eventId').equals(event.id).toArray()).toEqual(stage);
      expect(await db.outbox.count()).toBe(queued);
      expect((await listEventSummaries(db)).find((s) => s.event.id === event.id)?.event).toEqual(
        before,
      );
    }
  });

  it.each([
    [
      'an Artist added',
      async (db: WrappedDB, e: Event) =>
        addAppearance(
          e.id,
          (await createArtist('Someone', { db })).id,
          { role: 'mridangam' },
          { db },
        ),
    ],
    [
      'a Colour set',
      async (db: WrappedDB, e: Event) => {
        const [first] = await listAppearances(e.id, db);
        await editAppearance(first!.id, { colourPrimary: 'red' }, { db });
      },
    ],
    [
      'a Role changed',
      async (db: WrappedDB, e: Event) => {
        const [first] = await listAppearances(e.id, db);
        await editAppearance(first!.id, { role: 'veena' }, { db });
      },
    ],
    [
      'an Artist removed',
      async (db: WrappedDB, e: Event) => {
        const stage = await listAppearances(e.id, db);
        await removeAppearance(stage.at(-1)!.id, { db });
      },
    ],
  ])('never changes an Event whose Stage the rasika changed (%s)', async (_, change) => {
    const db = freshDb();
    const event = await planned(db);
    await change(db, event);
    expect((await db.events.get(event.id))?.touched).toBe(true);
    const before = (await db.events.get(event.id))!;
    const stage = await listAppearances(event.id, db);

    await publish(db, changed);
    const after = (await db.events.get(event.id))!;
    expect(after).toMatchObject({
      date: before.date,
      kind: before.kind,
      sabhaId: before.sabhaId,
      scheduleChanged: true,
    });
    expect(await listAppearances(event.id, db)).toEqual(stage);
  });

  it('leaves a Stage the rasika changed alone even on a row never marked touched', async () => {
    // As a Planned Event stored before a Stage edit touched its Event.
    const db = freshDb();
    const event = await planned(db);
    const [first] = await listAppearances(event.id, db);
    await db.appearances.update(first!.id, { colourPrimary: 'blue' });
    await db.events.update(event.id, { touched: false });

    expect(await publish(db, changed)).toMatchObject({ flagged: 1 });
    expect((await db.events.get(event.id))?.date).toBe('2026-12-15');
    expect((await db.appearances.get(first!.id))?.colourPrimary).toBe('blue');
  });

  it('marks only an untouched Event cancelled; an edited one only gets the hint', async () => {
    const db = freshDb();
    const kept = await planned(db, entry({ id: 'a' }));
    const edited = await planned(db, entry({ id: 'b' }));
    // Each publish is a whole file: both entries in it.
    await publish(db, entry({ id: 'a' }), entry({ id: 'b' }));
    await editEvent(edited.id, { startTime: '17:00' }, { db });

    await publish(
      db,
      entry({ id: 'a', version: 2, cancelled: true }),
      entry({ id: 'b', version: 2, cancelled: true }),
    );
    expect(await db.events.get(kept.id)).toMatchObject({ cancelled: true, scheduleChanged: false });
    expect(await db.events.get(edited.id)).toMatchObject({
      cancelled: false,
      scheduleChanged: true,
      startTime: '17:00',
    });

    // Next keeps both, each read as cancelled from its entry (T061).
    const summaries = await listEventSummaries(db);
    expect(summaries.map((s) => s.cancelled)).toEqual([true, true]);
  });

  it('leaves an Event as it was when a newer file no longer has its entry', async () => {
    const db = freshDb();
    const event = await planned(db);
    const before = await db.events.get(event.id);
    const stage = await stageOf(db, event.id);
    expect(await publish(db, entry({ id: 'another', version: 5 }))).toMatchObject({
      unchanged: 1,
    });
    expect(await db.events.get(event.id)).toEqual(before);
    expect(await stageOf(db, event.id)).toEqual(stage);
  });

  it('changes nothing for an entry of a kind it does not know (T057)', async () => {
    const db = freshDb();
    const event = await planned(db);
    const before = await db.events.get(event.id);
    const read = readScheduleFile({
      format: 1,
      season: '2026-27',
      publishedAt: '2026-11-30T10:00:00Z',
      entries: [{ ...entry({ version: 9 }), kind: 'upanyasam' }],
    })!;
    expect(read.entries).toEqual([]);
    await storeSchedule(read, null, { db });
    await applySchedule({ db });
    expect(await db.events.get(event.id)).toEqual(before);
  });

  it('applies a version once, compared as a number, and never goes back', async () => {
    const db = freshDb();
    const event = await planned(db, entry({ version: 9 }));
    // "10" sorts before "9" as text; as a number it is newer.
    await publish(db, entry({ version: 10, startTime: '19:00' }));
    expect((await db.events.get(event.id))?.startTime).toBe('19:00');
    const queued = await db.outbox.count();
    await publish(db, entry({ version: 10, startTime: '19:00' }));
    await publish(db, entry({ version: 9, startTime: '16:00' }));
    expect((await db.events.get(event.id))?.startTime).toBe('19:00');
    expect(await db.outbox.count()).toBe(queued);
  });

  it('refuses a version that breaks a rule whole, and applies a corrected one', async () => {
    const db = freshDb();
    const event = await planned(db);
    const before = await db.events.get(event.id);
    const stage = await stageOf(db, event.id);
    const four = Array.from({ length: 4 }, (_, i) => ({
      name: `Presenter ${i + 1}`,
      role: 'presenter' as const,
      group: null,
    }));
    expect(
      await publish(db, entry({ version: 2, kind: 'lecdem', title: 'On Todi', billed: four })),
    ).toMatchObject({ refused: 1 });
    expect(await db.events.get(event.id)).toEqual(before);
    expect(await stageOf(db, event.id)).toEqual(stage);

    await publish(
      db,
      entry({ version: 3, kind: 'lecdem', title: 'On Todi', billed: four.slice(0, 3) }),
    );
    expect(await db.events.get(event.id)).toMatchObject({
      kind: 'lecdem',
      scheduleVersionSeen: '3',
    });
  });

  it('keeps an update through a force-close, and an edit made after it', async () => {
    const db = freshDb();
    const event = await planned(db);
    await publish(db, changed);
    const again = reopen(db);
    expect((await again.events.get(event.id))?.date).toBe('2026-12-16');
    await editEvent(event.id, { note: 'with Amma' }, { db: again });
    await publish(again, entry({ version: 3 }));
    expect(await again.events.get(event.id)).toMatchObject({
      date: '2026-12-16',
      note: 'with Amma',
      scheduleChanged: true,
    });
  });

  it('bills the same Appearance on two phones applying one version, never the Artist twice', async () => {
    // One Event, synced to a second phone with the Artists both know; each applies a version
    // that bills one more Artist, at the front, so every place shifts (Codex, PR #25).
    const one = freshDb();
    await createArtist('Tiruvarur Bakthavathsalam', { db: one });
    const event = await planned(one);
    const two = freshDb();
    await two.artists.bulkPut(await one.artists.toArray());
    await two.events.bulkPut(await one.events.toArray());
    await two.appearances.bulkPut(await one.appearances.toArray());
    const more = entry({
      version: 2,
      billed: [
        { name: 'Tiruvarur Bakthavathsalam', role: 'mridangam', group: null },
        ...entry().billed,
      ],
    });
    await publish(one, more);
    await publish(two, more);
    const ids = async (db: WrappedDB) =>
      (await db.appearances.toArray()).map((a) => [a.id, a.artistId, a.deletedAt]).sort();
    // The same records on both phones: the new Artist's id, and the others' kept.
    expect(await ids(two)).toEqual(await ids(one));
    expect(await one.appearances.count()).toBe(4);
    const added = (await listAppearances(event.id, one)).find((a) => a.role === 'mridangam')!;
    expect(added.id).toBe(scheduleAppearanceId(event.id, added.artistId));
    expect(added.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('brings an Artist a version dropped back as the same record when billed again', async () => {
    const db = freshDb();
    const event = await planned(db);
    const third = (await listAppearances(event.id, db))[2]!;
    await publish(db, entry({ version: 2, billed: entry().billed.slice(0, 2) }));
    expect((await db.appearances.get(third.id))?.deletedAt).not.toBeNull();
    await publish(db, entry({ version: 3 }));
    const stage = await listAppearances(event.id, db);
    expect(stage).toHaveLength(3);
    expect(stage[2]).toMatchObject({ id: third.id, deletedAt: null, role: 'violin' });
    expect(await db.appearances.count()).toBe(3);
  });
});
