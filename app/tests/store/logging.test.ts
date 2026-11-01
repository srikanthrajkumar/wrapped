// The logging actions of User Story 1 (T036 to T039): Events, Artists and Sabhas, Appearances,
// and Items with their Details, against the v1 handmade snapshot.

import { describe, expect, it } from 'vitest';
import { fold } from '../../src/catalog/fold';
import {
  catalogValue,
  notApplicableValue,
  unknownValue,
  unresolvedValue,
  type SharedEntry,
} from '../../src/model';
import { createEvent, deleteEvent, editEvent, setStatus, today } from '../../src/store/events';
import {
  addItem,
  addRtp,
  pickComposition,
  setDetail,
  setImprovised,
  setLayaVinyasam,
  setRagas,
} from '../../src/store/items';
import {
  addAppearance,
  createArtist,
  createSabha,
  editAppearance,
  findArtists,
  findSabhas,
} from '../../src/store/people';
import { listAppearances, listItems } from '../../src/store/queries';
import { RuleError } from '../../src/store/rules';
import { fixtureCatalog, freshDb } from '../helpers';

const v1 = fixtureCatalog('catalog-v1.json');
const song = (id: string) => v1.songByKritiId.get(id)!;

describe('Events', () => {
  it('starts a spot Concert today, Attended and touched', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    expect(event).toMatchObject({
      date: today(),
      status: 'attended',
      source: 'spot',
      touched: true,
      title: null,
    });
    expect(await db.outbox.count()).toBe(1);
  });

  it('reads today from the phone clock, not UTC', () => {
    // 1 a.m. on 15 December in the phone's own time zone.
    expect(today(new Date(2026, 11, 15, 1, 0))).toBe('2026-12-15');
  });

  it('needs a title for a Lecdem and none for a Concert', async () => {
    const db = freshDb();
    await expect(createEvent({ kind: 'lecdem' }, { db })).rejects.toThrow(RuleError);
    await expect(createEvent({ kind: 'concert', title: 'x' }, { db })).rejects.toThrow(RuleError);
    const lecdem = await createEvent({ kind: 'lecdem', title: ' Ragas of Dikshitar ' }, { db });
    expect(lecdem.title).toBe('Ragas of Dikshitar');
    expect(await db.outbox.count()).toBe(1);
  });

  it('marks a planned Event touched on edit, and moves only along the allowed transitions', async () => {
    const db = freshDb();
    const planned = await createEvent({ kind: 'concert', source: 'plan' }, { db });
    expect(planned).toMatchObject({ status: 'planned', touched: false });

    const edited = await editEvent(planned.id, { startTime: '18:30' }, { db });
    expect(edited).toMatchObject({ status: 'planned', touched: true, startTime: '18:30' });

    await expect(setStatus(planned.id, 'planned', { db })).rejects.toThrow(RuleError);
    expect((await setStatus(planned.id, 'missed', { db })).status).toBe('missed');
    await expect(setStatus(planned.id, 'attended', { db })).rejects.toThrow(RuleError);
    expect((await setStatus(planned.id, 'planned', { db })).status).toBe('planned');
    expect((await setStatus(planned.id, 'attended', { db })).status).toBe('attended');
    expect((await setStatus(planned.id, 'planned', { db })).status).toBe('planned');
  });

  it('starting to log a Schedule Event marks it touched', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert', source: 'schedule' }, { db });
    expect(event.touched).toBe(false);
    expect(await setStatus(event.id, 'attended', { db })).toMatchObject({ touched: true });
  });

  it('deletes an Event with its Appearances and Items, as tombstones', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const artist = await createArtist('T M Krishna', { db });
    await addAppearance(event.id, artist.id, { role: 'vocal' }, { db });
    await addItem(event.id, { title: 'Varnam' }, { db });

    await deleteEvent(event.id, { db });

    expect(await listItems(event.id, db)).toEqual([]);
    expect(await listAppearances(event.id, db)).toEqual([]);
    const removed = (await db.outbox.toArray()).filter((entry) => entry.op === 'remove');
    expect(removed.map((entry) => entry.table).sort()).toEqual(['appearances', 'events', 'items']);
    await expect(addItem(event.id, {}, { db })).rejects.toThrow(RuleError);
  });
});

