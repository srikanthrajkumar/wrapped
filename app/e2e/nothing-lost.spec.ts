// Required tests (constitution IV, "nothing lost"; ADR 0007): journeys where a value
// could be lost or a screen could lose the rasika's typing. Writes are made to fail, or never to
// finish, by a test-only script in the page (helpers.ts, failWritesOnDemand).

import { chromium, devices, expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  failWritesOnDemand,
  finishFirstLaunch,
  readTable,
  setFailingWrites,
  setHangingWrites,
} from './helpers';

async function newConcert(page: Page) {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
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
  await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
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

test('a failed Concert stays listed, by its time, when a later one saves', async ({ page }) => {
  await failWritesOnDemand(page);
  await page.goto('/');
  await finishFirstLaunch(page);

  await setFailingWrites(page, true);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await expect(page.getByText(/^Not saved · Concert, /)).toBeVisible();

  // A later tap saves: the first Concert is still waiting, never folded into the second.
  await setFailingWrites(page, false);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  await expect(page.getByText(/^Not saved · Concert, /)).toBeVisible();

  await page.getByRole('button', { name: /^Try again/ }).click();
  await expect(page.getByText(/not saved/i)).toHaveCount(0);
  expect(await readTable(page, 'events')).toHaveLength(2);
});

test('a double tap on "Log a Concert" makes one Concert', async ({ page }) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).dblclick();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  expect(await readTable(page, 'events')).toHaveLength(1);
});

test('A6: the Laya vinyasam note is saved when the page is hidden, before any blur', async ({
  page,
}) => {
  await newConcert(page);
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  // One fold for what was improvised; the Laya vinyasam is a chip in it (walkthrough S14).
  await page.getByRole('button', { name: 'Improvised' }).click();
  await page.getByRole('button', { name: 'Laya vinyasam' }).click();
  const note = page.getByRole('textbox', { name: 'Note' });
  // Time stands still, so the autosave's pause never ends: only pagehide can save the note.
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await note.fill('tisram, then khandam');
  await page.waitForTimeout(1500);
  const [before] = await readTable<{ layaVinyasam: { note: string | null } }>(page, 'items');
  expect(before?.layaVinyasam.note).toBeNull();

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
  // An empty note is a closed fold (walkthrough P6).
  await page.getByRole('button', { name: 'Note' }).click();
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
  await page.getByRole('button', { name: 'Vocal' }).click();

  await page.getByRole('button', { name: /^Colours for Sanjay/ }).click();
  await setFailingWrites(page, true);
  await page.getByRole('radio', { name: 'Red' }).click();
  await expect(page.getByText('Not saved', { exact: true }).first()).toBeVisible();
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

test('A2: a value whose Try again is still running survives a force-close', async ({
  baseURL,
}, testInfo) => {
  // Two browser launches; measured 2026-11-02 at 20.9 s (load average 8) and 23.5 s (load 14),
  // too close to the default 30 s. No retries: a data-loss test must fail loudly.
  test.setTimeout(60_000);
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 13'];
  const launch = () =>
    chromium.launchPersistentContext(testInfo.outputPath('profile'), {
      viewport,
      userAgent,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      baseURL,
    });
  let context = await launch();
  await failWritesOnDemand(context);
  let page = context.pages()[0] ?? (await context.newPage());
  await newConcert(page);
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  // The Item's details show once its first pick is stored.
  await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();

  await setFailingWrites(page, true);
  await page.getByRole('button', { name: /^Tala,/ }).click();
  await page.getByRole('button', { name: 'Not applicable' }).click();
  await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  // Try again starts, and the app is swiped away before its write finishes.
  await setFailingWrites(page, false);
  await setHangingWrites(page, true);
  await page.getByRole('button', { name: 'Try again' }).click();
  await context.close();

  context = await launch();
  page = context.pages()[0] ?? (await context.newPage());
  await page.goto('/');
  await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const file = JSON.parse(readFileSync((await (await download).path())!, 'utf8'));
  expect(file.notSaved).toEqual([
    expect.objectContaining({
      table: 'items',
      field: 'tala',
      value: expect.objectContaining({ state: 'na' }),
    }),
  ]);
  await context.close();
});

test('A3: when the phone store cannot be opened, a rescue screen still offers Export', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'wrapped.notSaved.v1:items:i1:tala',
      JSON.stringify({
        table: 'items',
        id: 'i1',
        field: 'tala',
        value: 'Adi',
        enteredAt: '2026-12-14T21:30:00+05:30',
      }),
    );
    // As after WebKit's "Connection to Indexed Database server lost".
    IDBFactory.prototype.open = () => {
      throw new DOMException('Connection to Indexed Database server lost', 'UnknownError');
    };
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Can't open your season" })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const handed = await download;
  expect(handed.suggestedFilename()).toMatch(/^carnatic-wrapped-.*-store-unreadable\.json$/);
  const file = JSON.parse(readFileSync((await handed.path())!, 'utf8'));
  expect(file.storeUnreadable).toEqual({ error: expect.any(String) });
  expect(file.notSaved).toEqual([expect.objectContaining({ id: 'i1', value: 'Adi' })]);
  // Handed over: a check on the Export button, not a red line.
  await expect(page.getByRole('button', { name: /^Exported/ })).toBeVisible();
});

