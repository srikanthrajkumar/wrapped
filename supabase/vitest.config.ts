import { defineConfig } from 'vitest/config';

// The server tests run against the local Supabase stack (`supabase start`), so they sit
// outside `npm test` and run with `npm run test:server` (T067, T068).
export default defineConfig({
  test: {
    name: 'server',
    root: new URL('.', import.meta.url).pathname,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/global-setup.ts'],
    // Each test signs in fresh users, so the files can run side by side.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
