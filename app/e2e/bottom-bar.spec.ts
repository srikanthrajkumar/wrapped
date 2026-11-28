import { expect, test, type Page } from '@playwright/test';
import type { ScheduleEntry } from '../src/model';
import { finishFirstLaunch, standInKeyboard } from './helpers';

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

// The bottom stack sits on the screen's bottom edge (the Maintainer's iPhone, 2026-11-25: in a
// Safari tab on iOS 26 it sat about 85pt up once the toolbar had hidden, What's on's rows
// scrolling under the tab bar, and flickered as the page moved). Safari leaves a sticky bottom
// where the toolbar's top was (Apple developer forums 801028), so the stack is fixed to the
// screen. No browser here hides a toolbar, so these hold the stack to the edge with no field in
// hand, after one is left, through a scroll, and as the screen grows by a toolbar's height.

const DAYS = ['2026-12-19', '2026-12-20', '2026-12-21', '2026-12-22', '2026-12-23'];
const TIMES = ['09:00', '11:00', '14:00', '16:00', '18:00', '19:30'];

/** Thirty listings over five days: a What's on several screens long. */
const LONG_SCHEDULE: ScheduleEntry[] = DAYS.flatMap((date, d) =>
  TIMES.map((startTime, t) => ({
    id: `long-${d}-${t}`,
    version: 1,
    date,
    startTime,
    sabha: `Sabha ${d}${t}`,
    kind: 'concert' as const,
    title: null,
    billed: [{ name: `Singer ${d}${t}`, role: 'vocal', group: null, support: false }],
    cancelled: false,
  })),
);

async function storeSchedule(page: Page, entries: ScheduleEntry[]) {
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

/** How far the stack's foot is from the screen's: 0 when it is on the bottom edge. */
const footerLift = (page: Page) =>
  page.evaluate(() =>
    Math.round(
      window.innerHeight - document.querySelector('footer')!.getBoundingClientRect().bottom,
    ),
  );

async function openLongWhatsOn(page: Page) {
  await page.clock.setFixedTime(new Date('2026-12-19T08:00:00'));
  await page.goto('/');
  await finishFirstLaunch(page);
  await storeSchedule(page, LONG_SCHEDULE);
  await page.goto('/whats-on');
  await expect(page.getByRole('heading', { name: "What's on", exact: true })).toBeVisible();
  await expect(page.locator('footer [data-season-bar]')).toBeVisible();
}

test('the bottom stack sits on the bottom edge through a scroll, and the page ends above it', async ({
  page,
}) => {
  await openLongWhatsOn(page);
  // Fixed to the screen: a sticky stack is left up where Safari's toolbar was.
  expect(await page.locator('footer').evaluate((f) => getComputedStyle(f).position)).toBe('fixed');
  await expect.poll(() => footerLift(page)).toBe(0);

  // A page several screens long, scrolled through.
  const long = await page.evaluate(
    () => document.documentElement.scrollHeight > 2 * window.innerHeight,
  );
  expect(long).toBe(true);
  for (const to of [0.3, 0.6]) {
    await page.evaluate((by) => window.scrollBy(0, by), to * 1000);
    await expect.poll(() => footerLift(page)).toBe(0);
  }

  // At the page's end its last row stands clear above the stack.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => footerLift(page)).toBe(0);
  const last = page.getByRole('main').getByRole('listitem').last();
  await expect(last).toContainText('Singer 45');
  const lastFoot = (await last.boundingBox())!;
  const stackTop = (await page.locator('footer').boundingBox())!.y;
  expect(lastFoot.y + lastFoot.height).toBeLessThanOrEqual(stackTop);

  // The screen grows by a toolbar's height, as Safari's does when its toolbar hides.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: size.height + 85 });
  await expect.poll(() => footerLift(page)).toBe(0);
  await page.evaluate((by) => window.scrollBy(0, by), -400);
  await expect.poll(() => footerLift(page)).toBe(0);
});

test('after a search, with the field gone, the bottom stack is back on the bottom edge', async ({
  page,
}) => {
  const keyboard = await standInKeyboard(page);
  await openLongWhatsOn(page);
  await page.getByRole('button', { name: 'Find an Artist or Sabha' }).click();
  const sheet = page.getByRole('dialog', { name: 'Find an Artist or Sabha' });
  await sheet.getByRole('searchbox').fill('Singer 2');
  await keyboard(336, true);
  // A name picked closes the sheet; the phone goes on reporting the keyboard, unannounced.
  await page.keyboard.press('Enter');
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('footer [data-season-bar]')).toContainText('Singer 2');
  await expect.poll(() => footerLift(page)).toBe(0);
  await page.evaluate((by) => window.scrollBy(0, by), 300);
  await expect.poll(() => footerLift(page)).toBe(0);
});

// The room under the tabs for the home indicator (the Maintainer's iPhone, Chrome, 2026-11-28).
// In a browser tab the bottom inset is 0 while the toolbar shows and 34pt once it hides, flipped
// in one step: the whole of it left a tall empty band under the tabs, and a jump between the
// two. A tab keeps half and glides; the installed app keeps all of it. No browser here hides a
// toolbar or has a home indicator: Chromium is given the inset (DevTools' safe-area override),
// and WebKit, which has no override, the half a tab leaves of it (`--foot-room`).

