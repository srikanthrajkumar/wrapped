// The 2024-25 import's rules (T045), on the handmade v1 snapshot: the four outcomes, the logged
// Raga and Composer used only to choose among songs of one title, Overrides where the sheet
// differs from the catalog, and the sheet's ways of writing tala, Nadai and "nothing applies".

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeSnapshot } from '../../app/src/catalog/load';
import { buildMatcher, type KeptForm } from '../../app/src/catalog/match';
import {
  convertConcert,
  convertItem,
  isoDate,
  People,
  splitTala,
  stableId,
  type Row,
} from './convert';

const root = join(import.meta.dirname, '../..');
const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const catalog = decodeSnapshot(read('app/tests/fixtures/catalog-v1.json'));
const keptForms = read('app/src/reference/forms.json') as KeptForm[];
const matcher = buildMatcher(catalog, keptForms);
const ctx = { catalog, matcher, keptForms, eventIdFor: (n: number) => `event-${n}` };

// Sl No., ID No., Composition, Raga, Tala, Composer, Language, Topic.
const item = (row: Row) => convertItem(row, 1, ctx);

describe('2024-25 import', () => {
  it('matches a title to its one song, keeping what the sheet logged', () => {
    const { outcome, item: imported } = item([
      1,
      3,
      'Enduku Peddala',
      'Todi',
      'Adi',
      'Thyagaraja',
      'Telugu',
      'Rama',
    ]);
    expect(outcome).toBe('composition');
    expect(imported.compositionKey).toBe('c0005');
    // The catalog says Sankarabharanam; the sheet's Todi is an Override.
    expect(imported.ragas).toEqual([
      { state: 'override', key: 'Todi', text: 'Todi', guess: false },
    ]);
    expect(imported.composer).toMatchObject({ state: 'catalog', key: 'tyaagaraaja' });
    expect(imported.eventId).toBe('event-3');
  });

  it('matches a title alias', () => {
    const { outcome, item: imported } = item([
      2,
      1,
      'Cudare Celulara',
      'Kamavardhini',
      'Misra Chapu',
      'Tyagaraja',
      'Telugu',
      'Krishna',
    ]);
    expect(outcome).toBe('composition');
    expect(imported.compositionKey).toBe('c0008');
  });

  it('uses the logged Raga only to choose among songs of one title', () => {
    // Kamakshi is both a song (c0004, Bhairavi) and, in this test, a second one in Todi.
    const doubled = decodeSnapshot(read('app/tests/fixtures/catalog-v1.json'));
    const second = {
      ...doubled.songByKritiId.get('c0004')!,
      kritiId: 'c9004',
      raga: doubled.ragaByKey.get('Todi')!,
    };
    doubled.songs.push(second);
    const twoKamakshis = { ...ctx, matcher: buildMatcher(doubled, keptForms) };
    const row = (raga: string): Row => [
      3,
      1,
      'Kamakshi',
      raga,
      'Misra Chapu',
      '?',
      'Sanskrit',
      'Devi',
    ];

    expect(convertItem(row('Todi'), 1, twoKamakshis).item.compositionKey).toBe('c9004');
    expect(convertItem(row('Bhairavi'), 1, twoKamakshis).item.compositionKey).toBe('c0004');
    const neither = convertItem(row('Kalyani'), 1, twoKamakshis);
    expect(neither.outcome).toBe('unresolved');
    expect(neither.why).toMatch(/2 songs have this title/);
  });

  it('counts an RTP as a special form, with its Ragas in order', () => {
    const { outcome, item: imported } = item([
      6,
      1,
      'RTP',
      'Todi + Kalyani',
      'Adi (Tishra Gati)',
      '?',
      'Tamil ',
      '?',
    ]);
    expect(outcome).toBe('special');
    expect(imported.compositionKey).toBeNull();
    expect(imported.form.key).toBe('rtp');
    expect(imported.ragas.map((raga) => raga.key)).toEqual(['Todi', 'Kalyani']);
    expect(imported.tala.key).toBe('adi');
    expect(imported.nadai).toMatchObject({ key: 'tisra', text: 'Tishra' });
    expect(imported.composer.state).toBe('unknown');
  });

  it('counts a "?" title as Unknown, and an unmatched one as Unresolved with its text', () => {
    expect(item([67, 12, '?', 'Sindhubhairavi', 'Adi', '?', '?', '?']).outcome).toBe('unknown');
    const typed = item([13, 2, 'Swaralahari', 'Vasanti', 'Adi', 'A Kanyakumari', 'None', 'None']);
    expect(typed.outcome).toBe('unresolved');
    expect(typed.item).toMatchObject({
      title: 'Swaralahari',
      ragas: [{ state: 'unresolved', text: 'Vasanti' }],
      language: { state: 'na' },
      subject: { state: 'na' },
    });
  });

  it('keeps a title marked (?) as a note', () => {
    const marked = item([47, 8, 'Nagumomu (?)', 'Abheri', 'Adi', 'Tyagaraja', 'Telugu', 'Rama']);
    expect(marked.item).toMatchObject({ title: 'Nagumomu', compositionKey: 'c0001' });
    expect(marked.item.note).toMatch(/\(\?\)/);
  });

  it("reads the sheet's tala, Nadai and dates", () => {
    expect(splitTala('Adi (Tishra Gati)').nadai.key).toBe('tisra');
    expect(splitTala('Chaturshra Jati Triputa (Khanda Gati)')).toMatchObject({
      tala: 'Chaturshra Jati Triputa',
      nadai: { key: 'khanda' },
    });
    expect(splitTala('Misra Chapu')).toMatchObject({ tala: 'Misra Chapu', nadai: { state: 'na' } });
    expect(isoDate('23/12/2024')).toBe('2024-12-23');
    expect(stableId('item:1')).toBe(stableId('item:1'));
    expect(stableId('item:1')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('turns a Main row into a Concert with the stage in column order and its Colours', () => {
    const people = new People({
      artists: [{ id: 'shared-sai', name: 'K Sai Giridhar', aliases: [], listVersion: 1 }],
      sabhas: [{ id: 'shared-academy', name: 'Music Academy', aliases: [], listVersion: 1 }],
    });
    const main: Row = [
      1,
      null,
      'Akkarai Subbalakshmi',
      'Akkarai Sornalatha',
      null,
      'K Sai Giridhar',
      'B Shreesunderkumar',
      null,
      null,
      'Music Academy',
    ];
    const colours: Row = [1, 'Yellow', 'Orange', null, 'Pink', 'Teal', null, null, 'Music Academy'];
    const { event, appearances } = convertConcert(main, colours, people, 'e1');

    expect(event).toMatchObject({ kind: 'concert', sabhaId: 'shared-academy', status: 'attended' });
    expect(appearances.map((a) => [a.position, a.role, a.colourPrimary])).toEqual([
      [1, null, 'yellow'],
      [2, null, 'orange'],
      [3, 'mridangam', 'pink'],
      [4, 'khanjira', 'unknown'],
    ]);
    expect(appearances[2]!.artistId).toBe('shared-sai');
    expect(people.artists.size).toBe(3);
  });
});
