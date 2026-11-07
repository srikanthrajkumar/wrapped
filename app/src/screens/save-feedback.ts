// What the rasika sees after a save (design D15), and the journal that keeps every value until
// the phone store is seen holding it (docs/adr/0007-one-journal-for-values-not-saved.md).
// Framework-free, so its rules are unit-tested (tests/screens/save-feedback.test.ts):
// - every value entered is copied to localStorage at once, one key per field (or per new record),
//   while typed, while its write runs, after it fails, and after a write that succeeded until the
//   store is read back holding it (`confirm`); so a reload, a force-close or iOS ending the page
//   loses nothing, and the values come back for Export;
// - the save highlight plays only after the write succeeded; a failed value stays on screen as
//   entered, marked "Not saved", until a retry or a later edit of the same field succeeds; a
//   saved value stays shown until the screen reads the store back holding it;
// - the latest edit of a field decides what it shows, whatever order earlier writes settle in;
// - Try again re-applies the absolute value entered, through the same action, one entry at a time
//   in the order entered, one line at a time, stopping at the first failure; a move or a repick
//   is never retried, and a move is not journalled; a delete's Try again runs the screen's whole
//   delete, its Undo offer included;
// - each new record is its own entry, never merged with another attempt;
// - Clear removes only its row's entries that an Export the rasika confirmed as saved holds,
//   matched by value and time entered;
// - screens say which targets they show, so the failures shown nowhere get the season-wide line.

import { browserStorage, type BrowserStorage as Storage } from '../browser-storage';
import type { RasikaTable } from '../model';

/** One field of one record, as the screens edit it. `field` '*' is a whole new record. */
export interface Target {
  table: RasikaTable;
  id: string;
  field: string;
}

/**
 * What a write does: set a value or make a record (`value`), delete one (`delete`), or change a
 * place or a pick, which depend on the moment of the tap and so are never retried (`move`,
 * `repick`).
 */
export type WriteKind = 'value' | 'delete' | 'move' | 'repick';

export type FieldFeedback =
  /** Typed, waiting for the autosave's pause: journalled, no write yet. */
  | { status: 'typed'; edit: number; value: unknown }
  | { status: 'saving'; edit: number; value: unknown }
  /**
   * `edit` changes with every successful write, so a screen plays the highlight once for each;
   * `at` (ms) lets a screen opened just after the write still play it, and no later.
   */
  | { status: 'saved'; edit: number; at: number; value: unknown }
  | { status: 'failed'; edit: number; value: unknown };

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
  /** Saved, and a screen has read the store back holding it: the screen shows its own value. */
  seen?: boolean;
  /** For a copy from before a relaunch, the state it was journalled in. */
  copiedState?: JournalEntry['state'];
  enteredAt: string;
  /** Its place in the order entered, kept by Try again. */
  place: number;
}

/** Where entries are journalled, one key per field or new record. */
export const NOT_SAVED_PREFIX = 'wrapped.notSaved.v1:';

/** Whether the phone store holds the entry's value (store/journal-check.ts). */
type Confirm = (entry: JournalEntry) => Promise<boolean>;
/** Whether a value a screen read from the store is the one entered (store/journal-check.ts). */
type Matches = (target: Target, entered: unknown, stored: unknown) => boolean;

interface Copy extends Omit<JournalEntry, 'state'> {
  state?: JournalEntry['state'];
  kind?: WriteKind;
}

const keyOf = ({ table, id, field }: Target) => `${table}\u0000${id}\u0000${field}`;
const storageKey = ({ table, id, field }: Target) => `${NOT_SAVED_PREFIX}${table}:${id}:${field}`;
const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const isRuleError = (error: unknown) => error instanceof Error && error.name === 'RuleError';
/** The order entered: by time, then by edit for two in the same millisecond. */
const byEntered = (a: Entry, b: Entry) =>
  a.enteredAt.localeCompare(b.enteredAt) || a.place - b.place;

