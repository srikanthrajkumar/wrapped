// Required test (constitution IV; review of PR #5, A7): "Try again" refills the precache only
// from the build the service worker holds. A file whose revision the server no longer serves,
// or a hashed file the server no longer has, means a new build is out: nothing is stored under
// the old build's keys, and the worker is updated instead, so an offline launch never mixes two
// builds' files.

import { describe, expect, it, vi } from 'vitest';
import { repairMissing, type PrecacheFile } from '../src/precache-phases';

const indexHtml: PrecacheFile = { url: 'index.html', revision: '6e1f2bbb46109e11c20072e3e233dd50' };
const script: PrecacheFile = { url: 'assets/index-Bd17z0YL.js', revision: null };

/** A server holding `files` (url → body), and whose sw.js lists `revisions`. */
function server(files: Record<string, string>, revisions: string[]) {
  const put = vi.fn(async () => undefined);
  return {
    put,
    deps: {
      isCached: async () => false,
      fetch: async (url: string) =>
        url in files ? new Response(files[url]) : new Response('missing', { status: 404 }),
      put,
      serverWorker: async () => `self.__WB_MANIFEST=${JSON.stringify(revisions)}`,
    },
  };
}

describe('repairing the precache', () => {
  it('stores the missing files when the server still serves this build', async () => {
    const { deps, put } = server({ 'index.html': '<html>', 'assets/index-Bd17z0YL.js': 'code' }, [
      indexHtml.revision!,
    ]);
    expect(await repairMissing([indexHtml, script], deps)).toBe('repaired');
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('A7: stores nothing when the server has moved index.html to a new build', async () => {
    const { deps, put } = server({ 'index.html': '<html new>' }, [
      '0123456789abcdef0123456789abcdef',
    ]);
    expect(await repairMissing([indexHtml], deps)).toBe('new-build');
    expect(put).not.toHaveBeenCalled();
  });

  it('A7: an old hashed file the server no longer has means a new build, not a failure', async () => {
    const { deps, put } = server({}, []);
    expect(await repairMissing([script], deps)).toBe('new-build');
    expect(put).not.toHaveBeenCalled();
  });
});
