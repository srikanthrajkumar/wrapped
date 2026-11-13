// Season, the hub, and the spine (docs/designs/season-spine.md; the Maintainer, 2026-11-11;
// DESIGN.md "Season, the hub"): on open it answers what can still be caught, with What's on one
// tap away; a concert goes from Listed to Shortlisted to Heard; the first Item makes it Heard
// (ADR 0010, required: the stored status); a lapsed one is asked about once and kept as Missed;
// each tab keeps its own back stack; and the band under the iOS status bar is the app's to paint.

import { expect, test, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { harnessScript } from './harness/build';
import type { Harness } from './harness/entry';
import { finishFirstLaunch, openHub, readTable, tab } from './helpers';

const DAY = '2026-12-20';
const NEXT_DAY = '2026-12-21';
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
  billed: [
    { name: `Singer ${id}`, role: 'vocal', group: null, support: false },
    { name: `Violinist ${id}`, role: 'violin', group: null, support: false },
  ],
  cancelled: false,
  ...fields,
});

// Sunday 20 December: one over by 3:40, two under way, four in the 4:00 slot, one at 6:00, and
// tomorrow's first at 9:00.
const SUNDAY = [
  entry('early', '09:00'),
  entry('a1', '13:30'),
  entry('b3', '15:00'),
  entry('d4', '16:00'),
  entry('e4', '16:00'),
  entry('f4', '16:00'),
  entry('g4', '16:00'),
  entry('i6', '18:00', {
    billed: [
      { name: 'Flautist i6', role: 'flute', group: null, support: false },
      { name: 'Drummer i6', role: 'mridangam', group: null, support: false },
    ],
  }),
  entry('z', '09:00', { date: NEXT_DAY }),
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

/** The app opened at `time`, past first launch, with Sunday's Schedule stored. */
async function openAt(page: Page, time: Date, entries: ScheduleEntry[] = SUNDAY) {
  await page.clock.setFixedTime(time);
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, entries);
  await page.reload();
  await page.locator('main h1').waitFor();
}

const soon = (page: Page) => page.getByRole('region', { name: 'Starting soon' });
/** Each of Starting soon's rows, by the name it leads with. */
const soonRows = async (page: Page) =>
  (await soon(page).getByRole('listitem').allInnerTexts()).map((text) => text.split('\n')[0]);
const door = (page: Page) => page.locator('main a[href="/whats-on"]');
const sheet = (page: Page) => page.getByRole('dialog');
const chevrons = (page: Page) => page.locator('main .tabler-icon-chevron-right');