type Foot = {
  /** How far the stack's foot is from the screen's. */
  lift: number;
  /** The room under the tabs. */
  room: number;
  /** How far the tabs' words end above the screen's foot. */
  words: number;
  footer: number;
  spacer: number;
};

const readFoot = () => {
  const footer = document.querySelector('footer')!;
  const tabs = footer.querySelector<HTMLElement>('nav[aria-label="Main"]')!;
  const words = Math.max(
    ...[...tabs.querySelectorAll('a')].map((link) => {
      const range = document.createRange();
      range.selectNodeContents(link);
      return range.getBoundingClientRect().bottom;
    }),
  );
  return {
    lift: Math.round(window.innerHeight - footer.getBoundingClientRect().bottom),
    room: parseFloat(getComputedStyle(tabs).paddingBottom),
    words: window.innerHeight - words,
    footer: footer.offsetHeight,
    spacer: document.querySelector<HTMLElement>('[data-footer-room]')!.offsetHeight,
  };
};

async function bottomInset(page: Page, bottom: number) {
  if (page.context().browser()?.browserType().name() === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride' as never, { insets: { bottom } } as never);
  } else {
    await page.evaluate(
      (room) => document.documentElement.style.setProperty('--foot-room', `${room}px`),
      bottom / 2,
    );
  }
}

/** The tabs' glide, slowed to 10s so it can be held halfway whatever the machine's load. */
async function slowGlide(page: Page) {
  const tabs = page.getByRole('navigation', { name: 'Main' });
  // At its own pace first: 200ms, the app's grow.
  expect(await tabs.evaluate((t) => getComputedStyle(t).transitionDuration)).toBe('0.2s');
  await page.addStyleTag({
    content: 'nav[aria-label="Main"] { transition-duration: 10s !important; }',
  });
}

/** The glide the last change began, held halfway: the foot there, and once it ends. */
async function holdHalfway(page: Page): Promise<{ half: Foot; end: Foot }> {
  await page.evaluate(`window.readFoot = ${readFoot.toString()}`);
  return page.evaluate(async () => {
    const w = window as unknown as { readFoot: () => Foot };
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    // The page's room follows the stack's on the frames after (WebKit's lag a few under load).
    const settled = async () => {
      for (let i = 0; i < 60; i++) {
        await frame();
        const foot = w.readFoot();
        if (foot.spacer === foot.footer) return foot;
      }
      return w.readFoot();
    };
    const tabs = document.querySelector<HTMLElement>('nav[aria-label="Main"]')!;
    const glide = tabs
      .getAnimations()
      .find((a) => (a as CSSTransition).transitionProperty === 'padding-bottom');
    if (!glide) throw new Error('no glide');
    glide.pause();
    glide.currentTime = 5000;
    const half = await settled();
    glide.finish();
    return { half, end: await settled() };
  });
}

/** Halfway the room is between `from` and `to`, the stack on the bottom edge, the words over it. */
function expectGlide({ half, end }: { half: Foot; end: Foot }, from: number, to: number) {
  for (const f of [half, end]) {
    expect(f.lift).toBe(0);
    expect(f.words).toBeGreaterThan(f.room);
    // The page keeps the stack's room, mid-glide too.
    expect(f.spacer).toBe(f.footer);
  }
  expect(half.room).toBeGreaterThan(Math.min(from, to));
  expect(half.room).toBeLessThan(Math.max(from, to));
  expect(end.room).toBe(to);
}

test('in a browser tab the room under the tabs is half the inset, and glides as the toolbar hides and shows', async ({
  page,
}) => {
  await openLongWhatsOn(page);
  await page.evaluate((by) => window.scrollBy(0, by), 600);
  await expect.poll(() => page.evaluate(readFoot).then((f) => f.room)).toBe(0);
  await slowGlide(page);

  // The toolbar hides: the screen grows by its height and the inset comes in one step.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: size.height + 85 });
  await bottomInset(page, 34);
  const hide = await holdHalfway(page);
  expectGlide(hide, 0, 17);
  // Clear of the home indicator (its top about 13pt over the screen's foot).
  expect(hide.end.words).toBeGreaterThanOrEqual(20);

  // The toolbar shows again.
  await page.setViewportSize(size);
  await bottomInset(page, 0);
  expectGlide(await holdHalfway(page), 17, 0);
});

test('the installed app keeps the whole inset under its tabs, with nothing to glide', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'only Chromium can be given an inset');
  await openLongWhatsOn(page);
  await page.evaluate(() => document.documentElement.setAttribute('data-ios-app', ''));
  const tabs = page.getByRole('navigation', { name: 'Main' });
  expect(await tabs.evaluate((t) => getComputedStyle(t).transitionDuration)).toBe('0s');
  await bottomInset(page, 34);
  await expect.poll(() => page.evaluate(readFoot)).toMatchObject({ room: 34, lift: 0 });
  const foot = await page.evaluate(readFoot);
  expect(foot.spacer).toBe(foot.footer);
});
