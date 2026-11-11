// What's on (the Season spine, 2026-11-11; DESIGN.md "What's on"): the full list, one tap below
// Season. A strip of days (Today · each date ahead) pinned over the list from today on, a tap
// jumping to a day and the strip following the scroll; the days gone are reached through the
// calendar, newest first, in place. Each day lists every concert once, by start time, with no
// add control on any row. One filter box, "Artist or Sabha…", with the kinds as toggles, prunes
// the list and the strip. A listing's sheet Shortlists it, once, and it becomes theirs in
// place. Back from an Event finds What's on where it was left. (The hub's own tests are in
// hub.spec.ts.)

import { expect, test, type Page } from '@playwright/test';
import type { EventKind, ScheduleEntry } from '../src/model';
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

/** What's on, loaded afresh: from today, at its top. */
async function whatsOn(page: Page) {
  await page.goto('/whats-on');
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
}

/** The days gone, through the calendar (SF-D32): the day `n` days back tapped. */
async function daysGone(page: Page, n: number) {
  await page.getByRole('button', { name: 'Pick a day' }).click();
  const calendar = page.getByRole('dialog', { name: 'Pick a day' });
  const day = calendar.getByRole('button', { name: dayHeadingText(n), exact: true });
  for (let i = 0; i < 3 && (await day.count()) === 0; i++)
    await calendar.getByRole('button', { name: 'Previous month' }).click();
  await day.click();
  await expect(calendar).toHaveCount(0);
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

interface NewOwn {
  days: number;
  planned?: boolean;
  time?: string;
  kind?: EventKind;
  sabha?: string;
  /** Vocal Artists on its Stage. */
  artists?: string[];
}

/** The rasika's own Events, made through the store's actions: `days` from today each. */
async function makeEvents(page: Page, events: NewOwn[]) {
  await page.addScriptTag({ content: await harnessScript() });
  await page.evaluate(
    async (events) => {
      const { events: actions, people } = (globalThis as unknown as { harness: Harness }).harness;
      for (const one of events) {
        const sabha = one.sabha ? await people.createSabha(one.sabha) : null;
        const made = await actions.createEvent({
          kind: one.kind ?? 'concert',
          date: one.date,
          startTime: one.time ?? '18:00',
          source: one.planned ? 'plan' : 'spot',
          sabhaId: sabha?.id ?? null,
        });
        for (const name of one.artists ?? []) {
          const artist = await people.createArtist(name);
          await people.addAppearance(made.id, artist.id, { role: 'vocal' });
        }
      }
    },
    events.map((one) => ({ ...one, date: dayFromToday(one.days) })),
  );
}

/** A Sabha on the Maintainer's shared list, as a sync leaves it. */
async function shareSabha(page: Page, sabha: { id: string; name: string; aliases: string[] }) {
  await page.addScriptTag({ content: await harnessScript() });
  await page.evaluate(
    (sabha) =>
      (globalThis as unknown as { harness: Harness }).harness.db.sharedSabhas.put({
        ...sabha,
        listVersion: 1,
      }),
    sabha,
  );
}

/** The page's places, the days among them: the header, the filter, then each day listed. */
const places = (page: Page) =>
  page
    .locator('[data-place]')
    .evaluateAll((all) => all.map((n) => (n as HTMLElement).dataset.place));

/** The days listed, by date. */
const listed = (page: Page) =>
  page
    .locator('[data-list] section[data-place]')
    .evaluateAll((all) => all.map((n) => (n as HTMLElement).dataset.place));

const strip = (page: Page) => page.getByRole('navigation', { name: 'Days' });

/** A stop on the strip: Past, Today, or a day by its label ("Tue 15 Dec"). */
const stop = (page: Page, name: string) => strip(page).getByRole('button', { name, exact: true });

/** The strip's stops, by name. */
const stops = (page: Page) =>
  strip(page)
    .getByRole('button')
    .evaluateAll((all) => all.map((b) => b.getAttribute('aria-label') ?? b.textContent));

/** The stop marked as in view. */
const marked = (page: Page) =>
  strip(page)
    .locator('[aria-current="true"]')
    .evaluate((b) => b.getAttribute('aria-label') ?? b.textContent);

/** The bottom of the strip, pinned at the top of the screen. */
const stripBottom = async (page: Page) => {
  const box = (await strip(page).boundingBox())!;
  return box.y + box.height;
};

/** Each row listed, by its first line: the name it leads with. */
const rows = async (page: Page) =>
  (await page.locator('[data-list] li').allInnerTexts()).map((text) => text.split('\n')[0]);

/** The search bar above the tab bar: its placeholder, or the filter on. */
const searchBar = (page: Page) =>
  page.getByRole('button', { name: /^(Find an Artist or Sabha|Filter: )/ });

const searchSheet = (page: Page) => page.getByRole('dialog', { name: 'Find an Artist or Sabha' });

/** The bar tapped: its sheet opens with the field focused, the keyboard up. */
async function openSearch(page: Page) {
  await searchBar(page).click();
  await expect(
    searchSheet(page).getByRole('searchbox', { name: 'Find an Artist or Sabha' }),
  ).toBeFocused();
}

async function closeSearch(page: Page) {
  await page.keyboard.press('Escape');
  await expect(searchSheet(page)).toHaveCount(0);
}

/** Type in the sheet and pick the suggestion named `name`, of the sort `sort`: it closes. */
async function pick(page: Page, typed: string, name: string, sort: string) {
  await openSearch(page);
  await searchSheet(page).getByRole('searchbox').fill(typed);
  await searchSheet(page)
    .getByRole('button', { name: `${name} ${sort}`, exact: true })
    .click();
  await expect(searchSheet(page)).toHaveCount(0);
}

/** A text toggle in the sheet (Mine, a kind) tapped, the sheet then closed. */
async function toggle(page: Page, name: string) {
  await openSearch(page);
  await searchSheet(page).getByRole('button', { name, exact: true }).click();
  await closeSearch(page);
}

/** The list's own "Clear filters", where a filter matches nothing. */
const clearInList = (page: Page) =>
  page.locator('[data-list]').getByRole('button', { name: 'Clear filters' });

/** Scroll so the day named rests `past` px under the pinned strip (twice: the strip pins first). */
async function bringUnder(page: Page, name: string, past = 0) {
  for (let i = 0; i < 2; i++) {
    await page.getByRole('region', { name }).evaluate((day, past) => {
      const strip = document.querySelector('[data-strip]')!;
      window.scrollBy(
        0,
        day.getBoundingClientRect().top - strip.getBoundingClientRect().bottom + past,
      );
    }, past);
  }
}

/** The page is at its very top: its header first, with nothing above it. */
async function atTheTop(page: Page) {
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeInViewport();
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

test('the strip: Today, each date ahead; a tap jumps to its day, and it follows the scroll', async ({
  page,
}) => {
  await open(page);
  // A long Season: four listings a day for ten days, and one day gone.
  await storeEntries(page, [
    entry('gone', -2),
    ...Array.from({ length: 10 }, (_, d) =>
      Array.from({ length: 4 }, (_, i) => entry(`e-${d}-${i}`, d + 1, { startTime: `1${i}:00` })),
    ).flat(),
  ]);
  await whatsOn(page);
  await expect
    .poll(() => stops(page))
    .toEqual(['Today', ...Array.from({ length: 10 }, (_, d) => dayHeadingText(d + 1))]);
  // From today on, every day listed, the strip on Today.
  expect(await listed(page)).toEqual(Array.from({ length: 10 }, (_, d) => dayFromToday(d + 1)));
  expect(await marked(page)).toBe('Today');
  // One chosen stop, by aria-current; no dot and no pill (its ink follows time).
  await expect(strip(page).locator('[aria-current="true"]')).toHaveCount(1);
  await expect(strip(page).locator('[data-dot]')).toHaveCount(0);
  for (const name of ['Today', dayHeadingText(1)]) {
    expect((await stop(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }

  // Scrolled by hand, the strip follows: the day under it is the one marked.
  await bringUnder(page, dayHeadingText(3), 40);
  await expect.poll(() => marked(page)).toBe(dayHeadingText(3));
  // Further on, the marked day is slid into the strip's view.
  await bringUnder(page, dayHeadingText(8), 40);
  await expect.poll(() => marked(page)).toBe(dayHeadingText(8));
  await expect(stop(page, dayHeadingText(8))).toBeInViewport({ ratio: 1 });

  // A day tapped starts the list there, the page back at its top with the header in place
  // (the Maintainer's iPhone, 2026-11-09: a tap scrolled the header away), and it is marked.
  await stop(page, dayHeadingText(6)).click();
  await expect.poll(() => marked(page)).toBe(dayHeadingText(6));
  await atTheTop(page);
  expect(await listed(page)).toEqual(Array.from({ length: 5 }, (_, d) => dayFromToday(d + 6)));
  const label = page.locator(`#day-${dayFromToday(6)}`);
  expect(Math.abs((await label.boundingBox())!.y - (await stripBottom(page)))).toBeLessThanOrEqual(
    1,
  );
  // The same tap from deep in the list lands in the same place.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await stop(page, dayHeadingText(6)).click();
  await atTheTop(page);
  expect((await listed(page))[0]).toBe(dayFromToday(6));
  // Scrolled on within the day, its label sticks under the strip.
  await bringUnder(page, dayHeadingText(6), 60);
  await expect.poll(async () => (await label.boundingBox())!.y).toBe(await stripBottom(page));
  expect(await marked(page)).toBe(dayHeadingText(6));

  // The last day too: alone, under the header.
  await stop(page, dayHeadingText(10)).click();
  await atTheTop(page);
  expect(await listed(page)).toEqual([dayFromToday(10)]);
  expect(await marked(page)).toBe(dayHeadingText(10));

  // Today: the list from today again.
  await stop(page, 'Today').click();
  await atTheTop(page);
  expect(await listed(page)).toEqual(Array.from({ length: 10 }, (_, d) => dayFromToday(d + 1)));
  expect(await marked(page)).toBe('Today');
});

// The Maintainer's iPhone, 2026-11-09: the first row under a day's label read dimmer than the
// rest when nothing had passed under the label, as a jump leaves a day.
test('a stuck day label fades only the rows that have passed under it', async ({ page }) => {
  await open(page);
  await storeEntries(page, [
    ...Array.from({ length: 10 }, (_, d) =>
      Array.from({ length: 4 }, (_, i) => entry(`e-${d}-${i}`, d + 1, { startTime: `1${i}:00` })),
    ).flat(),
  ]);
  await whatsOn(page);
  await expect.poll(() => listed(page)).toHaveLength(10);
  const label = page.locator(`#day-${dayFromToday(3)}`);
  // The fade under the label, as drawn.
  const fade = () =>
    label.evaluate((h) => Number(getComputedStyle(h, '::after').opacity.replace(/^$/, '0')));
  const restAt = (past: number) => bringUnder(page, dayHeadingText(3), past);
  // Resting just under the strip: its first row is under nothing, and shows in full.
  await restAt(0);
  await expect.poll(async () => (await label.boundingBox())!.y).toBe(await stripBottom(page));
  await page.waitForTimeout(100);
  expect(await fade()).toBe(0);
  // Halfway into the fade's 24px, half faded; past it, in full.
  await restAt(12);
  await expect.poll(fade).toBeCloseTo(0.5, 1);
  await restAt(40);
  await expect.poll(fade).toBe(1);
});

// The Maintainer's iPhone, 2026-11-10: on a fast fling from one day to the next, rows ran over
// the day's label. Safari moves a sticky label inside paint containment (which skipping a day's
// drawing brings) only once the fling's frame is done; so no label sits in it, and only the rows
// skip drawing.
test('no day label sits inside paint containment, so it holds through a fling', async ({
  page,
}) => {
  await open(page);
  await storeEntries(page, [entry('e-1', 1), entry('e-2', 2), entry('e-3', 3)]);
  await whatsOn(page);
  await expect.poll(() => listed(page)).toHaveLength(3);
  const clipped = await page.locator('[data-list] section h2').evaluateAll((labels) =>
    labels.flatMap((label) => {
      for (let up = label.parentElement; up && up !== document.body; up = up.parentElement) {
        const style = getComputedStyle(up);
        const contain = `${style.contain} ${style.contentVisibility}`;
        if (/paint|strict|content|auto|hidden/.test(contain))
          return [`${label.textContent}: ${up.tagName} ${contain}`];
      }
      return [];
    }),
  );
  expect(clipped).toEqual([]);
  // The rows still skip drawing while far from the screen.
  const skipping = await page
    .locator('[data-list] section ul')
    .first()
    .evaluate((list) => getComputedStyle(list).contentVisibility);
  expect(skipping).toBe('auto');
});

// The Maintainer, 2026-11-10: Season's bar "looks too different from the way the other search
// bars work": it takes the search field's shape, its corners, mark and text where the field's are.
test('the search bar has the search field’s shape', async ({ page }) => {
  await open(page);
  await storeEntries(page, [entry('e-1', 1)]);
  await whatsOn(page);
  await expect(searchBar(page)).toBeVisible();
  // The filled box's corners and height, and where its mark and its text start inside it.
  const shape = (box: string, words: string) =>
    page.evaluate(
      ({ box, words }) => {
        const fill = document.querySelector<HTMLElement>(box)!;
        const at = fill.getBoundingClientRect();
        const mark = fill.parentElement!.querySelector('svg')!.getBoundingClientRect();
        const text = document.querySelector<HTMLElement>(words)!;
        return {
          radius: getComputedStyle(fill).borderTopLeftRadius,
          height: Math.round(at.height),
          mark: Math.round(mark.left - at.left),
          words: Math.round(
            text instanceof HTMLInputElement
              ? parseFloat(getComputedStyle(text).paddingLeft)
              : text.getBoundingClientRect().left - at.left,
          ),
        };
      },
      { box, words },
    );
  const barShape = await shape('[data-season-bar]', '[data-season-bar] button > span');
  await openSearch(page);
  const field = '[role=dialog] input[type=search]';
  const fieldShape = await shape(field, field);
  expect(barShape).toEqual(fieldShape);
});

test('the search sheet’s toggles stay put as they turn on, on one line at 390px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await storeEntries(page, [
    entry('c', 1),
    entry('d', 1, { kind: 'dance' }),
    entry('l', 2, { kind: 'lecdem' }),
    entry('h', 2, { kind: 'harikatha' }),
  ]);
  await whatsOn(page);
  await expect.poll(() => listed(page)).toHaveLength(2);
  await openSearch(page);
  // Mine went on 2026-11-11: the Shortlist is its own tab.
  const names = ['Dance', 'Lecdem', 'Harikatha'];
  const toggle = (name: string) => searchSheet(page).getByRole('button', { name, exact: true });
  // All read in one frame, as the sheet may still be sliding up.
  const boxes = () =>
    searchSheet(page)
      .locator('[data-toggle]')
      .evaluateAll((all) =>
        all.map((b) => {
          const box = b.getBoundingClientRect();
          const name = b.querySelector('span > span:last-child')?.textContent ?? '';
          return [name, Math.round(box.left), Math.round(box.right), box.top] as const;
        }),
      );
  // Across: where each starts and ends (the sheet may still be settling up or down).
  const across = (all: Awaited<ReturnType<typeof boxes>>) =>
    all.map(([name, left, right]) => [name, left, right]);
  // One line: every toggle's top within a pixel of the first's.
  const oneLine = (all: Awaited<ReturnType<typeof boxes>>) =>
    all.every(([, , , top]) => Math.abs(top - all[0]![3]) < 1);
  const off = await boxes();
  expect(off.map(([name]) => name)).toEqual(names);
  // One line, inside the gutter.
  expect(oneLine(off)).toBe(true);
  expect(Math.max(...off.map(([, , right]) => right))).toBeLessThanOrEqual(390 - 16);
  for (const name of ['Harikatha', 'Lecdem', 'Dance']) {
    await toggle(name).click();
    await expect(toggle(name)).toHaveAttribute('aria-pressed', 'true');
    const on = await boxes();
    expect(across(on)).toEqual(across(off));
    expect(oneLine(on)).toBe(true);
  }
});

test('the days gone, through the calendar: newest first, in place of the list; Today brings it back', async ({
  page,
}) => {
  await open(page);
  await storeEntries(page, [
    entry('next-1', 1),
    entry('next-2', 2),
    entry('gone-1', -1, { startTime: '20:00' }),
    entry('gone-3', -3),
  ]);
  await makeEvents(page, [{ days: -1, time: '10:00', artists: ['Yesterday Vocalist'] }]);
  await whatsOn(page);
  await expect.poll(() => listed(page)).toEqual([dayFromToday(1), dayFromToday(2)]);
  await expect(page.getByRole('region', { name: 'Past', exact: true })).toHaveCount(0);
  // Past is not on the strip (SF-D32): a day gone is two taps away, the calendar and the day.
  expect(await stops(page)).not.toContain('Past');

  await daysGone(page, -1);
  await expect(page.getByRole('region', { name: 'Past', exact: true })).toBeVisible();
  // While the days gone are shown, the strip says so.
  expect(await stops(page)).toContain('Past');
  expect(await listed(page)).toEqual([dayFromToday(-1), dayFromToday(-3)]);
  // Each day by start time, the rasika's own among the rest.
  expect(await rows(page)).toEqual(['Yesterday Vocalist', 'Artist gone-1', 'Artist gone-3']);
  expect(await marked(page)).toBe('Past');
  await atTheTop(page);

  // A date or Today brings back the days from today on.
  await stop(page, 'Today').click();
  expect(await listed(page)).toEqual([dayFromToday(1), dayFromToday(2)]);
  expect(await marked(page)).toBe('Today');
  // A date from the days gone starts the list at that day.
  await daysGone(page, -1);
  await stop(page, dayHeadingText(2)).click();
  expect(await listed(page)).toEqual([dayFromToday(2)]);
  await expect.poll(() => marked(page)).toBe(dayHeadingText(2));
});

test('the search bar and its sheet: one sort widens, two narrow, Aliases find a Sabha, the strip follows', async ({
  page,
}) => {
  await open(page);
  await shareSabha(page, {
    id: 'kgs',
    name: 'Krishna Gana Sabha',
    aliases: ['KGS', 'Sri Krishna Gana Sabha'],
  });
  const sings = (name: string) => [{ name, role: 'vocal' as const, group: null }];
  await storeEntries(page, [
    entry('tmk-academy', 1, { billed: sings('TM Krishna'), startTime: '16:00' }),
    entry('tmk-kgs', 1, { billed: sings('TM Krishna'), sabha: 'Sri Krishna Gana Sabha' }),
    entry('sanjay-academy', 2, { billed: sings('Sanjay Subrahmanyan') }),
    entry('valli', 2, {
      kind: 'dance',
      sabha: 'Narada Gana Sabha',
      billed: [{ name: 'Alarmel Valli', role: 'dancer', group: null }],
    }),
    entry('past-tmk', -1, { billed: sings('TM Krishna') }),
  ]);
  await makeEvents(page, [
    { days: 3, planned: true, sabha: 'Narada Gana Sabha', artists: ['Sanjay Subrahmanyan'] },
  ]);
  await whatsOn(page);
  await expect.poll(() => rows(page)).toHaveLength(5);
  const days = (...n: number[]) => n.map(dayHeadingText);
  expect(await stops(page)).toEqual(['Today', ...days(1, 2, 3)]);

  // One rounded bar, just above the tab bar, in thumb reach; nothing to search on the page.
  await expect(page.locator('main').getByRole('searchbox')).toHaveCount(0);
  await expect(searchBar(page)).toHaveText('Artist or Sabha…');
  const bar = (await searchBar(page).boundingBox())!;
  const tabs = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
  expect(bar.height).toBeGreaterThanOrEqual(48);
  expect(bar.y + bar.height).toBeLessThanOrEqual(tabs.y);
  // Its sheet: a kind only when the Schedule has one, as text toggles; no Mine (2026-11-11).
  await openSearch(page);
  await expect(searchSheet(page).getByRole('button', { name: 'Mine', exact: true })).toHaveCount(0);
  await expect(searchSheet(page).getByRole('button', { name: 'Dance', exact: true })).toBeVisible();
  await expect(searchSheet(page).getByRole('button', { name: 'Lecdem', exact: true })).toHaveCount(
    0,
  );
  await closeSearch(page);

  // One Artist: their listings; the bar reads the filter; the strip keeps only their days.
  await pick(page, 'tm kr', 'TM Krishna', 'Artist');
  expect(await rows(page)).toEqual(['TM Krishna', 'TM Krishna']);
  await expect(searchBar(page)).toHaveText('TM Krishna');
  expect(await stops(page)).toEqual(['Today', ...days(1)]);
  // Another Artist widens it, the rasika's own Event with them included.
  await pick(page, 'sanjay', 'Sanjay Subrahmanyan', 'Artist');
  expect(await rows(page)).toEqual([
    'TM Krishna',
    'TM Krishna',
    'Sanjay Subrahmanyan',
    'Sanjay Subrahmanyan',
  ]);
  expect(await stops(page)).toEqual(['Today', ...days(1, 2, 3)]);
  // A Sabha narrows it, found by its Alias, matching the listing printed by another. The bar
  // shows two, then how many more.
  await pick(page, 'KGS', 'Krishna Gana Sabha', 'Sabha');
  expect(await rows(page)).toEqual(['TM Krishna']);
  await expect(page.locator('[data-list]')).toContainText('Sri Krishna Gana Sabha');
  expect(await stops(page)).toEqual(['Today', ...days(1)]);
  // Only whole names: the two that fit and "+1", or one and "+2", never a name cut.
  await expect(searchBar(page)).toHaveText(
    /^(TM Krishna · Sanjay Subrahmanyan\s*\+1|TM Krishna\s*\+2)$/,
  );
  await expect(searchBar(page)).not.toContainText('…');

  // Reopened, the picks are ticked, first, over every other name to browse; a tick tapped takes
  // one off, the sheet staying open.
  await openSearch(page);
  for (const [name, sort] of [
    ['Krishna Gana Sabha', 'Sabha'],
    ['TM Krishna', 'Artist'],
    ['Sanjay Subrahmanyan', 'Artist'],
  ]) {
    const ticked = searchSheet(page).getByRole('button', { name: `${name} ${sort}`, exact: true });
    await expect(ticked).toHaveAttribute('aria-pressed', 'true');
    await ticked.click();
    await expect(ticked).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(searchSheet(page)).toBeVisible();
  await closeSearch(page);
  await expect(searchBar(page)).toHaveText('Artist or Sabha…');

  // The filter is kept on the way to an Event and back.
  await pick(page, 'narada', 'Narada Gana Sabha', 'Sabha');
  expect(await rows(page)).toEqual(['Alarmel Valli', 'Sanjay Subrahmanyan']);
  await page.locator('[data-list]').getByRole('link').click();
  await page.getByRole('main').getByRole('link', { name: "What's on", exact: true }).click();
  await expect(searchBar(page)).toHaveText('Narada Gana Sabha');
  expect(await rows(page)).toEqual(['Alarmel Valli', 'Sanjay Subrahmanyan']);
  // The bar's x clears it all.
  await page.locator('footer').getByRole('button', { name: 'Clear filters' }).click();
  await expect.poll(() => rows(page)).toHaveLength(5);
  await expect(searchBar(page)).toHaveText('Artist or Sabha…');

  // A kind narrows a pick: no Dance of TM Krishna's.
  await pick(page, 'tm k', 'TM Krishna', 'Artist');
  await toggle(page, 'Dance');
  expect(await rows(page)).toEqual([]);
  expect(await stops(page)).toEqual(['Today']);

  // Nothing matches here: said so, with one tap to clear every filter.
  await expect(page.getByText('Nothing here matches')).toBeVisible();
  await clearInList(page).click();
  await expect.poll(() => rows(page)).toHaveLength(5);
  await expect(searchBar(page)).toHaveText('Artist or Sabha…');
  expect(await stops(page)).toEqual(['Today', ...days(1, 2, 3)]);

  // On the days gone, a filter with no match there keeps Past on the strip, marked, with the
  // clear.
  await daysGone(page, -1);
  await toggle(page, 'Dance');
  await expect(page.getByText('Nothing here matches')).toBeVisible();
  expect(await marked(page)).toBe('Past');
  // The Dance from today on: the Dance alone; a fresh launch starts with no filter.
  await stop(page, 'Today').click();
  // The jump scrolls Today in; a day still off screen reads as empty (content-visibility).
  await expect.poll(() => rows(page)).toEqual(['Alarmel Valli']);
  await whatsOn(page);
  await expect.poll(() => rows(page)).toHaveLength(5);
  await expect(searchBar(page)).toHaveText('Artist or Sabha…');
});

test('the calendar: a month with a dot on each day on, a tap jumping there or to Past', async ({
  page,
}) => {
  await open(page);
  const sings = (name: string) => [{ name, role: 'vocal' as const, group: null }];
  await storeEntries(page, [
    entry('soon', 1),
    ...Array.from({ length: 4 }, (_, i) => entry(`mid-${i}`, 8, { startTime: `1${i}:00` })),
    entry('far', 20, { billed: sings('Far Singer') }),
    entry('gone', -3),
  ]);
  await whatsOn(page);
  const calendar = page.getByRole('dialog', { name: 'Pick a day' });
  const day = (n: number) => calendar.getByRole('button', { name: dayHeadingText(n), exact: true });
  /** The month holding a day, paged to by the arrows. */
  async function monthOf(n: number) {
    await expect(calendar).toBeVisible();
    const arrow = n < 0 ? 'Previous month' : 'Next month';
    for (let i = 0; i < 3 && (await day(n).count()) === 0; i++)
      await calendar.getByRole('button', { name: arrow }).click();
    await expect(day(n)).toBeVisible();
  }
  const dotted = async (n: number) => (await day(n).locator('[data-dot]').count()) === 1;

  // Pinned at the strip's right end, it opens on the month in view, a dot on each day on.
  await page.getByRole('button', { name: 'Pick a day' }).click();
  await expect(calendar).toBeVisible();
  await monthOf(1);
  expect(await dotted(1)).toBe(true);
  // A day with nothing on has no dot and takes no tap.
  await monthOf(2);
  expect(await dotted(2)).toBe(false);
  await expect(day(2)).toBeDisabled();

  // A day far off: the list jumps there, its label under the strip, the sheet closed.
  await monthOf(20);
  await day(20).click();
  await expect(calendar).toHaveCount(0);
  await expect
    .poll(async () =>
      Math.abs(
        (await page.locator(`#day-${dayFromToday(20)}`).boundingBox())!.y -
          (await stripBottom(page)),
      ),
    )
    .toBeLessThanOrEqual(1);
  expect(await marked(page)).toBe(dayHeadingText(20));

  // A day gone, a month back if need be: Past opens at it.
  await page.getByRole('button', { name: 'Pick a day' }).click();
  await monthOf(-3);
  await day(-3).click();
  await expect(calendar).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Past', exact: true })).toBeVisible();
  expect(await marked(page)).toBe('Past');
  await expect(page.locator(`#day-${dayFromToday(-3)}`)).toBeInViewport();

  // With a filter on, only the days that match carry a dot.
  await pick(page, 'far', 'Far Singer', 'Artist');
  await page.getByRole('button', { name: 'Pick a day' }).click();
  await monthOf(1);
  expect(await dotted(1)).toBe(false);
  await monthOf(20);
  expect(await dotted(20)).toBe(true);
});

test('back from an Event finds What’s on where it was left, on the days gone, held still', async ({
  page,
}) => {
  // Safari has no scroll anchoring: days whose rows wrap to three lines draw taller than their
  // likely height, and back from an Event the hold must keep the page still while they do
  // (screens/pin.ts). Chromium's anchoring is turned off to stand in for it.
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
  await whatsOn(page);
  await daysGone(page, -1);

  // The rasika's own Event, the oldest day, under four days of long listings.
  const mine = page.getByRole('region', { name: dayHeadingText(-5) }).getByRole('link');
  await mine.evaluate((row) => row.scrollIntoView({ block: 'center' }));
  await page.evaluate(() => window.scrollBy(0, 120));
  const before = Math.round((await mine.boundingBox())!.y);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

  await mine.click();
  await expect(strip(page)).toHaveCount(0);
  // The Event opens at its top, its back to What's on.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const back = page.getByRole('main').getByRole('link', { name: "What's on", exact: true });
  const tops = await watchTops(page, `#day-${dayFromToday(-5)}`);
  await back.click();
  await expect(mine).toBeVisible();
  expect(await marked(page)).toBe('Past');
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
  expect(await marked(page)).toBe('Past');

  // A fresh launch opens as ever: from today, at the top.
  await whatsOn(page);
  expect(await marked(page)).toBe('Today');
  expect(await listed(page)).toEqual([dayFromToday(1)]);
  await atTheTop(page);
});

test('the old Earlier page opens What’s on, on its days gone, at its top', async ({ page }) => {
  await open(page);
  await storeEntries(page, [entry('next-1', 1), entry('past-1', -1), entry('past-2', -3)]);
  await page.goto('/earlier');
  await expect(page.getByRole('region', { name: 'Past', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/whats-on');
  expect(await marked(page)).toBe('Past');
  expect(await listed(page)).toEqual([dayFromToday(-1), dayFromToday(-3)]);
  await atTheTop(page);
});

test('without a Schedule, the list is the rasika’s own Events by date', async ({ page }) => {
  await open(page);
  await makeEvents(page, [
    { days: 3, planned: true },
    { days: -4 },
    { days: -1 },
    { days: 1, planned: true },
  ]);
  await whatsOn(page);
  const days = [-4, -1, 1, 3].map(dayFromToday);
  await expect.poll(() => listed(page)).toEqual([days[2], days[3]]);
  expect(await places(page)).toEqual(['header', days[2], days[3]]);
  await atTheTop(page);
  // No Mine, with or without a Schedule.
  await openSearch(page);
  await expect(searchSheet(page).getByRole('button', { name: 'Mine', exact: true })).toHaveCount(0);
  await closeSearch(page);
  await daysGone(page, -1);
  expect(await listed(page)).toEqual([days[1], days[0]]);
});

test('an entry whose Shortlisted Event was deleted is Shortlisted again, once', async ({
  page,
}) => {
  await open(page);
  await storeEntries(page, [brothers]);
  await whatsOn(page);
  const row = page.getByRole('main').getByRole('button', { name: /^Malladi Brothers/ });
  const sheet = page.getByRole('dialog', { name: 'Malladi Brothers' });
  await row.click();
  await sheet.getByRole('button', { name: 'Shortlist', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Shortlisted' })).toBeVisible();
  // The second button opens its Event, ready for its first Item.
  await sheet.getByRole('button', { name: "I'm here" }).click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();

  // The rasika deletes the Event, and lets its Undo lapse: back where it was opened from.
  await page.getByRole('button', { name: 'Concert actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete Event' }).click();
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });

  // The entry is listed again; Shortlisting it makes it again, once, with nothing "not saved".
  await row.click();
  await sheet.getByRole('button', { name: 'Shortlist', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Shortlisted' })).toBeVisible();
  await expect(page.getByText(/not saved/i)).toHaveCount(0);
  const events = await readTable<{ deletedAt: string | null }>(page, 'events');
  expect(events.filter((event) => event.deletedAt === null)).toHaveLength(1);
});

test('going into an Event, or a listing’s sheet, and back finds What’s on where it was', async ({
  page,
}) => {
  await open(page);
  // A long Season: four listings a day for a fortnight, and one Event of the rasika's deep in it.
  const listings = Array.from({ length: 14 }, (_, d) =>
    Array.from({ length: 4 }, (_, i) => entry(`e-${d}-${i}`, d + 1, { startTime: `1${i}:00` })),
  ).flat();
  await storeEntries(page, listings);
  await makeEvents(page, [{ days: 9, planned: true, time: '20:00' }]);
  await whatsOn(page);

  const mine = page.locator('[data-list]').getByRole('link', { name: /^No Sabha yet/ });
  await mine.evaluate((row) => row.scrollIntoView({ block: 'center' }));
  await page.evaluate(() => window.scrollBy(0, -200));
  const before = (await mine.boundingBox())!.y;
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(1000);

  await mine.click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  // The Event opens at its top, not partway down.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(mine).toBeVisible();
  expect(Math.abs((await mine.boundingBox())!.y - before)).toBeLessThanOrEqual(1);

  // A listing's sheet opened and closed leaves the page where it was.
  const listing = page.getByRole('button', { name: /^Artist e-8-1/ });
  await listing.evaluate((row) => row.scrollIntoView({ block: 'center' }));
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
