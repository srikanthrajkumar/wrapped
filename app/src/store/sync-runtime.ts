// The app's one sync loop and what starts it (FR-014): app start, `online`, the app shown
// again, and each save. Started after the first screen is drawn; nothing here is awaited by
// the logging path (constitution I).

import { liveQuery } from 'dexie';
import { useSyncExternalStore } from 'react';
import type { Remap } from '../catalog/load';
import { getSyncApi } from './auth';
import { buildAuthConfig } from './auth-config';
import { db as defaultDb, type WrappedDB } from './db';
import { createSyncLoop, type SyncLoop, type SyncLoopOptions, type SyncStatus } from './sync';

let loop: SyncLoop | null = null;
/** Screens listening for status, kept apart from the loop so they may subscribe before it starts. */
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

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
  const started = createSyncLoop({
    db,
    getApi: () => getSyncApi({ db, config }),
    getRemap,
    ...extra,
  });
  loop = started;
  const unsubscribe = started.subscribe(notify);
  notify();

  const online = () => void started.request('online');
  const visible = () => {
    if (page.visibilityState === 'visible') void started.request('visible');
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
    unsubscribe();
    loop = null;
    notify();
  };
}

/** The running loop, for the screens that resume or read it; null before `startSync`. */
export function syncLoop(): SyncLoop | null {
  return loop;
}

const IDLE: SyncStatus = { state: 'idle' };

/** The loop's status, kept current; idle before the loop starts. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => loop?.status() ?? IDLE,
  );
}
