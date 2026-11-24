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

/** The hub's first section: Today, or the next day once nothing is left today. */
const soon = (page: Page, day = 'Today') => page.getByRole('region', { name: day, exact: true });
/** Each of its rows, by the name it leads with. */
const soonRows = async (page: Page, day = 'Today') =>
  (await soon(page, day).getByRole('listitem').allInnerTexts()).map((text) => text.split('\n')[0]);
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

test('day one: the title and the +, three sections, and nothing listed', async ({ page }) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  // The +: a 28px mark in a 48px target. Settings has left the curtain for the tab bar.
  const plus = page.getByRole('button', { name: 'Log a Concert' });
  expect((await plus.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  expect((await plus.locator('svg').boundingBox())!.width).toBe(28);
  await expect(page.getByRole('main').getByRole('link', { name: /^Settings/ })).toHaveCount(0);
  // One pattern, three sections, three chevrons; the empty state only where nothing is listed.
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText([
    'Today',
    'Nothing listed yet',
    'Shortlist',
    'Diary',
  ]);
  await expect(chevrons(page)).toHaveCount(3);
  await expect(page.locator('main a[href="/shortlist"]')).toContainText('Nothing yet');
  await expect(page.locator('main a[href="/diary"]')).toContainText('Nothing heard yet');
  // No panel without rows, and no search bar on the hub.
  await expect(page.locator('main .panel')).toHaveCount(0);
  await expect(page.locator('footer [data-season-bar]')).toHaveCount(0);

  // Four tabs. Settings is one, with a plain header and no way back to give.
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveCount(4);
  await tab(page, 'Settings').click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(tab(page, 'Settings')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('main').getByRole('link', { name: 'Season' })).toHaveCount(0);
  await tab(page, 'Season').click();
  await expect(page.locator('[data-curtain-field]')).toBeVisible();

  // The Shortlist and the Diary: a plain header each, and their empty states.
  await tab(page, 'Shortlist').click();
  await expect(page.getByRole('heading', { name: 'Shortlist', exact: true })).toBeVisible();
  await expect(page.getByText('Nothing shortlisted')).toBeVisible();
  await expect(page.locator('[data-curtain-field]')).toHaveCount(0);
  await tab(page, 'Diary').click();
  await expect(page.getByRole('heading', { name: 'Diary', exact: true })).toBeVisible();
  await expect(page.getByText('Nothing heard yet')).toBeVisible();
});

test('at 3:40 the hub shows today’s next slot, how close it is, and What’s on one tap away', async ({
  page,
}) => {
  await openAt(page, at('15:40'));
  // The next slot first, by Sabha; the two under way wait behind the door.
  expect(await soonRows(page)).toEqual(['Singer d4', 'Singer e4', 'Singer f4', 'Singer g4']);
  await expect(soon(page).getByRole('listitem').first()).toContainText('Violinist d4');
  // Inside the hour a row says how close it is, in full ink; the clock time is for What's on.
  const first = soon(page).getByRole('listitem').first();
  // Time first (the row spec, 2026-11-16).
  await expect(first).toContainText('in 20 min · Sabha d4');
  await expect(first.getByText('in 20 min')).toHaveCSS(
    'color',
    await first.getByText('Singer d4').evaluate((lead) => getComputedStyle(lead).color),
  );
  // The header is the way into What's on, with the count of what is left today: the two under
  // way, the four at 4:00 and the one at 6:00.
  await expect(door(page)).toContainText('Today');
  await expect(door(page)).toContainText('7');
  // No row carries a chevron or a button of its own; each section's header does: three.
  await expect(soon(page).getByRole('listitem').locator('.tabler-icon-chevron-right')).toHaveCount(
    0,
  );
  await expect(chevrons(page)).toHaveCount(3);
  // The rows stand on a panel, their text on the header's column, 24px from the screen's edge.
  const column = (locator: ReturnType<Page['locator']>) =>
    locator.evaluate((node) => Math.round(node.getBoundingClientRect().left));
  expect(await column(page.getByRole('heading', { name: 'Today', exact: true }))).toBe(24);
  expect(await column(first.getByText('Singer d4'))).toBe(24);
  expect(await column(page.locator('main .panel').first())).toBe(8);

  // What's on: today from now, what is over folded to one line, a dot on what is under way.
  await door(page).click();
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
  const today = page.getByRole('region', { name: 'Sun 20 Dec' });
  const earlier = today.getByRole('button', { name: /^Earlier today/ });
  await expect(earlier).toContainText('1');
  // "Earlier today" is the first row of its day's panel; then the concerts (the row spec).
  const concerts = today.locator('[data-row="concert"]');
  await expect(concerts).toHaveCount(7);
  await expect(today.getByRole('img', { name: 'On now' })).toHaveCount(2);
  await expect(concerts.first()).toContainText('Singer a1');
  // The type, for a concert that isn't vocal, and its accompanists.
  const flute = today.getByRole('listitem').filter({ hasText: 'Flautist i6' });
  await expect(flute).toContainText('Flute');
  await expect(flute).toContainText('Drummer i6');
  await earlier.click();
  await expect(concerts).toHaveCount(8);
  await expect(concerts.first()).toContainText('Singer early');

  // Shortlisted, it is the rasika's: a star by its time, the hero on the hub, counted on the tile.
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
  // Time first, as a row says it (the hub spec's decision 3): "in 20 min" leads, in 600.
  await expect(next).toContainText('in 20 min · Sabha f4');
  expect(
    await next.getByText('in 20 min').evaluate((node) => getComputedStyle(node).fontWeight),
  ).toBe('600');
  // No chevron on the hero.
  await expect(next.locator('.tabler-icon-chevron-right')).toHaveCount(0);
  // The hero's concert is not shown again under Today (the hub spec's decision 1): the rest of
  // its slot, then the latest under way. The count is still the day's.
  expect(await soonRows(page)).toEqual(['Singer d4', 'Singer e4', 'Singer g4', 'Singer b3']);
  await expect(door(page)).toContainText('7');
  const tile = page.locator('main a[href="/shortlist"]');
  await expect(tile).toContainText('1 in 20 min');
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
  await expect(pick.getByRole('link').first()).toContainText('in 20 min · Sabha f4');
  // Neither is shown again under Today: the next of the slot, then those under way.
  expect(await soonRows(page)).toEqual(['Singer d4', 'Singer e4', 'Singer b3', 'Singer a1']);

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
  await expect(heard).toContainText('Today · 4:00 pm · Sabha g4 · 1 Item');
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
  // The one being logged is not shown again, neither under Today nor as the Diary's row; the
  // other Shortlisted one leads Today, starred.
  expect(await soonRows(page)).toEqual(['Singer f4', 'Singer d4', 'Singer e4', 'Singer b3']);
  const diary = page.getByRole('region', { name: 'Diary', exact: true });
  await expect(diary.locator('a[href="/diary"]')).toContainText('1');
  await expect(diary.getByRole('listitem')).toHaveCount(0);
  // Its star ends the lead's line, in its own column at the row's right edge.
  const mine = soon(page).getByRole('listitem').first();
  const star = (await mine.getByRole('img', { name: 'Shortlisted' }).boundingBox())!;
  const lead = (await mine.getByText('Singer f4').boundingBox())!;
  expect(star.y).toBeGreaterThanOrEqual(lead.y);
  expect(star.y + star.height).toBeLessThanOrEqual(lead.y + lead.height);
  expect(Math.round(star.x + star.width)).toBeGreaterThanOrEqual(390 - 24 - 1);
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
  // Its concerts, then "None of these" as an Action row in the same panel (the row spec).
  await expect(card.locator('[data-row="concert"]')).toHaveCount(2);
  await expect(card).toContainText('Sat 19 Dec');
  // Neither is on the Shortlist any more, nor the hero.
  await expect(page.getByRole('region', { name: 'Next' })).toHaveCount(0);

  // Before any answer, the other answer is for all of them; after a "Yes", for the rest.
  await expect(card.getByRole('button', { name: 'None of these' })).toBeVisible();
  await card.getByRole('button', { name: 'I was at Evening Singer' }).click();
  await expect(card.locator('[data-row="concert"]')).toHaveCount(1);
  await expect(card.getByRole('button', { name: 'None of these' })).toHaveCount(0);
  await card.getByRole('button', { name: 'None of the rest' }).click();
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
  const diary = page.getByRole('region', { name: 'Diary', exact: true });
  await expect(diary.locator('a[href="/diary"]')).toContainText('1');
  await expect(chevrons(page)).toHaveCount(3);
  // Heard with nothing logged yet: its row says nothing about Items, here or in the Diary.
  await expect(diary.getByRole('listitem')).toContainText('Evening Singer');
  await expect(diary.getByRole('listitem')).not.toContainText('Item');
  await tab(page, 'Diary').click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('listitem')).toContainText('Evening Singer');
  await expect(page.getByRole('main').getByRole('listitem')).not.toContainText('Item');
  await tab(page, 'Shortlist').click();
  await expect(page.getByText('Nothing shortlisted')).toBeVisible();
});

