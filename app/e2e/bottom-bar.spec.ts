import { expect, test, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { finishFirstLaunch, standInKeyboard } from './helpers';

// The bottom bar is the shell's (DESIGN.md "Motion"): moving between an Event and an Item never
// empties it or changes its height, so the tab bar never jumps. The hub has none (its search bar
// is What's on's since 2026-11-11), so the bar comes and goes in one step. Sampled every
// animation frame across each move, as the iPhone walkthrough's flicker was seen (2026-11-06).

type Sample = { bar: number; footer: number; buttons: number; labels: string };

/** Record the footer's height and the bar's buttons every frame until `stop` is called. */
async function sample(page: Page, move: () => Promise<void>): Promise<Sample[]> {
  await page.evaluate(() => {
    const w = window as unknown as { samples: Sample[]; sampling: boolean };
    w.samples = [];
    w.sampling = true;
    const tick = () => {
      if (!w.sampling) return;
      const footer = document.querySelector('footer')!;
      const bar = footer.firstElementChild as HTMLElement;
      const buttons = [...bar.querySelectorAll<HTMLElement>('[data-slot="button"]')].filter(
        (b) => b.getBoundingClientRect().height > 0,
      );
      w.samples.push({
        bar: bar.getBoundingClientRect().height,
        footer: footer.getBoundingClientRect().height,
        buttons: buttons.length,
        labels: buttons.map((b) => b.textContent).join('|'),
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await move();
  // A few frames past the new screen's first, for anything that would come late.
  await page.evaluate(() => new Promise((done) => setTimeout(done, 400)));
  return page.evaluate(() => {
    const w = window as unknown as { samples: Sample[]; sampling: boolean };
    w.sampling = false;
    return w.samples;
  });
}

/** The values in order, each run of repeats as one. */
const steps = <T>(values: T[]) => values.filter((v, i) => v !== values[i - 1]);

/**
 * Every frame shows an action in a bar of one height; the labels go once from `from` to `to`,
 * and the footer changes height at most once (the tab bar hiding for the Item editor).
 */
function expectSteady(samples: Sample[], from: string, to: string) {
  expect(samples.length).toBeGreaterThan(5);
  expect(samples.filter((s) => s.buttons === 0)).toEqual([]);
  expect(steps(samples.map((s) => Math.round(s.bar)))).toHaveLength(1);
  expect(steps(samples.map((s) => Math.round(s.footer))).length).toBeLessThanOrEqual(2);
  expect(steps(samples.map((s) => s.labels))).toEqual([from, to]);
}

/**
 * The bar comes (`to` its label) or goes (`to` null) in one step, never half there, and the
 * footer keeps one height while it shows and one while it doesn't: the tab bar never jumps.
 */
function expectOneStep(samples: Sample[], to: string | null) {
  expect(samples.length).toBeGreaterThan(5);
  const shown = steps(samples.map((s) => s.buttons > 0));
  expect(shown).toEqual(to === null ? [true, false] : [false, true]);
  for (const showing of [true, false]) {
    const heights = samples.filter((s) => s.buttons > 0 === showing).map((s) => s.footer);
    expect(new Set(heights).size).toBe(1);
  }
  const labels = new Set(samples.filter((s) => s.buttons > 0).map((s) => s.labels));
  expect(labels.size).toBe(1);
  if (to !== null) expect(labels).toEqual(new Set([to]));
}

test('the bottom bar never empties or shrinks between Event and Item, and goes in one step back on Season', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  const main = page.getByRole('main');

  // Season to a new Concert.
  let samples = await sample(page, async () => {
    await page.getByRole('button', { name: 'Log a Concert' }).click();
    await expect(page.getByRole('button', { name: 'Add Sabha' })).toBeVisible();
  });
  expectOneStep(samples, 'Add Item');

  // An Item to come back from and go into. The new Item's search has no bar of its own.
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();

  // Item to Event, Event to Item, and back with the top bar's chevron.
  samples = await sample(page, async () => {
    await page.getByRole('link', { name: 'Done' }).click();
    await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  });
  expectSteady(samples, 'Next Item|Done', 'Add Item');

  samples = await sample(page, async () => {
    await main.getByRole('link', { name: /^1 / }).click();
    await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();
  });
  expectSteady(samples, 'Add Item', 'Next Item|Done');

  samples = await sample(page, async () => {
    await main.getByRole('link', { name: 'Concert', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  });
  expectSteady(samples, 'Next Item|Done', 'Add Item');

  // Event to Season: the hub has no action of its own (its search bar went to What's on,
  // 2026-11-11), so the bar goes in one step, never half there.
  samples = await sample(page, async () => {
    await main.getByRole('link', { name: 'Season' }).click();
    await expect(page.getByRole('region', { name: 'Now' })).toBeVisible();
  });
  expectOneStep(samples, null);
});

// The bottom stack sits on the screen's bottom edge (the Maintainer's iPhone, 2026-11-25: in a
// Safari tab on iOS 26 it sat about 85pt up once the toolbar had hidden, What's on's rows
// scrolling under the tab bar, and flickered as the page moved). Safari leaves a sticky bottom
// where the toolbar's top was (Apple developer forums 801028), so the stack is fixed to the
// screen. No browser here hides a toolbar, so these hold the stack to the edge with no field in
// hand, after one is left, through a scroll, and as the screen grows by a toolbar's height.

const DAYS = ['2026-12-19', '2026-12-20', '2026-12-21', '2026-12-22', '2026-12-23'];
const TIMES = ['09:00', '11:00', '14:00', '16:00', '18:00', '19:30'];

/** Thirty listings over five days: a What's on several screens long. */
const LONG_SCHEDULE: ScheduleEntry[] = DAYS.flatMap((date, d) =>
  TIMES.map((startTime, t) => ({
    id: `long-${d}-${t}`,
    version: 1,
    date,
    startTime,
    sabha: `Sabha ${d}${t}`,
    kind: 'concert' as const,
    title: null,
    billed: [{ name: `Singer ${d}${t}`, role: 'vocal', group: null, support: false }],
    cancelled: false,
  })),
);

async function storeSchedule(page: Page, entries: ScheduleEntry[]) {
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

/** How far the stack's foot is from the screen's: 0 when it is on the bottom edge. */
const footerLift = (page: Page) =>
  page.evaluate(() =>
    Math.round(
      window.innerHeight - document.querySelector('footer')!.getBoundingClientRect().bottom,
    ),
  );

async function openLongWhatsOn(page: Page) {
  await page.clock.setFixedTime(new Date('2026-12-19T08:00:00'));
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeSchedule(page, LONG_SCHEDULE);
  await page.goto('/whats-on');
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
  await expect(page.locator('footer [data-season-bar]')).toBeVisible();
}

test('the bottom stack sits on the bottom edge through a scroll, and the page ends above it', async ({
  page,
}) => {
  await openLongWhatsOn(page);
  // Fixed to the screen: a sticky stack is left up where Safari's toolbar was.
  expect(await page.locator('footer').evaluate((f) => getComputedStyle(f).position)).toBe('fixed');
  await expect.poll(() => footerLift(page)).toBe(0);

  // A page several screens long, scrolled through.
  const long = await page.evaluate(
    () => document.documentElement.scrollHeight > 2 * window.innerHeight,
  );
  expect(long).toBe(true);
  for (const to of [0.3, 0.6]) {
    await page.evaluate((by) => window.scrollBy(0, by), to * 1000);
    await expect.poll(() => footerLift(page)).toBe(0);
  }

  // At the page's end its last row stands clear above the stack.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => footerLift(page)).toBe(0);
  const last = page.getByRole('main').getByRole('listitem').last();
  await expect(last).toContainText('Singer 45');
  const lastFoot = (await last.boundingBox())!;
  const stackTop = (await page.locator('footer').boundingBox())!.y;
  expect(lastFoot.y + lastFoot.height).toBeLessThanOrEqual(stackTop);

  // The screen grows by a toolbar's height, as Safari's does when its toolbar hides.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: size.height + 85 });
  await expect.poll(() => footerLift(page)).toBe(0);
  await page.evaluate((by) => window.scrollBy(0, by), -400);
  await expect.poll(() => footerLift(page)).toBe(0);
});

test('after a search, with the field gone, the bottom stack is back on the bottom edge', async ({
  page,
}) => {
  const keyboard = await standInKeyboard(page);
  await openLongWhatsOn(page);
  await page.getByRole('button', { name: 'Find an Artist or Sabha' }).click();
  const sheet = page.getByRole('dialog', { name: 'Find an Artist or Sabha' });
  await sheet.getByRole('searchbox').fill('Singer 2');
  await keyboard(336, true);
  // A name picked closes the sheet; the phone goes on reporting the keyboard, unannounced.
  await page.keyboard.press('Enter');
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('footer [data-season-bar]')).toContainText('Singer 2');
  await expect.poll(() => footerLift(page)).toBe(0);
  await page.evaluate((by) => window.scrollBy(0, by), 300);
  await expect.poll(() => footerLift(page)).toBe(0);
});
