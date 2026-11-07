// Sign-in on the phone (T077; ADR 0001; contracts/sync-api.md, "Sign-in and sessions").
//
// - Google's button gives an id token, which `signInWithIdToken` turns into a Supabase session
//   (proven on the iPhone by T010).
// - The app keeps its own record of who signed in (`identity` in `meta`). Logging never reads
//   the session; only the sync loop asks for a token, through `getSyncApi`.
// - supabase-js is loaded only when first needed, after the first screen is drawn, and keeps its
//   session in this store (`meta`), not in localStorage, so all on-device storage stays behind
//   one module (constitution, Boundaries).
// - `autoRefreshToken` is off: `getSession` refreshes a token about to expire just before each
//   sync. A refresh lost to bad signal keeps the session; only a refresh token the server
//   rejected, with the access token already expired, ends it (auth-js 2.118, read). An ended
//   session never touches the season or the outbox: the rasika sees "sign in again".
// - A sign-in happens on a client that keeps nothing. Its session reaches the store only after
//   the account check passed, in one transaction with the identity, under the sync lock; and a
//   sync refuses any session whose user isn't the identity. So another account's session never
//   sends this phone's season, even after a crash mid-sign-in.

import type {
  AuthError,
  Session,
  SupabaseClient,
  SupportedStorage,
  User,
} from '@supabase/supabase-js';
import { APP_VERSION_HEADER, RASIKA_TABLES } from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { LAST_SYNCED_KEY, PULL_CURSOR_KEY, syncLockName, webLock, type SyncLock } from './sync';
import { rpcSyncApi, SyncError, type RpcClient, type SyncApi } from './sync-api';

export const IDENTITY_KEY = 'identity';
/** `meta` keys under this prefix hold supabase-js's own session storage. */
export const AUTH_STORAGE_PREFIX = 'auth:';
const STORAGE_KEY = 'wrapped-session';

/** Who signed in on this phone, kept by the app itself (ADR 0001). */
export interface Identity {
  /** The Supabase Auth user. */
  userId: string;
  email: string | null;
  /** From Google (FR-021). */
  name: string | null;
  signedInAt: string;
}

/** The server a build talks to (store/auth-config.ts reads it from the build). */
export interface AuthConfig {
  url: string;
  anonKey: string;
  appVersion: string;
}

/** supabase-js's session storage, kept in `meta`. auth-js stores strings. */
export function metaStorage(db: WrappedDB): SupportedStorage {
  return {
    async getItem(key) {
      const value = (await db.meta.get(AUTH_STORAGE_PREFIX + key))?.value;
      return typeof value === 'string' ? value : null;
    },
    async setItem(key, value) {
      await db.meta.put({ key: AUTH_STORAGE_PREFIX + key, value });
    },
    async removeItem(key) {
      await db.meta.delete(AUTH_STORAGE_PREFIX + key);
    },
  };
}

/**
 * auth-js ends the session when a refresh is answered with a status it doesn't retry and the
 * access token has expired (2.118 retries no answer, 500-504 and 520-530). A 408, a 429 or any
 * other 5xx, a captive portal's 511 among them, says nothing about the refresh token, so it is
 * made to look like no answer: auth-js retries it, and keeps the session.
 */
export const keepSessionFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const status = response.status;
  if (
    url.includes('grant_type=refresh_token') &&
    (status === 408 || status === 429 || status >= 500)
  ) {
    throw new TypeError(`The token refresh was answered ${status}`);
  }
  return response;
};

const clients = new WeakMap<WrappedDB, Promise<SupabaseClient>>();

/** The one Supabase client per store, created on first use. */
export function supabaseClient(
  config: AuthConfig,
  db: WrappedDB = defaultDb,
): Promise<SupabaseClient> {
  let client = clients.get(db);
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(config.url, config.anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          storage: metaStorage(db),
          storageKey: STORAGE_KEY,
        },
        // Every call carries the app's version; below the server's minimum it answers 426.
        global: { headers: { [APP_VERSION_HEADER]: config.appVersion }, fetch: keepSessionFetch },
      }),
    );
    clients.set(db, client);
  }
  return client;
}

/** A client for one sign-in attempt: it stores nothing, refreshes nothing and tells no tab. */
async function candidateClient(config: AuthConfig): Promise<SupabaseClient> {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { [APP_VERSION_HEADER]: config.appVersion } },
  });
}

export async function readIdentity(db: WrappedDB = defaultDb): Promise<Identity | null> {
  return ((await db.meta.get(IDENTITY_KEY))?.value as Identity | undefined) ?? null;
}

/** The sign-in belongs to another account than the season on this phone. Nothing was changed. */
export class AccountMismatchError extends Error {
  constructor(readonly signedIn: Identity) {
    super('This phone holds another account’s season');
    this.name = 'AccountMismatchError';
  }
}

/** True when the store holds anything of a season: a record, a queued or rejected change. */
async function holdsSeason(db: WrappedDB): Promise<boolean> {
  for (const table of RASIKA_TABLES) {
    if ((await db.table(table).count()) > 0) return true;
  }
  return (await db.outbox.count()) > 0 || (await db.attention.count()) > 0;
}

/**
 * Keep who signed in, and with `session` the session itself. Signing in again as the same
 * account, or on an empty phone, records them. Another account on a phone that holds a season is
 * refused before anything is written, so one rasika's season is never pushed into another's
 * account (constitution, Privacy). It runs under the sync lock, so a sync in flight (a restore
 * page still to land) finishes first and is counted, and in one transaction, so the identity,
 * the session and the cleared sync state are written together or not at all.
 */
