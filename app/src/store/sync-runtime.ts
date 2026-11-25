// The app's one sync loop and what starts it (FR-014): app start, `online`, the app shown
// again, and each save. Started after the first screen is drawn; nothing here is awaited by
// the logging path (constitution I).

import { liveQuery } from 'dexie';
import type { Remap } from '../catalog/load';
import {
  accountAsked,
  answerConsent,
  sendConsent,
  storeAccount,
  type ConsentName,
} from './account';
import { getSyncApi } from './auth';
import { buildAuthConfig } from './auth-config';
import { db as defaultDb, type WrappedDB } from './db';
import {
  createSyncLoop,
  webLock,
  type SyncLock,
  type SyncLoop,
  type SyncLoopOptions,
  type SyncStatus,
} from './sync';
import type { SyncApi } from './sync-api';

let loop: SyncLoop | null = null;
/** How the running loop reaches the server, which a consent sent outside it uses too. */
let reach: { getApi: () => Promise<SyncApi | null>; lock: SyncLock } | null = null;
const IDLE: SyncStatus = { state: 'idle' };
const statusListeners = new Set<() => void>();
let unsubscribeLoop: (() => void) | null = null;

/** The running loop's status; idle before it starts (a build or test that never starts it). */
export function syncStatus(): SyncStatus {
  return loop?.status() ?? IDLE;
}

/** For useSyncExternalStore: told whenever the loop's status changes. */
export function subscribeSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/**
 * Clear a stop and sync now: after a sign-in, "Make this the writing device again", or a consent
 * answered. Resolves when that sync has ended, however it ended.
 */
export function resumeSync(): Promise<void> {
  return loop?.resume() ?? Promise.resolve();
}

/**
 * Ask the server about the account (`GET /v1/me`) and keep its answer, for Settings: the
 * deletion contact, and consents changed on another device. Quietly nothing with no server, no
 * session or no signal; Settings shows what it last had.
 */
export async function refreshAccount(db: WrappedDB = defaultDb): Promise<void> {
  try {
    // Before the session is looked up, so a reply for an account since replaced is dropped.
    const asked = await accountAsked(db);
    const api = await getSyncApi({ db, config: buildAuthConfig() });
    if (!api) return;
    await storeAccount(await api.me(), asked, db);
  } catch {
    // Kept as it was: the next visit asks again.
  }
}

/**
 * Send a consent answer now, even while sync is stopped (another phone writing): consent is
 * account data, not a season op (store/account.ts, sendConsent).
 */
export function sendConsentNow(db: WrappedDB = defaultDb): Promise<void> {
  const { getApi, lock } = reach ?? {
    getApi: () => getSyncApi({ db, config: buildAuthConfig() }),
    lock: webLock,
  };
  return sendConsent(getApi, db, { lock });
}

/**
 * Settings' consent answer (FR-042, FR-049): kept on the phone at once, then sent at once, even
 * while sync is stopped for another phone writing. With no signal it is sent by the next sync,
 * `online`, or the app shown again.
 */
export async function changeConsent(
  name: ConsentName,
  answer: boolean,
  db: WrappedDB = defaultDb,
): Promise<void> {
  await answerConsent(name, answer, db);
  await sendConsentNow(db);
}

export interface StartSyncOptions {
  db?: WrappedDB;
  /** The catalog's remap, awaited before each sync (store/sync.ts). */
  getRemap?: () => Remap | undefined | Promise<Remap | undefined>;
  /** For tests: the loop's own options. */
  loop?: Partial<SyncLoopOptions>;
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  page?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
}

/**
 * Start the sync loop and its triggers, once. Returns a stop function for tests. A save is seen
 * as the outbox growing, so every write path triggers a sync without knowing about it.
 */
export function startSync({
  db = defaultDb,
  getRemap,
  loop: extra = {},
  target = window,
  page = document,
}: StartSyncOptions = {}): () => void {
  if (loop) return () => {};
  const config = buildAuthConfig();
  const getApi = extra.getApi ?? (() => getSyncApi({ db, config }));
  const lock = extra.lock ?? webLock;
  const started = createSyncLoop({ db, getRemap, ...extra, getApi, lock });
  loop = started;
  reach = { getApi, lock };
  unsubscribeLoop = started.subscribe(() => {
    for (const listener of statusListeners) listener();
  });

  // A stopped loop ignores these (it waits for the rasika), but an answer waiting to be sent is
  // still sent: a consent turned off with no signal while another phone writes would otherwise
  // wait for the next answer or launch (FR-042, FR-049).
  const consentWaiting = () => {
    if (started.status().state === 'stopped') void sendConsent(getApi, db, { lock });
  };
  const online = () => {
    void started.request('online');
    consentWaiting();
  };
  const visible = () => {
    if (page.visibilityState !== 'visible') return;
    void started.request('visible');
    consentWaiting();
  };
  target.addEventListener('online', online);
  page.addEventListener('visibilitychange', visible);

  let queued: number | null = null;
  const saves = liveQuery(() => db.outbox.count()).subscribe({
    next(count) {
      if (queued !== null && count > queued) void started.request('save');
      queued = count;
    },
    error: () => undefined,
  });

  void started.request('start');
  return () => {
    target.removeEventListener('online', online);
    page.removeEventListener('visibilitychange', visible);
    saves.unsubscribe();
    started.dispose();
    unsubscribeLoop?.();
    unsubscribeLoop = null;
    loop = null;
    reach = null;
  };
}
