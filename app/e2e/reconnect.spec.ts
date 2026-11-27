// Required test (constitution IV): WebKit drops the store connection of a page left in the
// background for hours ("Connection to Indexed Database server lost"), and the Maintainer's iPhone
// showed the rescue screen for it (2026-11-27). Here a test-only script in the page makes the
// connections open so far refuse every transaction, as WebKit's do: the app opens a new one
// quietly, a value entered across the loss is stored, and only when no new connection opens does
// the rescue screen show, with its cause.

import { expect, test, type Page } from '@playwright/test';
import { finishFirstLaunch, readTable } from './helpers';

/**
 * From the next load: `window.loseConnections()`, `window.failOpens` (an open is refused) and
 * `window.hangOpens` (an open never answers), as described above.
 */
async function dropConnectionsOnDemand(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = window as unknown as {
      loseConnections: () => void;
      failOpens?: boolean;
      hangOpens?: boolean;
      opens: number;
    };
    const lost = () =>
      new DOMException(
        'Connection to Indexed Database server lost. Refresh the page to try again',
        'UnknownError',
      );
    const seen = new Set<IDBDatabase>();
    const dropped = new WeakSet<IDBDatabase>();
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args) {
      if (dropped.has(this)) throw lost();
      seen.add(this);
      return transaction.apply(this, args);
    };
    state.opens = 0;
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (this: IDBFactory, ...args) {
      if (state.failOpens) throw lost();
      // An open request that never answers, success or error.
      if (state.hangOpens) return {} as IDBOpenDBRequest;
      state.opens += 1;
      return open.apply(this, args);
    };
    state.loseConnections = () => {
      seen.forEach((connection) => dropped.add(connection));
      seen.clear();
    };
  });
}

const loseConnections = (page: Page) =>
  page.evaluate(() => (window as unknown as { loseConnections: () => void }).loseConnections());

const opens = (page: Page) => page.evaluate(() => (window as unknown as { opens: number }).opens);

/** A new Concert's first Item, with its Tala unknown: what the tests below edit. */
async function newItem(page: Page) {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  const tala = page.getByRole('button', { name: /^Tala,/ });
  await expect(tala).toHaveAccessibleName('Tala, unknown');
  return tala;
}

test('a value entered after the connection was lost is stored, with no rescue screen', async ({
  page,
}) => {
  await dropConnectionsOnDemand(page);
  const tala = await newItem(page);

  await loseConnections(page);
  await tala.click();
  await page.getByRole('button', { name: 'Not applicable' }).click();

  await expect(tala).toHaveAccessibleName('Tala, not applicable');
  await expect(page.getByText('Not saved', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: "Can't open your season" })).toHaveCount(0);
  await expect
    .poll(async () => (await readTable<{ tala: { state: string } }>(page, 'items'))[0]?.tala)
    .toMatchObject({ state: 'na' });
});

test('back from the background, the lost connection is replaced before the next tap', async ({
  page,
}) => {
  await dropConnectionsOnDemand(page);
  await newItem(page);
  await page.getByRole('link', { name: 'Done' }).click();

  await loseConnections(page);
  const before = await opens(page);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect.poll(() => opens(page)).toBeGreaterThan(before);

  // The screens read the store on the new connection.
  await page.getByRole('link', { name: /^1/ }).click();
  await expect(page.getByRole('button', { name: /^Tala,/ })).toHaveAccessibleName('Tala, unknown');
  await expect(page.getByRole('heading', { name: "Can't open your season" })).toHaveCount(0);
});

test('screens that read a lost connection are drawn again on a new one', async ({ page }) => {
  await dropConnectionsOnDemand(page);
  await newItem(page);
  await page.getByRole('link', { name: 'Done' }).click();

  // No foreground check: the next screen's own reads find the connection lost.
  await loseConnections(page);
  await page.getByRole('link', { name: /^1/ }).click();

  await expect(page.getByRole('button', { name: /^Tala,/ })).toHaveAccessibleName('Tala, unknown');
  await expect(page.getByRole('heading', { name: "Can't open your season" })).toHaveCount(0);
});

