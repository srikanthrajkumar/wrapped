import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'app',
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // No test ever reaches the real public-data project, whatever app/.env holds (ADR 0009).
    env: { VITE_PUBLIC_DATA_URL: '' },
  },
});
