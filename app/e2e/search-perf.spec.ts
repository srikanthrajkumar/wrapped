// Search latency (T048, SC-007, constitution V): with the CPU throttled 4x through the Chrome
// DevTools Protocol, the p95 from keystroke to results stays under 50 ms over the full
// snapshot, offline. It needs the private snapshot in app/public/catalog/, so like the golden
// set it runs locally and before each deploy, and skips in CI (CONTRIBUTING.md).
//
// Each keystroke is one search for what has been typed so far, over the golden set's ~100
// spellings from last season's sheet. Until the Item editor's search box exists (T044) this
// times the search call in the page, not the render after it; T113 re-measures on the phone.

import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { harnessScript } from './harness/build';
import type { Harness } from './harness/entry';

const CPU_SLOWDOWN = 4;
const BUDGET_MS = 50;

const catalogDir = new URL('../public/catalog/', import.meta.url);
const snapshot = (() => {
  try {
    return readdirSync(catalogDir).find((name) => /^catalog\.[0-9a-f]{64}\.json$/.test(name));
  } catch {
    return undefined;
  }
})();

const queries = (
  JSON.parse(
    readFileSync(new URL('../../tools/golden-set/golden.json', import.meta.url), 'utf8'),
  ) as { query: string }[]
).map((c) => c.query);

test.skip(!snapshot, 'needs the catalog snapshot in app/public/catalog/');

test('search p95 from keystroke to results is under 50 ms at 4x CPU slowdown (SC-007)', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.addScriptTag({ content: await harnessScript() });

  // The index is built once, at launch, unthrottled; its cost is reported, not judged here.
  const buildMs = await page.evaluate(async (file) => {
    const { verifySnapshot, buildIndex } = (globalThis as unknown as { harness: Harness }).harness;
    const response = await fetch(`/catalog/${file}`);
    const catalog = await verifySnapshot(file, await response.arrayBuffer());
    const started = performance.now();
    const index = buildIndex(catalog);
    (globalThis as unknown as { index: typeof index }).index = index;
    return performance.now() - started;
  }, snapshot!);

  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  const timings = await page.evaluate(async (queries) => {
    const { index } = globalThis as unknown as {
      index: ReturnType<Harness['buildIndex']>;
    };
    const times: { typed: string; ms: number }[] = [];
    for (const query of queries) {
      for (let end = 1; end <= query.length; end += 1) {
        const typed = query.slice(0, end);
        const started = performance.now();
        index.search(typed);
        times.push({ typed, ms: performance.now() - started });
        // Let the page breathe between keystrokes, as typing does.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    return times;
  }, queries);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const sorted = timings.map((t) => t.ms).sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  const slowest = [...timings].sort((a, b) => b.ms - a.ms).slice(0, 10);
  const report = {
    keystrokes: sorted.length,
    p50: Math.round(at(0.5)),
    p95: Math.round(at(0.95)),
    max: Math.round(sorted.at(-1)!),
    indexBuildMs: Math.round(buildMs),
    slowest: slowest.map((t) => `${JSON.stringify(t.typed)} ${Math.round(t.ms)} ms`),
  };
  await testInfo.attach('search-latency.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  console.log(`search latency at ${CPU_SLOWDOWN}x slowdown:`, JSON.stringify(report, null, 2));

  expect(at(0.95), `p95 over ${sorted.length} keystrokes`).toBeLessThan(BUDGET_MS);
});
