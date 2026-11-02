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
  | { type: 'SKIP_WAITING' }
  | { type: 'CACHE_PHASE_2' }
  | { type: 'READY_STATUS' }
  /** "Try again": fetch the first-phase files missing from the precache; answered as READY_STATUS. */
  | { type: 'REPAIR' };

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
  /** In answer to REPAIR: the server serves a newer build, so nothing was mixed in. */
  newBuild?: boolean;
}

/** Posted by an installing service worker as each first-phase file is cached (eng review D4). */
export interface InstallProgress {
  type: 'INSTALL_PROGRESS';
  cached: number;
  total: number;
}

/**
 * Posted at most once a second while a first-phase file's bytes arrive, so one slow file on a
 * weak signal is not taken for a stalled download.
 */
export interface InstallBytes {
  type: 'INSTALL_BYTES';
}

export type FromServiceWorker = ReadyStatus | InstallProgress | InstallBytes;

/** How many of `urls` `isCached` finds, checked one by one. */
export async function countCached(
  urls: readonly string[],
  isCached: (url: string) => Promise<boolean>,
): Promise<number> {
  let cached = 0;
  for (const url of urls) if (await isCached(url)) cached += 1;
  return cached;
}

/** A precached file as the build lists it: hashed files have no revision. */
export interface PrecacheFile {
  url: string;
  revision?: string | null;
}

export interface RepairDeps {
  isCached(file: PrecacheFile): Promise<boolean>;
  fetch(url: string): Promise<Response>;
  put(file: PrecacheFile, response: Response): Promise<void>;
  /** The server's service worker script, which lists the revisions of the build it serves. */
  serverWorker(): Promise<string>;
}

/**
 * Fetch each file missing from the precache and store it under its precache key, only from the
 * build this worker holds (second review of PR #5, A7). An unhashed file (index.html) is fetched
 * by its bare URL, so it is stored only while the server's worker still lists its revision; a
 * hashed file the server no longer has belongs to an older build. Either way the server has
 * moved on: nothing more is stored, and the caller installs the new build whole instead.
 */
export async function repairMissing(
  files: readonly PrecacheFile[],
  deps: RepairDeps,
): Promise<'repaired' | 'new-build'> {
  let serverWorker: string | null = null;
  for (const file of files) {
    if (await deps.isCached(file)) continue;
    if (file.revision != null) {
      serverWorker ??= await deps.serverWorker();
      if (!serverWorker.includes(file.revision)) return 'new-build';
    }
    const response = await deps.fetch(file.url);
    if (!response.ok) {
      const gone = response.status === 404 || response.status === 410;
      if (gone && file.revision == null) return 'new-build';
      throw new Error(`${file.url}: HTTP ${response.status}`);
    }
    await deps.put(file, response);
  }
  return 'repaired';
}

/** The service worker's answer to CACHE_PHASE_2. */
export interface OfflineStatus {
  /** Every second-phase file is cached. The first phase is, whenever this worker is active. */
  phase2: boolean;
  /** The catalog file this worker precached, or null when the build had none. */
  catalogFile: string | null;
}
