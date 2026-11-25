// The phone's account paths against the local stack (T079, T081-T083): consent answers and the
// writer claim, kept on the phone first, reach the server with the next sync; a phone that takes
// writing back pushes everything it queued; and "Sign out other devices" ends the other phone's
// session, not this one's. Google's button can't run here, so each phone signs in through the
// phone's own sign-in with a password user (auth-client.test.ts does the same).

import 'fake-indexeddb/auto';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { answerConsent, readConsent, requestClaim, sendConsent } from '../../app/src/store/account';
import {
  getSyncApi,
  readIdentity,
  signIn,
  signOutOtherDevices,
  supabaseClient,
  type AuthConfig,
  type SignInAnswer,
} from '../../app/src/store/auth';
import { WrappedDB } from '../../app/src/store/db';
import { save } from '../../app/src/store/mutate';
import { syncOnce, type SyncLock } from '../../app/src/store/sync';
import { SyncError } from '../../app/src/store/sync-api';
import { APP_VERSION, db as server, newEvent } from './server';

const stack = inject('stack');
const admin = createClient(stack.apiUrl, stack.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const config: AuthConfig = { url: stack.apiUrl, anonKey: stack.anonKey, appVersion: APP_VERSION };
const noLock: SyncLock = (_name, work) => work();

const open: WrappedDB[] = [];
afterEach(async () => {
  for (const phone of open.splice(0)) await phone.delete();
});

function phone(): WrappedDB {
  const store = new WrappedDB(`account-client-${randomUUID()}`);
  open.push(store);
  return store;
}

async function newUser() {
  const email = `account-${randomUUID()}@example.test`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  return { email, password, userId: created.data.user.id };
}

/** Signed in on `store` through the phone's own sign-in, which keeps the session only then. */
async function signInPhone(store: WrappedDB, user: { email: string; password: string }) {
  await signIn((candidate) => candidate.auth.signInWithPassword(user), {
    config,
    db: store,
    lock: noLock,
  });
  return (await getSyncApi({ config, db: store }))!;
}

async function rasikaOf(userId: string) {
  const [row] = await server<
    {
      id: string;
      share_additions: boolean | null;
      season_reports: boolean | null;
      writer_device_id: string | null;
    }[]
  >`select id, share_additions, season_reports, writer_device_id from private.rasika
    where auth_user_id = ${userId}`;
  return row!;
}

describe('the account on the phone, against the server', () => {
  it('keeps the session signed in on the phone, claims, and syncs with it', async () => {
    const user = await newUser();
    const store = phone();
    const api = await signInPhone(store, user);
    expect(api).not.toBeNull();
    expect((await readIdentity(store))?.userId).toBe(user.userId);

    await requestClaim(store);
    await save('events', newEvent({ note: 'first Concert' }), { db: store });
    await syncOnce(api, { db: store });
    const rasika = await rasikaOf(user.userId);
    expect(rasika.writer_device_id).not.toBeNull();
    const [counted] = await server<{ count: number }[]>`
      select count(*)::int as count from private.events where rasika_id = ${rasika.id}`;
    expect(counted?.count).toBe(1);
  });

  it('carries consent answers given on the phone, each change logged once', async () => {
    const user = await newUser();
    const store = phone();
    const api = await signInPhone(store, user);
    expect(await rasikaOf(user.userId)).toMatchObject({
      share_additions: null,
      season_reports: null,
    });

    await answerConsent('shareAdditions', false, store);
    await answerConsent('seasonReports', true, store);
    await syncOnce(api, { db: store });
    const rasika = await rasikaOf(user.userId);
    expect(rasika).toMatchObject({ share_additions: false, season_reports: true });

    // Turned off later, from Settings: it takes effect from then on.
    await answerConsent('seasonReports', false, store);
    await syncOnce(api, { db: store });
    expect(await rasikaOf(user.userId)).toMatchObject({ season_reports: false });
    const events = await server<{ id: string }[]>`
      select id from private.consent_event where rasika_id = ${rasika.id}`;
    expect(events).toHaveLength(3);
  });

  it('a former writer gets not_writer, then takes writing back and pushes all it queued (D6)', async () => {
    const user = await newUser();
    const old = phone();
    const oldApi = await signInPhone(old, user);
    await requestClaim(old);
    await syncOnce(oldApi, { db: old });

    // A second device signs in and claims.
    const second = phone();
    const secondApi = await signInPhone(second, user);
    await requestClaim(second);
    await syncOnce(secondApi, { db: second });

    const queued = [newEvent({ note: 'a' }), newEvent({ note: 'b' })];
    for (const event of queued) await save('events', event, { db: old });
    const refused = await syncOnce(oldApi, { db: old }).catch((e: unknown) => e);
    expect((refused as SyncError).failure.kind).toBe('not_writer');
    expect(await old.outbox.count()).toBe(2);

    await requestClaim(old);
    await syncOnce(oldApi, { db: old });
    expect(await old.outbox.count()).toBe(0);
    const rasika = await rasikaOf(user.userId);
    const stored = await server<{ id: string }[]>`
      select id from private.events where rasika_id = ${rasika.id}`;
    expect(stored.map((row) => row.id).sort()).toEqual(queued.map((e) => e.id).sort());
  });

  it('a phone that is no longer the writer still sends a consent change at once (account data)', async () => {
    const user = await newUser();
    const old = phone();
    const oldApi = await signInPhone(old, user);
    await answerConsent('seasonReports', true, old);
    await requestClaim(old);
    await syncOnce(oldApi, { db: old });
    const second = phone();
    const secondApi = await signInPhone(second, user);
    await requestClaim(second);
    await syncOnce(secondApi, { db: second });
    await save('events', newEvent(), { db: old });
    const refused = await syncOnce(oldApi, { db: old }).catch((e: unknown) => e);
    expect((refused as SyncError).failure.kind).toBe('not_writer');

    await answerConsent('seasonReports', false, old);
    await sendConsent(async () => oldApi, old, { lock: noLock });
    expect(await rasikaOf(user.userId)).toMatchObject({ season_reports: false });
    expect(await old.outbox.count()).toBe(1);
  });

  it('another account signing in first sends the last one’s waiting withdrawal, as the last one', async () => {
    const a = await newUser();
    const b = await newUser();
    const store = phone();
    const apiA = await signInPhone(store, a);
    await answerConsent('seasonReports', true, store);
    await syncOnce(apiA, { db: store });
    expect(await rasikaOf(a.userId)).toMatchObject({ season_reports: true });
    // Turned off with no signal; then B signs in on this phone, which holds no season.
    await answerConsent('seasonReports', false, store);

    await signInPhone(store, b);
    expect(await rasikaOf(a.userId)).toMatchObject({ season_reports: false });
    expect((await readIdentity(store))?.userId).toBe(b.userId);
    expect(await readConsent(store)).toEqual({ shareAdditions: null, seasonReports: null });
  });

  it('a sign-in answered after its deadline is never kept, and its session is revoked', async () => {
    const user = await newUser();
    const store = phone();
    let answer!: (value: SignInAnswer) => void;
    const refused = await signIn(() => new Promise<SignInAnswer>((resolve) => (answer = resolve)), {
      config,
      db: store,
      lock: noLock,
      deadlineMs: 50,
    }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(TypeError);

    // The server's answer arrives late: a real session.
    const other = createClient(stack.apiUrl, stack.anonKey, { auth: { persistSession: false } });
    const late = (await other.auth.signInWithPassword(user)) as SignInAnswer;
    answer(late);
    const refresh = late.data.session!.refresh_token;
    await expect
      .poll(async () => (await other.auth.refreshSession({ refresh_token: refresh })).error)
      .not.toBeNull();
    expect(await readIdentity(store)).toBeNull();
    expect(await store.meta.count()).toBe(0);
  });

  it('"Sign out other devices" ends the other phone’s session and keeps this one’s', async () => {
    const user = await newUser();
    const lost = phone();
    await signInPhone(lost, user);
    const here = phone();
    await signInPhone(here, user);

    await signOutOtherDevices({ config, db: here });

    const lostClient = await supabaseClient(config, lost);
    const refreshed = await lostClient.auth.refreshSession();
    expect(refreshed.error).not.toBeNull();
    const hereClient = await supabaseClient(config, here);
    const kept = await hereClient.auth.refreshSession();
    expect(kept.error).toBeNull();
    // The lost phone's season and identity stay on it, for its own Export.
    expect(await readIdentity(lost)).not.toBeNull();
  });
});
