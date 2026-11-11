// The Schedule (T058 to T061), listed on What's on (2026-11-08, 2026-11-11): an entry Shortlisted
// from its sheet (stored `planned`, ADR 0010), a cancellation that keeps the Shortlisted Event in
// its day marked, a Shortlist whose write failed, tried again, that makes the Event once, and the
// "schedule changed" sheet.

import { expect, test, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { failWritesOnDemand, finishFirstLaunch, readTable, setFailingWrites } from './helpers';

/** A date `days` from today on this machine's clock, as the phone reads it. */
function dayFromToday(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

const brothers = (fields: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
  id: 'academy-1',
  version: 1,
  date: dayFromToday(1),
  startTime: '16:00',
  sabha: 'Music Academy',
  kind: 'concert',
  title: null,
  billed: [
    { name: 'Malladi Sreeramprasad', role: 'vocal', group: 'Malladi Brothers' },
    { name: 'Malladi Ravikumar', role: 'vocal', group: 'Malladi Brothers' },
    { name: 'Pakkala Ramadas', role: 'violin', group: null },
  ],
  cancelled: false,
  ...fields,
});

const margam: ScheduleEntry = {
  id: 'narada-1',
  version: 1,
  date: dayFromToday(1),
  startTime: '18:30',
  sabha: 'Narada Gana Sabha',
  kind: 'dance',
  title: 'Margam',
  billed: [{ name: 'Alarmel Valli', role: 'dancer', group: null }],
  cancelled: false,
};

const called: ScheduleEntry = {
  ...brothers({ id: 'mylapore-1', date: dayFromToday(2), sabha: 'Mylapore Fine Arts' }),
  billed: [{ name: 'T. M. Krishna', role: 'vocal', group: null }],
  cancelled: true,
};

/** Store entries as a fetched file would leave them, then load the app again to read them. */
async function storeEntries(page: Page, entries: ScheduleEntry[]) {
  await page.evaluate(
    (entries) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('carnatic-wrapped');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('schedule', 'readwrite');
          for (const entry of entries) tx.objectStore('schedule').put(entry);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    entries,
  );
  await page.reload();
}

/** A concert's row on What's on: the row is its own tap, with no button in it. */
const listingRow = (page: Page, name: string) =>
  page.getByRole('main').getByRole('button', { name: new RegExp(`^${name}`) });

/** Open a listing's sheet and Shortlist it. */
async function add(page: Page, name: string) {
  await listingRow(page, name).click();
  await page
    .getByRole('dialog', { name })
    .getByRole('button', { name: 'Shortlist', exact: true })
    .click();
}

/** A concert's row in its day on What's on, the rasika's own or a plain listing. */
const ownRow = (page: Page, name: string) =>
  page.locator('[data-list]').getByRole('listitem').filter({ hasText: name });

/** What's on, loaded afresh: where the Schedule is listed. */
async function whatsOn(page: Page) {
  await page.goto('/whats-on');
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
}

test('the e2e build never asks the real public-data project for the Schedule (ADR 0009)', async ({
  page,
}) => {
  // playwright.config.ts builds with VITE_PUBLIC_DATA_URL empty, whatever app/.env holds. A
  // build with one would fetch at launch, and again on the reload.
  const asked: string[] = [];
  page.on('request', (request) => {
    if (/\/functions\/v1\/schedule\//.test(request.url())) asked.push(request.url());
  });
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(asked).toEqual([]);
});

test('an entry Shortlisted from the Schedule is the rasika’s, and stays marked once cancelled', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, [brothers(), margam, called]);
  await whatsOn(page);

  // A Group by its name with its accompanist under it, a Dance with its printed title, a
  // cancelled entry marked; no row has a button of its own, and a cancelled one's sheet has
  // neither Shortlist nor the second button.
  const rows = page.getByRole('main').getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Malladi Brothers');
  await expect(rows.nth(0)).toContainText('Pakkala Ramadas');
  await expect(rows.nth(0)).toContainText('Music Academy · 4:00 pm');
  await expect(rows.nth(1).getByRole('img', { name: 'Dance' })).toBeVisible();
  await expect(rows.nth(1)).toContainText('Margam');
  await expect(rows.nth(2).getByRole('img', { name: 'Cancelled' })).toBeVisible();
  await expect(rows.getByRole('button')).toHaveCount(3);
  await listingRow(page, 'T. M. Krishna').click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Shortlist/ })).toHaveCount(0);
  await expect(page.getByRole('dialog').getByRole('button', { name: "I'm here" })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Two quick taps Shortlist it once: the second never takes it off again.
  await listingRow(page, 'Malladi Brothers').click();
  await page
    .getByRole('dialog', { name: 'Malladi Brothers' })
    .getByRole('button', { name: 'Shortlist', exact: true })
    .dblclick();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Shortlisted' })).toBeVisible();
  const events = await readTable<{ id: string; status: string; source: string }>(page, 'events');
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ status: 'planned', source: 'schedule' });
  expect(await readTable(page, 'appearances')).toHaveLength(3);

  await page.keyboard.press('Escape');
  // Shown once, as theirs, with the star.
  await expect(rows).toHaveCount(3);
  await expect(
    ownRow(page, 'Malladi Brothers').getByRole('img', { name: 'Shortlisted' }),
  ).toBeVisible();
  await expect(
    ownRow(page, 'Malladi Brothers').getByRole('img', { name: 'Cancelled' }),
  ).toHaveCount(0);

  // The Sabha cancels: the Shortlisted Event stays in its day, marked, until the rasika removes it.
  await storeEntries(page, [brothers({ version: 2, cancelled: true }), margam, called]);
  await expect(
    ownRow(page, 'Malladi Brothers').getByRole('img', { name: 'Cancelled' }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readTable<{ cancelled: boolean }>(page, 'events'))[0]?.cancelled)
    .toBe(true);
  // Shown once, as theirs; the Dance is still a listing to Shortlist.
  await expect(rows).toHaveCount(3);
  await page.getByRole('main').getByRole('button').filter({ hasText: 'Margam' }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Shortlist', exact: true }),
  ).toHaveCount(1);
});

