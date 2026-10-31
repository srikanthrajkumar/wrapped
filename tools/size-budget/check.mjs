// Size budget (constitution V, SC-009): brotli-compress what the phone downloads and fail
// the build when the first install passes 2 MB or the second download passes a further 3 MB.
//
// Usage: node tools/size-budget/check.mjs [distDir]   (default: app/dist)
//
// Which file belongs to which phase comes from `precache-phases.json` in the build output,
// written by the service worker build (T028): { "phase1": [paths], "phase2": [paths] }.
// Every other file in the build must appear in exactly one phase, so a file the manifest
// forgets can't slip past the budget. Until the manifest exists, every file counts toward
// the first install.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

// Decimal megabytes, the stricter reading of "2 MB" and "3 MB".
const BUDGETS = { phase1: 2_000_000, phase2: 3_000_000 };
const MANIFEST = 'precache-phases.json';

const root = resolve(import.meta.dirname, '../..');
const distDir = resolve(process.argv[2] ?? join(root, 'app/dist'));

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`size-budget: ${message}`);
  process.exit(1);
}

if (!statSync(distDir, { throwIfNoEntry: false })?.isDirectory()) {
  fail(`no build output at ${distDir}. Run the app build first.`);
}

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
  const link = entries.find((entry) => entry.isSymbolicLink());
  if (link)
    fail(`${join(link.parentPath, link.name)} is a symlink; the build must hold real files.`);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(distDir, join(entry.parentPath, entry.name)));
}

/** @param {string} path */
function brotliSize(path) {
  /** @type {Buffer} */
  let bytes;
  try {
    bytes = readFileSync(join(distDir, path));
  } catch (error) {
    fail(`cannot read ${path} (${/** @type {NodeJS.ErrnoException} */ (error).code}).`);
  }
  return brotliCompressSync(bytes, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
    },
  }).length;
}

const built = listFiles(distDir).filter((path) => path !== MANIFEST);
if (built.length === 0) fail(`the build at ${distDir} has no files.`);

/** @returns {{ phase1: string[], phase2: string[] }} */
function readPhases() {
  const manifestPath = join(distDir, MANIFEST);
  const manifest = statSync(manifestPath, { throwIfNoEntry: false });
  if (!manifest) return { phase1: built, phase2: [] };
  if (!manifest.isFile()) fail(`${MANIFEST} is not a file.`);

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    fail(`${MANIFEST} is not valid JSON.`);
  }
  const isList = (/** @type {unknown} */ value) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');
  const { phase1, phase2 } = /** @type {{ phase1?: unknown, phase2?: unknown }} */ (parsed ?? {});
  if (!isList(phase1) || !isList(phase2)) {
    fail(`${MANIFEST} needs "phase1" and "phase2" lists of file paths.`);
  }
  const lists = {
    phase1: /** @type {string[]} */ (phase1),
    phase2: /** @type {string[]} */ (phase2),
  };
  if (lists.phase1.length === 0) fail(`${MANIFEST} lists no first-install files.`);

  const builtSet = new Set(built);
  const seen = new Set();
  for (const path of [...lists.phase1, ...lists.phase2]) {
    // Manifests may write paths as site URLs ("/index.html"); they are relative to the build.
    const inside = relative(distDir, resolve(distDir, path.replace(/^\/+/, '')));
    if (inside.split(sep)[0] === '..' || isAbsolute(inside)) fail(`${path} is outside the build.`);
    if (seen.has(inside)) fail(`${path} is listed more than once.`);
    if (!builtSet.has(inside)) fail(`${path} is listed but not in the build.`);
    seen.add(inside);
  }
  const unlisted = built.filter((path) => !seen.has(path));
  if (unlisted.length > 0) {
    fail(
      `${unlisted.length} built file(s) are in neither phase, e.g. ${unlisted.slice(0, 3).join(', ')}.`,
    );
  }
  return lists;
}

const phases = readPhases();

const kb = (/** @type {number} */ n) => `${(n / 1000).toFixed(1)} KB`;
let failed = false;

for (const phase of /** @type {const} */ (['phase1', 'phase2'])) {
  const sizes = phases[phase].map((path) => ({ path, size: brotliSize(path) }));
  const total = sizes.reduce((sum, file) => sum + file.size, 0);
  const over = total > BUDGETS[phase];
  failed ||= over;

  console.log(
    `${phase}: ${kb(total)} of ${kb(BUDGETS[phase])} (brotli)${over ? '  OVER BUDGET' : ''}`,
  );
  for (const { path, size } of sizes.sort((a, b) => b.size - a.size).slice(0, 8)) {
    console.log(`  ${kb(size).padStart(10)}  ${path}`);
  }
}

if (failed) fail('over budget (constitution V).');
