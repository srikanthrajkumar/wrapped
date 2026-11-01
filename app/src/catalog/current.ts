// The catalog this build ships, opened once per launch. Opening it also brings stored Items to
// its version (FR-038): a new catalog only arrives with a new build, which runs only after the
// rasika agreed to the update, so the first launch that opens it is the one that upgrades.

import { loadCatalog, type Catalog } from './load';
import { upgradeCatalog } from './upgrade';

let opening: Promise<Catalog | null> | null = null;

/**
 * The build's catalog, or null when it has none or its file is refused. Never awaited by the
 * first render. A failed upgrade is retried on the next launch, because the version is recorded
 * only with the rewritten Items; the catalog is still returned for search.
 */
export function openCatalog(): Promise<Catalog | null> {
  opening ??= (async () => {
    const file = import.meta.env.VITE_CATALOG_FILE ?? null;
    if (!file) return null;
    const loaded = await loadCatalog([file]);
    if (loaded.file === null) {
      console.error('catalog not loaded:', loaded.errors.join('; '));
      return null;
    }
    await upgradeCatalog(loaded.catalog).catch((error: unknown) => {
      console.error('catalog upgrade failed; it runs again next launch', error);
    });
    return loaded.catalog;
  })();
  return opening;
}
