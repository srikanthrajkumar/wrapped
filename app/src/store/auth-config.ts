// The server this build talks to, from the build's env (app/.env.example). Kept apart from
// auth.ts so code outside the Vite build (the server tests) can use auth.ts.

import type { AuthConfig } from './auth';

/** Null for a build without a server (tests, CI, phone-only): logging works, sync waits. */
export function buildAuthConfig(): AuthConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey, appVersion: import.meta.env.VITE_APP_VERSION };
}
