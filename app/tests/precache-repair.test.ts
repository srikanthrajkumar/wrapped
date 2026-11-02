// Required test (constitution IV; ADR 0007): "Try again" refills the precache only from
// the build the service worker holds. Every missing file must be listed in the server's sw.js
// before anything is fetched; each body must match its Workbox revision (an MD5 of the file) or,
// for a hashed file, have its own Content-Type, so a host that serves the app page for unknown
// paths is caught; and sw.js is read again after the fetches, so a deploy in between is caught.
// Otherwise nothing is stored and the caller installs the new build whole.

import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { md5 } from '../src/md5';
import { repairMissing, type PrecacheFile } from '../src/precache-phases';

const html = '<!doctype html><title>Carnatic Wrapped</title>';
const md5Of = (text: string) => createHash('md5').update(text).digest('hex');
const indexHtml: PrecacheFile = { url: 'index.html', revision: md5Of(html) };
const script: PrecacheFile = { url: 'assets/index-Bd17z0YL.js', revision: null };

const manifest = (files: PrecacheFile[]) =>
  `self.__WB_MANIFEST=${JSON.stringify(files.map((f) => ({ revision: f.revision, url: f.url })))}`;

/** A server holding `files` (url → body and type) and serving `workers` as sw.js, in turn. */
function server(files: Record<string, [string, string]>, workers: string[]) {
  const put = vi.fn(async () => undefined);
  const fetch = vi.fn(async (url: string) =>
    url in files
      ? new Response(files[url]![0], { headers: { 'Content-Type': files[url]![1] } })
      : new Response('missing', { status: 404 }),
  );
  let read = 0;
  return {
    put,
    fetch,
    deps: {
      isCached: async () => false,
      fetch,
      put,
      serverWorker: async () => workers[Math.min(read++, workers.length - 1)]!,
    },
  };
}

const both = {
  'index.html': [html, 'text/html'] as [string, string],
  'assets/index-Bd17z0YL.js': ['code', 'text/javascript'] as [string, string],
};

describe('repairing the precache', () => {
  it('computes the MD5 Workbox uses for revisions', () => {
    for (const text of ['', 'a', html, 'Kaddanuvariki · Todi · Tyagaraja · Adi']) {
      expect(md5(new TextEncoder().encode(text))).toBe(md5Of(text));
    }
  });

  it('stores the missing files when the server still serves this build', async () => {
    const { deps, put } = server(both, [manifest([indexHtml, script])]);
    expect(await repairMissing([indexHtml, script], deps)).toBe('repaired');
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('stores nothing when the server has moved index.html to a new build', async () => {
    const other = { ...indexHtml, revision: md5Of('<html new>') };
    const { deps, put } = server(both, [manifest([other, script])]);
    expect(await repairMissing([indexHtml], deps)).toBe('new-build');
    expect(put).not.toHaveBeenCalled();
  });

  it('an old hashed file the server no longer has means a new build, not a failure', async () => {
    const { deps, put } = server({}, [manifest([script])]);
    expect(await repairMissing([script], deps)).toBe('new-build');
    expect(put).not.toHaveBeenCalled();
  });

  it('third review: checks every missing file against the manifest before fetching any', async () => {
    const { deps, put, fetch } = server(both, [manifest([indexHtml])]);
    // The hashed script comes first, and the server's build no longer lists it.
    expect(await repairMissing([script, indexHtml], deps)).toBe('new-build');
    expect(fetch).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('third review: a body that does not match its revision is not stored', async () => {
    const { deps, put } = server({ 'index.html': ['<html changed in place>', 'text/html'] }, [
      manifest([indexHtml]),
    ]);
    expect(await repairMissing([indexHtml], deps)).toBe('new-build');
    expect(put).not.toHaveBeenCalled();
  });

  it('third review: a hashed file answered with the app page is not stored', async () => {
    // A host that serves index.html, with a 200, for any path it doesn't have.
    const { deps, put } = server({ 'assets/index-Bd17z0YL.js': [html, 'text/html'] }, [
      manifest([script]),
    ]);
    expect(await repairMissing([script], deps)).toBe('new-build');
    expect(put).not.toHaveBeenCalled();
  });

  it('third review: a deploy between reading sw.js and fetching is caught', async () => {
    const { deps, put } = server(both, [
      manifest([indexHtml, script]),
      manifest([{ ...indexHtml, revision: md5Of('<html next>') }, script]),
    ]);
    expect(await repairMissing([indexHtml, script], deps)).toBe('new-build');
    expect(put).not.toHaveBeenCalled();
  });
});
