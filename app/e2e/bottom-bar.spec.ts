import { expect, test, type Page } from '@playwright/test';
import { finishFirstLaunch } from './helpers';

// The bottom bar is the shell's (DESIGN.md "Motion"): moving between an Event and an Item never
// empties it or changes its height, so the tab bar never jumps. The hub has none (its search bar
// is What's on's since 2026-11-11), so the bar comes and goes in one step. Sampled every
// animation frame across each move, as the iPhone walkthrough's flicker was seen (2026-11-06).

type Sample = { bar: number; footer: number; buttons: number; labels: string };

/** Record the footer's height and the bar's buttons every frame until `stop` is called. */
async function sample(page: Page, move: () => Promise<void>): Promise<Sample[]> {
  await page.evaluate(() => {
    const w = window as unknown as { samples: Sample[]; sampling: boolean };
    w.samples = [];
    w.sampling = true;
    const tick = () => {
      if (!w.sampling) return;
      const footer = document.querySelector('footer')!;
      const bar = footer.firstElementChild as HTMLElement;
      const buttons = [...bar.querySelectorAll<HTMLElement>('[data-slot="button"]')].filter(
        (b) => b.getBoundingClientRect().height > 0,
      );
      w.samples.push({
        bar: bar.getBoundingClientRect().height,
        footer: footer.getBoundingClientRect().height,
        buttons: buttons.length,
        labels: buttons.map((b) => b.textContent).join('|'),
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await move();
  // A few frames past the new screen's first, for anything that would come late.
  await page.evaluate(() => new Promise((done) => setTimeout(done, 400)));
  return page.evaluate(() => {
    const w = window as unknown as { samples: Sample[]; sampling: boolean };
    w.sampling = false;
    return w.samples;
  });
}

/** The values in order, each run of repeats as one. */
const steps = <T>(values: T[]) => values.filter((v, i) => v !== values[i - 1]);

/**
 * Every frame shows an action in a bar of one height; the labels go once from `from` to `to`,
 * and the footer changes height at most once (the tab bar hiding for the Item editor).
 */
function expectSteady(samples: Sample[], from: string, to: string) {
  expect(samples.length).toBeGreaterThan(5);
  expect(samples.filter((s) => s.buttons === 0)).toEqual([]);
  expect(steps(samples.map((s) => Math.round(s.bar)))).toHaveLength(1);
  expect(steps(samples.map((s) => Math.round(s.footer))).length).toBeLessThanOrEqual(2);
  expect(steps(samples.map((s) => s.labels))).toEqual([from, to]);
}

/**
 * The bar comes (`to` its label) or goes (`to` null) in one step, never half there, and the
 * footer keeps one height while it shows and one while it doesn't: the tab bar never jumps.
 */
function expectOneStep(samples: Sample[], to: string | null) {
  expect(samples.length).toBeGreaterThan(5);
  const shown = steps(samples.map((s) => s.buttons > 0));
  expect(shown).toEqual(to === null ? [true, false] : [false, true]);
  for (const showing of [true, false]) {
    const heights = samples.filter((s) => s.buttons > 0 === showing).map((s) => s.footer);
    expect(new Set(heights).size).toBe(1);
  }
  const labels = new Set(samples.filter((s) => s.buttons > 0).map((s) => s.labels));
  expect(labels.size).toBe(1);
  if (to !== null) expect(labels).toEqual(new Set([to]));
}

test('the bottom bar never empties or shrinks between Event and Item, and goes in one step back on Season', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  const main = page.getByRole('main');

  // Season to a new Concert.
  let samples = await sample(page, async () => {
    await page.getByRole('button', { name: 'Log a Concert' }).click();
    await expect(page.getByRole('button', { name: 'Add Sabha' })).toBeVisible();
  });
  expectOneStep(samples, 'Add Item');

  // An Item to come back from and go into. The new Item's search has no bar of its own.
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();

  // Item to Event, Event to Item, and back with the top bar's chevron.
  samples = await sample(page, async () => {
    await page.getByRole('link', { name: 'Done' }).click();
    await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  });
  expectSteady(samples, 'Next Item|Done', 'Add Item');

  samples = await sample(page, async () => {
    await main.getByRole('link', { name: /^1 / }).click();
    await expect(page.getByRole('button', { name: /^Tala,/ })).toBeVisible();
  });
  expectSteady(samples, 'Add Item', 'Next Item|Done');

  samples = await sample(page, async () => {
    await main.getByRole('link', { name: 'Concert', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Add Item' })).toBeVisible();
  });
  expectSteady(samples, 'Next Item|Done', 'Add Item');

  // Event to Season: the hub has no action of its own (its search bar went to What's on,
  // 2026-11-11), so the bar goes in one step, never half there.
  samples = await sample(page, async () => {
    await main.getByRole('link', { name: 'Season' }).click();
    await expect(page.getByRole('region', { name: 'Now' })).toBeVisible();
  });
  expectOneStep(samples, null);
});
