// "Ready to log offline" on first launch (eng review D4 and D8; design D10). Readiness is never
// trusted from a stored flag: the page asks the service worker, which checks its precache for
// every first-phase file of its build. While the worker installs it posts real progress, per
// file and as bytes arrive; 15 s with neither asks again, and an incomplete answer then means the
// download stopped. Try again asks the worker to fetch what its precache is missing. Without a
// service worker there is no offline logging, and the rasika is told so and let in.
// Framework-free, with the worker injected, so tests/readiness.test.ts drives it.

import type { ReadyStatus } from './precache-phases';

export type Readiness =
  | { state: 'checking' }
  | { state: 'downloading'; cached: number; total: number }
  | { state: 'ready' }
  | { state: 'stopped' }
  /** No service worker in this browser (Firefox private mode): logging works, offline doesn't. */
  | { state: 'unavailable' };

export const STALL_MS = 15_000;

export interface ReadinessDeps {
  /** Ask the service worker for its status; null when there is no worker to ask yet. */
  ask(): Promise<ReadyStatus | null>;
  /** Keep the last answer, for display only (`db.meta` `readyToLog`). */
  remember(status: ReadyStatus | null): Promise<void>;
  /**
   * Start the download again after it stopped: the worker fetches the first-phase files missing
   * from its precache (an evicted file included), or installs again if there is no worker yet.
   */
  repair(): Promise<void>;
}

const complete = (status: ReadyStatus | null): boolean =>
  status !== null && status.total > 0 && status.cached === status.total;

export class ReadinessTracker {
  private current: Readiness = { state: 'checking' };
  private timer: ReturnType<typeof setTimeout> | null = null;
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
    if (this.current.state === 'ready' || this.current.state === 'unavailable') return;
    this.set({ state: 'downloading', cached, total });
    if (total > 0 && cached === total) {
      // Everything is in; confirm with the worker, which may still be activating.
      void this.check({ stopIfIncomplete: false });
    } else {
      this.arm();
    }
  }

  /** Bytes of a first-phase file arrived: one slow file is still a download, not a stall. */
  bytes(): void {
    if (this.current.state === 'downloading') this.arm();
  }

  /** The browser has no service worker, or refused to register one. */
  unavailable(): void {
    this.round += 1;
    this.disarm();
    this.set({ state: 'unavailable' });
  }

  /** A different worker took control (an update, or the first install finishing): ask it. */
  async workerChanged(): Promise<void> {
    await this.check({ stopIfIncomplete: false });
  }

  /** "Try again" after the download stopped. */
  async retry(): Promise<void> {
    this.set({ state: 'checking' });
    await this.deps.repair().catch(() => undefined);
    await this.check({ stopIfIncomplete: false });
  }

  private async check({ stopIfIncomplete }: { stopIfIncomplete: boolean }): Promise<void> {
    if (this.current.state === 'unavailable') return;
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

  /** No progress and no bytes for STALL_MS: ask again, and stop if still incomplete. */
  private arm() {
    this.disarm();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.check({ stopIfIncomplete: true });
    }, STALL_MS);
  }

  private disarm() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private set(next: Readiness) {
    this.current = next;
    this.listeners.forEach((listener) => listener());
  }
}
