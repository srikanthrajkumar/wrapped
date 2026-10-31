// Registers the service worker and keeps the page's side of the offline story: ask for the
// second download, record "ready for offline", and offer an update without forcing one.

import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import type { OfflineStatus, ToServiceWorker } from './precache-phases';
import { recordOfflineReady } from './store/offline-ready';

/** The catalog this build ships, set by vite.config.ts; null when it has none. */
export const CATALOG_FILE: string | null = import.meta.env.VITE_CATALOG_FILE ?? null;

let updateAvailable = false;
let applyUpdate: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

function ask(worker: ServiceWorker, message: ToServiceWorker): Promise<OfflineStatus> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(event.data as OfflineStatus);
    worker.postMessage(message, [channel.port2]);
  });
}

// One check at a time: two overlapping runs could finish out of order and leave a late "not
// ready" over an earlier "ready".
let checking: Promise<void> | null = null;

function checkOffline(registration: ServiceWorkerRegistration): Promise<void> {
  checking ??= (async () => {
    const worker = registration.active;
    if (!worker) return;
    const status = await ask(worker, { type: 'CACHE_PHASE_2' });
    await recordOfflineReady(status.phase2 && status.catalogFile === CATALOG_FILE, CATALOG_FILE);
  })().finally(() => {
    checking = null;
  });
  return checking;
}

/** Start the service worker. Never awaited by the first render: the shell opens at once. */
export function startServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    onNeedRefresh() {
      updateAvailable = true;
      listeners.forEach((listener) => listener());
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void navigator.serviceWorker.ready.then(() => checkOffline(registration));
      check();
      // A first open without signal can't fetch the second download; try again when it returns.
      window.addEventListener('online', check);
    },
  });
}

/** True when a new version is waiting for the rasika's agreement (FR-038). */
export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(subscribe, () => updateAvailable);
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
