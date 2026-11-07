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
  signInWithGoogle,
  supabaseClient,
  type Identity,
  type SessionClient,
} from '../../src/store/auth';
import type { WrappedDB } from '../../src/store/db';
import { save } from '../../src/store/mutate';
import {
  createSyncLoop,
  LAST_SYNCED_KEY,
  PULL_CURSOR_KEY,
  syncLockName,
  syncOnce,
  type SyncLock,
} from '../../src/store/sync';
import { startSync } from '../../src/store/sync-runtime';
import type { SupportedStorage } from '@supabase/supabase-js';
import { SyncError, type SyncApi } from '../../src/store/sync-api';
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

/**
 * One holder per lock name at a time, as Web Locks give them in the browser; locks of other
 * names don't wait, so a sign-in and a sync serialize only if they use the same name.
 */
function mutex(): SyncLock {
  const tails = new Map<string, Promise<unknown>>();
  return (name, work) => {
    const run = (tails.get(name) ?? Promise.resolve()).then(work);
    tails.set(
      name,
      run.catch(() => undefined),
    );
    return run;
  };
}

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A session as auth-js keeps it, for `user`. */
function sessionOf(user: string, token = `token-of-${user}`, expiresAt = Date.now() / 1000 + 3600) {
  return {
    access_token: token,
    refresh_token: `refresh-of-${user}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(expiresAt),
    user: { id: user, aud: 'authenticated', app_metadata: {}, user_metadata: {} },
  };
}

const server = { url: 'http://example.test', anonKey: 'anon', appVersion: '0.1.0' };

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
    const me = identity();
    await recordIdentity(me, db, { lock: noLock });
    const storage = metaStorage(db);
    const session = JSON.stringify(sessionOf(me.userId));
    await storage.setItem('wrapped-session', session);
    expect(await storage.getItem('wrapped-session')).toBe(session);
    expect((await db.meta.get(`${AUTH_STORAGE_PREFIX}wrapped-session`))?.value).toBe(session);
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
    const me = identity();
    await recordIdentity(me, db, { lock: noLock });
    const live = fakeClient({
      data: { session: { access_token: 't', user: { id: me.userId } } },
      error: null,
    });
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
    await recordIdentity(identity(), db, { lock: noLock });
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
    const me = identity();
    await recordIdentity(me, db, { lock: noLock });
    await save('events', concert(), { db });
    const expired = {
      access_token: 'expired',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) - 60,
      user: { id: me.userId, aud: 'authenticated', app_metadata: {}, user_metadata: {} },
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
    await recordIdentity(identity(), db, { lock: noLock });
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
    await recordIdentity(first, db, { lock: noLock });
    await save('events', concert(), { db });

    await expect(recordIdentity(identity(), db, { lock: noLock })).rejects.toBeInstanceOf(
      AccountMismatchError,
    );
    expect((await db.meta.get(IDENTITY_KEY))?.value).toEqual(first);
    expect(await db.events.count()).toBe(1);

    // The same account again is fine.
    await recordIdentity({ ...first, signedInAt: new Date().toISOString() }, db, { lock: noLock });
  });

  it('lets another account sign in on an empty phone, and pulls it from the start', async () => {
    const db = freshDb();
    await recordIdentity(identity(), db, { lock: noLock });
    // What the last account's syncs left behind.
    await db.meta.put({ key: PULL_CURSOR_KEY, value: '1:9000:3:x' });
    await db.meta.put({ key: LAST_SYNCED_KEY, value: '2026-12-01T10:00:00.000Z' });
    await db.serverSeqs.put({ table: 'events', id: newId(), seq: 9000, held: null });
    const next = identity();
    await recordIdentity(next, db, { lock: noLock });
    expect(await readIdentity(db)).toEqual(next);
    expect(await db.meta.get(PULL_CURSOR_KEY)).toBeUndefined();
    expect(await db.meta.get(LAST_SYNCED_KEY)).toBeUndefined();
    expect(await db.serverSeqs.count()).toBe(0);
  });

  it('keeps the sync state when the same account signs in again', async () => {
    const db = freshDb();
    const first = identity();
    await recordIdentity(first, db, { lock: noLock });
    await db.meta.put({ key: PULL_CURSOR_KEY, value: '1:9000:3:x' });
    await recordIdentity({ ...first, signedInAt: new Date().toISOString() }, db, { lock: noLock });
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

describe('another account, a crash and a race (required)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** A server that signs in as `user`, never answers /logout, and records every call's token. */
  function stubServer(user: string) {
    const calls: { url: string; token: string | null; body: string }[] = [];
    let logouts = 0;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      const headers = new Headers(init?.headers);
      if (url.includes('grant_type=id_token')) {
        return new Response(JSON.stringify(sessionOf(user)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/logout')) {
        logouts += 1;
        return new Promise<Response>(() => undefined); // no answer: bad signal
      }
      calls.push({ url, token: headers.get('Authorization'), body: String(init?.body ?? '') });
      return new Response('{}', { status: 503 });
    });
    return { calls, logouts: () => logouts };
  }

  it('refuses another account at once, though its revoke hangs, and never stores or sends its session', async () => {
    const db = freshDb();
    const a = identity();
    await recordIdentity(a, db, { lock: noLock, session: sessionOf(a.userId) as never });
    const event = concert();
    await save('events', event, { db });
    const b = newId();
    const server_ = stubServer(b);

    const signIn = signInWithGoogle('credential', 'nonce', { config: server, db, lock: noLock });
    const settled = await Promise.race([signIn.catch((e: unknown) => e), later(1_000)]);

    expect(settled).toBeInstanceOf(AccountMismatchError);
    expect(await readIdentity(db)).toEqual(a);
    const stored = await metaStorage(db).getItem('wrapped-session');
    expect(stored).toContain(`token-of-${a.userId}`);
    expect(stored).not.toContain(b);
    // Revoked on the server too, as far as signal allows.
    await vi.waitFor(() => expect(server_.logouts()).toBe(1));

    // The next sync sends the season with this phone's own account, never the other one.
    const loop = createSyncLoop({
      db,
      getApi: () => getSyncApi({ db, config: server }),
      lock: noLock,
    });
    await loop.request('start');
    loop.dispose();
    expect(server_.calls.some((call) => call.body.includes(event.id))).toBe(true);
    expect(server_.calls.every((call) => call.token === `Bearer token-of-${a.userId}`)).toBe(true);
  });

  it('a stored session of another account never syncs, and stops the loop without a sign-out', async () => {
    const db = freshDb();
    await recordIdentity(identity(), db, { lock: noLock });
    await save('events', concert(), { db });
    // As a crash mid-sign-in once could leave it.
    const other = fakeClient({ data: { session: sessionOf(newId()) }, error: null });
    const loop = createSyncLoop({
      db,
      getApi: () => getSyncApi({ db, client: other.client }),
      lock: noLock,
    });

    await loop.request('start');

    expect(loop.status()).toMatchObject({ state: 'stopped', failure: { kind: 'other_account' } });
    expect(other.calls).toEqual(['getSession']);
    expect(await db.outbox.count()).toBe(1);
  });

  it('refuses another account on a phone holding only synced records, with nothing queued', async () => {
    const db = freshDb();
    await recordIdentity(identity(), db, { lock: noLock });
    await db.events.put(concert());
    expect(await db.outbox.count()).toBe(0);

    await expect(recordIdentity(identity(), db, { lock: noLock })).rejects.toBeInstanceOf(
      AccountMismatchError,
    );
  });

  it('waits for a restore in flight: its page lands first, and the other account is refused', async () => {
    const db = freshDb();
    const a = identity();
    const lock = mutex();
    await recordIdentity(a, db, { lock });
    const page = gate();
    let pulls = 0;
    const restoring: SyncApi = {
      push: () => Promise.reject(new Error('nothing to push')),
      pull: async () => {
        pulls += 1;
        await page.opened;
        return {
          changes: [{ table: 'events', seq: 7, row: concert() }],
          cursor: 'a-cursor',
          more: false,
        };
      },
      claim: () => Promise.reject(new Error('unused')),
      me: () => Promise.reject(new Error('unused')),
      consent: () => Promise.reject(new Error('unused')),
    };
    const sync = lock(syncLockName(db), () => syncOnce(restoring, { db }));
    await vi.waitFor(() => expect(pulls).toBe(1));

    const signIn = recordIdentity(identity(), db, { lock }).catch((e: unknown) => e);
    page.open();
    await sync;

    expect(await signIn).toBeInstanceOf(AccountMismatchError);
    expect(await readIdentity(db)).toEqual(a);
    expect((await db.meta.get(PULL_CURSOR_KEY))?.value).toBe('a-cursor');
  });

  it('a refresh of the last account answering after another account signed in leaves the new session', async () => {
    const db = freshDb();
    const a = identity();
    await recordIdentity(a, db, { lock: noLock });
    const inner = metaStorage(db);
    await inner.setItem(
      'wrapped-session',
      JSON.stringify(sessionOf(a.userId, 'expired', Date.now() / 1000 - 60)),
    );
    const b = identity();
    const sessionB = JSON.stringify(sessionOf(b.userId));
    let refreshAnswered = false;
    let signedInB: Promise<void> | null = null;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (!String(input).includes('grant_type=refresh_token'))
        return new Response('{}', { status: 404 });
      refreshAnswered = true;
      return new Response(JSON.stringify(sessionOf(a.userId, 'refreshed')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    // auth-js reads the session once more after the refresh answers, then writes it: the other
    // account's sign-in (another tab, outside the sync lock) lands in between.
    const storage: SupportedStorage = {
      getItem: async (key) => {
        const value = await inner.getItem(key);
        if (refreshAnswered && !signedInB && key === 'wrapped-session') {
          signedInB = recordIdentity(b, db, { lock: noLock, session: JSON.parse(sessionB) });
        }
        return value;
      },
      setItem: (key, value) => inner.setItem(key, value),
      removeItem: (key) => inner.removeItem(key),
    };
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(server.url, server.anonKey, {
      auth: {
        storage,
        storageKey: 'wrapped-session',
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    await client.auth.getSession();
    await signedInB;

    expect(signedInB).not.toBeNull();
    expect(await readIdentity(db)).toEqual(b);
    expect(await inner.getItem('wrapped-session')).toBe(sessionB);
  });

  it('a sign-in that fails part-way changes nothing', async () => {
    const db = freshDb();
    const a = identity();
    await recordIdentity(a, db, { lock: noLock });
    await db.meta.put({ key: PULL_CURSOR_KEY, value: 'a-cursor' });
    // A session that can't be stored.
    const unstorable = { ...sessionOf(newId()), size: 1n };

    await expect(
      recordIdentity(identity(), db, { lock: noLock, session: unstorable as never }),
    ).rejects.toThrow();

    expect(await readIdentity(db)).toEqual(a);
    expect((await db.meta.get(PULL_CURSOR_KEY))?.value).toBe('a-cursor');
  });

  it('keeps a session whose refresh is answered 429 or 511 (a captive portal)', async () => {
    for (const status of [429, 511]) {
      const db = freshDb();
      const me = identity();
      await recordIdentity(me, db, { lock: noLock });
      const expired = JSON.stringify(sessionOf(me.userId, 'expired', Date.now() / 1000 - 60));
      await metaStorage(db).setItem('wrapped-session', expired);
      vi.stubGlobal(
        'fetch',
        async () => new Response('<html>Sign in to the Wi-Fi</html>', { status }),
      );
      const client = await supabaseClient(server, db);

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      let settled = false;
      const pending = getSyncApi({ db, client: client as unknown as SessionClient })
        .catch((e: unknown) => e)
        .finally(() => (settled = true));
      while (!settled) await vi.advanceTimersByTimeAsync(1_000);
      vi.useRealTimers();

      const failure = await pending;
      expect((failure as SyncError).failure?.kind, String(status)).toBe('network');
      expect(await metaStorage(db).getItem('wrapped-session'), String(status)).toBe(expired);
    }
  });
});

describe('each sync waits for the catalog', () => {
  it('pulls nothing until the remap has come', async () => {
    const db = freshDb();
    const me = identity();
    await recordIdentity(me, db, { lock: noLock });
    const catalog = gate();
    const live = fakeClient({ data: { session: sessionOf(me.userId) }, error: null });
    const loop = createSyncLoop({
      db,
      getApi: () => getSyncApi({ db, client: live.client }),
      getRemap: () => catalog.opened.then(() => undefined),
      lock: noLock,
    });

    const run = loop.request('start');
    await later(30);
    expect(live.calls).toEqual(['getSession']);
    catalog.open();
    await run;
    expect(live.calls).toEqual(['getSession', 'sync_pull']);
  });
});
