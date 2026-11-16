// The docked search when the room above the keyboard is short (DESIGN.md "Search states"): the
// best match, by the box, is never the row that is cut. On the Maintainer's iPhone (2026-11-14,
// Safari, "Endaro" typed) the three pinned rows stood whole and the one result they were looking
// for had lost its title under them.
//
// The keyboard is a stand-in (helpers.ts): on iOS the page keeps its height and the visual
// viewport shrinks. The phone here is 664px tall, so a 336px keyboard leaves 328px.

import { expect, test, type Locator, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { finishFirstLaunch, standInKeyboard } from './helpers';

const PHONE_HEIGHT = 664;
/** The room left above the keyboard, from an iPhone in Safari down to a small phone. */
const ROOMS = [420, 370, 328];

const snapshot = (() => {
  try {
    return readdirSync(new URL('../public/catalog/', import.meta.url)).find((name) =>
      /^catalog\.[0-9a-f]{64}\.json$/.test(name),
    );
  } catch {
    return undefined;
  }
})();

const bestOf = (results: Locator) => results.getByRole('listitem').last().getByRole('button');

/**
 * Where the best match is drawn, against what could cut it: the top edge of whatever clips it,
 * 32px lower where a fade is on (rows scrolled under the pinned rows fade in over that much),
 * the search box under it, and the keyboard.
 */
function drawn(best: Locator) {
  return best.evaluate((row) => {
    const box = document.activeElement!.getBoundingClientRect();
    let clearFrom = 0;
    for (let up = row.parentElement; up && up !== document.body; up = up.parentElement) {
      const style = getComputedStyle(up);
      const fade = style.maskImage !== 'none' ? 32 : 0;
      if (style.overflowY !== 'visible' || fade > 0) {
        clearFrom = Math.max(clearFrom, up.getBoundingClientRect().top + fade);
      }
    }
    const { top, bottom } = row.getBoundingClientRect();
    return {
      cutOrFaded: top < clearFrom - 0.5,
      underTheBox: bottom > box.top + 0.5,
      boxUnderTheKeyboard: box.bottom > window.visualViewport!.height + 0.5,
    };
  });
}

const WHOLE = { cutOrFaded: false, underTheBox: false, boxUnderTheKeyboard: false };

async function newItem(page: Page) {
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('link', { name: 'Add Item' }).click();
}

test('a Detail picker keeps its best match whole above a keyboard', async ({ page }) => {
  const keyboard = await standInKeyboard(page);
  await newItem(page);
  await page.getByRole('button', { name: '? Don’t know' }).click();
  // The Forms are the project's own list, so this needs no catalog.
  await page.getByRole('button', { name: /^Form/ }).click();
  const box = page.getByRole('searchbox', { name: 'Search Form' });
  await box.fill('a');
  const best = bestOf(page.getByRole('list', { name: 'Results, best match last' }));
  const chip = page.getByRole('button', { name: 'Not applicable' });
  const typed = page.getByRole('button', { name: 'Use what I typed: “a”' });

  // On the whole screen every pinned row shows, as it always has.
  await expect(chip).toBeVisible();
  await expect(typed).toBeVisible();
  await expect.poll(() => drawn(best)).toEqual(WHOLE);

  // The keyboard rises and grows with the results already drawn: the best match stays by the
  // box, whole, at every height.
  for (const room of ROOMS) {
    await keyboard(PHONE_HEIGHT - room, true);
    await expect.poll(() => drawn(best), { message: `${room}px of room` }).toEqual(WHOLE);
  }
  // At the shortest the chips have stepped aside, and "Use what I typed" still stands.
  await expect(chip).toBeHidden();
  await expect(typed).toBeVisible();

  // Typing goes on: each new best match is whole too.
  await box.fill('slo');
  await expect(best).toHaveText('Slokam');
  await expect.poll(() => drawn(best)).toEqual(WHOLE);

  // With the box cleared there is nothing to make room for, and the chips are back.
  await box.fill('');
  await expect(chip).toBeVisible();
});

test.describe('with the catalog', () => {
  // The Item editor's results come from the private snapshot, so like the search timing test
  // this runs locally and before each deploy, and skips in CI (CONTRIBUTING.md).
  test.skip(!snapshot, 'needs the catalog snapshot in app/public/catalog/');

  test('the Item editor keeps its best match whole above a keyboard', async ({ page }) => {
    const keyboard = await standInKeyboard(page);
    await newItem(page);
    const box = page.getByRole('searchbox', { name: 'Search songs and Ragas' });
    const chip = page.getByRole('button', { name: 'RTP' });
    const unknown = page.getByRole('button', { name: '? Don’t know' });
    const typed = page.getByRole('button', { name: 'Use what I typed: “Endaro”' });
    const best = bestOf(page.getByRole('list', { name: 'Results, best match last' }));

    for (const room of ROOMS) {
      // Typed with the keyboard already up, as in the hand.
      await box.fill('');
      await keyboard(PHONE_HEIGHT - room, true);
      await box.fill('Endaro');
      await expect(best).toContainText('Endaro Mahanubhavu');
      await expect.poll(() => drawn(best), { message: `${room}px of room` }).toEqual(WHOLE);
      await expect(typed).toBeVisible();
    }
    // At the shortest only "Use what I typed" is pinned.
    await expect(chip).toBeHidden();
    await expect(unknown).toBeHidden();

    // Cleared, the kinds and "? Don't know" are back, above the keyboard still.
    await box.fill('');
    await expect(chip).toBeVisible();
    await expect(unknown).toBeVisible();

    // And with the keyboard gone, everything is pinned again over the results.
    await box.fill('Endaro');
    await expect(chip).toBeHidden();
    await keyboard(0, true);
    await expect(chip).toBeVisible();
    await expect(unknown).toBeVisible();
    await expect.poll(() => drawn(best)).toEqual(WHOLE);
  });
});
