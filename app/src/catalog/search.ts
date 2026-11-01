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

// uFuzzy allows any one error only in words of five letters or more; shorter words match more
// strictly, by rules that change with their length.
const LENIENT_WORD = 5;

/** Matched without regard to order: several words, at least one a single letter. */
const unordered = (needle: string) => needle.includes(' ') && reorderLimit(needle) === 1;

/**
 * Whether every match for `next` is among the matches for `prev`, so `next` need only be
 * searched for there. That holds as the rasika types on, with two exceptions:
 * - a word of four letters or fewer growing: uFuzzy's rules for short words change with their
 *   length, and allow any one error from five letters;
 * - moving from words matched in order to words matched anywhere, which can match a song
 *   whose words overlap.
 * Every other case, a word of five letters or more growing or a new word added, only narrows.
 */
function narrows(prev: string, next: string): boolean {
  if (prev.length < 2 || !next.startsWith(prev) || next === prev) return false;
  const growsLastWord = next[prev.length] !== ' ';
  if (growsLastWord && prev.length - (prev.lastIndexOf(' ') + 1) < LENIENT_WORD) return false;
  return !unordered(next) || unordered(prev);
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
  // What uFuzzy ranks: each entry's whole text, as one string.
  const haystack: string[] = [];
  // What a single word is first looked for in, to the same effect at about an eighth of the length
  // (see `wordMatches`): each entry's own text, and each raga, composer and tala text once.
  const ownText: string[] = [];
  const sharedEntries = new Map<string, number[]>();
  const share = (text: string, entry: number) => {
    const list = sharedEntries.get(text);
    if (list) list.push(entry);
    else sharedEntries.set(text, [entry]);
  };

  entries.forEach((entry, i) => {
    if (entry.kind === 'raga') {
      heads.push(fold(entry.raga.display));
      haystack.push(ragaText.get(entry.raga)!);
      ownText.push(ragaText.get(entry.raga)!);
      return;
    }
    const { song } = entry;
    const title = fold(song.title);
    const firstLine = fold(song.firstLine);
    // The title's other spellings are search terms: matching one finds the song, which still
    // shows its own title.
    const titleAliases = song.titleAliases.map(fold);
    heads.push(title);
    const own = [
      title,
      firstLine,
      ...titleAliases,
      // Joined spellings, as in "Venkatachalanilayam" for "Venkatachala Nilayam".
      title.replaceAll(' ', ''),
      firstLine.replaceAll(' ', ''),
      ...titleAliases.map((alias) => alias.replaceAll(' ', '')),
    ];
    const shared = [
      ...(song.raga ? [song.raga, ...song.ragamalika] : song.ragamalika).map((raga) =>
        ragaText.get(raga)!,
      ),
      song.composer ? composerText.get(song.composer)! : '',
      song.tala ? talaText.get(song.tala)! : '',
    ];
    haystack.push([...own, ...shared].join(' '));
    // A single word never spans a space, so whatever it matches in a spaced spelling it also
    // matches in the joined one, and only the joined spellings are needed. A part found inside
    // another part can only match where that one does; a title is usually the start of its
    // first line.
    const parts = [
      ...new Set([title, firstLine, ...titleAliases].map((part) => part.replaceAll(' ', ''))),
    ].filter((part) => part !== '');
    ownText.push(
      parts
        .filter((part) => !parts.some((other) => other !== part && other.includes(part)))
        .join(' '),
    );
    for (const text of new Set(shared)) if (text !== '') share(text, i);
  });
  const sharedText = [...sharedEntries.keys()];
  const sharedLists = [...sharedEntries.values()];

  // One scratch mark per entry, cleared before each use, so a keystroke allocates no
  // catalog-sized buffers for the collector to reclaim mid-typing.
  const scratch = new Uint8Array(entries.length);
  const cleared = () => scratch.fill(0);
  // Entries in ascending order, as uFuzzy's own pass over the haystack gives them. The order
  // matters: past 1,000 matches the results are not ranked and come back in this order.
  const ascending = (marked: Uint8Array) => {
    const out: number[] = [];
    for (let i = 0; i < marked.length; i += 1) if (marked[i]) out.push(i);
    return out;
  };

  /**
   * The entries whose text matches one word, exactly as filtering the haystack would: a word
   * never matches across a space, so it matches an entry's text when it matches one of its
   * parts, and a raga, composer or tala text is tried once for every song that has it.
   */
  function wordMatches(word: string): number[] {
    const marked = cleared();
    for (const i of fuzzy.filter(ownText, word) ?? []) marked[i] = 1;
    for (const k of fuzzy.filter(sharedText, word) ?? []) {
      for (const i of sharedLists[k]!) marked[i] = 1;
    }
    return ascending(marked);
  }

  // Single words already matched, so a word typed earlier in a query is not looked for again
  // on every later keystroke, nor on a backspace. Enough for the words of a query being typed
  // and corrected.
  const wordCache = new Map<string, number[]>();
  const WORD_CACHE_SIZE = 32;
  function cachedWordMatches(word: string, matches?: number[]): number[] {
    let found = wordCache.get(word);
    if (!found) {
      // A word of five letters or more matches within what it matched one letter shorter.
      const shorter = word.length > LENIENT_WORD ? wordCache.get(word.slice(0, -1)) : undefined;
      found =
        matches ?? (shorter ? (fuzzy.filter(haystack, word, shorter) ?? []) : wordMatches(word));
      wordCache.set(word, found);
      if (wordCache.size > WORD_CACHE_SIZE) wordCache.delete(wordCache.keys().next().value!);
    }
    return found;
  }

  /** The entries in every one of `lists`, ascending. */
  function intersect(lists: number[][]): number[] {
    const counts = cleared();
    for (const list of lists) for (const i of list) counts[i]! += 1;
    const out: number[] = [];
    for (let i = 0; i < counts.length; i += 1) if (counts[i] === lists.length) out.push(i);
    return out;
  }

  // Past this many candidates, a short last word is worth its own pass over the compact text:
  // uFuzzy would otherwise try it, in every word order, on each candidate's whole text.
  const MANY_CANDIDATES = 2000;

  /**
   * Entries that can match a query of several words: those matching each of its words, as
   * every word of a match matches somewhere in it, whatever the word order rules.
   * - The last word counts once it has five letters, so a correction to a long query starts
   *   from the few songs that hold every word; uFuzzy's in-order matching is slow on the many
   *   that hold only some.
   * - A shorter last word counts when the other words leave many candidates.
   */
  function allWordsMatches(words: string[]): number[] | null {
    const last = words.at(-1)!;
    const used = new Set(words.slice(0, -1).filter((word) => word.length >= 2));
    if (last.length >= LENIENT_WORD) used.add(last);
    let found = used.size > 0 ? intersect([...used].map((word) => cachedWordMatches(word))) : null;
    if (last.length >= 2 && !used.has(last) && (found === null || found.length > MANY_CANDIDATES)) {
      const lastMatches = cachedWordMatches(last);
      found = found === null ? lastMatches : intersect([found, lastMatches]);
    }
    return found;
  }

  // Each keystroke searches only the previous keystroke's matches when that gives the same
  // answer (see `narrows`), so the slow pass over the whole catalog runs once per word, not on
  // every letter.
  let last: { needle: string; matches: number[]; ranked: number[] } | null = null;

  function matching(needle: string) {
    // The same needle again, as when a space is typed after a word.
    if (last?.needle === needle) return last;
    const reorder = reorderLimit(needle);
    const words = needle.split(' ');
    const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
    const reuse = last !== null && narrows(last.needle, needle);
    // Candidates: every entry the needle can match, in ascending order.
    let within = reuse
      ? last!.matches
      : words.length === 1
        ? cachedWordMatches(needle)
        : (allWordsMatches(words) ?? cachedWordMatches(longest));
    // In typed order uFuzzy takes what it is given as already filtered for the whole needle;
    // with reordering it filters each word within it itself.
    if (reorder === 0 && (reuse || words.length > 1)) {
      within = fuzzy.filter(haystack, needle, within) ?? [];
    }
    if (words.length === 1) cachedWordMatches(needle, within);
    if (within.length === 0) return { needle, matches: [], ranked: [] };
    const [idxs, info, order] = fuzzy.search(haystack, needle, reorder, undefined, within);
    const matches = idxs ?? [];
    const ranked = info && order ? order.map((i) => info.idx[i]!) : matches;
    if (reorder === 0) return { needle, matches, ranked };
    // Reordered words come back one word order after another; keep them ascending for reuse.
    const marked = cleared();
    for (const i of matches) marked[i] = 1;
    return { needle, matches: ascending(marked), ranked };
  }

  return {
    search(query, limit = DEFAULT_LIMIT) {
      const needle = fold(query);
      if (needle.length < 2) last = null;
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

      last = matching(needle);
      return last.ranked.slice(0, limit).map((i) => entries[i]!);
    },
  };
}
