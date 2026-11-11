// What the screens read. Tombstones are hidden, merged Artists and Sabhas lead to the one that
// survived, and own entries the Maintainer promoted read through their Link (ADR 0005). Rows
// are never rewritten to get there, so the text as typed is kept.

import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Catalog } from '../catalog/load';
import type {
  Appearance,
  Event,
  EventStatus,
  Item,
  Link,
  OwnEntry,
  ScheduleEntry,
  SharedEntry,
} from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { eventStart, readLoggingNotes } from './logging-note';
import { countUnsynced } from './outbox';
import { listReceipts } from './receipts';
import {
  accompanying,
  byStage,
  concertType,
  joinNames,
  knownBy,
  knownNames,
  type ConcertType,
} from './stage';

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
export const MAX_MERGE_HOPS = 32;

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

/** Follow an id through merges and Links, in memory, the way `resolveEntry` does. */
function resolverOver(
  ownById: Map<string, OwnEntry>,
  sharedById: Map<string, SharedEntry>,
  linkByOwn: Map<string, Link>,
): (id: string) => ResolvedEntry | undefined {
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

/**
 * The own and shared entries of one kind, and a resolver over them: the own, shared and Link
 * tables are read once, then each id is followed in memory.
 */
export async function loadEntries(
  kind: Kind,
  db: WrappedDB = defaultDb,
): Promise<{
  own: OwnEntry[];
  shared: SharedEntry[];
  resolve: (id: string) => ResolvedEntry | undefined;
}> {
  const [own, shared, links] = await Promise.all([
    (kind === 'artist' ? db.artists : db.sabhas).toArray(),
    (kind === 'artist' ? db.sharedArtists : db.sharedSabhas).toArray(),
    db.links
      .where('[ownTable+ownId]')
      .between([kind, Dexie.minKey], [kind, Dexie.maxKey])
      .toArray(),
  ]);
  const resolve = resolverOver(
    new Map(own.map((entry) => [entry.id, entry])),
    new Map(shared.map((entry) => [entry.id, entry])),
    new Map(links.map((link) => [link.ownId, link])),
  );
  return { own, shared, resolve };
}

/**
 * A resolver for just `ids`: only those entries, the ones they were merged into, their Links
 * and the shared entries those name are read, rather than the whole directory.
 */
async function resolverFor(
  kind: Kind,
  ids: readonly string[],
  db: WrappedDB,
): Promise<(id: string) => ResolvedEntry | undefined> {
  const own = kind === 'artist' ? db.artists : db.sabhas;
  const shared = kind === 'artist' ? db.sharedArtists : db.sharedSabhas;
  const ownById = new Map<string, OwnEntry>();
  let wanted = [...new Set(ids)];
  for (let hops = 0; wanted.length > 0 && hops <= MAX_MERGE_HOPS; hops += 1) {
    const found = (await own.bulkGet(wanted)).filter((entry) => entry !== undefined);
    found.forEach((entry) => ownById.set(entry.id, entry));
    wanted = found
      .map((entry) => entry.mergedIntoId)
      .filter((id): id is string => id !== null && !ownById.has(id));
  }
  const links = await db.links
    .where('[ownTable+ownId]')
    .anyOf([...ownById.keys()].map((id) => [kind, id]))
    .toArray();
  const sharedIds = [
    ...new Set([...ids.filter((id) => !ownById.has(id)), ...links.map((l) => l.sharedId)]),
  ];
  const sharedEntries = (await shared.bulkGet(sharedIds)).filter((entry) => entry !== undefined);
  return resolverOver(
    ownById,
    new Map(sharedEntries.map((entry) => [entry.id, entry])),
    new Map(links.map((link) => [link.ownId, link])),
  );
}

/** Resolve many references at once, as a picker does per keystroke (`loadEntries`). */
export async function entryResolver(
  kind: Kind,
  db: WrappedDB = defaultDb,
): Promise<(id: string) => ResolvedEntry | undefined> {
  return (await loadEntries(kind, db)).resolve;
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

/**
 * The Ragas logged at the season's Attended Events, as catalog keys, one per Item that names
 * one: what the Season shelf's motif is drawn from (DESIGN.md "The motif").
 */
export async function listSeasonRagaKeys(db: WrappedDB = defaultDb): Promise<string[]> {
  const attended = new Set(
    (await db.events.toArray())
      .filter((event) => live(event) && event.status === 'attended')
      .map((event) => event.id),
  );
  const keys: string[] = [];
  for (const item of await db.items.toArray()) {
    if (!live(item) || !attended.has(item.eventId)) continue;
    for (const raga of item.ragas) if (raga.key !== null) keys.push(raga.key);
  }
  return keys;
}

export function useSeasonRagaKeys() {
  return useLiveQuery(() => listSeasonRagaKeys());
}

/** An Event's live Appearances in Stage order (store/stage.ts), each with its Artist resolved. */
export async function listAppearances(
  eventId: string,
  db: WrappedDB = defaultDb,
): Promise<ResolvedAppearance[]> {
  const appearances = (await db.appearances.where('eventId').equals(eventId).toArray()).filter(
    live,
  );
  appearances.sort(byStage);
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

/**
 * An Item, null once missing or deleted. With `withDeleted`, a deleted Item is returned too (a
 * new Item's editor must know its id is taken).
 */
export function useItem(id: string | null, { withDeleted = false } = {}) {
  return useLiveQuery(async () => {
    if (!id) return null;
    const item = await defaultDb.items.get(id);
    return item && (withDeleted || live(item)) ? item : null;
  }, [id, withDeleted]);
}

// The last value read for each `meta` key, so a screen drawn again shows it from its first
// frame rather than one read later (walkthrough P10: Settings' rows popped in and moved Export).
const metaSeen = new Map<string, unknown>();

async function readMeta(key: string): Promise<unknown> {
  const value = (await defaultDb.meta.get(key))?.value ?? null;
  metaSeen.set(key, value);
  return value;
}

/** One `meta` row's value, null when there is none; the last value read until it answers. */
export function useMeta<T>(key: string): T | null | undefined {
  return useLiveQuery(
    () => readMeta(key) as Promise<T | null>,
    [key],
    metaSeen.get(key) as T | null | undefined,
  );
}

/** Read `meta` rows ahead, so the screen that shows them draws them at once. */
export async function preloadMeta(keys: readonly string[]): Promise<void> {
  await Promise.all(keys.map(readMeta));
}

/** Writes not yet on the server (FR-016): the outbox and "needs attention" (store/outbox.ts). */
export function useUnsyncedCount() {
  return useLiveQuery(() => countUnsynced(defaultDb));
}

export interface EventSummary {
  event: ResolvedEvent;
  sabha: ResolvedEntry | null;
  /**
   * The Artists it is known by (store/stage.ts): "Ranjani & Gayatri", a Group by its name
   * ("Malladi Brothers"); null before any.
   */
  knownBy: string | null;
  /**
   * Every Artist on its Stage, each with the names they are found by: their name, their Aliases
   * and a group they were billed under. Season's filter matches on these (screens/season-filter.ts).
   */
  stage: { name: string; aliases: string[]; group: string | null }[];
  /** Everyone else on its Stage, in Stage order: the accompanists a row lists (ADR 0011). */
  accompanists: string[];
  /** Its type as a row names it, read from its Stage and never stored (ADR 0011). */
  type: ConcertType | null;
  itemCount: number;
  /**
   * Marked cancelled (T061): the Event was, or its Schedule entry is now. An Event the rasika
   * changed keeps `cancelled` false (FR-027), but is still shown as cancelled once its entry is;
   * read here, never stored.
   */
  cancelled: boolean;
}

/**
 * Every live Event with what home shows of it: Sabha, the Artists it is known by, Item count.
 * The Appearances and Items of all Events are read in one query each, and only the Artists and
 * Sabhas named are resolved, never the whole directories.
 */
export async function listEventSummaries(db: WrappedDB = defaultDb): Promise<EventSummary[]> {
  const events = await listEvents(db);
  const ids = events.map((event) => event.id);
  const entryIds = [
    ...new Set(events.map((event) => event.scheduleEntryId).filter((id) => id !== null)),
  ];
  const [appearances, items, entries] = await Promise.all([
    db.appearances.where('eventId').anyOf(ids).toArray(),
    db.items.where('eventId').anyOf(ids).toArray(),
    db.schedule.bulkGet(entryIds),
  ]);
  const cancelledEntries = new Set(
    entries.filter((entry) => entry?.cancelled).map((entry) => entry!.id),
  );
  const stages = new Map<string, Appearance[]>();
  for (const appearance of appearances.filter(live)) {
    const stage = stages.get(appearance.eventId);
    if (stage) stage.push(appearance);
    else stages.set(appearance.eventId, [appearance]);
  }
  const known = new Map(
    events.map((event) => [
      event.id,
      knownBy(event.kind, (stages.get(event.id) ?? []).sort(byStage)),
    ]),
  );
  const counts = new Map<string, number>();
  for (const item of items.filter(live))
    counts.set(item.eventId, (counts.get(item.eventId) ?? 0) + 1);
  const [artists, sabhas] = await Promise.all([
    resolverFor(
      'artist',
      [...stages.values()].flat().map((appearance) => appearance.artistId),
      db,
    ),
    resolverFor(
      'sabha',
      events.map((event) => event.sabhaId).filter((id): id is string => id !== null),
      db,
    ),
  ]);
  return events.map((event) => {
    const names = knownNames(known.get(event.id)!, (a) => artists(a.artistId)?.name ?? '?');
    const stage = stages.get(event.id) ?? [];
    return {
      event,
      sabha: event.sabhaId ? (sabhas(event.sabhaId) ?? null) : null,
      knownBy: names.length > 0 ? joinNames(names) : null,
      accompanists: accompanying(event.kind, stage).map((a) => artists(a.artistId)?.name ?? '?'),
      type: concertType(event.kind, stage),
      stage: (stages.get(event.id) ?? []).map((appearance) => {
        const artist = artists(appearance.artistId);
        return {
          name: artist?.name ?? '?',
          aliases: artist?.aliases ?? [],
          group: appearance.group ?? null,
        };
      }),
      itemCount: counts.get(event.id) ?? 0,
      cancelled:
        event.cancelled ||
        (event.scheduleEntryId !== null && cancelledEntries.has(event.scheduleEntryId)),
    };
  });
}

export function useEventSummaries() {
  return useLiveQuery(() => listEventSummaries());
}

/** A Schedule entry as What's on lists it, with the rasika's live Event made from it, if any. */
export interface ScheduleListing {
  entry: ScheduleEntry;
  /** The rasika's Event made from this entry; null until it is Shortlisted, or once deleted. */
  plannedId: string | null;
  /**
   * That Event's status; null with no Event. One Missed, or Shortlisted and lapsed, is shown
   * nowhere, so its entry reads as a plain listing again (ADR 0010).
   */
  status: EventStatus | null;
}

/** The stored Schedule from `from` (an ISO date) on, by day, then start time, then Sabha. */
export async function listSchedule(
  from: string,
  db: WrappedDB = defaultDb,
): Promise<ScheduleListing[]> {
  const [entries, planned] = await Promise.all([
    db.schedule.where('date').aboveOrEqual(from).toArray(),
    db.events
      .filter((event) => event.deletedAt === null && event.scheduleEntryId !== null)
      .toArray(),
  ]);
  const plannedBy = new Map(planned.map((event) => [event.scheduleEntryId!, event]));
  entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '99').localeCompare(b.startTime ?? '99') ||
      a.sabha.localeCompare(b.sabha),
  );
  return entries.map((entry) => {
    const event = plannedBy.get(entry.id);
    return { entry, plannedId: event?.id ?? null, status: event?.status ?? null };
  });
}

export function useSchedule(from: string) {
  return useLiveQuery(() => listSchedule(from), [from]);
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
