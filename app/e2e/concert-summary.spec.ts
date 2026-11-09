// A Concert ends on its own and its summary shows once (walkthrough S13): no "Done with this
// Concert", the summary as a modal on the next open after it ends, never again, and the Concert
// still editable after, with every Item kept.

import { expect, test, type Page } from '@playwright/test';
import { finishFirstLaunch, readMeta, readTable } from './helpers';

const START = new Date('2026-12-14T18:30:00');
const MINUTE = 60 * 1000;

async function openAt(page: Page, time: number) {
  await page.clock.setFixedTime(time);
  await page.goto('/');
  // Not by role: behind the modal, the page is hidden from the accessibility tree.
  await page.locator('main h1').waitFor();
}

test('the summary shows once, after the Concert ends, and the Concert stays editable', async ({
  page,
}) => {
  await page.clock.setFixedTime(START);
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await page.getByRole('link', { name: 'Done' }).click();
  // Nothing to tap to end it.
  await expect(page.getByRole('button', { name: /Done with this Concert/ })).toHaveCount(0);
  const [event] = await readTable<{ id: string }>(page, 'events');

  // Over by both clocks: the summary shows on the next open. When it is due, case by case, is
  // tests/store/concert-summary.test.ts's.
  await openAt(page, START.getTime() + 4 * 60 * MINUTE + MINUTE);
  const summary = page.getByRole('dialog');
  await expect(summary).toBeVisible();
  await expect(summary.getByRole('definition').first()).toHaveText('1');
  expect(await readMeta(page, `summaryShown:${event!.id}`)).toMatchObject({ eventId: event!.id });
  await page.keyboard.press('Escape');
  await expect(summary).toHaveCount(0);

  // Never again, on this open or the next.
  await openAt(page, START.getTime() + 4 * 60 * MINUTE + 2 * MINUTE);
  await page.waitForTimeout(1500);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Still editable: another Item is kept, and its summary has been shown already.
  await page.goto(`/event/${event!.id}`);
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page.getByRole('region', { name: 'Items' }).getByRole('listitem')).toHaveCount(2);
  expect(await readTable(page, 'items')).toHaveLength(2);
});
