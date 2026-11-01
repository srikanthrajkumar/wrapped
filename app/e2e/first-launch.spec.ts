// T048e (eng D4, D8; design D10): first launch reaches "Ready to log offline" only once the
// service worker has every first-phase file in its precache, with real progress on the way; a
// stalled download says so and Try again resumes it; a cleared cache is noticed on the next
// launch, whatever an earlier answer said. tests/readiness.test.ts covers the same rules case by
// case, with a stand-in worker, including a missed message and a replacement worker.

import { expect, test } from '@playwright/test';
import { readMeta } from './helpers';

interface Progress {
  cached: number;
  total: number;
}

test('shows real progress and is ready only with the first phase cached', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: Progress[] = [];
    (window as unknown as { progress: Progress[] }).progress = seen;
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'INSTALL_PROGRESS') seen.push(event.data as Progress);
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Ready to log offline.' })).toBeVisible({
    timeout: 30_000,
  });

  const progress = await page.evaluate(
    () => (window as unknown as { progress: Progress[] }).progress,
  );
  expect(progress.length).toBeGreaterThan(1);
  const last = progress.at(-1)!;
  expect(last.cached).toBe(last.total);
  // Counts only rise.
  progress.reduce((before, step) => {
    expect(step.cached).toBeGreaterThanOrEqual(before);
    return step.cached;
  }, 0);
  expect(await readMeta(page, 'readyToLog')).toMatchObject({
    cached: last.total,
    total: last.total,
  });
});

test('an interrupted download stops, and Try again finishes it', async ({ page, context }) => {
  test.setTimeout(90_000);
  // A first-phase file the page itself never asks for: only the service worker fetches it.
  await context.route('**/assets/source-sans-3-ext-*.woff2', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'The download stopped. Logging needs it once, with a connection.',
    }),
  ).toBeVisible({ timeout: 40_000 });

  await context.unroute('**/assets/source-sans-3-ext-*.woff2');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Ready to log offline.' })).toBeVisible({
    timeout: 40_000,
  });
});

test('a cleared cache is found on the next launch, not trusted from before', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Ready to log offline.' })).toBeVisible({
    timeout: 30_000,
  });
  const before = (await readMeta(page, 'readyToLog')) as Progress;
  expect(before.cached).toBe(before.total);

  // The browser evicts the precache, as iOS may.
  await page.evaluate(async () => {
    for (const name of await caches.keys()) await caches.delete(name);
  });
  await page.reload();

  await expect
    .poll(async () => ((await readMeta(page, 'readyToLog')) as Progress | null)?.cached, {
      timeout: 15_000,
    })
    .toBeLessThan(before.total);
});
