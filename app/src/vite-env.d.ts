/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />

interface ImportMetaEnv {
  /** `catalog.<sha256>.json`, or null for a build with no snapshot (vite.config.ts). */
  readonly VITE_CATALOG_FILE: string | null;
  /** The app's version, from app/package.json (vite.config.ts). */
  readonly VITE_APP_VERSION: string;
}
