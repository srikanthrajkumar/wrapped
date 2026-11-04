// The UI hill-climb's fixed dataset (SEED.md), written through the app's own store actions in
// the real page, as the e2e tests do (e2e/harness). Runs once per browser profile, after first
// launch, with the clock fixed at SEASON_NOW so the Concert in progress holds Now.

import type { Page } from '@playwright/test';
import type { Harness } from '../harness/entry';

/** Mon 14 Dec 2026, 7:30 pm in Chennai: the middle of the season, mid-Concert. */
export const SEASON_NOW = new Date('2026-12-14T19:30:00+05:30');

export interface SeedIds {
  /** In progress: a vocal duo, four accompanists, every Colour state, 11 Items. */
  full: string;
  /** Attended yesterday: long Sabha and Artist names that wrap. */
  long: string;
  /** Attended, with no Artist and no Sabha yet. */
  bare: string;
  /** The Item with the Laya vinyasam and its note, in `full`. */
  laya: string;
  /** An Item with two Ragas, in `full`. */
  rtp: string;
}

export function seed(page: Page, catalogFile: string): Promise<SeedIds> {
  return page.evaluate(async (catalogFile) => {
    const { events, items, people, model, decodeSnapshot } = (
      globalThis as unknown as { harness: Harness }
    ).harness;
    const catalog = decodeSnapshot(await (await fetch(`/catalog/${catalogFile}`)).json());
    const song = (title: string) => {
      const found = catalog.songs.find((s) => s.title === title);
      if (!found) throw new Error(`no song titled ${title}`);
      return found;
    };
    const options = { catalog };
    const { catalogValue } = model;

    const academy = await people.createSabha('Music Academy');
    const narada = await people.createSabha('Narada Gana Sabha');
    const krishna = await people.createSabha('Sri Krishna Gana Sabha');
    const parthasarathy = await people.createSabha(
      'Sri Parthasarathy Swami Sabha, Vidya Bharathi Kalyana Mandapam',
    );

    type Seat = readonly [string, string, string | null, string | null];
    const stage = async (eventId: string, seats: readonly Seat[]) => {
      for (const [name, role, colourPrimary, colourSecondary] of seats) {
        const artist = await people.createArtist(name);
        await people.addAppearance(eventId, artist.id, {
          role: role as never,
          colourPrimary: colourPrimary as never,
          colourSecondary: colourSecondary as never,
        });
      }
    };
    const songItem = async (eventId: string, title: string) => {
      const item = await items.addItem(eventId);
      return items.repickItem(item.id, { kind: 'song', song: song(title) }, options);
    };

    // Planned, for Next: tomorrow and the day after.
    const next1 = await events.createEvent({
      kind: 'concert',
      date: '2026-12-15',
      startTime: '16:00',
      sabhaId: krishna.id,
      source: 'plan',
    });
    await stage(next1.id, [['T M Krishna', 'vocal', null, null]]);
    const next2 = await events.createEvent({
      kind: 'concert',
      date: '2026-12-16',
      startTime: '18:30',
      sabhaId: narada.id,
      source: 'plan',
    });
    await stage(next2.id, [['Jayanthi Kumaresh', 'veena', null, null]]);

    // Attended, with no Artist and no Sabha yet.
    const bare = await events.createEvent({
      kind: 'concert',
      date: '2026-12-12',
      startTime: '10:00',
    });

    // Attended yesterday: names long enough to wrap.
    const long = await events.createEvent({
      kind: 'concert',
      date: '2026-12-13',
      startTime: '18:45',
      sabhaId: parthasarathy.id,
    });
    await stage(long.id, [
      ['Thiruvarur Bhaktavatsalam Nagarajan Subramaniam', 'vocal', 'brown', 'pink'],
      ['Mysore Manjunath Nagaraj Venkataramanan', 'violin', 'purple', null],
      ['Umayalpuram Kasiviswanatha Sivaraman', 'mridangam', 'grey', null],
    ]);
    await songItem(long.id, 'Brochevarevarura');
    await songItem(long.id, 'Rama Bhaktanai Ninandidu');
    await items.addItem(long.id, { title: 'A long viruttam in four ragas before the main piece' });

    // In progress: a vocal duo and four accompanists, every Colour state, 11 Items.
    const full = await events.createEvent({
      kind: 'concert',
      startTime: '18:00',
      sabhaId: academy.id,
    });
    await stage(full.id, [
      ['Ranjani', 'vocal', 'red', 'white'],
      ['Gayatri', 'vocal', 'blue', 'orange'],
      ['Embar S Kannan', 'violin', 'yellow', null],
      ['Sai Giridhar', 'mridangam', 'black', null],
      ['S Krishna', 'ghatam', 'green', 'beige'],
      ['Anirudh Athreya', 'khanjira', 'unknown', null],
    ]);
    await events.editEvent(full.id, {
      note: 'Packed hall; the thani after Chakkani Raja was the highlight.',
    });
    await songItem(full.id, 'Sarasiruha Lochanim');
    await songItem(full.id, 'Vatapi');
    const nagumomu = await songItem(full.id, 'Nagumomu Ganaleni');
    await items.setDetail(nagumomu.id, 'tala', { ...nagumomu.tala, guess: true }, options);
    await songItem(full.id, 'Endaro Mahanubhavu');
    await songItem(full.id, 'Kapaliye Karunaikkadale');
    const laya = await songItem(full.id, 'Chakkani Raja');
    await items.setLayaNadai(laya.id, model.notApplicableValue());
    await items.setLayaNote(laya.id, 'Khanda nadai korvai; the khanjira took the last round.');
    await songItem(full.id, 'Kaddanuvariki');
    await songItem(full.id, 'Paluke Bangaramayena');
    const rtp = await items.addRtp(full.id);
    await items.setRagas(
      rtp.id,
      ['Kalyani', 'Kanada'].map((name) => {
        const raga = catalog.ragas.find((r) => r.display === name);
        if (!raga) throw new Error(`no raga ${name}`);
        return catalogValue(raga.key, raga.display);
      }),
      options,
    );
    await songItem(full.id, 'Entha Balavantano');
    await items.addItem(full.id, { title: 'Tillana' });

    return { full: full.id, long: long.id, bare: bare.id, laya: laya.id, rtp: rtp.id };
  }, catalogFile);
}
