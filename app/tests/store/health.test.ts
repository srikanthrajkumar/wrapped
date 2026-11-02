// Required test (constitution IV): a store that opens slowly is not
// treated as broken. After OPEN_TIMEOUT_MS the screens stay, with "Still opening your season…"
// and Export; only a refused open replaces them with the rescue screen.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WrappedDB } from '../../src/store/db';
import { OPEN_TIMEOUT_MS, storeHealth, watchStore } from '../../src/store/health';

afterEach(() => {
  vi.useRealTimers();
});

function opening() {
  let finish!: () => void;
  let fail!: (error: Error) => void;
  const db = {
    open: () =>
      new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      }),
  } as unknown as WrappedDB;
  return { db, finish: () => finish(), fail: (error: Error) => fail(error) };
}

describe('watching the store open', () => {
  it('a slow open is "still opening", and the screens come back once it opens', async () => {
    vi.useFakeTimers();
    const store = opening();
    watchStore(store.db);
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS);
    expect(storeHealth()).toEqual({ state: 'slow' });

    store.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(storeHealth()).toEqual({ state: 'open' });
  });

  it('a refused open is a failure, for the rescue screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = opening();
    watchStore(store.db);
    store.fail(new Error('Connection to Indexed Database server lost'));
    await Promise.resolve();
    await Promise.resolve();
    expect(storeHealth()).toMatchObject({ state: 'failed' });
  });
});
