// Phase 4, safe on the phone (T051 to T053; DESIGN.md "Settings", "Export lives in Settings",
// "Status", "Install"): Export lives in Settings with the day of the last one; home stays quiet
// until sync, but for "Getting ready for offline…"; Settings warns when storage isn't protected;
// and a phone with the app open in a browser tab shows the install strip above the tab bar on
// every screen, which an installed app and a desktop never show. Settings is the fourth tab.

import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  failWritesOnDemand,
  finishFirstLaunch,
  holdOfflineReady,
  openHub,
  openSettings,
  readMeta,
  releaseOfflineReady,
  setFailingWrites,
  storagePersisted,
  tab,
} from './helpers';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2 Nov", from the "2026-11-02T…" of a file's exportedAt. */
const shortDay = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
};

/** A device's screen and browser, without the browser type a describe group can't change. */
const device = (name: string) => {
  const { userAgent, viewport, deviceScaleFactor, isMobile, hasTouch } = devices[name]!;
  return { userAgent, viewport, deviceScaleFactor, isMobile, hasTouch };
};

const INSTALL_NAME =
  'Install the app so your season stays on this phone. Tap Share, then Add to Home Screen.';

/**
 * The install strip on Season, Shortlist and Diary (walkthrough FB-46; the Maintainer,
 * 2026-11-11): one strip directly above the tab bar, at the same place on each tab, its text
 * and Install label inside the 16px gutters.
 */
async function rowOnEachTab(page: Page, row: Locator): Promise<boolean> {
  const boxes = [];
  const tabs = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
  for (const name of ['Season', 'Shortlist', 'Diary']) {
    await tab(page, name).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(row).toBeVisible();
    boxes.push((await row.boundingBox())!);
    // The words on show (not the screen reader's sentence), each text node's own box.
    const inside = await row.evaluate((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const rects: DOMRect[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest('.sr-only')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rects.push(...[...range.getClientRects()].filter((r) => r.width > 0));
      }
      return {
        left: Math.min(...rects.map((r) => r.left)),
        right: Math.max(...rects.map((r) => r.right)),
      };
    });
    expect(inside.left).toBeGreaterThanOrEqual(16);
    expect(inside.right).toBeLessThanOrEqual(page.viewportSize()!.width - 16);
  }
  // Android's holds a button, so it is 44px; directly above the tab bar on every tab.
  expect(boxes.map((box) => box.height)).toEqual([44, 44, 44]);
  expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
  expect(boxes[0]!.y + boxes[0]!.height).toBe(tabs.y);
  return true;
}

async function newConcert(page: Page) {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
}

// Required test (constitution IV, "export"): the Export the rasika reaches before sync exists.
test('Export from Settings carries every record and the values not saved, and keeps its day', async ({
  page,
}) => {
  await failWritesOnDemand(page);
  await newConcert(page);
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  // The Item's details show once its first pick is stored.
  const tala = page.getByRole('button', { name: /^Tala,/ });
  await expect(tala).toBeVisible();

  // One value the phone can't store.
  await setFailingWrites(page, true);
  await tala.click();
  await page.getByRole('button', { name: 'Not applicable' }).click();
  await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await setFailingWrites(page, false);

  await page.getByRole('link', { name: 'Done' }).click();
  await openSettings(page);
  const exportRow = page.getByRole('button', { name: 'Export', exact: true });
  await expect(exportRow).toContainText('—');

  const download = page.waitForEvent('download');
  await exportRow.click();
  const file = JSON.parse(readFileSync((await (await download).path())!, 'utf8'));
  expect(file.format).toBe(1);
  expect(file.events).toHaveLength(1);
  expect(file.items).toHaveLength(1);
  expect(file.items[0].tala).toMatchObject({ state: 'unknown' });
  expect(file.unsyncedOps).toBeGreaterThan(0);
  expect(file.notSaved).toEqual([
    expect.objectContaining({
      table: 'items',
      id: file.items[0].id,
      field: 'tala',
      value: expect.objectContaining({ state: 'na' }),
      state: 'failed',
    }),
  ]);
  expect(file).not.toHaveProperty('storeUnreadable');

  // Handed over: the day is kept, and the row carries the check.
  const last = `Last: ${shortDay(file.exportedAt)}`;
  const exported = page.getByRole('button', { name: `Exported. ${last}` });
  await expect(exported).toContainText(last);
  expect(await readMeta(page, 'lastExport')).toEqual({ at: file.exportedAt });

  // A relaunch keeps the day.
  await page.reload();
  await expect(page.getByRole('button', { name: `Export. ${last}` })).toContainText(last);
});

