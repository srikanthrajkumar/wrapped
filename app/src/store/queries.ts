// What the screens read. Tombstones are hidden, merged Artists and Sabhas lead to the one that
// survived, and own entries the Maintainer promoted read through their Link (ADR 0005). Rows
// are never rewritten to get there, so the text as typed is kept.

import { useLiveQuery } from 'dexie-react-hooks';
import type { Appearance, Event, Item, Link, OwnEntry, SharedEntry } from '../model';
import { db as defaultDb, type WrappedDB } from './db';

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
