// The repository is public and a commit stays in history for good. These files must never be
// tracked, whatever .gitignore says: `git add -f` or a moved folder gets past an ignore rule.
// This checks the current index; it does not scan history, so it catches a leak before merge
// only when it runs on every commit or pull request.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN = [
  // The private catalog snapshot, wherever it ends up, compressed or not (CONTRIBUTING.md).
  /^app\/public\/catalog\//,
  /(^|\/)catalog\.[0-9a-f]{8,}\.json(\.(br|gz))?$/i,
  // Secrets: every .env file except the committed list of names, plus *.env and .envrc.
  /(^|\/)\.env(?!\.example$)(\..*)?$/,
  /(^|\/)[^/]+\.env$/,
  /(^|\/)\.envrc$/,
];

export function forbiddenPaths(paths: string[]) {
  return paths.filter((path) => FORBIDDEN.some((pattern) => pattern.test(path)));
}

const repoRoot = resolve(import.meta.dirname, '../..');

describe('files git tracks', () => {
  it('include no catalog snapshot and no .env file', () => {
    // -z keeps unusual file names unquoted; --full-name keeps paths repository-relative.
    const tracked = execFileSync(
      'git',
      ['-C', repoRoot, 'ls-files', '-z', '--cached', '--full-name'],
      { encoding: 'utf8' },
    )
      .split('\0')
      .filter(Boolean);
    expect(tracked.length).toBeGreaterThan(0);
    expect(forbiddenPaths(tracked)).toEqual([]);
  });

  it('recognise the paths it guards', () => {
    expect(
      forbiddenPaths([
        'app/public/catalog/catalog.3f9a1c2b.json',
        'elsewhere/catalog.3F9A1C2B44D1.json.br',
        '.env',
        'supabase/.env',
        '.env.local',
        'deploy/prod.env',
        '.envrc',
        '.env.example',
        'app/tests/fixtures/catalog-v1.json',
        'app/src/catalog/load.ts',
        'app/src/vite-env.d.ts',
      ]),
    ).toEqual([
      'app/public/catalog/catalog.3f9a1c2b.json',
      'elsewhere/catalog.3F9A1C2B44D1.json.br',
      '.env',
      'supabase/.env',
      '.env.local',
      'deploy/prod.env',
      '.envrc',
    ]);
  });
});
