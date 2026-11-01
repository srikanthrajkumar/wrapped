// Registers the service worker and keeps the page's side of the offline story: follow the
// first download to "Ready to log offline", ask for the second download, record "ready for
// offline", and offer an update without forcing one.

import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import type {
  FromServiceWorker,
  OfflineStatus,
  ReadyStatus,
  ToServiceWorker,
} from './precache-phases';
import { ReadinessTracker, type Readiness } from './readiness';
import { recordOfflineReady, recordReadyToLog } from './store/offline-ready';

/** The catalog this build ships, set by vite.config.ts; null when it has none. */
export const CATALOG_FILE: string | null = import.meta.env.VITE_CATALOG_FILE ?? null;

/** A new version waiting for the rasika's agreement, and whether it brings a new catalog. */
export interface UpdateState {
  available: boolean;
  newCatalog: boolean;
}

let update: UpdateState = { available: false, newCatalog: false };
let registered: ServiceWorkerRegistration | null = null;
let applyUpdate: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

function ask<T>(worker: ServiceWorker, message: ToServiceWorker): Promise<T> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(event.data as T);
    worker.postMessage(message, [channel.port2]);
  });
}

// A worker that never answers (stopped mid-update) must not leave the page waiting.
const STATUS_TIMEOUT_MS = 3000;

/** The controlling service worker's own check of its first-phase files (eng review D8). */
async function askReadyStatus(): Promise<ReadyStatus | null> {
  const worker =
    navigator.serviceWorker.controller ??
    (await navigator.serviceWorker.getRegistration())?.active ??
    null;
  if (!worker) return null;
  return Promise.race([
    ask<ReadyStatus>(worker, { type: 'READY_STATUS' }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), STATUS_TIMEOUT_MS)),
  ]);
}

const SW_URL = `${import.meta.env.BASE_URL}sw.js`;

const readiness = new ReadinessTracker({
  ask: askReadyStatus,
  remember: recordReadyToLog,
  async reinstall() {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) await registration.update();
    else await navigator.serviceWorker.register(SW_URL, { scope: import.meta.env.BASE_URL });
  },
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

// Without a service worker (the dev server, an old browser) there is nothing to wait for.
const noWorker: Readiness = { state: 'ready' };
const hasWorker = () => !import.meta.env.DEV && 'serviceWorker' in navigator;

/** Where the first download stands, for "Getting ready to log offline" (design D10). */
export function useReadiness(): Readiness {
  return useSyncExternalStore(readiness.subscribe, () =>
    hasWorker() ? readiness.getSnapshot() : noWorker,
  );
}

/** "Try again" on "The download stopped". */
export function retryReadiness(): void {
  void readiness.retry();
}

function followFirstDownload() {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const message = event.data as FromServiceWorker | undefined;
    if (message?.type === 'INSTALL_PROGRESS') readiness.progress(message.cached, message.total);
  });
  // Messages from an installing worker reach a page it doesn't control yet only once enabled.
  navigator.serviceWorker.startMessages();
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    void readiness.workerChanged();
  });
  void readiness.start();
}

// One check at a time: two overlapping runs could finish out of order and leave a late "not
// ready" over an earlier "ready".
let checking: Promise<void> | null = null;

function checkOffline(registration: ServiceWorkerRegistration): Promise<void> {
  checking ??= (async () => {
    const worker = registration.active;
    if (!worker) return;
    const status = await ask<OfflineStatus>(worker, { type: 'CACHE_PHASE_2' });
    await recordOfflineReady(status.phase2 && status.catalogFile === CATALOG_FILE, CATALOG_FILE);
  })().finally(() => {
    checking = null;
  });
  return checking;
}

/** Start the service worker. Never awaited by the first render: the shell opens at once. */
export function startServiceWorker(): void {
  if (!hasWorker()) return;
  followFirstDownload();
  applyUpdate = registerSW({
    onNeedRefresh() {
      void (async () => {
        const waiting = registered?.waiting;
        const status = waiting
          ? await Promise.race([
              ask<ReadyStatus>(waiting, { type: 'READY_STATUS' }),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), STATUS_TIMEOUT_MS)),
            ])
          : null;
        update = {
          available: true,
          newCatalog: status !== null && status.catalogFile !== CATALOG_FILE,
        };
        listeners.forEach((listener) => listener());
      })();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      registered = registration;
      const check = () => void navigator.serviceWorker.ready.then(() => checkOffline(registration));
      check();
      // A first open without signal can't fetch the second download; try again when it returns.
      window.addEventListener('online', check);
    },
  });
}

/** A new version waiting for the rasika's agreement (FR-038). */
export function useUpdate(): UpdateState {
  return useSyncExternalStore(subscribe, () => update);
}

// Defined once, so React doesn't resubscribe on every render.
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The rasika agreed: activate the waiting version and reload into it. */
export function updateNow(): void {
  void applyUpdate?.();
}
