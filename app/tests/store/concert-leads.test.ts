// Whom a Concert is known by (the Maintainer, 2026-11-10): its lead singers and instruments, or,
// with none billed, its violinists as equals; never someone billed as support, who stays on
// Stage. Required where it touches stored rows: a `support` mark dropped on the way to the store
// or the outbox, or a re-billed feed that can't set or clear it, would name the Concert wrongly
// on every phone (contracts/schedule-feed.md, "Billed").

import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import type { Appearance, Role, ScheduleEntry } from '../../src/model';
import { createEvent } from '../../src/store/events';
import { addAppearance, createArtist, editAppearance } from '../../src/store/people';
import { listAppearances, listEventSummaries } from '../../src/store/queries';
import { appearanceProblems } from '../../src/store/rules';
import {
  addFromSchedule,
  applySchedule,
  readScheduleFile,
  scheduleChanges,
  scheduleMeta,
  storeSchedule,
} from '../../src/store/schedule';
import { joinNames, knownBy, knownNames } from '../../src/store/stage';
import { WrappedDB } from '../../src/store/db';
import { listingLead } from '../../src/screens/timeline';
import { freshDb } from '../helpers';
import { fileOf, raw } from './schedule-fixtures';

type Person = { name: string; role: Role | null; group?: string | null; support?: boolean };

/** The names a billing reads as, the way every Event row and the listing read them. */
function readsAs(people: Person[], kind: ScheduleEntry['kind'] = 'concert'): string {
  const stage = people.map((person, i) => ({ ...person, position: i + 1 }));
  return joinNames(knownNames(knownBy(kind, stage), (person) => person.name));
}

describe('whom a Concert is known by (2026-11-10)', () => {
  it('names both violinists of a violin duo, as equals', () => {
    expect(
      readsAs([
        { name: 'Akkarai Subbalakshmi', role: 'violin' },
        { name: 'Akkarai Sornalatha', role: 'violin' },
        { name: 'Patri Satish Kumar', role: 'mridangam' },
      ]),
    ).toBe('Akkarai Subbalakshmi & Akkarai Sornalatha');
    // A duo billed under a group shows as its name (T121).
    expect(
      readsAs([
        { name: 'Ganesh', role: 'violin', group: 'Ganesh-Kumaresh' },
        { name: 'Kumaresh', role: 'violin', group: 'Ganesh-Kumaresh' },
        { name: 'Someone', role: 'mridangam' },
      ]),
    ).toBe('Ganesh-Kumaresh');
  });

  it('names the lead alone when a violinist is billed as support', () => {
    expect(
      readsAs([
        { name: 'Nagai R. Muralidharan', role: 'violin' },
        { name: 'Badrinarayanan D', role: 'violin', support: true },
        { name: 'Someone', role: 'mridangam' },
      ]),
    ).toBe('Nagai R. Muralidharan');
  });

  it('never names the violinist of a vocal Concert, or of one with a lead instrument', () => {
    const accompanied = (lead: Role) => [
      { name: 'Lead', role: lead },
      { name: 'Violinist', role: 'violin' as const },
      { name: 'Second Violinist', role: 'violin' as const },
      { name: 'Mridangist', role: 'mridangam' as const },
    ];
    expect(readsAs(accompanied('vocal'))).toBe('Lead');
    expect(readsAs(accompanied('flute'))).toBe('Lead');
    expect(readsAs(accompanied('veena'))).toBe('Lead');
  });

  it('leaves out a singer billed as support, by the mark or by the vocal support Role', () => {
    expect(
      readsAs([
        { name: 'Guru', role: 'vocal' },
        { name: 'Disciple', role: 'vocal', support: true },
        { name: 'Violinist', role: 'violin' },
      ]),
    ).toBe('Guru');
    expect(
      readsAs([
        { name: 'Guru', role: 'vocal' },
        { name: 'Disciple', role: 'support' },
      ]),
    ).toBe('Guru');
    // The two together are one redundant credit, read as support.
    expect(
      readsAs([
        { name: 'Disciple', role: 'support', support: true },
        { name: 'Guru', role: 'vocal' },
      ]),
    ).toBe('Guru');
    // A support singer beside a violin duo names nothing: the duo leads.
    expect(
      readsAs([
        { name: 'Disciple', role: 'vocal', support: true },
        { name: 'Lalgudi GJR Krishnan', role: 'violin' },
        { name: 'Lalgudi Vijayalakshmi', role: 'violin' },
      ]),
    ).toBe('Lalgudi GJR Krishnan & Lalgudi Vijayalakshmi');
  });

  it('falls back to the first Artist on Stage who is not support, and to support only alone', () => {
    expect(
      readsAs([
        { name: 'Helper', role: 'mridangam', support: true },
        { name: 'Mridangist', role: 'mridangam' },
      ]),
    ).toBe('Mridangist');
    // With only support on Stage, the first names it, as a lone vocal support singer always has.
    expect(readsAs([{ name: 'Only Helper', role: 'violin', support: true }])).toBe('Only Helper');
    expect(readsAs([])).toBe('');
    // Only a Concert falls to its violinists: a Dance without dancers keeps the first on Stage.
    expect(
      readsAs(
        [
          { name: 'Violinist', role: 'violin' },
          { name: 'Second Violinist', role: 'violin' },
        ],
        'dance',
      ),
    ).toBe('Violinist');
  });
});

