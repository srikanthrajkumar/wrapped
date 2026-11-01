// What the catalog suggests for an Item, as Detail values, and how a value the rasika gives is
// stored against that suggestion (data-model.md, "Detail value"). Shared by the Item actions
// (app/src/store/items.ts) and the 2024-25 reference import (tools/import-2024-25).

import { catalogValue, unknownValue, type DetailValue } from '../model/detail-value';
import type { Song } from './load';

/** The Details a Composition fills in. */
export interface Suggested {
  form: DetailValue;
  ragas: DetailValue[];
  tala: DetailValue;
  composer: DetailValue;
  language: DetailValue;
  subject: DetailValue;
}

const orUnknown = <T>(value: T | null, as: (value: T) => DetailValue) =>
  value === null ? unknownValue() : as(value);

/** What the catalog says of a song, as Detail values. A Detail it doesn't know is "?". */
export function suggestedDetails(song: Song): Suggested {
  const ragas = song.raga ? [song.raga] : song.ragamalika;
  return {
    form: orUnknown(song.form, (form) => catalogValue(form, form)),
    ragas: ragas.map((raga) => catalogValue(raga.key, raga.display)),
    tala: orUnknown(song.tala, (tala) => catalogValue(tala.key, tala.display)),
    composer: orUnknown(song.composer, (c) => catalogValue(c.key, c.display)),
    language: orUnknown(song.language, (language) => catalogValue(language, language)),
    subject: orUnknown(song.subject, (subject) => catalogValue(subject, subject)),
  };
}

/**
 * The state a matched value is stored with. On an Item with a Composition, a value other than
 * the catalog's is an Override; the catalog's own value stays `catalog`. Without a Composition
 * there is nothing to override. Unknown, Not applicable and Unresolved values are kept as given.
 */
export function settleDetail(
  value: DetailValue,
  suggested: DetailValue | undefined,
  hasComposition: boolean,
): DetailValue {
  if (value.state !== 'catalog' && value.state !== 'override') return value;
  const same = suggested?.key != null && suggested.key === value.key;
  return { ...value, state: hasComposition && !same ? 'override' : 'catalog' };
}
