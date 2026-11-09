// Season as one timeline (the Maintainer, 2026-11-08): every day in date order, the rasika's own
// Events first and the Schedule's other listings quieter, with no add control on any row. A
// listing's sheet adds it, once, and it becomes theirs in place. Nothing sits above the curtain:
// Season opens at its very top, from today on; the days gone are a page of their own, opened
// from a history mark left of the + (2026-11-09). Back from an Event, or from the days gone,
// finds each page where it was left.

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

/** Installed to the home screen, as the Maintainer uses it: the curtain, no install row. */
async function installed(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true });
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('display-mode: standalone')
        ? ({ ...original(query), matches: true, media: query } as MediaQueryList)
        : original(query);
  });
}

const dayHeadings = (page: Page) =>
  page.getByRole('main').getByRole('heading', { level: 2 }).allTextContents();

const places = (page: Page) =>
  page
    .locator('[data-place]')
    .evaluateAll((all) => all.map((n) => (n as HTMLElement).dataset.place));

/** Season's history mark, which opens the days gone. */
const earlierMark = (page: Page) =>
  page.getByRole('main').getByRole('link', { name: 'Earlier', exact: true });

const earlierHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Earlier', exact: true, level: 1 });

/** The curtain's title sits at the very top of the page, with nothing above it. */
async function atTheTop(page: Page) {
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect((await places(page))[0]).toBe('header');
  const top = await page
    .locator('[data-place="header"]')
    .evaluate((header) => header.getBoundingClientRect().top + window.scrollY);
  expect(top).toBeLessThanOrEqual(0);
}

/**
 * The top of what `selector` finds in every frame painted from now on, from the frame it is
 * drawn in. Read as each frame is about to paint, after the page's own ResizeObservers (the
 * hold's among them): a ResizeObserver made after the page's runs after theirs, and a 1px box
 * resized each frame calls it every frame. Read at requestAnimationFrame instead, a reflow come
 * in since the last frame shows before the hold has answered it, a place no frame paints.
 */
async function watchTops(page: Page, selector: string) {
  await page.evaluate((selector) => {
    const w = window as unknown as { tops: number[] };
    w.tops = [];
    const before = document.querySelector(selector);
    const tick = () => {
      const found = document.querySelector(selector);
      // Once drawn anew, the page's own observers for it are made: in the same commit.
      if (!found || found === before) return void requestAnimationFrame(tick);
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;top:0;left:0;height:1px;pointer-events:none';
      document.body.append(box);
      new ResizeObserver(() => {
        w.tops.push(Math.round(found.getBoundingClientRect().top));
      }).observe(box);
      const resize = () => {
        box.style.width = box.style.width === '1px' ? '2px' : '1px';
        requestAnimationFrame(resize);
      };
      resize();
    };
    tick();
  }, selector);
  return () => page.evaluate(() => (window as unknown as { tops: number[] }).tops);
}

test('Season opens at its very top, from today on, the days gone behind a mark by the +', async ({
  page,
}) => {
  await open(page);
  await makeEvents(page, [
    ...[-9, -8, -7, -6, -5, -4, -3, -2].map((days) => ({ days })),
    { days: 2, planned: true },
  ]);
  await page.reload();
  await concertNow(page);
  // Scrolled down before a fresh launch, as the phone may have been left.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.reload();

  await expect(page.getByRole('region', { name: 'Now' })).toBeInViewport();
  await atTheTop(page);
  // No day gone on Season: the header, Now, then the days to come.
  expect(await places(page)).toEqual(['header', 'now', dayFromToday(2)]);
  // The mark sits in the title's row, just left of the +, its twin in size and tap.
  const mark = (await earlierMark(page).boundingBox())!;
  const plus = (await page.getByRole('button', { name: 'Log a Concert' }).boundingBox())!;
  expect(mark).toEqual({ ...plus, x: plus.x - plus.width });
  expect(plus.width).toBeGreaterThanOrEqual(48);
  expect(plus.height).toBeGreaterThanOrEqual(48);
});

