// The Concert summary, shown once (walkthrough S13; DESIGN.md "Finishing a Concert"). A Concert
// ends on its own, and its summary shows as a modal the next time the app opens after that, once
// per Event on this phone. "Shown" lives in `db.meta`, like the logging note, and is never
// synced: another phone restoring the season has no logging notes, so it shows none.
//
// The summary is due once the Concert is over by both of its clocks: an hour after its last Item
// changed on this phone, and past its window. The hour keeps a past Concert being filled in (out
// of its window at once) from opening its summary between two of its Items; the window keeps a
// long piece with no logging from showing a summary of half a Concert.

import type { Event } from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { inWindow, LOGGING_HOLD_MS, readLoggingNotes, type LoggingNote } from './logging-note';

const SHOWN_PREFIX = 'summaryShown:';
const shownKey = (eventId: string) => `${SHOWN_PREFIX}${eventId}`;
/**
 * Set the first time this runs on a phone. Concerts that ended before it were finished with the
 * old "Done with this Concert" and its card, so they are marked shown then, not shown at once.
 */
const SUMMARIES_SINCE_KEY = 'summariesSince';

type Timed = Pick<Event, 'date' | 'startTime'>;

/** Logged on this phone within the last hour (a note time in the future counts as now). */
function loggedLately(note: LoggingNote | undefined, now: Date): boolean {
  if (!note?.lastLoggedAt) return false;
  const at = Math.min(Date.parse(note.lastLoggedAt), now.getTime());
  return now.getTime() - at <= LOGGING_HOLD_MS;
}

/** A Concert's summary is due: logged on this phone, its last Item over an hour ago, its window past. */
function summaryDue(event: Timed, note: LoggingNote | undefined, now: Date): boolean {
  return !!note?.lastLoggedAt && !loggedLately(note, now) && !inWindow(event, now);
}

/**
 * The Event whose summary shows next, or null: an Attended Event with Items, due and not yet
 * shown, the one that ended first. Nothing shows while any Event was logged in the last hour, in
 * its window or not, so a summary never stands between the rasika and the next Item.
 */
export function nextSummary(
  events: readonly Pick<Event, 'id' | 'date' | 'startTime' | 'status' | 'deletedAt'>[],
  notes: ReadonlyMap<string, LoggingNote>,
  shown: ReadonlySet<string>,
  itemCounts: ReadonlyMap<string, number>,
  now: Date,
): string | null {
  if ([...notes.values()].some((note) => loggedLately(note, now))) return null;
  const due = events
    .filter(
      (event) =>
        event.deletedAt === null &&
        event.status === 'attended' &&
        !shown.has(event.id) &&
        (itemCounts.get(event.id) ?? 0) > 0 &&
        summaryDue(event, notes.get(event.id), now),
    )
    .map((event) => ({ id: event.id, at: Date.parse(notes.get(event.id)!.lastLoggedAt!) }))
    .sort((a, b) => a.at - b.at);
  return due[0]?.id ?? null;
}

async function readShown(db: WrappedDB): Promise<Set<string>> {
  const rows = await db.meta.where('key').startsWith(SHOWN_PREFIX).toArray();
  return new Set(rows.map((row) => row.key.slice(SHOWN_PREFIX.length)));
}

/**
 * On an app open: the Event whose summary is due, without recording anything, so a summary that
 * can't be read or shown stays due for the next open. Only the logged Events' Items are counted,
 * by index. The first run on a phone marks every summary already over as shown instead, and any
 * Concert ended with the old "Done", which was finished by hand.
 */
export async function dueSummary({
  db = defaultDb,
  now = new Date(),
}: { db?: WrappedDB; now?: Date } = {}): Promise<string | null> {
  const { events, notes, shown, first } = await db.transaction(
    'r',
    [db.events, db.meta],
    async () => ({
      events: await db.events.toArray(),
      notes: await readLoggingNotes(db),
      shown: await readShown(db),
      first: !(await db.meta.get(SUMMARIES_SINCE_KEY)),
    }),
  );

  if (first) {
    const finished = events.filter((event) => {
      const note = notes.get(event.id);
      return !shown.has(event.id) && (note?.doneAt != null || summaryDue(event, note, now));
    });
    await db.transaction('rw', db.meta, async () => {
      if (await db.meta.get(SUMMARIES_SINCE_KEY)) return;
      const at = now.toISOString();
      await db.meta.put({ key: SUMMARIES_SINCE_KEY, value: { at } });
      await db.meta.bulkPut(
        finished.map((event) => ({ key: shownKey(event.id), value: { eventId: event.id, at } })),
      );
    });
    return null;
  }

  const candidates = events.filter((event) => notes.get(event.id)?.lastLoggedAt);
  const counts = new Map<string, number>();
  if (candidates.length > 0) {
    const items = await db.items
      .where('eventId')
      .anyOf(candidates.map((event) => event.id))
      .filter((item) => item.deletedAt === null)
      .toArray();
    for (const item of items) counts.set(item.eventId, (counts.get(item.eventId) ?? 0) + 1);
  }
  return nextSummary(candidates, notes, shown, counts, now);
}

/**
 * Record the Event's summary as shown, just before it opens. False when it already was (another
 * tab got there first): the caller then shows nothing, so it shows exactly once.
 */
export async function markSummaryShown(
  eventId: string,
  { db = defaultDb, now = new Date() }: { db?: WrappedDB; now?: Date } = {},
): Promise<boolean> {
  return db.transaction('rw', db.meta, async () => {
    if (await db.meta.get(shownKey(eventId))) return false;
    await db.meta.put({ key: shownKey(eventId), value: { eventId, at: now.toISOString() } });
    return true;
  });
}

/** Whether the Event's summary has been shown on this phone. */
export async function summaryShown(eventId: string, db: WrappedDB = defaultDb): Promise<boolean> {
  return (await db.meta.get(shownKey(eventId))) !== undefined;
}
