// The Stage after the iPhone walkthrough (S2, S4, S5): Artists listed by Role, the Artists a
// Concert is known by, and correcting an Artist's name. A rename is a data-loss path
// (constitution IV): the name must persist, the old one must stay findable, and neither an undo,
// a failure nor two renames at once may lose a name.

import { describe, expect, it } from 'vitest';
import { fold } from '../../src/catalog/fold';
import type { Role, SharedEntry } from '../../src/model';
import { SaveFeedback } from '../../src/screens/save-feedback';
import { createEvent } from '../../src/store/events';
import { holdsValue } from '../../src/store/journal-check';
import {
  addAppearance,
  createArtist,
  findArtists,
  MERGE_UNRESOLVED,
  renameArtist,
  SHARED_NAME,
} from '../../src/store/people';
import { listAppearances, listEventSummaries } from '../../src/store/queries';
import { RuleError } from '../../src/store/rules';
import { joinNames } from '../../src/store/stage';
import { freshDb, reopen } from '../helpers';

const shared = (id: string, name: string): SharedEntry => ({
  id,
  name,
  aliases: [],
  listVersion: 1,
});

describe('the Stage lists Artists by Role', () => {
  it('in kutcheri order, no Role last, ties in the order added', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const added: [string, Role | null][] = [
      ['Mridangam 1', 'mridangam'],
      ['Nobody knows', null],
      ['Violin', 'violin'],
      ['Ghatam', 'ghatam'],
      ['Singer 1', 'vocal'],
      ['Mridangam 2', 'mridangam'],
      ['Singer 2', 'vocal'],
      ['Flute', 'flute'],
    ];
    for (const [name, role] of added) {
      const artist = await createArtist(name, { db });
      await addAppearance(event.id, artist.id, { role }, { db });
    }
    const stage = await listAppearances(event.id, db);
    expect(stage.map((a) => a.artist?.name)).toEqual([
      'Singer 1',
      'Singer 2',
      'Flute',
      'Violin',
      'Mridangam 1',
      'Mridangam 2',
      'Ghatam',
      'Nobody knows',
    ]);
  });
});

describe('the Artists a Concert is known by', () => {
  async function concertWith(kind: 'concert' | 'lecdem', cast: [string, Role | null][]) {
    const db = freshDb();
    const event = await createEvent(
      { kind, ...(kind === 'lecdem' ? { title: 'Pallavi singing' } : {}) },
      { db },
    );
    for (const [name, role] of cast) {
      const artist = await createArtist(name, { db });
      await addAppearance(event.id, artist.id, { role }, { db });
    }
    const [summary] = await listEventSummaries(db);
    return summary!.knownBy;
  }

  it('are its vocal, veena or flute Artists, joined for a duo', async () => {
    expect(
      await concertWith('concert', [
        ['Akkarai Sornalatha', 'violin'],
        ['Ranjani', 'vocal'],
        ['Gayatri', 'vocal'],
      ]),
    ).toBe('Ranjani & Gayatri');
    expect(
      await concertWith('concert', [
        ['Mridangist', 'mridangam'],
        ['Jayanthi Kumaresh', 'veena'],
      ]),
    ).toBe('Jayanthi Kumaresh');
  });

  it('are the first Artist in Stage order without vocal, veena or flute', async () => {
    expect(
      await concertWith('concert', [
        ['Ghatam', 'ghatam'],
        ['Violinist', 'violin'],
      ]),
    ).toBe('Violinist');
  });

  it("are a Lecdem's presenters", async () => {
    expect(
      await concertWith('lecdem', [
        ['Singer', 'vocal'],
        ['T. M. Krishna', 'presenter'],
      ]),
    ).toBe('T. M. Krishna');
  });

  it('are nobody before any Artist', async () => {
    expect(await concertWith('concert', [])).toBeNull();
  });

  it('reads three or more as a listing does', () => {
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B & C');
  });
});

