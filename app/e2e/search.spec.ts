// The one search (docs/design/search.md; DESIGN.md "The docked search", "Search states"): What's
// on's names heard most before typing, its picks pinned at the top, one no-match line by the box
// in every search, and the best match kept whole when the room above the keyboard is short.
//
// The keyboard is a stand-in (helpers.ts): on iOS the page keeps its height and the visual
// viewport shrinks.

import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Role, ScheduleEntry } from '../src/model';
import { harnessScript } from './harness/build';
import type { Harness } from './harness/entry';
import { finishFirstLaunch, standInKeyboard } from './helpers';

/** A date `days` from today on this machine's clock, as the phone reads it. */
function dayFromToday(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

const entry = (
  id: string,
  days: number,
  billed: [string, Role, string?][],
  sabha = 'Music Academy',
  fields: Partial<ScheduleEntry> = {},
): ScheduleEntry => ({
  id,
  version: 1,
  date: dayFromToday(days),
  startTime: '18:00',
  sabha,
  kind: 'concert',
  title: null,
  billed: billed.map(([name, role, group]) => ({ name, role, group: group ?? null })),
  cancelled: false,
  ...fields,
});

/** Store entries as a fetched file would leave them. */
async function storeEntries(page: Page, entries: ScheduleEntry[]) {
  await page.evaluate(
    (entries) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('carnatic-wrapped');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('schedule', 'readwrite');
          for (const one of entries) tx.objectStore('schedule').put(one);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    entries,
  );
}

interface Heard {
  days: number;
  sabha: string;
  /** Each on Stage, with their Role and a group billed under. */
  stage: [string, Role, string?][];
}

/** Concerts the rasika heard, made through the store's actions. */
async function heard(page: Page, concerts: Heard[]) {
  await page.addScriptTag({ content: await harnessScript() });
  await page.evaluate(
    async (concerts) => {
      const { events, people, db } = (globalThis as unknown as { harness: Harness }).harness;
      for (const one of concerts) {
        const sabha =
          (await db.sabhas.toArray()).find((s) => s.name === one.sabha) ??
          (await people.createSabha(one.sabha));
        const made = await events.createEvent({
          kind: 'concert',
          date: one.date,
          startTime: '18:00',
          sabhaId: sabha.id,
        });
        for (const [name, role, group] of one.stage) {
          const artist =
            (await db.artists.toArray()).find((a) => a.name === name) ??
            (await people.createArtist(name));
          await people.addAppearance(made.id, artist.id, { role, group: group ?? null });
        }
      }
    },
    concerts.map((one) => ({ ...one, date: dayFromToday(one.days) })),
  );
}

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Find an Artist or Sabha' });
const field = (page: Page) =>
  sheet(page).getByRole('searchbox', { name: 'Find an Artist or Sabha' });

async function openSearch(page: Page) {
  await page.getByRole('button', { name: /^(Find an Artist or Sabha|Filter: )/ }).click();
  await expect(field(page)).toBeFocused();
}

/** Each row's name, top to bottom. */
const names = (list: Locator) =>
  list.getByRole('button').evaluateAll((all) => all.map((b) => b.firstElementChild?.textContent));

/** Where the best match is drawn, against the box under it. */
const byTheBox = (row: Locator) =>
  row.evaluate((row) => {
    const box = row.closest('[role="dialog"], main')!.querySelector('input[type="search"]')!;
    return Math.round(box.getBoundingClientRect().top - row.getBoundingClientRect().bottom);
  });

test.describe('What’s on before typing', () => {
  test('shows the names heard most, as leads, with something left to hear', async ({ page }) => {
    await page.goto('/');
    await finishFirstLaunch(page);
    // Sanjay led four, but has nothing ahead; the Malladi Brothers led two, as a group;
    // Jayanthi one; the mridangist was behind every one of them.
    await heard(page, [
      {
        days: -9,
        sabha: 'Narada Gana Sabha',
        stage: [
          ['Sanjay', 'vocal'],
          ['Patri', 'mridangam'],
        ],
      },
      {
        days: -8,
        sabha: 'Narada Gana Sabha',
        stage: [
          ['Sanjay', 'vocal'],
          ['Patri', 'mridangam'],
        ],
      },
      {
        days: -7,
        sabha: 'Narada Gana Sabha',
        stage: [
          ['Sanjay', 'vocal'],
          ['Patri', 'mridangam'],
        ],
      },
      {
        days: -4,
        sabha: 'Music Academy',
        stage: [
          ['Sanjay', 'vocal'],
          ['Patri', 'mridangam'],
        ],
      },
      {
        days: -6,
        sabha: 'Music Academy',
        stage: [
          ['Malladi Sreeramprasad', 'vocal', 'Malladi Brothers'],
          ['Malladi Ravikumar', 'vocal', 'Malladi Brothers'],
          ['Patri', 'mridangam'],
        ],
      },
      {
        days: -5,
        sabha: 'Music Academy',
        stage: [
          ['Malladi Sreeramprasad', 'vocal', 'Malladi Brothers'],
          ['Malladi Ravikumar', 'vocal', 'Malladi Brothers'],
          ['Patri', 'mridangam'],
        ],
      },
      {
        days: -2,
        sabha: 'Krishna Gana Sabha',
        stage: [
          ['Jayanthi', 'veena'],
          ['Patri', 'mridangam'],
        ],
      },
    ]);
    await storeEntries(page, [
      entry('m', 1, [
        ['Malladi Sreeramprasad', 'vocal', 'Malladi Brothers'],
        ['Malladi Ravikumar', 'vocal', 'Malladi Brothers'],
        ['Patri', 'mridangam'],
      ]),
      entry('j', 2, [['Jayanthi', 'veena']], 'Krishna Gana Sabha'),
      // Sanjay only in the days gone, and once more, cancelled.
      entry('s-gone', -3, [['Sanjay', 'vocal']], 'Narada Gana Sabha'),
      entry('s-off', 3, [['Sanjay', 'vocal']], 'Narada Gana Sabha', { cancelled: true }),
    ]);
    await page.goto('/whats-on');
    await openSearch(page);

    const often = sheet(page).getByRole('list', { name: 'Often heard' });
    await expect(sheet(page).getByText('Often heard', { exact: true })).toBeVisible();
    // The most heard by the box: Music Academy (3), the Malladi Brothers (2, as a group), then
    // Jayanthi and Krishna Gana Sabha (1 each, latest). No Sanjay, no Narada, nothing ahead;
    // no Patri, an accompanist; no Malladi heard on his own.
    await expect
      .poll(() => names(often))
      .toEqual(['Krishna Gana Sabha', 'Jayanthi', 'Malladi Brothers', 'Music Academy']);

    // Nothing is shaded, and Enter does nothing: the keyboard is up from the start.
    await expect(often.locator('[data-best]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await field(page).press('Enter');
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Find an Artist or Sabha' })).toBeVisible();
    await openSearch(page);

    // Typing still finds any name: an accompanist, one with only days gone.
    await field(page).fill('patri');
    const found = sheet(page).getByRole('list', { name: 'Suggestions, best match last' });
    await expect(found.getByRole('button', { name: /^Patri/ })).toBeVisible();
    await expect(sheet(page).getByText('Often heard', { exact: true })).toHaveCount(0);
    await field(page).fill('sanjay');
    await expect(found.getByRole('button', { name: /^Sanjay/ })).toBeVisible();
  });

  test('with nothing heard, shows only the toggles and the box', async ({ page }) => {
    await page.goto('/');
    await finishFirstLaunch(page);
    await storeEntries(page, [
      entry('m', 1, [['TM Krishna', 'vocal']]),
      entry('d', 2, [['Alarmel Valli', 'dancer']], 'Narada Gana Sabha', { kind: 'dance' }),
    ]);
    await page.goto('/whats-on');
    await openSearch(page);
    await expect(sheet(page).getByRole('button', { name: 'Dance', exact: true })).toBeVisible();
    await expect(sheet(page).getByText('Often heard', { exact: true })).toHaveCount(0);
    await expect(sheet(page).getByRole('list')).toHaveCount(0);
    // The A-to-Z list is gone.
    await expect(sheet(page).getByRole('button', { name: /^TM Krishna/ })).toHaveCount(0);
  });
});

test('picks stay pinned at the top, also while typing, and one taken off stays put', async ({
  page,
}) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, [
    entry('m', 1, [['Malladi Sreeramprasad', 'vocal', 'Malladi Brothers']]),
    entry('k', 1, [['TM Krishna', 'vocal']], 'Krishna Gana Sabha'),
  ]);
  await page.goto('/whats-on');
  const found = sheet(page).getByRole('list', { name: 'Suggestions, best match last' });
  for (const [typed, name] of [
    ['tm', 'TM Krishna'],
    ['krishna gana', 'Krishna Gana Sabha'],
  ] as const) {
    await openSearch(page);
    await field(page).fill(typed);
    await found.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expect(sheet(page)).toHaveCount(0);
  }

  await openSearch(page);
  const picked = sheet(page).getByRole('list', { name: 'Picked' });
  // In the order picked, each its kind word, then its check.
  await expect.poll(() => names(picked)).toEqual(['TM Krishna', 'Krishna Gana Sabha']);
  await expect(picked.getByRole('button', { name: 'TM Krishna Artist' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Typed, they stay; a picked name is never repeated below, nor the best match.
  await field(page).fill('krishna');
  await expect.poll(() => names(picked)).toEqual(['TM Krishna', 'Krishna Gana Sabha']);
  await expect(found.getByRole('button', { name: /^TM Krishna/ })).toHaveCount(0);
  await expect(found.getByRole('button', { name: /^Krishna Gana Sabha/ })).toHaveCount(0);
  await field(page).fill('zzqx');
  await expect(picked).toBeVisible();

  // Taken off, it stays where it is, unticked; put back, ticked again.
  const first = picked.getByRole('button', { name: 'TM Krishna Artist' });
  // Measured once the sheet has finished rising: on a fast runner the steps above can all land
  // inside its 220ms slide.
  await sheet(page).evaluate((rising) =>
    Promise.all(rising.getAnimations().map((slide) => slide.finished.catch(() => undefined))),
  );
  const before = await first.boundingBox();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  expect(await first.boundingBox()).toEqual(before);
  // The box keeps the focus, so on a phone the keyboard stays up and the sheet stays put.
  await expect(field(page)).toBeFocused();
  await expect(sheet(page)).toBeVisible();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await first.click();

  // Gone once the sheet closes.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Filter: Krishna Gana Sabha' })).toBeVisible();
  await openSearch(page);
  await expect.poll(() => names(picked)).toEqual(['Krishna Gana Sabha']);
});

test('one no-match line, by the box, in every search', async ({ page }) => {
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, [entry('m', 1, [['TM Krishna', 'vocal']])]);

  // What's on.
  await page.goto('/whats-on');
  await openSearch(page);
  await field(page).fill('zzqx');
  const line = (scope: Locator) => scope.getByText('Nothing matches “zzqx”', { exact: true });
  await expect(line(sheet(page))).toBeVisible();
  expect(await byTheBox(line(sheet(page)))).toBeLessThanOrEqual(16);
  await page.keyboard.press('Escape');

  // A Detail picker (the Forms are the project's own list: no catalog needed), with "Use what I
  // typed" one row up.
  await page.goto('/');
  await page.getByRole('button', { name: 'Log a Concert' }).click();
  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: '? Don’t know' }).click();
  await page.getByRole('button', { name: /^Form/ }).click();
  const form = page.getByRole('dialog', { name: 'Form' });
  await form.getByRole('searchbox', { name: 'Search Form' }).fill('zzqx');
  await expect(line(form)).toBeVisible();
  expect(await byTheBox(line(form))).toBeLessThanOrEqual(16);
  const typed = form.getByRole('button', { name: 'Use what I typed: “zzqx”' });
  expect((await typed.boundingBox())!.y).toBeLessThan((await line(form).boundingBox())!.y);
  await page.keyboard.press('Escape');

  // The Artist picker: "Add new" pinned above, the line by the box.
  await page.goBack();
  await page.getByRole('button', { name: 'Add Artist' }).click();
  const picker = page.getByRole('dialog', { name: 'Add Artist' });
  await picker.getByRole('searchbox', { name: 'Search Artists' }).fill('zzqx');
  await expect(line(picker)).toBeVisible();
  expect(await byTheBox(line(picker))).toBeLessThanOrEqual(16);
  const add = picker.getByRole('button', { name: 'Add “zzqx” as a new Artist' });
  expect((await add.boundingBox())!.y).toBeLessThan((await line(picker).boundingBox())!.y);
  // The old wordings are gone.
  await expect(page.getByText('No match in the catalog')).toHaveCount(0);

  // The box's clear mark empties it, and keeps the keyboard up.
  const box = picker.getByRole('searchbox', { name: 'Search Artists' });
  await picker.getByRole('button', { name: 'Clear search' }).click();
  await expect(box).toHaveValue('');
  await expect(box).toBeFocused();
});

/**
 * Where the best match is drawn, against what could cut it: the top edge of whatever clips it,
 * 40px lower where a fade is on, the search box under it, and the keyboard.
 */
function drawn(best: Locator) {
  return best.evaluate((row) => {
    const box = document.activeElement!.getBoundingClientRect();
    let clearFrom = 0;
    for (let up = row.parentElement; up && up !== document.body; up = up.parentElement) {
      const style = getComputedStyle(up);
      const masked = style.maskImage !== 'none' ? 40 : 0;
      if (style.overflowY !== 'visible' || masked > 0) {
        clearFrom = Math.max(clearFrom, up.getBoundingClientRect().top + masked);
      }
      // The panel's own fade, while it shows.
      const fade = up.querySelector(':scope > [data-fade]');
      if (fade && getComputedStyle(fade).opacity !== '0') {
        clearFrom = Math.max(clearFrom, fade.getBoundingClientRect().bottom);
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
const PHONE_HEIGHT = 664;
/** The room left above the keyboard, from an iPhone in Safari down to a small phone. */
const ROOMS = [420, 370, 328];

test.describe('when the room is short', () => {
  test.use({ viewport: { width: 375, height: PHONE_HEIGHT } });

  test('a Detail picker keeps its best match whole above a keyboard', async ({ page }) => {
    const keyboard = await standInKeyboard(page);
    await page.goto('/');
    await finishFirstLaunch(page);
    await page.getByRole('button', { name: 'Log a Concert' }).click();
    await page.getByRole('link', { name: 'Add Item' }).click();
    await page.getByRole('button', { name: '? Don’t know' }).click();
    await page.getByRole('button', { name: /^Form/ }).click();
    const box = page.getByRole('searchbox', { name: 'Search Form' });
    await box.fill('a');
    const best = page
      .getByRole('list', { name: 'Results, best match last' })
      .locator('[data-best]');
    const chip = page.getByRole('button', { name: 'Not applicable' });
    const typed = page.getByRole('button', { name: 'Use what I typed: “a”' });

    // On the whole screen every pinned row shows.
    await expect(chip).toBeVisible();
    await expect(typed).toBeVisible();
    await expect.poll(() => drawn(best)).toEqual(WHOLE);

    // The keyboard rises and grows: the best match stays by the box, whole, at every height.
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

    // Cleared, there is nothing to make room for, and the chips are back.
    await box.fill('');
    await expect(chip).toBeVisible();
  });

  test('What’s on’s picks step aside for the best match, and come back', async ({ page }) => {
    const keyboard = await standInKeyboard(page);
    await page.goto('/');
    await finishFirstLaunch(page);
    const many = Array.from({ length: 8 }, (_, i) => `Sabha ${i + 1}`);
    await storeEntries(page, [
      ...many.map((sabha, i) => entry(`s${i}`, 1, [[`Singer ${i + 1}`, 'vocal']], sabha)),
      entry('a', 2, [['Abhishek Raghuram', 'vocal']]),
      entry('b', 2, [['Bombay Jayashri', 'vocal']], 'Brahma Gana Sabha'),
      entry('c', 2, [['Charulatha Mani', 'vocal']], 'Chennai Fine Arts'),
    ]);
    await page.goto('/whats-on');
    for (const [typed, name] of [
      ['abhishek', 'Abhishek Raghuram'],
      ['bombay', 'Bombay Jayashri'],
      ['charulatha', 'Charulatha Mani'],
    ] as const) {
      await openSearch(page);
      await field(page).fill(typed);
      await sheet(page)
        .getByRole('button', { name: new RegExp(`^${name}`) })
        .click();
      await expect(sheet(page)).toHaveCount(0);
    }
    await openSearch(page);
    const picked = sheet(page).getByRole('list', { name: 'Picked' });
    await field(page).fill('sabha');
    const best = sheet(page)
      .getByRole('list', { name: 'Suggestions, best match last' })
      .locator('[data-best]');
    await expect(picked).toBeVisible();
    await expect.poll(() => drawn(best)).toEqual(WHOLE);

    await keyboard(PHONE_HEIGHT - 328, true);
    await expect.poll(() => drawn(best)).toEqual(WHOLE);
    await expect(picked).toBeHidden();

    // The room back, the picks are back.
    await keyboard(0, true);
    await expect(picked).toBeVisible();
    await expect.poll(() => drawn(best)).toEqual(WHOLE);
  });
});
