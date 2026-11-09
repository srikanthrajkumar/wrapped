// The UI hill-climb's screenshot rig (docs/feedback/ui-hill-climb.md §2). Against a running
// production build (HC_BASE, default http://localhost:4391), it seeds the fixed dataset
// (SEED.md) once, then captures the same named views at 390×844 and 393×852 (iPhone 16), in dark
// and light, with the clock fixed, fonts loaded, the caret hidden and animations finished.
//
//   npx tsx e2e/hill-climb/rig.ts shots   <out>   views, and the §4b measurements
//   npx tsx e2e/hill-climb/rig.ts motion  <out>   frame strips of the key transitions
//   npx tsx e2e/hill-climb/rig.ts council <out> [baseline]   one sheet per view for reviewers

import { chromium, devices, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { harnessScript } from '../harness/build';
import { measure, type Measures } from './measure';
import { seed, seedSchedule, SEASON_NOW, type SeedIds } from './seed';

const BASE = process.env.HC_BASE ?? 'http://localhost:4391';
// Software WebGL, so the motif (src/motif) draws in a headless browser with no GPU.
const LAUNCH = { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] };
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '393', width: 393, height: 852 },
] as const;
const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

const catalogFile = readdirSync(new URL('../../public/catalog', import.meta.url)).find((f) =>
  /^catalog\.[0-9a-f]{64}\.json$/.test(f),
);
if (!catalogFile) throw new Error('copy the catalog snapshot into app/public/catalog first');

interface View {
  name: string;
  /** A whole scrolling page, not just the first screen. */
  full?: boolean;
  /** Types into a search, cleared after the shot so no draft is left journalled. */
  typed?: boolean;
  open(page: Page, ids: SeedIds): Promise<void>;
  /** Undoes what `open` left held after the shot, as a drag taken back to where it started. */
  release?(page: Page): Promise<void>;
}

/**
 * Open a screen as the rasika does: load home, then tap the link to each screen on the way
 * (the Concert's row, the Item's row, Add Item, a tab). A cold load counts as keyboard use, so a
 * screen's focused first block would otherwise show its focus ring.
 */
const go = async (page: Page, path: string) => {
  await page.goto(BASE + '/');
  await page.locator('main').waitFor();
  const steps = path.split('/').filter(Boolean);
  for (let i = 2; i <= steps.length; i += 2) {
    const href = '/' + steps.slice(0, i).join('/');
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL(BASE + href);
  }
  if (steps.length === 1) await page.locator(`a[href="${path}"]`).first().click();
  await page.waitForURL(BASE + path);
  await page.evaluate(() => scrollTo(0, 0));
};

let dragFrom = { x: 0, y: 0 };
const concert = (page: Page, ids: SeedIds) => go(page, `/event/${ids.full}`);
const stageRow = (page: Page, name: RegExp) =>
  page.getByRole('region', { name: 'Stage' }).getByRole('button', { name }).first();