test('A8: a failed date edit shows as entered, in the header and when the sheet reopens', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  await newConcert(page);
  const facts = page.getByRole('main').getByRole('button', { name: / · / }).first();
  await facts.click();

  await setFailingWrites(page, true);
  await page.getByLabel('Date').fill('2026-12-20');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
  await expect(facts).toContainText('Sun 20 Dec');

  await facts.click();
  await expect(page.getByLabel('Date')).toHaveValue('2026-12-20');
});

test('A8: a failed delete keeps what it deleted, says Not deleted, and throws nothing', async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await failWritesOnDemand(page);
  await newConcert(page);
  await page.getByRole('button', { name: 'Add Artist' }).click();
  await page.getByRole('searchbox', { name: 'Search Artists' }).fill('Sanjay');
  await page.getByRole('button', { name: 'Add “Sanjay” as a new Artist' }).click();
  await page.getByRole('button', { name: 'Vocal' }).click();

  await page.getByRole('button', { name: /^Sanjay/ }).click();
  await setFailingWrites(page, true);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  // The sheet stays, with the failure in it.
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Not deleted', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Remove', exact: true })).toBeVisible();

  await setFailingWrites(page, false);
  await sheet.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Artist removed', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Clear asks first, and removes only what the saved Export holds', async ({ page }) => {
  await failWritesOnDemand(page);
  await newConcert(page);
  await setFailingWrites(page, true);
  await page.getByRole('button', { name: 'Add Artist' }).click();
  await page.getByRole('searchbox', { name: 'Search Artists' }).fill('Sanjay');
  await page.getByRole('button', { name: 'Add “Sanjay” as a new Artist' }).click();
  await page.keyboard.press('Escape');
  await setFailingWrites(page, false);
  // After a reload the value can only be exported.
  await page.reload();
  await expect(page.getByText(/^Not saved · Sanjay/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Clear/ })).toHaveCount(0);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Export/ }).click();
  await download;
  await page.getByRole('button', { name: /^Clear/ }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText('Is the Export saved where you can find it?')).toBeVisible();
  await confirm.getByRole('button', { name: 'Not yet' }).click();
  await expect(page.getByText(/^Not saved · Sanjay/)).toBeVisible();

  await page.getByRole('button', { name: /^Clear/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, clear' }).click();
  await expect(page.getByText(/not saved/i)).toHaveCount(0);
});