/** Shortlist a concert from its row, on whichever page lists it. */
async function shortlist(page: Page, name: string) {
  await page
    .getByRole('main')
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .first()
    .click();
  await sheet(page).getByRole('button', { name: 'Shortlist', exact: true }).click();
  await expect(sheet(page).getByRole('button', { name: 'Shortlisted' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
}

test('day one: the title, Settings and the +, an empty Shortlist, and nothing listed', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  for (const mark of [
    page.getByRole('button', { name: 'Log a Concert' }),
    page.getByRole('link', { name: /^Settings/ }),
  ]) {
    const box = (await mark.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByText('Nothing listed yet')).toBeVisible();
  await expect(page.locator('main a[href="/shortlist"]')).toContainText('Nothing yet');
  // No search bar on the hub, and no Diary block until something is heard.
  await expect(page.locator('footer [data-season-bar]')).toHaveCount(0);
  await expect(page.locator('main a[href="/diary"]')).toHaveCount(0);

  // The Shortlist and the Diary: a plain header each, and their empty states.
  await tab(page, 'Shortlist').click();
  await expect(page.getByRole('heading', { name: 'Shortlist', exact: true })).toBeVisible();
  await expect(page.getByText('Nothing shortlisted')).toBeVisible();
  await expect(page.locator('[data-curtain-field]')).toHaveCount(0);
  await tab(page, 'Diary').click();
  await expect(page.getByRole('heading', { name: 'Diary', exact: true })).toBeVisible();
  await expect(page.getByText('Nothing heard yet')).toBeVisible();
});

test('at 3:40 the hub shows what starts soon, and What’s on is one tap away', async ({ page }) => {
  await openAt(page, at('15:40'));
  // The next slot first, by Sabha; the two under way wait behind the door.
  expect(await soonRows(page)).toEqual(['Singer d4', 'Singer e4', 'Singer f4', 'Singer g4']);
  await expect(soon(page).getByRole('listitem').first()).toContainText('Violinist d4');
  await expect(soon(page).getByRole('listitem').first()).toContainText('Sabha d4 · 4:00 pm');
  await expect(door(page)).toHaveText('+2 more');
  // No row carries a chevron or a button of its own; the door and the tile do.
  await expect(soon(page).getByRole('listitem').locator('.tabler-icon-chevron-right')).toHaveCount(
    0,
  );
  await expect(chevrons(page)).toHaveCount(2);

  // What's on: today from now, what is over folded to one line, a dot on what is under way.
  await door(page).click();
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
  const today = page.getByRole('region', { name: 'Sun 20 Dec' });
  const earlier = today.getByRole('button', { name: /^Earlier today/ });
  await expect(earlier).toContainText('1');
  await expect(today.getByRole('listitem')).toHaveCount(7);
  await expect(today.getByRole('img', { name: 'On now' })).toHaveCount(2);
  await expect(today.getByRole('listitem').first()).toContainText('Singer a1');
  // The type, for a concert that isn't vocal, and its accompanists.
  const flute = today.getByRole('listitem').filter({ hasText: 'Flautist i6' });
  await expect(flute).toContainText('Flute');
  await expect(flute).toContainText('Drummer i6');
  await earlier.click();
  await expect(today.getByRole('listitem')).toHaveCount(8);
  await expect(today.getByRole('listitem').first()).toContainText('Singer early');

  // Shortlisted, it is the rasika's: a star by its time, the hero on the hub, first in Starting
  // soon, counted on the tile.
  await shortlist(page, 'Singer f4');
  await expect(
    today.getByRole('listitem').filter({ hasText: 'Singer f4' }).getByRole('img', {
      name: 'Shortlisted',
    }),
  ).toBeVisible();
  const events = await readTable<{ status: string; source: string }>(page, 'events');
  expect(events).toHaveLength(1);
  // Stored as it always was: `planned` (ADR 0010).
  expect(events[0]).toMatchObject({ status: 'planned', source: 'schedule' });
  await page.getByRole('main').getByRole('link', { name: 'Season', exact: true }).click();
  const next = page.getByRole('region', { name: 'Next' });
  await expect(next.getByRole('link')).toContainText('Singer f4');
  await expect(next).toContainText('Sabha f4 · Today · 4:00 pm');
  // No chevron on the hero.
  await expect(next.locator('.tabler-icon-chevron-right')).toHaveCount(0);
  expect((await soonRows(page))[0]).toBe('Singer f4');
  const tile = page.locator('main a[href="/shortlist"]');
  await expect(tile).toContainText('1 at 4:00 pm');
  await tile.click();
  await expect(page.getByRole('heading', { name: 'Shortlist', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1);

  // Taken off again from its sheet: its Event deleted, with Undo.
  await page
    .getByRole('main')
    .getByRole('button', { name: /^Singer f4/ })
    .click();
  await sheet(page).getByRole('button', { name: 'Shortlisted' }).click();
  await expect(page.getByText('Nothing shortlisted')).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1);
});

test('a clash is a choice; the first Item makes a concert Heard; the Diary keeps it', async ({
  page,
}) => {
  await openAt(page, at('15:40'));
  await shortlist(page, 'Singer f4');
  await shortlist(page, 'Singer g4');
  // Two in one slot: the hero never picks for the rasika.
  const pick = page.getByRole('region', { name: 'Pick your dusk' });
  await expect(pick.getByRole('link')).toHaveCount(2);
  await expect(pick.getByRole('link').first()).toContainText('Singer f4');
  await expect(pick.getByRole('link').first()).toContainText('Sabha f4 · 4:00 pm');

  // One chosen: it opens ready for its first Item, which makes it Heard.
  await pick.getByRole('link').nth(1).click();
  await expect(page.getByText('No Items yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start logging' })).toHaveCount(0);
  // The tab bar stays on an Event.
  await expect(tab(page, 'Season')).toBeVisible();
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page.getByRole('region', { name: 'Items' }).getByRole('listitem')).toHaveCount(1);
  const stored = await readTable<{ status: string; scheduleEntryId: string; touched: boolean }>(
    page,
    'events',
  );
  expect(stored.find((event) => event.scheduleEntryId === 'g4')).toMatchObject({
    status: 'attended',
    touched: true,
  });
  expect(stored.find((event) => event.scheduleEntryId === 'f4')).toMatchObject({
    status: 'planned',
  });

  // The Diary: every concert heard, and only those.
  await tab(page, 'Diary').click();
  const heard = page.getByRole('main').getByRole('listitem');
  await expect(heard).toHaveCount(1);
  await expect(heard).toContainText('Singer g4');
  await expect(heard).toContainText('Sabha g4 · Today · 4:00 pm · 1 Item');
  // The Shortlist no longer holds it; the hub's hero is the concert being logged.
  await tab(page, 'Shortlist').click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('listitem')).toContainText('Singer f4');
  // Season was left on that Event, opened from its hero; its tab, tapped again, is the hub.
  await tab(page, 'Season').click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  await openHub(page);
  await expect(page.getByRole('region', { name: 'Now' }).getByRole('link')).toContainText(
    'Singer g4',
  );
});

test('each tab keeps its own back stack, and the tab that is on returns to its top', async ({
  page,
}) => {
  await openAt(page, at('15:40'));
  await shortlist(page, 'Singer f4');
  await door(page).click();
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
  // To the Shortlist and back: Season is still on What's on.
  await tab(page, 'Shortlist').click();
  await expect(page.getByRole('heading', { name: 'Shortlist', exact: true })).toBeVisible();
  await tab(page, 'Season').click();
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
  await expect(tab(page, 'Season')).toHaveAttribute('aria-current', 'page');

  // An Event opened from the Shortlist belongs to the Shortlist, and goes back to it.
  await tab(page, 'Shortlist').click();
  await page
    .getByRole('main')
    .getByRole('button', { name: /^Singer f4/ })
    .click();
  await sheet(page).getByRole('button', { name: "I'm here" }).click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  await expect(tab(page, 'Shortlist')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('main').getByRole('link', { name: 'Shortlist' })).toBeVisible();
  // Left for the Diary, the Shortlist is found on that Event.
  await tab(page, 'Diary').click();
  await expect(page.getByRole('heading', { name: 'Diary', exact: true })).toBeVisible();
  await tab(page, 'Shortlist').click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  // The tab that is on, tapped, returns to its top.
  await tab(page, 'Shortlist').click();
  await expect(page.getByRole('heading', { name: 'Shortlist', exact: true })).toBeVisible();
  await tab(page, 'Season').click();
  await tab(page, 'Season').click();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeAttached();
  await expect(soon(page)).toBeVisible();
});

// Required (ADR 0010): a Shortlisted concert whose time passed is asked about once; said yes
// to, it is Heard; let go, it is kept as Missed, shown nowhere, and never deleted.
test('the lapse card asks once: a tap makes it Heard, the rest are kept as Missed', async ({
  page,
}) => {
  await openAt(page, at('15:40'));
  await page.addScriptTag({ content: await harnessScript() });
  await page.evaluate(async () => {
    const { events, people } = (globalThis as unknown as { harness: Harness }).harness;
    for (const [name, startTime] of [
      ['Morning Singer', '11:00'],
      ['Evening Singer', '18:45'],
    ] as const) {
      const made = await events.createEvent({
        kind: 'concert',
        date: '2026-12-19',
        startTime,
        source: 'plan',
      });
      const artist = await people.createArtist(name);
      await people.addAppearance(made.id, artist.id, { role: 'vocal' });
    }
  });
  await page.reload();
  const card = page.getByRole('region', { name: 'Were you at any of these?' });
  await expect(card.getByRole('listitem')).toHaveCount(2);
  await expect(card).toContainText('Sat 19 Dec');
  // Neither is on the Shortlist any more, nor the hero.
  await expect(page.getByRole('region', { name: 'Next' })).toHaveCount(0);

  await card.getByRole('button', { name: 'I was at Evening Singer' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(1);
  await card.getByRole('button', { name: 'None of these' }).click();
  await expect(card).toHaveCount(0);

  const stored = await readTable<{ status: string; startTime: string; deletedAt: string | null }>(
    page,
    'events',
  );
  expect(stored.map((event) => [event.startTime, event.status, event.deletedAt]).sort()).toEqual([
    ['11:00', 'missed', null],
    ['18:45', 'attended', null],
  ]);
  // Asked once: a relaunch asks nothing more.
  await page.reload();
  await page.locator('main h1').waitFor();
  await expect(card).toHaveCount(0);
  // The one heard is in the Diary, and on the hub's Diary block; the Missed one is nowhere.
  await expect(page.locator('main a[href="/diary"]')).toBeVisible();
  await expect(chevrons(page)).toHaveCount(3);
  await tab(page, 'Diary').click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('listitem')).toContainText('Evening Singer');
  await tab(page, 'Shortlist').click();
  await expect(page.getByText('Nothing shortlisted')).toBeVisible();
});

test('with nothing left today, the hub points to the next day’s first concert', async ({
  page,
}) => {
  await openAt(page, at('21:40'));
  await expect(page.getByText('Nothing more today')).toBeVisible();
  await expect(
    page.getByText('Tomorrow starts at 9:00 am with Singer z at Sabha z.'),
  ).toBeVisible();
  // In the door's place, with its chevron: What's on, starting at that day.
  await page.getByRole('link', { name: 'Tomorrow' }).click();
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
  const first = page.locator('[data-list] section[data-place]').first();
  await expect(first).toHaveAttribute('data-place', NEXT_DAY);
});

// The row's lines hold their shape (the Maintainer, 2026-11-11; DESIGN.md "The row").
test('a row keeps its lines: whole names then "+N", the type with the lead, a title in two', async ({
  page,
}) => {
  const artist = (name: string, role: ScheduleEntry['billed'][number]['role']) => ({
    name,
    role,
    group: null,
    support: false,
  });
  await openAt(page, at('15:40'), [
    entry('many', '16:00', {
      billed: [
        artist('Singer many', 'vocal'),
        artist('Thiruvizha Sri. Viju. S. Anand', 'violin'),
        artist('R. Sankaranarayanan', 'mridangam'),
        artist('H. Prasanna', 'ghatam'),
      ],
    }),
    entry('duo', '16:00', {
      billed: [
        artist('Charulatha Chandrashekar Ramanujam', 'flute'),
        artist('Drummer duo', 'mridangam'),
      ],
    }),
    entry('named', '16:00', {
      title:
        'A printed title that runs on and on, well past one line and past a second line too, ' +
        'so that the row has to stop it somewhere and leave the rest of it to the sheet',
    }),
  ]);
  await door(page).click();
  const rows = page.getByRole('region', { name: 'Sun 20 Dec' }).getByRole('listitem');

  // Three names don't fit 358px: two whole ones and a count, on one line, never cut.
  const many = rows.filter({ hasText: 'Singer many' });
  const names = many.getByText('Thiruvizha Sri. Viju. S. Anand');
  await expect(names).toHaveText('Thiruvizha Sri. Viju. S. Anand · R. Sankaranarayanan +1');
  expect(await names.evaluate((line) => line.scrollWidth <= line.clientWidth)).toBe(true);
  expect(Math.round((await names.boundingBox())!.height)).toBe(20);
  expect(Math.round((await many.boundingBox())!.height)).toBe(84);

  // The type stays on the line of the lead's last word.
  const type = rows.filter({ hasText: 'Charulatha' }).getByText('Flute', { exact: true });
  expect(
    await type.evaluate((type) => {
      const word = document.createRange();
      const text = type.previousSibling!;
      word.setStart(text, 0);
      word.setEnd(text, text.textContent!.length);
      return Math.abs(word.getBoundingClientRect().bottom - type.getBoundingClientRect().bottom);
    }),
  ).toBeLessThan(6);

  // A printed title stops at its second line.
  const title = rows.filter({ hasText: 'Singer named' }).getByText(/^A printed title/);
  expect(Math.round((await title.boundingBox())!.height)).toBe(40);

  // On a wider page every name fits, and the count goes.
  await page.setViewportSize({ width: 600, height: 844 });
  await expect(names).toHaveText(
    'Thiruvizha Sri. Viju. S. Anand · R. Sankaranarayanan · H. Prasanna',
  );
});

// On an installed iPhone the page draws under the clock (black-translucent), so the app paints
// that band. The top inset is stood in for by the shell's own variable.
test('the status band is clear over the hub’s curtain, and painted everywhere else', async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--app-top-inset', '59px');
    });
  });
  await openAt(page, at('15:40'));
  const band = page.locator('[data-status-band]');
  const paint = () => band.evaluate((node) => getComputedStyle(node).backgroundColor);
  const page_ = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect((await band.boundingBox())!.height).toBe(59);
  // The curtain reaches the very top of the screen, under the band, which is clear.
  expect((await page.locator('[data-curtain-field]').boundingBox())!.y).toBe(0);
  await expect.poll(paint).toBe('rgba(0, 0, 0, 0)');
  // The hero's row sits below the inset, clear of the clock.
  expect(
    (await page.getByRole('button', { name: 'Log a Concert' }).boundingBox())!.y,
  ).toBeGreaterThanOrEqual(59);
  // Scrolled until the sheet reaches the band: it takes the page's colour, so no row shows
  // under the clock.
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(paint).toBe(await page_());
  // Another tab: painted from the start, its header below it.
  await tab(page, 'Shortlist').click();
  await expect.poll(paint).toBe(await page_());
  expect(
    (await page.getByRole('heading', { name: 'Shortlist', exact: true }).boundingBox())!.y,
  ).toBeGreaterThanOrEqual(59);

  // In light the clock is white, so the band is a rose ink, never the white page.
  await page.evaluate(() => localStorage.setItem('wrapped.theme', 'light'));
  await page.reload();
  await page.locator('main h1').waitFor();
  const white = await page_();
  await expect.poll(paint).not.toBe(white);
  await expect.poll(paint).not.toBe('rgba(0, 0, 0, 0)');
  // Dark enough for the white clock: its lightness well under a half.
  const lightness = await band.evaluate((node) => {
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.fillStyle = getComputedStyle(node).backgroundColor;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
  });
  expect(lightness).toBeLessThan(0.2);
});

