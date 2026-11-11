import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { finishFirstLaunch, readMeta } from './helpers';

// The snapshot the build under test holds: none in CI, the real one before a deploy (ADR 0008).
const builtCatalog = (() => {
  try {
    const dir = join(import.meta.dirname, '../public/catalog');
    return readdirSync(dir).find((name) => /^catalog\.[0-9a-f]{64}\.json$/.test(name)) ?? null;
  } catch {
    return null;
  }
})();

test('first launch leads to the empty home, once', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Carnatic Wrapped' })).toBeVisible();
  await finishFirstLaunch(page);
  const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
  await expect(tabs).toHaveText(['Season', 'Shortlist', 'Diary']);
  await expect(tabs.first()).toHaveAttribute('aria-current', 'page');
  // Day one: the title with its + alone, no day yet, and no bottom bar (2026-11-08).
  await expect(page.getByRole('button', { name: 'Log a Concert' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(0);
  await expect(page.locator('footer [data-slot="button"]')).toHaveCount(0);

  // Once done, first launch never shows again.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
});

test('once ready for offline, the app reopens in airplane mode', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => readMeta(page, 'readyForOffline'), { timeout: 15_000 })
    .toMatchObject({ catalogFile: builtCatalog });
  expect(await readMeta(page, 'storagePersist')).toMatchObject({ askedAt: expect.any(String) });
  await finishFirstLaunch(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await expect(page.getByRole('button', { name: 'Add Sabha' })).toBeVisible();
});
