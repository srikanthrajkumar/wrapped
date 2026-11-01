// Builds e2e/harness/entry.ts into one script, in memory, for the tests to inject into the
// app's page. The app's own build is untouched: nothing test-only is shipped or precached.

import { fileURLToPath } from 'node:url';
import { build, type Rolldown } from 'vite';

const entry = fileURLToPath(new URL('./entry.ts', import.meta.url));
let built: Promise<string> | null = null;

export function harnessScript(): Promise<string> {
  built ??= (async () => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      root: fileURLToPath(new URL('../..', import.meta.url)),
      // React, reached through the store's live-query hooks, reads this; a library build
      // leaves it for the bundler that never comes.
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        write: false,
        minify: false,
        lib: { entry, formats: ['iife'], name: 'wrappedHarness', fileName: 'harness' },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[];
    const chunk = outputs.flatMap((output) => output.output).find((file) => file.type === 'chunk');
    if (!chunk || chunk.type !== 'chunk') throw new Error('the harness built no script');
    return chunk.code;
  })();
  return built;
}
