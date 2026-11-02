// What the rasika sees after a save (design D15; eng review D5, D6). Framework-free, so its
// rules are unit-tested against a failing store (tests/screens/save-feedback.test.ts):
// - the save highlight plays only after the write to the phone succeeded;
// - a failed write keeps the value as entered, marked "Not saved on this phone", until a retry
//   (or a later edit of the same field) succeeds, across navigation, since this lives outside
//   any screen;
// - feedback is tracked per record, field and edit: the latest edit of a field decides what
//   that field shows, whatever order earlier writes settle in;
// - attempts of one intent (two taps of "Log a Concert now") are one change: when one succeeds,
//   the failed others go, and Try again replays only the latest;
// - the failed values can be exported, read from here, without touching the database;
// - each value is copied to localStorage, one key per field, from the moment it is typed or its
//   write starts until the write succeeds, so a reload, a force-close or iOS ending the page
//   loses nothing: it comes back for Export (only Export: the write itself can't be replayed),
//   and once an Export holding it was handed over, it can be cleared;
// - screens say which targets they show, so the failures shown nowhere get the season-wide line.

import type { RasikaTable } from '../model';

/** One field of one record, as the screens edit it. `field` '*' is a whole new record. */
export interface Target {
  table: RasikaTable;
  id: string;
  field: string;
}

export type FieldFeedback =
  /** Typed, waiting for the autosave's pause: copied to storage, no write yet. */
  | { status: 'pending'; edit: number; value: unknown }
  | { status: 'saving'; edit: number; value: unknown }
  /**
   * `edit` changes with every successful write, so a screen plays the highlight once for each;
   * `at` (ms) lets a screen opened just after the write still play it, and no later.
   */
  | { status: 'saved'; edit: number; at: number; value: unknown }
  | { status: 'failed'; edit: number; value: unknown; enteredAt: string };

/** A value the phone could not store (contracts/season-export.md, `notSaved`). */
export interface NotSavedEntry {
  table: RasikaTable;
  id: string;
  field: string;
  value: unknown;
  enteredAt: string;
}

/** What a retried write is told: the fields of its record saved since it failed. */
export interface Replay {
  changedSince: string[];
}

type Write = (replay?: Replay) => Promise<unknown>;

export interface TrackOptions {
  /** Attempts of one intent each have their own id; one that succeeds supersedes the others. */
  intent?: string;
}

interface Entry {
  target: Target;
  feedback: FieldFeedback;
  /** Null for a value copied back from storage, or typed and not yet written. */
  write: Write | null;
  intent?: string;
  /** A rule refused the write, so Try again would fail the same way. */
  refused?: boolean;
  /** An Export holding this value was handed over. */
  exported?: boolean;
  enteredAt: string;
}

/** Where values are copied, one key per field (A9 of the first review; B1, B4 of the second). */
export const NOT_SAVED_PREFIX = 'wrapped.notSaved.v1:';
/** The one list an earlier build kept, read once and moved. */
const LEGACY_KEY = 'wrapped.notSaved';

/** How long a just-saved value is shown while the screen still holds the record read before. */
export const SETTLE_MS = 1000;

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
/** Hear another tab copy (a value) or drop (null) a key. */
type Listen = (onChange: (key: string, value: string | null) => void) => void;

interface Copy extends NotSavedEntry {
  exported?: boolean;
  /** Typed or being written, not failed: another tab leaves it alone; a relaunch keeps it. */
  pending?: boolean;
}

const keyOf = ({ table, id, field }: Target) => `${table}\u0000${id}\u0000${field}`;
const storageKey = ({ table, id, field }: Target) => `${NOT_SAVED_PREFIX}${table}:${id}:${field}`;
const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const isRuleError = (error: unknown) => error instanceof Error && error.name === 'RuleError';

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function browserListen(): Listen | null {
  if (typeof window === 'undefined') return null;
  return (onChange) =>
    window.addEventListener('storage', (event) => {
      if (event.key) onChange(event.key, event.newValue);
    });
}

