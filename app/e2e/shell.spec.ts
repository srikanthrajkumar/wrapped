import { expect, test } from '@playwright/test';
import { finishFirstLaunch, readMeta } from './helpers';

test('first launch leads to the empty home at phone width', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Carnatic Wrapped' })).toBeVisible();
  await finishFirstLaunch(page);
  const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
  await expect(tabs).toHaveText(['Season', 'Wrapped', 'Settings']);
  await expect(tabs.first()).toHaveAttribute('aria-current', 'page');
  // Day one: the Now block alone (design D11).
  await expect(page.getByRole('button', { name: 'Log a Concert now' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next' })).toHaveCount(0);
  expect(await page.evaluate(() => window.innerWidth)).toBe(390);

  // Once done, first launch never shows again.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
});

test('the tabs switch screens, and the Item editor hides the tab bar', async ({ page }) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Wrapped' }).click();
  await expect(page.getByRole('heading', { name: 'Wrapped' })).toBeVisible();
  await nav.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('link', { name: 'Season', exact: true }).click();
  await page.getByRole('button', { name: 'Log a Concert now' }).click();
  await expect(page.getByRole('button', { name: 'Add Sabha' })).toBeVisible();
  await expect(nav).toBeVisible();
  await page.getByRole('link', { name: 'Add Item' }).click();
  // The one autofocus: the Item editor's search box (DD4).
  await expect(page.getByRole('searchbox', { name: 'Search songs and Ragas' })).toBeFocused();
  await expect(nav).toHaveCount(0);
});

test('once ready for offline, the app reopens in airplane mode', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => readMeta(page, 'readyForOffline'), { timeout: 15_000 })
    .toMatchObject({ catalogFile: null });
  expect(await readMeta(page, 'storagePersist')).toMatchObject({ askedAt: expect.any(String) });
  await finishFirstLaunch(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log a Concert now' }).click();
  await expect(page.getByRole('button', { name: 'Add Sabha' })).toBeVisible();
});
