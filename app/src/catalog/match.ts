// Text-to-catalog matching, shared by the Detail editor and the 2024-25 reference import
// (FR-039). A text matches only when its fold equals a catalog name or Alias exactly; anything
// else stays Unresolved with the text kept, never guessed (constitution III).

import {
  unknownValue,
  unresolvedValue,
  type DetailState,
  type DetailValue,
} from '../model/detail-value';
import { fold } from './fold';
import type { Catalog, Song } from './load';

export type MatchField = 'raga' | 'composer' | 'tala' | 'language' | 'subject' | 'form';

/**
 * A project-kept form with no Composition, such as RTP (app/src/reference/forms.json). A catalog
 * form whose name folds the same wins, so "Slokam" matches the catalog's "shlokam".
 */
export interface KeptForm {
  key: string;
  display: string;
  aliases: string[];
}

export interface Matcher {
  /** The catalog key `text` names, or null when it names none or several. */
  key(field: MatchField, text: string): string | null;
  /** `text` as a Detail value: matched, Unknown for "?", else Unresolved. */
  detail(field: MatchField, text: string, matchedState?: 'catalog' | 'override'): DetailValue;
  /**
   * The songs whose title or a title alias folds to `text`, in catalog order. Many songs share
   * a title, so this can be several; the caller picks one only on other evidence, or leaves the
   * Item Unresolved.
   */
  songs(text: string): Song[];
}

interface Name {
  key: string;
  names: string[];
}

// Ambiguous folds map to null, so two entries that fold alike are never silently picked.
// Known case, left for the phonetic-search work: the catalog's three Kanada ragas (kAnaDA,
// kannaDa, kaNNaDa) all fold to "kanada", so none of them matches by name.
function lookup(entries: Name[]): Map<string, string | null> {
  const primary = new Map<string, string | null>();
  const alias = new Map<string, string | null>();
  const add = (map: Map<string, string | null>, name: string, key: string) => {
    const folded = fold(name);
    if (folded === '') return;
    const existing = map.get(folded);
    map.set(folded, existing === undefined || existing === key ? key : null);
  };
  for (const { key, names } of entries) {
    const [first, ...rest] = names;
    add(primary, key, key);
    if (first !== undefined) add(primary, first, key);
    for (const name of rest) add(alias, name, key);
  }
  // A name that is an entry's own name wins over another entry's Alias.
  for (const [folded, key] of alias) if (!primary.has(folded)) primary.set(folded, key);
  return primary;
}

/** `primary`, plus the names of `fallback` it doesn't already have. */
function withFallback(
  primary: Map<string, string | null>,
  fallback: Map<string, string | null>,
): Map<string, string | null> {
  for (const [folded, key] of fallback) if (!primary.has(folded)) primary.set(folded, key);
  return primary;
}

export function buildMatcher(catalog: Catalog, keptForms: readonly KeptForm[] = []): Matcher {
  const plain = (keys: string[]): Name[] => keys.map((key) => ({ key, names: [] }));
  const tables: Record<MatchField, Map<string, string | null>> = {
    raga: lookup(catalog.ragas.map((r) => ({ key: r.key, names: [r.display, ...r.aliases] }))),
    composer: lookup(
      catalog.composers.map((c) => ({ key: c.key, names: [c.display, ...c.aliases] })),
    ),
    tala: lookup(catalog.talas.map((t) => ({ key: t.key, names: [t.display] }))),
    language: lookup(plain(catalog.languages)),
    subject: lookup(plain(catalog.subjects)),
    form: withFallback(
      lookup(plain(catalog.forms)),
      lookup(keptForms.map((f) => ({ key: f.key, names: [f.display, ...f.aliases] }))),
    ),
  };

  const key = (field: MatchField, text: string) => tables[field].get(fold(text)) ?? null;

  const songsByTitle = new Map<string, Song[]>();
  for (const song of catalog.songs) {
    const titles = new Set([song.title, ...song.titleAliases].map(fold));
    for (const title of titles) {
      if (title === '') continue;
      const list = songsByTitle.get(title);
      if (list) list.push(song);
      else songsByTitle.set(title, [song]);
    }
  }

  return {
    key,
    detail(field, text, matchedState: Extract<DetailState, 'catalog' | 'override'> = 'catalog') {
      const trimmed = text.trim();
      if (trimmed === '?') return unknownValue();
      const matched = key(field, trimmed);
      return matched === null
        ? unresolvedValue(trimmed)
        : { state: matchedState, key: matched, text: trimmed, guess: false };
    },
    songs: (text) => songsByTitle.get(fold(text)) ?? [],
  };
}