const BILLED_WITH_SUPPORT = [
  { name: 'Nagai R. Muralidharan', role: 'violin' },
  { name: 'Badrinarayanan D', role: 'violin', support: true },
  { name: 'Thanjavur Murugaboopathi', role: 'mridangam' },
];
const BILLED_AS_EQUALS = BILLED_WITH_SUPPORT.map(({ name, role }) => ({ name, role }));

let published = 0;
/** Store a feed file holding `entries`, each one published after the last, and apply it. */
async function publish(db: WrappedDB, ...entries: unknown[]) {
  published += 1;
  const at = new Date(Date.UTC(2026, 10, 10, published)).toISOString();
  await storeSchedule(readScheduleFile(fileOf(entries, { publishedAt: at }))!, null, { db });
  return applySchedule({ db });
}

const madhuradhwani = (version: number, billed: unknown[]) =>
  raw({ id: 'madhuradhwani-2026-11-11-1800', date: '2026-11-11', version, billed });

async function supportOf(db: WrappedDB, eventId: string) {
  return (await listAppearances(eventId, db)).map((a) => [a.artist?.name, a.role, a.support]);
}

describe('`support` from the feed to the planned Event (required)', () => {
  it('plans a listing with its support mark stored, queued and named by', async () => {
    const db = freshDb();
    await publish(db, madhuradhwani(1, BILLED_WITH_SUPPORT));
    const [entry] = await db.schedule.toArray();
    expect(listingLead(entry!)).toBe('Nagai R. Muralidharan');

    const event = await addFromSchedule(entry!.id, { db });
    expect(await supportOf(db, event.id)).toEqual([
      ['Nagai R. Muralidharan', 'violin', false],
      ['Badrinarayanan D', 'violin', true],
      ['Thanjavur Murugaboopathi', 'mridangam', false],
    ]);
    const [summary] = await listEventSummaries(db);
    expect(summary!.knownBy).toBe('Nagai R. Muralidharan');
    // The support violinist is still on Stage and still found by the filter.
    expect(summary!.stage.map((person) => person.name)).toContain('Badrinarayanan D');
    // The outbox carries the mark to the server as stored.
    const support = (await listAppearances(event.id, db)).find((a) => a.support)!;
    const queued = await db.outbox.where('recordId').equals(support.id).last();
    expect(queued?.row).toMatchObject({ support: true, role: 'violin' });
  });

  it('sets and clears the mark when a re-billed feed adds or removes it', async () => {
    const db = freshDb();
    await publish(db, madhuradhwani(1, BILLED_AS_EQUALS));
    const event = await addFromSchedule('madhuradhwani-2026-11-11-1800', { db });
    expect((await listEventSummaries(db))[0]!.knownBy).toBe(
      'Nagai R. Muralidharan & Badrinarayanan D',
    );

    // The logger marks the support violinist: the untouched Event takes it.
    expect(await publish(db, madhuradhwani(2, BILLED_WITH_SUPPORT))).toMatchObject({ updated: 1 });
    expect((await supportOf(db, event.id))[1]).toEqual(['Badrinarayanan D', 'violin', true]);
    expect((await listEventSummaries(db))[0]!.knownBy).toBe('Nagai R. Muralidharan');
    const marked = (await listAppearances(event.id, db)).find((a) => a.support)!;
    expect((await db.outbox.where('recordId').equals(marked.id).last())?.row).toMatchObject({
      support: true,
    });

    // A ruling the other way clears it.
    expect(await publish(db, madhuradhwani(3, BILLED_AS_EQUALS))).toMatchObject({ updated: 1 });
    expect((await supportOf(db, event.id))[1]).toEqual(['Badrinarayanan D', 'violin', false]);
    expect((await listEventSummaries(db))[0]!.knownBy).toBe(
      'Nagai R. Muralidharan & Badrinarayanan D',
    );
    expect((await db.outbox.where('recordId').equals(marked.id).last())?.row).toMatchObject({
      support: false,
    });
  });

  it('only hints at a changed mark on an Event the rasika changed', async () => {
    const db = freshDb();
    await publish(db, madhuradhwani(1, BILLED_AS_EQUALS));
    const event = await addFromSchedule('madhuradhwani-2026-11-11-1800', { db });
    const [lead] = await listAppearances(event.id, db);
    await editAppearance(lead!.id, { colourPrimary: 'white' }, { db });

    expect(await publish(db, madhuradhwani(2, BILLED_WITH_SUPPORT))).toMatchObject({ flagged: 1 });
    expect((await supportOf(db, event.id)).map(([, , support]) => support)).toEqual([
      false,
      false,
      false,
    ]);
    const billed = (await scheduleChanges(event.id, db))!.changes.find((c) => c.field === 'billed');
    expect(billed).toMatchObject({
      to: [{ support: false }, { name: 'Badrinarayanan D', support: true }, { support: false }],
    });
  });

  it('reads an Appearance stored before `support` existed as not support, and edits it', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const appearances: Appearance[] = [];
    for (const name of ['Mysore Nagaraj', 'Mysore Manjunath']) {
      const artist = await createArtist(name, { db });
      appearances.push(await addAppearance(event.id, artist.id, { role: 'violin' }, { db }));
    }
    // As synced or restored before 2026-11-10: no `support` field at all.
    for (const appearance of appearances) {
      expect(appearance).not.toHaveProperty('support');
      expect(appearanceProblems(appearance)).toEqual([]);
    }
    expect((await listEventSummaries(db))[0]!.knownBy).toBe('Mysore Nagaraj & Mysore Manjunath');

    const edited = await editAppearance(appearances[0]!.id, { colourPrimary: 'blue' }, { db });
    expect(edited).not.toHaveProperty('support');
    expect(appearanceProblems({ ...edited, support: 'yes' as unknown as boolean })).toContain(
      'support is true or false',
    );
  });

  it('does not rewrite a stored row when a feed without `support` bills it again', async () => {
    const db = freshDb();
    await publish(db, madhuradhwani(1, BILLED_AS_EQUALS));
    const event = await addFromSchedule('madhuradhwani-2026-11-11-1800', { db });
    // As stored by the build before: the Schedule's rows without the field.
    for (const appearance of await db.appearances.where('eventId').equals(event.id).toArray()) {
      const legacy: Partial<Appearance> = { ...appearance };
      delete legacy.support;
      await db.appearances.put(legacy as Appearance);
    }
    const stored = await db.appearances.where('eventId').equals(event.id).toArray();
    expect(await publish(db, madhuradhwani(2, BILLED_AS_EQUALS))).toMatchObject({ updated: 1 });
    // Only the Event's version moves: no Appearance is saved again for a mark it never had.
    expect(await db.appearances.where('eventId').equals(event.id).toArray()).toEqual(stored);
  });
});

describe('the store upgrade for `support` (schema 4)', () => {
  it("drops the stored Schedule's tag, so the next fetch reads the file again", async () => {
    const name = `upgrade-${published}-${Date.now()}`;
    // The store as the build before left it: schema 3, a Schedule file with its tag.
    const older = new Dexie(name);
    older.version(3).stores({
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
    });
    await older.table('meta').put({
      key: 'schedule',
      value: { season: '2026-27', publishedAt: '2026-11-10T00:00:00Z', tag: '"b1166388"' },
    });
    await older.table('schedule').put({ ...raw(), billed: [] });
    older.close();

    const db = freshDb(name);
    expect(await scheduleMeta(db)).toEqual({
      season: '2026-27',
      publishedAt: '2026-11-10T00:00:00Z',
      tag: null,
    });
    // The entries stay until the next file replaces them.
    expect(await db.schedule.count()).toBe(1);
  });
});
