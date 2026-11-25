// Sign-in by Google's own button (T081; ADR 0001, decided 2026-11-24), against the local stack
// (playwright.server.config.ts, a build with a stand-in Google client id). Google can't run here,
// so the test serves a stand-in for Google's script that draws a button and hands back a
// credential. What it checks is the app's side:
// - Welcome draws Google's button, "Continue with Google", from the build's client id;
// - Google is given only the nonce's SHA-256, and Supabase the nonce itself, with the credential,
//   by `signInWithIdToken` in the background: the page never leaves the app, so Supabase's
//   address is never shown;
// - a refused credential is one line ("Google couldn't sign you in just now."), and the button
//   is drawn again with a fresh nonce.
// The local stack has no Google provider, so it refuses the stand-in credential, as it should.

import { expect, test } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { STAND_IN_GOOGLE_CLIENT_ID } from '../playwright.server.config';
import { readMeta } from './helpers';

const STAND_IN_GIS = `
  window.google = { accounts: { id: {
    initialize(options) {
      (window.gisInits ||= []).push({ clientId: options.client_id, nonce: options.nonce });
      window.gisCallback = options.callback;
    },
    renderButton(parent, options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = options.text === 'signin' ? 'Sign in with Google' : 'Continue with Google';
      button.onclick = () => window.gisCallback({ credential: 'stand-in.google.credential' });
      parent.append(button);
      (window.gisRenders ||= []).push(options);
    },
  } } };
`;

interface Init {
  clientId: string;
  nonce: string;
}

test('Google’s button signs in in the background, with the nonce hashed for Google', async ({
  page,
}) => {
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: STAND_IN_GIS }),
  );
  const tokenCalls: { url: string; body: Record<string, unknown> }[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/auth/v1/token')) {
      tokenCalls.push({
        url: request.url(),
        body: request.postDataJSON() as Record<string, unknown>,
      });
    }
  });
  await page.goto('/');
  const origin = new URL(page.url()).origin;
  const google = page.locator('[data-google-button]');
  await expect(google.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  const [first] = await page.evaluate(() => (window as unknown as { gisInits: Init[] }).gisInits);
  expect(first!.clientId).toBe(STAND_IN_GOOGLE_CLIENT_ID);
  expect(first!.nonce).toMatch(/^[0-9a-f]{64}$/);

  await google.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('alert')).toHaveText("Google couldn't sign you in just now.");

  // Supabase got the credential and the nonce itself, whose SHA-256 is what Google was given.
  const call = tokenCalls.find((c) => c.url.includes('grant_type=id_token'));
  expect(call?.body).toMatchObject({ provider: 'google', id_token: 'stand-in.google.credential' });
  const nonce = String(call!.body.nonce);
  expect(createHash('sha256').update(nonce).digest('hex')).toBe(first!.nonce);
  // Nothing left the app: no page of Supabase's (or anyone's) was opened.
  expect(new URL(page.url()).origin).toBe(origin);
  expect(page.context().pages()).toHaveLength(1);

  // Drawn again for the next try, with a fresh nonce.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { gisInits: Init[] }).gisInits.length))
    .toBe(2);
  const inits = await page.evaluate(() => (window as unknown as { gisInits: Init[] }).gisInits);
  expect(inits[1]!.nonce).not.toBe(first!.nonce);
  await expect(google.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('with no signal, Google’s script can’t load: one line and Try again', async ({ page }) => {
  let reachable = false;
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    reachable
      ? route.fulfill({ contentType: 'text/javascript', body: STAND_IN_GIS })
      : route.abort('internetdisconnected'),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText(
    'No signal. Sign-in needs a connection, once, on this phone.',
  );
  reachable = true;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.locator('[data-google-button]').getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
});

test('a stalled connection to Google still lets an emptied phone log: after 8 s, Try again and Start', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // Google's script neither answers nor fails, as on a congested hall connection.
  const held: (() => Promise<void>)[] = [];
  let requests = 0;
  await page.route('https://accounts.google.com/gsi/client', (route) => {
    requests += 1;
    held.push(() => route.fulfill({ contentType: 'text/javascript', body: STAND_IN_GIS }));
  });
  await page.goto('/');
  const started = Date.now();
  await expect(page.getByRole('alert')).toHaveText(
    'No signal. Sign-in needs a connection, once, on this phone.',
    { timeout: 15_000 },
  );
  expect(Date.now() - started).toBeGreaterThan(6_000);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  // Once the app itself is stored for offline, logging can start without signing in (FR-018).
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible({ timeout: 30_000 });

  // The script kept loading; when it comes, Try again draws Google's button from it.
  await held[0]!();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.locator('[data-google-button]').getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
  expect(requests).toBe(1);
});

test('a token exchange that never answers still lets the phone log, and its late answer is never kept', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: STAND_IN_GIS }),
  );
  // Google gives a credential; Supabase's token request then hangs, as on a stalled hall
  // connection.
  const held: (() => Promise<void>)[] = [];
  await page.route('**/auth/v1/token?grant_type=id_token', (route) => {
    const now = Math.floor(Date.now() / 1000);
    held.push(() =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'late.access.token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: 'late-refresh',
          user: {
            id: randomUUID(),
            aud: 'authenticated',
            role: 'authenticated',
            email: 'late@example.test',
            app_metadata: { provider: 'google' },
            user_metadata: { full_name: 'Late Rasika' },
            created_at: new Date().toISOString(),
          },
        }),
      }),
    );
  });
  await page.goto('/');
  await page
    .locator('[data-google-button]')
    .getByRole('button', { name: 'Continue with Google' })
    .click();
  const started = Date.now();
  await expect(page.getByRole('alert')).toHaveText(
    'No signal. Sign-in needs a connection, once, on this phone.',
    { timeout: 20_000 },
  );
  expect(Date.now() - started).toBeGreaterThan(8_000);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  // Logging opens without the sign-in (FR-018).
  await page.getByRole('button', { name: 'Start' }).click({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();

  // The answer comes after all: it is revoked, not kept, and the phone stays as it was.
  expect(held).toHaveLength(1);
  const revoked = page.waitForRequest(
    (request) => request.url().includes('/auth/v1/logout') && request.method() === 'POST',
  );
  await held[0]!();
  expect((await revoked).headers().authorization).toBe('Bearer late.access.token');
  expect(await readMeta(page, 'identity')).toBeUndefined();
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Share the Artists/ })).toHaveCount(0);
});
