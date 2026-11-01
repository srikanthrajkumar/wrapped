/// <reference lib="webworker" />
// The service worker (T028). The first phase (shell, catalog snapshot, reference data) is
// precached on install, so the app opens and logs offline. The second phase (card renderer,
// fonts, xlsx writer) is fetched into its own cache right after, when the page asks. A new
// version waits until the rasika agrees to update: no silent skipWaiting mid-concert.

import { cacheNames, clientsClaim } from 'workbox-core';
import {
  addPlugins,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  getCacheKeyForURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  countCached,
  isPhase2,
  PHASE_2_CACHE,
  type InstallProgress,
  type OfflineStatus,
  type ReadyStatus,
  type ToServiceWorker,
} from './precache-phases';

declare const self: ServiceWorkerGlobalScope;

const entries: PrecacheEntry[] = self.__WB_MANIFEST.map((entry) =>
  typeof entry === 'string' ? { url: entry, revision: null } : entry,
);
const phase1 = entries.filter((entry) => !isPhase2(entry.url));
const phase2 = entries.filter((entry) => isPhase2(entry.url));
const catalogFile =
  phase1
    .map((entry) => /(?:^|\/)catalog\/(catalog\.[0-9a-f]{64}\.json)$/.exec(entry.url)?.[1])
    .find((file) => file !== undefined) ?? null;

/** How many first-phase files of this build are in the precache right now (eng review D8). */
async function phase1Cached(): Promise<number> {
  const cache = await caches.open(cacheNames.precache);
  return countCached(
    phase1.map((entry) => entry.url),
    async (url) => {
      const key = getCacheKeyForURL(url);
      return key !== undefined && (await cache.match(key)) !== undefined;
    },
  );
}

// Real progress for "Getting ready to log offline" (eng review D4): after each first-phase file
// is cached, tell every window, including one this worker doesn't control yet.
addPlugins([
  {
    cacheDidUpdate: async ({ cacheName }) => {
      if (cacheName !== cacheNames.precache) return;
      const progress: InstallProgress = {
        type: 'INSTALL_PROGRESS',
        cached: await phase1Cached(),
        total: phase1.length,
      };
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windows.forEach((client) => client.postMessage(progress));
    },
  },
]);
precacheAndRoute(phase1);
cleanupOutdatedCaches();
// Every navigation opens the precached shell, so a reload in airplane mode still works.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
// Take control of the page on first install; updates still wait for SKIP_WAITING.
clientsClaim();

const absolute = (url: string) => new URL(url, self.location.href).href;
const phase2Urls = new Set(phase2.map((entry) => absolute(entry.url)));
// The revisions cached so far, stored beside the files so a rebuilt file is fetched again.
const REVISIONS = absolute('__phase-2-revisions');

registerRoute(
  ({ url }) => phase2Urls.has(url.href),
  async ({ request }) =>
    (await caches.match(request.url, { cacheName: PHASE_2_CACHE })) ?? fetch(request),
);

/** Fetch whatever of the second phase is missing; true once all of it is cached. */
async function cachePhase2(): Promise<boolean> {
  const cache = await caches.open(PHASE_2_CACHE);
  const stored = ((await (await cache.match(REVISIONS))?.json()) ?? {}) as Record<
    string,
    string | null
  >;
  for (const request of await cache.keys()) {
    if (request.url !== REVISIONS && !phase2Urls.has(request.url)) await cache.delete(request);
  }

  const cached: Record<string, string | null> = {};
  let complete = true;
  for (const entry of phase2) {
    const url = absolute(entry.url);
    const revision = entry.revision ?? null;
    if (url in stored && stored[url] === revision && (await cache.match(url))) {
      cached[url] = revision;
      continue;
    }
    try {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      await cache.put(url, response);
      cached[url] = revision;
    } catch {
      complete = false;
    }
  }
  await cache.put(REVISIONS, Response.json(cached));
  return complete;
}

self.addEventListener('message', (event) => {
  const message = event.data as ToServiceWorker;
  if (message?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  } else if (message?.type === 'READY_STATUS') {
    // Checked against the cache each time, never trusted from a stored flag (eng review D8).
    event.waitUntil(
      phase1Cached()
        .catch(() => 0)
        .then((cached) => {
          const status: ReadyStatus = {
            type: 'READY_STATUS',
            cached,
            total: phase1.length,
            catalogFile,
          };
          event.ports[0]?.postMessage(status);
        }),
    );
  } else if (message?.type === 'CACHE_PHASE_2') {
    // Always answer, even when the cache itself fails (quota, storage errors), so the page
    // never waits forever and never keeps a stale "ready for offline".
    event.waitUntil(
      cachePhase2()
        .catch(() => false)
        .then((phase2Ready) => {
          const status: OfflineStatus = { phase2: phase2Ready, catalogFile };
          event.ports[0]?.postMessage(status);
        }),
    );
  }
});
