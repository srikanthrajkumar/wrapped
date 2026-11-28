import { expect, test } from '@playwright/test';

// The public privacy policy (app/src/privacy/page.ts) for Google's brand verification: a plain
// document anyone can read at /privacy, before or after the service worker runs, and a link to
// it on first launch's Welcome step.

test('the privacy policy is served as its own page, readable without running anything', async ({
  request,
}) => {
  const response = await request.get('/privacy');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/html');
  const html = await response.text();
  expect(html).toContain('<h1>Privacy policy</h1>');
  expect(html).not.toContain('id="root"');
  for (const words of ['privacy@carnatic.live', 'Mumbai', '30 days', 'profile picture']) {
    expect(html).toContain(words);
  }
  // Public words only: never the project's working name or a server address.
  expect(html).not.toMatch(/wrapped|supabase\.co/i);
});

test('once the service worker runs, /privacy still opens as itself', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const response = await page.goto('/privacy');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
  expect(await page.locator('#root').count()).toBe(0);
  // Never in the phone's download (globIgnores in vite.config.ts).
  const precached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(precached.filter((url) => url.includes('privacy'))).toEqual([]);
});

test('Welcome links to the privacy policy, in a new tab that leaves first launch as it was', async ({
  page,
}) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Privacy policy' });
  await expect(link).toBeVisible();
  const [policy] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  await expect(policy.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'carnatic.live' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});
