// What the screens read. Tombstones are hidden, merged Artists and Sabhas lead to the one that
// survived, and own entries the Maintainer promoted read through their Link (ADR 0005). Rows
// are never rewritten to get there, so the text as typed is kept.

import { useLiveQuery } from 'dexie-react-hooks';
import type { Appearance, Event, Item, Link, OwnEntry, SharedEntry } from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { eventStart, readLoggingNotes } from './logging-note';
import { listReceipts } from './receipts';

/** An Artist or Sabha as the screens show it. */
export interface ResolvedEntry {
  /** The id to group by: the shared entry's when linked, else the surviving own entry's. */
  id: string;
  name: string;
  aliases: string[];
  shared: boolean;
  /** The surviving own entry, when the reference was to an own one. */
  own: OwnEntry | null;
}

export interface ResolvedEvent extends Event {
  /** The Schedule entry, from the Event or from a Link the Maintainer wrote. */
  scheduleEntryId: string | null;
}

export interface ResolvedAppearance extends Appearance {
  artist: ResolvedEntry | null;
}

const live = <T extends { deletedAt: string | null }>(row: T | undefined): row is T =>
  row !== undefined && row.deletedAt === null;

// Merges are short chains; the cap stops a cycle written by mistake from hanging a screen.
const MAX_MERGE_HOPS = 32;

type Kind = 'artist' | 'sabha';

async function resolveEntry(
  kind: Kind,
  id: string,
  db: WrappedDB,
): Promise<ResolvedEntry | undefined> {
  const own = kind === 'artist' ? db.artists : db.sabhas;
  const shared = kind === 'artist' ? db.sharedArtists : db.sharedSabhas;

  const start = await own.get(id);
  if (!start) {
    const direct = await shared.get(id);
    return direct && fromShared(direct, null);
  }
  let entry: OwnEntry = start;
  for (let hops = 0; entry.mergedIntoId && hops < MAX_MERGE_HOPS; hops += 1) {
    const next: OwnEntry | undefined = await own.get(entry.mergedIntoId);
    if (!next) break;
    entry = next;
  }
  const link = await linkFor(kind, entry.id, db);
  const promoted = link && (await shared.get(link.sharedId));
  if (promoted) return fromShared(promoted, entry);
  return { id: entry.id, name: entry.name, aliases: entry.aliases, shared: false, own: entry };
}

function fromShared(entry: SharedEntry, own: OwnEntry | null): ResolvedEntry {
  return { id: entry.id, name: entry.name, aliases: entry.aliases, shared: true, own };
}

async function linkFor(ownTable: Link['ownTable'], ownId: string, db: WrappedDB) {
  return db.links.where('[ownTable+ownId]').equals([ownTable, ownId]).first();
}

export function resolveArtist(id: string, db: WrappedDB = defaultDb) {
  return resolveEntry('artist', id, db);
}

export function resolveSabha(id: string, db: WrappedDB = defaultDb) {
  return resolveEntry('sabha', id, db);
}

async function resolveEvent(event: Event, db: WrappedDB): Promise<ResolvedEvent> {
  if (event.scheduleEntryId) return event;
  const link = await linkFor('event', event.id, db);
  return link ? { ...event, scheduleEntryId: link.sharedId } : event;
}

/** Live Events, in date and start-time order. */
export async function listEvents(db: WrappedDB = defaultDb): Promise<ResolvedEvent[]> {
  const events = (await db.events.toArray()).filter(live);
  events.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
  );
  return Promise.all(events.map((event) => resolveEvent(event, db)));
}

export async function getEvent(
  id: string,
  db: WrappedDB = defaultDb,
): Promise<ResolvedEvent | undefined> {
  const event = await db.events.get(id);
  return live(event) ? resolveEvent(event, db) : undefined;
}

/** An Event's live Items in running order. */
export async function listItems(eventId: string, db: WrappedDB = defaultDb): Promise<Item[]> {
  const items = await db.items
    .where('[eventId+position]')
    .between([eventId, -Infinity], [eventId, Infinity])
    .toArray();
  return items.filter(live);
}

/** An Event's live Appearances in billing order, each with its Artist resolved. */
export async function listAppearances(
  eventId: string,
  db: WrappedDB = defaultDb,
): Promise<ResolvedAppearance[]> {
  const appearances = (await db.appearances.where('eventId').equals(eventId).toArray()).filter(
    live,
  );
  appearances.sort((a, b) => a.position - b.position);
  return Promise.all(
    appearances.map(async (appearance) => ({
      ...appearance,
      artist: (await resolveArtist(appearance.artistId, db)) ?? null,
    })),
  );
}

