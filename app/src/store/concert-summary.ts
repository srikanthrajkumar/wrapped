// The Concert summary, shown once (walkthrough S13; DESIGN.md "Finishing a Concert"). A Concert
// ends on its own, and its summary shows as a modal the next time the app opens after that, once
// per Event on this phone. "Shown" lives in `db.meta`, like the logging note, and is never
// synced: another phone restoring the season has no logging notes, so it shows none.
//
// The summary is due an hour after the Concert's last Item changed on this phone, which is when
// the logging hold lets go of it. Filling in a past Concert is out of its window at once, so the
// hour is what keeps its summary from opening between two of its Items.

import type { Event } from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { isBeingLogged, LOGGING_HOLD_MS, readLoggingNotes, type LoggingNote } from './logging-note';

const SHOWN_PREFIX = 'summaryShown:';
const shownKey = (eventId: string) => `${SHOWN_PREFIX}${eventId}`;
/**
 * Set the first time this runs on a phone. Concerts that ended before it were finished with the
 * old "Done with this Concert" and its card, so they are marked shown then, not shown at once.
 */
export const SUMMARIES_SINCE_KEY = 'summariesSince';

/** A Concert's summary is due: logged on this phone, its last Item more than an hour ago. */
export function summaryDue(note: LoggingNote | undefined, now: Date): boolean {
  if (!note?.lastLoggedAt) return false;
  const at = Math.min(Date.parse(note.lastLoggedAt), now.getTime());
  return now.getTime() - at > LOGGING_HOLD_MS;
}

/**
 * The Event whose summary shows next, or null: an Attended Event with Items, due and not yet
 * shown, the one that ended first. Nothing shows while any Event is being logged, so a summary
 * never stands between the rasika and the next Item; it waits for the next open.
 */
export function nextSummary(
  events: readonly Pick<Event, 'id' | 'date' | 'startTime' | 'status' | 'deletedAt'>[],
  notes: ReadonlyMap<string, LoggingNote>,
  shown: ReadonlySet<string>,
  itemCounts: ReadonlyMap<string, number>,
  now: Date,
): string | null {
  const live = events.filter((event) => event.deletedAt === null);
  if (live.some((event) => isBeingLogged(event, notes.get(event.id), now))) return null;
  const due = live
    .filter(
      (event) =>
        event.status === 'attended' &&
        !shown.has(event.id) &&
        (itemCounts.get(event.id) ?? 0) > 0 &&
        summaryDue(notes.get(event.id), now),
    )
    .map((event) => ({ id: event.id, at: Date.parse(notes.get(event.id)!.lastLoggedAt!) }))
    .sort((a, b) => a.at - b.at);
  return due[0]?.id ?? null;
}

/**
 * On an app open: the Event whose summary to show, recorded as shown before it is returned, so
 * it shows exactly once (a failed write shows nothing rather than showing it again). The first
 * run on a phone marks every summary already due as shown instead.
 */
export async function takeSummary({
  db = defaultDb,
  now = new Date(),
}: { db?: WrappedDB; now?: Date } = {}): Promise<string | null> {
  return db.transaction('rw', [db.events, db.items, db.meta], async () => {
    const events = await db.events.toArray();
    const notes = await readLoggingNotes(db);
    const shownRows = await db.meta.where('key').startsWith(SHOWN_PREFIX).toArray();
    const shown = new Set(shownRows.map((row) => row.key.slice(SHOWN_PREFIX.length)));
    const counts = new Map<string, number>();
    for (const item of await db.items.filter((item) => item.deletedAt === null).toArray()) {
      counts.set(item.eventId, (counts.get(item.eventId) ?? 0) + 1);
    }
    const at = now.toISOString();

    if (!(await db.meta.get(SUMMARIES_SINCE_KEY))) {
      await db.meta.put({ key: SUMMARIES_SINCE_KEY, value: { at } });
      const before = events.filter(
        (event) => !shown.has(event.id) && summaryDue(notes.get(event.id), now),
      );
      await db.meta.bulkPut(
        before.map((event) => ({ key: shownKey(event.id), value: { eventId: event.id, at } })),
      );
      return null;
    }

    const next = nextSummary(events, notes, shown, counts, now);
    if (next) await db.meta.put({ key: shownKey(next), value: { eventId: next, at } });
    return next;
  });
}

/** Whether the Event's summary has been shown on this phone. */
export async function summaryShown(eventId: string, db: WrappedDB = defaultDb): Promise<boolean> {
  return (await db.meta.get(shownKey(eventId))) !== undefined;
}
