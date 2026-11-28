import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';
import { finishFirstLaunch, tab } from './helpers';

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

    test('the sides are one even tint, the whole page down, at any scroll, on every tab', async ({
      page,
    }) => {
      await page.goto('/');
      await finishFirstLaunch(page);
      const box = await column(page);
      // Halfway across the left side, and the right.
      const sides = [Math.round(box.x / 2), Math.round(box.x + box.width + box.x / 2)];
      for (const name of ['Season', 'Shortlist', 'Diary', 'Settings']) {
        await tab(page, name).click();
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
        // Each tab made three windows tall, so the page scrolls.
        await page.evaluate((height) => {
          const room = document.createElement('div');
          room.style.height = `${height * 3}px`;
          document.querySelector('main')!.append(room);
        }, viewport.height);
        // The whole page in one picture (a full-page capture, as a laptop's screenshot tool
        // takes it), and the window scrolled to the foot: the sides never change tone.
        const tones = [
          ...(await tonesDown(await page.screenshot({ fullPage: true }), sides)),
          ...(await page
            .evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            .then(async () => tonesDown(await page.screenshot(), sides))),
        ];
        expect(new Set(tones), `${name}: ${[...new Set(tones)].join(' | ')}`).toEqual(
          new Set([tones[0]]),
        );
        // And that tone is the sides' tint, a step from the column's page colour.
        const columnTone = (await tonesDown(await page.screenshot(), [box.x + 8]))[0];
        expect(tones[0]).not.toBe(columnTone);
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    });
  });
}

/** The colour at each of `xs`, every 50px down a screenshot. */
async function tonesDown(png: Buffer, xs: number[]): Promise<string[]> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tones: string[] = [];
  for (let y = 0; y < info.height; y += 50)
    for (const x of xs) {
      const at = (y * info.width + x) * 3;
      tones.push(`${data[at]},${data[at + 1]},${data[at + 2]}`);
    }
  return tones;
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
