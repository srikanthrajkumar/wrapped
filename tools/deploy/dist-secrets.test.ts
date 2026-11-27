import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// deploy.sh's last guard before upload (T111): no secret key may ship in app/dist.
const script = join(import.meta.dirname, 'dist-secrets.sh');

const made: string[] = [];
afterAll(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function makeDist(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'dist-secrets-'));
  made.push(dir);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

function scan(dir: string) {
  return spawnSync('bash', [script, dir], { encoding: 'utf8' });
}

// Made up here, never real keys.
const keyChars = (n: number) => randomBytes(n).toString('base64url').slice(0, n);
const fakeSecretKey = `sb_secret_${keyChars(40)}`;
const fakeClientSecret = `GOCSPX-${keyChars(28)}`;

// What supabase-js puts in every build (its key-kind check), as minified in the bundle.
const supabaseJs =
  'eaders,jn=e=>e.startsWith(`sb_publishable_`)||e.startsWith(`sb_secret_`),Mn=new Set,';

describe('dist-secrets.sh', () => {
  it('passes a build holding supabase-js, publishable key and all', () => {
    const dir = makeDist({
      'index.html': '<!doctype html>',
      'assets/dist-abc.js': supabaseJs + `const k="sb_publishable_${keyChars(31)}";`,
      'assets/other.js': "'GOCSPX-'",
    });
    const result = scan(dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('stops a build holding a Supabase secret key, naming the file but not the key', () => {
    const dir = makeDist({
      'assets/dist-abc.js': supabaseJs,
      'assets/leak.js': `const k="${fakeSecretKey}";`,
    });
    const result = scan(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('a Supabase secret key (sb_secret_…)');
    expect(result.stdout).toContain('leak.js');
    expect(result.stdout).not.toContain('dist-abc.js');
    expect(result.stdout + result.stderr).not.toContain(fakeSecretKey);
  });

  it("stops a build holding Google's client secret", () => {
    const dir = makeDist({ 'deep/in/it.map': `{"x":"${fakeClientSecret}"}` });
    const result = scan(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Google's client secret (GOCSPX-…)");
    expect(result.stdout + result.stderr).not.toContain(fakeClientSecret);
  });

  it('names both when both are there', () => {
    const dir = makeDist({ 'a.js': fakeSecretKey, 'b.js': fakeClientSecret });
    const result = scan(dir);
    expect(result.status).toBe(1);
    expect(result.stdout.trim().split('\n')).toHaveLength(2);
  });

  it('refuses a directory that is not there', () => {
    expect(scan(join(tmpdir(), 'no-such-dist-secrets-dir')).status).toBe(2);
  });
});
