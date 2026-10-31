import { defineConfig, devices } from '@playwright/test';

// Not Vite's default preview port (4173), so a preview left running never collides.
const port = 4319;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
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
    },
  ],
  webServer: {
    // Tests run against the production build (the service worker joins it in T028).
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    // Never reuse whatever is already on the port: it may be a stale or unrelated build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
