// What the rasika sees after a save (design D15; eng review D5, D6). Framework-free, so its
// rules are unit-tested against a failing store (tests/screens/save-feedback.test.ts):
// - the save highlight plays only after the write to the phone succeeded;
// - a failed write keeps the value as entered, marked "Not saved on this phone", until a retry
//   (or a later edit of the same field) succeeds, across navigation, since this lives outside
//   any screen;
// - feedback is tracked per record, field and edit: the latest edit of a field decides what
//   that field shows, whatever order earlier writes settle in;
// - the failed values can be exported, read from here, without touching the database;
// - each failed value is also copied to localStorage, so after a reload, or iOS ending the page,
//   it can still be exported (only exported: the write itself can't be replayed);
// - screens say which targets they show, so the failures shown nowhere get the season-wide line.

import type { RasikaTable } from '../model';

/** One field of one record, as the screens edit it. `field` '*' is a whole new record. */
export interface Target {
  table: RasikaTable;
  id: string;
  field: string;
}

export type FieldFeedback =
  | { status: 'saving'; edit: number; value: unknown }
  /**
   * `edit` changes with every successful write, so a screen plays the highlight once for each;
   * `at` (ms) lets a screen opened just after the write still play it, and no later.
   */
  | { status: 'saved'; edit: number; at: number }
  | { status: 'failed'; edit: number; value: unknown; enteredAt: string };

/** A value the phone could not store (contracts/season-export.md, `notSaved`). */
export interface NotSavedEntry {
  table: RasikaTable;
  id: string;
  field: string;
  value: unknown;
  enteredAt: string;
}

type Write = () => Promise<unknown>;

interface Entry {
  target: Target;
  feedback: FieldFeedback;
  /** Null for a value copied back from storage after a relaunch: it can only be exported. */
  write: Write | null;
}

/** Where failed values are copied (A9, the Maintainer's yes of 2026-11-02). */
export const NOT_SAVED_KEY = 'wrapped.notSaved';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

const keyOf = ({ table, id, field }: Target) => `${table}\u0000${id}\u0000${field}`;

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class SaveFeedback {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  /** How many mounted screens show each target. */
  private shownCounts = new Map<string, number>();
  private nextEdit = 1;
  private version = 0;
  private storage: Storage | null;

  constructor({ storage = browserStorage() }: { storage?: Storage | null } = {}) {
    this.storage = storage;
    for (const entry of this.readStored()) {
      const target = { table: entry.table, id: entry.id, field: entry.field };
      this.entries.set(keyOf(target), {
        target,
        write: null,
        feedback: {
          status: 'failed',
          edit: this.nextEdit++,
          value: entry.value,
          enteredAt: entry.enteredAt,
        },
      });
    }
  }

  /**
   * Run `write` as the newest edit of `target`, holding `value` as entered until it settles.
   * Resolves to what the write returned, or undefined when it failed; it never throws.
   */
  async track<T>(target: Target, value: unknown, write: () => Promise<T>): Promise<T | undefined> {
    const edit = this.nextEdit++;
    const key = keyOf(target);
    const enteredAt = new Date().toISOString();
    this.set(key, { target, write, feedback: { status: 'saving', edit, value } });
    try {
      const result = await write();
      if (this.entries.get(key)?.feedback.edit === edit) {
        this.set(key, { target, write, feedback: { status: 'saved', edit, at: Date.now() } });
      }
      return result;
    } catch {
      if (this.entries.get(key)?.feedback.edit === edit) {
        this.set(key, { target, write, feedback: { status: 'failed', edit, value, enteredAt } });
      }
      return undefined;
    }
  }

  /** "Try again": the failed write runs again as a new edit. */
  retry(target: Target): Promise<unknown> {
    const entry = this.entries.get(keyOf(target));
    if (entry?.feedback.status !== 'failed' || !entry.write) return Promise.resolve(undefined);
    return this.track(target, entry.feedback.value, entry.write);
  }

  /** Retry every failed write, as "Try again" on a screen with several. */
  retryAll(targets: Target[] = this.failed().map((entry) => entry.target)): Promise<unknown[]> {
    return Promise.all(targets.map((target) => this.retry(target)));
  }

  /** Whether "Try again" can replay `target`'s write (not after a relaunch). */
  canRetry(target: Target): boolean {
    return this.entries.get(keyOf(target))?.write != null;
  }

  get(target: Target): FieldFeedback | undefined {
    return this.entries.get(keyOf(target))?.feedback;
  }

  /** The value to show for `target`: the one entered while it is saving or not saved. */
  shown<T>(target: Target, stored: T): T {
    const feedback = this.get(target);
    return feedback && feedback.status !== 'saved' ? (feedback.value as T) : stored;
  }

  /** Every failed value, for the "Not saved" section of a rescue Export. */
  notSaved(): NotSavedEntry[] {
    return this.failed().map(({ target, feedback }) => ({
      ...target,
      value: (feedback as { value: unknown }).value,
      enteredAt: (feedback as { enteredAt: string }).enteredAt,
    }));
  }

  /** Whether anything on `recordId` (or anywhere, without one) failed to save. */
  hasFailures(recordId?: string): boolean {
    return this.failed().some((entry) => recordId === undefined || entry.target.id === recordId);
  }

  /**
   * A screen shows `targets` with its own "Not saved" line while mounted; call the returned
   * function when it unmounts.
   */
  showing(targets: Target[]): () => void {
    const keys = targets.map(keyOf);
    keys.forEach((key) => this.shownCounts.set(key, (this.shownCounts.get(key) ?? 0) + 1));
    const touchesFailure = () =>
      keys.some((key) => this.entries.get(key)?.feedback.status === 'failed');
    if (touchesFailure()) this.notify();
    return () => {
      keys.forEach((key) => {
        const count = (this.shownCounts.get(key) ?? 1) - 1;
        if (count > 0) this.shownCounts.set(key, count);
        else this.shownCounts.delete(key);
      });
      if (touchesFailure()) this.notify();
    };
  }

  /** The failed targets no mounted screen shows: the season-wide line counts these. */
  unshown(): Target[] {
    return this.failed()
      .filter((entry) => !this.shownCounts.has(keyOf(entry.target)))
      .map((entry) => entry.target);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** Changes on every update; a snapshot for React's useSyncExternalStore. */
  getVersion = (): number => this.version;

  private failed(): Entry[] {
    return [...this.entries.values()].filter((entry) => entry.feedback.status === 'failed');
  }

  private set(key: string, entry: Entry) {
    this.entries.set(key, entry);
    this.store();
    this.notify();
  }

  private notify() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  private readStored(): NotSavedEntry[] {
    try {
      const stored = JSON.parse(this.storage?.getItem(NOT_SAVED_KEY) ?? '[]') as unknown;
      return Array.isArray(stored) ? (stored as NotSavedEntry[]) : [];
    } catch {
      return [];
    }
  }

  /** Copy the failed values to storage; a full or blocked storage must not break a save. */
  private store() {
    try {
      const failed = this.notSaved();
      if (failed.length > 0) this.storage?.setItem(NOT_SAVED_KEY, JSON.stringify(failed));
      else this.storage?.removeItem(NOT_SAVED_KEY);
    } catch {
      // The in-memory copy still holds them for this page's life.
    }
  }
}

/** The app's one instance: feedback outlives the screen that made the edit. */
export const saveFeedback = new SaveFeedback();
