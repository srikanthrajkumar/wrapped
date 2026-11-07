// The review of PR #25 (Codex and /review, 2026-11-07). Required: each of these is a path where
// the Schedule could overwrite, double or lose what the rasika logged, or keep a damaged file.
// - A: an Appearance the rasika added stays theirs; a Schedule-made one has its Artist's id on
//   every phone, and comes back from its own tombstone with its Colours;
// - B: a null Role in the feed names nothing;
// - C: cancelled and reinstated are a field the hint shows, and the hint is never empty;
// - E: a stale file, by Season or by instant, never moves the stored copy;
// - F: one Event per Schedule entry, Undo included;
// - G: an add's journal entry settles when the entry was planned under another id;
// - H: "take it" only on a Planned Event, and leaving Planned clears the hint.

import { describe, expect, it } from 'vitest';
import type { ScheduleEntry } from '../../src/model';
import { deleteEvent, editEvent, restoreEvent, setStatus } from '../../src/store/events';
import { holdsValue } from '../../src/store/journal-check';
import {
  addAppearance,
  createArtist,
  editAppearance,
  removeAppearance,
} from '../../src/store/people';
import { ENTRY_PLANNED_AGAIN } from '../../src/store/rules';
import { peekReceipt } from '../../src/store/receipts';
import {
  addFromSchedule,
  applySchedule,
  fromSchedule,
  ID_TAKEN,
  scheduleAppearanceId,
  scheduleChanges,
  scheduleMeta,
  storeSchedule,
  takeSchedule,
  TAKE_PLANNED_ONLY,
} from '../../src/store/schedule';
import type { WrappedDB } from '../../src/store/db';
import { freshDb } from '../helpers';

const entry = (fields: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
  id: 'academy-1',
  version: 1,
  date: '2026-12-15',
  startTime: '16:00',
  sabha: 'Music Academy',
  kind: 'concert',
  title: null,
  billed: [
    { name: 'T. M. Krishna', role: 'vocal', group: null },
    { name: 'Akkarai Subhalakshmi', role: 'violin', group: null },
  ],
  cancelled: false,
  ...fields,
});

let published = 0;
async function publish(db: WrappedDB, ...entries: ScheduleEntry[]) {
  published += 1;
  const at = `2026-11-${String(published).padStart(2, '0')}T10:00:00Z`;
  await storeSchedule({ season: '2026-27', publishedAt: at, entries }, null, { db });
  return applySchedule({ db });
}

async function planned(db: WrappedDB, first = entry()) {
  await publish(db, first);
  return addFromSchedule(first.id, { db });
}

const stageRows = async (db: WrappedDB, eventId: string) =>
  (await db.appearances.where('eventId').equals(eventId).toArray()).filter(
    (a) => a.deletedAt === null,
  );

