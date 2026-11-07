// Raga keys as motif seeds: each by its group key, so Linked ragas are one, with its melakarta
// from the catalog. A key the catalog doesn't know keeps its own name and no melakarta.

import type { Catalog } from '../catalog/load';
import type { RagaSeed } from './seed';

export function ragaSeeds(keys: readonly string[], catalog: Catalog | null): RagaSeed[] {
  return keys.map((key) => {
    const raga = catalog?.ragaByKey.get(key);
    return raga ? { key: raga.groupKey, mela: raga.mela } : { key, mela: null };
  });
}
