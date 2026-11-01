// T048e (eng D4, D8; design D10): "Ready to log offline" follows the service worker's own check
// of its precache, with real progress, a 15 s stall rule and Try again. The worker and its
// cache are stood in for, so each case is exact: an interrupted install, a replacement worker,
// a missed message and cache removal. tests/../e2e/first-launch.spec.ts runs the real worker.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReadyStatus } from '../src/precache-phases';
import { ReadinessTracker, STALL_MS } from '../src/readiness';

const status = (cached: number, total = 5): ReadyStatus => ({
  type: 'READY_STATUS',
  cached,
  total,
  catalogFile: null,
});

/** A worker that answers with whatever `answer` holds, or null while there is none. */
function setup(first: ReadyStatus | null) {
  vi.useFakeTimers();
  const worker = { answer: first };
  const remembered: (ReadyStatus | null)[] = [];
  const reinstall = vi.fn(async () => undefined);
  const tracker = new ReadinessTracker({
    ask: async () => worker.answer,
    remember: async (s) => void remembered.push(s),
    reinstall,
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  });
  return { tracker, worker, remembered, reinstall };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

afterEach(() => {
  vi.useRealTimers();
});

describe('first-launch readiness', () => {
  it('shows real progress, then ready once the worker finds every file', async () => {
    const { tracker, worker } = setup(null);
    await tracker.start();
    expect(tracker.get()).toEqual({ state: 'downloading', cached: 0, total: 0 });
    tracker.progress(2, 5);
    expect(tracker.get()).toEqual({ state: 'downloading', cached: 2, total: 5 });
    worker.answer = status(5);
    tracker.progress(5, 5);
    await settle();
    expect(tracker.get()).toEqual({ state: 'ready' });
  });

  it('an interrupted install: 15 s without progress asks again, then stops; Try again resumes', async () => {
    const { tracker, worker, reinstall } = setup(null);
    await tracker.start();
    tracker.progress(3, 5);
    await vi.advanceTimersByTimeAsync(STALL_MS - 1);
    expect(tracker.get().state).toBe('downloading');
    await vi.advanceTimersByTimeAsync(1);
    expect(tracker.get()).toEqual({ state: 'stopped' });

    worker.answer = status(5);
    await tracker.retry();
    expect(reinstall).toHaveBeenCalledOnce();
    expect(tracker.get()).toEqual({ state: 'ready' });
  });

  it('progress that keeps coming never stops the download', async () => {
    const { tracker } = setup(null);
    await tracker.start();
    for (let cached = 1; cached < 5; cached += 1) {
      await vi.advanceTimersByTimeAsync(STALL_MS - 1000);
      tracker.progress(cached, 5);
    }
    expect(tracker.get()).toEqual({ state: 'downloading', cached: 4, total: 5 });
  });

  it('a late progress message after a stop brings the bar back', async () => {
    const { tracker } = setup(null);
    await tracker.start();
    await vi.advanceTimersByTimeAsync(STALL_MS);
    expect(tracker.get().state).toBe('stopped');
    tracker.progress(4, 5);
    expect(tracker.get()).toEqual({ state: 'downloading', cached: 4, total: 5 });
  });

  it('a missed message: the stall check finds the install finished', async () => {
    const { tracker, worker } = setup(null);
    await tracker.start();
    tracker.progress(4, 5);
    // The last message never arrives, but the worker finished and took control.
    worker.answer = status(5);
    await vi.advanceTimersByTimeAsync(STALL_MS);
    expect(tracker.get()).toEqual({ state: 'ready' });
  });

  it('a replacement worker is asked again, and its own answer counts', async () => {
    const { tracker, worker } = setup(status(5));
    await tracker.start();
    expect(tracker.get().state).toBe('ready');
    // An update takes control; its build has more files, not all cached yet.
    worker.answer = status(3, 6);
    await tracker.workerChanged();
    expect(tracker.get()).toEqual({ state: 'downloading', cached: 3, total: 6 });
    worker.answer = status(6, 6);
    await tracker.workerChanged();
    expect(tracker.get()).toEqual({ state: 'ready' });
  });

  it('cache removal: a stored "ready" is not trusted; the worker\'s check decides', async () => {
    const { tracker, remembered } = setup(status(2));
    // Whatever an earlier launch stored, this launch asks, and the cache was cleared.
    await tracker.start();
    expect(tracker.get()).toEqual({ state: 'downloading', cached: 2, total: 5 });
    expect(remembered.at(-1)).toEqual(status(2));
    await vi.advanceTimersByTimeAsync(STALL_MS);
    expect(tracker.get()).toEqual({ state: 'stopped' });
  });

  it('keeps only the latest answer when checks overlap', async () => {
    const { tracker, worker } = setup(status(1));
    const first = tracker.start();
    worker.answer = status(5);
    const second = tracker.workerChanged();
    await Promise.all([first, second]);
    expect(tracker.get()).toEqual({ state: 'ready' });
  });
});
