// The instrument picker (docs/design/instrument-picker.md): eight first chips at a Concert,
// every other Role behind one tap on More, opened in place after them so the chips under the
// thumb never move, no "Other" offered, and a Role stored as `other` before 2026-11-19 shown
// pressed until it is replaced or cleared.

import { expect, test, type Page } from '@playwright/test';
import { finishFirstLaunch, readTable } from './helpers';

const FIRST = ['Vocal', 'Veena', 'Flute', 'Violin', 'Mridangam', 'Ghatam', 'Kanjira', 'Morsing'];
const REST = [
  'Dancer',
  'Nattuvangam',
  'Vocal support',
  'Chitravina',
  'Madhuraveena',
  'Nagaswaram',
  'Saxophone',
  'Clarinet',
  'Mandolin',
  'Guitar',
  'Keyboard',
  'Piano',
  'Sitar',
  'Sarod',
  'Santoor',
  'Jalatarangam',
  'Harmonium',
  'Viola',
  'Thavil',
  'Tabla',
  'Konnakol',
  'Presenter',
];

/** The chips' words, once the picker has drawn them (allTextContents doesn't wait). */
async function chips(page: Page) {
  const group = page.getByRole('group', { name: 'Role' });
  await expect(group.getByRole('button', { name: 'Vocal', exact: true })).toBeVisible();
  return group.getByRole('button').allTextContents();
}

async function addArtist(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add Artist' }).click();
  await page.getByRole('searchbox', { name: 'Search Artists' }).fill(name);
  await page.getByRole('button', { name: `Add “${name}” as a new Artist` }).click();
}

const stageRow = (page: Page, name: string) =>
  page.getByRole('region', { name: 'Stage' }).getByRole('button', { name: new RegExp(`^${name}`) });

test('eight first chips, the rest behind More in place, and no Other', async ({ page }) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await addArtist(page, 'Debjit Patitundi');

  expect(await chips(page)).toEqual([...FIRST, 'More', 'Not sure']);
  // Where Morsing sits among the chips: the sheet grows upward as More opens (§5), so only its
  // place within the group is fixed.
  const place = () =>
    page.getByRole('group', { name: 'Role' }).evaluate((group) => {
      const chip = [...group.querySelectorAll('button')].find((b) => b.textContent === 'Morsing')!;
      const a = chip.getBoundingClientRect();
      const b = group.getBoundingClientRect();
      return { x: a.x - b.x, y: a.y - b.y };
    });
  const before = await place();

  await page.getByRole('button', { name: 'More' }).click();
  // The first chips never move; every other Role follows in Stage order, "Not sure" last.
  expect(await chips(page)).toEqual([...FIRST, ...REST, 'Not sure']);
  expect(await place()).toEqual(before);
  // Focus goes to the first chip revealed.
  await expect(page.getByRole('button', { name: 'Dancer' })).toBeFocused();

  await page.getByRole('button', { name: 'Tabla' }).click();
  await expect
    .poll(async () => (await readTable<{ role: string | null }>(page, 'appearances'))[0]?.role)
    .toBe('tabla');

  // A Role behind More shows pressed, with More open.
  await stageRow(page, 'Debjit Patitundi').click();
  await expect(page.getByRole('button', { name: 'Tabla' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0);
  // Picking one of the first chips keeps More open until the sheet closes.
  await page.getByRole('button', { name: 'Kanjira' }).click();
  await stageRow(page, 'Debjit Patitundi').click();
  expect(await chips(page)).toEqual([...FIRST, 'More']);
});

test('a Role stored as Other shows pressed after the last Role, and once replaced is gone', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await addArtist(page, 'V.V.S. Murari');
  await page.getByRole('button', { name: 'Not sure' }).click();
  await expect
    .poll(async () => (await readTable<{ id: string }>(page, 'appearances')).length)
    .toBe(1);
  // As a build before 2026-11-19 stored a viola.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('carnatic-wrapped');
        open.onsuccess = () => {
          const tx = open.result.transaction('appearances', 'readwrite');
          const table = tx.objectStore('appearances');
          const all = table.getAll();
          all.onsuccess = () => {
            for (const row of all.result) table.put({ ...row, role: 'other' });
          };
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();

  await stageRow(page, 'V.V.S. Murari').click();
  expect(await chips(page)).toEqual([...FIRST, ...REST, 'Other']);
  await expect(page.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Viola' }).click();
  await expect
    .poll(async () => (await readTable<{ role: string | null }>(page, 'appearances'))[0]?.role)
    .toBe('viola');
  await stageRow(page, 'V.V.S. Murari').click();
  await expect(page.getByRole('button', { name: 'Other' })).toHaveCount(0);
});
