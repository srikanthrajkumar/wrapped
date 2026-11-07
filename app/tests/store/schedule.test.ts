// The Schedule on the phone (T058, T061): the feed read as contracts/schedule-feed.md says, and an
// entry added to the Plan with its billed Artists. The fetch is tested apart, with its seam
// (schedule-fetch.test.ts).

import { describe, expect, it } from 'vitest';
import type { SharedEntry } from '../../src/model';
import { deleteEvent } from '../../src/store/events';
import { createArtist, renameArtist } from '../../src/store/people';
import { listAppearances, listEventSummaries } from '../../src/store/queries';
import { RuleError, TOO_MANY_PRESENTERS } from '../../src/store/rules';
import {
  addFromSchedule,
  ENTRY_CANCELLED,
  readScheduleFile,
  storeSchedule,
} from '../../src/store/schedule';
import type { WrappedDB } from '../../src/store/db';
import { freshDb, reopen } from '../helpers';
import { fileOf, raw } from './schedule-fixtures';

async function stored(db: WrappedDB, ...entries: unknown[]) {
  await storeSchedule(readScheduleFile(fileOf(entries))!, null, { db });
}

describe('reading the feed (contracts/schedule-feed.md)', () => {
  it('reads an entry as the contract shapes it', () => {
    expect(readScheduleFile(fileOf([raw()]))).toEqual({
      season: '2026-27',
      publishedAt: '2026-11-20T10:00:00Z',
      entries: [
        {
          ...raw(),
          billed: [
            { name: 'Malladi Sreeramprasad', role: 'vocal', group: 'Malladi Brothers' },
            { name: 'Malladi Ravikumar', role: 'vocal', group: 'Malladi Brothers' },
            { name: 'Pakkala Ramadas', role: 'violin', group: null },
            { name: 'Someone', role: null, group: null },
          ],
        },
      ],
    });
  });

  it('reads a Role it does not know as none, ignores fields it does not know, and accepts billed [] and no time', () => {
    const [entry] = readScheduleFile(
      fileOf([
        raw({ billed: [{ name: 'A', role: 'tabla', since: 2027 }], startTime: null, extra: 1 }),
      ]),
    )!.entries;
    expect(entry).toMatchObject({
      startTime: null,
      billed: [{ name: 'A', role: null, group: null }],
    });
    expect(entry).not.toHaveProperty('extra');
    expect(readScheduleFile(fileOf([raw({ billed: [] })]))!.entries[0]!.billed).toEqual([]);
  });

  it('skips an entry of a kind it does not know, and keeps the rest', () => {
    const file = readScheduleFile(
      fileOf([
        raw({ id: 'talk', kind: 'upanyasam' }),
        raw({ id: 'kept', kind: 'harikatha', title: ' Sita Kalyanam ' }),
      ]),
    )!;
    expect(file.entries.map((e) => [e.id, e.title])).toEqual([['kept', 'Sita Kalyanam']]);
  });

  it.each([
    ['a date it cannot read', { date: '15 Dec' }],
    ['a date that does not exist', { date: '2026-02-30' }],
    ['a version as text', { version: '3' }],
    ['billed not a list', { billed: { name: 'A' } }],
    ['billed missing', { billed: undefined }],
    ['a billed name missing', { billed: [{ role: 'vocal' }] }],
    ['a time out of range', { startTime: '25:00' }],
    ['cancelled as text', { cancelled: 'yes' }],
  ])('refuses the whole file for one entry with %s (Codex, PR #25)', (_, fields) => {
    expect(readScheduleFile(fileOf([raw({ id: 'good' }), raw(fields)]))).toBeNull();
  });

  it('refuses a file whose publishedAt is not an instant with its offset', () => {
    for (const publishedAt of ['yesterday', '2026-11-20', '2026-11-20T10:00:00', '']) {
      expect(readScheduleFile(fileOf([raw()], { publishedAt }))).toBeNull();
    }
    expect(
      readScheduleFile(fileOf([raw()], { publishedAt: '2026-11-20T15:30:00+05:30' })),
    ).not.toBeNull();
  });

  it('refuses a file of another format, or not the feed', () => {
    expect(readScheduleFile(fileOf([raw()], { format: 2 }))).toBeNull();
    expect(readScheduleFile({ entries: [] })).toBeNull();
    expect(readScheduleFile('<html>')).toBeNull();
  });
});

