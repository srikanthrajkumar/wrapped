// Dance, Harikatha and the Roles behind "More" on the screens (T120, T122): the kind is changed
// in the Event's facts and shown as a mark, a title taken by a change to Concert comes back with
// Undo, and a Role behind More is never hidden once chosen.

import { expect, test } from '@playwright/test';
import { finishFirstLaunch } from './helpers';

test('a kind and its title, the Undo of a title taken, and the Roles behind More', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  const heading = page.getByRole('heading', { level: 1 });

  // At a Dance, Dancer is in the first row; the rest wait behind More.
  await page.getByRole('button', { name: /Sat|Sun|Mon|Tue|Wed|Thu|Fri/ }).click();
  const facts = page.getByRole('dialog');
  await facts.getByRole('button', { name: 'Dance' }).click();
  await expect(facts.getByRole('heading', { name: 'Dance' })).toBeVisible();
  await facts.getByRole('textbox', { name: 'Title' }).fill('Margam');
  await facts.getByRole('textbox', { name: 'Title' }).blur();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Add Artist' }).click();
  await page.getByRole('searchbox', { name: 'Search Artists' }).fill('Alarmel Valli');
  await page.getByRole('button', { name: 'Add “Alarmel Valli” as a new Artist' }).click();
  const roles = page.getByRole('group', { name: 'Role' });
  await expect(roles.getByRole('button', { name: 'Thavil' })).toHaveCount(0);
  await roles.getByRole('button', { name: 'Dancer' }).click();
  await expect(heading).toHaveText('Alarmel Valli');
  await expect(heading.getByRole('img', { name: 'Dance' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Margam/ })).toBeVisible();

  // A Role behind More shows pressed with More open.
  await page
    .getByRole('region', { name: 'Stage' })
    .getByRole('button', { name: /^Alarmel Valli/ })
    .click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Vocal support' }).click();
  await page
    .getByRole('region', { name: 'Stage' })
    .getByRole('button', { name: /^Alarmel Valli/ })
    .click();
  await expect(page.getByRole('button', { name: 'Vocal support' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // A change to Concert takes the title, and Undo brings it back.
  await page.getByRole('button', { name: /^Margam/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Concert' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Margam/ })).toHaveCount(0);
  await expect(heading.getByRole('img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Margam/ })).toBeVisible();
  await expect(heading.getByRole('img', { name: 'Dance' })).toBeVisible();

  // The Season row carries the mark too.
  await page.getByRole('main').getByRole('link', { name: 'Season' }).click();
  await expect(
    page.getByRole('region', { name: 'Now' }).getByRole('img', { name: 'Dance' }),
  ).toBeVisible();
});
