// Which built files the phone downloads first and which come second (constitution V, Edge
// Cases "Partly downloaded app"). Read by the build, which writes precache-phases.json for the
// size check, and by the service worker, which caches the two phases separately.

import { md5 } from './md5';

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
  put(file: PrecacheFile, body: ArrayBuffer, response: Response): Promise<void>;
  /** The server's service worker script, which lists every file of the build it serves. */
  serverWorker(): Promise<string>;
}

/** The Content-Type a hashed file of each kind must come with, so the app page never passes. */
const TYPES: [RegExp, RegExp][] = [
  [/\.m?js$/, /javascript/],
  [/\.css$/, /css/],
  [/\.woff2?$/, /font|octet-stream/],
  [/\.json$/, /json/],
  [/\.(png|svg|ico|webp)$/, /image/],
];

const typeFits = (url: string, response: Response) => {
  const rule = TYPES.find(([path]) => path.test(url));
  return !rule || rule[1].test(response.headers.get('Content-Type') ?? '');
};

/**
 * Fetch each file missing from the precache and store it, only from the build this worker holds
 * (eng review D8; docs/adr/0007). Hosting is undecided (T054), so a host may answer an
 * unknown path with the app page and a 200. Before anything is fetched, every missing file must
 * be listed in the server's sw.js (by URL, and by revision where it has one). Each body must then
 * match its revision, an MD5 of the file, or, for a hashed file, carry its own Content-Type.
 * sw.js is read again after the fetches, so a deploy in between is caught. If any check fails the
 * server has moved on: nothing is stored, and the caller installs the new build whole.
 */
export async function repairMissing(
  files: readonly PrecacheFile[],
  deps: RepairDeps,
): Promise<'repaired' | 'new-build'> {
  const missing: PrecacheFile[] = [];
  for (const file of files) if (!(await deps.isCached(file))) missing.push(file);
  if (missing.length === 0) return 'repaired';

  const worker = await deps.serverWorker();
  const listed = (file: PrecacheFile) =>
    worker.includes(`"${file.url}"`) && (file.revision == null || worker.includes(file.revision));
  if (!missing.every(listed)) return 'new-build';

  const fetched: { file: PrecacheFile; body: ArrayBuffer; response: Response }[] = [];
  for (const file of missing) {
    const response = await deps.fetch(file.url);
    if (!response.ok) {
      const gone = response.status === 404 || response.status === 410;
      if (gone) return 'new-build';
      throw new Error(`${file.url}: HTTP ${response.status}`);
    }
    const body = await response.arrayBuffer();
    const fits =
      file.revision == null
        ? typeFits(file.url, response)
        : md5(new Uint8Array(body)) === file.revision;
    if (!fits) return 'new-build';
    fetched.push({ file, body, response });
  }

  if ((await deps.serverWorker()) !== worker) return 'new-build';
  for (const { file, body, response } of fetched) await deps.put(file, body, response);
  return 'repaired';
}

/** The service worker's answer to CACHE_PHASE_2. */
export interface OfflineStatus {
  /** Every second-phase file is cached. The first phase is, whenever this worker is active. */
  phase2: boolean;
  /** The catalog file this worker precached, or null when the build had none. */
  catalogFile: string | null;
}
