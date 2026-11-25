// The rasika's account on this phone (T081, T082, T083; contracts/sync-api.md, "Account"): the two
// consent answers, the writer claim, and what the server last said about the account. Each is a
// local write that returns at once; the sync loop carries it to the server before its push
// (`settleAccount`), so answering a question or taking writing back never waits on signal
// (constitution I).

import type { MeResponse } from '../model';
import { IDENTITY_KEY } from './auth';
import { db as defaultDb, type WrappedDB } from './db';
import { syncLockName, webLock, type SyncLock } from './sync';
import type { SyncApi } from './sync-api';

/** The answers on this phone; null until answered (FR-042, FR-049: nothing pre-selected). */
export const CONSENT_KEY = 'consent';
/** Answers given on this phone that the server hasn't confirmed yet. */
export const CONSENT_PENDING_KEY = 'consentPending';
/** Set by a sign-in or "Make this the writing device again": claim before the next push. */
export const CLAIM_PENDING_KEY = 'claimPending';
/** What `GET /v1/me` last answered, for Settings (the deletion contact). */
export const ACCOUNT_KEY = 'account';
/**
 * How many times a consent was answered on this phone. A `GET /v1/me` reply is taken for the
 * consents only if none was answered since it was asked, so a late reply can't undo a change.
 */
export const CONSENT_CHANGES_KEY = 'consentChanges';

/** Everything of the account kept on the phone, which goes when another account signs in. */
export const ACCOUNT_KEYS = [
  CONSENT_KEY,
  CONSENT_PENDING_KEY,
  CLAIM_PENDING_KEY,
  ACCOUNT_KEY,
  CONSENT_CHANGES_KEY,
] as const;

export type ConsentName = 'shareAdditions' | 'seasonReports';

export interface Consent {
  shareAdditions: boolean | null;
  seasonReports: boolean | null;
}

export type ConsentPending = Partial<Record<ConsentName, boolean>>;

export const NO_ANSWERS: Consent = { shareAdditions: null, seasonReports: null };

export async function readConsent(db: WrappedDB = defaultDb): Promise<Consent> {
  return { ...NO_ANSWERS, ...((await db.meta.get(CONSENT_KEY))?.value as Consent | undefined) };
}

/**
 * Answer one consent question. Kept on the phone at once and sent with the next sync; turning
 * one off takes effect on the server from then on (FR-042, FR-049).
 */
export async function answerConsent(
  name: ConsentName,
  answer: boolean,
  db: WrappedDB = defaultDb,
): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const consent = await readConsent(db);
    const pending = ((await db.meta.get(CONSENT_PENDING_KEY))?.value ?? {}) as ConsentPending;
    await db.meta.put({ key: CONSENT_KEY, value: { ...consent, [name]: answer } });
    await db.meta.put({ key: CONSENT_PENDING_KEY, value: { ...pending, [name]: answer } });
    await db.meta.put({ key: CONSENT_CHANGES_KEY, value: (await consentChanges(db)) + 1 });
  });
}

/** How many times a consent was answered on this phone (CONSENT_CHANGES_KEY). */
export async function consentChanges(db: WrappedDB = defaultDb): Promise<number> {
  const value = (await db.meta.get(CONSENT_CHANGES_KEY))?.value;
  return typeof value === 'number' ? value : 0;
}

/** Whether a consent answer waits to be sent. */
export async function hasPendingConsent(db: WrappedDB = defaultDb): Promise<boolean> {
  const pending = (await db.meta.get(CONSENT_PENDING_KEY))?.value as ConsentPending | undefined;
  return !!pending && Object.keys(pending).length > 0;
}

/** Who is signed in on this phone (store/auth.ts, recordIdentity); null before any sign-in. */
export async function signedInUserId(db: WrappedDB = defaultDb): Promise<string | null> {
  const identity = (await db.meta.get(IDENTITY_KEY))?.value as { userId?: string } | undefined;
  return identity?.userId ?? null;
}

/** Ask the next sync to make this phone the writing device (FR-022), before it pushes. */
export async function requestClaim(db: WrappedDB = defaultDb): Promise<void> {
  await db.meta.put({ key: CLAIM_PENDING_KEY, value: true });
}

/** A label the rasika would recognise for this phone, kept with the claim. */
export function deviceLabel(userAgent = globalThis.navigator?.userAgent ?? ''): string {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android phone';
  return 'Browser';
}