/** A copy as stored, checked field by field; null for anything damaged. */
function parseCopy(text: string | null): Copy | null {
  try {
    const copy = JSON.parse(text ?? '') as Partial<Copy> | null;
    if (!copy || typeof copy !== 'object') return null;
    const strings = [copy.table, copy.id, copy.field, copy.enteredAt];
    if (!strings.every((value) => typeof value === 'string')) return null;
    const states = ['typed', 'saving', 'failed', 'unconfirmed'];
    return { ...(copy as Copy), state: states.includes(copy.state!) ? copy.state : undefined };
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
  /** Writes still running, per target: typed text going back to the stored value must still
   * be written while one is, since it may land after. */
  private inFlight = new Map<string, number>();
  /** A line's Try again is running: another tap waits for it. */
  private retrying = false;
  /** The last copy to storage failed: values entered now live only in this page's memory. */
  private blocked = false;
  /** Entries whose last copy to storage failed (or that had no storage): memory holds them alone. */
  private uncopied = new Set<string>();
  private storage: Storage | null;
  private confirm: Confirm;
  private matches: Matches;

  constructor({
    storage = browserStorage(),
    // Until the app sets its check, nothing is taken as stored: an entry stays journalled.
    confirm = async () => false,
    matches = (_target, entered, stored) => sameValue(entered, stored),
  }: { storage?: Storage | null; confirm?: Confirm; matches?: Matches } = {}) {
    this.storage = storage;
    this.confirm = confirm;
    this.matches = matches;
    this.reload();
  }

  /** The app's checks against the phone store, set once the store module is loaded. */
  confirmWith(confirm: Confirm, matches?: Matches): void {
    this.confirm = confirm;
    if (matches) this.matches = matches;
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
    return this.run(target, entry.feedback.value, entry.write!, entry.kind, {
      enteredAt: entry.enteredAt,
      place: entry.place,
    });
  }

  /**
   * Try again on a line with several: one at a time, in the order they were entered, stopping at
   * the first that fails again. A tap while one runs does nothing.
   */
  async retryAll(targets: Target[]): Promise<void> {
    if (this.retrying) return;
    this.retrying = true;
    try {
      const entries = targets
        .map((target) => this.entries.get(keyOf(target)))
        .filter((entry): entry is Entry => entry !== undefined && this.canRetry(entry.target))
        .sort(byEntered);
      for (const entry of entries) {
        await this.retry(entry.target);
        if (this.get(entry.target)?.status === 'failed') break;
      }
    } finally {
      this.retrying = false;
    }
  }

  /** Whether Try again can write `target` again: not after a relaunch, a refusal, a move or a repick. */
  canRetry(target: Target): boolean {
    const entry = this.entries.get(keyOf(target));
    return (
      entry?.write != null && !entry.refused && (entry.kind === 'value' || entry.kind === 'delete')
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
   * The value to show for `target`: the one entered while it is saving or not saved, and after it
   * saved until `stored` is seen holding it (the screen may still hold the record read before the
   * write, for as long as a slow phone takes). From then on, or once a newer edit replaces it,
   * `stored` shows, so a later change from elsewhere is seen. Typed text not yet written is the
   * field's own to show.
   */
  shown<T>(target: Target, stored: T): T {
    const entry = this.entries.get(keyOf(target));
    const feedback = entry?.feedback;
    if (!feedback || feedback.status === 'typed') return stored;
    if (feedback.status !== 'saved') return feedback.value as T;
    if (!entry.seen && this.matches(target, feedback.value, stored)) entry.seen = true;
    return entry.seen ? stored : (feedback.value as T);
  }

  /** Whether a write for `target` is still running. */
  busy(target: Target): boolean {
    return (this.inFlight.get(keyOf(target)) ?? 0) > 0;
  }

  /** Whether values entered now can't be copied to storage, so a reload would lose them. */
  journalBlocked(): boolean {
    return this.blocked;
  }

  /**
   * The values not saved that only this page's memory holds, whose copy failed even if a later
   * one was written (so `journalBlocked` is false again), or that had no storage: a reload loses
   * them, Export doesn't.
   */
  heldOnlyInMemory(): JournalEntry[] {
    return [...this.entries.values()]
      .filter((entry) => this.journalled(entry) && this.uncopied.has(keyOf(entry.target)))
      .sort(byEntered)
      .map((entry) => this.toJournal(entry));
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
      place: this.nextEdit,
      feedback: { status: 'typed', edit: this.nextEdit++, value },
    };
    this.entries.set(key, entry);
    this.copy(entry);
    // Typing over a failed value takes its "Not saved" line away.
    if (was === 'failed') this.notify();
  }

  /**
   * The held text came back to what is stored: nothing to write after all, unless a write for
   * the target is still running and may land after; then the text stays held, and the caller
   * writes it. Resolves to whether there is nothing to write.
   */
  release(target: Target): boolean {
    const key = keyOf(target);
    if (this.entries.get(key)?.feedback.status !== 'typed') return true;
    if (this.busy(target)) return false;
    this.entries.delete(key);
    this.uncopy(target);
    return true;
  }

  /**
   * The rasika let go of what `target` held on purpose (a new Item's search text, backed out of
   * or replaced by the pick): it leaves the journal, whatever its state.
   */
  drop(target: Target): void {
    if (!this.entries.delete(keyOf(target))) return;
    this.uncopy(target);
    this.notify();
  }

  /** Every journal entry, in the order entered, for an Export's "Not saved" section. */
  notSaved(): JournalEntry[] {
    return [...this.entries.values()]
      .filter((entry) => this.journalled(entry))
      .sort(byEntered)
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

  /** Clear on a row showing `targets`, once the rasika confirmed the Export holding `saved` is saved. */
  clearSaved(saved: readonly JournalEntry[], targets: readonly Target[]): void {
    for (const target of targets) {
      if (!this.canClear(target, saved)) continue;
      this.entries.delete(keyOf(target));
      this.uncopy(target);
    }
    this.notify();
  }

  /**
   * Dismiss: a move or repick that didn't happen, which the rasika will do again, or a delete that
   * didn't happen, so the record is kept after all. The store is left as it is.
   */
  dismiss(target: Target): void {
    const entry = this.entries.get(keyOf(target));
    if (entry?.feedback.status !== 'failed') return;
    if (entry.kind === 'value') return;
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

  /**
   * Read the journal again (the page shown again): entries written meanwhile come in, and are
   * checked against the store at once.
   */
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
      // Adopted in the order entered: storage keeps its keys in no order of ours.
      const copies = keys
        .map((key) => parseCopy(storage.getItem(key)))
        .filter((copy): copy is Copy => copy !== null && !this.entries.has(keyOf(copy)))
        .sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
      for (const copy of copies) {
        this.adopt(copy);
        added = true;
      }
    } catch {
      // Storage blocked: only this page's memory holds values.
    }
    if (!added) return;
    this.notify();
    void this.reconcile().catch(() => undefined);
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
      .sort(byEntered)
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
    retried?: { enteredAt: string; place: number },
  ): Promise<T | undefined> {
    const edit = this.nextEdit++;
    const key = keyOf(target);
    const enteredAt = retried?.enteredAt ?? new Date().toISOString();
    const base = { target, write: write as Write, kind, enteredAt, place: retried?.place ?? edit };
    this.set(key, { ...base, feedback: { status: 'saving', edit, value } });
    this.inFlight.set(key, (this.inFlight.get(key) ?? 0) + 1);
    let result: T;
    try {
      result = await write();
    } catch (error) {
      if (this.entries.get(key)?.feedback.edit === edit) {
        const failed: FieldFeedback = { status: 'failed', edit, value };
        this.set(key, { ...base, refused: isRuleError(error), feedback: failed });
      }
      return undefined;
    } finally {
      const left = (this.inFlight.get(key) ?? 1) - 1;
      if (left > 0) this.inFlight.set(key, left);
      else this.inFlight.delete(key);
    }
    if (this.entries.get(key)?.feedback.edit === edit) {
      this.set(key, { ...base, feedback: { status: 'saved', edit, at: Date.now(), value } });
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

  private toJournal({ target, feedback, enteredAt, copiedState }: Entry): JournalEntry {
    const state = copiedState ?? (feedback.status === 'saved' ? 'unconfirmed' : feedback.status);
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

  /**
   * A value copied back from storage: shown as not saved and offered for Export only, until the
   * store is seen holding it. The Export keeps the state it was journalled in.
   */
  private adopt(copy: Copy) {
    const target: Target = { table: copy.table, id: copy.id, field: copy.field };
    const kinds: WriteKind[] = ['value', 'delete', 'move', 'repick'];
    this.entries.set(keyOf(target), {
      target,
      kind: copy.kind && kinds.includes(copy.kind) ? copy.kind : 'value',
      write: null,
      enteredAt: copy.enteredAt,
      copiedState: copy.state,
      place: this.nextEdit,
      feedback: { status: 'failed', edit: this.nextEdit++, value: copy.value },
    });
  }

  /** Journal one entry; full or blocked storage never breaks a save. */
  private copy(entry: Entry) {
    if (!this.journalled(entry)) {
      this.uncopy(entry.target);
      return;
    }
    const copy: Copy = { ...this.toJournal(entry), kind: entry.kind };
    const key = keyOf(entry.target);
    if (!this.storage) {
      this.uncopied.add(key);
      return;
    }
    const was = this.blocked;
    try {
      this.storage.setItem(storageKey(entry.target), JSON.stringify(copy));
      this.blocked = false;
      this.uncopied.delete(key);
    } catch {
      // The in-memory copy still holds it for this page's life. An older copy must not stay:
      // after a relaunch it would hide the newer value the store holds.
      this.uncopy(entry.target);
      this.blocked = true;
      this.uncopied.add(key);
    }
    if (was !== this.blocked) this.notify();
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