const VIEWS: View[] = [
  { name: 'season', open: (page) => go(page, '/') },
  {
    // A screen up from the opening: the days gone above the header.
    name: 'season-up',
    open: async (page) => {
      await go(page, '/');
      // Once Season has opened at its header, which it does as its days arrive.
      await page.locator('[data-place="header"]').waitFor();
      await page.waitForFunction(() => window.scrollY > 0);
      await page.evaluate(() => window.scrollBy(0, -window.innerHeight * 0.6));
    },
  },
  {
    // A Schedule entry's sheet, from its row on the timeline.
    name: 'entry-sheet',
    open: async (page) => {
      await go(page, '/');
      await page.locator('main li > button').first().click();
      await page.getByRole('dialog').waitFor();
    },
    release: (page) => page.keyboard.press('Escape'),
  },
  { name: 'concert', open: concert },
  { name: 'concert-full', full: true, open: concert },
  { name: 'concert-bare', open: (page, ids) => go(page, `/event/${ids.bare}`) },
  { name: 'concert-long', full: true, open: (page, ids) => go(page, `/event/${ids.long}`) },
  {
    name: 'concert-order',
    full: true,
    open: async (page, ids) => {
      await concert(page, ids);
      await page.getByRole('button', { name: 'Edit order' }).click();
    },
  },
  {
    // Mid-drag: Item 3 lifted by its grip and held halfway past Item 4.
    name: 'concert-drag',
    open: async (page, ids) => {
      await concert(page, ids);
      await page.getByRole('button', { name: 'Edit order' }).click();
      const grip = page.getByRole('region', { name: 'Items' }).locator('[data-grip]').nth(2);
      await grip.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, 120));
      const box = (await grip.boundingBox())!;
      dragFrom = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(dragFrom.x, dragFrom.y);
      await page.mouse.down();
      await page.mouse.move(dragFrom.x, dragFrom.y + 44, { steps: 6 });
      await page.waitForTimeout(400);
    },
    release: async (page) => {
      await page.mouse.move(dragFrom.x, dragFrom.y, { steps: 3 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'concert-facts',
    open: async (page, ids) => {
      await concert(page, ids);
      await page.getByRole('button', { name: /6:00 pm/ }).click();
    },
  },
  {
    name: 'artist-picker',
    typed: true,
    open: async (page, ids) => {
      await concert(page, ids);
      await page
        .getByRole('region', { name: 'Stage' })
        .getByRole('button', { name: 'Add Artist' })
        .click();
      await page.getByRole('dialog').getByRole('searchbox').fill('S');
    },
  },
  {
    name: 'artist-sheet',
    open: async (page, ids) => {
      await concert(page, ids);
      await stageRow(page, /^Gayatri/).click();
    },
  },
  {
    name: 'colour-sheet',
    open: async (page, ids) => {
      await concert(page, ids);
      await stageRow(page, /^Colours for Ranjani/).click();
    },
  },
  {
    name: 'item-search',
    typed: true,
    open: async (page, ids) => {
      await go(page, `/event/${ids.full}/item/new`);
      await page.getByRole('searchbox').fill('rama');
    },
  },
  {
    name: 'item',
    full: true,
    open: (page, ids) => go(page, `/event/${ids.full}/item/${ids.laya}`),
  },
  { name: 'item-rtp', open: (page, ids) => go(page, `/event/${ids.full}/item/${ids.rtp}`) },
  {
    name: 'raga-sheet',
    open: async (page, ids) => {
      await go(page, `/event/${ids.full}/item/${ids.laya}`);
      await page.getByRole('button', { name: /^Raga 1/ }).click();
    },
  },
  {
    name: 'tala-sheet',
    open: async (page, ids) => {
      await go(page, `/event/${ids.full}/item/${ids.laya}`);
      await page.getByRole('button', { name: /^Tala/ }).click();
    },
  },
  { name: 'settings', open: (page) => go(page, '/settings') },
  {
    // Last, since it moves the clock: three hours on, the Concert in progress has ended, and its
    // summary shows on the next open (walkthrough S13). Each look shows it again: "shown" is
    // cleared for it and set for the other Concerts, so it is always this one.
    name: 'concert-summary',
    open: async (page, ids) => {
      await page.evaluate(
        ({ full, others }) =>
          new Promise<void>((resolve, reject) => {
            const open = indexedDB.open('carnatic-wrapped');
            open.onsuccess = () => {
              const tx = open.result.transaction('meta', 'readwrite');
              const meta = tx.objectStore('meta');
              meta.delete(`summaryShown:${full}`);
              for (const id of others)
                meta.put({ key: `summaryShown:${id}`, value: { eventId: id } });
              tx.oncomplete = () => {
                open.result.close();
                resolve();
              };
              tx.onerror = () => reject(tx.error);
            };
          }),
        { full: ids.full, others: [ids.long, ids.bare] },
      );
      await page.clock.setFixedTime(SEASON_NOW.getTime() + 3 * 60 * 60 * 1000);
      await page.goto(BASE + '/');
      await page.getByRole('dialog').waitFor();
    },
    release: async (page) => {
      await page.keyboard.press('Escape');
      await page.clock.setFixedTime(SEASON_NOW);
    },
  },
];

/** Let fonts, live queries and sheets settle, and blur nothing that the view focused itself. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((theme) => localStorage.setItem('wrapped.theme', theme), theme);
}

/** A phone at first launch, on Welcome, before anything is chosen. */
async function freshPhone(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const { userAgent } = devices['iPhone 15'];
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent,
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
  });
  // Never the real public-data project, whatever build HC_BASE serves (ADR 0009): the rig's
  // Schedule is the seed's (SEED.md).
  await context.route('**/functions/v1/schedule/**', (route) => route.abort());
  // Installed to the home screen, as the Maintainer uses it: no install row.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true });
    // tsx keeps function names with a helper the page doesn't have.
    (globalThis as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
  });
  await context.clock.setFixedTime(SEASON_NOW);
  const page = await context.newPage();
  page.on('crash', () => console.error('the page crashed'));
  page.on('pageerror', (error) => console.error('page error:', error.message));
  await page.goto(BASE + '/');
  return { context, page };
}

