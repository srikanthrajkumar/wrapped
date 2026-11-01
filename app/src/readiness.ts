// "Ready to log offline" on first launch (eng review D4 and D8; design D10). Readiness is never
// trusted from a stored flag: the page asks the service worker, which checks its precache for
// every first-phase file of its build. While the worker installs it posts real progress; 15 s
// with no progress asks again, and an incomplete answer then means the download stopped.
// Framework-free, with the worker and timers injected, so tests/readiness.test.ts drives it.

import type { ReadyStatus } from './precache-phases';

export type Readiness =
  | { state: 'checking' }
  | { state: 'downloading'; cached: number; total: number }
  | { state: 'ready' }
  | { state: 'stopped' };

export const STALL_MS = 15_000;

export interface ReadinessDeps {
  /** Ask the service worker for its status; null when there is no worker to ask yet. */
  ask(): Promise<ReadyStatus | null>;
  /** Keep the last answer, for display only (`db.meta` `readyToLog`). */
  remember(status: ReadyStatus | null): Promise<void>;
  /** Start the download again after it stopped. */
  reinstall(): Promise<void>;
  setTimer(run: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

const complete = (status: ReadyStatus | null): boolean =>
  status !== null && status.total > 0 && status.cached === status.total;

export class ReadinessTracker {
  private current: Readiness = { state: 'checking' };
  private timer: unknown = null;
  private listeners = new Set<() => void>();
  /** Bumped on each check, so a late answer to an earlier one is ignored. */
  private round = 0;

  constructor(private deps: ReadinessDeps) {}

  get(): Readiness {
    return this.current;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getSnapshot = (): Readiness => this.current;

  /** Ask once; until the answer is complete, wait for progress. */
  async start(): Promise<void> {
    await this.check({ stopIfIncomplete: false });
  }

  /** A first-phase file was cached by the installing worker. */
  progress(cached: number, total: number): void {
    if (this.current.state === 'ready') return;
    this.set({ state: 'downloading', cached, total });
    if (total > 0 && cached === total) {
      // Everything is in; confirm with the worker, which may still be activating.
      void this.check({ stopIfIncomplete: false });
    } else {
      this.arm();
    }
  }

  /** A different worker took control (an update, or the first install finishing): ask it. */
  async workerChanged(): Promise<void> {
    await this.check({ stopIfIncomplete: false });
  }

  /** "Try again" after the download stopped. */
  async retry(): Promise<void> {
    this.set({ state: 'checking' });
    await this.deps.reinstall().catch(() => undefined);
    await this.check({ stopIfIncomplete: false });
  }

  private async check({ stopIfIncomplete }: { stopIfIncomplete: boolean }): Promise<void> {
    const round = ++this.round;
    this.disarm();
    const status = await this.deps.ask().catch(() => null);
    if (round !== this.round) return;
    await this.deps.remember(status).catch(() => undefined);
    if (round !== this.round) return;
    if (complete(status)) {
      this.set({ state: 'ready' });
    } else if (stopIfIncomplete) {
      this.set({ state: 'stopped' });
    } else {
      const was: Readiness = this.current;
      const before = was.state === 'downloading' ? was : { cached: 0, total: 0 };
      this.set({
        state: 'downloading',
        cached: status?.cached ?? before.cached,
        total: status?.total ?? before.total,
      });
      this.arm();
    }
  }

  /** No progress for STALL_MS: ask again, and stop if still incomplete. */
  private arm() {
    this.disarm();
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      void this.check({ stopIfIncomplete: true });
    }, STALL_MS);
  }

  private disarm() {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }

  private set(next: Readiness) {
    this.current = next;
    this.listeners.forEach((listener) => listener());
  }
}
