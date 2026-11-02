// The catalog for the screens: opened once after first render (catalog/current.ts), its search
// index built once, in the background. Logging never waits for either: until they are ready the
// search box still takes typed text (DESIGN.md "Search states").

import { useSyncExternalStore } from 'react';
import { openCatalog } from './current';
import type { Catalog } from './load';
import { buildIndex, type CatalogIndex } from './search';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; catalog: Catalog; index: CatalogIndex };

let state: CatalogState = { status: 'loading' };
const listeners = new Set<() => void>();
let started = false;

function start() {
  if (started) return;
  started = true;
  void openCatalog()
    .catch(() => null)
    .then((catalog) => {
      state = catalog
        ? { status: 'ready', catalog, index: buildIndex(catalog) }
        : { status: 'missing' };
      listeners.forEach((listener) => listener());
    });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useCatalog(): CatalogState {
  return useSyncExternalStore(subscribe, () => state);
}

/** The catalog if it is ready, for store actions that compare with it. */
export function currentCatalog(): Catalog | null {
  return state.status === 'ready' ? state.catalog : null;
}

/**
 * The catalog once opened, for a store action that must not run without it when it exists
 * (Undo brings a restored Item to the catalog in use; a repick tells a Guess from the song's
 * value). Opens it if no screen has yet, without building the search index.
 */
export async function readyCatalog(): Promise<Catalog | null> {
  return openCatalog().catch(() => null);
}
