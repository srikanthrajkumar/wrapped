// The Diary's Recap card (DESIGN.md "Diary"): it shows only once a concert is heard, and opens a
// small "Coming soon" sheet that closes by its button, by Escape and by a tap outside, giving
// focus back to the card each time.

import { expect, test, type Page } from '@playwright/test';
import { harnessScript } from './harness/build';
import type { Harness } from './harness/entry';
import { finishFirstLaunch, tab } from './helpers';

const DAY = '2026-12-20';

async function hearOne(page: Page) {
  await page.addScriptTag({ content: await harnessScript() });
  await page.evaluate(async (date) => {
    const { events, items } = (globalThis as unknown as { harness: Harness }).harness;
    const event = await events.createEvent({ kind: 'concert', date });
    await items.addItem(event.id, { title: 'Tillana' });
  }, DAY);
}

test('the Recap card waits for a heard concert, then opens and closes its sheet', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(`${DAY}T19:00:00`));
  await page.goto('/');
  await finishFirstLaunch(page);

  // None heard: the Diary is its empty state alone.
  await tab(page, 'Diary').click();
  await expect(page.getByText('Nothing heard yet')).toBeVisible();
  const card = page.getByRole('button', { name: /^Recap/ });
  await expect(card).toHaveCount(0);

  // One heard: the card stands above the list, a real button that opens a dialog.
  await hearOne(page);
  await expect(card).toBeVisible();
  await expect(card).toHaveAccessibleName('Recap Coming soon');
  await expect(card).toHaveAttribute('aria-haspopup', 'dialog');
  const list = page.getByRole('main').getByRole('listitem');
  await expect(list).toHaveCount(1);
  expect((await card.boundingBox())!.y).toBeLessThan((await list.boundingBox())!.y);

  const sheet = page.getByRole('dialog', { name: 'Coming soon' });
  const opened = async () => {
    await card.click();
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('The ragas and artists you heard most');
    // Focus is kept inside while it is open.
    await page.keyboard.press('Tab');
    expect(await sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  };
  const closed = async () => {
    await expect(sheet).toHaveCount(0);
    await expect(card).toBeFocused();
  };

  // Closed by its button.
  await opened();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await closed();
  // By Escape.
  await opened();
  await page.keyboard.press('Escape');
  await closed();
  // By a tap outside it, on the scrim above.
  await opened();
  await page.mouse.click(195, 40);
  await closed();
  // Nothing was written: the card only tells.
  await expect(list).toHaveCount(1);
});
