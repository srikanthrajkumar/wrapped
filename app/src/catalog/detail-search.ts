// Search inside one Detail (DESIGN.md "Detail input"): the Detail input's docked search offers
// the catalog's Ragas, Talas, Composers, Languages, Subjects or forms, matched by their fold as
// the rasika types. The lists are short beside the songs, so a plain ranked scan is enough.

import forms from '../reference/forms.json';
import { fold } from './fold';
import type { Catalog } from './load';

export type DetailKind = 'raga' | 'tala' | 'composer' | 'language' | 'subject' | 'form';

/** One value a Detail can take from the catalog. */
export interface DetailOption {
  key: string;
  display: string;
  /** The other spellings it is known by. */
  aliases: string[];
}

/** Every value the catalog offers for `kind`, in catalog order. */
export function detailOptions(catalog: Catalog | null, kind: DetailKind): DetailOption[] {
  const plain = (key: string): DetailOption => ({ key, display: key, aliases: [] });
  switch (kind) {
    case 'raga':
      return (catalog?.ragas ?? []).map(({ key, display, aliases }) => ({ key, display, aliases }));
    case 'composer':
      return (catalog?.composers ?? []).map(({ key, display, aliases }) => ({
        key,
        display,
        aliases,
      }));
    case 'tala':
      return (catalog?.talas ?? []).map(({ key, display }) => ({ key, display, aliases: [] }));
    case 'language':
      return (catalog?.languages ?? []).map(plain);
    case 'subject':
      return (catalog?.subjects ?? []).map(plain);
    case 'form':
      // The project-kept forms an Item may have without a Composition come first.
      return [
        ...forms.map(({ key, display, aliases }) => ({ key, display, aliases })),
        ...(catalog?.forms ?? []).map(plain),
      ];
  }
}

function rank(name: string, needle: string): number | null {
  const folded = fold(name);
  if (folded === needle) return 0;
  if (folded.startsWith(needle)) return 1;
  if (folded.includes(` ${needle}`)) return 2;
  if (folded.includes(needle)) return 3;
  return null;
}

/** Options whose name or an alias contains what was typed, closest first. */
export function searchDetail(
  options: readonly DetailOption[],
  query: string,
  limit = 20,
): DetailOption[] {
  const needle = fold(query);
  if (needle === '') return [];
  const found: { option: DetailOption; rank: number; at: number }[] = [];
  options.forEach((option, at) => {
    let best: number | null = null;
    for (const name of [option.display, option.key, ...option.aliases]) {
      const r = rank(name, needle);
      if (r !== null && (best === null || r < best)) best = r;
    }
    if (best !== null) found.push({ option, rank: best, at });
  });
  return found
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .slice(0, limit)
    .map(({ option }) => option);
}
