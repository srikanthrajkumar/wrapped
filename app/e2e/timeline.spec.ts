// Season as one timeline (the Maintainer, 2026-11-08): it opens at Now with the past above it,
// every day in date order, the rasika's own Events first and the Schedule's other listings
// quieter, with no add control on any row. A listing's sheet adds it, once, and it becomes theirs
// in place. Going into an Event and back finds Season where it was left.

import { expect, test, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { harnessScript } from './harness/build';
import { finishFirstLaunch, readTable } from './helpers';
import type { Harness } from './harness/entry';

/** A date `days` from today on this machine's clock, as the phone reads it. */
function dayFromToday(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

const entry = (id: string, days: number, fields: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
  id,
  version: 1,
  date: dayFromToday(days),
  startTime: '18:00',
  sabha: 'Music Academy',
  kind: 'concert',
  title: null,
  billed: [{ name: `Artist ${id}`, role: 'vocal', group: null }],
  cancelled: false,
  ...fields,
});

const brothers = entry('academy-1', 1, {
  startTime: '16:00',
  billed: [
    { name: 'Malladi Sreeramprasad', role: 'vocal', group: 'Malladi Brothers' },
    { name: 'Malladi Ravikumar', role: 'vocal', group: 'Malladi Brothers' },
    { name: 'Pakkala Ramadas', role: 'violin', group: null },
  ],
});

async function open(page: Page) {
  await page.goto('/');
  await finishFirstLaunch(page);
}

/** Store entries as a fetched file would leave them. */
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

/** The rasika's own Events, made through the store's actions: `days` from today each. */
async function makeEvents(
  page: Page,
  events: { days: number; planned?: boolean; time?: string }[],
) {
  await page.addScriptTag({ content: await harnessScript() });
  await page.evaluate(
    async (events) => {
      const { events: actions } = (globalThis as unknown as { harness: Harness }).harness;
      for (const one of events) {
        await actions.createEvent({
          kind: 'concert',
          date: one.date,
          startTime: one.time ?? '18:00',
          source: one.planned ? 'plan' : 'spot',
        });
      }
    },
    events.map((one) => ({ ...one, date: dayFromToday(one.days) })),
  );
}

/** A Concert holding Now: made by the +, with a note so it is kept. */
async function concertNow(page: Page) {
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('button', { name: 'Note' }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('front row');
  await page.getByRole('main').getByRole('link', { name: 'Season' }).click();
  await expect(page.getByRole('region', { name: 'Now' })).toBeVisible();
}

const dayHeadings = (page: Page) =>
  page.getByRole('main').getByRole('heading', { level: 2 }).allTextContents();

test('Season opens at Now, the days gone above it and not yet scrolled to', async ({ page }) => {
  await open(page);
  await makeEvents(page, [
    ...[-9, -8, -7, -6, -5, -4, -3, -2].map((days) => ({ days })),
    { days: 2, planned: true },
  ]);
  await page.reload();
  await concertNow(page);
  // A fresh launch, as the phone opens it.
  await page.reload();

  await expect(page.getByRole('region', { name: 'Now' })).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeInViewport();
  const past = page.locator(`#day-${dayFromToday(-2)}`);
  await expect(past).toHaveCount(1);
  await expect(past).not.toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  // Scrolling up runs back through the days gone, in date order.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(`#day-${dayFromToday(-9)}`)).toBeInViewport();
});

test.describe('with the web font arriving late', () => {
  // Fetched past the service worker, which would serve it from its cache, so its delay holds.
  test.use({ serviceWorkers: 'block' });

  test('Season opens at its header and holds still there while the days above draw', async ({
    page,
  }) => {
    // Safari has no scroll anchoring: a day above that draws taller than its likely height would
    // push the page down under the rasika. Chromium's anchoring is turned off to stand in for it.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = 'html, body { overflow-anchor: none !important; }';
        document.head.append(style);
      });
      // The header's place on screen in every frame painted, from the first. It is read as each
      // frame is about to paint, after the page's own ResizeObservers (the hold's among them) have
      // run, not at requestAnimationFrame: that runs before the frame's layout, so a reflow that
      // came in since the last frame (the web font arriving) would be read there before the hold
      // has answered it, a place no frame ever paints (the deploy of 4b319f2 read -49 so). A
      // ResizeObserver made after the page's runs after theirs; a 1px box resized each frame
      // calls it every frame.
      const w = window as unknown as {
        tops: number[];
        heldAt?: number;
        fontAt?: number;
        tick?: () => void;
      };
      w.tops = [];
      const tick = () => {
        requestAnimationFrame(tick);
        const header = document.querySelector('[data-place="header"]');
        if (!header) return;
        if (w.heldAt === undefined) {
          // The header is drawn, so the hold is set: it is made in the same commit.
          w.heldAt = performance.now();
          const box = document.createElement('div');
          box.style.cssText = 'position:fixed;top:0;left:0;height:1px;pointer-events:none';
          document.body.append(box);
          new ResizeObserver(() => {
            w.tops.push(Math.round(header.getBoundingClientRect().top));
          }).observe(box);
          w.tick = () => (box.style.width = box.style.width === '1px' ? '2px' : '1px');
        }
        w.tick?.();
      };
      requestAnimationFrame(tick);
      document.fonts.addEventListener('loadingdone', () => (w.fontAt = performance.now()));
    });
    // The web font arrives late, once the header is held: its text reflows the days above,
    // which the hold must follow too.
    await page.context().route('**/assets/*.woff2', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await open(page);
    // Days gone whose rows wrap to three lines, so each draws taller than its likely height.
    const long = (id: string, days: number, startTime: string) =>
      entry(id, days, {
        startTime,
        sabha: 'Sri Parthasarathy Swami Sabha, Vidya Bharathi Kalyana Mandapam',
        title: 'Thematic concert on the compositions of the Trinity',
        billed: [
          {
            name: `Thiruvarur Bhaktavatsalam Nagarajan Subramaniam ${id}`,
            role: 'vocal',
            group: null,
          },
        ],
      });
    await storeEntries(
      page,
      [-3, -2, -1].flatMap((days) =>
        ['10:00', '13:00', '16:00', '18:30'].map((time) => long(`p${days}${time}`, days, time)),
      ),
    );
    await makeEvents(page, [{ days: 1, planned: true }]);
    await page.reload();
    await expect(page.locator(`#day-${dayFromToday(1)}`)).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { fontAt?: number }).fontAt))
      .toBeDefined();
    await page.waitForTimeout(500);

    const { tops, heldAt, fontAt } = await page.evaluate(() => {
      const { tops, heldAt, fontAt } = window as unknown as {
        tops: number[];
        heldAt: number;
        fontAt?: number;
      };
      return { tops, heldAt, fontAt };
    });
    expect(tops.length).toBeGreaterThan(20);
    // The font came once the header was held, so its reflow was the hold's to follow.
    expect(fontAt).toBeGreaterThan(heldAt);
    // From its first frame on screen the header sits at the top, and never slides.
    expect([...new Set(tops)]).toEqual([0]);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});

