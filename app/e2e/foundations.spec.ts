// The foundations and the list row, measured (docs/design/foundations.md, docs/design/row.md;
// the Maintainer, 2026-11-16): fills 8px from the screen with 16px corners and text 24px in;
// rows 12px above and below (48, 68, 88px); 32px between sections and 8px from a label to its
// panel; the type scale's sizes and weights; a facts line of two lines at most; and "Cancelled"
// in a cancelled concert's time's place.

import { expect, test, type Locator, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { harnessScript } from './harness/build';
import type { Harness } from './harness/entry';
import { finishFirstLaunch, openSettings } from './helpers';

const DAY = '2026-12-20';

const entry = (
  id: string,
  startTime: string,
  fields: Partial<ScheduleEntry> = {},
): ScheduleEntry => ({
  id,
  version: 1,
  date: DAY,
  startTime,
  sabha: `Sabha ${id}`,
  kind: 'concert',
  title: null,
  billed: [{ name: `Singer ${id}`, role: 'vocal', group: null, support: false }],
  cancelled: false,
  ...fields,
});

const SCHEDULE = [
  // Two lines: the name and the facts.
  entry('two', '10:00'),
  // Three lines: the name, the accompanists and the facts.
  entry('three', '11:00', {
    billed: [
      { name: 'Singer three', role: 'vocal', group: null, support: false },
      { name: 'Violinist three', role: 'violin', group: null, support: false },
    ],
  }),
  // A Sabha too long for one line: the facts line stops at two.
  entry('long', '12:00', {
    sabha:
      'Sri Parthasarathy Swami Sabha, Vidya Bharathi Kalyana Mandapam, Mylapore, Chennai Six Hundred Four',
  }),
  entry('off', '13:00', { cancelled: true }),
];

async function open(page: Page) {
  await page.clock.setFixedTime(new Date(`${DAY}T08:00:00`));
  await page.goto('/');
  await finishFirstLaunch(page);
  await page.evaluate(
    (entries) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('carnatic-wrapped');
        request.onsuccess = () => {
          const tx = request.result.transaction('schedule', 'readwrite');
          for (const one of entries) tx.objectStore('schedule').put(one);
          tx.oncomplete = () => {
            request.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    SCHEDULE,
  );
  await page.reload();
  await page.locator('main h1').first().waitFor();
}

const box = async (locator: Locator) => (await locator.boundingBox())!;
/** A page gone into slides in from the right: measure once it has settled. */
const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
const style = (locator: Locator, property: string) =>
  locator.evaluate((node, property) => getComputedStyle(node).getPropertyValue(property), property);
const width = (page: Page) => page.viewportSize()!.width;

/** A fill on the 8px edge with 16px corners. */
async function onFillEdge(page: Page, fill: Locator) {
  const { x, width: w } = await box(fill);
  expect(Math.round(x)).toBe(8);
  expect(Math.round(width(page) - x - w)).toBe(8);
  expect(await style(fill, 'border-top-left-radius')).toBe('16px');
}

/** A label above a panel: body 600 (17/24), in ink, on the 24px column. */
async function strongLabel(label: Locator) {
  expect(await style(label, 'font-size')).toBe('17px');
  expect(await style(label, 'line-height')).toBe('24px');
  expect(await style(label, 'font-weight')).toBe('600');
  expect(Math.round((await box(label)).x)).toBe(24);
}

test('the hub: panels on the 8px edge, text on 24, the rhythm, the row heights', async ({
  page,
}) => {
  await open(page);
  const today = page.getByRole('region', { name: 'Today', exact: true });
  const label = today.getByRole('heading', { name: 'Today', exact: true });
  const panel = today.locator('[data-panel]');
  await onFillEdge(page, panel);
  await strongLabel(label);

  // The first section 16px under the curtain's foot; the label 8px over its panel.
  const curtain = await box(page.locator('[data-curtain-field]'));
  const head = await box(label);
  expect(Math.round(head.y - (curtain.y + curtain.height))).toBe(16);
  expect(Math.round((await box(panel)).y - (head.y + head.height))).toBe(8);

  // 32px from the panel's edge to the next label.
  const next = await box(page.getByRole('heading', { name: 'Shortlist', exact: true }));
  const edge = await box(panel);
  expect(Math.round(next.y - (edge.y + edge.height))).toBe(32);

  // The count in `sub`, never a caption.
  expect(await style(today.locator('.tabular-nums').first(), 'font-size')).toBe('15px');

  // Rows: 12px above and below; two lines 68px, three 88px; the name on the 24px column.
  const row = (name: string) => today.locator('[data-row="concert"]', { hasText: name });
  expect(Math.round((await box(row('Singer two'))).height)).toBe(68);
  const name = row('Singer two').locator('[data-name]');
  expect(Math.round((await box(name)).x)).toBe(24);
  expect(Math.round((await box(name)).y - (await box(row('Singer two'))).y)).toBe(12);
  expect(await style(name, 'font-size')).toBe('17px');
  expect(await style(name, 'font-weight')).toBe('400');
  const facts = row('Singer two').locator('[data-facts]');
  expect(await style(facts, 'font-size')).toBe('15px');
  // Time first.
  await expect(facts).toHaveText('10:00 am · Sabha two');
});

test('the facts line stops at two lines, and a cancelled concert says so in its time', async ({
  page,
}) => {
  await open(page);
  await page.locator('main a[href="/whats-on"]').first().click();
  await settled(page);
  const list = page.locator('[data-list]');
  // Rows step by 20px: three lines are 88px.
  const three = list.locator('[data-row="concert"]', { hasText: 'Singer three' });
  expect(Math.round((await box(three)).height)).toBe(88);
  const long = list.locator('[data-row="concert"]', { hasText: 'Singer long' });
  const facts = long.locator('[data-facts]');
  // Two lines of 20px at most, the second cut with "…".
  expect(Math.round((await box(facts)).height)).toBe(40);
  await expect(facts.locator('span').first()).toHaveText('12:00 pm');
  const cut = facts.locator('.truncate');
  expect(
    await cut.evaluate((node) => node.scrollWidth > node.clientWidth && node.clientWidth > 0),
  ).toBe(true);

  const off = list.locator('[data-row="concert"]', { hasText: 'Singer off' });
  await expect(off.locator('[data-facts]')).toHaveText('Cancelled · Sabha off');
  // A day's panel on the 8px edge, its label in body 600, 8px over it.
  const day = list.locator('section').first();
  await onFillEdge(page, day.locator('[data-panel]'));
  await strongLabel(day.locator('h2'));
  // The search bar on the 8px edge with 16px corners.
  await onFillEdge(page, page.locator('[data-season-bar]'));
});

test('an Event: the title, the Items and Stage on panels, the number box', async ({ page }) => {
  await open(page);
  await page.addScriptTag({ content: await harnessScript() });
  const id = await page.evaluate(async () => {
    const { events, items, people } = (globalThis as unknown as { harness: Harness }).harness;
    const event = await events.createEvent({ kind: 'concert', date: '2026-12-19' });
    await items.addItem(event.id, { title: 'Tillana' });
    await items.addItem(event.id, { title: 'Mangalam' });
    const artist = await people.createArtist('Singer Event');
    await people.addAppearance(event.id, artist.id, { role: 'vocal' as never });
    const long = await people.createArtist('Kumbakonam Mahadevan Venkatasubramanian Iyer');
    await people.addAppearance(event.id, long.id, { role: 'violin' as never });
    return event.id;
  });
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Diary' }).click();
  await page.locator(`a[href="/event/${id}"]`).first().click();
  await settled(page);

  const title = page.locator('main h1');
  expect(await style(title, 'font-size')).toBe('24px');
  expect(await style(title, 'font-weight')).toBe('700');
  expect(Math.round((await box(title)).x)).toBe(24);

  const items = page.getByRole('region', { name: 'Items' });
  await strongLabel(items.getByRole('heading', { name: 'Items' }));
  await onFillEdge(page, items.locator('[data-panel]'));
  const row = items.getByRole('link').first();
  // The number right-aligned in a 24px box from 24, then 8px, the title at 56.
  const number = row.locator('span').first();
  const numberBox = await box(number);
  expect(Math.round(numberBox.x)).toBe(24);
  expect(Math.round(numberBox.width)).toBe(24);
  expect(await style(number, 'text-align')).toBe('right');
  expect(Math.round((await box(row.getByText('Tillana'))).x)).toBe(56);
  // Two lines, the title and its `sub` line: 68px.
  expect(Math.round((await box(row)).height)).toBe(68);

  const stage = page.getByRole('region', { name: 'Stage' });
  await onFillEdge(page, stage.locator('[data-panel]'));
  // The colour dot centred on the row's text, however many lines it takes (the Maintainer,
  // 2026-11-20, in place of the last line).
  const middle = (b: { y: number; height: number }) => b.y + b.height / 2;
  for (const name of ['Singer Event', 'Kumbakonam']) {
    const each = stage.getByRole('listitem').filter({ hasText: name });
    const text = each.getByRole('button', { name: new RegExp(`^${name}`) });
    const dot = each.getByRole('button', { name: /^Colours for/ });
    expect(Math.abs(middle(await box(dot)) - middle(await box(text)))).toBeLessThanOrEqual(1);
  }
  expect((await box(stage.getByText(/^Kumbakonam/))).height).toBeGreaterThan(30);
  // Add Item, at the bottom, on the 8px edge with 16px corners.
  await onFillEdge(page, page.getByRole('link', { name: 'Add Item' }));
});

test('Settings: groups on panels, rows at least 48px, Theme in body 600', async ({ page }) => {
  await open(page);
  await openSettings(page);
  await settled(page);
  const panels = page.locator('main [data-panel]');
  await expect(panels).toHaveCount(2);
  await onFillEdge(page, panels.first());
  for (const row of await panels.first().locator('li').all()) {
    expect((await box(row)).height).toBeGreaterThanOrEqual(48);
  }
  // A List row with a mark: its title at 56.
  const exportTitle = panels.first().getByText('Export', { exact: true });
  expect(Math.round((await box(exportTitle)).x)).toBe(56);
  await strongLabel(page.getByText('Theme', { exact: true }));
  // The versions in `sub`.
  expect(await style(page.getByText(/^App /).locator('..'), 'font-size')).toBe('15px');
});

// The user, 2026-11-17: a facts line too long for two lines cuts the Sabha first, so the Item
// count always shows: "Sun 13 Dec · 6:45 pm" / "Sri Parthasarathy Swami… · 3 Items".
test('a long facts line cuts the Sabha before the Item count', async ({ page }) => {
  await open(page);
  await page.addScriptTag({ content: await harnessScript() });
  await page.evaluate(async () => {
    const { events, items, people } = (globalThis as unknown as { harness: Harness }).harness;
    const sabha = await people.createSabha(
      'Sri Parthasarathy Swami Sabha, Vidya Bharathi Kalyana Mandapam, Mylapore',
    );
    const event = await events.createEvent({
      kind: 'concert',
      date: '2026-12-13',
      startTime: '18:45',
      sabhaId: sabha.id,
    });
    const artist = await people.createArtist('Singer Heard');
    await people.addAppearance(event.id, artist.id, { role: 'vocal' as never });
    for (const title of ['Varnam', 'Kriti', 'Tillana']) await items.addItem(event.id, { title });
  });
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Diary' }).click();
  await settled(page);
  const facts = page
    .locator('main [data-row="concert"]', { hasText: 'Singer Heard' })
    .locator('[data-facts]');
  // Two lines, the count whole at the end of the second, the Sabha cut before it.
  expect(Math.round((await box(facts)).height)).toBe(40);
  const lines = facts.locator(':scope > span');
  await expect(lines.first()).toHaveText('Sun 13 Dec · 6:45 pm');
  await expect(lines.nth(1)).toContainText('· 3 Items');
  const count = lines.nth(1).getByText('3 Items', { exact: true });
  await expect(count).toBeInViewport({ ratio: 1 });
  const cut = lines.nth(1).locator('.truncate');
  expect(await cut.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  expect(Math.round((await box(count)).x + (await box(count)).width)).toBeLessThanOrEqual(
    width(page) - 24,
  );
});
