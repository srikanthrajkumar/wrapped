// Event actions (T036, data-model.md "Event"). Each action is one local transaction through
// mutate.ts: it reads the Event, checks the rules, and saves the record with its outbox entry.

import {
  newId,
  type Appearance,
  type Event,
  type EventKind,
  type EventSource,
  type EventStatus,
  type Item,
} from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { draftKey, restoreItemRows, type Deleted, type RestoreOptions } from './items';
import { readLoggingNote } from './logging-note';
import { getLive, newTimestamps, remove, save, type WriteOptions } from './mutate';
import { peekReceipt, takeReceipt, writeReceipt, type DeletionReceipt } from './receipts';
import {
  check,
  ENTRY_PLANNED_AGAIN,
  EVENT_DELETED,
  eventProblems,
  KIND_CHANGED,
  MAX_PRESENTERS,
  RuleError,
  TOO_MANY_PRESENTERS,
} from './rules';

/** Today on the phone's own clock, as `YYYY-MM-DD` (Edge Cases: the date defaults to today). */
export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface NewEvent {
  kind: EventKind;
  /** Defaults to today. */
  date?: string;
  startTime?: string | null;
  sabhaId?: string | null;
  /** Defaults to `spot`: an Event made in the hall. */
  source?: EventSource;
  /** Required for a Lecdem; null for a Concert; the printed title, or none, otherwise. */
  title?: string | null;
  note?: string | null;
  scheduleEntryId?: string | null;
  scheduleVersionSeen?: string | null;
}

/** The fields the rasika edits on an Event. Status moves only through `setStatus`. */
export type EventChanges = Partial<
  Pick<Event, 'kind' | 'date' | 'startTime' | 'sabhaId' | 'title' | 'note'>
>;

/**
 * Create an Event. A `spot` Event, made in the hall, starts Attended; one from the Plan or the
 * Schedule starts Planned. An Attended Event is `touched` from the start, so the Schedule never
 * changes it (FR-027).
 */
export async function createEvent(
  input: NewEvent,
  { db = defaultDb, id = newId() }: WriteOptions & { id?: string } = {},
): Promise<Event> {
  const source = input.source ?? 'spot';
  const status: EventStatus = source === 'spot' ? 'attended' : 'planned';
  const event: Event = {
    id,
    kind: input.kind,
    date: input.date ?? today(),
    startTime: input.startTime ?? null,
    sabhaId: input.sabhaId ?? null,
    status,
    cancelled: false,
    source,
    scheduleEntryId: input.scheduleEntryId ?? null,
    scheduleVersionSeen: input.scheduleVersionSeen ?? null,
    scheduleChanged: false,
    touched: status === 'attended',
    title: titleFor(input.kind, input.title ?? null),
    note: input.note ?? null,
    ...newTimestamps(),
  };
  check(eventProblems(event));
  // With `id` (one per attempt), a create retried after a failure never makes a second Event;
  // an id a deleted Event holds is refused, never handed back.
  return db.transaction('rw', [db.events, db.outbox], async () => {
    const existing = await db.events.get(id);
    if (existing?.deletedAt === null) return existing;
    if (existing) throw new RuleError([`event id ${id} is already used`]);
    return save('events', event, { db });
  });
}

/**
 * A title as entered, by kind (FR-013, T057): a Concert's is kept as given, so the rule refuses
 * one; any other kind's is trimmed, and an empty one is none.
 */
export function titleFor(kind: EventKind, title: string | null): string | null {
  if (kind === 'concert') return title;
  return title?.trim() || null;
}

/** Edit an Event's fields. Any edit marks it `touched`, so Schedule updates stop (FR-027). */
export async function editEvent(
  id: string,
  changes: EventChanges,
  { db = defaultDb }: WriteOptions = {},
): Promise<Event> {
  return db.transaction('rw', [db.events, db.outbox], async () => {
    const event = await getLive('events', id, { db });
    const edited: Event = { ...event, ...changes, touched: true };
    if ('title' in changes) edited.title = titleFor(edited.kind, edited.title);
    check(eventProblems(edited));
    return save('events', edited, { db });
  });
}

/**
 * FR-013 holds however an Event comes to be a Lecdem: one with more than 3 presenters is
 * refused with the same rule as a 4th presenter added, so its presenters stay editable.
 */
export async function checkLecdem(event: Event, db: WrappedDB) {
  if (event.kind !== 'lecdem') return;
  const presenters = await db.appearances
    .where('eventId')
    .equals(event.id)
    .filter((appearance) => appearance.deletedAt === null && appearance.role === 'presenter')
    .count();
  if (presenters > MAX_PRESENTERS) throw new RuleError([TOO_MANY_PRESENTERS]);
}

/**
 * Change an Event's kind among the four (T122), with its title where the new kind has one. A
 * change to Concert, whose title is null, takes a typed title away only with a receipt that
 * Undo restores it from, written in the same transaction as the Event and its outbox entry, so
 * no title is ever lost to a kind change. Each change to Concert keeps its own receipt. Without
 * `title`, the title stays as it is.
 */
