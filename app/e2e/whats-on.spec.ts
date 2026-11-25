// What's on, phase 3 (docs/design/screens/whats-on.md): what's on now folded from three
// (decision 1), the day labels with the Hub's word and the date (decision 2), "Show Past" in an
// empty list (decision 3), and today read the same with or without a filter (decision 4). The
// strip, the calendar and the search are in timeline.spec.ts.

import { expect, test, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { finishFirstLaunch, tab } from './helpers';

const DAY = '2026-12-19';
const at = (time: string, date = DAY) => new Date(`${date}T${time}:00`);

const entry = (
  id: string,
  startTime: string,
  fields: Partial<ScheduleEntry> = {},
): ScheduleEntry => ({
  id,
  version: 1,
  date: DAY,
  startTime,
  sabha: `Sabha ${id}`,
  kind: 'concert',
  title: null,
  billed: [{ name: `Singer ${id}`, role: 'vocal', group: null, support: false }],
  cancelled: false,
  ...fields,
});

// Sat 19 Dec, shaped as the real feed's peak days: at 4:10 pm one is over, four are under way
// and two are still to come. One the day before, for the days gone.
const SATURDAY = [
  entry('morning', '10:00'),
  entry('three', '15:00'),
  entry('four-a', '16:00'),
  entry('four-b', '16:00'),
  entry('four-c', '16:00'),
  entry('six', '18:00'),
  entry('seven', '19:00'),
  entry('friday', '18:00', { date: '2026-12-18' }),
];

async function storeEntries(page: Page, entries: ScheduleEntry[]) {
  await page.evaluate(
    (entries) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('carnatic-wrapped');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('schedule', 'readwrite');
          for (const one of entries) tx.objectStore('schedule').put(one);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    entries,
  );
}

/** What's on at `time`, opened from the hub's first section, with Saturday's Schedule stored. */
async function whatsOnAt(page: Page, time: Date, viaHub = true) {
  await page.clock.setFixedTime(time);
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, SATURDAY);
  await page.reload();
  await page.locator('main h1').waitFor();
  if (viaHub) await page.locator('main a[href="/whats-on"]').first().click();
  else await page.goto('/whats-on');
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
}

const today = (page: Page) =>
  page.getByRole('region', { name: 'Today, Saturday 19 December', exact: true });
/** The rows drawn in a day, by the name each leads with; the folds by their words. */
const lines = async (page: Page) =>
  (await today(page).getByRole('listitem').allInnerTexts()).map((text) =>
    text.split('\n')[0]!.trim(),
  );
const fold = (page: Page, name: RegExp) => today(page).getByRole('button', { name });

/** A name picked in the search, by Enter on its best match. */
async function filterOn(page: Page, typed: string) {
  await page.getByRole('button', { name: /^(Find an Artist or Sabha|Filter: )/ }).click();
  await page
    .getByRole('dialog', { name: 'Find an Artist or Sabha' })
    .getByRole('searchbox')
    .fill(typed);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Find an Artist or Sabha' })).toHaveCount(0);
}

test('at the peak, what is on now folds, and the next start is on the first screen', async ({
  page,
}) => {
  await whatsOnAt(page, at('16:10'));
  // The label says the Hub's word and the date (decision 2).
  await expect(today(page).getByRole('heading')).toHaveText('Today · Sat 19 Dec');
  // Four under way, something still to come: one "On now" row, after "Earlier today".
  const onNow = fold(page, /^On now/);
  await expect(onNow).toHaveText(/On now\s*4/);
  await expect(onNow).toHaveAttribute('aria-expanded', 'false');
  expect(await lines(page)).toEqual(['Earlier today', 'On now', 'Singer six', 'Singer seven']);
  // The next start, on the first screen, above the search bar.
  const six = today(page).getByText('Singer six');
  await expect(six).toBeInViewport();

  // Open, its rows show under it; "Earlier today" heads its own.
  await onNow.click();
  await expect(onNow).toHaveAttribute('aria-expanded', 'true');
  await fold(page, /^Earlier today/).click();
  expect(await lines(page)).toEqual([
    'Earlier today',
    'Singer morning',
    'On now',
    'Singer three',
    'Singer four-a',
    'Singer four-b',
    'Singer four-c',
    'Singer six',
    'Singer seven',
  ]);
  // The rows under way keep their dot.
  await expect(today(page).getByRole('img', { name: 'On now' })).toHaveCount(4);

  // Kept with the place: to another tab and back, both are still open.
  await tab(page, 'Shortlist').click();
  await tab(page, 'Season').click();
  await expect(fold(page, /^On now/)).toHaveAttribute('aria-expanded', 'true');
  await expect(fold(page, /^Earlier today/)).toHaveAttribute('aria-expanded', 'true');

  // Opened from the hub again, both start closed.
  await page.goto('/');
  await page.locator('main a[href="/whats-on"]').first().click();
  await expect(fold(page, /^On now/)).toHaveAttribute('aria-expanded', 'false');
  await expect(fold(page, /^Earlier today/)).toHaveAttribute('aria-expanded', 'false');
});

