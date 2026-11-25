// Making a listing's Event (docs/design/log-entry.md, "One path with I'm here"): the listing
// sheet's "Shortlist" and "I'm here", and a blank Concert filled from a listing, all make it
// through addFromSchedule, with one id per attempt (docs/adr/0007): a retry or a second tap makes
// the same Event, and a failure shows its row where it was tapped.

import { newId, type Event, type ScheduleEntry } from '../model';
import { db } from '../store/db';
import { isDeletedEvent } from '../store/events';
import { RuleError } from '../store/rules';
import { addFromSchedule, fillFromSchedule, TYPED_NOT_SAVED } from '../store/schedule';
import { forgetNewConcert, newConcertBirth } from './new-concert';
import {
  enteredFor,
  saveFeedback,
  saveWith,
  type JournalEntry,
  type Target,
} from './save-feedback';
import { offerUndo } from './undo';

// One id per entry's add, kept for the page's life: a retry, or a second tap after the sheet
// was closed and opened again, makes the same Event (docs/adr/0007). Kept only while its Event
// is live or its save unsettled: once that Event is deleted, the next add is a new attempt with
// a new id, since a deleted Event's id is never made again (PR #30 review).
const attempts = new Map<string, string>();
export const attemptOf = (entryId: string) => attempts.get(entryId) ?? null;
export const addTarget = (id: string): Target => ({ table: 'events', id, field: '*' });

async function attemptFor(entryId: string): Promise<string> {
  let id = attempts.get(entryId);
  if (id) {
    const status = saveFeedback.get(addTarget(id))?.status;
    const unsettled = status === 'saving' || status === 'failed' || status === 'typed';
    if (!unsettled && (await isDeletedEvent(id))) id = undefined;
  }
  if (!id) attempts.set(entryId, (id = newId()));
  return id;
}

// The entry's id goes with it, so the journal settles even when the Event returned is one
// planned before, under another id (store/journal-check.ts).
const entered = (entry: ScheduleEntry) => ({
  kind: entry.kind,
  date: entry.date,
  startTime: entry.startTime,
  scheduleEntryId: entry.id,
});

// When each entry was last Shortlisted from here. The button that made it becomes the one that
// takes it off, in the same place, so the second tap of a double tap must not undo the first.
const madeAt = new Map<string, number>();
const DOUBLE_TAP_MS = 700;
export const justMade = (entryId: string) =>
  performance.now() - (madeAt.get(entryId) ?? -Infinity) < DOUBLE_TAP_MS;

/** Shortlist the listing, or return the Event the rasika has for it already. */
export async function addListing(entry: ScheduleEntry) {
  const made = await attemptFor(entry.id);
  const event = await saveWith(addTarget(made), entered(entry), () =>
    addFromSchedule(entry.id, { id: made }),
  );
  if (event) madeAt.set(entry.id, performance.now());
  return event;
}

const sameTarget = (a: Target, b: Target) =>
  a.table === b.table && a.id === b.id && a.field === b.field;

const nextChange = () =>
  new Promise<void>((resolve) => {
    const off = saveFeedback.subscribe(() => {
      off();
      resolve();
    });
  });

/**
 * Whether everything entered for the blank Concert is in the store, so a fill takes it all
 * along: nothing typed and not yet written, and nothing failed, here (its Note, date or time,
 * an Artist or Item for it) or in another tab, whose journal is copied to the shared storage as
 * it is typed. One being written by this page is waited for, as it may yet fail.
 */
async function nothingUnsaved(blankId: string): Promise<boolean> {
  for (;;) {
    const pending = saveFeedback.pendingFor(blankId);
    if (pending.length === 0) return true;
    const writing = saveFeedback
      .notSaved()
      .filter((entry) => entry.state === 'saving' && enteredFor(entry, blankId));
    const waitable = (entry: JournalEntry) =>
      entry.state === 'saving' && writing.some((mine) => sameTarget(mine, entry));
    if (!pending.every(waitable)) return false;
    await nextChange();
  }
}

/**
 * The same look again, as the fill's last step inside its transaction: a value typed for the
 * blank Concert while the fill ran, here or in another tab, rolls it back.
 */
const typedSince = (blankId: string) => () => {
  if (saveFeedback.pendingFor(blankId).length > 0) throw new RuleError([TYPED_NOT_SAVED]);
};

// The fill under way for each blank Concert: a second tap waits for the first, never a second
// fill of a Concert the first takes back (which would show a false "Not saved").
const filling = new Map<string, Promise<Event | null>>();

/**
 * Fill a blank Concert from the listing: its Event made as "I'm here" makes it (or the
 * rasika's already), what the blank one held moved to it, and the blank one taken back, with an
 * Undo bar named for the listing ("NJ Nandini · Undo"). Null when it failed, its row showing
 * "Not saved" where it was tapped, or when something entered for the blank Concert isn't saved
 * yet (its own "Not saved" line shows it, here or in the tab it was typed in).
 */
export function fillFromListing(
  blankId: string,
  entry: ScheduleEntry,
  lead: string,
): Promise<Event | null> {
  const running = filling.get(blankId);
  if (running) return running;
  const fill = (async () => {
    if (!(await nothingUnsaved(blankId))) return null;
    // Taken back already (a tap after the fill, or another tab's): nothing is left to fill.
    const blank = await db.events.get(blankId);
    if (!blank || blank.deletedAt !== null) return null;
    const made = await attemptFor(entry.id);
    const birth = newConcertBirth(blankId);
    const filled = await saveWith(addTarget(made), entered(entry), () =>
      fillFromSchedule(blankId, entry.id, { id: made, lead, birth, guard: typedSince(blankId) }),
    );
    if (!filled) return null;
    // Taken back already: nothing is left for Season's sweep.
    forgetNewConcert(blankId);
    offerUndo(filled.receipt);
    return filled.event;
  })().finally(() => filling.delete(blankId));
  filling.set(blankId, fill);
  return fill;
}
