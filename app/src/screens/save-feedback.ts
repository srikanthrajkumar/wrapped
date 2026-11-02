// What the rasika sees after a save (design D15), and the journal that keeps every value until
// the phone store is seen holding it (docs/adr/0007-one-journal-for-values-not-saved.md).
// Framework-free, so its rules are unit-tested (tests/screens/save-feedback.test.ts):
// - every value entered is copied to localStorage at once, one key per field (or per new record),
//   while typed, while its write runs, after it fails, and after a write that succeeded until the
//   store is read back holding it (`confirm`); so a reload, a force-close or iOS ending the page
//   loses nothing, and the values come back for Export;
// - the save highlight plays only after the write succeeded; a failed value stays on screen as
//   entered, marked "Not saved", until a retry or a later edit of the same field succeeds;
// - the latest edit of a field decides what it shows, whatever order earlier writes settle in;
// - Try again re-applies the absolute value entered, through the same action, one entry at a time
//   in the order entered; a move or a repick is never retried, and a move is not journalled;
// - each new record is its own entry, never merged with another attempt;
// - Clear removes only what an Export the rasika confirmed as saved holds, matched by value and
//   time entered;
// - screens say which targets they show, so the failures shown nowhere get the season-wide line.

import type { RasikaTable } from '../model';

/** One field of one record, as the screens edit it. `field` '*' is a whole new record. */
export interface Target {
  table: RasikaTable;
  id: string;
  field: string;
}

/**
 * What a write does: set a value (`value`), make a record (`create`), or change a place or a
 * pick, which depend on the moment of the tap and so are never retried (`move`, `repick`).
 */
export type WriteKind = 'value' | 'create' | 'move' | 'repick';

export type FieldFeedback =
  /** Typed, waiting for the autosave's pause: journalled, no write yet. */
  | { status: 'typed'; edit: number; value: unknown }
  | { status: 'saving'; edit: number; value: unknown }
  /**
   * `edit` changes with every successful write, so a screen plays the highlight once for each;
   * `at` (ms) lets a screen opened just after the write still play it, and no later.
   */
  | { status: 'saved'; edit: number; at: number; value: unknown }
  | { status: 'failed'; edit: number; value: unknown; enteredAt: string };

/** A journal entry as it is exported (contracts/season-export.md, `notSaved`). */
export interface JournalEntry {
  table: RasikaTable;
  id: string;
  field: string;
  value: unknown;
  enteredAt: string;
  /** Typed, being written, failed, or written and not yet seen in the store. */
  state: 'typed' | 'saving' | 'failed' | 'unconfirmed';
}

type Write = () => Promise<unknown>;

interface Entry {
  target: Target;
  feedback: FieldFeedback;
  kind: WriteKind;
  /** Null for a value copied back from storage, or typed and not yet written. */
  write: Write | null;
  /** A rule refused the write, so Try again would fail the same way. */
  refused?: boolean;
  /** Written, and the store was read back holding it: no longer journalled. */
  confirmed?: boolean;
  enteredAt: string;
}

/** Where entries are journalled, one key per field or new record. */
export const NOT_SAVED_PREFIX = 'wrapped.notSaved.v1:';

/** How long a just-saved value is shown while the screen still holds the record read before. */
export const SETTLE_MS = 1000;

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
/** Whether the phone store holds the entry's value (store/journal-check.ts). */
type Confirm = (entry: JournalEntry) => Promise<boolean>;

