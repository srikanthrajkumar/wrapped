// Dance, Harikatha and the Roles behind "More" on the screens (T120, T122): the kind is changed
// in the Event's facts and shown as a mark, a title taken by a change to Concert comes back with
// Undo, and a Role behind More is never hidden once chosen.

import { expect, test, type Page } from '@playwright/test';
import { failWritesOnDemand, finishFirstLaunch, readTable, setFailingWrites } from './helpers';

/** A new Concert's facts sheet, open. */
async function openFacts(page: Page) {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('button', { name: /Sat|Sun|Mon|Tue|Wed|Thu|Fri/ }).click();
  return page.getByRole('dialog');
}

/** The journal's copy of one Event field, as a reload would find it (ADR 0007). */
function journalled(page: Page, id: string, field: string) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null') as Record<string, unknown> | null,
    `wrapped.notSaved.v1:events:${id}:${field}`,
  );
}

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

test('a space typed before a pause stays for the next word', async ({ page }) => {
  const facts = await openFacts(page);
  await facts.getByRole('button', { name: 'Dance' }).click();
  const title = facts.getByRole('textbox', { name: 'Title' });
  await title.click();
  // A phone keyboard's suggested word comes with its space, then the rasika pauses.
  await title.pressSequentially('Foo ');
  await expect
    .poll(async () => (await readTable<{ title: string | null }>(page, 'events'))[0]?.title)
    .toBe('Foo');
  await page.waitForTimeout(400);
  await title.pressSequentially('Bar');
  await expect(title).toHaveValue('Foo Bar');
  await title.blur();
  await expect
    .poll(async () => (await readTable<{ title: string | null }>(page, 'events'))[0]?.title)
    .toBe('Foo Bar');
  await expect(title).toHaveValue('Foo Bar');
});

test('a Lecdem chosen with its title is journalled with it, typed and after a failed write', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  const facts = await openFacts(page);
  const [concert] = await readTable<{ id: string }>(page, 'events');

  // Lecdem waits for its title; the phone stops storing anything.
  await facts.getByRole('button', { name: 'Lecdem' }).click();
  await setFailingWrites(page, true);
  const title = facts.getByRole('textbox', { name: 'Title' });
  await title.pressSequentially('On Todi');
  // While typed, the kind is journalled with the title.
  expect(await journalled(page, concert!.id, 'kind')).toMatchObject({
    value: { kind: 'lecdem', title: 'On Todi' },
    state: 'typed',
  });
  await title.blur();
  await expect(page.getByText('Not saved', { exact: true }).first()).toBeVisible();

  // The app closes: the journal still has both, and so has the Export.
  await page.reload();
  await expect(page.getByText('Not saved', { exact: true }).first()).toBeVisible();
  expect(await journalled(page, concert!.id, 'kind')).toMatchObject({
    value: { kind: 'lecdem', title: 'On Todi' },
    state: 'failed',
  });
  expect(await journalled(page, concert!.id, 'title')).toBeNull();
  expect(await readTable(page, 'events')).toEqual([
    expect.objectContaining({ kind: 'concert', title: null }),
  ]);
});
