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
export type ToServiceWorker = { type: 'SKIP_WAITING' } | { type: 'CACHE_PHASE_2' };

/** The service worker's answer to CACHE_PHASE_2. */
export interface OfflineStatus {
  /** Every second-phase file is cached. The first phase is, whenever this worker is active. */
  phase2: boolean;
  /** The catalog file this worker precached, or null when the build had none. */
  catalogFile: string | null;
}