test('a Shortlist whose write failed is tried again and makes the Event once', async ({ page }) => {
  await failWritesOnDemand(page);
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, [brothers()]);
  await whatsOn(page);

  await setFailingWrites(page, true);
  await add(page, 'Malladi Brothers');
  const sheet = page.getByRole('dialog', { name: 'Malladi Brothers' });
  await expect(sheet.getByText('Not saved', { exact: true })).toBeVisible();
  expect(await readTable(page, 'events')).toEqual([]);

  await setFailingWrites(page, false);
  await sheet.getByRole('button', { name: /Try again/ }).click();
  await expect(sheet.getByRole('button', { name: 'Shortlisted' })).toBeVisible();
  await expect(sheet.getByText('Not saved', { exact: true })).toHaveCount(0);
  expect(await readTable(page, 'events')).toHaveLength(1);
  expect(await readTable(page, 'artists')).toHaveLength(3);
});

test('the "schedule changed" hint opens what changed: keep mine, then take a newer version', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, [brothers()]);
  await whatsOn(page);
  await add(page, 'Malladi Brothers');

  // The rasika makes it theirs: the Schedule then only hints.
  await page.getByRole('dialog').getByRole('button', { name: "I'm here" }).click();
  await page.getByRole('button', { name: 'Note' }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('front row');
  await page.getByRole('textbox', { name: 'Note' }).blur();
  await expect
    .poll(async () => (await readTable<{ note: string | null }>(page, 'events'))[0]?.note)
    .toBe('front row');
  await whatsOn(page);
  await storeEntries(page, [brothers({ version: 2, startTime: '18:00' })]);

  // Its row in its day on What's on.
  const next = page.locator('[data-list]');
  await next.getByRole('button', { name: 'Schedule changed' }).click();
  const sheet = page.getByRole('dialog', { name: 'Schedule changed' });
  // Only what differs: the time, old beside new.
  await expect(sheet.getByRole('img', { name: 'Time' })).toBeVisible();
  await expect(sheet).toContainText('4:00 pm');
  await expect(sheet).toContainText('6:00 pm');
  await expect(sheet.getByRole('img', { name: 'Sabha' })).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Keep mine' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(next.getByRole('button', { name: 'Schedule changed' })).toHaveCount(0);
  const [kept] = await readTable<{ startTime: string; note: string; scheduleChanged: boolean }>(
    page,
    'events',
  );
  expect(kept).toMatchObject({ startTime: '16:00', note: 'front row', scheduleChanged: false });

  // A newer version hints again; taking it changes the time and keeps the note.
  await storeEntries(page, [brothers({ version: 3, startTime: '18:30' })]);
  await next.getByRole('button', { name: 'Schedule changed' }).click();
  await sheet.getByRole('button', { name: 'Take it' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(ownRow(page, 'Malladi Brothers')).toContainText('6:30 pm');
  const [taken] = await readTable<{ startTime: string; note: string; scheduleChanged: boolean }>(
    page,
    'events',
  );
  expect(taken).toMatchObject({ startTime: '18:30', note: 'front row', scheduleChanged: false });

  // The Sabha cancels: the row is marked, and its hint still opens, listing the cancellation.
  await storeEntries(page, [brothers({ version: 4, startTime: '18:30', cancelled: true })]);
  const row = next.getByRole('listitem').filter({ hasText: 'Malladi Brothers' });
  await expect(row.getByRole('img', { name: 'Cancelled' })).toBeVisible();
  await row.getByRole('button', { name: 'Schedule changed' }).click();
  await expect(sheet.getByRole('img', { name: 'Cancelled', exact: true })).toBeVisible();
  await expect(sheet.getByRole('img', { name: 'On', exact: true })).toBeVisible();
});

// The Maintainer's iPhone, 2026-11-09: Add Artist "doesn't seem to be connecting": the names the
// Season's Schedule bills were never offered, so a billed Artist could only be typed in new.
test('Add Artist finds an Artist the Schedule bills, and adds them once', async ({ page }) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, [brothers()]);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('button', { name: 'Add Artist' }).click();
  await page.getByRole('searchbox', { name: 'Search Artists' }).fill('ramad');
  const sheet = page.getByRole('dialog', { name: 'Add Artist' });
  // Told apart by the Role the Schedule bills them in.
  await sheet.getByRole('button', { name: 'Pakkala Ramadas Violin', exact: true }).click();
  await page.getByRole('button', { name: 'Violin' }).click();
  const stage = page.getByRole('region', { name: 'Stage' });
  await expect(stage.getByRole('button', { name: 'Pakkala Ramadas Violin' })).toHaveCount(1);
  // Made once, as an own Artist; offered again as that one, not the Schedule's name.
  await expect.poll(async () => (await readTable(page, 'artists')).length).toBe(1);
  await expect(sheet).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Artist' }).click();
  await page.getByRole('searchbox', { name: 'Search Artists' }).fill('ramad');
  const matches = sheet.getByRole('list').getByRole('button');
  await expect(matches.first()).toHaveAccessibleName(/^Pakkala Ramadas/);
  await expect(matches.filter({ hasText: 'Pakkala Ramadas' })).toHaveCount(1);
});
