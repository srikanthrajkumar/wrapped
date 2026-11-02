// What the screens read. Tombstones are hidden, merged Artists and Sabhas lead to the one that
// survived, and own entries the Maintainer promoted read through their Link (ADR 0005). Rows
// are never rewritten to get there, so the text as typed is kept.

import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Catalog } from '../catalog/load';
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

/**
 * Resolve many references at once, as a picker does per keystroke: the own, shared and Link
 * tables are read once, then each id is followed in memory the way `resolveEntry` follows it.
 */
export async function entryResolver(
  kind: Kind,
  db: WrappedDB = defaultDb,
): Promise<(id: string) => ResolvedEntry | undefined> {
  const [own, shared, links] = await Promise.all([
    (kind === 'artist' ? db.artists : db.sabhas).toArray(),
    (kind === 'artist' ? db.sharedArtists : db.sharedSabhas).toArray(),
    db.links
      .where('[ownTable+ownId]')
      .between([kind, Dexie.minKey], [kind, Dexie.maxKey])
      .toArray(),
  ]);
  const ownById = new Map(own.map((entry) => [entry.id, entry]));
  const sharedById = new Map(shared.map((entry) => [entry.id, entry]));
  const linkByOwn = new Map(links.map((link) => [link.ownId, link]));
  return (id) => {
    const start = ownById.get(id);
    if (!start) {
      const direct = sharedById.get(id);
      return direct && fromShared(direct, null);
    }
    let entry: OwnEntry = start;
    for (let hops = 0; entry.mergedIntoId && hops < MAX_MERGE_HOPS; hops += 1) {
      const next = ownById.get(entry.mergedIntoId);
      if (!next) break;
      entry = next;
    }
    const link = linkByOwn.get(entry.id);
    const promoted = link && sharedById.get(link.sharedId);
    if (promoted) return fromShared(promoted, entry);
    return { id: entry.id, name: entry.name, aliases: entry.aliases, shared: false, own: entry };
  };
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

/** How many live Items an Event has, counted on the index without building the Items. */
export async function countItems(eventId: string, db: WrappedDB = defaultDb): Promise<number> {
  return db.items
    .where('[eventId+position]')
    .between([eventId, -Infinity], [eventId, Infinity])
    .filter((item) => item.deletedAt === null)
    .count();
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
        itemCount: await countItems(event.id, db),
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

/**
 * What a Raga or Composer counts as: its key, or the text typed; nothing when Unknown or Not
 * applicable. A catalog Raga counts by its groupKey, so Linked ragas are one (constitution:
 * analytics aggregate on the linked pair).
 */
function counted(
  value: { state: string; key: string | null; text: string },
  catalog?: Catalog | null,
  raga = false,
): string | null {
  if (value.state === 'unknown' || value.state === 'na') return null;
  if (value.key === null) return value.text.trim();
  return raga ? (catalog?.ragaByKey.get(value.key)?.groupKey ?? value.key) : value.key;
}

/** How many Ragas the Items have, Linked ragas counted once (the Concert summary). */
export function countRagas(items: readonly Item[], catalog?: Catalog | null): number {
  const ragas = new Set<string>();
  for (const item of items) {
    for (const raga of item.ragas) {
      const key = counted(raga, catalog, true);
      if (key) ragas.add(key);
    }
  }
  return ragas.size;
}

/**
 * What one Concert added to the season (DESIGN.md "Finishing a Concert"): the Ragas and
 * Composers no Attended Event before it had, each shown by the name logged. Derived each time,
 * never stored (constitution III).
 */
export async function whatItAdded(
  eventId: string,
  db: WrappedDB = defaultDb,
  catalog?: Catalog | null,
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
      item.ragas.forEach((raga) => seenRagas.add(counted(raga, catalog, true) ?? ''));
      seenComposers.add(counted(item.composer) ?? '');
    }
  }
  const ragas = new Map<string, string>();
  const composers = new Map<string, string>();
  for (const item of await listItems(eventId, db)) {
    for (const raga of item.ragas) {
      const key = counted(raga, catalog, true);
      if (key && !seenRagas.has(key) && !ragas.has(key)) ragas.set(key, raga.text);
    }
    const composer = counted(item.composer);
    if (composer && !seenComposers.has(composer) && !composers.has(composer)) {
      composers.set(composer, item.composer.text);
    }
  }
  return { ragas: [...ragas.values()], composers: [...composers.values()] };
}

export function useWhatItAdded(eventId: string, catalog: Catalog | null) {
  return useLiveQuery(() => whatItAdded(eventId, defaultDb, catalog), [eventId, catalog]);
}
