import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import { finishFirstLaunch } from './helpers';

// A wide screen (DESIGN.md "Layout", "A wide screen"): over 600px the app stays a phone, one
// 430px column centred on the window, and everything that floats (the tab bar, a bottom sheet,
// an Undo bar) stays inside it. The page never scrolls sideways. On a laptop: a mouse, no touch.

const COLUMN = 430;

type Box = { x: number; width: number };

/** The column's box: the app's root. */
const column = (page: Page): Promise<Box> =>
  page.locator('#root').evaluate((root) => {
    const { x, width } = root.getBoundingClientRect();
    return { x, width };
  });

/** `target` lies within the column's sides (to half a pixel) and fills it. */
async function inColumn(page: Page, target: Locator, fills = true) {
  const box = await column(page);
  const own = (await target.boundingBox())!;
  expect(own.x).toBeGreaterThanOrEqual(box.x - 0.5);
  expect(own.x + own.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
  if (fills) expect(own.width).toBeCloseTo(box.width, 0);
}

async function noSidewaysScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({
      viewport,
      isMobile: false,
      hasTouch: false,
      deviceScaleFactor: 1,
      userAgent: devices['Desktop Chrome'].userAgent,
    });

    test('the app is one centred column; its tab bar, a sheet and an Undo bar stay inside it', async ({
      page,
    }) => {
      await page.goto('/');
      await finishFirstLaunch(page);

      // One 430px column, centred on the window.
      const box = await column(page);
      expect(box.width).toBe(COLUMN);
      const window = await page.evaluate(() => document.documentElement.clientWidth);
      expect(box.x).toBeCloseTo((window - COLUMN) / 2, 0);
      await inColumn(page, page.getByRole('navigation', { name: 'Main' }));
      await noSidewaysScroll(page);

      // A bottom sheet (Add Artist) rises inside the column.
      await page.getByRole('button', { name: 'Log a Concert' }).click();
      await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
      await page.getByRole('button', { name: 'Add Artist' }).click();
      const sheet = page.locator('[data-slot="sheet-content"]');
      await expect(sheet).toBeVisible();
      // Once it has risen, not mid-slide.
      await expect.poll(() => sheet.evaluate((node) => node.getAnimations().length)).toBe(0);
      await inColumn(page, sheet);
      await noSidewaysScroll(page);

      // An Undo bar, inside the column with the tab bar under it.
      await page.getByRole('searchbox', { name: 'Search Artists' }).fill('Sanjay');
      await page.getByRole('button', { name: 'Add “Sanjay” as a new Artist' }).click();
      await page.getByRole('button', { name: 'Vocal' }).click();
      await page.getByRole('button', { name: /^Sanjay/ }).click();
      await page.getByRole('button', { name: 'Remove', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
      await expect(sheet).toHaveCount(0);
      await inColumn(page, page.locator('footer'));
      await inColumn(page, page.locator('[data-undo-bar]'), false);
      await inColumn(page, page.getByRole('navigation', { name: 'Main' }));
      await noSidewaysScroll(page);
    });

    test('a wheel over the sides scrolls the page; the column draws its own thin scrollbar', async ({
      page,
    }) => {
      await page.goto('/');
      await finishFirstLaunch(page);
      // The empty hub, made tall enough to scroll.
      await page.evaluate(() => {
        const room = document.createElement('div');
        room.style.height = '3000px';
        document.querySelector('main')!.append(room);
      });
      const box = await column(page);
      // Over the left side, outside the column.
      await page.mouse.move(box.x / 2, viewport.height / 2);
      await page.mouse.wheel(0, 400);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await noSidewaysScroll(page);

      // The window's own scrollbar is hidden; the column's thumb stands inside its right edge.
      const thumb = page.locator('[data-column-scrollbar] > div');
      await expect(thumb).toBeAttached();
      expect(await thumb.evaluate((node) => (node as HTMLElement).hidden)).toBe(false);
      await inColumn(page, thumb, false);
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth),
      ).toBe('none');
    });
  });
}

test.describe('on a phone', () => {
  test('nothing changes: the app is the screen, with no column and no scrollbar of its own', async ({
    page,
  }) => {
    await page.goto('/');
    await finishFirstLaunch(page);
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    expect((await column(page)).width).toBe(width);
    await expect(page.locator('[data-column-scrollbar]')).toHaveCount(0);
    await inColumn(page, page.getByRole('navigation', { name: 'Main' }));
  });
});
