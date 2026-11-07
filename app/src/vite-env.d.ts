/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />

interface ImportMetaEnv {
  /** `catalog.<sha256>.json`, or null for a build with no snapshot (vite.config.ts). */
  readonly VITE_CATALOG_FILE: string | null;
  /** The app's version, from app/package.json (vite.config.ts). */
  readonly VITE_APP_VERSION: string;
  /** The Schedule feed's URL (T060); unset in a build with no feed. */
  readonly VITE_SCHEDULE_URL?: string;
  /** The Supabase project's API address; unset in a build without a server (app/.env.example). */
  readonly VITE_SUPABASE_URL?: string;
  /** The Supabase public (anon) key, safe in the browser by design (CONTRIBUTING.md). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
