// A Concert made by Season's + and left with nothing entered leaves no trace (the Maintainer,
// 2026-11-08): no row, no outbox entry, no Undo bar, no "Not saved", no journal entry. Anything
// entered keeps it, an edit that failed to save above all (constitution IV, nothing lost).

import { expect, test, type Page } from '@playwright/test';
import {
  failWritesOnDemand,
  finishFirstLaunch,
  readMeta,
  readTable,
  setFailingWrites,
} from './helpers';

async function addConcert(page: Page) {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
}

/** The journal of values not saved, as kept in localStorage. */
const journal = (page: Page) =>
  page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith('wrapped.notSaved.v1:')),
  );

/** Back on Season with nothing left of the new Concert, and none shown on the way. */
async function expectNoTrace(page: Page) {
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await expect.poll(() => readTable(page, 'events')).toEqual([]);
  expect(await readTable(page, 'outbox')).toEqual([]);
  expect(await journal(page)).toEqual([]);
  await expect(page.getByText('No Sabha yet')).toHaveCount(0);
  await expect(page.getByText(/not saved/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
}

/** Watch every frame for the new Concert showing on Season, until `stop`. */
async function watchForRow(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { seen: boolean; watching: boolean };
    w.seen = false;
    w.watching = true;
    const tick = () => {
      if (!w.watching) return;
      if (
        document.body.textContent?.includes('No Sabha yet') &&
        !location.pathname.startsWith('/event/')
      )
        w.seen = true;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return async () => {
    await page.evaluate(() => new Promise((done) => setTimeout(done, 300)));
    return page.evaluate(() => {
      const w = window as unknown as { seen: boolean; watching: boolean };
      w.watching = false;
      return w.seen;
    });
  };
}

test('a new Concert left untouched by the back gesture leaves no trace, never shown on Season', async ({
  page,
}) => {
  await addConcert(page);
  const seen = await watchForRow(page);
  await page.goBack();
  await expectNoTrace(page);
  expect(await seen()).toBe(false);
});

test('a new Concert left untouched by the top bar leaves no trace', async ({ page }) => {
  await addConcert(page);
  await page.getByRole('main').getByRole('link', { name: 'Season' }).click();
  await expectNoTrace(page);
});

test('a new Concert reloaded on its page, then left untouched, leaves no trace', async ({
  page,
}) => {
  await addConcert(page);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  await page.goBack();
  await expectNoTrace(page);
});

test('a new Concert with a note typed is kept', async ({ page }) => {
  await addConcert(page);
  await page.getByRole('button', { name: 'Note' }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('front row');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await expect
    .poll(async () => (await readTable<{ note: string | null }>(page, 'events')).map((e) => e.note))
    .toEqual(['front row']);
  await expect(page.getByText('No Sabha yet').first()).toBeVisible();
});

test('a new Concert whose note failed to save is kept, its note still journalled', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  await addConcert(page);
  await setFailingWrites(page, true);
  await page.getByRole('button', { name: 'Note' }).click();
  const note = page.getByRole('textbox', { name: 'Note' });
  await note.fill('front row');
  await note.blur();
  await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
  await setFailingWrites(page, false);

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  // Given the time a take-back would need, the Concert and the note entered are both still there.
  await page.waitForTimeout(500);
  expect(await readTable(page, 'events')).toHaveLength(1);
  expect((await journal(page)).some((key) => key.endsWith(':note'))).toBe(true);
  await expect(page.getByText(/not saved/i).first()).toBeVisible();
});

test('a new Concert whose Item search was kept when the phone locked is kept', async ({ page }) => {
  await addConcert(page);
  const eventId = new URL(page.url()).pathname.split('/')[2]!;
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('searchbox', { name: 'Search songs and Ragas' }).fill('Bhavayami');
  // The phone locks: the typed text is stored as the Item's draft. Then iOS ends the page.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => readMeta(page, `itemDraft:${eventId}`)).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search songs and Ragas' })).toHaveValue(
    'Bhavayami',
  );
  // The store holds the text, so the journal has let it go: only the store can tell.
  await expect.poll(() => journal(page)).toEqual([]);

  await page.goBack();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await readTable(page, 'events')).toHaveLength(1);
});
