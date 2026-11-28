// Moving between the tabs never flickers (the Maintainer, 2026-11-28: "super annoying"). A tab
// comes back with its last content on its first frame: no blank page, no heading alone, and the
// page the same height as when it was left. Each frame `main` drew is recorded while the tabs
// change, so what a rasika would see for one frame is caught.

import { expect, test, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { finishFirstLaunch, tab } from './helpers';

const DAY = '2026-12-20';

const entry = (id: string, startTime: string): ScheduleEntry => ({
  id,
  version: 1,
  date: DAY,
  startTime,
  sabha: `Sabha ${id}`,
  kind: 'concert',
  title: null,
  billed: [
    { name: `Singer ${id}`, role: 'vocal', group: null, support: false },
    { name: `Violinist ${id}`, role: 'violin', group: null, support: false },
  ],
  cancelled: false,
});

const LISTINGS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((id, n) =>
  entry(id, `${String(9 + n).padStart(2, '0')}:00`),
);

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

interface Frame {
  path: string;
  /** `main`'s text, but for its heading. */
  body: string;
  heading: string;
  height: number;
  /** The hub's Diary section, there in every state of the hub once it has read the store. */
  hub: boolean;
  /** The Season motif, painted and not fading in. */
  art: boolean;
}

/** Start recording each frame `main` draws. */
async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { frames_: Frame[]; recording_: boolean };
    w.frames_ = [];
    w.recording_ = true;
    const step = () => {
      if (!w.recording_) return;
      const main = document.querySelector('main')!;
      const heading = main.querySelector('h1')?.textContent?.trim() ?? '';
      const canvas = main.querySelector<HTMLCanvasElement>('canvas[data-motif]');
      w.frames_.push({
        path: location.pathname,
        body: main.innerText.replace(heading, '').trim(),
        heading,
        height: Math.round(main.getBoundingClientRect().height),
        hub: main.querySelector('#hub-diary') !== null,
        // Painted, and whole: not fading in again.
        art: canvas !== null && canvas.width > 0 && getComputedStyle(canvas).opacity === '1',
      });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** Stop recording, after the page has had time to settle, and the frames it drew. */
async function frames(page: Page): Promise<Frame[]> {
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const w = window as unknown as { frames_: Frame[]; recording_: boolean };
    w.recording_ = false;
    return w.frames_;
  });
}

const PATHS = { Season: '/', Shortlist: '/shortlist', Diary: '/diary' } as const;

/** Tap a tab and the frames drawn on its page, from the first. */
async function go(page: Page, name: keyof typeof PATHS) {
  await record(page);
  await tab(page, name).click();
  await expect(page).toHaveURL(new RegExp(`${PATHS[name]}$`));
  return (await frames(page)).filter((frame) => frame.path === PATHS[name]);
}

test('a tab comes back with its content on its first frame', async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${DAY}T10:30:00`));
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeEntries(page, LISTINGS);
  await page.reload();
  await expect(page.locator('#hub-diary')).toBeVisible();
  // Settled: the motif painted and the rows drawn.
  await expect(page.locator('main canvas[data-motif]')).toBeVisible();
  const seasonHeight = Math.round((await page.locator('main').boundingBox())!.height);

  const route: (keyof typeof PATHS)[] = [
    'Shortlist',
    'Season',
    'Diary',
    'Season',
    'Shortlist',
    'Diary',
    'Season',
  ];
  for (const name of route) {
    const drawn = await go(page, name);
    expect(drawn.length, `${name} drew no frames`).toBeGreaterThan(0);
    if (name === 'Season') {
      const blank = drawn.findIndex((frame) => !frame.hub);
      expect(blank, `Season frame ${blank} had no hub: ${JSON.stringify(drawn[blank])}`).toBe(-1);
      const jumped = drawn.find((frame) => frame.height !== seasonHeight);
      expect(jumped?.height ?? seasonHeight, 'Season changed height').toBe(seasonHeight);
      const bare = drawn.findIndex((frame) => !frame.art);
      expect(bare, `Season frame ${bare} had no motif`).toBe(-1);
    } else {
      const alone = drawn.findIndex((frame) => frame.heading !== name || frame.body === '');
      expect(alone, `${name} frame ${alone}: ${JSON.stringify(drawn[alone])}`).toBe(-1);
    }
  }
});