async function newPhone(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const { context, page } = await freshPhone(browser);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.getByRole('button', { name: 'Start' }).click({ timeout: 60_000 });
  await page.getByRole('heading', { name: 'Season', exact: true }).waitFor();
  // Wait until the app is ready offline, so no "Getting ready" line shows in the shots.
  await page.waitForFunction(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('carnatic-wrapped');
        open.onsuccess = () => {
          const get = open.result.transaction('meta').objectStore('meta').get('readyForOffline');
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result !== undefined);
          };
        };
      }),
    undefined,
    { timeout: 60_000 },
  );
  return { context, page };
}

async function shoot(page: Page, file: string, full = false) {
  await settle(page);
  if (!full) {
    await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
    return;
  }
  // A whole page is shot through a viewport as tall as the page, so the sticky bottom bar sits
  // at the page's end, as it does once scrolled there, not over the middle.
  // Content that loads late (a Concert's summary) makes the page taller: measure until it holds.
  const size = page.viewportSize()!;
  for (let i = 0; i < 4; i++) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    if (height === page.viewportSize()!.height) break;
    await page.setViewportSize({ width: size.width, height: Math.max(height, size.height) });
    await settle(page);
  }
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  await page.setViewportSize(size);
}

async function forEachLook(
  page: Page,
  each: (look: { theme: Theme; viewport: (typeof VIEWPORTS)[number] }) => Promise<void>,
) {
  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await each({ theme, viewport });
    }
  }
}

async function seeded(page: Page): Promise<SeedIds> {
  await page.addScriptTag({ content: await harnessScript() });
  return seed(page, catalogFile!);
}