describe('A: whose Appearance it is', () => {
  it('never bills, changes, doubles or removes an Artist the rasika added', async () => {
    const db = freshDb();
    const event = await planned(db);
    const mridangam = await createArtist('Arun Prakash', { db });
    const own = await addAppearance(event.id, mridangam.id, { role: 'khanjira' }, { db });
    expect(fromSchedule(own)).toBe(false);
    // The version bills them, with another Role and a group, and drops T. M. Krishna.
    await publish(
      db,
      entry({
        version: 2,
        billed: [
          { name: 'Akkarai Subhalakshmi', role: 'violin', group: null },
          { name: 'Arun Prakash', role: 'mridangam', group: 'Trio' },
        ],
      }),
    );
    await takeSchedule(event.id, 2, { db });
    const rows = await stageRows(db, event.id);
    expect(rows.filter((a) => a.artistId === mridangam.id)).toEqual([own]);
    expect(rows.map((a) => a.artistId).sort()).toHaveLength(2);

    // A later version dropping them leaves them too.
    await publish(
      db,
      entry({
        version: 3,
        billed: [{ name: 'Akkarai Subhalakshmi', role: 'violin', group: null }],
      }),
    );
    expect((await scheduleChanges(event.id, db))?.changes.map((c) => c.field) ?? []).not.toContain(
      'billed',
    );
    expect(await db.appearances.get(own.id)).toEqual(own);
  });

  it('brings an Artist the rasika removed back from their own tombstone, Colours kept', async () => {
    const db = freshDb();
    const event = await planned(db);
    const krishna = (await stageRows(db, event.id)).find((a) => a.role === 'vocal')!;
    await editAppearance(krishna.id, { colourPrimary: 'green' }, { db });
    await removeAppearance(krishna.id, { db });
    await publish(db, entry({ version: 2, startTime: '18:00' }));
    expect((await scheduleChanges(event.id, db))!.changes.map((c) => c.field)).toEqual([
      'startTime',
      'billed',
    ]);
    await takeSchedule(event.id, 2, { db });
    expect(await db.appearances.get(krishna.id)).toMatchObject({
      deletedAt: null,
      colourPrimary: 'green',
      billed: true,
      role: 'vocal',
    });
    expect(await stageRows(db, event.id)).toHaveLength(2);
  });

  it('refuses a billing whose id is held by a row of another Artist, writing nothing', async () => {
    const db = freshDb();
    const event = await planned(db);
    const krishna = (await stageRows(db, event.id)).find((a) => a.role === 'vocal')!;
    const other = await createArtist('Sanjay Subrahmanyan', { db });
    // The store lets a row's Artist change, though no screen does; the row is then the rasika's.
    await editAppearance(krishna.id, { artistId: other.id }, { db });
    await publish(db, entry({ version: 2, startTime: '18:00' }));
    const before = await db.appearances.get(krishna.id);
    await expect(takeSchedule(event.id, 2, { db })).rejects.toThrow(ID_TAKEN);
    expect(await db.appearances.get(krishna.id)).toEqual(before);
    expect((await db.events.get(event.id))?.startTime).toBe('16:00');
  });

  it('keeps every Schedule id derived from the Event and the Artist, never the place', async () => {
    const db = freshDb();
    const event = await planned(db);
    for (const row of await stageRows(db, event.id)) {
      expect(row.id).toBe(scheduleAppearanceId(event.id, row.artistId));
    }
  });
});

describe('B: a null Role names nothing', () => {
  it('keeps the Role on a Schedule Artist when the version gives none, and takes one it gives', async () => {
    const db = freshDb();
    const event = await planned(db);
    await publish(
      db,
      entry({
        version: 2,
        billed: [
          { name: 'T. M. Krishna', role: null, group: null },
          { name: 'Akkarai Subhalakshmi', role: 'support', group: null },
        ],
      }),
    );
    const roles = (await stageRows(db, event.id)).map((a) => a.role).sort();
    expect(roles).toEqual(['support', 'vocal']);
  });
});

describe('C: cancelled, reinstated, and no empty hint', () => {
  it('hints at a cancellation and a reinstatement, and "take it" stores each', async () => {
    const db = freshDb();
    const event = await planned(db);
    await editEvent(event.id, { note: 'front row' }, { db });
    await publish(db, entry({ version: 2, cancelled: true }));
    expect((await db.events.get(event.id))?.scheduleChanged).toBe(true);
    expect((await scheduleChanges(event.id, db))!.changes).toEqual([
      { field: 'cancelled', from: false, to: true },
    ]);
    await takeSchedule(event.id, 2, { db });
    expect(await db.events.get(event.id)).toMatchObject({ cancelled: true, note: 'front row' });

    await publish(db, entry({ version: 3, cancelled: false }));
    expect((await scheduleChanges(event.id, db))!.changes).toEqual([
      { field: 'cancelled', from: true, to: false },
    ]);
    await takeSchedule(event.id, 3, { db });
    expect((await db.events.get(event.id))?.cancelled).toBe(false);
  });

  it('sets no hint for a version that changes nothing the sheet shows', async () => {
    const db = freshDb();
    const event = await planned(db);
    await editEvent(event.id, { note: 'front row' }, { db });
    // A new version with the same facts, and a Role it no longer gives.
    const same = entry({
      version: 2,
      billed: [{ ...entry().billed[0]!, role: null }, entry().billed[1]!],
    });
    expect(await publish(db, same)).toMatchObject({ flagged: 0 });
    expect(await db.events.get(event.id)).toMatchObject({
      scheduleChanged: false,
      scheduleVersionSeen: '2',
    });
  });
});

