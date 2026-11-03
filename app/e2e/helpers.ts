import { expect, type BrowserContext, type Page } from '@playwright/test';

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
 * put and add throws while `setFailingWrites(page, true)` is in force, and never finishes while
 * `setHangingWrites(page, true)` is (a write still running when the page is killed).
 */
export async function failWritesOnDemand(page: Page | BrowserContext): Promise<void> {
  await page.addInitScript(() => {
    const flag = window as unknown as { failWrites?: boolean; hangWrites?: boolean };
    for (const name of ['put', 'add'] as const) {
      const original = IDBObjectStore.prototype[name] as (...args: unknown[]) => IDBRequest;
      IDBObjectStore.prototype[name] = function (this: IDBObjectStore, ...args: unknown[]) {
        if (flag.failWrites) throw new DOMException('The disk is full', 'QuotaExceededError');
        // A request that never succeeds or fails: the write's transaction never settles.
        if (flag.hangWrites) return {} as IDBRequest;
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

export async function setHangingWrites(page: Page, hanging: boolean): Promise<void> {
  await page.evaluate((hanging) => {
    (window as unknown as { hangWrites: boolean }).hangWrites = hanging;
  }, hanging);
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

/**
 * Keep the app from becoming ready for offline: from the next page load, the page's request to
 * the service worker for the second download is held back until `releaseOfflineReady(page)`.
 */
export async function holdOfflineReady(page: Page | BrowserContext): Promise<void> {
  await page.addInitScript(() => {
    const held: (() => void)[] = [];
    let holding = true;
    const original = ServiceWorker.prototype.postMessage as (...args: unknown[]) => void;
    ServiceWorker.prototype.postMessage = function (this: ServiceWorker, ...args: unknown[]) {
      const message = args[0] as { type?: string } | undefined;
      if (holding && message?.type === 'CACHE_PHASE_2') {
        held.push(() => original.apply(this, args));
        return;
      }
      original.apply(this, args);
    };
    (window as unknown as { releaseOfflineReady: () => void }).releaseOfflineReady = () => {
      holding = false;
      held.splice(0).forEach((send) => send());
    };
  });
}

export async function releaseOfflineReady(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { releaseOfflineReady: () => void }).releaseOfflineReady(),
  );
}

/** From the next page load, the browser answers that it has (or hasn't) promised to keep storage. */
export async function storagePersisted(
  page: Page | BrowserContext,
  persisted: boolean,
): Promise<void> {
  await page.addInitScript((persisted) => {
    StorageManager.prototype.persisted = () => Promise.resolve(persisted);
    StorageManager.prototype.persist = () => Promise.resolve(persisted);
  }, persisted);
}
