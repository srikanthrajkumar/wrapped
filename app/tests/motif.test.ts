// The motif (DESIGN.md "The motif"): the same seed always draws the same mark, different seeds
// draw different ones, and a mark names only theme tones, each defined in both themes.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Catalog, Raga } from '../src/catalog/load';
import { ragaSeeds } from '../src/motif/ragas';
import { motifParams, TONES, type MotifSeed } from '../src/motif/seed';

const kalyani = { key: 'kalyANi', mela: 65 };
const todi = { key: 'tODi', mela: 8 };
const begada = { key: 'bEgaDa', mela: 29 };

const SEEDS: MotifSeed[] = [
  { kind: 'season', ragas: [] },
  { kind: 'season', ragas: [kalyani, todi, kalyani] },
  { kind: 'concert', ragas: [begada, todi] },
  { kind: 'artist', name: 'Ranjani', role: 'vocal' },
  { kind: 'artist', name: 'Embar S Kannan', role: 'violin' },
  { kind: 'artist', name: 'Sai Giridhar', role: 'mridangam' },
  { kind: 'artist', name: 'Jayanthi Kumaresh', role: 'veena' },
  { kind: 'artist', name: 'Someone', role: null },
  { kind: 'mark' },
];

describe('motifParams', () => {
  it('draws the same mark from the same seed', () => {
    for (const seed of SEEDS) {
      expect(JSON.stringify(motifParams(seed))).toBe(
        JSON.stringify(motifParams(structuredClone(seed))),
      );
    }
  });

  it('draws different marks from different seeds', () => {
    const drawn = SEEDS.map((seed) => JSON.stringify(motifParams(seed)));
    expect(new Set(drawn).size).toBe(drawn.length);
    // Two Artists on the same instrument differ by their names.
    expect(motifParams({ kind: 'artist', name: 'Ranjani', role: 'vocal' })).not.toEqual(
      motifParams({ kind: 'artist', name: 'Gayatri', role: 'vocal' }),
    );
  });

  it('draws the season from which Ragas were heard and how often, not the order logged', () => {
    const a = motifParams({ kind: 'season', ragas: [kalyani, todi, kalyani, begada] });
    const b = motifParams({ kind: 'season', ragas: [begada, kalyani, todi, kalyani] });
    expect(a).toEqual(b);
    expect(a).not.toEqual(motifParams({ kind: 'season', ragas: [todi, todi, kalyani, begada] }));
  });

  it('names only theme tones, with every setting a finite number', () => {
    for (const seed of SEEDS) {
      const { tones, ...settings } = motifParams(seed);
      expect(tones.length).toBeGreaterThan(1);
      expect(tones.length).toBeLessThanOrEqual(10);
      for (const tone of tones) expect(TONES).toContain(tone);
      for (const value of Object.values(settings)) expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe('ragaSeeds', () => {
  it('counts Linked ragas as one, by their group key, with the melakarta from the catalog', () => {
    const raga = (key: string, groupKey: string, mela: number | null): Raga => ({
      key,
      display: key,
      aliases: [],
      groupKey,
      mela,
    });
    const ragas = [raga('tODi', 'tODi', 8), raga('hanumatODi', 'tODi', 8)];
    const catalog = { ragaByKey: new Map(ragas.map((r) => [r.key, r])) } as unknown as Catalog;
    expect(ragaSeeds(['hanumatODi', 'tODi', 'typed raga'], catalog)).toEqual([
      { key: 'tODi', mela: 8 },
      { key: 'tODi', mela: 8 },
      { key: 'typed raga', mela: null },
    ]);
  });
});

describe('the motif tones', () => {
  const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    return css.slice(start, css.indexOf('\n}', start));
  };

  it('are defined in both themes, as colours, and differ between them', () => {
    const light = block(':root');
    const dark = block('.dark');
    for (const tone of TONES) {
      const pattern = new RegExp(`--motif-${tone}: (oklch\\([^)]*\\));`);
      const inLight = pattern.exec(light)?.[1];
      const inDark = pattern.exec(dark)?.[1];
      expect(inLight, `light --motif-${tone}`).toBeDefined();
      expect(inDark, `dark --motif-${tone}`).toBeDefined();
      expect(inLight).not.toBe(inDark);
    }
  });
});
