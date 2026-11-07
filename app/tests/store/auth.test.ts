// Sign-in on the phone (T077): the session lives in the store, logging never waits on it, and
// neither a refresh lost to bad signal nor an ended session touches the season or the outbox
// (constitution I and II; ADR 0001).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId, type Event } from '../../src/model';
import {
  AccountMismatchError,
  AUTH_STORAGE_PREFIX,
  getSyncApi,
  googleNonce,
  IDENTITY_KEY,
  metaStorage,
  readIdentity,
  recordIdentity,
  supabaseClient,
  type Identity,
  type SessionClient,
} from '../../src/store/auth';
import type { WrappedDB } from '../../src/store/db';
import { save } from '../../src/store/mutate';
import { createSyncLoop, PULL_CURSOR_KEY, type SyncLock } from '../../src/store/sync';
import { startSync } from '../../src/store/sync-runtime';
import { SyncError } from '../../src/store/sync-api';
import { freshDb } from '../helpers';

// Node has no Web Locks, and the loop refuses to sync without them; these tests are about
// sign-in, not tabs, so each loop's sync runs unlocked.
const noLock: SyncLock = (_name, work) => work();

function concert(): Event {
  const now = new Date().toISOString();
  return {
    id: newId(),
    kind: 'concert',
    date: '2026-12-15',
    startTime: null,
    sabhaId: null,
    status: 'attended',
    cancelled: false,
    source: 'spot',
    scheduleEntryId: null,
    scheduleVersionSeen: null,
    scheduleChanged: false,
    touched: true,
    title: null,
    note: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function identity(userId = newId()): Identity {
  return { userId, email: 'r@example.test', name: 'Rasika', signedInAt: new Date().toISOString() };
}

function fakeClient(answer: Awaited<ReturnType<SessionClient['auth']['getSession']>>) {
  const calls: string[] = [];
  const client: SessionClient = {
    auth: {
      getSession: async () => {
        calls.push('getSession');
        return answer;
      },
    },
    rpc: async (fn) => {
      calls.push(fn);
      return { data: { changes: [], cursor: 'c', more: false }, error: null, status: 200 };
    },
  };
  return { client, calls };
}

describe('sign-in on the phone', () => {
  it('keeps supabase-js’s session in the store, under its own prefix', async () => {
    const db = freshDb();
    const storage = metaStorage(db);
    await storage.setItem('wrapped-session', '{"access_token":"t"}');
    expect(await storage.getItem('wrapped-session')).toBe('{"access_token":"t"}');
    expect((await db.meta.get(`${AUTH_STORAGE_PREFIX}wrapped-session`))?.value).toBe(
      '{"access_token":"t"}',
    );
    await storage.removeItem('wrapped-session');
    expect(await storage.getItem('wrapped-session')).toBeNull();
  });

  it('gives no server before anyone has signed in, without asking for a session', async () => {
    const db = freshDb();
    const { client, calls } = fakeClient({ data: { session: {} }, error: null });
    expect(await getSyncApi({ db, client })).toBeNull();
    expect(calls).toEqual([]);
    expect(await getSyncApi({ db, config: null })).toBeNull();
  });

  it('gives the server with a session, and nothing once the session has ended', async () => {
    const db = freshDb();
    await recordIdentity(identity(), db);
    const live = fakeClient({ data: { session: { access_token: 't' } }, error: null });
    const api = await getSyncApi({ db, client: live.client });
    await api!.pull({ cursor: '' });
    expect(live.calls).toEqual(['getSession', 'sync_pull']);

    const ended = fakeClient({
      data: { session: null },
      error: { name: 'AuthApiError', message: 'Invalid Refresh Token' },
    });
    expect(await getSyncApi({ db, client: ended.client })).toBeNull();
  });

  it('treats a refresh lost to bad signal as a network failure, never a sign-out', async () => {
    const db = freshDb();
    await recordIdentity(identity(), db);
    const offline = fakeClient({
      data: { session: null },
      error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' },
    });
    const failure = await getSyncApi({ db, client: offline.client }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(SyncError);
    expect((failure as SyncError).failure.kind).toBe('network');
  });

  it('with real auth-js: an expired token and no signal keep the session and the season', async () => {
    const db = freshDb();
    await recordIdentity(identity(), db);
    await save('events', concert(), { db });
    const expired = {
      access_token: 'expired',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) - 60,
      user: { id: newId(), aud: 'authenticated', app_metadata: {}, user_metadata: {} },
    };
    await metaStorage(db).setItem('wrapped-session', JSON.stringify(expired));
    // Nothing listens on port 9: every refresh fails for want of an answer.
    const config = { url: 'http://127.0.0.1:9', anonKey: 'anon', appVersion: '0.1.0' };
    const client = await supabaseClient(config, db);

    // auth-js retries a refresh without an answer for up to 30 s (200 ms, 400 ms, …); step
    // through those waits instead of sleeping them.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let settled = false;
    const pending = getSyncApi({ db, client: client as unknown as SessionClient })
      .catch((e: unknown) => e)
      .finally(() => (settled = true));
    while (!settled) await vi.advanceTimersByTimeAsync(1_000);
    vi.useRealTimers();
    const failure = await pending;

    expect(failure).toBeInstanceOf(SyncError);
    expect((failure as SyncError).failure.kind).toBe('network');
    expect(await metaStorage(db).getItem('wrapped-session')).toBe(JSON.stringify(expired));
    expect(await readIdentity(db)).not.toBeNull();
    expect(await db.outbox.count()).toBe(1);
    expect(await db.events.count()).toBe(1);
  });

  it('an ended session stops the sync loop as signed out, and keeps the outbox', async () => {
    const db = freshDb();
    await recordIdentity(identity(), db);
    await save('events', concert(), { db });
    const ended = fakeClient({ data: { session: null }, error: null });
    const loop = createSyncLoop({
      db,
      getApi: () => getSyncApi({ db, client: ended.client }),
      lock: noLock,
    });

    await loop.request('start');

    expect(loop.status()).toMatchObject({ state: 'stopped', failure: { kind: 'signed_out' } });
    expect(await db.outbox.count()).toBe(1);
    expect(ended.calls).toEqual(['getSession']);
  });

  it('refuses another account on a phone that holds a season, and changes nothing', async () => {
    const db = freshDb();
    const first = identity();
    await recordIdentity(first, db);
    await save('events', concert(), { db });

    await expect(recordIdentity(identity(), db)).rejects.toBeInstanceOf(AccountMismatchError);
    expect((await db.meta.get(IDENTITY_KEY))?.value).toEqual(first);
    expect(await db.events.count()).toBe(1);

    // The same account again is fine.
    await recordIdentity({ ...first, signedInAt: new Date().toISOString() }, db);
  });

  it('lets another account sign in on an empty phone, and pulls it from the start', async () => {
    const db = freshDb();
    await recordIdentity(identity(), db);
    // What the last account's syncs left behind.
    await db.meta.put({ key: PULL_CURSOR_KEY, value: '1:9000:3:x' });
    await db.serverSeqs.put({ table: 'events', id: newId(), seq: 9000, held: null });
    const next = identity();
    await recordIdentity(next, db);
    expect(await readIdentity(db)).toEqual(next);
    expect(await db.meta.get(PULL_CURSOR_KEY)).toBeUndefined();
    expect(await db.serverSeqs.count()).toBe(0);
  });

  it('keeps the sync state when the same account signs in again', async () => {
    const db = freshDb();
    const first = identity();
    await recordIdentity(first, db);
    await db.meta.put({ key: PULL_CURSOR_KEY, value: '1:9000:3:x' });
    await recordIdentity({ ...first, signedInAt: new Date().toISOString() }, db);
    expect((await db.meta.get(PULL_CURSOR_KEY))?.value).toBe('1:9000:3:x');
  });

  it('gives Google the SHA-256 of the nonce it gives Supabase', async () => {
    const { nonce, hashed } = await googleNonce();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
    expect(hashed).toBe(Buffer.from(digest).toString('hex'));
    expect(nonce).toMatch(/^[A-Za-z0-9]{20,}$/);
  });
});

describe('what starts a sync (FR-014)', () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });

  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  function started(db: WrappedDB) {
    const triggers: string[] = [];
    const target = new EventTarget();
    const page = Object.assign(new EventTarget(), { visibilityState: 'hidden' as string });
    stops.push(
      startSync({
        db,
        target: target as unknown as Window,
        page: page as unknown as Document,
        loop: {
          getApi: async () => {
            triggers.push('sync');
            return null;
          },
          // Never stopped, so every trigger is seen.
          random: () => 0,
          lock: noLock,
        },
      }),
    );
    return { triggers, target, page };
  }

  it('syncs on start, on `online`, when shown again, and after a save', async () => {
    const db = freshDb();
    const { triggers, target, page } = started(db);
    await settle();
    expect(triggers).toHaveLength(1);

    target.dispatchEvent(new Event('online'));
    await settle();
    expect(triggers).toHaveLength(2);

    page.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(triggers).toHaveLength(2);
    page.visibilityState = 'visible';
    page.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(triggers).toHaveLength(3);

    await save('events', concert(), { db });
    await settle();
    expect(triggers).toHaveLength(4);
  });
});
