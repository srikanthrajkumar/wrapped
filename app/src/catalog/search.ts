// Catalog search (ADR 0004, research.md "Catalog search"). uFuzzy runs over folded text: for
// each song its title and title aliases, first line, raga names and aliases, composer names and aliases and
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
// uFuzzy tries every order of the words (6 orders for 3 words, 120 for 5), so reordering is
// kept to short queries of real words: four or five short words took seconds on the full
// catalog. Longer queries are matched in the order typed.
const MAX_REORDERED_WORDS = 3;
const MIN_REORDERED_WORD = 2;

// One error per term past its first letter (substitution, transposition, insertion or
// deletion), for spellings the fold doesn't reach, such as "Kamavardani" for "Kamavardhini".
// uFuzzy's own rules keep terms of four letters or fewer stricter, to avoid junk matches.
const fuzzy = new uFuzzy({ intraMode: 1, intraIns: 1, intraSub: 1, intraTrn: 1, intraDel: 1 });

const ragaNames = (raga: Raga) => [raga.display, raga.key, ...raga.aliases];

/**
 * uFuzzy's third argument: the most words it will reorder. A query with more words than this
 * is filtered word by word and left unranked, which is fast; 0 matches in typed order, ranked.
 * - Up to three words of two letters or more may come in any order ("adi todi" finds Todi).
 * - Single letters among several words ("a b c") match nearly everything, and ranking them in
 *   order took over half a second on the full catalog, so they take the fast unranked path.
 * - Anything else is matched in the order typed, and ranked.
 */
function reorderLimit(needle: string): number {
  const words = needle.split(' ');
  if (words.length === 1) return 0;
  if (words.some((word) => word.length < MIN_REORDERED_WORD)) return 1;
  return words.length <= MAX_REORDERED_WORDS ? words.length : 0;
}

/** Build the index once, when the catalog loads. */
export function buildIndex(catalog: Catalog): CatalogIndex {
  // Thousands of songs share each raga, composer and tala: fold their names once, not per song.
  const ragaText = new Map(catalog.ragas.map((raga) => [raga, fold(ragaNames(raga).join(' '))]));
  const composerText = new Map(
    catalog.composers.map((c) => [c, fold([c.display, ...c.aliases].join(' '))]),
  );
  const talaText = new Map(catalog.talas.map((tala) => [tala, fold(tala.display)]));

  const entries: SearchResult[] = [
    ...catalog.ragas.map((raga): SearchResult => ({ kind: 'raga', raga })),
    ...catalog.songs.map((song): SearchResult => ({ kind: 'song', song })),
  ];
  // For one-letter queries: the start of each title or raga name.
  const heads: string[] = [];
  const haystack = entries.map((entry) => {
    if (entry.kind === 'raga') {
      heads.push(fold(entry.raga.display));
      return ragaText.get(entry.raga)!;
    }
    const { song } = entry;
    const title = fold(song.title);
    const firstLine = fold(song.firstLine);
    // The title's other spellings are search terms: matching one finds the song, which still
    // shows its own title.
    const titleAliases = song.titleAliases.map(fold);
    heads.push(title);
    const ragas = song.raga ? [song.raga, ...song.ragamalika] : song.ragamalika;
    return [
      title,
      firstLine,
      ...titleAliases,
      // Joined spellings, as in "Venkatachalanilayam" for "Venkatachala Nilayam".
      title.replaceAll(' ', ''),
      firstLine.replaceAll(' ', ''),
      ...titleAliases.map((alias) => alias.replaceAll(' ', '')),
      ...ragas.map((raga) => ragaText.get(raga)!),
      song.composer ? composerText.get(song.composer)! : '',
      song.tala ? talaText.get(song.tala)! : '',
    ].join(' ');
  });

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

      const [idxs, info, order] = fuzzy.search(haystack, needle, reorderLimit(needle));
      if (!idxs) return [];
      const ranked = info && order ? order.map((i) => info.idx[i]!) : idxs;
      return ranked.slice(0, limit).map((i) => entries[i]!);
    },
  };
}