interface Copy extends Omit<JournalEntry, 'state'> {
  state?: JournalEntry['state'];
  kind?: WriteKind;
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

/** A copy as stored, checked field by field; null for anything damaged. */
function parseCopy(text: string | null): Copy | null {
  try {
    const copy = JSON.parse(text ?? '') as Partial<Copy> | null;
    if (!copy || typeof copy !== 'object') return null;
    const strings = [copy.table, copy.id, copy.field, copy.enteredAt];
    return strings.every((value) => typeof value === 'string') ? (copy as Copy) : null;
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
  private confirm: Confirm;

  constructor({
    storage = browserStorage(),
    confirm = async () => true,
  }: { storage?: Storage | null; confirm?: Confirm } = {}) {
    this.storage = storage;
    this.confirm = confirm;
    this.reload();
  }

  /** The app's check against the phone store, set once the store module is loaded. */
  confirmWith(confirm: Confirm): void {
    this.confirm = confirm;
  }

  /**
   * Run `write` as the newest edit of `target`, holding `value` as entered until it settles.
   * Resolves to what the write returned, or undefined when it failed; it never throws.
   */
  track<T>(
    target: Target,
    value: unknown,
    write: () => Promise<T>,
    { kind = 'value' }: { kind?: WriteKind } = {},
  ): Promise<T | undefined> {
    return this.run(target, value, write, kind);
  }

  /** "Try again": the failed value is written again, as entered, as a new edit. */
  retry(target: Target): Promise<unknown> {
    const entry = this.entries.get(keyOf(target));
    if (entry?.feedback.status !== 'failed' || !this.canRetry(target)) {
      return Promise.resolve(undefined);
    }
    return this.run(target, entry.feedback.value, entry.write!, entry.kind, entry.enteredAt);
  }

  /** Try again on a line with several: one at a time, in the order they were entered. */
  async retryAll(targets: Target[]): Promise<void> {
    const entries = targets
      .map((target) => this.entries.get(keyOf(target)))
      .filter((entry): entry is Entry => entry !== undefined && this.canRetry(entry.target))
      .sort((a, b) => a.feedback.edit - b.feedback.edit);
    for (const entry of entries) await this.retry(entry.target);
  }

  /** Whether Try again can write `target` again: not after a relaunch, a refusal, a move or a repick. */
  canRetry(target: Target): boolean {
    const entry = this.entries.get(keyOf(target));
    return (
      entry?.write != null && !entry.refused && (entry.kind === 'value' || entry.kind === 'create')
    );
  }

  get(target: Target): FieldFeedback | undefined {
    return this.entries.get(keyOf(target))?.feedback;
  }

  /** What `target`'s write does, for the line that reports its failure. */
  kindOf(target: Target): WriteKind | undefined {
    return this.entries.get(keyOf(target))?.kind;
  }

  /**
   * The value to show for `target`: the one entered while it is saving or not saved, and just
   * after it saved, until `stored` (read before the write committed) catches up. Typed text not
   * yet written is the field's own to show.
   */
  shown<T>(target: Target, stored: T): T {
    const feedback = this.get(target);
    if (!feedback || feedback.status === 'typed') return stored;
    if (feedback.status !== 'saved') return feedback.value as T;
    const settling = Date.now() - feedback.at < SETTLE_MS && !sameValue(feedback.value, stored);
    return settling ? (feedback.value as T) : stored;
  }

  /** Text typed and not yet written (the autosave's pause): journalled at once. */
  hold(target: Target, value: unknown): void {
    const key = keyOf(target);
    const was = this.entries.get(key)?.feedback.status;
    const entry: Entry = {
      target,
      kind: 'value',
      write: null,
      enteredAt: new Date().toISOString(),
      feedback: { status: 'typed', edit: this.nextEdit++, value },
    };
    this.entries.set(key, entry);
    this.copy(entry);
    // Typing over a failed value takes its "Not saved" line away.
    if (was === 'failed') this.notify();
  }

  /** The held text came back to what is stored: nothing to write after all. */
  release(target: Target): void {
    const key = keyOf(target);
    if (this.entries.get(key)?.feedback.status !== 'typed') return;
    this.entries.delete(key);
    this.uncopy(target);
  }

  /** Every journal entry, in the order entered, for an Export's "Not saved" section. */
  notSaved(): JournalEntry[] {
    return [...this.entries.values()]
      .filter((entry) => this.journalled(entry))
      .sort((a, b) => a.feedback.edit - b.feedback.edit)
      .map((entry) => this.toJournal(entry));
  }

  /** Whether a failed write is still held in memory for Try again: a reload would lose it. */
  hasRetryableFailures(): boolean {
    return this.failed().some((entry) => this.canRetry(entry.target));
  }

  /** Whether Clear may remove `target`: Try again can't save it, and `saved` holds it as it is. */
  canClear(target: Target, saved: readonly JournalEntry[]): boolean {
    const entry = this.entries.get(keyOf(target));
    if (entry?.feedback.status !== 'failed' || this.canRetry(target)) return false;
    return saved.some(
      (held) =>
        keyOf(held) === keyOf(target) &&
        held.enteredAt === entry.enteredAt &&
        sameValue(held.value, entry.feedback.value),
    );
  }

  /** Clear, once the rasika confirmed the Export holding `saved` is saved. */
  clearSaved(saved: readonly JournalEntry[]): void {
    for (const entry of [...this.entries.values()]) {
      if (!this.canClear(entry.target, saved)) continue;
      this.entries.delete(keyOf(entry.target));
      this.uncopy(entry.target);
    }
    this.notify();
  }

  /** Dismiss: a move or repick that didn't happen, which the rasika will do again. */
  dismiss(target: Target): void {
    if (this.entries.get(keyOf(target))?.feedback.status !== 'failed') return;
    this.entries.delete(keyOf(target));
    this.uncopy(target);
    this.notify();
  }

  /**
   * Let go of the entries the store is seen holding: copied back from before a relaunch, or
   * written and not yet read back.
   */
  async reconcile(): Promise<void> {
    let changed = false;
    for (const [key, entry] of [...this.entries]) {
      const copiedBack = entry.write === null && entry.feedback.status === 'failed';
      const unread = entry.feedback.status === 'saved' && !entry.confirmed;
      if (!copiedBack && !unread) continue;
      const edit = entry.feedback.edit;
      const holds = await this.confirm(this.toJournal(entry)).catch(() => false);
      if (!holds || this.entries.get(key)?.feedback.edit !== edit) continue;
      if (copiedBack) this.entries.delete(key);
      else entry.confirmed = true;
      this.uncopy(entry.target);
      changed = true;
    }
    if (changed) this.notify();
  }

  /** Read the journal again (the page shown again): entries written meanwhile come in. */
  reload(): void {
    const storage = this.storage;
    if (!storage) return;
    let added = false;
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(NOT_SAVED_PREFIX)) keys.push(key);
      }
      for (const key of keys) {
        const copy = parseCopy(storage.getItem(key));
        if (!copy || this.entries.has(keyOf(copy))) continue;
        this.adopt(copy);
        added = true;
      }
    } catch {
      // Storage blocked: only this page's memory holds values.
    }
    if (added) this.notify();
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

