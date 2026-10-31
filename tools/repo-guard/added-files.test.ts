import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const script = join(import.meta.dirname, 'added-files.mjs');

const made: string[] = [];
afterAll(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// CI runners have no git identity, so every commit here names its own.
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-guard-'));
  made.push(dir);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: gitEnv }).trim();
  const commit = (files: Record<string, string | null>) => {
    for (const [path, body] of Object.entries(files)) {
      if (body === null) {
        git('rm', '-q', path);
      } else {
        mkdirSync(join(dir, path, '..'), { recursive: true });
        writeFileSync(join(dir, path), body);
        git('add', '-f', path);
      }
    }
    git('commit', '-q', '-m', 'change');
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const root = commit({ 'README.md': 'hello' });
  return { dir, git, commit, root };
}

function run(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
}

const catalog = 'app/public/catalog/catalog.deadbeef00.json';

describe('files added in a commit range', () => {
  it('passes a range that adds only ordinary files', () => {
    const repo = makeRepo();
    repo.commit({ 'app/src/a.ts': 'export {}', '.env.example': 'KEY=' });
    const result = run(repo.dir, repo.root, 'HEAD');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('none forbidden');
  });

  it('fails a catalog snapshot added and deleted again', () => {
    const repo = makeRepo();
    const added = repo.commit({ [catalog]: '{}' });
    repo.commit({ [catalog]: null });
    const result = run(repo.dir, repo.root, 'HEAD');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(catalog);
    expect(result.stderr).toContain(added.slice(0, 7));
  });

  it('fails a secret moved into a forbidden name', () => {
    const repo = makeRepo();
    repo.commit({ 'notes.txt': 'SECRET=1' });
    repo.git('mv', 'notes.txt', '.env.local');
    repo.git('commit', '-q', '-m', 'move');
    const result = run(repo.dir, repo.root, 'HEAD');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.env.local');
  });

  it('ignores what was added before the range', () => {
    const repo = makeRepo();
    repo.commit({ '.envrc': 'export X=1' });
    const base = repo.commit({ '.envrc': null });
    repo.commit({ 'app/src/b.ts': 'export {}' });
    expect(run(repo.dir, base, 'HEAD').status).toBe(0);
  });

  it('scans all history when the base is all zeros or unknown', () => {
    const repo = makeRepo();
    repo.commit({ '.envrc': 'export X=1' });
    repo.commit({ '.envrc': null });
    expect(run(repo.dir, '0'.repeat(40), 'HEAD').status).toBe(1);
    expect(run(repo.dir, 'f'.repeat(40), 'HEAD').status).toBe(1);
    expect(run(repo.dir).status).toBe(1);
  });

  it('fails when the head is not a commit', () => {
    const repo = makeRepo();
    const result = run(repo.dir, repo.root, 'f'.repeat(40));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not a commit');
  });
});
