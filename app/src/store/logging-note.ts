// The per-phone logging note and the Now selector (eng review D2; design D3 and D17). For each
// Event the note keeps when an Item was last added or changed on this phone. Only the Item
// actions write it, inside their own transactions, so a catalog upgrade or a sync never looks
// like logging. It lives in `db.meta` and is never synced. A Concert ends on its own, by its
// window and the logging hold (walkthrough S13): nothing ends it by hand.

import type { Event } from '../model';
import { db as defaultDb, type WrappedDB } from './db';

export interface LoggingNote {
  eventId: string;
  /** When an Item of this Event was last added, changed, moved or deleted on this phone. */
  lastLoggedAt: string | null;
  /**
   * Legacy: when "Done with this Concert" was tapped, before S13 removed it. Read by nothing;
   * logging again drops it.
   */
  doneAt?: string | null;
}

const PREFIX = 'loggingNote:';
const keyOf = (eventId: string) => `${PREFIX}${eventId}`;

/** An Event's logging note, or undefined when it has none. */
export async function readLoggingNote(
  eventId: string,
  db: WrappedDB,
): Promise<LoggingNote | undefined> {
  return (await db.meta.get(keyOf(eventId)))?.value as LoggingNote | undefined;
}

/** A Concert is being logged while an Item changed within this long (D17). */
export const LOGGING_HOLD_MS = 60 * 60 * 1000;
/** An Event is Now from an hour before its start until four hours after it (DD2). */
const WINDOW_BEFORE_MS = 60 * 60 * 1000;
const WINDOW_AFTER_MS = 4 * 60 * 60 * 1000;

/** Record logging activity, inside the caller's transaction (which must include `db.meta`). */
export async function noteLogging(db: WrappedDB, eventId: string, now = new Date()) {
  const note: LoggingNote = { eventId, lastLoggedAt: now.toISOString() };
  await db.meta.put({ key: keyOf(eventId), value: note });
}

export async function readLoggingNotes(
  db: WrappedDB = defaultDb,
): Promise<Map<string, LoggingNote>> {
  const rows = await db.meta.where('key').startsWith(PREFIX).toArray();
  return new Map(rows.map((row) => [(row.value as LoggingNote).eventId, row.value as LoggingNote]));
}

/** The Event's start on the phone's own clock, or null when it has no start time. */
export function eventStart(event: Pick<Event, 'date' | 'startTime'>): Date | null {
  if (!event.startTime) return null;
  const [y, m, d] = event.date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = event.startTime.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm);
}

/**
 * Whether `now` falls in the Event's window: from an hour before its start to four hours after.
 * An Event with no start time is in its window all day on its date.
 */
export function inWindow(event: Pick<Event, 'date' | 'startTime'>, now: Date): boolean {
  const start = eventStart(event);
  if (!start) {
    const [y, m, d] = event.date.split('-').map(Number) as [number, number, number];
    return now >= new Date(y, m - 1, d) && now < new Date(y, m - 1, d + 1);
  }
  const t = now.getTime();
  return t >= start.getTime() - WINDOW_BEFORE_MS && t <= start.getTime() + WINDOW_AFTER_MS;
}

/**
 * Whether the Event is being logged on this phone (D17): an Item changed in the last hour, and
 * inside its window. A note time in the future counts as now.
 */
export function isBeingLogged(
  event: Pick<Event, 'date' | 'startTime'>,
  note: LoggingNote | undefined,
  now: Date,
): boolean {
  if (!note?.lastLoggedAt) return false;
  const at = Math.min(Date.parse(note.lastLoggedAt), now.getTime());
  return now.getTime() - at <= LOGGING_HOLD_MS && inWindow(event, now);
}

export interface NowSelection<E> {
  /** The Event that holds Now, or null. */
  now: E | null;
  /** Other Events in their window, each shown as one smaller line under the block. */
  others: E[];
}

/**
 * Which Event is Now (design D3, refined by D17):
 * 1. an Event being logged (an Item changed on this phone in the last hour) holds Now while it
 *    is inside its window; the most recently logged wins;
 * 2. otherwise the Event in its window with the nearest start holds it.
 * Missed and cancelled Events are never Now. A note time in the future (the clock was moved
 * back) counts as now.
 */
export function nowEvent<E extends Event>(
  events: readonly E[],
  notes: ReadonlyMap<string, LoggingNote>,
  now: Date,
): NowSelection<E> {
  const t = now.getTime();
  const candidates = events.filter(
    (event) =>
      event.deletedAt === null &&
      event.status !== 'missed' &&
      !event.cancelled &&
      inWindow(event, now),
  );
  const loggedAt = (event: E) => {
    const at = notes.get(event.id)?.lastLoggedAt;
    return at ? Math.min(Date.parse(at), t) : null;
  };
  const distance = (event: E) => {
    const start = eventStart(event);
    return start ? Math.abs(start.getTime() - t) : Number.POSITIVE_INFINITY;
  };
  const beingLogged = candidates
    .filter((event) => isBeingLogged(event, notes.get(event.id), now))
    .sort((a, b) => loggedAt(b)! - loggedAt(a)!);
  const nearest = [...candidates].sort(
    (a, b) =>
      distance(a) - distance(b) ||
      (eventStart(a)?.getTime() ?? 0) - (eventStart(b)?.getTime() ?? 0),
  );
  const holder = beingLogged[0] ?? nearest[0] ?? null;
  const others = candidates
    .filter((event) => event !== holder)
    .sort((a, b) => (eventStart(a)?.getTime() ?? 0) - (eventStart(b)?.getTime() ?? 0));
  return { now: holder, others };
}
