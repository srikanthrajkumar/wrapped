// What a motif is drawn from (DESIGN.md "The motif"). Pure: the same seed always gives the same
// settings, and the settings name theme tones, never colours, so one seed draws in both themes.
//
// - The Season's shelf: the season's Ragas so far, the most heard first, so it changes as the
//   season fills. A Raga's tone comes from its melakarta's chakra; Linked ragas count once.
// - The Concert summary's edge: that Concert's Ragas, mostly ground, one rose glow.
// - An Artist's avatar (the Schedule card's tile): the instrument sets the form, the name
//   varies it.
// - The app's own mark (first launch): Silk, fixed.

import type { Role } from '../model';

/** The six Ink-and-rose tones, each a theme variable (--motif-<tone>, styles/app.css). */
export const TONES = ['ground', 'near', 'mid', 'rose', 'blush', 'far'] as const;
export type Tone = (typeof TONES)[number];

export interface RagaSeed {
  /** The Raga's group key, so Linked ragas are one. */
  key: string;
  /** Its melakarta, 1 to 72; null when the catalog doesn't say. */
  mela: number | null;
}

export type MotifSeed =
  | { kind: 'season'; ragas: readonly RagaSeed[] }
  | { kind: 'concert'; ragas: readonly RagaSeed[] }
  | { kind: 'artist'; name: string; role: Role | null }
  | { kind: 'mark' };

/** Paper's static mesh gradient settings (paper-shaders.ts), with tones for colours. */
export interface MotifParams {
  tones: Tone[];
  positions: number;
  waveX: number;
  waveXShift: number;
  waveY: number;
  waveYShift: number;
  mixing: number;
  grainMixer: number;
  grainOverlay: number;
  rotation: number;
}

/** How an instrument moves: a bowed fold, plucked ripples, a struck skin's grain, a breath. */
type Form = 'bow' | 'pluck' | 'pulse' | 'breath' | 'still';

const FORMS: Partial<Record<Role, Form>> = {
  vocal: 'breath',
  support: 'breath',
  flute: 'breath',
  nagaswaram: 'breath',
  saxophone: 'breath',
  presenter: 'breath',
  violin: 'bow',
  dancer: 'bow',
  veena: 'pluck',
  chitravina: 'pluck',
  mandolin: 'pluck',
  mridangam: 'pulse',
  khanjira: 'pulse',
  ghatam: 'pulse',
  morsing: 'pulse',
  thavil: 'pulse',
  nattuvangam: 'pulse',
};

/** FNV-1a, 32 bits: a stable number from a name. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a small seeded random, so a mark never depends on Math.random. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** A Raga's tone: the chakra (six melakartas each) picks it; prati madhyamam moves it one on. */
function ragaTone({ key, mela }: RagaSeed): Tone {
  const m = mela ?? (hash(key) % 72) + 1;
  const chakra = Math.floor(((m - 1) % 36) / 6) + (m > 36 ? 1 : 0);
  return (['near', 'mid', 'rose', 'blush', 'near', 'rose'] as const)[chakra % 6]!;
}

