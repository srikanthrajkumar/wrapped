import react from '@vitejs/plugin-react';
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { isPhase2 } from './src/precache-phases.ts';

const outDir = fileURLToPath(new URL('./dist', import.meta.url));
const SW_FILE = 'sw.js';

// The catalog snapshot the build copies in (CONTRIBUTING.md). Git never holds it, so a build
// without one (CI, a fresh clone) still works, with search empty.
function catalogFile(): string | null {
  const dir = fileURLToPath(new URL('./public/catalog', import.meta.url));
  let files: string[];
  try {
    files = readdirSync(dir).filter((name) => /^catalog\.[0-9a-f]{64}\.json$/.test(name));
  } catch {
    return null;
  }
  if (files.length > 1) {
    throw new Error(
      `app/public/catalog holds ${files.length} snapshots; keep only the current one`,
    );
  }
  return files[0] ?? null;
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Carnatic Wrapped',
        short_name: 'Wrapped',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Placeholders until the design system (T030) sets the palette and icons.
        background_color: '#ffffff',
        theme_color: '#ffffff',
      },
      injectManifest: {
        globPatterns: ['**/*'],
        // Record the two phases for the size check (tools/size-budget/check.mjs). The service
        // worker itself is downloaded at install, so it belongs to the first phase.
        manifestTransforms: [
          (entries) => {
            const urls = entries.map((entry) => entry.url);
            const phases = {
              phase1: [...urls.filter((url) => !isPhase2(url)), SW_FILE],
              phase2: urls.filter(isPhase2),
            };
            writeFileSync(`${outDir}/precache-phases.json`, `${JSON.stringify(phases, null, 2)}\n`);
            return { manifest: entries, warnings: [] };
          },
        ],
      },
    }),
  ],
  define: {
    'import.meta.env.VITE_CATALOG_FILE': JSON.stringify(catalogFile()),
  },
  build: {
    outDir,
    target: 'es2022',
  },
});
