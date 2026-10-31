import { expect, test } from '@playwright/test';

test('the app shell opens at phone width', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Carnatic Wrapped' })).toBeVisible();
  const width = await page.evaluate(() => window.innerWidth);
  expect(width).toBe(390);
});