/** The Ragas most heard first, Linked ragas once, ties by key so the order is stable. */
function mostHeard(ragas: readonly RagaSeed[]): RagaSeed[] {
  const counts = new Map<string, { seed: RagaSeed; n: number }>();
  for (const raga of ragas) {
    const entry = counts.get(raga.key);
    if (entry) entry.n++;
    else counts.set(raga.key, { seed: raga, n: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || (a.seed.key < b.seed.key ? -1 : 1))
    .map((entry) => entry.seed);
}

function params(base: MotifParams): MotifParams {
  const out = { ...base, tones: [...base.tones] };
  for (const k of Object.keys(out) as (keyof MotifParams)[])
    if (k !== 'tones') (out[k] as number) = round(out[k] as number);
  return out;
}

export function motifParams(seed: MotifSeed): MotifParams {
  switch (seed.kind) {
    case 'season': {
      // Mostly ground, so the words on it stay quiet. Day one is ink with one faint rose; rose
      // grows with the season (a second rose once three Ragas are heard) and the three most
      // heard Ragas take the other voices. High mixing and gentle waves: no streaks or seams.
      const heard = mostHeard(seed.ragas);
      const top = heard.slice(0, 3);
      const r = random(hash('season:' + top.map((raga) => raga.key).join('|')));
      const tones: Tone[] =
        top.length === 0
          ? ['ground', 'ground', 'near', 'ground', 'rose', 'ground', 'near', 'ground']
          : [
              'ground',
              'ground',
              'near',
              'rose',
              ragaTone(top[0]!),
              'ground',
              heard.length >= 3 ? 'rose' : 'ground',
              top[1] ? ragaTone(top[1]) : 'near',
              top[2] ? ragaTone(top[2]) : 'ground',
            ];
      return params({
        tones,
        positions: top.length ? r() * 100 : 33,
        waveX: 0.2 + r() * 0.2,
        waveXShift: top.length ? r() : 0.2,
        waveY: 0.2 + r() * 0.15,
        waveYShift: top.length ? r() : 0.8,
        mixing: top.length ? 0.95 : 1,
        grainMixer: 0,
        grainOverlay: 0,
        rotation: top.length ? r() * 360 : 90,
      });
    }
    case 'concert': {
      // One rose coal in the dark (light: one blush in the white), coloured by its first Raga.
      const top = mostHeard(seed.ragas);
      const r = random(hash('concert:' + top.map((raga) => raga.key).join('|')));
      return params({
        tones: ['ground', 'near', top[0] ? ragaTone(top[0]) : 'near', 'rose', 'ground', 'near'],
        positions: r() * 100,
        waveX: 0.15 + r() * 0.15,
        waveXShift: r(),
        waveY: 0.15,
        waveYShift: r(),
        mixing: 1,
        grainMixer: 0,
        grainOverlay: 0,
        rotation: r() * 360,
      });
    }
    case 'artist': {
      const form = (seed.role && FORMS[seed.role]) ?? 'still';
      const r = random(hash(`artist:${form}:${seed.name}`));
      const shared = {
        positions: r() * 100,
        rotation: r() * 360,
        waveXShift: r(),
        waveYShift: r(),
        grainMixer: 0,
        grainOverlay: 0,
      };
      // One rendering for every tile: soft, no grain or stipple, no thin features; the form
      // shows only in the shape and how the light lies.
      switch (form) {
        case 'bow':
          return params({
            ...shared,
            tones: ['ground', 'mid', 'rose', 'blush', 'ground'],
            waveX: 0.6,
            waveY: 0.15,
            mixing: 0.97,
          });
        case 'pluck':
          return params({
            ...shared,
            tones: ['ground', 'rose', 'near', 'blush', 'ground', 'mid'],
            waveX: 0.5,
            waveY: 0.6,
            mixing: 0.8,
          });
        case 'pulse':
          return params({
            ...shared,
            // Beats: several small glows rather than one.
            tones: ['ground', 'rose', 'near', 'rose', 'ground', 'blush', 'ground'],
            waveX: 0.2,
            waveY: 0.2,
            mixing: 0.85,
          });
        case 'breath':
          return params({
            ...shared,
            tones: ['ground', 'near', 'rose', 'blush', 'ground'],
            waveX: 0.15,
            waveY: 0.15,
            mixing: 1,
          });
        default:
          return params({
            ...shared,
            tones: ['ground', 'near', 'rose', 'ground'],
            waveX: 0.3,
            waveY: 0.3,
            mixing: 0.95,
          });
      }
    }
    case 'mark':
      // Silk: long folds of rose and ink, kept sharp (the Maintainer's pick, 2026-11-07).
      return params({
        tones: ['ground', 'rose', 'ground', 'blush', 'ground', 'rose', 'blush'],
        positions: 42,
        waveX: 1,
        waveXShift: 0.6,
        waveY: 0.35,
        waveYShift: 0.2,
        mixing: 0.48,
        grainMixer: 0,
        grainOverlay: 0,
        rotation: 250,
      });
  }
}
