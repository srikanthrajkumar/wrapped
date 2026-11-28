import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Search engines must never index staging, and must index carnatic.live (docs/setup/staging.md).
// deploy.sh adds noindex to the staging build only, and stops a production build that has it.
const script = join(import.meta.dirname, 'noindex.sh');
const publicDir = join(import.meta.dirname, '../../app/public');

const made: string[] = [];
afterAll(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function makeDist(withHeaders: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'noindex-'));
  made.push(dir);
  if (withHeaders) copyFileSync(join(publicDir, '_headers'), join(dir, '_headers'));
  return dir;
}

function noindex(action: string, dir: string) {
  return spawnSync('bash', [script, action, dir], { encoding: 'utf8' });
}

describe('noindex.sh', () => {
  it('finds no noindex in the production headers, app/public/_headers', () => {
    expect(noindex('check', publicDir).status).toBe(1);
  });

  it('adds noindex on every path to a staging build, keeping its cache rules', () => {
    const dir = makeDist(true);
    const before = readFileSync(join(dir, '_headers'), 'utf8');
    expect(noindex('add', dir).status).toBe(0);
    expect(noindex('check', dir).status).toBe(0);
    const after = readFileSync(join(dir, '_headers'), 'utf8');
    expect(after.startsWith(before)).toBe(true);
    expect(after).toContain('\n/*\n  X-Robots-Tag: noindex, nofollow\n');
  });

  it('adds it once, however often it runs', () => {
    const dir = makeDist(true);
    noindex('add', dir);
    const once = readFileSync(join(dir, '_headers'), 'utf8');
    expect(noindex('add', dir).status).toBe(0);
    expect(readFileSync(join(dir, '_headers'), 'utf8')).toBe(once);
  });

  it('makes _headers when a build has none', () => {
    const dir = makeDist(false);
    expect(noindex('check', dir).status).toBe(1);
    expect(noindex('add', dir).status).toBe(0);
    expect(readFileSync(join(dir, '_headers'), 'utf8')).toMatch(
      /^# Staging only.*\n\/\*\n {2}X-Robots-Tag: noindex, nofollow\n$/,
    );
  });

  it('refuses a missing directory or action', () => {
    expect(noindex('check', join(tmpdir(), 'no-such-dist-noindex')).status).toBe(2);
    expect(noindex('remove', makeDist(true)).status).toBe(2);
  });
});
