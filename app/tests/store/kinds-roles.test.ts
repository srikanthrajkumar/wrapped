// T119 (required): the kinds, Roles and group names the schedule feed brought (T057). A save
// refused for a new kind or Role, or a `group` dropped on the way to the store, the outbox or
// the Export, would lose what the rasika logged.

import { describe, expect, it } from 'vitest';
import { EVENT_KINDS, ROLES, type Appearance, type Event, type Role } from '../../src/model';
import { changeKind, createEvent, editEvent } from '../../src/store/events';
import { buildExport } from '../../src/store/export';
import { holdsValue } from '../../src/store/journal-check';
import {
  addAppearance,
  createArtist,
  editAppearance,
  removeAppearance,
} from '../../src/store/people';
import { listEventSummaries } from '../../src/store/queries';
import { RuleError } from '../../src/store/rules';
import { byStage, knownBy, STAGE_ORDER } from '../../src/store/stage';
import type { WrappedDB } from '../../src/store/db';
import { freshDb, reopen } from '../helpers';

const NEW_ROLES: Role[] = [
  'support',
  'chitravina',
  'nagaswaram',
  'saxophone',
  'mandolin',
  'thavil',
  'dancer',
  'nattuvangam',
];

async function outboxRow(db: WrappedDB, id: string) {
  const entries = await db.outbox.where('recordId').equals(id).toArray();
  return entries.at(-1)?.row;
}

async function season(db: WrappedDB) {
  const dance = await createEvent({ kind: 'dance', title: 'Margam' }, { db });
  const harikatha = await createEvent({ kind: 'harikatha', title: 'Sita Kalyanam' }, { db });
  const appearances: Appearance[] = [];
  for (const role of NEW_ROLES) {
    const artist = await createArtist(`Artist ${role}`, { db });
    appearances.push(await addAppearance(dance.id, artist.id, { role }, { db }));
  }
  const brothers: Appearance[] = [];
  for (const name of ['Malladi Sreeramprasad', 'Malladi Ravikumar']) {
    const artist = await createArtist(name, { db });
    brothers.push(
      await addAppearance(
        harikatha.id,
        artist.id,
        { role: 'presenter', group: 'Malladi Brothers', billed: true },
        { db },
      ),
    );
  }
  return { dance, harikatha, appearances, brothers };
}

describe('new kinds, Roles and group names are kept (required)', () => {
  it('saves a Dance and a Harikatha with titles, every new Role and a group, and keeps them', async () => {
    const db = freshDb();
    const { dance, harikatha, appearances, brothers } = await season(db);

    expect(dance).toMatchObject({ kind: 'dance', title: 'Margam' });
    expect(harikatha).toMatchObject({ kind: 'harikatha', title: 'Sita Kalyanam' });
    expect(brothers.map((a) => a.group)).toEqual(['Malladi Brothers', 'Malladi Brothers']);

    // Each row is queued for the server exactly as stored, group included.
    for (const row of [dance, harikatha, ...appearances, ...brothers]) {
      expect(await outboxRow(db, row.id)).toEqual(row);
    }

    // A force-close and relaunch keeps every field.
    const again = reopen(db);
    expect(await again.events.get(dance.id)).toEqual(dance);
    expect(await again.events.get(harikatha.id)).toEqual(harikatha);
    for (const appearance of [...appearances, ...brothers]) {
      expect(await again.appearances.get(appearance.id)).toEqual(appearance);
    }
    expect(
      (await again.appearances.bulkGet(appearances.map((a) => a.id))).map((a) => a?.role),
    ).toEqual(NEW_ROLES);
  });

  it('puts them in the Export as stored (T049)', async () => {
    const db = freshDb();
    const { dance, harikatha, appearances, brothers } = await season(db);
    const file = await buildExport({ db, appVersion: 'test' });
    const byId = new Map(
      [...file.events, ...file.appearances].map((row) => [(row as { id: string }).id, row]),
    );
    for (const row of [dance, harikatha, ...appearances, ...brothers]) {
      expect(byId.get(row.id)).toEqual(row);
    }
  });

  it('passes the journal check unchanged', async () => {
    const db = freshDb();
    const { dance, harikatha, appearances, brothers } = await season(db);
    for (const row of [dance, harikatha]) {
      expect(await holdsValue({ table: 'events', id: row.id, field: '*', value: {} }, db)).toBe(
        true,
      );
      for (const field of ['kind', 'title'] as const) {
        expect(
          await holdsValue({ table: 'events', id: row.id, field, value: row[field] }, db),
        ).toBe(true);
      }
    }
    // A title typed with spaces around it is held once stored trimmed.
    expect(
      await holdsValue({ table: 'events', id: dance.id, field: 'title', value: ' Margam ' }, db),
    ).toBe(true);
    for (const row of [...appearances, ...brothers]) {
      expect(
        await holdsValue({ table: 'appearances', id: row.id, field: 'role', value: row.role }, db),
      ).toBe(true);
    }
    // And says no while the store does not hold the value.
    expect(
      await holdsValue({ table: 'events', id: dance.id, field: 'kind', value: 'concert' }, db),
    ).toBe(false);
  });

  it('accepts every kind and Role, and refuses what is not one', async () => {
    const db = freshDb();
    for (const kind of EVENT_KINDS) {
      const title = kind === 'lecdem' ? 'On Begada' : null;
      expect((await createEvent({ kind, title }, { db })).kind).toBe(kind);
    }
    const event = await createEvent({ kind: 'concert' }, { db });
    const artist = await createArtist('Someone', { db });
    for (const role of ROLES) {
      expect((await addAppearance(event.id, artist.id, { role }, { db })).role).toBe(role);
    }
    await expect(
      createEvent({ kind: 'upanyasam' as Event['kind'] }, { db }),
    ).rejects.toBeInstanceOf(RuleError);
    await expect(
      addAppearance(event.id, artist.id, { role: 'tabla' as Role }, { db }),
    ).rejects.toBeInstanceOf(RuleError);
    await expect(
      addAppearance(event.id, artist.id, { group: '  ' }, { db }),
    ).rejects.toBeInstanceOf(RuleError);
  });

  it('keeps a Dance or a Harikatha without a title, and an emptied title as none', async () => {
    const db = freshDb();
    const dance = await createEvent({ kind: 'dance' }, { db });
    expect(dance.title).toBeNull();
    expect((await editEvent(dance.id, { title: '  Varnam ' }, { db })).title).toBe('Varnam');
    expect((await editEvent(dance.id, { title: '' }, { db })).title).toBeNull();
    const harikatha = await createEvent({ kind: 'harikatha', title: '   ' }, { db });
    expect(harikatha.title).toBeNull();
    // A Lecdem still needs one (FR-013).
    await expect(createEvent({ kind: 'lecdem' }, { db })).rejects.toBeInstanceOf(RuleError);
    await expect(changeKind(dance.id, 'lecdem', { db })).rejects.toBeInstanceOf(RuleError);
  });

  it('still edits an Appearance stored before `group` existed', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const artist = await createArtist('Old Row', { db });
    const added = await addAppearance(event.id, artist.id, { role: 'vocal' }, { db });
    // As synced or restored before T119: no `group` field at all.
    const legacy: Partial<Appearance> = { ...added };
    delete legacy.group;
    await db.appearances.put(legacy as Appearance);

    const edited = await editAppearance(added.id, { role: 'support' }, { db });
    expect(edited.role).toBe('support');
    expect(edited).not.toHaveProperty('group');
    const [summary] = await listEventSummaries(db);
    expect(summary!.knownBy).toBe('Old Row');
  });
});