test('a failed Undo bar never covers a field the rasika moves to', async ({ page }) => {
  await failWritesOnDemand(page);
  await page.setViewportSize({ width: 390, height: 480 });
  await newConcert(page);
  await page.getByRole('button', { name: 'Add Artist' }).click();
  await page.getByRole('searchbox', { name: 'Search Artists' }).fill('Sanjay');
  await page.getByRole('button', { name: 'Add “Sanjay” as a new Artist' }).click();
  await page.getByRole('button', { name: 'Vocal' }).click();
  await page.getByRole('button', { name: /^Sanjay/ }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  // The Undo bar shows once the remove is stored.
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await setFailingWrites(page, true);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('Undo failed · Artist', { exact: true })).toBeVisible();
  await setFailingWrites(page, false);

  // Moving to the Note, as Tab or the keyboard's next-field arrow does, brings it above the bar.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Note' }).click();
  const note = page.getByRole('textbox', { name: 'Note' });
  await note.evaluate((field: HTMLElement) => field.focus());
  await expect(note).toBeFocused();
  const field = (await note.boundingBox())!;
  const footer = (await page.locator('footer').boundingBox())!;
  expect(field.y + field.height).toBeLessThanOrEqual(footer.y);
});

test('a failed Concert delete reads Not deleted, and Try again deletes it and offers Undo', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  await newConcert(page);
  await setFailingWrites(page, true);
  await page.getByRole('button', { name: 'Concert actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete Event' }).click();
  await expect(page.getByText(/^Not deleted · Concert, /)).toBeVisible();

  await setFailingWrites(page, false);
  await page.getByRole('button', { name: /^Try again/ }).click();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await expect(page.getByText('Concert deleted', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
});

test('Dismiss on a failed move leaves a failed delete of the same Item in place', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  await newConcert(page);
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();
  await page.getByRole('link', { name: 'Next Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();
  await page.getByRole('link', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Edit order' }).first().click();
  await expect(page.getByRole('button', { name: 'Delete Item 2' })).toBeVisible();

  await setFailingWrites(page, true);
  await page.getByRole('button', { name: /^Move Item 1 down/ }).press('Enter');
  await expect(page.getByText('Not moved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Item 1' }).click();
  await expect(page.getByText('Not deleted', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Dismiss. Not moved on this phone.' }).click();
  await expect(page.getByText('Not moved', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Not deleted', { exact: true })).toBeVisible();

  // Dismiss on the delete keeps the Item after all.
  await page.getByRole('button', { name: 'Dismiss. Not deleted on this phone.' }).click();
  await expect(page.getByText('Not deleted', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete Item 1' })).toBeVisible();
});

/** A new Concert with these typed Items, in Edit order. */
async function orderingItems(page: Page, titles: string[]) {
  await newConcert(page);
  for (const [i, title] of titles.entries()) {
    await page.getByRole('link', { name: i === 0 ? 'Add Item' : 'Next Item' }).click();
    await page.getByRole('searchbox', { name: 'Search songs and Ragas' }).fill(title);
    await page.getByRole('button', { name: /^Use what I typed/ }).click();
    await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Edit order' }).first().click();
  return page.getByRole('region', { name: 'Items' }).getByRole('listitem');
}

const storedTitles = async (page: Page) =>
  (await readTable<{ title: string; position: number }>(page, 'items'))
    .sort((a, b) => a.position - b.position)
    .map((item) => item.title);

async function dragGrip(page: Page, row: Locator, by: number) {
  const grip = (await row.locator('[data-grip]').boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + by, { steps: 8 });
  await page.mouse.up();
}

test('a dragged Item keeps its new place, and a failed drag goes back to the stored order', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  const rows = await orderingItems(page, ['Alpha', 'Beta']);

  // A failed drag says so, and the rows go back to the order the store holds.
  await setFailingWrites(page, true);
  await dragGrip(page, rows.first(), 80);
  await expect(page.getByText('Not moved', { exact: true })).toBeVisible();
  await expect(rows.first()).toContainText('Alpha');
  expect(await storedTitles(page)).toEqual(['Alpha', 'Beta']);
  await page.getByRole('button', { name: 'Dismiss. Not moved on this phone.' }).click();

  await setFailingWrites(page, false);
  await dragGrip(page, rows.first(), 80);
  await expect(rows.first()).toContainText('Beta');
  await expect.poll(() => storedTitles(page)).toEqual(['Beta', 'Alpha']);
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Items' }).getByRole('listitem').first(),
  ).toContainText('Beta');
});

test('after a drag, a move back to the earlier order shows the stored order', async ({ page }) => {
  const rows = await orderingItems(page, ['Alpha', 'Beta']);
  await dragGrip(page, rows.first(), 80);
  await expect.poll(() => storedTitles(page)).toEqual(['Beta', 'Alpha']);

  // The store returns to the order the drag was dropped on; the drag's order must not return.
  await page.getByRole('button', { name: 'Move Item 2 up' }).press('Enter');
  await expect.poll(() => storedTitles(page)).toEqual(['Alpha', 'Beta']);
  await expect(rows.first()).toContainText('Alpha');
});

test('a grip held near the top of the screen moves nothing', async ({ page }) => {
  // Six Items typed in first take most of the default 30s on a loaded machine.
  test.slow();
  await page.setViewportSize({ width: 393, height: 480 });
  const titles = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];
  const rows = await orderingItems(page, titles);
  // Beta's grip in the top band, where a drag toward the edge would scroll the page.
  const grip = rows.nth(1).locator('[data-grip]');
  const top = (await grip.boundingBox())!.y;
  await page.evaluate((by) => window.scrollBy(0, by), top - 24);
  const box = (await grip.boundingBox())!;
  expect(box.y).toBeLessThan(64);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await storedTitles(page)).toEqual(titles);
});

test('a Laya note typed over a failed Nadai keeps the Nadai entered', async ({ page }) => {
  await failWritesOnDemand(page);
  await newConcert(page);
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  // One fold for what was improvised; the Laya vinyasam is a chip in it (walkthrough S14).
  await page.getByRole('button', { name: 'Improvised' }).click();
  await page.getByRole('button', { name: 'Laya vinyasam' }).click();
  await expect(page.getByRole('textbox', { name: 'Note' })).toBeVisible();
  // The screen shows the Laya vinyasam as entered, before it is stored: wait for the store.
  await expect
    .poll(async () => (await readTable<{ layaVinyasam: unknown }>(page, 'items'))[0]?.layaVinyasam)
    .toBeTruthy();

  await setFailingWrites(page, true);
  await page.getByRole('button', { name: /^Nadai/ }).click();
  await page.getByRole('group', { name: 'Nadai' }).getByRole('button', { name: 'khanda' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
  await setFailingWrites(page, false);

  // Typed key by key, as on a phone, after the failed Nadai.
  await page.getByRole('textbox', { name: 'Note' }).click();
  await page.keyboard.type('tisram');
  await page.getByRole('textbox', { name: 'Note' }).blur();
  await expect
    .poll(
      async () =>
        (await readTable<{ layaVinyasam: { note: string | null } }>(page, 'items'))[0]?.layaVinyasam
          .note,
    )
    .toBe('tisram');

  // Khanda is still there to save: in the store, or in the journal as entered.
  const [item] = await readTable<{ id: string; layaVinyasam: { nadai: { key: string | null } } }>(
    page,
    'items',
  );
  const journalled = await page.evaluate(
    (id) => localStorage.getItem(`wrapped.notSaved.v1:items:${id}:layaVinyasam`),
    item!.id,
  );
  const kept = item!.layaVinyasam.nadai.key === 'khanda' || (journalled ?? '').includes('khanda');
  expect(kept).toBe(true);
});

test('a second first pick while the first is written makes no second Item', async ({ page }) => {
  await failWritesOnDemand(page);
  await newConcert(page);
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('searchbox', { name: 'Search songs and Ragas' }).fill('Bhavayami');

  // Both taps land before the first pick's write can finish.
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    buttons.find((button) => button.textContent === '? Don’t know')!.click();
    buttons.find((button) => button.textContent?.startsWith('Use what I typed'))!.click();
  });

  await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();
  const items = await readTable<{ title: string }>(page, 'items');
  expect(items.map((item) => item.title)).toEqual(['?']);
  // Nothing is left in the journal claiming a pick the store doesn't hold.
  await expect(page.getByText(/not saved/i)).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith('wrapped.notSaved.v1:items:')),
      ),
    )
    .toEqual([]);
});
