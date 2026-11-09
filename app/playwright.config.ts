import { defineConfig, devices } from '@playwright/test';

// Not Vite's default preview port (4173), so a preview left running never collides.
const port = 4319;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  // Every test has its own browser context and no test shares state with another, so the long
  // files (nothing-lost.spec.ts) spread over the workers instead of holding one to the end.
  // The workers stay at Playwright's default, half the cores: two on a 4-core box shared
  // with other agents, and two on CI's runner.
  fullyParallel: true,
  // No retries: a flaky test on a data-loss path must fail loudly (constitution IV).
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // An iPhone-sized phone on Chromium: the offline tests use context.setOffline,
      // and the search timing test (T048) needs Chromium's CPU throttling.
      name: 'phone',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
      testIgnore: 'search-perf.spec.ts',
    },
    // The iPhone's own engine, for what shows frame by frame (the bottom bar). Opt in with
    // WEBKIT=1 once `npx playwright install --with-deps webkit` has run.
    ...(process.env.WEBKIT
      ? [
          {
            name: 'iphone-webkit',
            use: { ...devices['iPhone 13'] },
            testMatch: 'bottom-bar.spec.ts',
          },
        ]
      : []),
    // The search timing test (T048, SC-007) runs last and alone. Its 4x CPU throttle
    // multiplies any contention, so beside other tests it measured load, not search
    // (34-44 ms on a quiet machine, 78 ms on a busy one). It starts only once every other
    // project has finished, in one worker, so nothing else in the suite runs beside it.
    {
      name: 'search-perf',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
      testMatch: 'search-perf.spec.ts',
      dependencies: ['phone', ...(process.env.WEBKIT ? ['iphone-webkit'] : [])],
      workers: 1,
    },
  ],
  webServer: {
    // Tests run against the production build (the service worker joins it in T028).
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    // Built with no public-data URL, whatever app/.env holds: the e2e never reaches the real
    // project (ADR 0009). Vite takes a VITE_ value already in the environment over .env files.
    env: { VITE_PUBLIC_DATA_URL: '' },
    url: `http://localhost:${port}`,
    // Never reuse whatever is already on the port: it may be a stale or unrelated build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