describe('the Stage and the names an Event is known by', () => {
  it('places every Role, the new ones without moving the earlier ones', () => {
    expect(new Set(STAGE_ORDER).size).toBe(STAGE_ORDER.length);
    expect([...STAGE_ORDER].sort()).toEqual([...ROLES].sort());
    const earlier = STAGE_ORDER.filter((role) => !NEW_ROLES.includes(role));
    expect(earlier).toEqual([
      'vocal',
      'veena',
      'flute',
      'violin',
      'mridangam',
      'ghatam',
      'khanjira',
      'morsing',
      'other',
      'presenter',
    ]);
    const placed = (role: Role | null, position: number) => ({ role, position });
    expect(byStage(placed('nattuvangam', 2), placed('vocal', 1))).toBeLessThan(0);
    expect(byStage(placed('thavil', 1), placed(null, 2))).toBeLessThan(0);
  });

  it('knows a Dance by its dancers, a Harikatha by its presenters, a Concert by its lead', () => {
    const stage = (...roles: Role[]) => roles.map((role, i) => ({ role, position: i + 1 }));
    expect(knownBy('dance', stage('dancer', 'nattuvangam', 'vocal')).map((a) => a.role)).toEqual([
      'dancer',
    ]);
    expect(knownBy('harikatha', stage('presenter', 'violin')).map((a) => a.role)).toEqual([
      'presenter',
    ]);
    for (const lead of ['chitravina', 'nagaswaram', 'saxophone', 'mandolin'] as Role[]) {
      expect(knownBy('concert', stage(lead, 'violin', 'thavil')).map((a) => a.role)).toEqual([
        lead,
      ]);
    }
    // Vocal support is not who a Concert is known by.
    expect(knownBy('concert', stage('vocal', 'support')).map((a) => a.role)).toEqual(['vocal']);
  });

  it('shows a Group by its name, once, and each member alone by their own (T121)', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const members: Appearance[] = [];
    for (const name of ['Malladi Sreeramprasad', 'Malladi Ravikumar']) {
      const artist = await createArtist(name, { db });
      members.push(
        await addAppearance(
          event.id,
          artist.id,
          { role: 'vocal', group: 'Malladi Brothers' },
          { db },
        ),
      );
    }
    const violin = await createArtist('Pakkala Ramadas', { db });
    await addAppearance(event.id, violin.id, { role: 'violin' }, { db });
    const veena = await createArtist('Jayanthi Kumaresh', { db });
    await addAppearance(event.id, veena.id, { role: 'veena' }, { db });

    expect((await listEventSummaries(db))[0]!.knownBy).toBe('Malladi Brothers & Jayanthi Kumaresh');

    // A member removed leaves the other's group as it is, shown by their own name.
    await removeAppearance(members[0]!.id, { db });
    expect((await db.appearances.get(members[1]!.id))?.group).toBe('Malladi Brothers');
    expect((await listEventSummaries(db))[0]!.knownBy).toBe(
      'Malladi Ravikumar & Jayanthi Kumaresh',
    );
  });
});