/**
 * Send what the account is waiting for, in the sync's own run, before any push: the claim first,
 * since a push from a phone that isn't the writer is refused, then any consent answers. Each is
 * cleared only once the server has answered it. A failure throws the call's SyncError and leaves
 * both as they were.
 */
export async function settleAccount(
  api: SyncApi,
  deviceId: () => Promise<string>,
  db: WrappedDB = defaultDb,
): Promise<void> {
  if ((await db.meta.get(CLAIM_PENDING_KEY))?.value === true) {
    await api.claim({ deviceId: await deviceId(), label: deviceLabel() });
    await db.meta.delete(CLAIM_PENDING_KEY);
  }
  await settleConsent(api, db);
}

/**
 * Send any consent answers waiting on this phone, with `api`. Consent is account data, not a
 * season op: the server takes it from any of the rasika's devices, writer or not
 * (`PUT /v1/me/consent`). The answers are cleared only if they weren't changed while the call was
 * on its way, so a later answer is sent next time; the phone's own answers stand either way,
 * since the reply also holds any question not answered here yet.
 *
 * Callers hold the sync lock (the sync loop's run, `sendConsent`), so two sends never cross: a
 * later answer can't land first and then be overwritten on the server by an earlier one.
 */
export async function settleConsent(api: SyncApi, db: WrappedDB = defaultDb): Promise<void> {
  const pending = (await db.meta.get(CONSENT_PENDING_KEY))?.value as ConsentPending | undefined;
  if (!pending || Object.keys(pending).length === 0) return;
  const sent = JSON.stringify(pending);
  await api.consent(pending);
  await db.transaction('rw', db.meta, async () => {
    const now = (await db.meta.get(CONSENT_PENDING_KEY))?.value;
    if (JSON.stringify(now) === sent) await db.meta.delete(CONSENT_PENDING_KEY);
  });
}

/**
 * Send a consent answer now, outside the sync loop, so a change reaches the server even while
 * sync is stopped for something else (another phone writing, eng review D6): turning one off
 * takes effect from then on (FR-042, FR-049). With no session or no signal it stays waiting, for
 * the next sync, `online`, or the app shown again (store/sync-runtime.ts).
 *
 * It runs under the sync lock, as every send of consent and every change of who is signed in
 * does, and only if the account the server was asked for is still the one signed in: answers
 * given after another account signed in are never sent with the last one's session.
 */
export async function sendConsent(
  getApi: () => Promise<SyncApi | null>,
  db: WrappedDB = defaultDb,
  { lock = webLock }: { lock?: SyncLock } = {},
): Promise<void> {
  try {
    if (!(await hasPendingConsent(db))) return;
    const userId = await signedInUserId(db);
    const api = await getApi();
    if (!api || !userId) return;
    await lock(syncLockName(db), async () => {
      if ((await signedInUserId(db)) !== userId) return;
      await settleConsent(api, db);
    });
  } catch {
    // Kept waiting: the next sync, `online`, or the app shown again sends it.
  }
}

/** What the phone held when `GET /v1/me` was asked, for `storeAccount` to judge its reply. */
export interface AccountAsked {
  userId: string | null;
  /** consentChanges when asked. */
  changes: number;
  /** Whether an answer waited to be sent when asked. */
  pending: boolean;
}

/** Taken before `GET /v1/me` is asked (and before its session is looked up). */
export async function accountAsked(db: WrappedDB = defaultDb): Promise<AccountAsked> {
  return db.transaction('r', db.meta, async () => ({
    userId: await signedInUserId(db),
    changes: await consentChanges(db),
    pending: await hasPendingConsent(db),
  }));
}

/**
 * Store what the server says about the account (`GET /v1/me`, asked when the phone held
 * `asked`). A reply for an account that is no longer the one signed in is dropped whole. The
 * server's consents are the truth only if no answer waited to be sent when it was asked, none
 * waits now, and none was given since; otherwise the phone's stand, so a reply that crossed a
 * change, even one sent and cleared meanwhile, never brings an old answer back.
 */
export async function storeAccount(
  me: MeResponse,
  asked: AccountAsked,
  db: WrappedDB = defaultDb,
): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    if ((await signedInUserId(db)) !== asked.userId) return;
    await db.meta.put({ key: ACCOUNT_KEY, value: me });
    if (asked.pending || (await hasPendingConsent(db))) return;
    if ((await consentChanges(db)) !== asked.changes) return;
    await db.meta.put({
      key: CONSENT_KEY,
      value: { shareAdditions: me.shareAdditions, seasonReports: me.seasonReports },
    });
  });
}
