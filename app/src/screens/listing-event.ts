// Making a listing's Event (docs/design/log-entry.md, "One path with I'm here"): the listing
// sheet's "Shortlist" and "I'm here", and a blank Concert filled from a listing, all make it
// through addFromSchedule, with one id per attempt (docs/adr/0007): a retry or a second tap makes
// the same Event, and a failure shows its row where it was tapped.

import { newId, type ScheduleEntry } from '../model';
import { isDeletedEvent } from '../store/events';
import { addFromSchedule, fillFromSchedule } from '../store/schedule';
import { saveWith } from './components/feedback';
import { forgetNewConcert, newConcertBirth } from './new-concert';
import { saveFeedback, type Target } from './save-feedback';
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

/**
 * Fill a blank Concert from the listing: its Event made as "I'm here" makes it (or the
 * rasika's already), what the blank one held moved to it, and the blank one taken back, with an
 * Undo bar named for the listing ("NJ Nandini · Undo"). Null when it failed, its row showing
 * "Not saved" where it was tapped.
 */
export async function fillFromListing(blankId: string, entry: ScheduleEntry, lead: string) {
  // A value typed on the blank Concert and failed, or not yet written (its Note, date or time),
  // would be left on a Concert taken back: the fill waits until it is saved, its "Not saved"
  // line showing. One being written is written first: IndexedDB runs the two in order.
  const unsaved = saveFeedback
    .notSaved()
    .some(
      (one) =>
        one.table === 'events' &&
        one.id === blankId &&
        one.field !== '*' &&
        (one.state === 'failed' || one.state === 'typed'),
    );
  if (unsaved) return null;
  const made = await attemptFor(entry.id);
  const birth = newConcertBirth(blankId);
  const filled = await saveWith(addTarget(made), entered(entry), () =>
    fillFromSchedule(blankId, entry.id, { id: made, lead, birth }),
  );
  if (!filled) return null;
  // Taken back already: nothing is left for Season's sweep.
  forgetNewConcert(blankId);
  offerUndo(filled.receipt);
  return filled.event;
}
