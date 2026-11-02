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
import { appliesWaitingUpdate } from './screens/update-offer';
import { isFirstLaunchDone } from './store/first-launch';
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

/** Ask, but give up after `ms`: a worker that never answers must not leave the page waiting. */
function askWithin<T>(worker: ServiceWorker, message: ToServiceWorker, ms: number) {
  return Promise.race([
    ask<T>(worker, message),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// A status check is quick; a repair downloads files, and its stalls are the tracker's 15 s rule.
const STATUS_TIMEOUT_MS = 3000;
const REPAIR_TIMEOUT_MS = 120_000;

/** The controlling service worker's own check of its first-phase files (eng review D8). */
async function askReadyStatus(): Promise<ReadyStatus | null> {
  const worker =
    navigator.serviceWorker.controller ??
    (await navigator.serviceWorker.getRegistration())?.active ??
    null;
  if (!worker) return null;
  return askWithin<ReadyStatus>(worker, { type: 'READY_STATUS' }, STATUS_TIMEOUT_MS);
}

const SW_URL = `${import.meta.env.BASE_URL}sw.js`;

/** Set when first launch's Try again found a newer build: it is installed and applied whole. */
let applyWhenWaiting = false;

/** Apply the waiting build if first launch's Try again asked for it and first launch isn't done. */
async function applyRequestedUpdate(): Promise<void> {
  const firstLaunchDone = await isFirstLaunchDone().catch(() => true);
  if (!appliesWaitingUpdate({ requested: applyWhenWaiting, firstLaunchDone })) return;
  applyWhenWaiting = false;
  updateNow();
}

const readiness = new ReadinessTracker({
  ask: askReadyStatus,
  remember: recordReadyToLog,
  async repair() {
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.active;
    if (registration && worker) {
      // The worker refills its precache and answers once done; progress comes meanwhile.
      const answer = await askWithin<ReadyStatus>(worker, { type: 'REPAIR' }, REPAIR_TIMEOUT_MS);
      // A request lasts only for this attempt: a later one that finds this build current drops it.
      applyWhenWaiting = answer?.newBuild === true;
      if (applyWhenWaiting) {
        await registration.update();
        if (registration.waiting) await applyRequestedUpdate();
      }
    } else if (registration) {
      await registration.update();
    } else {
      await navigator.serviceWorker.register(SW_URL, { scope: import.meta.env.BASE_URL });
    }
  },
});

// The dev server has no service worker to wait for; a browser without one (Firefox private
// mode) can log, but not offline, and is told so (FirstLaunch).
const devReady: Readiness = { state: 'ready' };
const hasWorker = () => !import.meta.env.DEV && 'serviceWorker' in navigator;
if (!import.meta.env.DEV && !('serviceWorker' in navigator)) readiness.unavailable();

/** Where the first download stands, for "Getting ready to log offline" (design D10). */
export function useReadiness(): Readiness {
  return useSyncExternalStore(readiness.subscribe, () =>
    import.meta.env.DEV ? devReady : readiness.getSnapshot(),
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
    else if (message?.type === 'INSTALL_BYTES') readiness.bytes();
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
          ? await askWithin<ReadyStatus>(waiting, { type: 'READY_STATUS' }, STATUS_TIMEOUT_MS)
          : null;
        update = {
          available: true,
          newCatalog: status !== null && status.catalogFile !== CATALOG_FILE,
        };
        listeners.forEach((listener) => listener());
        await applyRequestedUpdate();
      })();
    },
    onRegisterError() {
      // Registration refused (private browsing, a blocked worker): no offline logging here.
      readiness.unavailable();
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
