// Starting a log (docs/design/log-entry.md, decided by the user on 2026-11-22). Season's + still
// makes a blank Concert in one tap, and the blank Concert offers the listings near its time: one
// tapped fills it as "I'm here" does, with Undo. "Search What's on…" finds any listing of the
// Season; What's on's search with no match offers "Not listed? Start a Concert".

import { expect, test, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { finishFirstLaunch, readTable } from './helpers';

const DAY = '2026-12-19';
const at = (time: string, date = DAY) => new Date(`${date}T${time}:00`);

const entry = (
  id: string,
  startTime: string,
  sabha: string,
  billed: string[],
  fields: Partial<ScheduleEntry> = {},
): ScheduleEntry => ({
  id,
  version: 1,
  date: DAY,
  startTime,
  sabha,
  kind: 'concert',
  title: null,
  billed: billed.map((name, i) => ({
    name,
    role: i === 0 ? 'vocal' : i === 1 ? 'violin' : 'mridangam',
    group: null,
    support: false,
  })),
  cancelled: false,
  ...fields,
});

// Saturday 19 December around 4 pm, as the feed has it: four concerts began at 4:00.
const SATURDAY = [
  entry('kl', '13:30', 'Mylapore Fine Arts', ['Krupaa Lakshmi', 'Violin KL']),
  entry('am', '15:00', 'Bharat Kalachar', ['Amritha Murali', 'Violin AM']),
  entry('sp', '16:00', 'Narada Gana Sabha', ['Sriram Parasuram', 'Violin SP']),
  entry('sm', '16:00', 'Brahma Gana Sabha', ['S. Mahathi', 'Violin SM']),
  entry('nj', '16:00', 'Music Academy', ['NJ Nandini', 'Mysore Srikanth', 'Arjun Ganesh']),
  entry('bj', '16:00', 'Parthasarathy Swami Sabha', ['Bombay Jayashri', 'Violin BJ']),
  entry('ss', '18:00', 'Music Academy', ['Sanjay Subrahmanyan', 'Violin SS'], {
    date: '2026-12-22',
  }),
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

async function openAt(page: Page, time: Date, entries: ScheduleEntry[] = SATURDAY) {
  await page.clock.setFixedTime(time);
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, entries);
  await page.reload();
  await page.locator('main h1').waitFor();
}

/** Season's +: a blank Concert, opened. */
async function plus(page: Page) {
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
}

const offer = (page: Page) => page.getByRole('region', { name: 'Is it one of these?' });
const offerRows = async (page: Page) =>
  (await offer(page).getByRole('listitem').allInnerTexts()).map((text) =>
    // A name's initials are held to it with no-break spaces.
    text.split('\n')[0]!.replace(/\u00a0/g, ' '),
  );

interface StoredEvent {
  id: string;
  scheduleEntryId: string | null;
  status: string;
  deletedAt: string | null;
}

test('the + offers the four 4:00 concerts at 4:10, and one tapped fills the Concert', async ({
  page,
}) => {
  await openAt(page, at('16:10'));
  await plus(page);
  await expect(offer(page)).toContainText('On now or within the hour · tap to fill it in');
  expect(await offerRows(page)).toEqual([
    'S. Mahathi',
    'NJ Nandini',
    'Sriram Parasuram',
    'Bombay Jayashri',
  ]);
  await expect(page.getByRole('button', { name: "Search What's on…" })).toBeVisible();

  await offer(page)
    .getByRole('button', { name: /^NJ Nandini/ })
    .click();
  // The Event "I'm here" makes: the Artists billed, the Sabha, the listing's own time.
  await expect(page.locator('main h1')).toContainText('NJ Nandini');
  await expect(page.getByText('Music Academy · Sat 19 Dec · 4:00 pm')).toBeVisible();
  await expect(page.getByText('Mysore Srikanth')).toBeVisible();
  await expect(offer(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();

  // One Event, the listing's; the blank one left no row.
  const events = await readTable<StoredEvent>(page, 'events');
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ scheduleEntryId: 'nj', deletedAt: null });

  // Its first Item makes it Heard (ADR 0010).
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page.getByRole('region', { name: 'Items' }).getByRole('listitem')).toHaveCount(1);
  await expect
    .poll(async () => (await readTable<StoredEvent>(page, 'events'))[0]?.status)
    .toBe('attended');

  // Back goes to Season, where the + was tapped, never to the blank one.
  await page.getByRole('main').getByRole('link', { name: 'Season', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
});

test('Undo brings the blank Concert back, offer and all; left, it leaves no trace', async ({
  page,
}) => {
  await openAt(page, at('16:10'));
  await plus(page);
  const blank = new URL(page.url()).pathname;
  await offer(page)
    .getByRole('button', { name: /^S\. Mahathi/ })
    .click();
  await expect(page.locator('main h1')).toContainText('S. Mahathi');
  await expect(page.locator('[data-undo-bar]')).toContainText('S. Mahathi');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`${blank}$`));
  await expect(page.getByRole('button', { name: 'Add Artist' })).toBeVisible();
  await expect(offer(page)).toBeVisible();
  await expect
    .poll(async () =>
      (await readTable<StoredEvent>(page, 'events')).filter((event) => event.deletedAt === null),
    )
    .toHaveLength(1);

  await page.getByRole('main').getByRole('link', { name: 'Season', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  // The blank one is taken back; the Event the fill made stays only as a tombstone to sync.
  await expect
    .poll(async () =>
      (await readTable<StoredEvent>(page, 'events')).filter((event) => event.deletedAt === null),
    )
    .toEqual([]);
});

test('"Search What\'s on…" finds a listing on another day, and fills from it', async ({ page }) => {
  await openAt(page, at('16:10'));
  await plus(page);
  await page.getByRole('button', { name: "Search What's on…" }).click();
  const search = page.getByRole('dialog');
  await search.getByRole('searchbox').fill('Sanjay');
  await search.getByRole('button', { name: /Sanjay Subrahmanyan/ }).click();
  await expect(page.locator('main h1')).toContainText('Sanjay Subrahmanyan');
  await expect(page.getByText('Music Academy · Tue 22 Dec · 6:00 pm')).toBeVisible();
  expect(await readTable<StoredEvent>(page, 'events')).toMatchObject([
    { scheduleEntryId: 'ss', deletedAt: null },
  ]);
});

test('with no match, "Not listed? Fill it in yourself" goes back to the blank Concert', async ({
  page,
}) => {
  await openAt(page, at('16:10'));
  await plus(page);
  await page.getByRole('button', { name: "Search What's on…" }).click();
  const search = page.getByRole('dialog');
  await search.getByRole('searchbox').fill('Kapali');
  await expect(search.getByText('Nothing matches “Kapali”')).toBeVisible();
  await search.getByRole('button', { name: 'Not listed? Fill it in yourself' }).click();
  await expect(search).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Artist' })).toBeVisible();
});

test('the offer goes once a Sabha is set, and shows nothing near at 11:30 pm', async ({ page }) => {
  await openAt(page, at('23:30'));
  await plus(page);
  // Nothing near: no section, only the link, under "No Items yet".
  await expect(offer(page)).toHaveCount(0);
  await expect(page.getByText('No Items yet')).toBeVisible();
  await expect(page.getByRole('button', { name: "Search What's on…" })).toBeVisible();

  await page.clock.setFixedTime(at('16:10'));
  await page.goto('/');
  await plus(page);
  await expect(offer(page)).toBeVisible();
  await page.getByRole('button', { name: 'Add Sabha' }).click();
  await page.getByRole('dialog').getByRole('searchbox').fill('Music Academy');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Music Academy/ })
    .first()
    .click();
  await expect(offer(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: "Search What's on…" })).toHaveCount(0);
});

test("What's on's search with no match starts a Concert, which goes back to What's on", async ({
  page,
}) => {
  await openAt(page, at('16:10'));
  await page.goto('/whats-on');
  await page.getByRole('button', { name: /Artist or Sabha/ }).click();
  const search = page.getByRole('dialog');
  await search.getByRole('searchbox').fill('Kapali');
  await search.getByRole('button', { name: 'Not listed? Start a Concert' }).click();
  await expect(page.getByRole('button', { name: 'Add Artist' })).toBeVisible();
  // It offers its listings too.
  await expect(offer(page)).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: "What's on" })).toBeVisible();
  expect(await readTable<StoredEvent>(page, 'events')).toHaveLength(1);
});
