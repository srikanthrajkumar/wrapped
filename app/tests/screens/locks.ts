// A stand-in for the browser's Web Locks, shared by the tests of new Concerts and of fills.

/**
 * A lock manager shared by every "tab" in a test, as the browser's is: shared and exclusive
 * modes, `ifAvailable`, and waiting requests granted in turn as locks are let go.
 */
export function lockManager(): LockManager {
  const held = new Map<string, { mode: LockMode; count: number }>();
  const waiting: (() => boolean)[] = [];
  const take = (name: string, mode: LockMode) => {
    const now = held.get(name);
    if (!now) return (held.set(name, { mode, count: 1 }), true);
    if (now.mode === 'shared' && mode === 'shared') return ((now.count += 1), true);
    return false;
  };
  const free = (name: string) => {
    const now = held.get(name)!;
    now.count -= 1;
    if (now.count === 0) held.delete(name);
    for (const next of [...waiting]) if (next()) waiting.splice(waiting.indexOf(next), 1);
  };
  return {
    request(name: string, ...args: unknown[]) {
      const callback = args[args.length - 1] as (lock: Lock | null) => Promise<unknown>;
      const options = (args.length > 1 ? args[0] : {}) as LockOptions;
      const mode = options.mode ?? 'exclusive';
      const run = async () => {
        try {
          return await callback({ name, mode } as Lock);
        } finally {
          free(name);
        }
      };
      if (take(name, mode)) return run();
      if (options.ifAvailable) return Promise.resolve(callback(null));
      return new Promise((resolve, reject) => {
        waiting.push(() => {
          if (!take(name, mode)) return false;
          run().then(resolve, reject);
          return true;
        });
      });
    },
  } as unknown as LockManager;
}
