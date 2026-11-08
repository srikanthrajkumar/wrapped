// A Concert made by Season's + that the rasika leaves with nothing entered leaves no trace (the
// Maintainer, 2026-11-08): no row, no Undo bar, no "Not saved" and no journal entry pending.
//
// The tap still makes its Concert at once, with its own id (docs/adr/0007), so every edit path
// stays as it is and a failed tap stays listed as before. Each Concert made this way is noted in
// localStorage with what it was born with, so a reload on its page keeps the note.
//
// No tab takes it back while any page has it open (PR #30 reviews): every open page of the
// Concert, in any tab, holds its Web Lock in shared mode, from the + tap that makes it (before the
// Concert is written) for as long as its pages are open. Taking it back needs that lock
// exclusively and at once, so it happens only when no page anywhere has the Concert open: when
// the rasika leaves its pages (the back gesture, the top bar's back, a tab), after this tab lets
// its own shared hold go, or from Season's sweep for a note left over (the app closed on that
// page, a take-back that failed). With no Web Locks, nothing is ever taken back.
//
// The check takes it back only if nothing was entered, and keeps it when unsure:
// - the journal holds nothing for it but its own birth: no edit of the Concert and no new
//   Artist, Item or Item search text for it (matched by record, so a step of the clock can't
//   hide typed text), and no new Sabha or Artist still typed, being written or failed, whose
//   entry names no Concert and might have been for this one;
// - the store finds it as born, with nothing made for it (store/events.ts discardUntouched).
// Something entered for it keeps it for good, and the note goes; when only unsure, the note stays
// for a later check.

import { browserStorage, type BrowserStorage } from '../browser-storage';
import type { Event } from '../model';
import { DB_NAME } from '../store/db';
import { discardUntouched, type Birth } from '../store/events';
import {
  saveFeedback as defaultFeedback,
  type JournalEntry,
  type SaveFeedback,
} from './save-feedback';

const PREFIX = 'wrapped.newConcert.v1:';

interface Note extends Birth {
  /** When the + was tapped. */
  tappedAt: string;
}

/** What the check reads and writes, given apart so its rules are unit-tested. */
export interface NewConcertDeps {
  storage: BrowserStorage | null;
  feedback: Pick<SaveFeedback, 'notSaved' | 'get' | 'drop'>;
  discard: typeof discardUntouched;
  locks: LockManager | null;
}

const defaults = (): NewConcertDeps => ({
  storage: browserStorage(),
  feedback: defaultFeedback,
  discard: discardUntouched,
  locks: typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null,
});

/** The lock a Concert's open pages hold, one per store and Concert. */
export const lockName = (id: string) => `wrapped-new-concert:${DB_NAME}:${id}`;

function read(storage: BrowserStorage | null, id: string): Note | null {
  try {
    const note = JSON.parse(storage?.getItem(PREFIX + id) ?? 'null') as Note | null;
    return note && typeof note.tappedAt === 'string' && typeof note.updatedAt === 'string'
      ? note
      : null;
  } catch {
    return null;
  }
}

function forget(storage: BrowserStorage | null, id: string) {
  try {
    storage?.removeItem(PREFIX + id);
  } catch {
    // Nothing to keep: without storage the note was never there.
  }
}

/** Note a Concert the + just made, with what it was born with. */
export function noteNewConcert(event: Event, tappedAt: string, { storage } = defaults()): void {
  const note: Note = {
    kind: event.kind,
    date: event.date,
    startTime: event.startTime,
    updatedAt: event.updatedAt,
    tappedAt,
  };
  try {
    storage?.setItem(PREFIX + event.id, JSON.stringify(note));
  } catch {
    // Unnoted, the Concert is simply kept, as before.
  }
}

/** The ids of new Concerts still noted. */
function noted(storage: BrowserStorage | null): string[] {
  if (!storage) return [];
  const ids: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX)) ids.push(key.slice(PREFIX.length));
    }
  } catch {
    return [];
  }
  return ids;
}

/** New records that may be made for a Concert without naming it in their journal entry. */
const UNATTACHED = new Set(['sabhas', 'artists']);

/**
 * What the journal says of the Concert: `mine` when something was entered for it; `unsure` when
 * a new Sabha or Artist is still typed, being written or failed (it may have been for this
 * Concert, and its entry doesn't say); else `clean`.
 */
function verdict(entries: JournalEntry[], id: string): 'mine' | 'unsure' | 'clean' {
  let unsure = false;
  for (const entry of entries) {
    if (entry.table === 'events' && entry.id === id) {
      if (entry.field !== '*') return 'mine';
      continue;
    }
    const value = entry.value as { eventId?: unknown } | null;
    if (value && typeof value === 'object' && value.eventId === id) return 'mine';
    if (UNATTACHED.has(entry.table) && entry.field === '*' && entry.state !== 'unconfirmed') {
      unsure = true;
    }
  }
  return unsure ? 'unsure' : 'clean';
}

/**
 * Take the Concert back if nothing was entered. Runs only while holding its lock exclusively. A
 * take-back that fails keeps the note, for Season to try again.
 */
