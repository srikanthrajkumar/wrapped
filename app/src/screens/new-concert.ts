// A Concert made by Season's + that the rasika leaves with nothing entered leaves no trace (the
// Maintainer, 2026-11-08): no row, no Undo bar, no "Not saved" and no journal entry pending.
//
// The tap still makes its Concert at once, with its own id (docs/adr/0007), so every edit path
// stays as it is and a failed tap stays listed as before. Each Concert made this way is noted in
// localStorage with what it was born with, so a reload on its page keeps the note. When the
// rasika leaves its page for anywhere outside it (the back gesture, the top bar's back, a tab),
// or Season opens with a note left over (the app closed on that page, a take-back that failed),
// it is taken back if nothing was entered:
// - the journal holds nothing entered since the tap but the Concert's own birth, so an edit that
//   failed, is still being written or is only typed always keeps it;
// - the store finds it as born, with nothing made for it (store/events.ts discardUntouched).
// Anything else keeps it, as before, and the note goes.

import { browserStorage } from '../browser-storage';
import type { Event } from '../model';
import { discardUntouched, type Birth } from '../store/events';
import { saveFeedback as defaultFeedback, type SaveFeedback } from './save-feedback';

const PREFIX = 'wrapped.newConcert.v1:';

interface Note extends Birth {
  /** When the + was tapped: anything journalled since was entered for this Concert. */
  tappedAt: string;
}

function read(id: string): Note | null {
  try {
    const note = JSON.parse(browserStorage()?.getItem(PREFIX + id) ?? 'null') as Note | null;
    return note && typeof note.tappedAt === 'string' && typeof note.updatedAt === 'string'
      ? note
      : null;
  } catch {
    return null;
  }
}

function forget(id: string) {
  try {
    browserStorage()?.removeItem(PREFIX + id);
  } catch {
    // Nothing to keep: without storage the note was never there.
  }
}

/** Note a Concert the + just made, with what it was born with. */
export function noteNewConcert(event: Event, tappedAt: string): void {
  const note: Note = {
    kind: event.kind,
    date: event.date,
    startTime: event.startTime,
    updatedAt: event.updatedAt,
    tappedAt,
  };
  try {
    browserStorage()?.setItem(PREFIX + event.id, JSON.stringify(note));
  } catch {
    // Unnoted, the Concert is simply kept, as before.
  }
}

/** The ids of new Concerts still noted. */
function noted(): string[] {
  const storage = browserStorage();
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

const running = new Map<string, Promise<void>>();

/**
 * The rasika has left the new Concert's page: take it back if nothing was entered. A take-back
 * that fails keeps the note, for Season to try again.
 */
export function leaveNewConcert(id: string, feedback: SaveFeedback = defaultFeedback) {
  const pending = running.get(id);
  if (pending) return pending;
  const run = (async () => {
    const note = read(id);
    if (!note) return;
    const birth = { table: 'events' as const, id, field: '*' };
    const entered = feedback
      .notSaved()
      .some(
        (entry) =>
          entry.enteredAt >= note.tappedAt &&
          !(entry.table === birth.table && entry.id === id && entry.field === birth.field),
      );
    // The birth's own write still running or failed: leave it to its journal entry.
    const born = feedback.get(birth);
    if (entered || born?.status === 'saving' || born?.status === 'failed') {
      if (entered) forget(id);
      return;
    }
    try {
      const outcome = await discardUntouched(id, note);
      if (outcome === 'discarded') feedback.drop(birth);
      forget(id);
    } catch {
      // Kept for now, noted, and tried again when Season next opens.
    }
  })().finally(() => running.delete(id));
  running.set(id, run);
  return run;
}

/** Season opened: take back any new Concert left untouched whose page is no longer open. */
export function sweepNewConcerts(path = window.location.pathname) {
  for (const id of noted()) {
    const open = `/event/${id}`;
    if (path === open || path.startsWith(`${open}/`)) continue;
    void leaveNewConcert(id);
  }
}
