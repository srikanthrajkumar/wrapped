import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'app',
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
