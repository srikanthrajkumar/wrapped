import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// The end-to-end tests that need the local Supabase stack (T080, app/e2e/restore.spec.ts), run by
// `npm run test:server` after the stack is up, never by `npm run e2e`: the ordinary e2e build
// has no server, as CI's `npm run check` expects. This build points at the local stack and signs
// in a password user instead of Google (VITE_TEST_PASSWORD_SIGNIN), a branch every other build
// drops. It builds into its own folder on its own port, so it never replaces or collides with
// the ordinary e2e build on 4319.

const port = 4329;
const outDir = './node_modules/.cache/restore-e2e';
// A second build, as production signs in: Google's own button, with a stand-in client id; the
// test serves its own stand-in for Google's script (google-sign-in.spec.ts).
const googlePort = 4330;
const googleOutDir = './node_modules/.cache/google-e2e';
export const STAND_IN_GOOGLE_CLIENT_ID = 'stand-in.apps.googleusercontent.com';

/** The running local stack's address and keys, as `supabase status` prints them (local only). */
function localStack(): Record<string, string> {
  const out = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as Record<
    string,
    string
  >;
}

const stack = localStack();
// For the tests themselves: they make the password user through the admin API, and read what
// the server stored over the database connection. The local stack's own keys, never deployed.
process.env.WRAPPED_STACK = JSON.stringify({
  apiUrl: stack.API_URL,
  anonKey: stack.ANON_KEY,
  serviceRoleKey: stack.SERVICE_ROLE_KEY,
  dbUrl: stack.DB_URL,
});

const build = (dir: string, listen: number, env: Record<string, string>) => ({
  command: `npx vite build && npx vite preview --outDir ${dir} --port ${listen} --strictPort`,
  env: {
    WRAPPED_OUT_DIR: dir,
    VITE_PUBLIC_DATA_URL: '',
    VITE_SUPABASE_URL: stack.API_URL!,
    VITE_SUPABASE_ANON_KEY: stack.ANON_KEY!,
    ...env,
  },
  url: `http://localhost:${listen}`,
  reuseExistingServer: false,
  timeout: 180_000,
});

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'retain-on-failure',
    ...devices['iPhone 13'],
    browserName: 'chromium',
  },
  projects: [
    {
      name: 'restore',
      testMatch: ['restore.spec.ts', 'consent-not-writer.spec.ts'],
      use: { baseURL: `http://localhost:${port}` },
    },
    {
      name: 'google-sign-in',
      testMatch: 'google-sign-in.spec.ts',
      use: { baseURL: `http://localhost:${googlePort}` },
    },
  ],
  webServer: [
    build(outDir, port, { VITE_TEST_PASSWORD_SIGNIN: '1' }),
    build(googleOutDir, googlePort, { VITE_GOOGLE_CLIENT_ID: STAND_IN_GOOGLE_CLIENT_ID }),
  ],
});
