// The catalog upgrade (T046, FR-038; data-model.md "Catalog version upgrade"). Each snapshot
// carries a cumulative remap from every earlier version: an old key maps to its new key, or to
// null when it is retired. Logged Items keep their meaning across versions:
// - a merged key is rewritten on every Item `DetailValue` and on `compositionKey`;
// - a retired key becomes Unresolved, with its text kept;
// - `state` is otherwise left alone, so an Override stays an Override (constitution III).
// The same remap is applied to rows pulled from the server, so a row restored under an older
// key keeps its meaning (outside voice 6).

import type { DetailValue, Item, RasikaRows, RasikaTable } from '../model';
import { upgradeStoredItems, type UpgradeResult } from '../store/catalog-version';
import type { WriteOptions } from '../store/mutate';
import type { Catalog, Remap } from './load';

type KeyRemap = Record<string, string | null>;

// The remap is cumulative, so one step is the norm; following a chain covers a snapshot that
// lists each step. The cap stops a cycle written by mistake.
const MAX_HOPS = 32;

/** Where `key` goes: a new key, null when retired, or undefined when the remap leaves it be. */
function follow(remap: KeyRemap, key: string): string | null | undefined {
  if (!Object.hasOwn(remap, key)) return undefined;
  let current: string | null = key;
  for (let hops = 0; hops < MAX_HOPS && current !== null && Object.hasOwn(remap, current); hops++) {
    const next: string | null = remap[current]!;
    if (next === current) break;
    current = next;
  }
  return current;
}

function remapValue(value: DetailValue, remap: KeyRemap): DetailValue {
  if (value.key === null) return value;
  const to = follow(remap, value.key);
  if (to === undefined || to === value.key) return value;
  // Retired: Unresolved, with the text as picked kept and any Guess with it.
  if (to === null) return { state: 'unresolved', key: null, text: value.text, guess: value.guess };
  return { ...value, key: to };
}

function remapList(values: DetailValue[], remap: KeyRemap): DetailValue[] {
  const mapped = values.map((value) => remapValue(value, remap));
  return mapped.some((value, i) => value !== values[i]) ? mapped : values;
}

/**
 * `item` under `remap`: Ragas (the Item's and each improvised Detail's), Composer and
 * Composition. Returns `item` itself when nothing changes, so callers can skip saving it.
 */
export function remapItem(item: Item, remap: Remap): Item {
  const composition =
    item.compositionKey === null ? undefined : follow(remap.songs, item.compositionKey);
  const ragas = remapList(item.ragas, remap.ragas);
  const composer = remapValue(item.composer, remap.composers);
  const improvised = item.improvised.map((heard) => {
    const raga = heard.raga && remapValue(heard.raga, remap.ragas);
    return raga === heard.raga ? heard : { ...heard, raga };
  });
  const unchanged =
    (composition === undefined || composition === item.compositionKey) &&
    ragas === item.ragas &&
    composer === item.composer &&
    improvised.every((heard, i) => heard === item.improvised[i]);
  if (unchanged) return item;
  return {
    ...item,
    // A retired Composition leaves the Item without one; its title, as picked, stays.
    compositionKey: composition === undefined ? item.compositionKey : composition,
    ragas,
    composer,
    improvised,
  };
}

/** A row pulled from the server, under the remap of the catalog in use, before it is stored. */
export function remapPulledRow<T extends RasikaTable>(
  table: T,
  row: RasikaRows[T],
  remap: Remap,
): RasikaRows[T] {
  return table === 'items' ? (remapItem(row as Item, remap) as RasikaRows[T]) : row;
}

/**
 * Bring every stored Item to `catalog`'s version, in one transaction that also queues each
 * changed Item for the server. Run on the launch where the rasika has accepted the new version
 * (the service worker's prompt-to-update, FR-038); it does nothing once the version is recorded.
 */
export function upgradeCatalog(
  catalog: Catalog,
  options: WriteOptions = {},
): Promise<UpgradeResult> {
  return upgradeStoredItems(catalog.version, (item) => remapItem(item, catalog.remap), options);
}
