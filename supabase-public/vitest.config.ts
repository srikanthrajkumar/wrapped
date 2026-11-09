import { defineConfig } from 'vitest/config';

// The public-data stack's tests (ADR 0009): the Schedule's bucket and function, against the
// second local stack (`npx supabase start --workdir supabase-public`). `npm run test:server`
// runs them after the personal-data stack's.
export default defineConfig({
  test: {
    name: 'server-public',
    root: new URL('.', import.meta.url).pathname,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