test('the mark opens the days gone as a page, newest first; back finds Season where it was', async ({
  page,
}) => {
  await installed(page);
  await open(page);
  await storeEntries(page, [
    entry('past-1', -1, { sabha: 'Narada Gana Sabha' }),
    ...Array.from({ length: 12 }, (_, i) => entry(`next-${i}`, 1 + (i % 4))),
  ]);
  await makeEvents(page, [{ days: -3 }, { days: -1, time: '10:00' }]);
  await page.reload();
  // Season a little scrolled, its mark still whole on the screen (a click scrolls to it).
  const markTop = (await earlierMark(page).boundingBox())!.y;
  const scrolled = Math.floor(markTop) - 4;
  expect(scrolled).toBeGreaterThan(20);
  await page.evaluate((y) => window.scrollTo(0, y), scrolled);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolled);

  await earlierMark(page).click();
  await expect(earlierHeading(page)).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // The nearest day first, and only the days gone.
  expect(await places(page)).toEqual(['header', dayFromToday(-1), dayFromToday(-3)]);
  // A day gone holds the rasika's own Event, then the Schedule's listing, quieter, as on Season.
  const yesterday = page.getByRole('region', { name: dayHeadingText(-1) });
  await expect(yesterday.getByRole('link', { name: /^No Sabha yet/ })).toBeVisible();
  await yesterday.getByRole('button', { name: /^Artist past-1/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Artist past-1' });
  await expect(sheet).toContainText('Narada Gana Sabha');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // Back, as from an Event: Season where it was left.
  await page.getByRole('main').getByRole('link', { name: 'Season', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolled);
  // Opened again, the days gone start at their top.
  await earlierMark(page).click();
  await expect(earlierHeading(page)).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('back from an Event opened on the days gone finds them where they were, held still', async ({
  page,
}) => {
  // Safari has no scroll anchoring: days gone whose rows wrap to three lines draw taller than
  // their likely height, and back from an Event the hold must keep the page still while they
  // do (screens/pin.ts). Chromium's anchoring is turned off to stand in for it.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'html, body { overflow-anchor: none !important; }';
      document.head.append(style);
    });
  });
  await open(page);
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
    [-1, -2, -3, -4].flatMap((days) =>
      ['10:00', '13:00', '16:00'].map((time) => long(`p${days}${time}`, days, time)),
    ),
  );
  await makeEvents(page, [
    { days: -5, time: '18:00' },
    { days: 1, planned: true },
  ]);
  await page.reload();
  await earlierMark(page).click();

  // The rasika's own Event, the oldest day, under four days of long listings.
  const mine = page.getByRole('region', { name: dayHeadingText(-5) }).getByRole('link');
  await mine.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  const before = Math.round((await mine.boundingBox())!.y);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

  await mine.click();
  await expect(earlierHeading(page)).toHaveCount(0);
  // The Event opens at its top, its back named for the days gone.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const back = page.getByRole('main').getByRole('link', { name: 'Earlier', exact: true });
  const tops = await watchTops(page, `#day-${dayFromToday(-5)}`);
  await back.click();
  await expect(mine).toBeVisible();
  await page.waitForTimeout(500);
  expect(Math.round((await mine.boundingBox())!.y)).toBe(before);
  // Every frame painted since it came back has its day where it was left.
  const seen = await tops();
  expect(seen.length).toBeGreaterThan(20);
  expect(new Set(seen).size).toBe(1);

  // The browser's own back does the same.
  await mine.click();
  await expect(back).toBeVisible();
  await page.goBack();
  await expect(mine).toBeVisible();
  await page.waitForTimeout(300);
  expect(Math.round((await mine.boundingBox())!.y)).toBe(before);

  // Back to Season, at its top as it was left; a fresh launch is at the top too.
  await page.getByRole('main').getByRole('link', { name: 'Season', exact: true }).click();
  await atTheTop(page);
  await page.reload();
  await atTheTop(page);
});

test('without a Schedule, the timeline is the rasika’s own Events by date, from the top', async ({
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
  await expect.poll(() => places(page)).toEqual(['header', days[2], days[3]]);
  expect(await dayHeadings(page)).toHaveLength(2);
  await atTheTop(page);
  await expect(page.locator(`#day-${days[2]}`)).toBeInViewport();
  await earlierMark(page).click();
  await expect(earlierHeading(page)).toBeVisible();
  expect(await places(page)).toEqual(['header', days[1], days[0]]);
});

test('with no days gone there is no history mark, and Season opens at its top', async ({
  page,
}) => {
  await open(page);
  await atTheTop(page);
  await expect(earlierMark(page)).toHaveCount(0);
  await makeEvents(page, [
    { days: 0, time: '09:00' },
    { days: 2, planned: true },
  ]);
  await storeEntries(page, [entry('next-1', 1)]);
  await page.reload();
  await expect(page.locator(`#day-${dayFromToday(1)}`)).toBeVisible();
  await expect(earlierMark(page)).toHaveCount(0);
  await atTheTop(page);
  // The + is there with nothing gone, at the title.
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