async function check(id: string, deps: NewConcertDeps): Promise<boolean> {
  const { storage, feedback } = deps;
  const note = read(storage, id);
  if (!note) return false;
  const birth = { table: 'events' as const, id, field: '*' };
  const said = verdict(feedback.notSaved(), id);
  if (said === 'mine') forget(storage, id);
  // The birth's own write still running or failed: leave it to its journal entry.
  const born = feedback.get(birth)?.status;
  if (said !== 'clean' || born === 'saving' || born === 'failed') return false;
  try {
    const outcome = await deps.discard(id, note);
    if (outcome === 'discarded') feedback.drop(birth);
    forget(storage, id);
    return outcome === 'discarded';
  } catch {
    // Kept for now, noted, and tried again when Season next opens.
    return false;
  }
}

/**
 * Check the Concert if no page anywhere has it open: its lock, exclusively, at once. Says
 * whether it was taken back.
 */
function checkIfFree(id: string, deps: NewConcertDeps): Promise<boolean> {
  if (!deps.locks) return Promise.resolve(false);
  return deps.locks
    .request(lockName(id), { mode: 'exclusive', ifAvailable: true }, async (lock) =>
      lock ? check(id, deps) : false,
    )
    .then(
      (taken) => taken === true,
      () => false,
    );
}

// Concerts being taken back as the rasika leaves them: Season doesn't draw them meanwhile, so
// one never shows for a frame before it goes. One kept after all comes back.
let leaving: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
function setLeaving(id: string, on: boolean) {
  const next = new Set(leaving);
  if (on) next.add(id);
  else next.delete(id);
  leaving = next;
  for (const listener of listeners) listener();
}
export const subscribeLeaving = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
/** The Concerts being taken back now, for useSyncExternalStore. */
export const leavingNow = () => leaving;

interface Shared {
  /** Settles once the shared lock is granted. */
  granted: Promise<void>;
  /** Lets the lock go; `done` settles once it has. */
  letGo(): void;
  done: Promise<void>;
  /** A let-go waiting a moment, in case the same page takes the hold straight back. */
  pending?: ReturnType<typeof setTimeout>;
}

// This tab's shared holds, by Concert.
const holds = new Map<string, Shared>();

function share(id: string, locks: LockManager): Shared {
  let letGo!: () => void;
  const until = new Promise<void>((resolve) => (letGo = resolve));
  let grant!: () => void;
  const granted = new Promise<void>((resolve) => (grant = resolve));
  const done = locks
    .request(lockName(id), { mode: 'shared' }, () => {
      grant();
      return until;
    })
    .then(
      () => undefined,
      () => grant(),
    );
  return { granted, letGo, done };
}

/**
 * The + was tapped: hold the Concert about to be made, before it or its note is written, so no
 * sweep can take it back before its page opens; the page takes this hold over. Settles once
 * held. If the Concert isn't made after all, `dropNewConcert` lets it go.
 */
export function claimNewConcert(id: string, deps = defaults()): Promise<void> {
  if (!deps.locks) return Promise.resolve();
  const shared = share(id, deps.locks);
  holds.set(id, shared);
  return shared.granted;
}

/** The Concert claimed for a tap wasn't made: let its hold go. */
export function dropNewConcert(id: string): void {
  holds.get(id)?.letGo();
  holds.delete(id);
}

/**
 * The tab has the Concert's pages open: hold its lock, shared, until they close, taking over a
 * hold the + already took. The returned release says whether the rasika left them; if so, and
 * this tab's journal holds nothing for it, the check runs once no page anywhere has it open.
 */
export function holdNewConcert(id: string, deps = defaults()): (left: boolean) => Promise<void> {
  const { locks } = deps;
  if (!locks) return async () => undefined;
  let shared = holds.get(id);
  if (shared) {
    clearTimeout(shared.pending);
    shared.pending = undefined;
  } else {
    if (!read(deps.storage, id)) return async () => undefined;
    shared = share(id, locks);
    holds.set(id, shared);
  }
  const mine = shared;
  return async (left) => {
    if (holds.get(id) !== mine) return;
    if (!left) {
      // The same page drawn again (a remount) takes it straight back; otherwise it goes.
      mine.pending = setTimeout(() => {
        if (holds.get(id) === mine) holds.delete(id);
        mine.letGo();
      }, 0);
      return;
    }
    holds.delete(id);
    // Judged on this tab's journal while still held, so another tab's sweep in the gap below,
    // which sees only its own, can't decide differently on what was entered here.
    const said = verdict(deps.feedback.notSaved(), id);
    if (said === 'mine') forget(deps.storage, id);
    if (said === 'clean') setLeaving(id, true);
    mine.letGo();
    await mine.done;
    if (said !== 'clean') return;
    // Taken back, it stays undrawn (the store no longer has it); kept, it comes back.
    let taken = false;
    try {
      taken = await checkIfFree(id, deps);
    } finally {
      if (!taken) setLeaving(id, false);
    }
  };
}

/**
 * Season opened: check each new Concert still noted, if no page anywhere has it open. One open
 * here or in another tab is skipped, so it is never taken back from under its page.
 */
export async function sweepNewConcerts(deps = defaults()): Promise<void> {
  if (!deps.locks) return;
  await Promise.all(noted(deps.storage).map((id) => checkIfFree(id, deps)));
}