// The tab bar stays at the foot of the screen (the Maintainer's iPhone, 2026-11-12: it sat a
// keyboard's height up the hub, the page scrolling under it).
/** How far the tab bar's foot is from the screen's: 0 when it is where it belongs. */
const navLift = (page: Page) =>
  page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main"]')!;
    return Math.round(window.innerHeight - nav.getBoundingClientRect().bottom);
  });

/** At the foot with the page at its top, and at its end. */
async function expectNavAtFoot(page: Page) {
  await expect.poll(() => navLift(page)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => navLift(page)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test('the tab bar stays at the foot of the screen through the hub’s states', async ({ page }) => {
  // The clock runs, so the hub changes in place as it does in the hand.
  await page.clock.install({ time: at('15:40') });
  await page.goto('/');
  await finishFirstLaunch(page);
  // Day one: nothing listed.
  await expect(page.getByText('Nothing listed yet')).toBeVisible();
  await expectNavAtFoot(page);

  await storeEntries(page, SUNDAY);
  await page.reload();
  await expect(soon(page).getByRole('listitem').first()).toBeVisible();
  await expectNavAtFoot(page);
  // With a hero: one Shortlisted, ahead.
  await shortlist(page, 'Singer d4');
  await expect(page.getByRole('region', { name: 'Next' })).toBeVisible();
  await expectNavAtFoot(page);

  // The evening passes with the hub open: nothing more today, then the next morning's card.
  await page.clock.fastForward('06:00:00');
  await expect(page.getByText('Nothing more today')).toBeVisible();
  await expectNavAtFoot(page);
  await page.clock.fastForward('12:00:00');
  await expect(page.getByRole('region', { name: 'Were you at any of these?' })).toBeVisible();
  await expectNavAtFoot(page);
  await page.getByRole('button', { name: 'None of these' }).click();
  await expect(page.getByRole('region', { name: 'Were you at any of these?' })).toHaveCount(0);
  await expectNavAtFoot(page);
});

test('a keyboard that has gone never holds the tab bar up', async ({ page }) => {
  // A stand-in keyboard: the visual viewport reports what it covers, as on iOS, and says so
  // only when told to.
  await page.addInitScript(() => {
    let covered = 0;
    const viewport = window.visualViewport!;
    Object.defineProperty(viewport, 'height', {
      configurable: true,
      get: () => window.innerHeight - covered,
    });
    (window as unknown as { keyboard(px: number, tell: boolean): void }).keyboard = (px, tell) => {
      covered = px;
      if (tell) viewport.dispatchEvent(new Event('resize'));
    };
  });
  const keyboard = (px: number, tell: boolean) =>
    page.evaluate(
      ([px, tell]) =>
        (window as unknown as { keyboard(px: number, tell: boolean): void }).keyboard(px, tell),
      [px, tell] as const,
    );
  await openAt(page, at('15:40'));
  await page
    .getByRole('main')
    .getByRole('button', { name: /^Singer d4/ })
    .first()
    .click();
  await sheet(page).getByRole('button', { name: "I'm here" }).click();
  await expect(page.getByText('No Items yet')).toBeVisible();
  await page.getByRole('button', { name: 'Note' }).click();
  await page.getByRole('textbox', { name: 'Note' }).focus();
  // With a field in hand the bar rides above the keyboard.
  await keyboard(336, true);
  await expect.poll(() => navLift(page)).toBe(336);

  // The rasika leaves by the tab bar. The field goes with its page, which fires no blur, and
  // the phone goes on reporting the keyboard: the bar still comes down.
  await tab(page, 'Season').click();
  await expect(page.locator('[data-curtain-field]')).toBeVisible();
  await expectNavAtFoot(page);

  // And once the field is only left, the keyboard's going unannounced.
  await page.goBack();
  await page.getByRole('button', { name: 'Note' }).click();
  await page.getByRole('textbox', { name: 'Note' }).focus();
  await keyboard(336, true);
  await expect.poll(() => navLift(page)).toBe(336);
  await page.getByRole('textbox', { name: 'Note' }).blur();
  await expect.poll(() => navLift(page)).toBe(0);
});
