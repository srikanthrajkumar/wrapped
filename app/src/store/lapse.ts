// The lapse (ADR 0010; docs/designs/season-spine.md SF-D24, SF-D38, SF-D39). A Shortlisted Event
// (stored `planned`) whose window ended with nothing logged has lapsed. It is shown nowhere but
// the hub's lapse card, which asks once whether the rasika was there: tapped, it becomes
// Attended; let go, Missed. Some are never asked about: one that holds an Item reads as Heard,
// and one cancelled, or in the same slot as a concert the rasika heard, is simply not shown.
//
// The app never changes a status by itself (Codex's review of the data change, 2026-11-11):
// every write here is the rasika's own answer on the card. A phone that only opens the hub
// queues nothing, so a phone that is not the writer, one whose clock has jumped, or one still
// waiting on a pull never invents an edit. What nobody was asked about is hidden by the same
// rule on every phone, and written Missed with the rest when the rasika lets a card go. A
// Missed Event is kept, in Export and sync, and shown and counted nowhere.

import type { Event } from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { eventStart, windowEnd } from './logging-note';
import { getLive, save, type WriteOptions } from './mutate';

/** Concerts starting within this long of each other are one slot (SF-D33). */
export const SLOT_MS = 30 * 60 * 1000;

type Timed = Pick<Event, 'date' | 'startTime'>;

/** Whether a Shortlisted Event's time has passed with nothing logged. */
export function hasLapsed(event: Pick<Event, 'status'> & Timed, now: Date): boolean {
  return event.status === 'planned' && now.getTime() > windowEnd(event).getTime();
}

/** Two concerts in one slot: the same day, both timed, starting within 30 minutes of each other. */
export function sameSlot(a: Timed, b: Timed): boolean {
  const [start, other] = [eventStart(a), eventStart(b)];
  return (
    a.date === b.date &&
    !!start &&
    !!other &&
    Math.abs(start.getTime() - other.getTime()) <= SLOT_MS
  );
}

/**
 * What becomes of a lapsed Event, in order: `attended` if it holds an Item, however it came to
 * (never Missed); `missed`, unasked, if it was cancelled or shares a slot with a concert the
 * rasika heard; else `ask`.
 */
export function lapseVerdict(
  lapsed: Timed,
  facts: { items: number; cancelled: boolean; heard: readonly Timed[] },
): 'attended' | 'missed' | 'ask' {
  if (facts.items > 0) return 'attended';
  if (facts.cancelled || facts.heard.some((event) => sameSlot(event, lapsed))) return 'missed';
  return 'ask';
}

const heard = (event: Event): Event => ({
  ...event,
  status: 'attended',
  touched: true,
  scheduleChanged: false,
});

const liveItemCount = (db: WrappedDB, eventId: string) =>
  db.items
    .where('eventId')
    .equals(eventId)
    .filter((item) => item.deletedAt === null)
    .count();

/**
 * The rasika says they were at a lapsed concert (the card's tap): it is Heard, Items optional.
 * Their word wins over a Missed set meanwhile, on this phone or another; an Event already
 * Attended is left as it is.
 */
export async function wasThere(id: string, { db = defaultDb }: WriteOptions = {}): Promise<Event> {
  return db.transaction('rw', [db.events, db.outbox], async () => {
    const event = await getLive('events', id, { db });
    return event.status === 'attended' ? event : save('events', heard(event), { db });
  });
}

/**
 * The rasika lets one lapsed concert go (the card's "None of these", for each one it asked
 * about): it becomes Missed, unless it gained an Item meanwhile, when it is Heard. One no longer
 * Shortlisted is left as it is.
 */
export async function letGo(id: string, { db = defaultDb }: WriteOptions = {}): Promise<Event> {
  return db.transaction('rw', [db.events, db.items, db.outbox], async () => {
    const event = await getLive('events', id, { db });
    if (event.status !== 'planned') return event;
    const next: Event =
      (await liveItemCount(db, id)) > 0 ? heard(event) : { ...event, status: 'missed' };
    return save('events', next, { db });
  });
}

/**
 * Settle the lapsed Events nobody was asked about, as the rasika lets a card go: each an
 * ordinary status save with its outbox entry, in one transaction. Those holding an Item become
 * Attended first, so the rest are judged against every concert heard; then one cancelled, or in
 * a heard concert's slot, becomes Missed. Returns the ids left to ask about. Run again, it
 * writes nothing more.
 */
export async function settleLapsed({
  db = defaultDb,
  now = new Date(),
}: WriteOptions & { now?: Date } = {}): Promise<string[]> {
  return db.transaction('rw', [db.events, db.items, db.schedule, db.outbox], async () => {
    const events = (await db.events.toArray()).filter((event) => event.deletedAt === null);
    const attended = events.filter((event) => event.status === 'attended');
    const empty: Event[] = [];
    for (const event of events.filter((one) => hasLapsed(one, now))) {
      if ((await liveItemCount(db, event.id)) > 0) {
        attended.push(await save('events', heard(event), { db }));
      } else empty.push(event);
    }
    const ask: string[] = [];
    for (const event of empty) {
      const entry = event.scheduleEntryId ? await db.schedule.get(event.scheduleEntryId) : null;
      const verdict = lapseVerdict(event, {
        items: 0,
        cancelled: event.cancelled || entry?.cancelled === true,
        heard: attended,
      });
      if (verdict === 'ask') ask.push(event.id);
      else await save('events', { ...event, status: 'missed' }, { db });
    }
    return ask;
  });
}