export async function recordIdentity(
  identity: Identity,
  db: WrappedDB = defaultDb,
  { lock = webLock, session }: { lock?: SyncLock; session?: Session } = {},
): Promise<void> {
  const tables = [
    db.meta,
    db.outbox,
    db.attention,
    db.serverSeqs,
    ...RASIKA_TABLES.map((t) => db.table(t)),
  ];
  await lock(syncLockName(db), () =>
    db.transaction('rw', tables, async () => {
      const current = await readIdentity(db);
      if (current && current.userId !== identity.userId) {
        if (await holdsSeason(db)) throw new AccountMismatchError(identity);
        // The last account's sync state goes with it. Its pull cursor is a position in one
        // sequence shared by every rasika, so kept it would skip the new account's earlier rows.
        await db.meta.bulkDelete([PULL_CURSOR_KEY, LAST_SYNCED_KEY]);
        await db.serverSeqs.clear();
      }
      await db.meta.put({ key: IDENTITY_KEY, value: identity });
      // As auth-js stores it, for the phone's client to find (supabaseClient).
      if (session) {
        await db.meta.put({
          key: AUTH_STORAGE_PREFIX + STORAGE_KEY,
          value: JSON.stringify(session),
        });
      }
    }),
  );
}

interface SignedInUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

function identityOf(user: SignedInUser): Identity {
  const meta = user.user_metadata ?? {};
  const name = meta.full_name ?? meta.name;
  return {
    userId: user.id,
    email: user.email ?? null,
    name: typeof name === 'string' ? name : null,
    signedInAt: new Date().toISOString(),
  };
}

/** What a sign-in call answers (`signInWithIdToken`, `signInWithPassword`). */
export interface SignInAnswer {
  data: { session: Session | null; user: User | null };
  error: AuthError | null;
}

/**
 * Sign in with `attempt`, run on a client that stores nothing, then keep the session only if the
 * account may sign in on this phone (recordIdentity). A refused session was never stored, so it
 * is gone from the phone at once; revoking it on the server too is only tried, never awaited.
 */
export async function signIn(
  attempt: (client: SupabaseClient) => Promise<SignInAnswer>,
  {
    config,
    db = defaultDb,
    lock = webLock,
  }: { config: AuthConfig | null; db?: WrappedDB; lock?: SyncLock },
): Promise<Identity> {
  if (!config) throw new Error('This build has no server to sign in to');
  const candidate = await candidateClient(config);
  const { data, error } = await attempt(candidate);
  if (error) throw error;
  if (!data.session || !data.user) throw new Error('The sign-in gave no session');
  const identity = identityOf(data.user);
  try {
    await recordIdentity(identity, db, { lock, session: data.session });
  } catch (refused) {
    // Only this session goes; the account's other devices stay signed in.
    void candidate.auth.signOut({ scope: 'local' }).catch(() => undefined);
    throw refused;
  }
  return identity;
}

/**
 * A random nonce for Google's button: Google gets its SHA-256 (hex), Supabase the nonce itself,
 * and Supabase checks that one hashes to the other (T010).
 */
export async function googleNonce(): Promise<{ nonce: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  const hashed = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { nonce, hashed };
}

/** Sign in with the credential from Google's button and the nonce whose hash Google was given. */
export function signInWithGoogle(
  credential: string,
  nonce: string,
  options: { config: AuthConfig | null; db?: WrappedDB; lock?: SyncLock },
): Promise<Identity> {
  return signIn(
    (client) => client.auth.signInWithIdToken({ provider: 'google', token: credential, nonce }),
    options,
  );
}

/** The part of a Supabase client `getSyncApi` uses, so tests can stand in for it. */
export interface SessionClient extends RpcClient {
  auth: {
    getSession(): Promise<{
      data: { session: unknown };
      error: { name?: string; message: string } | null;
    }>;
  };
}

/**
 * The server for one sync, with a fresh token; null when no one has signed in on this phone or
 * the session has ended, which the sync loop shows as "sign in again" (FR-018). A refresh that
 * failed for want of signal is a network failure, retried with backoff, never a sign-out. A
 * session of another account than this phone's is refused (`other_account`) before any call.
 */
export async function getSyncApi({
  config = null,
  db = defaultDb,
  client,
}: {
  config?: AuthConfig | null;
  db?: WrappedDB;
  client?: SessionClient;
}): Promise<SyncApi | null> {
  if (!client && !config) return null;
  const identity = await readIdentity(db);
  if (!identity) return null;
  const session = client ?? ((await supabaseClient(config!, db)) as unknown as SessionClient);
  const { data, error } = await session.auth.getSession();
  if (error && isRetryable(error)) {
    throw new SyncError({ kind: 'network', status: 0, message: error.message });
  }
  if (!data.session) return null;
  const userId = (data.session as { user?: { id?: unknown } }).user?.id;
  if (userId !== identity.userId) throw new SyncError({ kind: 'other_account' });
  return rpcSyncApi(session);
}

/**
 * auth-js's AuthRetryableFetchError: no answer, or a 502, 503 or 504 from the token endpoint.
 * Matched by name, since importing auth-js's own check would load supabase-js with the first
 * screen. Any other error with no session is a session that ended.
 */
function isRetryable(error: { name?: string }): boolean {
  return error.name === 'AuthRetryableFetchError';
}
