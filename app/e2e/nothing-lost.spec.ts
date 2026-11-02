// Required tests (constitution IV, "nothing lost"; review of PR #5, items A1, A4, A6, A7, A8):
// journeys where a value could be lost or a screen could lose the rasika's typing. Writes are
// made to fail by a test-only script in the page (helpers.ts, failWritesOnDemand).

import { expect, test, type Page } from '@playwright/test';
import { failWritesOnDemand, finishFirstLaunch, readTable, setFailingWrites } from './helpers';

async function newConcert(page: Page) {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert now' }).click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
}

test('A1: a failed first pick tried again opens its Item, and the next pick makes a new one', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  await newConcert(page);
  await page.getByRole('link', { name: 'Add Item' }).click();

  await setFailingWrites(page, true);
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await expect(page.getByText('Not saved on this phone.')).toBeVisible();
  await setFailingWrites(page, false);
  await page.getByRole('button', { name: 'Try again' }).click();

  // The retry made the Item: the editor moves on to it.
  await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();
  await page.getByRole('link', { name: 'Next Item' }).click();
  await page.getByRole('searchbox', { name: 'Search songs and Ragas' }).fill('Bhavayami');
  await page.getByRole('button', { name: 'Use what I typed: “Bhavayami”' }).click();
  await expect(page.getByRole('button', { name: /^Composition, Bhavayami/ })).toBeVisible();

  const items = await readTable<{ title: string; position: number }>(page, 'items');
  items.sort((a, b) => a.position - b.position);
  expect(items.map((item) => item.title)).toEqual(['?', 'Bhavayami']);
});

test('A4: a new Concert that failed to save is listed at the top with Try again', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  await page.goto('/');
  await finishFirstLaunch(page);

  await setFailingWrites(page, true);
  await page.getByRole('button', { name: 'Log a Concert now' }).click();
  await page.getByRole('button', { name: 'Log a Concert now' }).click();
  // Each attempt is its own entry: the second never hides the first.
  await expect(page.getByText('2 changes not saved on this phone.')).toBeVisible();

  await setFailingWrites(page, false);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText(/not saved on this phone/)).toHaveCount(0);
  expect(await readTable(page, 'events')).toHaveLength(2);
});

test('A6: the Laya vinyasam note is saved when the page is hidden, before any blur', async ({
  page,
}) => {
  await newConcert(page);
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await page.getByRole('button', { name: 'Laya vinyasam' }).click();
  await page.getByRole('button', { name: 'Laya vinyasam after this Item' }).click();
  const note = page.getByRole('textbox', { name: 'Note' });
  await note.fill('tisram, then khandam');

  // The phone locks: iOS fires pagehide, and no blur.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));

  await expect
    .poll(async () => {
      const [item] = await readTable<{ layaVinyasam: { note: string | null } | null }>(
        page,
        'items',
      );
      return item?.layaVinyasam?.note;
    })
    .toBe('tisram, then khandam');
  await expect(note).toBeFocused();
});

test('A8: the note keeps focus and every keystroke across its autosave', async ({ page }) => {
  await newConcert(page);
  const note = page.getByRole('textbox', { name: 'Note' });
  await note.click();
  await page.keyboard.type('Tisram');
  // The autosave runs and its highlight plays.
  await expect
    .poll(async () => (await readTable<{ note: string | null }>(page, 'events'))[0]?.note)
    .toBe('Tisram');
  await page.keyboard.type(' pallavi');

  await expect(note).toBeFocused();
  await expect(note).toHaveValue('Tisram pallavi');
});

test('A7: a second colour after a failed first one keeps the first as entered', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  await newConcert(page);
  await page.getByRole('button', { name: 'Add Artist' }).click();
  await page.getByRole('searchbox', { name: 'Search Artists' }).fill('Sanjay');
  await page.getByRole('button', { name: 'Add “Sanjay” as a new Artist' }).click();
  await page.getByRole('button', { name: 'vocal' }).click();

  await page.getByRole('button', { name: /^Colours for Sanjay/ }).click();
  await setFailingWrites(page, true);
  await page.getByRole('radio', { name: 'Red' }).click();
  await expect(page.getByText('Not saved on this phone.').first()).toBeVisible();
  await setFailingWrites(page, false);

  // The sheet shows Red as entered, so a second colour can be added to it.
  await expect(page.getByRole('radio', { name: 'Red' })).toBeChecked();
  await page.getByRole('button', { name: 'Second colour' }).click();
  await page.getByRole('radio', { name: 'Blue' }).click();

  await expect
    .poll(async () => {
      const [appearance] = await readTable<{
        colourPrimary: string | null;
        colourSecondary: string | null;
      }>(page, 'appearances');
      return appearance && [appearance.colourPrimary, appearance.colourSecondary];
    })
    .toEqual(['red', 'blue']);
});
