// The store's side of a catalog version upgrade (FR-038, data-model.md "Catalog version
// upgrade"). The rules for rewriting an Item live in app/src/catalog/upgrade.ts; this applies
// them to every stored Item and records the version, in one transaction.

import type { Item } from '../model';
import { db as defaultDb } from './db';
import { save, type WriteOptions } from './mutate';

export const CATALOG_VERSION_KEY = 'catalogVersion';

export interface UpgradeResult {
  /** The version the stored Items were on; null on a phone that never recorded one. */
  from: string | null;
  to: string;
  /** Items rewritten, each queued for the server. */
  changed: number;
}

/**
 * Rewrite every live Item with `rewrite` and record `version`, in one transaction: a force-close
 * leaves either the old Items and version or the new ones. `rewrite` returns the Item itself
 * when it has nothing to change. Running it again for the version already recorded does
 * nothing.
 */
export async function upgradeStoredItems(
  version: string,
  rewrite: (item: Item) => Item,
  { db = defaultDb }: WriteOptions = {},
): Promise<UpgradeResult> {
  return db.transaction('rw', [db.items, db.outbox, db.meta], async () => {
    const from = ((await db.meta.get(CATALOG_VERSION_KEY))?.value as string | undefined) ?? null;
    if (from === version) return { from, to: version, changed: 0 };
    let changed = 0;
    for (const item of await db.items.toArray()) {
      if (item.deletedAt !== null) continue;
      const rewritten = rewrite(item);
      if (rewritten === item) continue;
      await save('items', rewritten, { db });
      changed += 1;
    }
    await db.meta.put({ key: CATALOG_VERSION_KEY, value: version });
    return { from, to: version, changed };
  });
}
