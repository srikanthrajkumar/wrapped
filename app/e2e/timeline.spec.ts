// Season as option C (the Maintainer, 2026-11-09): the hero holds the rasika's concert (on now,
// else their next Planned one, else the title), and a strip of days (Past · Today · each date
// ahead) pinned over the list from today on, a tap jumping to a day and the strip following the
// scroll; Past shows the days gone, newest first, in place. Each day lists the rasika's own
// Events first and the Schedule's other listings quieter, with no add control on any row. One
// filter box, "Artist or Sabha…", with Mine and the kinds as chips, prunes the list and the strip.
// A listing's sheet adds it, once, and it becomes theirs in place. Back from an Event finds
// Season where it was left.

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

/** A Concert holding Now: made by the +, with a note so it is kept. */
async function concertNow(page: Page) {
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('button', { name: 'Note' }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('front row');
  await page.getByRole('main').getByRole('link', { name: 'Season' }).click();
  await expect(page.getByRole('region', { name: 'Now' })).toBeVisible();
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

/** The curtain sits at the very top of the page, with nothing above it. */
async function atTheTop(page: Page) {
  await expect(page.getByRole('button', { name: 'Log a Concert' })).toBeInViewport();
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

test('the hero holds the rasika’s concert on now, else their next Planned one, else the title', async ({
  page,
}) => {
  await open(page);
  // Nothing in the Season: the title and its + alone, with one quiet mark; no strip, no filter.
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await atTheTop(page);
  await expect(page.getByRole('img', { name: 'Nothing yet' })).toBeVisible();
  await expect(strip(page)).toHaveCount(0);
  await expect(searchBar(page)).toHaveCount(0);

  // Their next Planned concert, over a later one and one already heard.
  await makeEvents(page, [
    { days: 3, planned: true, artists: ['Later Vocalist'] },
    {
      days: 2,
      planned: true,
      time: '19:00',
      sabha: 'Narada Gana Sabha',
      artists: ['Next Vocalist'],
    },
    { days: -1, artists: ['Heard Vocalist'] },
  ]);
  await page.reload();
  const next = page.getByRole('region', { name: 'Next' });
  await expect(next.getByRole('link')).toHaveText('Next Vocalist');
  await expect(next).toContainText(`Narada Gana Sabha · ${dayHeadingText(2)} · 7:00 pm`);
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeAttached();
  await atTheTop(page);
  // On its grid: the + in the label's row and the chevron on the title's first line share one
  // right edge, the +'s 48px whole.
  const plus = page.getByRole('button', { name: 'Log a Concert' });
  expect((await plus.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  const plusMark = (await plus.locator('svg').boundingBox())!;
  const chevron = (await next.locator('[data-hero-chevron] svg').boundingBox())!;
  expect(Math.abs(plusMark.x + plusMark.width - (chevron.x + chevron.width))).toBeLessThanOrEqual(
    1,
  );
  const title = next.getByRole('link');
  const line = await title.evaluate((node) => parseFloat(getComputedStyle(node).lineHeight));
  const titleTop = (await title.boundingBox())!.y;
  expect(Math.abs(chevron.y + chevron.height / 2 - (titleTop + line / 2))).toBeLessThanOrEqual(1);
  expect(plusMark.y + plusMark.height).toBeLessThanOrEqual(titleTop);
  // Tapped anywhere but its +, even its line, it opens that Event.
  const meta = (await next.getByText(/^Narada Gana Sabha · /).boundingBox())!;
  const hero = (await next.boundingBox())!;
  await next.click({ position: { x: meta.x - hero.x + 8, y: meta.y - hero.y + meta.height / 2 } });
  await expect(page).toHaveURL(/\/event\//);
  await page.getByRole('main').getByRole('link', { name: 'Season', exact: true }).click();

  // A concert on now holds it instead; tapped, it opens, so logging starts here.
  await concertNow(page);
  await expect(page.getByRole('region', { name: 'Next' })).toHaveCount(0);
  const now = page.getByRole('region', { name: 'Now' }).getByRole('link');
  await expect(now).toHaveText(/^No Sabha yet/);
  await now.click();
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveValue('front row');
});

test('the strip: Past, Today, each date ahead; a tap jumps to its day, and it follows the scroll', async ({
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
  await page.reload();
  await expect
    .poll(() => stops(page))
    .toEqual(['Past', 'Today', ...Array.from({ length: 10 }, (_, d) => dayHeadingText(d + 1))]);
  // From today on, every day listed, the strip on Today.
  expect(await listed(page)).toEqual(Array.from({ length: 10 }, (_, d) => dayFromToday(d + 1)));
  expect(await marked(page)).toBe('Today');
  // One chosen stop, by aria-current; no dot and no pill (its ink follows time).
  await expect(strip(page).locator('[aria-current="true"]')).toHaveCount(1);
  await expect(strip(page).locator('[data-dot]')).toHaveCount(0);
  for (const name of ['Past', 'Today', dayHeadingText(1)]) {
    expect((await stop(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }

  // A day tapped: the list jumps to it, its label just under the pinned strip, and it is marked.
  await stop(page, dayHeadingText(6)).click();
  await expect.poll(() => marked(page)).toBe(dayHeadingText(6));
  expect((await strip(page).boundingBox())!.y).toBe(0);
  const label = page.locator(`#day-${dayFromToday(6)}`);
  expect(Math.abs((await label.boundingBox())!.y - (await stripBottom(page)))).toBeLessThanOrEqual(
    1,
  );
  // Scrolled on within the day, its label sticks under the strip.
  await page.evaluate(() => window.scrollBy(0, 120));
  await expect.poll(async () => (await label.boundingBox())!.y).toBe(await stripBottom(page));
  expect(await marked(page)).toBe(dayHeadingText(6));

  // Scrolled by hand, the strip follows: the day under it is the one marked.
  const third = page.getByRole('region', { name: dayHeadingText(3) });
  await third.evaluate((day) => {
    const strip = document.querySelector('[data-strip]')!;
    window.scrollBy(0, day.getBoundingClientRect().top - strip.getBoundingClientRect().bottom + 40);
  });
  await expect.poll(() => marked(page)).toBe(dayHeadingText(3));
  // Further on, the marked day is slid into the strip's view.
  await page.getByRole('region', { name: dayHeadingText(8) }).evaluate((day) => {
    const strip = document.querySelector('[data-strip]')!;
    window.scrollBy(0, day.getBoundingClientRect().top - strip.getBoundingClientRect().bottom + 40);
  });
  await expect.poll(() => marked(page)).toBe(dayHeadingText(8));
  await expect(stop(page, dayHeadingText(8))).toBeInViewport({ ratio: 1 });

  // The last day too: the list leaves room under it to come up to the strip.
  await stop(page, dayHeadingText(10)).click();
  await expect
    .poll(async () =>
      Math.abs(
        (await page.locator(`#day-${dayFromToday(10)}`).boundingBox())!.y -
          (await stripBottom(page)),
      ),
    )
    .toBeLessThanOrEqual(1);
  expect(await marked(page)).toBe(dayHeadingText(10));

  // Today: back to the list's start.
  await stop(page, 'Today').click();
  await expect(page.locator(`#day-${dayFromToday(1)}`)).toBeInViewport();
  expect(await marked(page)).toBe('Today');
});

test('Past shows the days gone, newest first, in place of the list; Today brings it back', async ({
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
  await page.reload();
  await expect.poll(() => listed(page)).toEqual([dayFromToday(1), dayFromToday(2)]);
  await expect(page.getByRole('region', { name: 'Past', exact: true })).toHaveCount(0);

  await stop(page, 'Past').click();
  await expect(page.getByRole('region', { name: 'Past', exact: true })).toBeVisible();
  expect(await listed(page)).toEqual([dayFromToday(-1), dayFromToday(-3)]);
  // Each day as ever: the rasika's own first, then the listings, quieter.
  expect(await rows(page)).toEqual(['Yesterday Vocalist', 'Artist gone-1', 'Artist gone-3']);
  expect(await marked(page)).toBe('Past');
  await atTheTop(page);

  // A date or Today brings back the days from today on.
  await stop(page, 'Today').click();
  expect(await listed(page)).toEqual([dayFromToday(1), dayFromToday(2)]);
  expect(await marked(page)).toBe('Today');
  await stop(page, 'Past').click();
  await stop(page, dayHeadingText(2)).click();
  expect(await listed(page)).toEqual([dayFromToday(1), dayFromToday(2)]);
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
  await page.reload();
  await expect.poll(() => rows(page)).toHaveLength(5);
  const days = (...n: number[]) => n.map(dayHeadingText);
  expect(await stops(page)).toEqual(['Past', 'Today', ...days(1, 2, 3)]);

  // One rounded bar, just above the tab bar, in thumb reach; nothing to search on the page.
  await expect(page.locator('main').getByRole('searchbox')).toHaveCount(0);
  await expect(searchBar(page)).toHaveText('Artist or Sabha…');
  const bar = (await searchBar(page).boundingBox())!;
  const tabs = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
  expect(bar.height).toBeGreaterThanOrEqual(48);
  expect(bar.y + bar.height).toBeLessThanOrEqual(tabs.y);
  // Its sheet: Mine with a Schedule, and a kind only when the Schedule has one, as text toggles.
  await openSearch(page);
  await expect(
    searchSheet(page).getByRole('button', { name: 'Mine', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(searchSheet(page).getByRole('button', { name: 'Dance', exact: true })).toBeVisible();
  await expect(searchSheet(page).getByRole('button', { name: 'Lecdem', exact: true })).toHaveCount(
    0,
  );
  await closeSearch(page);

  // One Artist: their listings; the bar reads the filter; the strip keeps only their days.
  await pick(page, 'tm kr', 'TM Krishna', 'Artist');
  expect(await rows(page)).toEqual(['TM Krishna', 'TM Krishna']);
  await expect(searchBar(page)).toHaveText('TM Krishna');
  expect(await stops(page)).toEqual(['Past', 'Today', ...days(1)]);
  // Another Artist widens it, the rasika's own Event with them included.
  await pick(page, 'sanjay', 'Sanjay Subrahmanyan', 'Artist');
  expect(await rows(page)).toEqual([
    'TM Krishna',
    'TM Krishna',
    'Sanjay Subrahmanyan',
    'Sanjay Subrahmanyan',
  ]);
  expect(await stops(page)).toEqual(['Past', 'Today', ...days(1, 2, 3)]);
  // A Sabha narrows it, found by its Alias, matching the listing printed by another; the day
  // gone has no match there, so Past leaves the strip. The bar shows two, then how many more.
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
  await page.getByRole('main').getByRole('link', { name: 'Season', exact: true }).click();
  await expect(searchBar(page)).toHaveText('Narada Gana Sabha');
  expect(await rows(page)).toEqual(['Alarmel Valli', 'Sanjay Subrahmanyan']);
  // The bar's x clears it all.
  await page.locator('footer').getByRole('button', { name: 'Clear filters' }).click();
  await expect.poll(() => rows(page)).toHaveLength(5);
  await expect(searchBar(page)).toHaveText('Artist or Sabha…');

  // Mine: only the rasika's own Events, and the filter narrows them as any row.
  await toggle(page, 'Mine');
  expect(await rows(page)).toEqual(['Sanjay Subrahmanyan']);
  await expect(searchBar(page)).toHaveText('Mine');
  await pick(page, 'tm k', 'TM Krishna', 'Artist');
  expect(await rows(page)).toEqual([]);
  expect(await stops(page)).toEqual(['Today']);

  // Nothing matches here: said so, with one tap to clear every filter.
  await expect(page.getByText('Nothing here matches.')).toBeVisible();
  await clearInList(page).click();
  await expect.poll(() => rows(page)).toHaveLength(5);
  await expect(searchBar(page)).toHaveText('Artist or Sabha…');
  expect(await stops(page)).toEqual(['Past', 'Today', ...days(1, 2, 3)]);

  // On Past, a filter with no match there keeps Past on the strip, marked, with the clear.
  await stop(page, 'Past').click();
  await toggle(page, 'Dance');
  await expect(page.getByText('Nothing here matches.')).toBeVisible();
  expect(await marked(page)).toBe('Past');
  // The Dance from today on: the Dance alone; a fresh launch starts with no filter.
  await stop(page, 'Today').click();
  // The jump scrolls Today in; a day still off screen reads as empty (content-visibility).
  await expect.poll(() => rows(page)).toEqual(['Alarmel Valli']);
  await page.reload();
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
  await page.reload();
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

test('back from an Event finds Season where it was left, on the days gone, held still', async ({
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
  await page.reload();
  await stop(page, 'Past').click();

  // The rasika's own Event, the oldest day, under four days of long listings.
  const mine = page.getByRole('region', { name: dayHeadingText(-5) }).getByRole('link');
  await mine.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  const before = Math.round((await mine.boundingBox())!.y);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

  await mine.click();
  await expect(strip(page)).toHaveCount(0);
  // The Event opens at its top, its back to Season.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const back = page.getByRole('main').getByRole('link', { name: 'Season', exact: true });
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
  await page.reload();
  expect(await marked(page)).toBe('Today');
  expect(await listed(page)).toEqual([dayFromToday(1)]);
  await atTheTop(page);
});

test('the old Earlier page opens Season on Past, at its top; the + comes back from today', async ({
  page,
}) => {
  await open(page);
  await storeEntries(page, [entry('next-1', 1), entry('past-1', -1), entry('past-2', -3)]);
  await page.goto('/earlier');
  await expect(page.getByRole('region', { name: 'Past', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  expect(await marked(page)).toBe('Past');
  expect(await listed(page)).toEqual([dayFromToday(-1), dayFromToday(-3)]);
  await atTheTop(page);

  // The + from Past: the Concert it makes is today's, so Season comes back from today, at the
  // top, the hero holding it.
  await concertNow(page);
  expect(await marked(page)).toBe('Today');
  expect(await listed(page)).toEqual([dayFromToday(0), dayFromToday(1)]);
  await atTheTop(page);
});

test('without a Schedule, the list is the rasika’s own Events by date, and no Mine', async ({
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
  await expect.poll(() => listed(page)).toEqual([days[2], days[3]]);
  expect(await places(page)).toEqual(['header', days[2], days[3]]);
  await atTheTop(page);
  // Without a Schedule every row is the rasika's: no Mine, and no kinds.
  await openSearch(page);
  await expect(searchSheet(page).getByRole('button', { name: 'Mine', exact: true })).toHaveCount(0);
  await closeSearch(page);
  await stop(page, 'Past').click();
  expect(await listed(page)).toEqual([days[1], days[0]]);
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

  const mine = page.locator('[data-list]').getByRole('link', { name: /^No Sabha yet/ });
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
