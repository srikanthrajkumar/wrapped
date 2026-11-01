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
