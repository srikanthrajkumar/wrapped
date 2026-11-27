// The sign-in as the screens see it (T081): Google's own button gives a credential, which
// `signInWithGoogle` turns into a session on the phone (store/auth.ts; ADR 0001, decided
// 2026-11-24, so Supabase's address never shows). Whatever the outcome, it is one state here,
// which first launch and the "Sign in" prompt both show. A finished sign-in starts the restore
// (store/restore.ts).
//
// Logging never waits on any of this (FR-018): it runs beside the screens, and a failure is one
// line of text and a way to try again (DESIGN.md, "First launch").

import { useSyncExternalStore } from 'react';
import { AccountMismatchError, ConsentWaitingError, signIn, signInWithGoogle } from './auth';
import { buildAuthConfig } from './auth-config';
import { restoreAfterSignIn, type RestoreWait } from './restore';
import { resumeSync } from './sync-runtime';

export type SignInFailure =
  'cancelled' | 'noSignal' | 'googleError' | 'otherAccount' | 'consentWaiting';

export type SignInState =
  | { state: 'idle' }
  | { state: 'working' }
  /** `attempt` counts failures, so a screen can draw Google's button afresh after each. */
  | { state: 'failed'; failure: SignInFailure; attempt?: number };

const IDLE: SignInState = { state: 'idle' };
let current: SignInState = IDLE;
const listeners = new Set<() => void>();
let restoring: Promise<RestoreWait> | null = null;

let failures = 0;

function set(next: SignInState) {
  if (next.state === 'failed') {
    failures += 1;
    next.attempt = failures;
  }
  current = next;
  for (const listener of listeners) listener();
  // "No signal" is stale once signal returns: the prompt then offers Sign in again.
  if (next.state === 'failed' && next.failure === 'noSignal') {
    globalThis.addEventListener?.(
      'online',
      () => {
        if (current === next) set(IDLE);
      },
      { once: true },
    );
  }
}

export function signInState(): SignInState {
  return current;
}

export function useSignInState(): SignInState {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, signInState);
}

/** Clear a failure shown on screen, as a new attempt does. */
export function clearSignInFailure(): void {
  if (current.state === 'failed') set(IDLE);
}

function signedIn() {
  set(IDLE);
  restoring = restoreAfterSignIn({ resume: resumeSync });
}

/**
 * The restore started by the last sign-in, as first launch waits for it: 'done', or 'continuing'
 * after 10 s. Done at once when no sign-in started one in this page.
 */
export function waitForRestore(): Promise<RestoreWait> {
  return restoring ?? Promise.resolve('done');
}

/** In a local test build only: the e2e's password user (app/e2e/restore.spec.ts). */
interface TestCredentials {
  email: string;
  password: string;
}

/**
 * True when sign-in is Google's own button: a build with Google's client id. The local restore
 * test's build signs in a password user from the app's own button instead (beginSignIn).
 */
export function usesGoogleButton(): boolean {
  return (
    import.meta.env.VITE_TEST_PASSWORD_SIGNIN !== '1' && Boolean(buildAuthConfig()?.googleClientId)
  );
}

/** Finish a sign-in with the credential Google's button gave, and the nonce Google was given. */
export async function signInWithCredential(credential: string, nonce: string): Promise<void> {
  if (current.state === 'working') return;
  set({ state: 'working' });
  try {
    await signInWithGoogle(credential, nonce, { config: buildAuthConfig() });
  } catch (error) {
    return set({ state: 'failed', failure: failureOf(error) });
  }
  signedIn();
}

/** Show why Google's button couldn't be offered (its script didn't load). */
export function failSignIn(error: unknown): void {
  set({ state: 'failed', failure: failureOf(error) });
}

/**
 * Sign in from the app's own button, where Google's isn't used: the local restore test's password
 * user (T080). A build with no server has nothing to sign in to and never offers it.
 */
export async function beginSignIn(): Promise<void> {
  const config = buildAuthConfig();
  if (!config || current.state === 'working') return;
  if (globalThis.navigator?.onLine === false) {
    return set({ state: 'failed', failure: 'noSignal' });
  }
  set({ state: 'working' });
  try {
    // Vite drops this branch from every other build, since the flag is fixed when it builds.
    if (import.meta.env.VITE_TEST_PASSWORD_SIGNIN === '1') {
      const credentials = (globalThis as { __WRAPPED_TEST_SIGNIN__?: TestCredentials })
        .__WRAPPED_TEST_SIGNIN__;
      if (!credentials) throw new Error('No test user given');
      await signIn((client) => client.auth.signInWithPassword(credentials), { config });
      return signedIn();
    }
    throw new Error('This build has no Google client id (VITE_GOOGLE_CLIENT_ID)');
  } catch (error) {
    set({ state: 'failed', failure: failureOf(error) });
  }
}

function failureOf(error: unknown): SignInFailure {
  if (error instanceof AccountMismatchError) return 'otherAccount';
  if (error instanceof ConsentWaitingError) return 'consentWaiting';
  if (globalThis.navigator?.onLine === false) return 'noSignal';
  const name = (error as { name?: unknown } | null)?.name;
  // auth-js's name for no answer, or a 502-504; fetch's own for no connection.
  if (name === 'AuthRetryableFetchError' || error instanceof TypeError) return 'noSignal';
  return 'googleError';
}
