// Settings' Account row and the Account page (DESIGN.md "Settings", 2026-11-28), against the
// local Supabase stack (playwright.server.config.ts; run by `npm run test:server`): the first
// view shows who is signed in as one row, and neither the deletion contact nor "Sign out other
// devices"; the Account page, one tap in, holds them both, and Privacy under it.
//
// Sign-in is a password user standing in for Google, as in restore.spec.ts.

import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { openSettings } from './helpers';

interface Stack {
  apiUrl: string;
  serviceRoleKey: string;
}
const stack = JSON.parse(process.env.WRAPPED_STACK ?? 'null') as Stack | null;
if (!stack) throw new Error('Run with playwright.server.config.ts, which finds the local stack');

const admin = createClient(stack.apiUrl, stack.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** The address production's server gives; the local stack may have none set. */
const CONTACT = 'privacy@carnatic.live';

test('the first view has one Account row; deletion and signing out others are on its page', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const email = `account-${randomUUID()}@example.test`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Meera Raghavan' },
  });
  if (created.error) throw created.error;
  try {
    await context.addInitScript(
      (credentials) => {
        (globalThis as { __WRAPPED_TEST_SIGNIN__?: unknown }).__WRAPPED_TEST_SIGNIN__ = credentials;
      },
      { email, password },
    );
    // The server's account, with the deletion contact production has.
    await context.route('**/rest/v1/rpc/me', async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as Record<string, unknown> | null;
      await route.fulfill({ response, json: body && { ...body, deletionContact: CONTACT } });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    await page.getByRole('button', { name: 'Start' }).click({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();

    // The first view: one row naming who is signed in, and nothing else of the account.
    await openSettings(page);
    const account = page.getByRole('link', { name: `Meera Raghavan ${email}` });
    await expect(account).toBeVisible();
    await expect(page.getByText(/delete/i)).toHaveCount(0);
    await expect(page.getByText(CONTACT)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign out other devices' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toHaveCount(0);

    // The Account page: who, "Sign out other devices", Privacy, and the deletion contact as a
    // mailto: with its subject and the account named.
    await account.click();
    await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out other devices' })).toBeVisible();
    const deletion = page.getByRole('link', { name: `Request account deletion Email ${CONTACT}` });
    await expect(deletion).toBeVisible();
    const href = new URL((await deletion.getAttribute('href'))!);
    expect(href.protocol).toBe('mailto:');
    expect(href.pathname).toBe(CONTACT);
    expect(href.searchParams.get('subject')).toBe('Delete my carnatic.live account');
    expect(href.searchParams.get('body')).toContain(email);

    // Privacy under it, and back to Account, then to Settings.
    await page.getByRole('link', { name: 'Privacy', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Privacy', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Account', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  } finally {
    await admin.auth.admin.deleteUser(created.data.user.id);
  }
});