test('fewer than three under way show as rows, with no fold', async ({ page }) => {
  await whatsOnAt(page, at('15:30'));
  await expect(fold(page, /^On now/)).toHaveCount(0);
  expect(await lines(page)).toEqual([
    'Earlier today',
    'Singer three',
    'Singer four-a',
    'Singer four-b',
    'Singer four-c',
    'Singer six',
    'Singer seven',
  ]);
  await expect(today(page).getByRole('img', { name: 'On now' })).toHaveCount(1);
});

test('under a filter, today keeps its folds and dot, and an only fold starts open', async ({
  page,
}) => {
  await whatsOnAt(page, at('16:10'));
  // Its only match today is over: "Earlier today" opens, over the row (decisions 1 and 4).
  await filterOn(page, 'Singer morning');
  await expect(fold(page, /^Earlier today/)).toHaveAttribute('aria-expanded', 'true');
  expect(await lines(page)).toEqual(['Earlier today', 'Singer morning']);
  // A match under way keeps its dot under the filter.
  await page.locator('footer').getByRole('button', { name: 'Clear filters' }).click();
  await filterOn(page, 'Singer three');
  await expect(today(page).getByRole('img', { name: 'On now' })).toHaveCount(1);
});

test('an empty list from today offers the days gone', async ({ page }) => {
  await whatsOnAt(page, at('16:10'));
  // A filter on the day before's Artist: nothing ahead matches, and the days gone do.
  await filterOn(page, 'Singer friday');
  await expect(page.getByText('Nothing ahead matches')).toBeVisible();
  const showPast = page.getByRole('button', { name: 'Show Past', exact: true });
  const clear = page.locator('[data-list]').getByRole('button', { name: 'Clear filters' });
  // "Show Past" first, "Clear filters" under it.
  const top = async (l: ReturnType<Page['locator']>) => (await l.boundingBox())!.y;
  expect(await top(showPast)).toBeLessThan(await top(clear));
  await showPast.click();
  // The days gone, with the filter kept, focus on the first day's label.
  const friday = page.getByRole('region', { name: 'Fri 18 Dec', exact: true });
  await expect(friday.getByText('Singer friday')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Filter: / })).toHaveText('Singer friday');
  await expect(friday.getByRole('heading')).toBeFocused();
  // Past needs none: an Artist with nothing gone there gets the Empty and its clear only.
  await page.locator('footer').getByRole('button', { name: 'Clear filters' }).click();
  await filterOn(page, 'Singer seven');
  await expect(page.getByText('Nothing here matches')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Past' })).toHaveCount(0);
});

test('with nothing ahead, the days gone are offered', async ({ page }) => {
  await whatsOnAt(page, at('10:00', '2026-12-21'), false);
  await expect(page.getByText('Nothing ahead', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show Past', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Sat 19 Dec', exact: true })).toBeVisible();
});

test("tomorrow is labelled with the Hub's word, from its Tomorrow header", async ({ page }) => {
  await whatsOnAt(page, at('23:30', '2026-12-18'));
  const saturday = page.getByRole('region', { name: 'Tomorrow, Saturday 19 December' });
  await expect(saturday.getByRole('heading')).toHaveText('Tomorrow · Sat 19 Dec');
});