async function shots(out: string) {
  const dir = join(out, 'shots');
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  // Welcome first, on a phone of its own that never finishes first launch.
  if (!process.env.HC_VIEWS || process.env.HC_VIEWS.split(',').includes('welcome')) {
    const fresh = await freshPhone(browser);
    // The mark drifts; with reduced motion it holds still, so every round shoots the same frame.
    await fresh.page.emulateMedia({ reducedMotion: 'reduce' });
    await forEachLook(fresh.page, async ({ theme, viewport }) => {
      await fresh.page.reload();
      await fresh.page.getByRole('button', { name: 'Continue with Google' }).waitFor();
      await shoot(fresh.page, join(dir, `welcome.${viewport.name}.${theme}.png`));
    });
    await fresh.context.close();
  }
  const { page } = await newPhone(browser);
  const measures: Record<string, Measures> = {};
  const take = async (view: View, ids: SeedIds | null) => {
    await forEachLook(page, async ({ theme, viewport }) => {
      await view.open(page, ids!);
      await shoot(page, join(dir, `${view.name}.${viewport.name}.${theme}.png`), view.full);
      await view.release?.(page);
      if (await page.getByText(/not saved/i).count())
        console.error(`${view.name}: not saved shows`);
      // Typed search text is journalled until it is cleared or picked; clear it, so the next
      // load doesn't count it as a write cut off (a "Not saved" row in every later view).
      if (view.typed) {
        await page.getByRole('searchbox').first().fill('');
        await page.waitForTimeout(1000);
      }
      if (theme === 'dark') {
        measures[`${view.name}.${viewport.name}`] = await page.evaluate(measure, !!view.full);
      }
    });
  };
  // The empty season first, before the seed goes in.
  await take({ name: 'season-empty', open: (page) => go(page, '/') }, null);
  const ids = await seeded(page);
  const only = process.env.HC_VIEWS?.split(',');
  // Season with the rasika's own Events and no Schedule yet, as before a feed is delivered.
  if (!only || only.includes('season')) {
    await take({ name: 'season-own', open: (page) => go(page, '/') }, ids);
  }
  await seedSchedule(page);
  writeFileSync(join(out, 'seed-ids.json'), JSON.stringify(ids, null, 2));
  for (const view of VIEWS) if (!only || only.includes(view.name)) await take(view, ids);
  writeFileSync(join(out, 'measures.json'), JSON.stringify(measures, null, 2));
  await browser.close();
}

/**
 * Frame strips of the key transitions, motion on: the page's animations run in slow motion
 * while frames are taken, so each frame is what the phone draws at that moment.
 */
async function motion(out: string) {
  const dir = join(out, 'motion');
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  const { page } = await newPhone(browser);
  const ids = await seeded(page);
  await seedSchedule(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');

  const strips: { name: string; before(theme: Theme): Promise<void>; act(): Promise<void> }[] = [
    {
      name: 'sheet-open',
      before: () => concert(page, ids),
      act: () => stageRow(page, /^Colours for Embar/).click(),
    },
    {
      name: 'colour-pick',
      before: async () => {
        await concert(page, ids);
        await stageRow(page, /^Colours for Embar/).click();
        await settle(page);
      },
      act: () => page.getByRole('dialog').getByRole('radio', { name: 'Green' }).click(),
    },
    {
      name: 'laya-mark',
      // Each theme marks its own Item, since marking one changes it.
      before: async (theme) => {
        await concert(page, ids);
        await page.getByRole('link', { name: theme === 'dark' ? /Vatapi/ : /Endaro/ }).click();
        await page.getByRole('button', { name: 'Improvised', exact: true }).click();
        await settle(page);
      },
      act: () => page.getByRole('button', { name: 'Laya vinyasam', exact: true }).click(),
    },
    {
      // A sheet slides back down the way it came (walkthrough P8, FB-44).
      name: 'sheet-close',
      before: async () => {
        await concert(page, ids);
        await stageRow(page, /^Colours for Embar/).click();
        await settle(page);
      },
      act: () => page.keyboard.press('Escape'),
    },
    {
      // The "⋯" menu fades and scales in (walkthrough P9, FB-38).
      name: 'menu-open',
      before: () => concert(page, ids),
      act: () => page.getByRole('button', { name: 'Concert actions' }).click(),
    },
    {
      // A fold closes with the height it opened with (walkthrough P8).
      name: 'fold-close',
      before: () => concert(page, ids),
      act: () => page.getByRole('button', { name: 'Note', exact: true }).click(),
    },
    {
      name: 'add-item',
      before: () => concert(page, ids),
      act: () => page.getByRole('link', { name: 'Add Item' }).click(),
    },
    {
      name: 'item-done',
      before: async () => {
        await go(page, `/event/${ids.full}/item/${ids.rtp}`);
        await settle(page);
      },
      act: () => page.getByRole('link', { name: 'Done' }).click(),
    },
  ];

  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const strip of strips) {
      await strip.before(theme);
      await settle(page);
      const frames: { label: string; png: Buffer }[] = [];
      frames.push({ label: 'before', png: await page.screenshot({ caret: 'hide' }) });
      // Slow motion, in real time: every animation runs at 4% speed while frames are taken,
      // each labelled with its moment in the animation.
      await cdp.send('Animation.setPlaybackRate', { playbackRate: SLOW });
      await strip.act();
      await page.waitForTimeout(150);
      const timing = () =>
        page.evaluate(() => {
          const running = document.getAnimations().filter((a) => a.playState === 'running');
          return {
            at: Math.max(-1, ...running.map((a) => Number(a.currentTime ?? 0))),
            end: Math.max(
              0,
              ...running.map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0)),
            ),
          };
        });
      const { end } = await timing();
      // Dense early, where the short animations are, then out to the longest one's end.
      for (const target of [0, 60, 120, 180, 300, 600, end]) {
        const { at } = await timing();
        if (at < 0) break;
        if (target > at) await page.waitForTimeout((target - at) / SLOW);
        const now = await timing();
        if (now.at < 0) break;
        frames.push({
          label: `${Math.round(now.at)} ms`,
          png: await page.screenshot({ caret: 'hide' }),
        });
      }
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
      await page.waitForTimeout(Math.min(end, 1500) + 200);
      frames.push({ label: 'settled', png: await page.screenshot({ caret: 'hide' }) });
      await compose(
        browser,
        frames.map((f) => ({ label: f.label, src: dataUrl(f.png) })),
        join(dir, `${strip.name}.${theme}.png`),
        `${strip.name} (${theme})${end > 0 ? `, ${Math.round(end)} ms of animation` : ', no animation'}`,
        200,
      );
    }
  }
  await browser.close();
}

