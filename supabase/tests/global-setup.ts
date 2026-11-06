// Finds the running local stack once and hands its addresses to the tests. The keys are the
// local stack's own, printed by `supabase status`; nothing here is a deployed secret.

import { execFileSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

export interface Stack {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    stack: Stack;
  }
}

function readStatus(): Record<string, string> {
  let out: string;
  try {
    out = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // Written to stderr first: Vitest 5.0 crashes while printing an error thrown from global
    // setup (`code.charCodeAt is not a function`), which would hide this message.
    const cliOutput = String((error as { stderr?: unknown }).stderr ?? '').trim();
    const message =
      'The local Supabase stack is not reachable. Start it with `npx supabase start` ' +
      '(as `sg docker -c "…"` if your shell is not yet in the docker group).';
    process.stderr.write(
      `\n${message}\n${cliOutput ? `supabase status said: ${cliOutput}\n` : ''}\n`,
    );
    throw new Error(message, { cause: error });
  }
  return JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as Record<
    string,
    string
  >;
}

export default function setup(project: TestProject): void {
  const status = readStatus();
  const pick = (key: string): string => {
    const value = status[key];
    if (!value) throw new Error(`supabase status gave no ${key}`);
    return value;
  };
  project.provide('stack', {
    apiUrl: pick('API_URL'),
    anonKey: pick('ANON_KEY'),
    serviceRoleKey: pick('SERVICE_ROLE_KEY'),
    dbUrl: pick('DB_URL'),
  });
}
