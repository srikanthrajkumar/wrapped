import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig } from 'wrangler';

// deploy.sh's two targets (docs/setup/staging.md): production on carnatic.live only, and staging
// on workers.dev only. Nothing here builds or deploys: the script runs only as far as its first
// stop, and the config is read as wrangler itself resolves it.
const script = join(import.meta.dirname, 'deploy.sh');
const config = join(import.meta.dirname, '../../app/wrangler.jsonc');

const stagingLine = 'Staging: wrapped-staging.srikanthrajkumar26.workers.dev (not carnatic.live)';

function deploy(...args: string[]) {
  return spawnSync('bash', [script, ...args], { encoding: 'utf8' });
}

describe('app/wrangler.jsonc', () => {
  it('puts production on carnatic.live only, with no workers.dev address', () => {
    const production = unstable_readConfig({ config });
    expect(production.name).toBe('wrapped');
    expect(production.workers_dev).toBe(false);
    expect(production.routes).toEqual([{ pattern: 'carnatic.live', custom_domain: true }]);
  });

  it('puts staging, wrapped-staging, on workers.dev only, with the same files', () => {
    const production = unstable_readConfig({ config });
    const staging = unstable_readConfig({ config, env: 'staging' });
    expect(staging.name).toBe('wrapped-staging');
    expect(staging.workers_dev).toBe(true);
    expect(staging.routes).toEqual([]);
    expect(staging.assets).toEqual(production.assets);
    expect(staging.compatibility_date).toBe(production.compatibility_date);
  });
});

describe('deploy.sh --staging', () => {
  it('says staging first and again where it stops', () => {
    const result = deploy('--staging');
    expect(result.status).toBe(1);
    expect(result.stdout.split('\n')[0]).toBe(stagingLine);
    expect(result.stderr).toContain('nothing was deployed');
    expect(result.stderr.trimEnd().split('\n').at(-1)).toBe(stagingLine);
  });

  it('takes --dry-run and --without-golden-set beside it, in any order', () => {
    const result = deploy('--dry-run', '--without-golden-set', '--staging');
    expect(result.status).toBe(1);
    expect(result.stdout.split('\n')[0]).toBe(stagingLine);
    expect(result.stderr).not.toContain('unknown option');
    expect(result.stderr).toContain('give the snapshot to deploy');
  });

  it('never says staging on a production run', () => {
    const result = deploy('--dry-run');
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain('Staging');
    expect(result.stderr).toContain('give the snapshot to deploy');
  });
});
