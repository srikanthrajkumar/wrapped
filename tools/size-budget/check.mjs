// Size budget (constitution V, SC-009): brotli-compress what the phone downloads and fail
// the build when the first install passes 2 MB or the second download passes a further 3 MB.
//
// Usage: node tools/size-budget/check.mjs [distDir]   (default: app/dist)
//
// Which file belongs to which phase comes from `precache-phases.json` in the build output,
// written by the service worker build (T028): { "phase1": [paths], "phase2": [paths] }.
// Until that exists, every file in the build counts toward the first install.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

// Decimal megabytes, the stricter reading of "2 MB" and "3 MB".
const BUDGETS = { phase1: 2_000_000, phase2: 3_000_000 };

const root = resolve(import.meta.dirname, '../..');
const distDir = resolve(process.argv[2] ?? join(root, 'app/dist'));

if (!existsSync(distDir)) {
  console.error(`size-budget: no build output at ${distDir}. Run the app build first.`);
  process.exit(1);
}

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(distDir, join(entry.parentPath, entry.name)));
}

/** @param {string} path */
function brotliSize(path) {
  const bytes = readFileSync(join(distDir, path));
  return brotliCompressSync(bytes, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
    },
  }).length;
}

const manifestPath = join(distDir, 'precache-phases.json');
/** @type {{ phase1?: string[], phase2?: string[] }} */
const phases = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { phase1: listFiles(distDir), phase2: [] };

const kb = (/** @type {number} */ n) => `${(n / 1000).toFixed(1)} KB`;
let failed = false;

for (const phase of /** @type {const} */ (['phase1', 'phase2'])) {
  const files = phases[phase] ?? [];
  const sizes = files.map((path) => ({ path, size: brotliSize(path) }));
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

if (failed) {
  console.error('size-budget: over budget (constitution V).');
  process.exit(1);
}
