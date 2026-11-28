// Required test (FR-042, FR-049; privacy), against the local Supabase stack
// (playwright.server.config.ts; run by `npm run test:server`). Consent is account data, not a
// season change: a phone that another phone has taken writing from still turns a consent off on
// the server, from Settings, at once; and a "No" given there with no signal is sent when signal
// returns, though sync stays stopped. The season it holds waits, as it should.
//
// Sign-in is a password user standing in for Google, as in restore.spec.ts; the logging goes
// through the store actions the screens call (e2e/harness). Settings, its consent tracks, the
// sync loop and its triggers are the real app's.

import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { harnessScript } from './harness/build';
import type { Harness } from './harness/entry';
import { openSettings } from './helpers';

interface Stack {
  apiUrl: string;
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

const SHARE = /^Help us keep the app's lists complete/;
const REPORTS = /^Count your concerts in the December season totals/;

async function logConcert(page: Page) {
  await page.evaluate(async () => {
    const { events } = (globalThis as unknown as { harness: Harness }).harness;
    await events.createEvent({ kind: 'concert', startTime: '18:45' });
  });
}

function outbox(page: Page) {
  return page.evaluate(() =>
    (globalThis as unknown as { harness: Harness }).harness.db.outbox.count(),
  );
}

test('a phone that is no longer the writer still turns consent off, at once or when signal returns', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const email = `consent-${randomUUID()}@example.test`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  const consentOnServer = async () => {
    const [rasika] = await server<{ share_additions: boolean; season_reports: boolean }[]>`
      select share_additions, season_reports from private.rasika where auth_user_id = ${userId}`;
    return rasika;
  };
  await context.addInitScript(
    (credentials) => {
      (globalThis as { __WRAPPED_TEST_SIGNIN__?: unknown }).__WRAPPED_TEST_SIGNIN__ = credentials;
    },
    { email, password },
  );

  // Signed up, both questions answered Yes, and a Concert logged and backed up.
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: SHARE })).toBeVisible();
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(page.getByRole('heading', { name: REPORTS })).toBeVisible();
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await page.getByRole('button', { name: 'Start' }).click({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await page.addScriptTag({ content: await harnessScript() });
  await logConcert(page);
  await expect
    .poll(async () => {
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      return outbox(page);
    })
    .toBe(0);
  await expect.poll(consentOnServer).toMatchObject({ share_additions: true, season_reports: true });

  // Another phone takes writing. The next Concert is refused, and sync stops for the rasika.
  await server`update private.rasika set writer_device_id = gen_random_uuid()
    where auth_user_id = ${userId}`;
  await logConcert(page);
  await expect(page.locator('[data-sync-prompt]')).toContainText(
    'Your season is now being logged on another phone.',
  );

  // From the Privacy page under Account (not on Settings' first view), "No" to season reports
  // reaches the server at once.
  await openSettings(page);
  await expect(page.getByRole('radiogroup', { name: REPORTS })).toHaveCount(0);
  await page.getByRole('link', { name: email }).click();
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Privacy', exact: true })).toBeVisible();
  const reports = page.getByRole('radiogroup', { name: REPORTS });
  await reports.getByRole('radio', { name: 'No' }).click();
  await expect(reports.getByRole('radio', { name: 'No' })).toHaveAttribute('aria-checked', 'true');
  await expect
    .poll(consentOnServer)
    .toMatchObject({ share_additions: true, season_reports: false });

  // With no signal, "No" to sharing is kept on the phone, then sent when signal returns.
  await context.setOffline(true);
  const share = page.getByRole('radiogroup', { name: SHARE });
  await share.getByRole('radio', { name: 'No' }).click();
  await expect(share.getByRole('radio', { name: 'No' })).toHaveAttribute('aria-checked', 'true');
  expect(await consentOnServer()).toMatchObject({ share_additions: true });
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect
    .poll(consentOnServer)
    .toMatchObject({ share_additions: false, season_reports: false });

  // The season waits for "Make this the writing device again".
  expect(await outbox(page)).toBe(1);
  await expect(page.locator('[data-sync-prompt]')).toContainText('another phone');
});
