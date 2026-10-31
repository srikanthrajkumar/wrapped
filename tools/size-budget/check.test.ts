import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const script = join(import.meta.dirname, 'check.mjs');

const made: string[] = [];
afterAll(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function makeDist(files: Record<string, string | Buffer>) {
  const dir = mkdtempSync(join(tmpdir(), 'size-budget-'));
  made.push(dir);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

function run(dir: string) {
  return spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
}

const manifest = (phases: unknown) => JSON.stringify(phases);

describe('size budget', () => {
  it('passes a small build with no manifest', () => {
    expect(run(makeDist({ 'index.html': '<!doctype html>' })).status).toBe(0);
  });

  // Brotli at quality 11 on 2 MB takes seconds, more when the suite runs in parallel.
  it('fails a first install over 2 MB', () => {
    const result = run(makeDist({ 'big.bin': randomBytes(2_100_000) }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('over budget');
  }, 30_000);

  it('fails an empty build', () => {
    const result = run(makeDist({}));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('has no files');
  });

  it('fails a build that holds a symlink', () => {
    const dist = makeDist({ 'index.html': 'a' });
    symlinkSync(join(dist, 'index.html'), join(dist, 'linked.html'));
    const result = run(dist);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is a symlink');
  });

  it('passes a manifest that lists every file once, site-rooted paths included', () => {
    const dist = makeDist({
      'index.html': 'a',
      'cards.js': 'b',
      'precache-phases.json': manifest({ phase1: ['/index.html'], phase2: ['cards.js'] }),
    });
    expect(run(dist).status).toBe(0);
  });

  it('fails a manifest that is not JSON', () => {
    const result = run(makeDist({ 'index.html': 'a', 'precache-phases.json': '{' }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is not valid JSON');
  });

  const both = ['index.html', 'cards.js'];
  it.each([
    ['a missing phase list', { phase1: both }, 'needs "phase1" and "phase2"'],
    ['an empty first phase', { phase1: [], phase2: both }, 'no first-install'],
    ['a file in neither phase', { phase1: ['index.html'], phase2: [] }, 'in neither phase'],
    ['a file in both phases', { phase1: both, phase2: ['cards.js'] }, 'more than once'],
    ['a path outside the build', { phase1: [...both, '../index.html'], phase2: [] }, 'outside'],
    ['a listed file that is missing', { phase1: [...both, 'gone.js'], phase2: [] }, 'not in the'],
  ])('fails a manifest with %s, with a clear message', (_name, phases, message) => {
    const dist = makeDist({
      'index.html': 'a',
      'cards.js': 'b',
      'precache-phases.json': manifest(phases),
    });
    const result = run(dist);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('size-budget: ');
    expect(result.stderr).toContain(message);
    expect(result.stderr).not.toContain('    at ');
  });
});