test('when no new connection opens, the rescue screen shows why, and the value is kept', async ({
  page,
}) => {
  await dropConnectionsOnDemand(page);
  const tala = await newItem(page);

  await loseConnections(page);
  await page.evaluate(() => {
    (window as unknown as { failOpens: boolean }).failOpens = true;
  });
  await tala.click();
  await page.getByRole('button', { name: 'Not applicable' }).click();

  await expect(page.getByRole('heading', { name: "Can't open your season" })).toBeVisible();
  await expect(page.getByTestId('rescue-cause')).toHaveText(
    /^store: UnknownError, connection lost · /,
  );
  // The value the store never took is journalled, for the rescue screen's Export.
  const journalled = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('wrapped.notSaved.v1:items:'))
      .map((key) => JSON.parse(localStorage.getItem(key)!) as { field: string; value: unknown }),
  );
  expect(journalled).toContainEqual(
    expect.objectContaining({ field: 'tala', value: expect.objectContaining({ state: 'na' }) }),
  );
});

/** The journal's entries for Items, as stored in localStorage. */
const journalledItems = (page: Page) =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('wrapped.notSaved.v1:items:'))
      .map((key) => JSON.parse(localStorage.getItem(key)!) as { field: string; value: unknown }),
  );

test('after the rescue screen, Try again opens the store, and the value entered again is stored once', async ({
  page,
}) => {
  await dropConnectionsOnDemand(page);
  const tala = await newItem(page);
  const itemUrl = page.url();
  const [item] = await readTable<{ id: string }>(page, 'items');

  // Given up: the rescue screen, the value kept in the journal, the store untouched.
  await loseConnections(page);
  await page.evaluate(() => {
    (window as unknown as { failOpens: boolean }).failOpens = true;
  });
  await tala.click();
  await page.getByRole('button', { name: 'Not applicable' }).click();
  await expect(page.getByRole('heading', { name: "Can't open your season" })).toBeVisible();
  expect(await journalledItems(page)).toEqual([
    expect.objectContaining({ field: 'tala', value: expect.objectContaining({ state: 'na' }) }),
  ]);

  // Try again reloads with a working store (the test script starts afresh on each load).
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await page.goto(itemUrl);

  // A value copied back after a reload is shown as not saved, for Export only (ADR 0007):
  // nothing writes it by itself, so the store still holds the Tala as it was.
  await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
  expect((await readTable<{ tala: { state: string } }>(page, 'items'))[0]?.tala).toMatchObject({
    state: 'unknown',
  });

  // Entered again, it is stored once: one outbox entry for the Item, holding it, and the
  // journal empty.
  await tala.click();
  await page.getByRole('button', { name: 'Not applicable' }).click();
  await expect(page.getByText('Not saved', { exact: true })).toHaveCount(0);
  await expect(tala).toHaveAccessibleName('Tala, not applicable');
  await expect
    .poll(async () => (await readTable<{ tala: { state: string } }>(page, 'items'))[0]?.tala)
    .toMatchObject({ state: 'na' });
  const queued = (
    await readTable<{ recordId: string; row: { tala: unknown } }>(page, 'outbox')
  ).filter((entry) => entry.recordId === item!.id);
  expect(queued).toHaveLength(1);
  expect(queued[0]!.row.tala).toMatchObject({ state: 'na' });
  await expect.poll(() => journalledItems(page)).toEqual([]);
  await expect(page.getByRole('heading', { name: "Can't open your season" })).toHaveCount(0);
});

test('screens waiting on a new connection that never opens give way to the rescue screen', async ({
  page,
}) => {
  await dropConnectionsOnDemand(page);
  await newItem(page);
  await page.getByRole('link', { name: 'Done' }).click();

  await loseConnections(page);
  await page.evaluate(() => {
    (window as unknown as { hangOpens: boolean }).hangOpens = true;
  });
  // The next screen's reads find the connection lost, and the reopen never answers.
  await page.getByRole('link', { name: /^1/ }).click();

  // Given up within REOPEN_LIMIT_MS (4 s): the rescue screen with Export, never a blank page.
  await expect(page.getByRole('heading', { name: "Can't open your season" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  await expect(page.getByTestId('rescue-cause')).toHaveText(
    /^store: OpenTimeoutError, open timed out · /,
  );
});
