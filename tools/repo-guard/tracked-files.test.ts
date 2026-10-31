// The repository is public and a commit stays in history for good. These files must never be
// tracked, whatever .gitignore says: `git add -f` or a moved folder gets past an ignore rule.
// This checks the current index. A file added and deleted again in a pull request never shows
// here, so CI also runs added-files.mjs over every commit the pull request adds.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { forbiddenPaths } from './forbidden.mjs';

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