describe('adding an entry to the Plan (T061)', () => {
  it('makes a Planned Event from the entry, with its billed Artists in Roles and groups', async () => {
    const db = freshDb();
    await stored(db, raw());
    const event = await addFromSchedule('music-academy-2026-12-15-1600', { db });
    expect(event).toMatchObject({
      status: 'planned',
      source: 'schedule',
      touched: false,
      date: '2026-12-15',
      startTime: '16:00',
      scheduleEntryId: 'music-academy-2026-12-15-1600',
      scheduleVersionSeen: '3',
    });
    expect(
      (await listAppearances(event.id, db)).map((a) => [a.artist?.name, a.role, a.group, a.billed]),
    ).toEqual([
      ['Malladi Sreeramprasad', 'vocal', 'Malladi Brothers', true],
      ['Malladi Ravikumar', 'vocal', 'Malladi Brothers', true],
      ['Pakkala Ramadas', 'violin', null, true],
      ['Someone', null, null, true],
    ]);
    const [summary] = await listEventSummaries(db);
    expect(summary).toMatchObject({ knownBy: 'Malladi Brothers', cancelled: false });
    expect(summary!.sabha?.name).toBe('Music Academy');
    // Every row is queued, and kept through a force-close.
    const again = reopen(db);
    expect(await again.events.get(event.id)).toEqual(event);
    expect(await again.outbox.where('recordId').equals(event.id).count()).toBe(1);
    expect(await again.appearances.where('eventId').equals(event.id).count()).toBe(4);
  });

  it("matches a name to the rasika's own Artist by name or Alias, and a shared one first", async () => {
    const db = freshDb();
    const own = await createArtist('Pakkala Ramadoss', { db });
    await renameArtist(own.id, 'P. Ramadas', { db });
    await db.sharedSabhas.put({
      id: 'shared-academy',
      name: 'The Music Academy',
      aliases: ['Music Academy'],
      listVersion: 1,
    } satisfies SharedEntry);
    await stored(
      db,
      raw({
        billed: [
          { name: 'pakkala ramadoss', role: 'violin' },
          { name: 'New Name', role: null },
        ],
      }),
    );
    const event = await addFromSchedule('music-academy-2026-12-15-1600', { db });
    expect(event.sabhaId).toBe('shared-academy');
    const stage = await listAppearances(event.id, db);
    expect(stage[0]!.artistId).toBe(own.id);
    expect(await db.artists.count()).toBe(2);
    expect(await db.sabhas.count()).toBe(0);
  });

  it('plans an entry once, however often it is tapped or retried', async () => {
    const db = freshDb();
    await stored(db, raw());
    const id = crypto.randomUUID();
    const [a, b] = await Promise.all([
      addFromSchedule('music-academy-2026-12-15-1600', { db, id }),
      addFromSchedule('music-academy-2026-12-15-1600', { db }),
    ]);
    expect(b.id).toBe(a.id);
    expect((await addFromSchedule('music-academy-2026-12-15-1600', { db, id })).id).toBe(a.id);
    expect(await db.events.count()).toBe(1);
    expect(await db.artists.count()).toBe(4);

    // Deleted, it can be planned again.
    await deleteEvent(a.id, { db });
    const again = await addFromSchedule('music-academy-2026-12-15-1600', { db });
    expect(again.id).not.toBe(a.id);
  });

  it('refuses a cancelled entry, and a Lecdem billed with more than 3 presenters, adding nothing', async () => {
    const db = freshDb();
    const four = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, role: 'presenter' }));
    await stored(
      db,
      raw({ id: 'off', cancelled: true }),
      raw({ id: 'big', kind: 'lecdem', title: 'On Todi', billed: four }),
    );
    await expect(addFromSchedule('off', { db })).rejects.toThrow(ENTRY_CANCELLED);
    await expect(addFromSchedule('big', { db })).rejects.toThrow(TOO_MANY_PRESENTERS);
    await expect(addFromSchedule('gone', { db })).rejects.toBeInstanceOf(RuleError);
    expect(await db.events.count()).toBe(0);
    expect(await db.appearances.count()).toBe(0);
    expect(await db.artists.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });
});
