// Draws the link preview image, app/public/og.png (1200 × 630), from the app's own mark: Silk,
// the kolam and the wordmark (og.html). Run after changing the mark or the line:
//
//   node tools/og-image/build.mjs
//
// The output is committed, so the app build never runs this. Chromium draws the WebGL field in
// software (SwiftShader), so the same code draws the same picture on any machine (a few dozen
// pixels may differ by a level or two between runs, from the blur, so the bytes may not match);
// the PNG is then cut to a 256-colour palette to stay well under WhatsApp's preview limits.

import tailwindcss from '@tailwindcss/vite';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';

// The app's React plugin, installed under app/ rather than at the root.
const fromApp = createRequire(new URL('../../app/package.json', import.meta.url));
/** @type {() => import('vite').PluginOption} */
const react = (await import(pathToFileURL(fromApp.resolve('@vitejs/plugin-react')).href)).default;

const root = fileURLToPath(new URL('../..', import.meta.url));
const out = `${root}app/public/og.png`;
const MAX_BYTES = 200_000;

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': `${root}app/src` } },
  server: { port: 0, host: '127.0.0.1' },
});
await server.listen();
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  /** @type {Error[]} */
  const errors = [];
  page.on('pageerror', (error) => errors.push(error));
  const [url] = server.resolvedUrls?.local ?? [];
  if (!url) throw new Error('the Vite server gave no address');
  await page.goto(`${url}tools/og-image/og.html`);
  await page.waitForSelector('body[data-ready]', { timeout: 30_000 });
  if (errors.length) throw errors[0];
  const raw = await page.screenshot({ type: 'png' });
  const png = await sharp(raw)
    .png({ palette: true, colours: 256, dither: 0.6, effort: 10, compressionLevel: 9 })
    .toBuffer();
  if (png.length > MAX_BYTES) {
    throw new Error(`og.png is ${png.length} bytes, over the ${MAX_BYTES} byte limit`);
  }
  writeFileSync(out, png);
  console.log(`wrote app/public/og.png (${Math.round(png.length / 1000)} KB)`);
} finally {
  await browser.close();
  await server.close();
}
