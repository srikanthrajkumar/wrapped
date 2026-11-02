import { expect, type Page } from '@playwright/test';

/**
 * Go through first launch as it stands before sign-in exists (design D10): Welcome, then
 * "Getting ready to log offline" until the service worker has cached the first phase, then
 * Start, which opens the empty home.
 */
export async function finishFirstLaunch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.getByRole('button', { name: 'Start' }).click({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
}

/** Read one `meta` row straight from IndexedDB, as the app stored it. */
export function readMeta(page: Page, key: string) {
  return page.evaluate(
    (key) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('carnatic-wrapped');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('meta')) {
            db.close();
            resolve(undefined);
            return;
          }
          const get = db.transaction('meta').objectStore('meta').get(key);
          get.onsuccess = () => {
            db.close();
            resolve((get.result as { value: unknown } | undefined)?.value);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    key,
  );
}

/**
 * Make IndexedDB writes fail on demand, as a full disk would: from the next page load, every
 * put and add throws while `setFailingWrites(page, true)` is in force.
 */
export async function failWritesOnDemand(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const flag = window as unknown as { failWrites?: boolean };
    for (const name of ['put', 'add'] as const) {
      const original = IDBObjectStore.prototype[name] as (...args: unknown[]) => IDBRequest;
      IDBObjectStore.prototype[name] = function (this: IDBObjectStore, ...args: unknown[]) {
        if (flag.failWrites) throw new DOMException('The disk is full', 'QuotaExceededError');
        return original.apply(this, args);
      };
    }
  });
}

export async function setFailingWrites(page: Page, failing: boolean): Promise<void> {
  await page.evaluate((failing) => {
    (window as unknown as { failWrites: boolean }).failWrites = failing;
  }, failing);
}

/** Every row of one table, straight from IndexedDB. */
export function readTable<T = Record<string, unknown>>(page: Page, table: string): Promise<T[]> {
  return page.evaluate(
    (table) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('carnatic-wrapped');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction(table).objectStore(table).getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result as T[]);
          };
          all.onerror = () => reject(all.error);
        };
      }),
    table,
  );
}
