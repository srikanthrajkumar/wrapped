import { defineConfig } from 'vitest/config';

// One Vitest run covers the app and the tools (T005).
export default defineConfig({
  test: {
    projects: [
      'app/vitest.config.ts',
      {
        test: {
          name: 'tools',
          include: ['tools/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