test('without a Schedule, the timeline is the rasika’s own Events by date, opening at the next day', async ({
  page,
}) => {
  await open(page);
  await makeEvents(page, [
    { days: 3, planned: true },
    { days: -4 },
    { days: -1 },
    { days: 1, planned: true },
  ]);
  await page.reload();
  const days = [-4, -1, 1, 3].map(dayFromToday);
  await expect
    .poll(() =>
      page
        .locator('[data-place]')
        .evaluateAll((all) => all.map((n) => (n as HTMLElement).dataset.place)),
    )
    .toEqual([days[0], days[1], 'header', days[2], days[3]]);
  expect(await dayHeadings(page)).toHaveLength(4);
  // No Now: the page opens at the header, the next day under it, the past above.
  await expect(page.locator(`#day-${days[2]}`)).toBeInViewport();
  await expect(page.locator(`#day-${days[1]}`)).not.toBeInViewport();
  // The empty Season's + is there too, at the title.
  await expect(page.getByRole('button', { name: 'Log a Concert' })).toBeInViewport();
});

test('a listing has no add on its row; its sheet adds it once, and it becomes theirs in place', async ({
  page,
}) => {
  await open(page);
  await storeEntries(page, [brothers, entry('narada-1', 1, { sabha: 'Narada Gana Sabha' })]);
  await page.reload();
  const main = page.getByRole('main');
  const day = main.getByRole('region', { name: new RegExp(`^${dayHeadingText(1)}`) });

  // No add control anywhere on the timeline: a row is only its own tap.
  await expect(day.getByRole('button', { name: /^Malladi Brothers/ })).toBeVisible();
  await expect(main.getByRole('button', { name: /add/i })).toHaveCount(0);
  await expect(day.getByRole('listitem').getByRole('link')).toHaveCount(0);

  await day.getByRole('button', { name: /^Malladi Brothers/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Malladi Brothers' });
  // The full billing: each Artist with their Role and group, the Sabha and time.
  await expect(sheet).toContainText('Malladi Ravikumar');
  await expect(sheet).toContainText('Vocal');
  await expect(sheet).toContainText('Violin');
  await expect(sheet).toContainText('Pakkala Ramadas');
  await expect(sheet).toContainText('Music Academy');
  await expect(sheet).toContainText('4:00 pm');

  // Two quick taps plan it once.
  await sheet.getByRole('button', { name: 'Add' }).dblclick();
  await expect(sheet.getByRole('link', { name: 'Planned' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Add' })).toHaveCount(0);
  const events = await readTable<{ status: string; source: string }>(page, 'events');
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ status: 'planned', source: 'schedule' });

  // In place: the same day now holds it as theirs, once, and the listing is gone.
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(day.getByRole('link', { name: /^Malladi Brothers/ })).toHaveCount(1);
  await expect(day.getByRole('button', { name: /^Malladi Brothers/ })).toHaveCount(0);
  await expect(day.getByText('Malladi Brothers')).toHaveCount(1);
});

test('an entry whose planned Event was deleted is added again, once', async ({ page }) => {
  await open(page);
  await storeEntries(page, [brothers]);
  await page.reload();
  const row = page.getByRole('main').getByRole('button', { name: /^Malladi Brothers/ });
  const sheet = page.getByRole('dialog', { name: 'Malladi Brothers' });
  await row.click();
  await sheet.getByRole('button', { name: 'Add' }).click();
  await sheet.getByRole('link', { name: 'Planned' }).click();

  // The rasika deletes the planned Event, and lets its Undo lapse.
  await page.getByRole('button', { name: 'Concert actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete Event' }).click();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });

  // The entry is listed again; adding it plans it again, once, with nothing "not saved".
  await row.click();
  await sheet.getByRole('button', { name: 'Add' }).click();
  await expect(sheet.getByRole('link', { name: 'Planned' })).toBeVisible();
  await expect(page.getByText(/not saved/i)).toHaveCount(0);
  const events = await readTable<{ deletedAt: string | null }>(page, 'events');
  expect(events.filter((event) => event.deletedAt === null)).toHaveLength(1);
});

test('a cancelled listing is dimmed and its sheet has no add', async ({ page }) => {
  await open(page);
  await storeEntries(page, [entry('off-1', 1, { cancelled: true })]);
  await page.reload();
  const row = page.getByRole('button', { name: /^Artist off-1/ });
  await expect(row.getByRole('img', { name: 'Cancelled' })).toBeVisible();
  await row.click();
  const sheet = page.getByRole('dialog', { name: 'Artist off-1' });
  await expect(sheet.getByRole('img', { name: 'Cancelled' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Add' })).toHaveCount(0);
});

test('going into an Event, or a listing’s sheet, and back finds Season where it was', async ({
  page,
}) => {
  await open(page);
  // A long Season: four listings a day for a fortnight, and one Event of the rasika's deep in it.
  const listings = Array.from({ length: 14 }, (_, d) =>
    Array.from({ length: 4 }, (_, i) => entry(`e-${d}-${i}`, d + 1, { startTime: `1${i}:00` })),
  ).flat();
  await storeEntries(page, listings);
  await makeEvents(page, [{ days: 9, planned: true, time: '20:00' }]);
  await page.reload();

  const mine = page.getByRole('main').getByRole('link', { name: /^No Sabha yet/ });
  await mine.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -200));
  const before = (await mine.boundingBox())!.y;
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(1000);

  await mine.click();
  await expect(
    page
      .getByRole('link', { name: 'Add Item' })
      .or(page.getByRole('button', { name: 'Start logging' })),
  ).toBeVisible();
  // The Event opens at its top, not partway down.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(mine).toBeVisible();
  expect(Math.abs((await mine.boundingBox())!.y - before)).toBeLessThanOrEqual(1);

  // A listing's sheet opened and closed leaves the page where it was.
  const listing = page.getByRole('button', { name: /^Artist e-8-1/ });
  await listing.scrollIntoViewIfNeeded();
  const atSheet = await page.evaluate(() => window.scrollY);
  await listing.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(atSheet);
});

/** The day label a day `days` from today shows ("Tue 15 Dec"). */
function dayHeadingText(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() + days);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${weekdays[day.getDay()]} ${day.getDate()} ${months[day.getMonth()]}`;
}