describe('renaming an Artist (S5)', () => {
  async function akkarai() {
    const db = freshDb();
    const first = await createEvent({ kind: 'concert', date: '2026-12-10' }, { db });
    const second = await createEvent({ kind: 'concert', date: '2026-12-11' }, { db });
    const artist = await createArtist('Akkarai', { db });
    await addAppearance(first.id, artist.id, { role: 'violin' }, { db });
    await addAppearance(second.id, artist.id, { role: 'violin' }, { db });
    return { db, artist, events: [first, second] };
  }

  it('shows the new name in every Concert and keeps the old one as an Alias', async () => {
    const { db, artist, events } = await akkarai();
    const renamed = await renameArtist(artist.id, '  Akkarai Subbalakshmi ', { db });
    expect(renamed).toMatchObject({
      id: artist.id,
      name: 'Akkarai Subbalakshmi',
      nameKey: fold('Akkarai Subbalakshmi'),
      aliases: ['Akkarai'],
    });

    for (const event of events) {
      const [appearance] = await listAppearances(event.id, db);
      expect(appearance?.artist?.name).toBe('Akkarai Subbalakshmi');
    }
    // Search finds the Artist by either name, once.
    expect((await findArtists('Akkarai', { db })).map((m) => m.id)).toEqual([artist.id]);
    expect((await findArtists('subbalakshmi', { db })).map((m) => m.id)).toEqual([artist.id]);
  });

  it('persists across a relaunch and is queued for the server in the same write', async () => {
    const { db, artist } = await akkarai();
    await renameArtist(artist.id, 'Akkarai Subbalakshmi', { db });
    const queued = (await db.outbox.toArray()).filter((entry) => entry.recordId === artist.id);
    expect(queued).toHaveLength(1);
    expect(queued[0]!.row).toMatchObject({ name: 'Akkarai Subbalakshmi', aliases: ['Akkarai'] });

    const again = reopen(db);
    expect(await again.artists.get(artist.id)).toMatchObject({
      name: 'Akkarai Subbalakshmi',
      aliases: ['Akkarai'],
    });
    // The journal entry for the rename is confirmed only once the store holds it.
    expect(
      await holdsValue(
        { table: 'artists', id: artist.id, field: 'name', value: 'Akkarai Subbalakshmi' },
        again,
      ),
    ).toBe(true);
    expect(
      await holdsValue(
        { table: 'artists', id: artist.id, field: 'name', value: 'Akkarai S' },
        again,
      ),
    ).toBe(false);
  });

  it('renaming back is the undo, and loses neither name', async () => {
    const { db, artist } = await akkarai();
    await renameArtist(artist.id, 'Akkarai Subbalakshmi', { db });
    const back = await renameArtist(artist.id, 'Akkarai', { db });
    expect(back).toMatchObject({ name: 'Akkarai', aliases: ['Akkarai Subbalakshmi'] });
  });

  it('a retry of the same name changes nothing', async () => {
    const { db, artist } = await akkarai();
    const first = await renameArtist(artist.id, 'Akkarai Subbalakshmi', { db });
    const retried = await renameArtist(artist.id, 'Akkarai Subbalakshmi', { db });
    expect(retried).toEqual(first);
  });

  it('a change of case only keeps no Alias search could not tell apart', async () => {
    const db = freshDb();
    const artist = await createArtist('akkarai subbalakshmi', { db });
    expect(await renameArtist(artist.id, 'Akkarai Subbalakshmi', { db })).toMatchObject({
      name: 'Akkarai Subbalakshmi',
      aliases: [],
    });
  });

  it('a failed write leaves the name as it was', async () => {
    const { db, artist } = await akkarai();
    const before = await db.artists.get(artist.id);
    const outbox = await db.outbox.toArray();
    const fail = () => {
      throw new Error('disk full');
    };
    db.outbox.hook('creating', fail);
    db.outbox.hook('updating', fail);
    await expect(renameArtist(artist.id, 'Akkarai Subbalakshmi', { db })).rejects.toThrow(
      'disk full',
    );
    db.outbox.hook('creating').unsubscribe(fail);
    db.outbox.hook('updating').unsubscribe(fail);
    expect(await db.artists.get(artist.id)).toEqual(before);
    expect(await db.outbox.toArray()).toEqual(outbox);
  });

  it('two renames at once keep every name', async () => {
    const { db, artist } = await akkarai();
    await Promise.all([
      renameArtist(artist.id, 'Akkarai Subbalakshmi', { db }),
      renameArtist(artist.id, 'Akkarai S. Subbalakshmi', { db }),
    ]);
    const stored = (await db.artists.get(artist.id))!;
    const names = [stored.name, ...stored.aliases].sort();
    expect(names).toEqual(['Akkarai', 'Akkarai S. Subbalakshmi', 'Akkarai Subbalakshmi']);
  });

  it('a rename from a screen out of date keeps the name it did not see', async () => {
    const { db, artist } = await akkarai();
    // Another write renamed the Artist after the sheet was opened on "Akkarai".
    await renameArtist(artist.id, 'Akkarai Sisters', { db });
    const stored = await renameArtist(artist.id, 'Akkarai Subbalakshmi', { db });
    expect(stored.aliases).toEqual(['Akkarai', 'Akkarai Sisters']);
  });

  it('renames the Artist a merged-away one leads to', async () => {
    const db = freshDb();
    const survivor = await createArtist('Akkarai Subbalakshmi', { db });
    const merged = await createArtist('Akarai', { db });
    await db.artists.update(merged.id, { mergedIntoId: survivor.id });
    await renameArtist(merged.id, 'Akkarai S. Subbalakshmi', { db });
    expect(await db.artists.get(survivor.id)).toMatchObject({
      name: 'Akkarai S. Subbalakshmi',
      aliases: ['Akkarai Subbalakshmi'],
    });
    expect((await db.artists.get(merged.id))!.name).toBe('Akarai');
    // The journal checks the rename where it was written, so its entry leaves.
    const entered = { table: 'artists', id: merged.id, field: 'name' } as const;
    expect(await holdsValue({ ...entered, value: 'Akkarai S. Subbalakshmi' }, db)).toBe(true);
    expect(await holdsValue({ ...entered, value: 'Akarai' }, db)).toBe(false);
  });

  it('refuses a merge chain it cannot follow, and renames nothing', async () => {
    const db = freshDb();
    const a = await createArtist('Akkarai', { db });
    const b = await createArtist('Akarai', { db });
    await db.artists.update(a.id, { mergedIntoId: b.id });
    await db.artists.update(b.id, { mergedIntoId: a.id });
    const outbox = await db.outbox.count();
    await expect(renameArtist(a.id, 'Akkarai Subbalakshmi', { db })).rejects.toThrow(
      MERGE_UNRESOLVED,
    );
    expect((await db.artists.bulkGet([a.id, b.id])).map((x) => x!.name)).toEqual([
      'Akkarai',
      'Akarai',
    ]);
    expect(await db.outbox.count()).toBe(outbox);
  });

  it('a rename that fails stays journalled as entered, and Try again renames', async () => {
    const { db, artist } = await akkarai();
    const disk = { failing: true };
    const fail = () => {
      if (disk.failing) throw new Error('disk full');
    };
    db.outbox.hook('creating', fail);
    db.outbox.hook('updating', fail);
    const feedback = new SaveFeedback({ storage: null, confirm: (e) => holdsValue(e, db) });
    const target = { table: 'artists', id: artist.id, field: 'name' } as const;
    const rename = (name: string) => () => renameArtist(artist.id, name, { db });

    // Typed, then left: the screen holds the text, then writes it (EventScreen's ArtistName).
    feedback.hold(target, 'Akkarai Subbalakshmi');
    expect(feedback.notSaved()).toEqual([
      expect.objectContaining({ ...target, value: 'Akkarai Subbalakshmi' }),
    ]);
    await feedback.track(target, 'Akkarai Subbalakshmi', rename('Akkarai Subbalakshmi'));
    expect(feedback.get(target)?.status).toBe('failed');
    expect(feedback.shown(target, 'Akkarai')).toBe('Akkarai Subbalakshmi');
    expect((await db.artists.get(artist.id))!.name).toBe('Akkarai');

    disk.failing = false;
    await feedback.retry(target);
    expect(feedback.get(target)?.status).toBe('saved');
    expect(await db.artists.get(artist.id)).toMatchObject({
      name: 'Akkarai Subbalakshmi',
      aliases: ['Akkarai'],
    });
  });

  it('refuses a shared Artist, a promoted one, a deleted one and an empty name', async () => {
    const db = freshDb();
    await db.sharedArtists.put(shared('s-tmk', 'T. M. Krishna'));
    await expect(renameArtist('s-tmk', 'TMK', { db })).rejects.toThrow(SHARED_NAME);

    const promoted = await createArtist('TM Krishna', { db });
    await db.links.put({ id: 'l1', ownTable: 'artist', ownId: promoted.id, sharedId: 's-tmk' });
    await expect(renameArtist(promoted.id, 'TMK', { db })).rejects.toThrow(SHARED_NAME);
    expect((await db.artists.get(promoted.id))!.name).toBe('TM Krishna');

    const own = await createArtist('Ranjani', { db });
    await expect(renameArtist(own.id, '  ', { db })).rejects.toThrow(RuleError);
    await db.artists.update(own.id, { deletedAt: new Date().toISOString() });
    await expect(renameArtist(own.id, 'Ranjani G', { db })).rejects.toThrow(RuleError);
  });
});