/** The animation speed motion strips are taken at. */
const SLOW = 0.04;

const dataUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;

/** Lay images side by side, labelled, as one PNG, drawn by the browser itself. */
async function compose(
  browser: Browser,
  images: { label: string; src: string }[],
  file: string,
  title: string,
  width = 393,
) {
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  const cells = images
    .map(
      ({ label, src }) =>
        `<figure><figcaption>${label}</figcaption><img src="${src}" width="${width}"></figure>`,
    )
    .join('');
  await page.setContent(
    `<style>body{margin:0;padding:12px;background:#777;font:600 15px system-ui;color:#fff;display:inline-block}
     h1{font-size:16px;margin:0 0 8px}div{display:flex;gap:12px;align-items:flex-start}
     figure{margin:0}figcaption{margin-bottom:4px}img{display:block;outline:1px solid #0006}</style>
     <h1>${title}</h1><div>${cells}</div>`,
  );
  await page.evaluate(() =>
    Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))),
  );
  await page.locator('body').screenshot({ path: file });
  await page.close();
}

/**
 * One sheet per view for the council: dark and light at the iPhone 16's size, with the
 * baseline's beside them from round 01.
 */
async function council(out: string, baseline?: string) {
  const dir = join(out, 'council');
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  // Only the views this round shot (HC_VIEWS may have narrowed it).
  const views = ['welcome', 'season-empty', 'season-own', ...VIEWS.map((v) => v.name)].filter(
    (view) => existsSync(join(out, 'shots', `${view}.393.dark.png`)),
  );
  const png = (root: string, view: string, theme: Theme) =>
    dataUrl(readFileSync(join(root, 'shots', `${view}.393.${theme}.png`)));
  for (const view of views) {
    const images = THEMES.flatMap((theme) =>
      baseline
        ? [
            { label: `baseline · ${theme}`, src: png(baseline, view, theme) },
            { label: `this round · ${theme}`, src: png(out, view, theme) },
          ]
        : [{ label: theme, src: png(out, view, theme) }],
    );
    await compose(browser, images, join(dir, `${view}.png`), view, baseline ? 300 : 393);
  }
  await browser.close();
}

const [mode, out, baseline] = process.argv.slice(2);
if (!mode || !out) throw new Error('usage: rig.ts shots|motion|council <out> [baseline]');
const run = { shots, motion, council: (o: string) => council(o, baseline) }[mode];
if (!run) throw new Error(`unknown mode ${mode}`);
await run(out);
