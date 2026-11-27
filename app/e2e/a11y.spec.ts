// The accessibility pass on the screens (T110): what it fixed stays fixed. A kind's mark beside
// its word is not spoken twice, nothing but the searches raises the keyboard unasked, the Ragas
// list holds only list items, and a row focused on What's on is never under the pinned strip.

import { expect, test, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { finishFirstLaunch } from './helpers';

/** A new Concert's facts sheet, open. */
async function openFacts(page: Page) {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('button', { name: /Sat|Sun|Mon|Tue|Wed|Thu|Fri/ }).click();
  return page.getByRole('dialog');
}

test('a kind chip is named once, and a Lecdem waiting on its title raises no keyboard', async ({
  page,
}) => {
  const facts = await openFacts(page);
  // The mark beside the word is silent: "Dance", never "Dance Dance".
  for (const kind of ['Dance', 'Lecdem', 'Harikatha'])
    await expect(facts.getByRole('button', { name: kind, exact: true })).toBeVisible();

  await facts.getByRole('button', { name: 'Lecdem', exact: true }).click();
  const title = facts.getByRole('textbox', { name: 'Title' });
  await expect(title).toBeVisible();
  // Only the Item editor's search and the search sheets focus a field as they open (DESIGN.md
  // "Search box"); the title waits for a tap.
  await expect(title).not.toBeFocused();
  await expect(title).toHaveAttribute('autocomplete', 'off');
});

test("every child of the Item's Ragas list is a list item", async ({ page }) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  const ragas = page.getByRole('list', { name: 'Ragas, in order' });
  await expect(ragas.getByRole('button', { name: 'Raga, unknown' })).toBeVisible();
  // The "?" (and, with a Raga, Add Raga) is an item too, so the list is read whole.
  const roles = await ragas.evaluate((list) =>
    [...list.children].map((child) => child.getAttribute('role')),
  );
  expect(roles.length).toBeGreaterThan(0);
  expect(roles.every((role) => role === 'listitem')).toBe(true);
});

const entry = (id: string, date: string, startTime: string): ScheduleEntry => ({
  id,
  version: 1,
  date,
  startTime,
  sabha: `Sabha ${id}`,
  kind: 'concert',
  title: null,
  billed: [{ name: `Singer ${id}`, role: 'vocal', group: null, support: false }],
  cancelled: false,
});

test("a row focused on What's on clears the pinned strip and its day's label", async ({ page }) => {
  // Three days of eight, enough to scroll a day's rows up under the strip.
  const days = ['2026-12-19', '2026-12-20', '2026-12-21'];
  const entries = days.flatMap((date, d) =>
    Array.from({ length: 8 }, (_, i) => entry(`d${d}-${i}`, date, `${10 + i}:00`)),
  );
  await page.clock.setFixedTime(new Date('2026-12-19T08:00:00'));
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.evaluate(
    (entries) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('carnatic-wrapped');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const tx = request.result.transaction('schedule', 'readwrite');
          for (const one of entries) tx.objectStore('schedule').put(one);
          tx.oncomplete = () => {
            request.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    entries,
  );
  await page.reload();
  await page.locator('main h1').waitFor();
  await page.goto('/whats-on');
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();

  // A wheel lets go of the page's hold on where What's on opened (screens/pin.ts), as any input
  // of the rasika's does; then a row of the second day is scrolled wholly under the strip and
  // the day's label.
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 200);
  const covered = await page.evaluate(async () => {
    const rows = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-list] section[data-place]:nth-of-type(2) [data-row="concert"] :is(a, button)',
      ),
    ];
    const row = rows[4]!;
    row.setAttribute('data-probe', '');
    const label = row.closest('section')!.querySelector('h2')!;
    const frame = () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    // The label sticks under the strip, so its foot holds still once the day is scrolled to.
    for (let i = 0; i < 3; i += 1) {
      const by = row.getBoundingClientRect().bottom - label.getBoundingClientRect().bottom;
      window.scrollBy(0, by + 1);
      await frame();
    }
    return row.getBoundingClientRect().bottom <= label.getBoundingClientRect().bottom;
  });
  expect(covered).toBe(true);

  // Focused, as the keyboard or a screen reader's cursor would, it scrolls clear of both.
  await page.locator('[data-probe]').focus();
  const clear = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('[data-probe]')!;
    const label = row.closest('section')!.querySelector('h2')!.getBoundingClientRect();
    return row.getBoundingClientRect().top - label.bottom;
  });
  expect(clear).toBeGreaterThanOrEqual(-1);
});