export async function changeKind(
  id: string,
  kind: EventKind,
  { db = defaultDb, title }: WriteOptions & { title?: string | null } = {},
): Promise<{ event: Event; receipt: DeletionReceipt | null }> {
  return db.transaction('rw', [db.events, db.appearances, db.outbox, db.meta], async () => {
    const event = await getLive('events', id, { db });
    const kept = titleFor(kind, title === undefined ? event.title : title);
    const taken = kind === 'concert' && event.title?.trim() ? event.title : null;
    const edited: Event = {
      ...event,
      kind,
      title: kind === 'concert' ? null : kept,
      touched: true,
    };
    check(eventProblems(edited));
    await checkLecdem(edited, db);
    const saved = await save('events', edited, { db });
    const receipt = taken
      ? await writeReceipt(db, {
          kind: 'title',
          eventId: id,
          position: null,
          records: [{ table: 'events', id, deletedAt: null }],
          title: { kind: event.kind, title: taken },
        })
      : null;
    return { event: saved, receipt };
  });
}

/**
 * Undo a title taken by a change to Concert: the Event goes back to the kind and title it had,
 * in one transaction. The receipt is used up only when the title comes back. It restores only
 * while the Event is still a live Concert, as that change left it: while the Event is deleted
 * the Undo is refused with EVENT_DELETED, and once it is another kind with KIND_CHANGED, since
 * restoring would undo the rasika's newer choice; either way the receipt is kept, so the title
 * can still come back. A used receipt, or one whose Event is gone, restores nothing and returns
 * null.
 */
export async function restoreTitle(
  receiptId: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<Event | null> {
  return db.transaction('rw', [db.events, db.appearances, db.outbox, db.meta], async () => {
    const pending = await peekReceipt(db, receiptId);
    if (pending?.kind !== 'title' || !pending.title) return null;
    const event = await db.events.get(pending.eventId);
    if (event && event.deletedAt !== null) throw new RuleError([EVENT_DELETED]);
    if (event && event.kind !== 'concert') throw new RuleError([KIND_CHANGED]);
    // Taken only now: a refusal above, or a rule below, leaves the receipt in place.
    const receipt = await takeReceipt(db, receiptId, 'title');
    if (!receipt?.title || !event) return null;
    const restored: Event = { ...event, ...receipt.title, touched: true };
    check(eventProblems(restored));
    await checkLecdem(restored, db);
    return save('events', restored, { db });
  });
}

// data-model.md, "State transitions".
const TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  planned: ['attended', 'missed'],
  attended: ['planned'],
  missed: ['planned'],
};

/**
 * Move an Event between Planned, Attended and Missed:
 * - `planned → attended` is the explicit "Start logging" (FR-026), and marks it `touched`;
 * - `planned → missed` when the rasika says so;
 * - `missed → planned` and `attended → planned` undo either.
 * Leaving Planned clears a pending "schedule changed" hint: Attended and Missed never carry it.
 */
export async function setStatus(
  id: string,
  status: EventStatus,
  { db = defaultDb }: WriteOptions = {},
): Promise<Event> {
  return db.transaction('rw', [db.events, db.outbox], async () => {
    const event = await getLive('events', id, { db });
    if (!TRANSITIONS[event.status].includes(status)) {
      throw new RuleError([`an Event cannot go from ${event.status} to ${status}`]);
    }
    return save(
      'events',
      {
        ...event,
        status,
        touched: event.touched || status === 'attended',
        // Attended and Missed never carry the "schedule changed" hint (2026-11-07).
        scheduleChanged: status === 'planned' && event.scheduleChanged,
      },
      { db },
    );
  });
}

/**
 * Delete an Event with its Appearances and Items, as tombstones, in one transaction: no live
 * Item ever points at a deleted Event (data-model.md, "Validation rules"). The receipt names
 * exactly the records this delete removed, so Undo never brings back an Item or Appearance
 * deleted earlier on purpose (eng review D1, D7).
 */