describe('Artists, Sabhas and Appearances', () => {
  const shared = (id: string, name: string, aliases: string[] = []): SharedEntry => ({
    id,
    name,
    aliases,
    listVersion: 1,
  });

  it('finds own and shared names by their fold and Aliases, closest first', async () => {
    const db = freshDb();
    await db.sharedArtists.bulkPut([
      shared('s-sanjay', 'Sanjay Subrahmanyan', ['Sanjay Subramanian']),
      shared('s-akkarai', 'Akkarai Subhalakshmi'),
    ]);
    const own = await createArtist('Subhashree Thanikachalam', { db });
    expect(own.nameKey).toBe(fold('Subhashree Thanikachalam'));

    const found = await findArtists('subha', { db });
    expect(found.map((match) => match.name)).toEqual([
      'Subhashree Thanikachalam',
      'Akkarai Subhalakshmi',
    ]);
    expect((await findArtists('Subramanian', { db })).map((m) => m.id)).toEqual(['s-sanjay']);
    expect(await findArtists('', { db })).toEqual([]);
  });

  it('offers an own entry the Maintainer promoted once, as the shared one', async () => {
    const db = freshDb();
    await db.sharedSabhas.put(shared('s-academy', 'Music Academy', ['Madras Music Academy']));
    const own = await createSabha('The Music Academy', { db });
    await db.links.put({ id: 'l1', ownTable: 'sabha', ownId: own.id, sharedId: 's-academy' });

    const found = await findSabhas('academy', { db });
    expect(found).toEqual([
      { id: 's-academy', name: 'Music Academy', aliases: ['Madras Music Academy'], shared: true },
    ]);
  });

  it('gives a previously logged Artist a new Appearance, not a new Artist', async () => {
    const db = freshDb();
    const first = await createEvent({ kind: 'concert', date: '2026-12-10' }, { db });
    const second = await createEvent({ kind: 'concert', date: '2026-12-11' }, { db });
    const artist = await createArtist('Ranjani', { db });
    await addAppearance(first.id, artist.id, { role: 'vocal' }, { db });

    const [match] = await findArtists('ranj', { db });
    await addAppearance(second.id, match!.id, { role: 'vocal', colourPrimary: 'red' }, { db });

    expect(await db.artists.count()).toBe(1);
    const [appearance] = await listAppearances(second.id, db);
    expect(appearance).toMatchObject({ artistId: artist.id, colourPrimary: 'red', position: 1 });
    expect(appearance?.artist?.name).toBe('Ranjani');
  });

  it('keeps billing order, Roles and Colours, and checks the Colours', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const names = ['Vocalist', 'Violinist', 'Mridangist'];
    const artists = await Promise.all(names.map((name) => createArtist(name, { db })));
    await addAppearance(event.id, artists[0]!.id, { role: 'vocal' }, { db });
    const violin = await addAppearance(event.id, artists[1]!.id, {}, { db });
    await addAppearance(event.id, artists[2]!.id, { role: 'mridangam' }, { db });

    // Colours can be set later, at any time.
    await editAppearance(
      violin.id,
      { role: 'violin', colourPrimary: 'blue', colourSecondary: 'white' },
      { db },
    );
    await expect(
      editAppearance(violin.id, { colourPrimary: 'unknown', colourSecondary: 'white' }, { db }),
    ).rejects.toThrow(RuleError);

    const listed = await listAppearances(event.id, db);
    expect(listed.map((a) => [a.position, a.role, a.colourPrimary, a.colourSecondary])).toEqual([
      [1, 'vocal', null, null],
      [2, 'violin', 'blue', 'white'],
      [3, 'mridangam', null, null],
    ]);
  });

  it('allows at most three presenters at a Lecdem', async () => {
    const db = freshDb();
    const lecdem = await createEvent({ kind: 'lecdem', title: 'Pallavi singing' }, { db });
    for (const name of ['A', 'B', 'C']) {
      const artist = await createArtist(name, { db });
      await addAppearance(lecdem.id, artist.id, { role: 'presenter' }, { db });
    }
    const fourth = await createArtist('D', { db });
    await expect(
      addAppearance(lecdem.id, fourth.id, { role: 'presenter' }, { db }),
    ).rejects.toThrow(RuleError);
    // As an accompanist, a fourth Artist is fine.
    await addAppearance(lecdem.id, fourth.id, { role: 'violin' }, { db });
  });
});

