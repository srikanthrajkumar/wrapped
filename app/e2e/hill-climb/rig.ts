// The UI hill-climb's screenshot rig (docs/feedback/ui-hill-climb.md §2). Against a running
// production build (HC_BASE, default http://localhost:4391), it seeds the fixed dataset
// (SEED.md) once, then captures the same named views at 390×844 and 393×852 (iPhone 16), in dark
// and light, with the clock fixed, fonts loaded, the caret hidden and animations finished.
//
//   npx tsx e2e/hill-climb/rig.ts shots   <out>   views, and the §4b measurements
//   npx tsx e2e/hill-climb/rig.ts motion  <out>   frame strips of the key transitions
//   npx tsx e2e/hill-climb/rig.ts council <out> [baseline]   one sheet per view for reviewers

import { chromium, devices, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { harnessScript } from '../harness/build';
import { measure, type Measures } from './measure';
import { seed, SEASON_NOW, type SeedIds } from './seed';

const BASE = process.env.HC_BASE ?? 'http://localhost:4391';
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
};

const concert = (page: Page, ids: SeedIds) => go(page, `/event/${ids.full}`);
const stageRow = (page: Page, name: RegExp) =>
  page.getByRole('region', { name: 'Stage' }).getByRole('button', { name }).first();

const VIEWS: View[] = [
  { name: 'season', open: (page) => go(page, '/') },
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

async function newPhone(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
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
  const browser = await chromium.launch();
  const { page } = await newPhone(browser);
  const measures: Record<string, Measures> = {};
  const take = async (view: View, ids: SeedIds | null) => {
    await forEachLook(page, async ({ theme, viewport }) => {
      await view.open(page, ids!);
      await shoot(page, join(dir, `${view.name}.${viewport.name}.${theme}.png`), view.full);
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
  writeFileSync(join(out, 'seed-ids.json'), JSON.stringify(ids, null, 2));
  const only = process.env.HC_VIEWS?.split(',');
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
  const browser = await chromium.launch();
  const { page } = await newPhone(browser);
  const ids = await seeded(page);
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
        await page.getByRole('button', { name: 'Laya vinyasam', exact: true }).click();
        await settle(page);
      },
      act: () => page.getByRole('button', { name: /Laya vinyasam after this Item/ }).click(),
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
      for (let i = 0; i < 8; i++) {
        const { at } = await timing();
        if (at < 0) break;
        frames.push({
          label: `${Math.round(at)} ms`,
          png: await page.screenshot({ caret: 'hide' }),
        });
        await page.waitForTimeout(Math.max(100, end / SLOW / 6));
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
  const browser = await chromium.launch();
  const views = ['season-empty', ...VIEWS.map((v) => v.name)];
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