/** A copy as stored, checked field by field; null for anything damaged. */
function toCopy(raw: unknown): Copy | null {
  if (!raw || typeof raw !== 'object') return null;
  const copy = raw as Partial<Copy>;
  const strings = [copy.table, copy.id, copy.field, copy.enteredAt];
  return strings.every((value) => typeof value === 'string') ? (copy as Copy) : null;
}

function parseCopy(text: string | null): Copy | null {
  try {
    return toCopy(JSON.parse(text ?? ''));
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

  constructor({
    storage = browserStorage(),
    listen = browserListen(),
  }: { storage?: Storage | null; listen?: Listen | null } = {}) {
    this.storage = storage;
    for (const copy of this.readStored()) this.adopt(copy);
    listen?.((key, value) => this.heard(key, value));
  }

  /**
   * Run `write` as the newest edit of `target`, holding `value` as entered until it settles.
   * Resolves to what the write returned, or undefined when it failed; it never throws.
   */
  track<T>(
    target: Target,
    value: unknown,
    write: (replay?: Replay) => Promise<T>,
    { intent }: TrackOptions = {},
  ): Promise<T | undefined> {
    return this.run(target, value, write, intent);
  }

  /** "Try again": the failed write runs again as a new edit, told what changed since. */
  retry(target: Target): Promise<unknown> {
    const entry = this.entries.get(keyOf(target));
    if (entry?.feedback.status !== 'failed' || !this.canRetry(target)) {
      return Promise.resolve(undefined);
    }
    const replay = { changedSince: this.changedSince(entry) };
    return this.run(
      target,
      entry.feedback.value,
      entry.write!,
      entry.intent,
      replay,
      entry.enteredAt,
    );
  }

  /** Retry the failed writes, as "Try again" on a line with several: one per intent. */
  retryAll(targets: Target[] = this.failed().map((entry) => entry.target)): Promise<unknown[]> {
    const latest = new Map<string, Entry>();
    for (const target of targets) {
      const entry = this.entries.get(keyOf(target));
      if (!entry || entry.feedback.status !== 'failed' || !this.canRetry(target)) continue;
      const group = entry.intent ?? keyOf(target);
      const seen = latest.get(group);
      if (!seen || seen.feedback.edit < entry.feedback.edit) latest.set(group, entry);
    }
    return Promise.all([...latest.values()].map((entry) => this.retry(entry.target)));
  }

  /** Whether "Try again" can replay `target`'s write: not after a relaunch or a rule's refusal. */
  canRetry(target: Target): boolean {
    const entry = this.entries.get(keyOf(target));
    return entry?.write != null && !entry.refused;
  }

  get(target: Target): FieldFeedback | undefined {
    return this.entries.get(keyOf(target))?.feedback;
  }

  /**
   * The value to show for `target`: the one entered while it is saving or not saved, and just
   * after it saved, until `stored` (read before the write committed) catches up. Typed text not
   * yet written is the field's own to show.
   */
  shown<T>(target: Target, stored: T): T {
    const feedback = this.get(target);
    if (!feedback || feedback.status === 'pending') return stored;
    if (feedback.status !== 'saved') return feedback.value as T;
    const settling = Date.now() - feedback.at < SETTLE_MS && !sameValue(feedback.value, stored);
    return settling ? (feedback.value as T) : stored;
  }

  /**
   * Text typed and not yet written (the autosave's pause): copied to storage at once, so a kill
   * before the write starts loses nothing.
   */
  hold(target: Target, value: unknown): void {
    const key = keyOf(target);
    const was = this.entries.get(key)?.feedback.status;
    const entry: Entry = {
      target,
      write: null,
      enteredAt: new Date().toISOString(),
      feedback: { status: 'pending', edit: this.nextEdit++, value },
    };
    this.entries.set(key, entry);
    this.copy(entry);
    // Typing over a failed value takes its "Not saved" line away.
    if (was === 'failed') this.notify();
  }

  /** The held text came back to what is stored: nothing to write after all. */
  release(target: Target): void {
    const key = keyOf(target);
    if (this.entries.get(key)?.feedback.status !== 'pending') return;
    this.entries.delete(key);
    this.uncopy(target);
  }

  /** Every failed value, for the "Not saved" section of a rescue Export. */
  notSaved(): NotSavedEntry[] {
    return this.failed().map(({ target, feedback }) => ({
      ...target,
      value: feedback.value,
      enteredAt: (feedback as { enteredAt: string }).enteredAt,
    }));
  }

  /** Whether anything on `recordId` (or anywhere, without one) failed to save. */
  hasFailures(recordId?: string): boolean {
    return this.failed().some((entry) => recordId === undefined || entry.target.id === recordId);
  }

  /**
   * Whether a failed write is still held in memory for Try again: a reload would leave it
   * Export-only. Values copied back or refused by a rule lose nothing to a reload.
   */
  hasRetryableFailures(): boolean {
    return this.failed().some((entry) => this.canRetry(entry.target));
  }

  /** An Export holding these values was handed over: those Try again can't save may be cleared. */
  markExported(values: readonly { table: string; id: string; field: string }[]): void {
    for (const value of values) {
      const entry = this.entries.get(keyOf(value as Target));
      if (entry?.feedback.status !== 'failed') continue;
      entry.exported = true;
      this.copy(entry);
    }
    this.notify();
  }

  /** Whether "Clear" may remove `target`: in an Export, and beyond Try again. */
  canClear(target: Target): boolean {
    const entry = this.entries.get(keyOf(target));
    return entry?.feedback.status === 'failed' && entry.exported === true && !this.canRetry(target);
  }

  /** "Clear": forget the values an Export holds and Try again can't save. */
  clear(targets: Target[]): void {
    for (const target of targets.filter((t) => this.canClear(t))) {
      this.entries.delete(keyOf(target));
      this.uncopy(target);
    }
    this.notify();
  }

  /**
   * After a relaunch, drop the copied values the store already holds: the page was killed after
   * their write committed and before it was marked saved.
   */
  async reconcile(
    read: (table: RasikaTable, id: string) => Promise<Record<string, unknown> | undefined>,
  ): Promise<void> {
    let changed = false;
    for (const [key, entry] of [...this.entries]) {
      if (entry.write !== null || entry.feedback.status !== 'failed') continue;
      const { table, id, field } = entry.target;
      try {
        const record = await read(table, id);
        const held =
          record !== undefined &&
          (field === '*'
            ? record.deletedAt == null
            : field === 'deletedAt'
              ? record.deletedAt != null
              : sameValue(record[field], entry.feedback.value));
        if (held && this.entries.get(key) === entry) {
          this.entries.delete(key);
          this.uncopy(entry.target);
          changed = true;
        }
      } catch {
        // Unreadable now: the copy stays, for Export.
      }
    }
    if (changed) this.notify();
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

  private async run<T>(
    target: Target,
    value: unknown,
    write: (replay?: Replay) => Promise<T>,
    intent: string | undefined,
    replay?: Replay,
    enteredAt = new Date().toISOString(),
  ): Promise<T | undefined> {
    const edit = this.nextEdit++;
    const key = keyOf(target);
    const base = { target, write: write as Write, intent, enteredAt };
    this.set(key, { ...base, feedback: { status: 'saving', edit, value } });
    try {
      const result = await write(replay);
      if (this.entries.get(key)?.feedback.edit === edit) {
        this.set(key, { ...base, feedback: { status: 'saved', edit, at: Date.now(), value } });
        // Redraw once the stored value has had its moment to catch up (shown()).
        setTimeout(() => this.notify(), SETTLE_MS);
      }
      if (intent !== undefined) this.supersede(intent, key);
      return result;
    } catch (error) {
      if (this.entries.get(key)?.feedback.edit === edit) {
        const failed: FieldFeedback = { status: 'failed', edit, value, enteredAt };
        this.set(key, { ...base, refused: isRuleError(error), feedback: failed });
      }
      return undefined;
    }
  }

  /** One attempt of `intent` succeeded: its failed siblings were the same change. */
  private supersede(intent: string, saved: string) {
    for (const [key, entry] of [...this.entries]) {
      if (key === saved || entry.intent !== intent || entry.feedback.status !== 'failed') continue;
      this.entries.delete(key);
      this.uncopy(entry.target);
    }
    this.notify();
  }

  /** The other fields of `failed`'s record saved after it failed. */
  private changedSince(failed: Entry): string[] {
    const { table, id, field } = failed.target;
    return [...this.entries.values()]
      .filter(
        (entry) =>
          entry.target.table === table &&
          entry.target.id === id &&
          entry.target.field !== field &&
          entry.feedback.status === 'saved' &&
          entry.feedback.edit > failed.feedback.edit,
      )
      .map((entry) => entry.target.field);
  }

  private failed(): (Entry & { feedback: { status: 'failed' } })[] {
    return [...this.entries.values()].filter(
      (entry): entry is Entry & { feedback: { status: 'failed' } } =>
        entry.feedback.status === 'failed',
    );
  }

  private set(key: string, entry: Entry) {
    this.entries.set(key, entry);
    this.copy(entry);
    this.notify();
  }

  private notify() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  /** A value copied back after a relaunch, or from another tab: Export only. */
  private adopt(copy: Copy) {
    const target: Target = { table: copy.table, id: copy.id, field: copy.field };
    this.entries.set(keyOf(target), {
      target,
      write: null,
      exported: copy.exported === true,
      enteredAt: copy.enteredAt,
      feedback: {
        status: 'failed',
        edit: this.nextEdit++,
        value: copy.value,
        enteredAt: copy.enteredAt,
      },
    });
  }

  /** Another tab copied or dropped a value. A field this tab is writing stays this tab's. */
  private heard(key: string, value: string | null) {
    if (!key.startsWith(NOT_SAVED_PREFIX)) return;
    const copy = value === null ? null : parseCopy(value);
    for (const [own, entry] of this.entries) {
      if (storageKey(entry.target) !== key) continue;
      if (entry.write !== null || entry.feedback.status === 'pending') return;
      if (copy === null) {
        this.entries.delete(own);
        this.notify();
        return;
      }
    }
    if (copy && !copy.pending) {
      this.adopt(copy);
      this.notify();
    }
  }

  /** Every copy in storage, each checked on its own; the legacy list is moved to keys. */
  private readStored(): Copy[] {
    const storage = this.storage;
    if (!storage) return [];
    const copies: Copy[] = [];
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(NOT_SAVED_PREFIX)) keys.push(key);
      }
      for (const key of keys) {
        const copy = parseCopy(storage.getItem(key));
        if (copy) copies.push(copy);
      }
      const legacy = storage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        let listed: unknown = [];
        try {
          listed = JSON.parse(legacy);
        } catch {
          // Damaged: nothing to move.
        }
        for (const raw of Array.isArray(listed) ? listed : []) {
          const copy = toCopy(raw);
          if (!copy) continue;
          copies.push(copy);
          storage.setItem(storageKey(copy), JSON.stringify(copy));
        }
        storage.removeItem(LEGACY_KEY);
      }
    } catch {
      // Storage blocked: only this page's memory holds values.
    }
    return copies;
  }

  /** Copy one value to storage, or drop it once saved; full or blocked storage never breaks a save. */
  private copy(entry: Entry) {
    if (entry.feedback.status === 'saved') {
      this.uncopy(entry.target);
      return;
    }
    const copy: Copy = {
      ...entry.target,
      value: entry.feedback.value,
      enteredAt: entry.enteredAt,
      ...(entry.exported ? { exported: true } : {}),
      ...(entry.feedback.status === 'failed' ? {} : { pending: true }),
    };
    try {
      this.storage?.setItem(storageKey(entry.target), JSON.stringify(copy));
    } catch {
      // The in-memory copy still holds it for this page's life.
    }
  }

  private uncopy(target: Target) {
    try {
      this.storage?.removeItem(storageKey(target));
    } catch {
      // Nothing more to do.
    }
  }
}

/** The app's one instance: feedback outlives the screen that made the edit. */
export const saveFeedback = new SaveFeedback();
