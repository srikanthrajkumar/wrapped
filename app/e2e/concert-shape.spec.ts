// The Concert's shape after the iPhone walkthrough (docs/feedback, S1 to S6): the Artists a
// Concert is known by, the Stage listed by Role, a name corrected in every Concert, the usual
// Role chosen for a known Artist, and "Log a Concert" in reach while a Concert is open.

import { expect, test, type Page } from '@playwright/test';
import { finishFirstLaunch } from './helpers';

async function addArtist(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add Artist' }).click();
  await page.getByRole('searchbox', { name: 'Search Artists' }).fill(name);
}

test('the Artists it is known by, the Stage by Role, a rename, and a second Concert while one is open', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();

  // Before any Artist, the heading adds one.
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText('Add Artist');
  await addArtist(page, 'Akkarai');
  await page.getByRole('button', { name: 'Add “Akkarai” as a new Artist' }).click();
  await page.getByRole('button', { name: 'Violin' }).click();
  // Without vocal, veena or flute, the Concert is known by the first Artist on Stage.
  await expect(heading).toHaveText('Akkarai');

  await addArtist(page, 'Ranjani');
  await page.getByRole('button', { name: 'Add “Ranjani” as a new Artist' }).click();
  await page.getByRole('button', { name: 'Vocal' }).click();
  await expect(heading).toHaveText('Ranjani');
  // Listed by Role, not by the order added.
  const stage = page.getByRole('region', { name: 'Stage' }).getByRole('listitem');
  await expect(stage.first()).toContainText('Ranjani');
  await expect(stage.nth(1)).toContainText('Akkarai');
  await expect(page.getByRole('button', { name: 'Edit order' })).toHaveCount(0);
  // The Maintainer, 2026-11-10: a pencil on Stage's heading line adds an Artist, a full tap
  // target, and no "Add Artist" row sits under the Artists.
  await expect(stage).toHaveCount(2);
  const pencil = page
    .getByRole('region', { name: 'Stage' })
    .getByRole('button', { name: 'Add Artist' });
  const pen = (await pencil.boundingBox())!;
  const label = (await page.getByRole('heading', { name: 'Stage' }).boundingBox())!;
  expect(Math.min(pen.width, pen.height)).toBeGreaterThanOrEqual(44);
  expect(Math.abs(pen.y + pen.height / 2 - (label.y + label.height / 2))).toBeLessThan(2);

  // The name at the top of the Artist's sheet corrects it.
  await stage
    .nth(1)
    .getByRole('button', { name: /^Akkarai/ })
    .click();
  const name = page.getByRole('dialog').getByRole('textbox', { name: 'Artist name' });
  await name.fill('Akkarai Subbalakshmi');
  // Journalled as typed, before the field is left: a lock or kill now loses nothing (ADR 0007).
  const journal = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('wrapped.notSaved.v1:'))
      .map((key) => localStorage.getItem(key)),
  );
  expect(journal.join()).toContain('Akkarai Subbalakshmi');
  await name.press('Enter');
  await page.keyboard.press('Escape');
  await expect(stage.nth(1)).toContainText('Akkarai Subbalakshmi');

  // Season: the open Concert is the hero, and another Concert can be started.
  await page.getByRole('main').getByRole('link', { name: 'Season' }).click();
  await expect(page.getByRole('region', { name: 'Now' }).getByRole('link')).toHaveText(/^Ranjani/);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await expect(heading).toHaveText('Add Artist');

  // The old name still finds the Artist, and their usual Role is chosen for them.
  await addArtist(page, 'Akkarai');
  await page.getByRole('button', { name: /^Akkarai Subbalakshmi/ }).click();
  await expect(page.getByRole('button', { name: 'Violin' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Stage' })).toContainText('Violin');
});

// The Maintainer, 2026-11-11: Items, then Stage, then Note, with no line doubled between them;
// an Artist's Colours are one 20px dot, empty until they are set, its halves drawn exactly.
test('the Concert reads Items, Stage, Note, and Colours is a dot', async ({ page }) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await addArtist(page, 'Ranjani');
  await page.getByRole('button', { name: 'Add “Ranjani” as a new Artist' }).click();
  await page.getByRole('button', { name: 'Vocal' }).click();

  const top = async (name: string) =>
    (await page.getByRole('heading', { name, exact: true }).boundingBox())!.y;
  // With nothing sung, the empty state stands where the Items go: first.
  expect(await top('No Items yet')).toBeLessThan(await top('Stage'));
  expect(await top('Stage')).toBeLessThan(await top('Note'));

  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('searchbox').fill('Bhavayami');
  await page.getByRole('button', { name: 'Use what I typed: “Bhavayami”' }).click();
  await page.getByRole('link', { name: 'Done' }).click();
  expect(await top('Items')).toBeLessThan(await top('Stage'));
  expect(await top('Stage')).toBeLessThan(await top('Note'));
  // Stage ends on its last row's line; Note draws none above itself.
  const note = page.getByRole('region', { name: 'Note' }).locator('[data-slot="accordion-item"]');
  await expect(note).toHaveCSS('box-shadow', 'none');

  // No Colours yet: the same dot, empty, in a full tap target, and no word.
  const colours = page.getByRole('button', { name: /^Colours for Ranjani/ });
  await expect(colours).toHaveAccessibleName('Colours for Ranjani, none');
  await expect(colours).toHaveText('');
  const target = (await colours.boundingBox())!;
  expect(Math.min(target.width, target.height)).toBeGreaterThanOrEqual(44);
  const dot = colours.locator('svg');
  expect(Math.round((await dot.boundingBox())!.width)).toBe(20);
  await expect(dot.locator('circle')).toHaveAttribute('fill', 'none');

  // Two tones: one dot of the same size, the first colour on the left half, over the second.
  await colours.click();
  await page.getByRole('radio', { name: 'Red' }).click();
  await page.getByRole('button', { name: 'Second colour' }).click();
  await page.getByRole('radio', { name: 'Blue' }).click();
  await page.keyboard.press('Escape');
  await expect(colours).toHaveAccessibleName('Colours for Ranjani, Red and Blue');
  expect(Math.round((await dot.boundingBox())!.width)).toBe(20);
  await expect(dot.locator('circle').first()).toHaveAttribute('fill', '#1E5AA8');
  await expect(dot.locator('path')).toHaveAttribute('fill', '#C62828');
  await expect(dot.locator('path')).toHaveAttribute('d', 'M10 0.5A9.5 9.5 0 0 0 10 19.5Z');
});