// Hooks: each redraws when the tables it read change. Undefined means still loading.

export function useEvents() {
  return useLiveQuery(() => listEvents());
}

export function useEvent(id: string) {
  return useLiveQuery(() => getEvent(id), [id]);
}

export function useItems(eventId: string) {
  return useLiveQuery(() => listItems(eventId), [eventId]);
}

export function useAppearances(eventId: string) {
  return useLiveQuery(() => listAppearances(eventId), [eventId]);
}

export function useSabha(id: string | null) {
  return useLiveQuery(async () => (id ? ((await resolveSabha(id)) ?? null) : null), [id]);
}

export function useItem(id: string | null) {
  return useLiveQuery(async () => {
    if (!id) return null;
    const item = await defaultDb.items.get(id);
    return live(item) ? item : null;
  }, [id]);
}

/** Writes not yet on the server (FR-016): the outbox's length. */
export function useUnsyncedCount() {
  return useLiveQuery(() => defaultDb.outbox.count());
}

export interface EventSummary {
  event: ResolvedEvent;
  sabha: ResolvedEntry | null;
  firstArtist: string | null;
  itemCount: number;
}

/** Every live Event with what home shows of it: Sabha, first-billed Artist, Item count. */
export async function listEventSummaries(db: WrappedDB = defaultDb): Promise<EventSummary[]> {
  const events = await listEvents(db);
  return Promise.all(
    events.map(async (event) => {
      const [first] = await listAppearances(event.id, db);
      return {
        event,
        sabha: event.sabhaId ? ((await resolveSabha(event.sabhaId, db)) ?? null) : null,
        firstArtist: first?.artist?.name ?? null,
        itemCount: (await listItems(event.id, db)).length,
      };
    }),
  );
}

export function useEventSummaries() {
  return useLiveQuery(() => listEventSummaries());
}

/** The per-phone logging notes, for the Now selector. */
export function useLoggingNotes() {
  return useLiveQuery(() => readLoggingNotes());
}

/** An Event's receipts for "Recently deleted" in its "⋯" menu. */
export function useReceipts(eventId: string) {
  return useLiveQuery(() => listReceipts(eventId, defaultDb), [eventId]);
}

export interface WhatItAdded {
  /** Ragas heard for the first time this season, as shown. */
  ragas: string[];
  /** Composers heard for the first time this season. */
  composers: string[];
}

const counted = (value: { state: string; key: string | null; text: string }) =>
  value.state === 'unknown' || value.state === 'na' ? null : (value.key ?? value.text.trim());

/**
 * What one Concert added to the season (DESIGN.md "Finishing a Concert"): the Ragas and
 * Composers no Attended Event before it had. Derived each time, never stored (constitution III).
 */
export async function whatItAdded(
  eventId: string,
  db: WrappedDB = defaultDb,
): Promise<WhatItAdded> {
  const events = (await db.events.toArray()).filter(
    (event) => event.deletedAt === null && event.status === 'attended',
  );
  const self = events.find((event) => event.id === eventId);
  if (!self) return { ragas: [], composers: [] };
  const startOf = (event: Event) =>
    eventStart(event)?.getTime() ?? new Date(`${event.date}T00:00`).getTime();
  const earlier = events.filter(
    (event) =>
      event.id !== eventId &&
      (startOf(event) < startOf(self) ||
        (startOf(event) === startOf(self) && event.createdAt < self.createdAt)),
  );
  const seenRagas = new Set<string>();
  const seenComposers = new Set<string>();
  for (const event of earlier) {
    for (const item of await listItems(event.id, db)) {
      item.ragas.forEach((raga) => seenRagas.add(counted(raga) ?? ''));
      seenComposers.add(counted(item.composer) ?? '');
    }
  }
  const ragas = new Map<string, string>();
  const composers = new Map<string, string>();
  for (const item of await listItems(eventId, db)) {
    for (const raga of item.ragas) {
      const key = counted(raga);
      if (key && !seenRagas.has(key)) ragas.set(key, raga.text);
    }
    const composer = counted(item.composer);
    if (composer && !seenComposers.has(composer)) composers.set(composer, item.composer.text);
  }
  return { ragas: [...ragas.values()], composers: [...composers.values()] };
}

export function useWhatItAdded(eventId: string) {
  return useLiveQuery(() => whatItAdded(eventId), [eventId]);
}
