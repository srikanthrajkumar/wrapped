// Catalog search over the handmade snapshot: a song's title aliases are search terms only
// (contracts/catalog-snapshot.md), so an alias finds the song and the song keeps its title.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeSnapshot } from '../../src/catalog/load';
import { buildIndex, type SearchResult } from '../../src/catalog/search';

const catalog = decodeSnapshot(
  JSON.parse(readFileSync(join(import.meta.dirname, '../fixtures/catalog-v1.json'), 'utf8')),
);
const index = buildIndex(catalog);

const songIds = (results: SearchResult[]) =>
  results.flatMap((result) => (result.kind === 'song' ? [result.song.kritiId] : []));

describe('catalog search', () => {
  it('finds a song by a title alias and shows its own title', () => {
    const results = index.search('murare');
    expect(songIds(results)).toEqual(['c0017']);
    const [found] = results;
    expect(found?.kind === 'song' && found.song.title).toBe('Sarasijanabha');
  });

  it('finds a title alias spelled another way, or typed without its spaces', () => {
    expect(songIds(index.search('cudare celulara'))).toContain('c0008');
    expect(songIds(index.search('kaddanuvariki'))).toContain('c0021');
    expect(songIds(index.search('vathapi ganapathim')).at(0)).toBe('c0002');
  });

  it('still finds songs by title, raga and composer', () => {
    expect(songIds(index.search('nagumomu'))).toContain('c0001');
    expect(songIds(index.search('thyagaraja abheri'))).toContain('c0001');
    const raga = index.search('thodi').find((result) => result.kind === 'raga');
    expect(raga?.kind === 'raga' && raga.raga.key).toBe('Todi');
  });

  it('answers each keystroke as a fresh search would, as the rasika types and corrects', () => {
    const typed = buildIndex(catalog);
    const ids = (results: SearchResult[]) =>
      results.map((r) => (r.kind === 'song' ? r.song.kritiId : `raga:${r.raga.key}`));
    // What a fresh index answers, built once per distinct query: backspacing and the shared
    // "kalyani" tail repeat many.
    const answers = new Map<string, string[]>();
    const fresh = (query: string) => {
      if (!answers.has(query)) answers.set(query, ids(buildIndex(catalog).search(query, 100)));
      return answers.get(query)!;
    };
    // Words crossing the four-to-five letter line, extra words, a single-letter word that
    // switches to unordered matching, and backspacing.
    const sessions = [
      'nagumomu ganaleni',
      'kamavardani',
      'tyagaraja abheri adi',
      'enduku pedala',
      'venkatachalanilayam',
      'a sarasija',
      'sarasija a',
      'talli ninnu nera',
      // A repeated word, and a long query corrected letter by letter.
      'kamakshi kamakshi',
      'meenakshi me mudam dehi',
    ];
    for (const session of sessions) {
      const keystrokes = [...session].map((_, i) => session.slice(0, i + 1));
      keystrokes.push(...keystrokes.slice(0, -1).reverse(), 'kalyani', 'kalyan', 'kaly');
      for (const query of keystrokes) {
        expect(ids(typed.search(query, 100)), query).toEqual(fresh(query));
      }
    }
    // Hundreds of fresh indexes are built, so the default 5 s is too tight on a loaded machine.
    // Measured 2026-11-02 with the answers cached: 2.6 to 10.3 s on a 2-vCPU host at load
    // average 13 to 17.
  }, 30_000);
});
