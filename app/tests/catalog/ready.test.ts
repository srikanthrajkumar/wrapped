// Required test (constitution IV): a write that waits for the catalog never waits forever. On
// the first launch or the upgrade launch the catalog may still be opening; past a time limit the
// write goes ahead without it, as when there is no catalog at all.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/catalog/current', () => ({ openCatalog: () => new Promise(() => undefined) }));

const { readyCatalog, CATALOG_WAIT_MS } = await import('../../src/catalog/use-catalog');

describe('waiting for the catalog (required)', () => {
  it('gives up after a time limit, so a repick or an Undo still runs', async () => {
    vi.useFakeTimers();
    const ready = readyCatalog();
    await vi.advanceTimersByTimeAsync(CATALOG_WAIT_MS);
    expect(await ready).toBeNull();
    vi.useRealTimers();
  });
});