describe('E: a stale file never moves the stored copy', () => {
  const file = (season: string, publishedAt: string) => ({
    season,
    publishedAt,
    entries: [entry({ version: Number(publishedAt.slice(11, 13)) })],
  });

  it('compares publishedAt as instants, so +05:30 and Z order right', async () => {
    const db = freshDb();
    expect(await storeSchedule(file('2026-27', '2026-11-20T10:00:00Z'), '"a"', { db })).toBe(true);
    // 15:00 in Chennai is 09:30 Z: earlier, though its text sorts later.
    expect(await storeSchedule(file('2026-27', '2026-11-20T15:00:00+05:30'), '"b"', { db })).toBe(
      false,
    );
    expect(await scheduleMeta(db)).toMatchObject({ tag: '"a"' });
    expect((await db.schedule.toArray())[0]!.version).toBe(10);
    expect(await storeSchedule(file('2026-27', '2026-11-20T16:00:00+05:30'), '"c"', { db })).toBe(
      true,
    );
    expect(await scheduleMeta(db)).toMatchObject({ tag: '"c"' });
  });

  it('refuses a file for an earlier Season than the one stored', async () => {
    const db = freshDb();
    await storeSchedule(file('2026-27', '2026-11-20T10:00:00Z'), '"now"', { db });
    expect(await storeSchedule(file('2025-26', '2026-11-21T10:00:00Z'), '"old"', { db })).toBe(
      false,
    );
    expect(await scheduleMeta(db)).toMatchObject({ season: '2026-27', tag: '"now"' });
  });
});

describe('F: one Event per Schedule entry', () => {
  it('refuses the Undo of a delete once the entry is planned again, keeping the receipt', async () => {
    const db = freshDb();
    const first = await planned(db);
    const deleted = (await deleteEvent(first.id, { db }))!;
    const again = await addFromSchedule(entry().id, { db });
    expect(again.id).not.toBe(first.id);
    await expect(restoreEvent(deleted.receipt.id, { db })).rejects.toThrow(ENTRY_PLANNED_AGAIN);
    const live = (await db.events.toArray()).filter((e) => e.deletedAt === null);
    expect(live.map((e) => e.id)).toEqual([again.id]);
    expect(await peekReceipt(db, deleted.receipt.id)).toBeDefined();
    // Once the new one is deleted too, the first comes back.
    await deleteEvent(again.id, { db });
    expect(await restoreEvent(deleted.receipt.id, { db })).toMatchObject({ id: first.id });
  });
});

describe("G: an add's journal entry", () => {
  it('settles once the entry is planned, under whatever id', async () => {
    const db = freshDb();
    await publish(db, entry());
    const attempt = {
      table: 'events' as const,
      id: crypto.randomUUID(),
      field: '*',
      value: {
        kind: 'concert',
        date: '2026-12-15',
        startTime: '16:00',
        scheduleEntryId: 'academy-1',
      },
    };
    expect(await holdsValue(attempt, db)).toBe(false);
    await addFromSchedule('academy-1', { db });
    expect(await holdsValue(attempt, db)).toBe(true);
  });
});

describe('H: "take it" only on Planned', () => {
  it('refuses on an Attended Event, and leaving Planned clears the hint', async () => {
    const db = freshDb();
    const event = await planned(db);
    await editEvent(event.id, { note: 'front row' }, { db });
    await publish(db, entry({ version: 2, startTime: '18:00' }));
    expect((await db.events.get(event.id))?.scheduleChanged).toBe(true);
    await setStatus(event.id, 'attended', { db });
    expect((await db.events.get(event.id))?.scheduleChanged).toBe(false);
    await expect(takeSchedule(event.id, 2, { db })).rejects.toThrow(TAKE_PLANNED_ONLY);
    expect((await db.events.get(event.id))?.startTime).toBe('16:00');
  });
});