// The user, 2026-11-17: a lapse row is one tap, as any Concert row; its "Yes" only answers.
test('a lapse row opens its concert, and its "Yes" only answers', async ({ page }) => {
  await openAt(page, at('15:40'));
  await page.addScriptTag({ content: await harnessScript() });
  const ids = await page.evaluate(async () => {
    const { events, people } = (globalThis as unknown as { harness: Harness }).harness;
    const made: string[] = [];
    for (const [name, startTime] of [
      ['Morning Singer', '11:00'],
      ['Evening Singer', '18:45'],
    ] as const) {
      const event = await events.createEvent({
        kind: 'concert',
        date: '2026-12-19',
        startTime,
        source: 'plan',
      });
      const artist = await people.createArtist(name);
      await people.addAppearance(event.id, artist.id, { role: 'vocal' });
      made.push(event.id);
    }
    return made;
  });
  await page.reload();
  const card = page.getByRole('region', { name: 'Were you at any of these?' });
  const row = (name: string) => card.locator('[data-row="concert"]', { hasText: name });
  await expect(row('Morning Singer')).toBeVisible();
  // The row opens its concert.
  await row('Morning Singer').getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/event/${ids[0]}$`));
  await tab(page, 'Season').click();
  await expect(card.locator('[data-row="concert"]')).toHaveCount(2);
  // "Yes" answers, and opens nothing.
  await card.getByRole('button', { name: 'I was at Evening Singer' }).click();
  await expect(card.locator('[data-row="concert"]')).toHaveCount(1);
  expect(new URL(page.url()).pathname).toBe('/');
});

// The user, 2026-11-17: under a slot's time, where no time shows, a concert under way says so.
test('under a Shortlist slot, a concert under way reads "● On now · Sabha"', async ({ page }) => {
  await openAt(page, at('15:40'));
  await shortlist(page, 'Singer f4');
  await shortlist(page, 'Singer g4');
  await page.clock.setFixedTime(at('16:10'));
  await page.reload();
  await page.locator('main h1').waitFor();
  // In the hero, under way is the start time with no dot: its word says it (the hub spec's
  // decision 3).
  const pick = page.getByRole('region', { name: 'Pick your dusk' });
  await expect(pick.getByRole('link').first()).toContainText('4:00 pm · Sabha f4');
  await expect(pick.locator('.rounded-full')).toHaveCount(0);
  await tab(page, 'Shortlist').click();
  const row = page.locator('main [data-row="concert"]', { hasText: 'Singer f4' });
  const facts = row.locator('[data-facts]');
  await expect(facts).toHaveText('On now · Sabha f4');
  // Led by the dot, the words in 600 ink.
  await expect(facts.locator('.rounded-full')).toHaveCount(1);
  expect(
    await facts.getByText('On now').evaluate((node) => getComputedStyle(node).fontWeight),
  ).toBe('600');
});

test('with nothing left today, Tomorrow leads, and a concert under way reads "On now"', async ({
  page,
}) => {
  // 4:10: the 4:00 slot has begun. The next slot is 6:00, then those under way, latest first.
  await openAt(page, at('16:10'));
  expect(await soonRows(page)).toEqual(['Flautist i6Flute', 'Singer g4', 'Singer f4', 'Singer e4']);
  const rows = soon(page).getByRole('listitem');
  await expect(rows.nth(0)).toContainText('6:00 pm · Sabha i6');
  // The dot and "On now" lead the facts (the row spec, 2026-11-16).
  await expect(rows.nth(1)).toContainText('On now · Sabha g4');
  await expect(rows.nth(1)).not.toContainText('4:00 pm');

  // 9:40 pm: no big empty state. The first section is tomorrow's, with its clock times.
  await page.clock.setFixedTime(at('21:40'));
  await page.reload();
  await page.locator('main h1').waitFor();
  await expect(page.getByText('Nothing more today')).toHaveCount(0);
  await expect(page.getByText('Nothing else ahead')).toHaveCount(0);
  expect(await soonRows(page, 'Tomorrow')).toEqual(['Singer z']);
  await expect(soon(page, 'Tomorrow').getByRole('listitem')).toContainText('9:00 am · Sabha z');
  // Its header opens What's on, starting at that day.
  await expect(door(page)).toContainText('Tomorrow');
  await door(page).click();
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
  const first = page.locator('[data-list] section[data-place]').first();
  await expect(first).toHaveAttribute('data-place', NEXT_DAY);
});

// The hub spec's decisions 1 to 3 (docs/design/screens/hub.md; the user, 2026-11-21): one word
// for one day, the hero written as a row, and its concert never shown twice.
test('the hub names tomorrow "Tomorrow" everywhere, and never shows the hero twice', async ({
  page,
}) => {
  await openAt(page, at('16:10'));
  // A flute concert at 6:00, Shortlisted: Next, its name on the column, its instrument after it.
  await shortlist(page, 'Flautist i6');
  const next = page.getByRole('region', { name: 'Next' });
  const link = next.getByRole('link');
  await expect(link).toContainText('Today · 6:00 pm · Sabha i6');
  // The name starts on the column; "Flute" follows its last word, on the same line.
  const [nameLeft, lastRight, lastTop, wordLeft, wordTop] = await link
    .getByText('Flute', { exact: true })
    .evaluate((word) => {
      const kept = word.parentElement!;
      const range = document.createRange();
      range.selectNodeContents(kept.parentElement!);
      const first = range.getClientRects()[0]!;
      range.selectNodeContents(kept.firstChild!);
      const last = range.getBoundingClientRect();
      const box = word.getBoundingClientRect();
      return [first.left, last.right, last.top, box.left, box.top];
    });
  expect(Math.round(nameLeft)).toBe(24);
  expect(wordLeft).toBeGreaterThan(lastRight);
  expect(Math.abs(wordTop - lastTop)).toBeLessThan(12);
  expect(await soonRows(page)).toEqual(['Singer g4', 'Singer f4', 'Singer e4', 'Singer d4']);

  // 10:10 pm: four hours on and not answered, so the lapse question names today "Today".
  await page.clock.setFixedTime(at('22:10'));
  await page.reload();
  await page.locator('main h1').waitFor();
  const card = page.getByRole('region', { name: 'Were you at any of these?' });
  await expect(card).toContainText('Today');
  await expect(card).not.toContainText('Sun 20 Dec');
  await card.getByRole('button', { name: 'None of these' }).click();
  await expect(card).toHaveCount(0);

  // Tomorrow's only concert Shortlisted: the hero says "Tomorrow", the Shortlist line "1
  // tomorrow", and with nothing else ahead the first section says so.
  await shortlist(page, 'Singer z');
  await expect(next.getByRole('link')).toContainText('Tomorrow · 9:00 am · Sabha z');
  await expect(page.locator('main a[href="/shortlist"]')).toContainText('1 tomorrow');
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText([
    'Today',
    'Nothing else ahead',
    'Shortlist',
    'Diary',
  ]);
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

  // Two names don't fit a panel's 342px column: one whole name and a count, on one line, never
  // cut (on the page's 358px, before the panels of 2026-11-16, two fitted).
  const many = rows.filter({ hasText: 'Singer many' });
  const names = many.getByText('Thiruvizha Sri. Viju. S. Anand');
  await expect(names).toHaveText('Thiruvizha Sri. Viju. S. Anand +2');
  expect(await names.evaluate((line) => line.scrollWidth <= line.clientWidth)).toBe(true);
  expect(Math.round((await names.boundingBox())!.height)).toBe(20);
  // Three lines, 12px above and below: 88px.
  expect(Math.round((await many.boundingBox())!.height)).toBe(88);

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

// A Lecdem may have 6 presenters (ADR 0013). From 4 up, a row and the hero name 2, then "+N",
// spoken "and N more"; up to 3 read in full; the Event's Stage lists them all (the user,
// 2026-11-24). Invented names, of real length.
test('a Lecdem with 6 presenters names 2 and "+4" on its row and the hero, its Stage all 6', async ({
  page,
}) => {
  const names = [
    'Dr. Kamala Venkataraman',
    'Prof. S. Raghavendra Rao',
    'Dr. Meera Subrahmanyam',
    'T. N. Lakshminarayanan',
    'Dr. Padma Sundararajan',
    'K. Srinivasa Gopalan',
  ];
  await openAt(page, at('15:40'), [
    entry('panel', '16:00', {
      kind: 'lecdem',
      title: 'Articles in 100 years of the Journal',
      billed: names.map((name) => ({ name, role: 'presenter', group: null, support: false })),
    }),
    // Up to 3 read in full, as before.
    entry('trio', '18:00', {
      kind: 'lecdem',
      title: 'On Todi',
      billed: ['Trio A', 'Trio B', 'Trio C'].map((name) => ({
        name,
        role: 'presenter',
        group: null,
        support: false,
      })),
    }),
  ]);
  const spoken = /^Dr\.\sKamala\sVenkataraman,\sProf\.\sS\.\sRaghavendra\sRao\sand\s4\smore\b/;

  // What's on: two whole names, then "+4", on at most two lines; the rest left to the sheet.
  await door(page).click();
  const row = page.locator('main [data-row="concert"]', { hasText: 'Dr. Kamala' });
  const name = row.locator('[data-name]');
  await expect(name.getByText('+4', { exact: true })).toBeVisible();
  for (const hidden of names.slice(2)) await expect(row).not.toContainText(hidden);
  expect(Math.round((await name.boundingBox())!.height)).toBeLessThanOrEqual(48);
  await expect(row.getByRole('button')).toHaveAccessibleName(spoken);
  const trio = page.locator('main [data-row="concert"]', { hasText: 'Trio A' });
  await expect(trio.locator('[data-name]')).toHaveText('Trio A, Trio B & Trio C');

  // The Shortlist's row, the same.
  await shortlist(page, 'Dr. Kamala');
  await tab(page, 'Shortlist').click();
  const mine = page.locator('main [data-row="concert"]', { hasText: 'Dr. Kamala' });
  await expect(mine.getByText('+4', { exact: true })).toBeVisible();
  await expect(mine.getByRole('button')).toHaveAccessibleName(spoken);

  // The hero, the same.
  await openHub(page);
  const hero = page.getByRole('region', { name: 'Next' }).getByRole('link');
  await expect(hero.getByText('+4', { exact: true })).toBeVisible();
  for (const hidden of names.slice(2)) await expect(hero).not.toContainText(hidden);
  await expect(hero).toHaveAccessibleName(spoken);

  // The Event's Stage has everyone.
  await hero.click();
  const stage = page.getByRole('region', { name: 'Stage' }).getByRole('listitem');
  await expect(stage).toHaveCount(6);
  for (const [i, one] of names.entries()) await expect(stage.nth(i)).toContainText(one);
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
  const curtain = page.locator('[data-curtain-field]');
  expect((await curtain.boundingBox())!.y).toBe(0);
  await expect.poll(paint).toBe('rgba(0, 0, 0, 0)');
  // The page is drawn up over it as a sheet: the curtain's last 18px, in the page's colour,
  // with 18px top corners (the Maintainer, 2026-11-14). Above it, the inset and the title's 96px.
  const edge = curtain.locator('> :last-child');
  expect(
    await edge.evaluate((node) => {
      const style = getComputedStyle(node);
      return [style.backgroundColor, style.borderTopLeftRadius, style.borderTopRightRadius];
    }),
  ).toEqual([await page_(), '18px', '18px']);
  const [field, sheetEdge] = [(await curtain.boundingBox())!, (await edge.boundingBox())!];
  expect(sheetEdge.height).toBe(18);
  expect(sheetEdge.y + sheetEdge.height).toBe(field.y + field.height);
  expect(field.height).toBe(59 + 96 + 18);
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

  // In light the band is the motif's blush (the Maintainer, 2026-11-17), never the white page.
  await page.evaluate(() => localStorage.setItem('wrapped.theme', 'light'));
  await page.reload();
  await page.locator('main h1').waitFor();
  const white = await page_();
  await expect.poll(paint).not.toBe(white);
  await expect.poll(paint).not.toBe('rgba(0, 0, 0, 0)');
  const blush = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--motif-blush)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  });
  await expect.poll(paint).toBe(blush);
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
  await expect(soon(page, 'Tomorrow').getByRole('listitem').first()).toBeVisible();
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

// An installed iPhone app that draws under the clock is sized a status bar short by iOS unless
// its page is as tall as the large viewport (the Maintainer's iPhone, 2026-11-13: the tab bar
// sat 59pt above the bottom edge). No test here can stand in for that iOS, so this holds the
// wiring: which height the app sizes itself by, where.
test('an installed iPhone app sizes its page by the whole screen, a browser tab as before', async ({
  page,
}) => {
  const sizedBy = () =>
    page.evaluate(() => ({
      installed: document.documentElement.hasAttribute('data-ios-app'),
      height: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
    }));
  await page.goto('/');
  await finishFirstLaunch(page);
  expect(await sizedBy()).toEqual({ installed: false, height: '100dvh' });

  // Opened from the Home Screen: iOS says so before anything draws.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true }),
  );
  await page.reload();
  await page.locator('main h1').waitFor();
  expect(await sizedBy()).toEqual({ installed: true, height: '100lvh' });
  // The shell is as tall as the screen it has, and the tab bar is at its foot.
  const shell = await page.evaluate(() => {
    const column = document.querySelector('main')!.parentElement!;
    return [Math.round(column.getBoundingClientRect().height), window.innerHeight];
  });
  expect(shell[0]).toBeGreaterThanOrEqual(shell[1]!);
  await expectNavAtFoot(page);
});
