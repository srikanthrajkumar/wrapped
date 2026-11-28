import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { CATALOG_FILE } from './src/catalog/load.ts';
import { isPhase2 } from './src/precache-phases.ts';
import { PRIVACY_POLICY_FILE, PRIVACY_POLICY_PATH, privacyPage } from './src/privacy/page.ts';

// The local restore test builds beside the ordinary build, never over it
// (playwright.server.config.ts).
const outDir = fileURLToPath(new URL(process.env.WRAPPED_OUT_DIR ?? './dist', import.meta.url));
const appVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version?: string;
  }
).version;
const SW_FILE = 'sw.js';

// The precache's per-file cap. Workbox's default is 2 MiB, and the full snapshot is already
// 2.3 MB raw (448 KB brotli), so the default would fail the build. The download budget is
// enforced on compressed sizes by tools/size-budget/check.mjs, not here.
const MAX_PRECACHED_FILE_BYTES = 8 * 1024 * 1024;

// The catalog snapshot the build copies in (CONTRIBUTING.md). Git never holds it, so a build
// without one (CI, a fresh clone) still works, with search empty.
function catalogFile(): string | null {
  const dir = fileURLToPath(new URL('./public/catalog', import.meta.url));
  let files: string[];
  try {
    files = readdirSync(dir).filter((name) => CATALOG_FILE.test(name));
  } catch {
    return null;
  }
  if (files.length > 1) {
    throw new Error(
      `app/public/catalog holds ${files.length} snapshots; keep only the current one`,
    );
  }
  const file = files[0];
  if (!file) return null;
  // The phone refuses a file whose bytes don't match its name, so never ship one.
  const hash = createHash('sha256')
    .update(readFileSync(`${dir}/${file}`))
    .digest('hex');
  if (`catalog.${hash}.json` !== file) throw new Error(`${file} does not match its hash`);
  return file;
}

/**
 * The privacy policy (app/src/privacy/page.ts) as a plain document, privacy.html, beside the app:
 * Cloudflare serves it at /privacy, and the service worker lets it through (sw.ts). The dev and
 * preview servers answer /privacy the same way, so the e2e reads it as the phone does.
 */
function privacyPagePlugin(): Plugin {
  const css = () => readFileSync(new URL('./src/styles/app.css', import.meta.url), 'utf8');
  const answer = (page: () => string) => (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== PRIVACY_POLICY_PATH) return next();
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(page());
    });
  };
  return {
    name: 'privacy-page',
    configureServer: answer(() => privacyPage({ css: css() })),
    configurePreviewServer: answer(() => readFileSync(`${outDir}/${PRIVACY_POLICY_FILE}`, 'utf8')),
    generateBundle(_options, bundle) {
      // The app's own font file, already in the build under its hashed name.
      const font = Object.values(bundle).find(
        (file) =>
          file.type === 'asset' && /\/source-sans-3-latin-[^/]*\.woff2$/.test(file.fileName),
      );
      this.emitFile({
        type: 'asset',
        fileName: PRIVACY_POLICY_FILE,
        source: privacyPage({ css: css(), fontUrl: font && `/${font.fileName}` }),
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    privacyPagePlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'carnatic.live',
        short_name: 'carnatic.live',
        description:
          'Log the concerts you hear in the Chennai December season, with their ragas and songs, even offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // The dark theme's background (DESIGN.md), so the splash never flashes white.
        background_color: '#090b0c',
        theme_color: '#090b0c',
        // The app icon (DESIGN.md "The mark").
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*'],
        // Cloudflare's own files (ADR 0008), never served: precached, they would come back as
        // the app page. tools/size-budget/check.mjs skips the same list.
        // The files only crawlers and link previews read (robots.txt, the sitemap, the share
        // image) and the privacy policy are never the phone's download either; sw.ts lets them
        // through to the server.
        globIgnores: [
          '_headers',
          '.assetsignore',
          'robots.txt',
          'sitemap.xml',
          'og.png',
          PRIVACY_POLICY_FILE,
        ],
        maximumFileSizeToCacheInBytes: MAX_PRECACHED_FILE_BYTES,
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
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion ?? '0.0.0'),
  },
  build: {
    outDir,
    target: 'es2022',
  },
});
