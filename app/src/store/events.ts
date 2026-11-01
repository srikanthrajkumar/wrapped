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
import { db as defaultDb } from './db';
import { restoreItemRows, type Deleted, type RestoreOptions } from './items';
import { getLive, newTimestamps, remove, save, type WriteOptions } from './mutate';
import { takeReceipt, writeReceipt, type DeletionReceipt } from './receipts';
import { check, eventProblems, RuleError } from './rules';

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
  /** Required for a Lecdem. */
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
export async function createEvent(input: NewEvent, options: WriteOptions = {}): Promise<Event> {
  const source = input.source ?? 'spot';
  const status: EventStatus = source === 'spot' ? 'attended' : 'planned';
  const event: Event = {
    id: newId(),
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
    title: input.kind === 'concert' ? (input.title ?? null) : (input.title?.trim() ?? null),
    note: input.note ?? null,
    ...newTimestamps(),
  };
  check(eventProblems(event));
  return save('events', event, options);
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
    check(eventProblems(edited));
    return save('events', edited, { db });
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
      { ...event, status, touched: event.touched || status === 'attended' },
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
      const restored = await save('events', event, { db, restore: true });
      for (const appearance of await rows<Appearance>('appearances')) {
        await save('appearances', appearance, { db, restore: true });
      }
      await restoreItemRows(await rows<Item>('items'), db, catalog);
      return restored;
    },
  );
}
