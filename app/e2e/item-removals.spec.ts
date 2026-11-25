// Required (constitution IV, nothing lost): a piece of an Item removed in its editor, a Raga, a
// part's own Raga, a Manodharma part, a nadai or the Layavinyasam, saves at once with no Undo
// bar: Undo is only for whole things, a Concert, an Item, an Artist, the Shortlist (the
// Maintainer, 2026-11-25). Each removal is stored, and still holds after a reload.

import { expect, test, type Page } from '@playwright/test';
import { finishFirstLaunch, readTable } from './helpers';

const value = (name: string) => ({ state: 'catalog', key: name, text: name, guess: false });
const nadai = (key: string) => ({ state: 'catalog', key, text: key, guess: false });

interface StoredItem {
  id: string;
  ragas: { text: string | null }[];
  improvised: { kind: string; ragas: ({ text: string | null } | null)[] }[];
  layaVinyasam: { nadais: { key: string | null }[]; note: string | null } | null;
}

async function theItem(page: Page): Promise<StoredItem> {
  const [item] = await readTable<StoredItem>(page, 'items');
  return item!;
}

/** Put the Item's pieces straight into IndexedDB, as an earlier session would have left them. */
async function seed(page: Page, changes: Record<string, unknown>) {
  const item = await theItem(page);
  await page.evaluate(
    (row) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('carnatic-wrapped');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const put = db.transaction('items', 'readwrite').objectStore('items').put(row);
          put.onsuccess = () => {
            db.close();
            resolve();
          };
          put.onerror = () => reject(put.error);
        };
      }),
    { ...item, ...changes },
  );
}

/** No Undo bar shows: given time to come, as it would right after the write. */
async function noUndoBar(page: Page) {
  await page.waitForTimeout(300);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-undo-bar]')).toHaveCount(0);
}

test('each piece of an Item removed saves at once with no Undo bar, and holds after a reload', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await expect.poll(async () => (await readTable(page, 'items')).length).toBe(1);

  await seed(page, {
    ragas: [value('Kalyani'), value('Kanada'), value('Behag')],
    improvised: [
      { kind: 'alapana', ragas: [] },
      { kind: 'tanam', ragas: [value('Todi'), value('Saveri')] },
    ],
    layaVinyasam: { nadais: [nadai('khanda'), nadai('tisra')], note: null },
  });
  await page.reload();

  // A Raga, from its sheet.
  await page.getByRole('button', { name: 'Kanada, Raga 2 of 3' }).click();
  await page.getByRole('button', { name: 'Remove Kanada' }).click();
  await expect
    .poll(async () => (await theItem(page)).ragas.map((raga) => raga.text))
    .toEqual(['Kalyani', 'Behag']);
  await noUndoBar(page);
  await page.keyboard.press('Escape');

  // A part's own Raga, from the part's sheet. With parts on, the fold is open.
  await expect(page.getByRole('button', { name: 'Manodharma', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: /^Tanam, Ragas Todi, Saveri/ }).click();
  await page.getByRole('button', { name: 'Remove Todi' }).click();
  await expect
    .poll(async () => (await theItem(page)).improvised.find((part) => part.kind === 'tanam'))
    .toEqual({ kind: 'tanam', ragas: [value('Saveri')] });
  await noUndoBar(page);
  await page.keyboard.press('Escape');

  // A part turned off, from its check.
  await page.getByRole('switch', { name: 'Alapana' }).click();
  await expect
    .poll(async () => (await theItem(page)).improvised.map((part) => part.kind))
    .toEqual(['tanam']);
  await noUndoBar(page);

  // A nadai, from the Layavinyasam's sheet.
  await page.getByRole('button', { name: /^Layavinyasam, / }).click();
  await page.getByRole('button', { name: 'Remove Khanda' }).click();
  await expect
    .poll(async () => (await theItem(page)).layaVinyasam?.nadais.map((one) => one.key))
    .toEqual(['tisra']);
  await noUndoBar(page);
  await page.keyboard.press('Escape');

  // The Layavinyasam turned off, from its check.
  await page.getByRole('switch', { name: 'Layavinyasam', checked: true }).click();
  await expect.poll(async () => (await theItem(page)).layaVinyasam).toBeNull();
  await noUndoBar(page);

  // A reload finds every removal stored, and no Undo bar.
  const stored = await theItem(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Behag, Raga 2 of 2' })).toBeVisible();
  expect(await theItem(page)).toEqual(stored);
  expect(stored).toMatchObject({
    ragas: [value('Kalyani'), value('Behag')],
    improvised: [{ kind: 'tanam', ragas: [value('Saveri')] }],
    layaVinyasam: null,
  });
  await noUndoBar(page);
});

test('a Layavinyasam whose note is cleared turns off at once with its check, no Undo bar', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await page.getByRole('switch', { name: 'Layavinyasam' }).click();
  const note = page.getByRole('textbox', { name: 'Note' });
  await note.fill('tisram');
  await note.blur();
  await expect.poll(async () => (await theItem(page)).layaVinyasam?.note).toBe('tisram');

  // With a note typed, the check goes to the note; cleared, the next tap turns it off.
  await page.getByRole('switch', { name: 'Clear the note to turn off Layavinyasam' }).click();
  await expect(note).toBeFocused();
  await page.keyboard.press('Backspace');
  await page.getByRole('switch', { name: 'Layavinyasam', checked: true }).click();

  await expect.poll(async () => (await theItem(page)).layaVinyasam).toBeNull();
  await expect(page.getByText('Not saved', { exact: true })).toHaveCount(0);
  await noUndoBar(page);
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Layavinyasam', checked: false })).toBeVisible();
  expect((await theItem(page)).layaVinyasam).toBeNull();
});
