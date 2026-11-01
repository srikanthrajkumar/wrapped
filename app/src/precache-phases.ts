// Which built files the phone downloads first and which come second (constitution V, Edge
// Cases "Partly downloaded app"). Read by the build, which writes precache-phases.json for the
// size check, and by the service worker, which caches the two phases separately.

/**
 * Second-phase files: the card renderer, fonts and the xlsx writer, fetched right after
 * install. Their chunks are named so they match here (empty until the Cards and export work).
 */
const PHASE_2 = [/^assets\/phase2-[^/]+$/, /^fonts\//];

/** True for a file of the second download. Takes a build-relative path or a site URL. */
export function isPhase2(path: string): boolean {
  const relative = path.replace(/^\/+/, '');
  return PHASE_2.some((pattern) => pattern.test(relative));
}

export const PHASE_2_CACHE = 'phase-2';

/** Messages the page sends the service worker. */
export type ToServiceWorker =
  { type: 'SKIP_WAITING' } | { type: 'CACHE_PHASE_2' } | { type: 'READY_STATUS' };

/**
 * The service worker's answer to READY_STATUS (eng review D8): what it found in its own
 * precache, just now, for every first-phase file of its build. Logging offline needs all of it.
 */
export interface ReadyStatus {
  type: 'READY_STATUS';
  cached: number;
  total: number;
  /** The catalog file this worker precaches, or null when the build has none. */
  catalogFile: string | null;
}

/** Posted by an installing service worker as each first-phase file is cached (eng review D4). */
export interface InstallProgress {
  type: 'INSTALL_PROGRESS';
  cached: number;
  total: number;
}

export type FromServiceWorker = ReadyStatus | InstallProgress;

/** How many of `urls` `isCached` finds, checked one by one. */
export async function countCached(
  urls: readonly string[],
  isCached: (url: string) => Promise<boolean>,
): Promise<number> {
  let cached = 0;
  for (const url of urls) if (await isCached(url)) cached += 1;
  return cached;
}

/** The service worker's answer to CACHE_PHASE_2. */
export interface OfflineStatus {
  /** Every second-phase file is cached. The first phase is, whenever this worker is active. */
  phase2: boolean;
  /** The catalog file this worker precached, or null when the build had none. */
  catalogFile: string | null;
}
