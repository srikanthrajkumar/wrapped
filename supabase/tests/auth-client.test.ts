// The phone's own Supabase client (T077) against the local stack: the session lives in the
// phone's store, every call carries the app's version, a restarted app finds its session there,
// and an ended session stops sync without touching the season. Google's button can't run
// here, so the session comes from a password sign-in on the same client.

import 'fake-indexeddb/auto';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, inject, it } from 'vitest';
import {
  AUTH_STORAGE_PREFIX,
  getSyncApi,
  metaStorage,
  readIdentity,
  signIn as signInOnPhone,
  supabaseClient,
  type AuthConfig,
} from '../../app/src/store/auth';
import { WrappedDB } from '../../app/src/store/db';
import { save } from '../../app/src/store/mutate';
import { DEVICE_ID_KEY, syncOnce, type SyncLock } from '../../app/src/store/sync';
import { SyncError } from '../../app/src/store/sync-api';
import { APP_VERSION, db as server, newEvent } from './server';

const stack = inject('stack');
const admin = createClient(stack.apiUrl, stack.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const open: WrappedDB[] = [];
afterEach(async () => {
  for (const phone of open.splice(0)) await phone.delete();
});

function phone(name = `auth-client-${randomUUID()}`): WrappedDB {
  const store = new WrappedDB(name);
  open.push(store);
  return store;
}

function config(appVersion = APP_VERSION): AuthConfig {
  return { url: stack.apiUrl, anonKey: stack.anonKey, appVersion };
}

// Node has no Web Locks; these tests run one sign-in or sync at a time.
const noLock: SyncLock = (_name, work) => work();

/** A new user, signed in on `store` by the phone's own sign-in, as it leaves the phone. */
async function signIn(store: WrappedDB, settings = config()) {
  const email = `phone-${randomUUID()}@example.test`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Phone Rasika' },
  });
  if (created.error) throw created.error;
  await signInOnPhone((candidate) => candidate.auth.signInWithPassword({ email, password }), {
    config: settings,
    db: store,
    lock: noLock,
  });
  const client = await supabaseClient(settings, store);
  const deviceId = randomUUID();
  await store.meta.put({ key: DEVICE_ID_KEY, value: deviceId });
  return { client, userId: created.data.user.id, deviceId };
}

describe('the phone’s Supabase client', () => {
  it('keeps the session in the store and syncs with it, including after a restart', async () => {
    const store = phone();
    const { userId, deviceId } = await signIn(store);
    const saved = (await store.meta.where('key').startsWith(AUTH_STORAGE_PREFIX).toArray()).map(
      (row) => row.key,
    );
    expect(saved.length).toBeGreaterThan(0);

    const api = (await getSyncApi({ config: config(), db: store }))!;
    await api.claim({ deviceId, label: 'Phone' });
    const event = newEvent({ note: 'logged' });
    await save('events', event, { db: store });
    await syncOnce(api, { db: store });

    // A restart: the same store opened again, with a new client that reads the session from it.
    const name = store.name;
    store.close();
    const reopened = phone(name);
    const again = await getSyncApi({ config: config(), db: reopened });
    expect(again).not.toBeNull();
    await save('events', { ...event, note: 'after a restart' }, { db: reopened });
    await syncOnce(again!, { db: reopened });

    const [row] = await server<{ data: { note: string } }[]>`
      select e.data from private.events e join private.rasika r on r.id = e.rasika_id
      where r.auth_user_id = ${userId} and e.id = ${event.id}`;
    expect(row?.data.note).toBe('after a restart');
  });

  it('sends the app’s version on every call, so an old app gets 426 and keeps its outbox', async () => {
    const store = phone();
    await signIn(store, config('0.0.9'));
    await save('events', newEvent(), { db: store });
    const api = (await getSyncApi({ config: config('0.0.9'), db: store }))!;

    const failure = await syncOnce(api, { db: store }).catch((e: unknown) => e);
    // The server's minimum as the migrations leave it, raised with each change of record shape.
    const [minimum] = await server<{ min_app_version: string }[]>`
      select min_app_version from private.server_config`;

    expect(failure).toBeInstanceOf(SyncError);
    expect((failure as SyncError).failure).toEqual({
      kind: 'update_required',
      minimumVersion: minimum!.min_app_version,
    });
    expect(await store.outbox.count()).toBe(1);
  });

  it('an ended session gives no server and leaves the season, the outbox and the identity', async () => {
    const store = phone();
    const { client } = await signIn(store);
    await save('events', newEvent(), { db: store });
    // The session ends on the server (as "sign out other devices" does), and the access token
    // has expired by the time the phone next syncs.
    const { data } = await client.auth.getSession();
    await admin.auth.admin.signOut(data.session!.access_token, 'global');
    const stored = JSON.parse((await metaStorage(store).getItem('wrapped-session'))!) as {
      expires_at: number;
    };
    stored.expires_at = Math.floor(Date.now() / 1000) - 60;
    await metaStorage(store).setItem('wrapped-session', JSON.stringify(stored));
    const fresh = phone(store.name);
    store.close();

    expect(await getSyncApi({ config: config(), db: fresh })).toBeNull();
    expect(await fresh.events.count()).toBe(1);
    expect(await fresh.outbox.count()).toBe(1);
    expect(await readIdentity(fresh)).not.toBeNull();
  });
});
