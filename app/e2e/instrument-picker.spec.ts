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

test('eight first chips, the rest under More Roles, folding back, and no Other', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await addArtist(page, 'Debjit Patitundi');

  // "Not sure" after the first chips, then the quiet line that opens the rest (2026-11-20).
  expect(await chips(page)).toEqual([...FIRST, 'Not sure', 'More Roles']);
  // A chip is a fill: its outline on the 8px edge, its word on the 24px column, with "Role" and
  // the More Roles line (the Maintainer, 2026-11-20).
  const vocal = page.getByRole('button', { name: 'Vocal', exact: true });
  expect(Math.round((await vocal.boundingBox())!.x)).toBe(8);
  const wordX = (locator: typeof vocal) =>
    locator.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return Math.round(range.getBoundingClientRect().x);
    });
  expect(await wordX(vocal)).toBe(24);
  expect(await wordX(page.getByRole('button', { name: 'More Roles' }))).toBe(24);
  // Where Morsing sits among the chips: the sheet grows upward as the rest open (§5), so only
  // its place within the group is fixed.
  const place = () =>
    page.getByRole('group', { name: 'Role' }).evaluate((group) => {
      const chip = [...group.querySelectorAll('button')].find((b) => b.textContent === 'Morsing')!;
      const a = chip.getBoundingClientRect();
      const b = group.getBoundingClientRect();
      return { x: a.x - b.x, y: a.y - b.y };
    });
  const before = await place();

  const more = page.getByRole('button', { name: 'More Roles' });
  await more.click();
  // The first chips never move; the line stays where it was as "Fewer Roles", every other Role
  // under it in Stage order. Focus stays on it, now expanded (a disclosure).
  const fewer = page.getByRole('button', { name: 'Fewer Roles' });
  expect(await chips(page)).toEqual([...FIRST, 'Not sure', 'Fewer Roles', ...REST]);
  expect(await place()).toEqual(before);
  await expect(fewer).toBeFocused();
  await expect(fewer).toHaveAttribute('aria-expanded', 'true');
  // A second tap in the same place folds them again.
  await fewer.click();
  expect(await chips(page)).toEqual([...FIRST, 'Not sure', 'More Roles']);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();

  await page.getByRole('button', { name: 'Tabla' }).click();
  await expect
    .poll(async () => (await readTable<{ role: string | null }>(page, 'appearances'))[0]?.role)
    .toBe('tabla');

  // A Role behind the fold shows pressed with every Role shown, and no fold to hide it.
  await stageRow(page, 'Debjit Patitundi').click();
  await expect(page.getByRole('button', { name: 'Tabla' })).toHaveAttribute('aria-pressed', 'true');
  expect(await chips(page)).toEqual([...FIRST, ...REST]);
  // Once a first chip is picked, the sheet opens folded again.
  await page.getByRole('button', { name: 'Kanjira' }).click();
  await stageRow(page, 'Debjit Patitundi').click();
  expect(await chips(page)).toEqual([...FIRST, 'More Roles']);
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
