// Required test (constitution IV, "restore onto an empty device"; T080, SC-003, FR-017, FR-018),
// against the local Supabase stack (playwright.server.config.ts; run by `npm run test:server`).
//
// A rasika signs up through first launch (a password user stands in for Google, which can't run
// locally) and logs a season, with Unresolved values, a deleted Item and a reorder, that syncs.
// The phone's store is then wiped. Offline, it still logs: one more Item, in a new Concert.
// Back online it signs in from the prompt, answers the two questions again, and must end with
// the Item it logged offline kept, both on the phone and on the server, and the whole season
// back exactly as it was.
//
// The logging goes through the store actions the screens call, injected from e2e/harness, as in
// offline-concert.spec.ts; sign-in, consent, restore, IndexedDB, the service worker and the
// offline state are the real app's.

import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { harnessScript } from './harness/build';
import type { Harness } from './harness/entry';
import { readMeta } from './helpers';

interface Stack {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
}
const stack = JSON.parse(process.env.WRAPPED_STACK ?? 'null') as Stack | null;
if (!stack) throw new Error('Run with playwright.server.config.ts, which finds the local stack');

const admin = createClient(stack.apiUrl, stack.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const server = postgres(stack.dbUrl, { onnotice: () => {}, max: 1 });
test.afterAll(async () => {
  await server.end();
});

/** Everything of the season the phone holds, in a stable order, to compare before and after. */
function readSeason(page: Page) {
  return page.evaluate(async () => {
    const { db } = (globalThis as unknown as { harness: Harness }).harness;
    const byId = <T extends { id: string }>(rows: T[]) =>
      rows.sort((a, b) => a.id.localeCompare(b.id));
    return {
      events: byId(await db.events.toArray()),
      appearances: byId(await db.appearances.toArray()),
      items: byId(await db.items.toArray()),
      artists: byId(await db.artists.toArray()),
      sabhas: byId(await db.sabhas.toArray()),
    };
  });
}

async function withHarness(page: Page) {
  await page.addScriptTag({ content: await harnessScript() });
}

/** Wait until the phone has nothing left to send and has finished a sync. */
async function synced(page: Page, after = '') {
  await expect
    .poll(
      async () => {
        // A sync as the app starts one when it is shown again (FR-014).
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        const outbox = await page.evaluate(() =>
          (globalThis as unknown as { harness: Harness }).harness.db.outbox.count(),
        );
        const last = ((await readMeta(page, 'lastSyncedAt')) as string | undefined) ?? '';
        return outbox === 0 && last > after;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

test('an emptied phone logs offline, then signs in and gets its whole season back (SC-003)', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const email = `restore-${randomUUID()}@example.test`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  await context.addInitScript(
    (credentials) => {
      (globalThis as { __WRAPPED_TEST_SIGNIN__?: unknown }).__WRAPPED_TEST_SIGNIN__ = credentials;
    },
    { email, password },
  );

  // First launch: sign-in, the two questions (nothing pre-selected), then "Ready to log offline".
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(
    page.getByRole('heading', { name: /^Share the Artists, Sabhas and Concerts/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Include your season/ })).toBeVisible();
  await page.getByRole('button', { name: 'No', exact: true }).click();
  await page.getByRole('button', { name: 'Start' }).click({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await withHarness(page);

  // A season: a Concert with a Sabha, an Artist, Items with an Unresolved value and a "?", one
  // Item deleted and two reordered, and a second Concert.
  await page.evaluate(async () => {
    const { events, items, people, model } = (globalThis as unknown as { harness: Harness })
      .harness;
    const sabha = await people.createSabha('Narada Gana Sabha');
    const concert = await events.createEvent({
      kind: 'concert',
      startTime: '18:45',
      sabhaId: sabha.id,
    });
    const artist = await people.createArtist('Ranjani');
    await people.addAppearance(concert.id, artist.id, { role: 'vocal', colourPrimary: 'red' });
    const typed = await items.addItem(concert.id, { title: 'Bhaja Govindam' });
    await items.setDetail(typed.id, 'composer', model.unresolvedValue('Adi Sankara'), {});
    await items.setRagas(typed.id, [model.unknownValue()], {});
    const second = await items.addItem(concert.id, { title: 'Second piece' });
    await items.removeItem((await items.addItem(concert.id, { title: 'Gone' })).id);
    await items.moveItem(second.id, 0);
    const lecdem = await events.createEvent({
      kind: 'lecdem',
      startTime: '09:30',
      title: 'Tisra nadai in kritis',
    });
    await items.addItem(lecdem.id, { title: 'Demonstrated' });
  });
  await synced(page);
  const season = await readSeason(page);
  expect(season.items.filter((item) => !item.deletedAt)).toHaveLength(3);

  // The phone's store is wiped (iOS evicting it, or "Clear website data"); the app's own files
  // stay in the service worker's cache. Then no signal.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Storage.clearDataForOrigin', {
    origin: new URL(page.url()).origin,
    storageTypes: 'indexeddb',
  });
  await context.setOffline(true);
  await page.reload();

  // Sign-in can't happen with no signal, and logging still can (FR-018).
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'No signal. Sign-in needs a connection, once, on this phone.',
  );
  await page.getByRole('button', { name: 'Start' }).click({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await withHarness(page);
  const offline = await page.evaluate(async () => {
    const { events, items, model } = (globalThis as unknown as { harness: Harness }).harness;
    const concert = await events.createEvent({ kind: 'concert', startTime: '16:00' });
    const item = await items.addItem(concert.id, { title: 'Logged with no signal' });
    await items.setDetail(item.id, 'language', model.unresolvedValue('Telugu?'), {});
    return { eventId: concert.id, itemId: item.id };
  });

  // Signal returns: the prompt asks for sign-in, and logging never waited for it.
  await context.setOffline(false);
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  // The app shown again: a sync starts, as it does on `online` (FR-014).
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const prompt = page.locator('[data-sync-prompt]');
  await expect(prompt).toContainText('Sign in again to keep backing up. Logging still works.');
  const before = new Date().toISOString();
  await prompt.getByRole('button', { name: 'Sign in' }).click();
  // Signed in after first launch, the two questions come once more, with nothing pre-selected.
  await expect(
    page.getByRole('heading', { name: /^Share the Artists, Sabhas and Concerts/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'No', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Include your season/ })).toBeVisible();
  await page.getByRole('button', { name: 'No', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await withHarness(page);
  await synced(page, before);

  // On the phone: the season as it was, and the offline Item kept.
  const restored = await readSeason(page);
  const without = <T extends { id: string }>(rows: T[], id: string) =>
    rows.filter((row) => row.id !== id);
  expect({
    ...restored,
    events: without(restored.events, offline.eventId),
    items: without(restored.items, offline.itemId),
  }).toEqual(season);
  expect(restored.items.find((item) => item.id === offline.itemId)).toMatchObject({
    title: 'Logged with no signal',
    language: { state: 'unresolved', text: 'Telugu?' },
  });

  // On the server: the offline Item reached it, and the answers given last stand.
  const [rasika] = await server<
    { id: string; share_additions: boolean; season_reports: boolean }[]
  >`select id, share_additions, season_reports from private.rasika where auth_user_id = ${userId}`;
  expect(rasika).toMatchObject({ share_additions: false, season_reports: false });
  const [item] = await server<{ data: { title: string } }[]>`
    select data from private.items where rasika_id = ${rasika!.id} and id = ${offline.itemId}`;
  expect(item?.data.title).toBe('Logged with no signal');
});