describe('Items', () => {
  async function concertWithItem() {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const item = await addItem(event.id, {}, { db });
    return { db, event, item };
  }

  it('adds Items at the end of the running order, with no Composition', async () => {
    const { db, event, item } = await concertWithItem();
    const second = await addItem(event.id, { title: 'Thani' }, { db });
    expect([item.position, second.position]).toEqual([1, 2]);
    expect(second).toMatchObject({
      compositionKey: null,
      ragas: [],
      tala: unknownValue(),
      nadai: notApplicableValue(),
    });
  });

  it('fills in a picked Composition as catalog values', async () => {
    const { db, item } = await concertWithItem();
    const picked = await pickComposition(item.id, song('c0004'), { db });
    expect(picked).toMatchObject({
      compositionKey: 'c0004',
      title: 'Kamakshi',
      form: catalogValue('kriti', 'kriti'),
      ragas: [catalogValue('Bhairavi', 'Bhairavi')],
      tala: catalogValue('misra chapu', 'Misra Chapu'),
      composer: catalogValue('shyaama shaastri', 'Syama Sastri'),
      language: catalogValue('Sanskrit', 'Sanskrit'),
      subject: catalogValue('Kamakshi', 'Kamakshi'),
    });
    // A song the catalog knows less of: no composer, so "?".
    const thillana = await pickComposition(item.id, song('c0015'), { db });
    expect(thillana.composer).toEqual(unknownValue());
  });

  it('makes a changed Detail an Override, with no confirmation, and back again', async () => {
    const { db, item } = await concertWithItem();
    await pickComposition(item.id, song('c0004'), { db });
    const options = { db, catalog: v1 };

    // Sung in Todi, not the catalog's Bhairavi (US1 scenario 3).
    const todi = await setRagas(item.id, [catalogValue('Todi', 'Todi')], options);
    expect(todi.ragas).toEqual([{ state: 'override', key: 'Todi', text: 'Todi', guess: false }]);
    const back = await setRagas(item.id, [catalogValue('Bhairavi', 'Bhairavi')], options);
    expect(back.ragas[0]?.state).toBe('catalog');

    const tala = await setDetail(item.id, 'tala', catalogValue('adi', 'Adi'), options);
    expect(tala.tala.state).toBe('override');
    const nadai = await setDetail(item.id, 'nadai', catalogValue('khanda', 'khanda'), options);
    expect(nadai.nadai).toMatchObject({ state: 'override', key: 'khanda' });
  });

  it('keeps "?", Not applicable, a Guess and free text exactly as entered', async () => {
    const { db, item } = await concertWithItem();
    await pickComposition(item.id, song('c0004'), { db });
    const options = { db, catalog: v1 };

    await setDetail(item.id, 'composer', unknownValue(), options);
    await setDetail(item.id, 'subject', notApplicableValue(), options);
    await setDetail(item.id, 'language', unresolvedValue('Sourashtra'), options);
    await setDetail(
      item.id,
      'tala',
      { ...catalogValue('misra chapu', 'Misra Chapu'), guess: true },
      options,
    );

    const stored = (await db.items.get(item.id))!;
    expect(stored.composer).toEqual(unknownValue());
    expect(stored.subject).toEqual(notApplicableValue());
    expect(stored.language).toEqual(unresolvedValue('Sourashtra'));
    expect(stored.tala).toEqual({
      state: 'catalog',
      key: 'misra chapu',
      text: 'Misra Chapu',
      guess: true,
    });
    await expect(
      setDetail(item.id, 'tala', { ...unknownValue(), guess: true }, options),
    ).rejects.toThrow(RuleError);
  });

  it('keeps several Ragas in order', async () => {
    const { db, item } = await concertWithItem();
    const ragamalika = await pickComposition(item.id, song('c0016'), { db });
    expect(ragamalika.ragas.map((raga) => raga.key)).toEqual(['Saveri', 'Mohanam', 'Kalyani']);
    const reordered = await setRagas(
      item.id,
      [ragamalika.ragas[2]!, ragamalika.ragas[0]!, unresolvedValue('Behag')],
      { db, catalog: v1 },
    );
    expect(reordered.ragas.map((raga) => [raga.state, raga.text])).toEqual([
      ['override', 'Kalyani'],
      ['override', 'Saveri'],
      ['unresolved', 'Behag'],
    ]);
  });

  it('logs an RTP: no Composition, Ragas in order, tala and Nadai, Composer Not applicable', async () => {
    const { db, event } = await concertWithItem();
    const rtp = await addRtp(event.id, { db });
    expect(rtp).toMatchObject({
      compositionKey: null,
      form: { key: 'rtp' },
      ragas: [unknownValue()],
      nadai: unknownValue(),
      composer: notApplicableValue(),
    });
    const options = { db, catalog: v1 };
    await setRagas(
      rtp.id,
      [catalogValue('Todi', 'Todi'), catalogValue('Kalyani', 'Kalyani')],
      options,
    );
    await setDetail(rtp.id, 'tala', catalogValue('adi', 'Adi'), options);
    await setDetail(rtp.id, 'nadai', catalogValue('tisra', 'tisra'), options);
    // Whoever wrote the pallavi counts as a Composer like any other (FR-041).
    const filled = await setDetail(
      rtp.id,
      'composer',
      catalogValue('tyaagaraaja', 'Tyagaraja'),
      options,
    );
    expect(filled.composer.state).toBe('catalog');
    expect(filled.ragas.map((raga) => raga.key)).toEqual(['Todi', 'Kalyani']);

    await expect(setRagas(rtp.id, [], options)).rejects.toThrow(RuleError);
    await expect(
      setDetail(rtp.id, 'nadai', catalogValue('sixfold', 'sixfold'), options),
    ).rejects.toThrow(RuleError);
  });

  it('records a Laya vinyasam on the Item it followed, and improvised Details in concert order', async () => {
    const { db, item } = await concertWithItem();
    await pickComposition(item.id, song('c0001'), { db });
    const laya = await setLayaVinyasam(
      item.id,
      { nadai: catalogValue('khanda', 'khanda'), note: 'with ghatam' },
      { db },
    );
    expect(laya.layaVinyasam).toEqual({
      nadai: catalogValue('khanda', 'khanda'),
      note: 'with ghatam',
    });

    const heard = await setImprovised(
      item.id,
      [
        { kind: 'kalpana_swaram', raga: null },
        { kind: 'alapana', raga: null },
        { kind: 'niraval', raga: catalogValue('Kalyani', 'Kalyani') },
      ],
      { db },
    );
    expect(heard.improvised.map((detail) => detail.kind)).toEqual([
      'alapana',
      'niraval',
      'kalpana_swaram',
    ]);
  });
});
