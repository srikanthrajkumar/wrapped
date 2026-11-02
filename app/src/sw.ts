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
  repairMissing,
  type InstallBytes,
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

async function tellWindows(message: InstallProgress | InstallBytes) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach((client) => client.postMessage(message));
}

async function postProgress() {
  await tellWindows({
    type: 'INSTALL_PROGRESS',
    cached: await phase1Cached(),
    total: phase1.length,
  });
}

const BYTES_EVERY_MS = 1000;
let bytesPostedAt = 0;

/** The response with its body passed through a counter that reports bytes as they arrive. */
function countingBytes(response: Response): Response {
  if (!response.body) return response;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      const now = Date.now();
      if (now - bytesPostedAt >= BYTES_EVERY_MS) {
        bytesPostedAt = now;
        void tellWindows({ type: 'INSTALL_BYTES' });
      }
    },
  });
  return new Response(response.body.pipeThrough(counter), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

// Real progress for "Getting ready to log offline" (eng review D4): after each first-phase file
// is cached, tell every window, including one this worker doesn't control yet; while a file
// downloads, say that bytes are still arriving.
addPlugins([
  {
    fetchDidSucceed: async ({ response }) => countingBytes(response),
    cacheDidUpdate: async ({ cacheName }) => {
      if (cacheName === cacheNames.precache) await postProgress();
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

/**
 * Fetch each first-phase file missing from the precache (the phone evicted it, or the install
 * stopped part-way) and store it under its precache key. An unchanged worker is never installed
 * again by `registration.update()`, so this is what "Try again" relies on. When the server has
 * moved to a newer build, nothing is mixed in: the answer says so, and the page updates.
 */
async function repairPhase1(): Promise<'repaired' | 'new-build'> {
  const cache = await caches.open(cacheNames.precache);
  return repairMissing(phase1, {
    async isCached(file) {
      const key = getCacheKeyForURL(file.url);
      return key === undefined || (await cache.match(key)) !== undefined;
    },
    fetch: (url) => fetch(absolute(url), { cache: 'reload' }),
    async put(file, response) {
      await cache.put(getCacheKeyForURL(file.url)!, countingBytes(response));
      await postProgress();
    },
    serverWorker: async () => (await fetch(self.location.href, { cache: 'reload' })).text(),
  });
}

self.addEventListener('message', (event) => {
  const message = event.data as ToServiceWorker;
  if (message?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  } else if (message?.type === 'READY_STATUS' || message?.type === 'REPAIR') {
    // Checked against the cache each time, never trusted from a stored flag (eng review D8).
    event.waitUntil(
      (async () => {
        const repaired =
          message.type === 'REPAIR' ? await repairPhase1().catch(() => 'failed') : null;
        const status: ReadyStatus = {
          type: 'READY_STATUS',
          cached: await phase1Cached().catch(() => 0),
          total: phase1.length,
          catalogFile,
          ...(repaired === 'new-build' ? { newBuild: true } : {}),
        };
        event.ports[0]?.postMessage(status);
      })(),
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
