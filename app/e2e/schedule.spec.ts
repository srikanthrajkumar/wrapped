// The Schedule (T058 to T061): opened from the calendar button beside Season's "Next", an entry
// added to Next as Planned, a cancellation that keeps the Planned Event in Next marked, an add
// whose write failed, tried again, that plans the entry once, and the "schedule changed" sheet.

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

async function openSchedule(page: Page) {
  await page.getByRole('region', { name: 'Next' }).getByRole('link', { name: 'Schedule' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule', level: 1 })).toBeVisible();
}

test('an entry added from the Schedule is in Next, and stays there marked once cancelled', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  // No Schedule, no Next: day one stays the title and the bar.
  await expect(page.getByRole('region', { name: 'Next' })).toHaveCount(0);
  await storeEntries(page, [brothers(), margam, called]);
  await openSchedule(page);

  // A Group by its name, a Dance with its printed title, a cancelled entry with no add button.
  const cards = page.getByRole('listitem');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('Malladi Brothers');
  await expect(cards.nth(0)).toContainText('Music Academy · 4:00 pm');
  await expect(cards.nth(1).getByRole('img', { name: 'Dance' })).toBeVisible();
  await expect(cards.nth(1)).toContainText('Margam');
  await expect(cards.nth(2).getByRole('img', { name: 'Cancelled' })).toBeVisible();
  await expect(cards.nth(2).getByRole('button')).toHaveCount(0);

  await page.getByRole('button', { name: 'Add to Next: Malladi Brothers' }).click();
  await expect(page.getByRole('link', { name: 'In Next: Malladi Brothers' })).toBeVisible();
  const [event] = await readTable<{ id: string; status: string; source: string }>(page, 'events');
  expect(event).toMatchObject({ status: 'planned', source: 'schedule' });
  expect(await readTable(page, 'appearances')).toHaveLength(3);

  await page.getByRole('link', { name: 'Season' }).first().click();
  const next = page.getByRole('region', { name: 'Next' });
  await expect(next.getByRole('link', { name: /^Malladi Brothers/ })).toBeVisible();
  await expect(next.getByRole('img', { name: 'Cancelled' })).toHaveCount(0);

  // The Sabha cancels: the Planned Event stays in Next, marked, until the rasika removes it.
  await storeEntries(page, [brothers({ version: 2, cancelled: true }), margam, called]);
  await expect(
    next.getByRole('link', { name: /^Malladi Brothers/ }).getByRole('img', { name: 'Cancelled' }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readTable<{ cancelled: boolean }>(page, 'events'))[0]?.cancelled)
    .toBe(true);
  await openSchedule(page);
  await expect(
    page.getByRole('listitem').nth(0).getByRole('img', { name: 'Cancelled' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add to Next/ })).toHaveCount(1);
});

test('an add whose write failed is tried again and plans the entry once', async ({ page }) => {
  await failWritesOnDemand(page);
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, [brothers()]);
  await openSchedule(page);

  await setFailingWrites(page, true);
  await page.getByRole('button', { name: 'Add to Next: Malladi Brothers' }).click();
  const card = page.getByRole('listitem').filter({ hasText: 'Malladi Brothers' });
  await expect(card.getByText('Not saved', { exact: true })).toBeVisible();
  expect(await readTable(page, 'events')).toEqual([]);

  await setFailingWrites(page, false);
  await card.getByRole('button', { name: /Try again/ }).click();
  await expect(page.getByRole('link', { name: 'In Next: Malladi Brothers' })).toBeVisible();
  await expect(card.getByText('Not saved', { exact: true })).toHaveCount(0);
  expect(await readTable(page, 'events')).toHaveLength(1);
  expect(await readTable(page, 'artists')).toHaveLength(3);
});

test('the "schedule changed" hint opens what changed: keep mine, then take a newer version', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, [brothers()]);
  await openSchedule(page);
  await page.getByRole('button', { name: 'Add to Next: Malladi Brothers' }).click();

  // The rasika makes it theirs: the Schedule then only hints.
  await page.getByRole('link', { name: 'In Next: Malladi Brothers' }).click();
  await page.getByRole('button', { name: 'Note' }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('front row');
  await page.getByRole('textbox', { name: 'Note' }).blur();
  await expect
    .poll(async () => (await readTable<{ note: string | null }>(page, 'events'))[0]?.note)
    .toBe('front row');
  await page.goto('/');
  await storeEntries(page, [brothers({ version: 2, startTime: '18:00' })]);

  const next = page.getByRole('region', { name: 'Next' });
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
  await expect(next.getByRole('link', { name: /^Malladi Brothers/ })).toContainText('6:30 pm');
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