test('home is quiet, and says "Getting ready for offline…" only until it is ready', async ({
  page,
}) => {
  await holdOfflineReady(page);
  await page.goto('/');
  await finishFirstLaunch(page);

  const gettingReady = page.getByRole('status').filter({ hasText: 'Getting ready for offline…' });
  await expect(gettingReady).toBeVisible();
  // Until sync exists, there is no status line.
  await expect(page.getByText(/backed up/)).toHaveCount(0);
  await openSettings(page);
  await expect(page.getByText('Getting ready for offline…')).toBeVisible();
  await tab(page, 'Season').click();

  // It clears on its own.
  await releaseOfflineReady(page);
  await expect(gettingReady).toHaveCount(0);
  await expect(page.getByText(/backed up/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
});

test('storage the browser hasn’t promised to keep reads "Storage not protected"', async ({
  page,
}) => {
  await storagePersisted(page, false);
  await page.goto('/');
  await finishFirstLaunch(page);
  // Settings' tab says there is something to fix, with an amber dot on its mark.
  await expect(page.getByRole('link', { name: 'Settings, something to fix' })).toBeVisible();
  await expect(page.locator('nav [data-to-fix]')).toBeVisible();
  await openSettings(page);
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Storage not protected' }),
  ).toBeVisible();
});

test.describe('the install row', () => {
  test('an iPhone browser tab shows Safari’s steps on every screen', async ({ page }) => {
    await newConcert(page);
    // Something entered, so the Concert is kept to come back to.
    await page.getByRole('button', { name: 'Note' }).click();
    await page.getByRole('textbox', { name: 'Note' }).fill('front row');
    // The Event screen, the hub, Settings, the Shortlist and the Diary: one strip, directly
    // above the tab bar.
    const tabs = page.getByRole('navigation', { name: 'Main' });
    for (const name of [null, 'Season', 'Settings', 'Shortlist', 'Diary']) {
      if (name === 'Settings') await openSettings(page);
      else if (name) await tab(page, name).click();
      await expect(page.getByText(INSTALL_NAME)).toHaveCount(1);
      await expect(page.getByText('Add to Home Screen:')).toBeVisible();
      const strip = (await page.locator('[data-install-strip]').boundingBox())!;
      expect(strip.y + strip.height).toBe((await tabs.boundingBox())!.y);
    }
    // No dismiss, and it never stands in front of Add Item.
    await openHub(page);
    await page.getByRole('region', { name: 'Now' }).getByRole('link').click();
    const addItem = page.getByRole('link', { name: 'Add Item' });
    await expect(addItem).toBeVisible();
    await expect(addItem).toBeEnabled();
    await expect(page.getByRole('button', { name: /dismiss/i })).toHaveCount(0);
  });

  test('an installed app shows nothing', async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query.includes('display-mode: standalone')
          ? ({ ...original(query), matches: true, media: query } as MediaQueryList)
          : original(query);
    });
    await page.goto('/');
    await finishFirstLaunch(page);
    await expect(page.getByText(INSTALL_NAME)).toHaveCount(0);
    await expect(page.getByText('Add to Home Screen:')).toHaveCount(0);
  });

  test.describe('on Android', () => {
    test.use(device('Pixel 7'));

    test('one Install button opens the browser’s prompt', async ({ page }) => {
      await page.goto('/');
      await finishFirstLaunch(page);
      // Chrome offers to install: the page keeps the prompt for the button.
      await page.evaluate(() => {
        const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
          prompt: () => {
            (window as unknown as { prompted: boolean }).prompted = true;
            return Promise.resolve();
          },
          userChoice: Promise.resolve({ outcome: 'dismissed' }),
        });
        window.dispatchEvent(event);
      });
      await expect(page.getByText('Install on this phone')).toBeVisible();
      await expect(page.getByText('Add to Home Screen:')).toHaveCount(0);
      expect(
        await rowOnEachTab(page, page.getByRole('button', { name: /^Install\b/ }).locator('..')),
      ).toBe(true);
      await page.getByRole('button', { name: /^Install\b/ }).click();
      expect(
        await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted),
      ).toBe(true);
    });
  });

  test.describe('on a desktop', () => {
    test.use(device('Desktop Chrome'));

    test('shows nothing', async ({ page }) => {
      await page.goto('/');
      await finishFirstLaunch(page);
      await expect(page.getByText(INSTALL_NAME)).toHaveCount(0);
      await expect(page.getByText('Install on this phone')).toHaveCount(0);
    });
  });
});
