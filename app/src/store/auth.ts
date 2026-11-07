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

import type { SupabaseClient, SupportedStorage } from '@supabase/supabase-js';
import { APP_VERSION_HEADER, RASIKA_TABLES } from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { LAST_SYNCED_KEY, PULL_CURSOR_KEY } from './sync';
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
        global: { headers: { [APP_VERSION_HEADER]: config.appVersion } },
      }),
    );
    clients.set(db, client);
  }
  return client;
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
 * Keep who signed in. Signing in again as the same account, or on an empty phone, records the
 * identity. Another account on a phone that holds a season is refused before anything is
 * written, so one rasika's season is never pushed into another's account (constitution,
 * Privacy): the caller signs that session out again.
 */
export async function recordIdentity(identity: Identity, db: WrappedDB = defaultDb): Promise<void> {
  const tables = [
    db.meta,
    db.outbox,
    db.attention,
    db.serverSeqs,
    ...RASIKA_TABLES.map((t) => db.table(t)),
  ];
  await db.transaction('rw', tables, async () => {
    const current = await readIdentity(db);
    if (current && current.userId !== identity.userId) {
      if (await holdsSeason(db)) throw new AccountMismatchError(identity);
      // The last account's sync state goes with it. Its pull cursor is a position in one
      // sequence shared by every rasika, so kept it would skip the new account's earlier rows.
      await db.meta.bulkDelete([PULL_CURSOR_KEY, LAST_SYNCED_KEY]);
      await db.serverSeqs.clear();
    }
    await db.meta.put({ key: IDENTITY_KEY, value: identity });
  });
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

async function finishSignIn(
  client: SupabaseClient,
  user: SignedInUser,
  db: WrappedDB,
): Promise<Identity> {
  const identity = identityOf(user);
  try {
    await recordIdentity(identity, db);
  } catch (error) {
    // Only this phone's session goes; the account's other devices stay signed in.
    await client.auth.signOut({ scope: 'local' });
    throw error;
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
export async function signInWithGoogle(
  credential: string,
  nonce: string,
  { config, db = defaultDb }: { config: AuthConfig | null; db?: WrappedDB },
): Promise<Identity> {
  if (!config) throw new Error('This build has no server to sign in to');
  const client = await supabaseClient(config, db);
  const { data, error } = await client.auth.signInWithIdToken({
    provider: 'google',
    token: credential,
    nonce,
  });
  if (error) throw error;
  return finishSignIn(client, data.user, db);
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
 * failed for want of signal is a network failure, retried with backoff, never a sign-out.
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
  if (!(await readIdentity(db))) return null;
  const session = client ?? ((await supabaseClient(config!, db)) as unknown as SessionClient);
  const { data, error } = await session.auth.getSession();
  if (error && isRetryable(error)) {
    throw new SyncError({ kind: 'network', status: 0, message: error.message });
  }
  if (!data.session) return null;
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
