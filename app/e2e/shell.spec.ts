import { expect, test, type Page } from '@playwright/test';

/** Read one `meta` row straight from IndexedDB, as the app stored it. */
function readMeta(page: Page, key: string) {
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

test('the app shell opens on Season at phone width', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Season' })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
  await expect(tabs).toHaveText(['Season', 'Wrapped', 'Settings']);
  await expect(tabs.first()).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => window.innerWidth)).toBe(390);
});

test('the tabs switch screens, and the Item editor hides the tab bar', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Wrapped' }).click();
  await expect(page.getByRole('heading', { name: 'Wrapped' })).toBeVisible();
  await nav.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.goto('/event/e1');
  await expect(page.getByRole('heading', { name: 'Event' })).toBeVisible();
  await expect(nav).toBeVisible();
  await page.goto('/event/e1/item/i1');
  await expect(page.getByRole('heading', { name: 'Item' })).toBeVisible();
  await expect(nav).toHaveCount(0);
});

test('once ready for offline, the app reopens in airplane mode', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => readMeta(page, 'readyForOffline'), { timeout: 15_000 })
    .toMatchObject({ catalogFile: null });
  expect(await readMeta(page, 'storagePersist')).toMatchObject({ askedAt: expect.any(String) });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Season' })).toBeVisible();
  await page.goto('/event/e1');
  await expect(page.getByRole('heading', { name: 'Event' })).toBeVisible();
});
