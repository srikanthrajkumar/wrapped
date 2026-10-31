// Catalog search (ADR 0004, research.md "Catalog search"). uFuzzy runs over folded text: for
// each song its title, first line, raga names and aliases, composer names and aliases and
// tala; and one entry per raga, so typing a raga's name can start an Item with only its Raga
// (plan.md DD4).

import uFuzzy from '@leeoniya/ufuzzy';
import { fold } from './fold';
import type { Catalog, Raga, Song } from './load';

export type SearchResult = { kind: 'song'; song: Song } | { kind: 'raga'; raga: Raga };

export interface CatalogIndex {
  search(query: string, limit?: number): SearchResult[];
}

export const DEFAULT_LIMIT = 20;

// One error per term past its first letter (substitution, transposition, insertion or
// deletion), for spellings the fold doesn't reach, such as "Kamavardani" for "Kamavardhini".
// uFuzzy's own rules keep terms of four letters or fewer stricter, to avoid junk matches.
const fuzzy = new uFuzzy({ intraMode: 1, intraIns: 1, intraSub: 1, intraTrn: 1, intraDel: 1 });

const ragaNames = (raga: Raga) => [raga.display, raga.key, ...raga.aliases];

function songText(song: Song): string {
  const ragas = song.raga ? [song.raga, ...song.ragamalika] : song.ragamalika;
  const title = fold(song.title);
  const firstLine = fold(song.firstLine);
  return [
    title,
    firstLine,
    // Joined spellings, as in "Venkatachalanilayam" for "Venkatachala Nilayam".
    title.replaceAll(' ', ''),
    firstLine.replaceAll(' ', ''),
    fold(
      [
        ...ragas.flatMap(ragaNames),
        ...(song.composer ? [song.composer.display, ...song.composer.aliases] : []),
        song.tala?.display ?? '',
      ].join(' '),
    ),
  ].join(' ');
}

/** Build the index once, when the catalog loads. */
export function buildIndex(catalog: Catalog): CatalogIndex {
  const entries: SearchResult[] = [
    ...catalog.ragas.map((raga): SearchResult => ({ kind: 'raga', raga })),
    ...catalog.songs.map((song): SearchResult => ({ kind: 'song', song })),
  ];
  const haystack = entries.map((entry) =>
    entry.kind === 'raga' ? fold(ragaNames(entry.raga).join(' ')) : songText(entry.song),
  );
  // For one-letter queries: the start of each title or raga name.
  const heads = entries.map((entry) =>
    fold(entry.kind === 'raga' ? entry.raga.display : entry.song.title),
  );

  return {
    search(query, limit = DEFAULT_LIMIT) {
      const needle = fold(query);
      if (needle === '') return [];

      // A single letter matches too much to rank in budget (research.md): offer the titles
      // and ragas that start with it, capped, in catalog order.
      if (needle.length === 1) {
        const found: SearchResult[] = [];
        for (let i = 0; i < entries.length && found.length < limit; i += 1) {
          if (heads[i]!.startsWith(needle)) found.push(entries[i]!);
        }
        return found;
      }

      const [idxs, info, order] = fuzzy.search(haystack, needle, 1);
      if (!idxs) return [];
      const ranked = info && order ? order.map((i) => info.idx[i]!) : idxs;
      return ranked.slice(0, limit).map((i) => entries[i]!);
    },
  };
}