  /** The failed targets no mounted screen shows, in the order entered: the season-wide line. */
  unshown(): Target[] {
    return this.failed()
      .filter((entry) => !this.shownCounts.has(keyOf(entry.target)))
      .sort((a, b) => a.feedback.edit - b.feedback.edit)
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
    write: () => Promise<T>,
    kind: WriteKind,
    enteredAt = new Date().toISOString(),
  ): Promise<T | undefined> {
    const edit = this.nextEdit++;
    const key = keyOf(target);
    const base = { target, write: write as Write, kind, enteredAt };
    this.set(key, { ...base, feedback: { status: 'saving', edit, value } });
    let result: T;
    try {
      result = await write();
    } catch (error) {
      if (this.entries.get(key)?.feedback.edit === edit) {
        const failed: FieldFeedback = { status: 'failed', edit, value, enteredAt };
        this.set(key, { ...base, refused: isRuleError(error), feedback: failed });
      }
      return undefined;
    }
    if (this.entries.get(key)?.feedback.edit === edit) {
      this.set(key, { ...base, feedback: { status: 'saved', edit, at: Date.now(), value } });
      // Redraw once the stored value has had its moment to catch up (shown()).
      setTimeout(() => this.notify(), SETTLE_MS);
      // The entry leaves the journal only once the store is read back holding the value.
      const holds = await this.confirm(this.toJournal(this.entries.get(key)!)).catch(() => false);
      const now = this.entries.get(key);
      if (holds && now?.feedback.edit === edit) {
        now.confirmed = true;
        this.uncopy(target);
      }
    }
    return result;
  }

  private failed(): Entry[] {
    return [...this.entries.values()].filter((entry) => entry.feedback.status === 'failed');
  }

  /** Whether an entry is in the journal: anything not yet seen in the store, except a move. */
  private journalled(entry: Entry): boolean {
    return entry.kind !== 'move' && !(entry.feedback.status === 'saved' && entry.confirmed);
  }

  private toJournal({ target, feedback, enteredAt }: Entry): JournalEntry {
    const state = feedback.status === 'saved' ? 'unconfirmed' : feedback.status;
    return { ...target, value: feedback.value, enteredAt, state };
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

  /** A value copied back from storage: Export only, until the store is seen holding it. */
  private adopt(copy: Copy) {
    const target: Target = { table: copy.table, id: copy.id, field: copy.field };
    this.entries.set(keyOf(target), {
      target,
      kind: copy.kind ?? 'value',
      write: null,
      enteredAt: copy.enteredAt,
      feedback: {
        status: 'failed',
        edit: this.nextEdit++,
        value: copy.value,
        enteredAt: copy.enteredAt,
      },
    });
  }

  /** Journal one entry; full or blocked storage never breaks a save. */
  private copy(entry: Entry) {
    if (!this.journalled(entry)) {
      this.uncopy(entry.target);
      return;
    }
    const copy: Copy = { ...this.toJournal(entry), kind: entry.kind };
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