export async function deleteEvent(
  id: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<Deleted<Event> | undefined> {
  return db.transaction(
    'rw',
    [db.events, db.appearances, db.items, db.outbox, db.meta],
    async () => {
      const event = await db.events.get(id);
      if (!event || event.deletedAt !== null) return undefined;
      const records: DeletionReceipt['records'] = [];
      for (const appearance of await db.appearances.where('eventId').equals(id).toArray()) {
        if (appearance.deletedAt !== null) continue;
        const tombstone = (await remove('appearances', appearance.id, { db }))!;
        records.push({ table: 'appearances', id: appearance.id, deletedAt: tombstone.deletedAt! });
      }
      for (const item of await db.items.where('eventId').equals(id).toArray()) {
        if (item.deletedAt !== null) continue;
        const tombstone = (await remove('items', item.id, { db }))!;
        records.push({ table: 'items', id: item.id, deletedAt: tombstone.deletedAt! });
      }
      const tombstone = (await remove('events', id, { db }))!;
      records.unshift({ table: 'events', id, deletedAt: tombstone.deletedAt! });
      const receipt = await writeReceipt(db, {
        kind: 'event',
        eventId: id,
        position: null,
        records,
      });
      return { tombstone, receipt };
    },
  );
}

/**
 * Undo an Event delete: the Event and exactly the Appearances and Items its delete removed come
 * back, in one transaction, with Items brought to the catalog in use. A used or stale receipt
 * restores nothing and returns null.
 */
export async function restoreEvent(
  receiptId: string,
  { db = defaultDb, catalog }: RestoreOptions = {},
): Promise<Event | null> {
  return db.transaction(
    'rw',
    [db.events, db.appearances, db.items, db.outbox, db.meta],
    async () => {
      const receipt = await takeReceipt(db, receiptId, 'event');
      if (!receipt) return null;
      const rows = async <T>(table: 'events' | 'appearances' | 'items') =>
        (await db
          .table(table)
          .bulkGet(receipt.records.filter((r) => r.table === table).map((r) => r.id))) as T[];
      const [event] = await rows<Event>('events');
      if (!event) return null;
      // One Event per Schedule entry: once the entry is planned again, the deleted one stays
      // deleted. Thrown inside the transaction, so the receipt is kept.
      if (event.scheduleEntryId !== null) {
        const again = await db.events
          .where('scheduleEntryId')
          .equals(event.scheduleEntryId)
          .filter((other) => other.deletedAt === null && other.id !== event.id)
          .count();
        if (again > 0) throw new RuleError([ENTRY_PLANNED_AGAIN]);
      }
      const restored = await save('events', event, { db, restore: true });
      for (const appearance of await rows<Appearance>('appearances')) {
        await save('appearances', appearance, { db, restore: true });
      }
      await restoreItemRows(await rows<Item>('items'), db, catalog);
      return restored;
    },
  );
}

/** What a Concert made by Season's + was born with: its defaults, and its row as first stored. */
export interface Birth {
  kind: EventKind;
  date: string;
  startTime: string | null;
  /** The `updatedAt` it was stored with: any later save stamps a new one. */
  updatedAt: string;
}

/**
 * Take back a Concert made by Season's + that the rasika left with nothing entered (the
 * Maintainer, 2026-11-08): it is still exactly as born, never saved again, with no Appearance
 * or Item ever made for it (a deleted one included), no Item search text kept and no logging.
 * Checked and removed in one transaction, so a save landing at the same moment either comes
 * first and keeps it, or finds it gone. It leaves no row only with proof it never left the
 * phone: its birth still queued and never sent, and the server never heard of it (no known seq,
 * nothing refused). Anything else, an acked birth above all (its outbox entry gone), is deleted
 * as a tombstone that syncs as any delete does (ADR 0003), so the server never keeps an empty
 * Concert; a refused birth's "needs attention" entry goes with it, since it holds only what the
 * Concert was born with. Anything entered keeps it: `kept`.
 */
export async function discardUntouched(
  id: string,
  birth: Birth,
  { db = defaultDb }: WriteOptions = {},
): Promise<'discarded' | 'kept' | 'gone'> {
  return db.transaction(
    'rw',
    [db.events, db.appearances, db.items, db.outbox, db.meta, db.serverSeqs, db.attention],
    async () => {
      const event = await db.events.get(id);
      if (!event || event.deletedAt !== null) return 'gone';
      const asBorn =
        event.updatedAt === birth.updatedAt &&
        event.kind === birth.kind &&
        event.date === birth.date &&
        event.startTime === birth.startTime &&
        event.status === 'attended' &&
        event.sabhaId === null &&
        event.title === null &&
        event.note === null;
      if (!asBorn) return 'kept';
      const made =
        (await db.appearances.where('eventId').equals(id).count()) +
        (await db.items.where('eventId').equals(id).count());
      if (made > 0) return 'kept';
      if (await db.meta.get(draftKey(id))) return 'kept';
      if (await readLoggingNote(id, db)) return 'kept';
      const queued = (await db.outbox.where('recordId').equals(id).toArray()).filter(
        (entry) => entry.table === 'events',
      );
      const refused = db.attention.where({ table: 'events', recordId: id });
      const neverLeft =
        queued.length > 0 &&
        queued.every((entry) => entry.firstSentAt === null) &&
        (await db.serverSeqs.get(['events', id])) === undefined &&
        (await refused.count()) === 0;
      if (neverLeft) {
        await db.outbox.bulkDelete(queued.map((entry) => entry.seq!));
        await db.events.delete(id);
      } else {
        await refused.delete();
        await remove('events', id, { db });
      }
      return 'discarded';
    },
  );
}

/** Whether an Event with this id was made and since deleted: its id is never made again. */
export async function isDeletedEvent(
  id: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<boolean> {
  return (await db.events.get(id))?.deletedAt != null;
}
