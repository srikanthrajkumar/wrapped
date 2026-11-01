// Required test (constitution IV; T048d, design D15, eng D5 and D6): when the phone cannot store
// a change, the screen keeps the value as entered with "Not saved on this phone", never the save
// highlight; its Export holds the stored season plus that value; Try again saves it once the
// phone can write again. IndexedDB writes are made to fail by a test-only script in the page.

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { finishFirstLaunch, readMeta } from './helpers';

test('a failed save stays on screen as "Not saved", exports, and retries', async ({ page }) => {
  await page.addInitScript(() => {
    const flag = window as unknown as { failWrites?: boolean };
    for (const name of ['put', 'add'] as const) {
      const original = IDBObjectStore.prototype[name] as (...args: unknown[]) => IDBRequest;
      IDBObjectStore.prototype[name] = function (this: IDBObjectStore, ...args: unknown[]) {
        if (flag.failWrites) throw new DOMException('The disk is full', 'QuotaExceededError');
        return original.apply(this, args);
      };
    }
  });
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert now' }).click();
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  const tala = page.getByRole('button', { name: /^Tala,/ });
  await expect(tala).toHaveAccessibleName('Tala, unknown');

  // The phone stops storing anything.
  await page.evaluate(() => {
    (window as unknown as { failWrites: boolean }).failWrites = true;
  });
  await tala.click();
  await page.getByRole('button', { name: 'Not applicable' }).click();

  // The value stays as entered, marked not saved, with no highlight.
  await expect(page.getByText('Not saved on this phone.')).toBeVisible();
  await expect(tala).toHaveAccessibleName('Tala, not applicable');
  await expect(tala.locator('xpath=..')).not.toHaveClass(/save-highlight/);
  // Leaving and coming back keeps it (feedback lives outside the screen).
  await page.getByRole('link', { name: 'Done' }).click();
  await page.getByRole('link', { name: /^1/ }).click();
  await expect(page.getByText('Not saved on this phone.')).toBeVisible();

  // Export, while writes still fail: the stored season plus the stranded value.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const file = JSON.parse(readFileSync((await (await download).path())!, 'utf8'));
  expect(file.format).toBe(1);
  expect(file.items).toHaveLength(1);
  expect(file.items[0].tala).toMatchObject({ state: 'unknown' });
  expect(file.notSaved).toEqual([
    {
      table: 'items',
      id: file.items[0].id,
      field: 'tala',
      value: { state: 'na', key: null, text: '', guess: false },
      enteredAt: expect.any(String),
    },
  ]);

  // The phone can write again: Try again saves it, and the line goes.
  await page.evaluate(() => {
    (window as unknown as { failWrites: boolean }).failWrites = false;
  });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Not saved on this phone.')).toHaveCount(0);
  await expect(tala).toHaveAccessibleName('Tala, not applicable');
  expect(file.unsyncedOps).toBeGreaterThan(0);
  expect(await readMeta(page, 'firstLaunch')).toMatchObject({ doneAt: expect.any(String) });
});
