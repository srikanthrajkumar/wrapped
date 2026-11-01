// Artist, Sabha and Appearance actions (T037, FR-004, FR-005). Names are found by their fold
// (app/src/catalog/fold.ts) as the rasika types, across the rasika's own entries and the shared
// lists; a new name creates an own entry. A previously logged Artist gets a new Appearance for
// the same person (US1 scenario 6).

import { fold } from '../catalog/fold';
import {
  newId,
  type Appearance,
  type Colour,
  type OwnEntry,
  type Role,
  type SharedEntry,
} from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { getLive, newTimestamps, remove, save, type WriteOptions } from './mutate';
import { resolveArtist, resolveSabha, type ResolvedEntry } from './queries';
import { appearanceProblems, check, RuleError } from './rules';

type Kind = 'artist' | 'sabha';

/** A name offered as the rasika types. */
export interface NameMatch {
  /** The id to store: the shared entry's when the entry is shared or linked to one. */
  id: string;
  name: string;
  aliases: string[];
  shared: boolean;
}

export const DEFAULT_NAME_LIMIT = 10;

// Closer matches first: the whole name, then its start, then the start of a later word, then
// anywhere in it. A name ranks by its best spelling, the name itself or an Alias.
function rank(folded: string, needle: string): number | null {
  if (folded === needle) return 0;
  if (folded.startsWith(needle)) return 1;
  if (folded.includes(` ${needle}`)) return 2;
  if (folded.includes(needle)) return 3;
  return null;
}

function bestRank(names: string[], needle: string): number | null {
  let best: number | null = null;
  for (const name of names) {
    const r = rank(fold(name), needle);
    if (r !== null && (best === null || r < best)) best = r;
  }
  return best;
}

async function findNames(
  kind: Kind,
  query: string,
  limit: number,
  db: WrappedDB,
): Promise<NameMatch[]> {
  const needle = fold(query);
  if (needle === '') return [];
  const own = kind === 'artist' ? db.artists : db.sabhas;
  const shared = kind === 'artist' ? db.sharedArtists : db.sharedSabhas;
  const resolve = kind === 'artist' ? resolveArtist : resolveSabha;

  // Merged-away entries are skipped: their names are Aliases of the one that survived.
  const ownEntries = (await own.toArray()).filter(
    (entry: OwnEntry) => entry.deletedAt === null && entry.mergedIntoId === null,
  );
  const found = new Map<string, { match: NameMatch; rank: number }>();
  const offer = (entry: ResolvedEntry | SharedEntry, isShared: boolean, names: string[]) => {
    const r = bestRank(names, needle);
    if (r === null) return;
    const seen = found.get(entry.id);
    if (seen && seen.rank <= r) return;
    found.set(entry.id, {
      match: { id: entry.id, name: entry.name, aliases: entry.aliases, shared: isShared },
      rank: r,
    });
  };
  for (const entry of await shared.toArray()) offer(entry, true, [entry.name, ...entry.aliases]);
  for (const entry of ownEntries) {
    // An own entry the Maintainer promoted reads as the shared one (ADR 0005), so the two are
    // offered once; the name the rasika typed still finds it.
    const resolved = await resolve(entry.id, db);
    if (!resolved) continue;
    offer(resolved, resolved.shared, [
      entry.name,
      ...entry.aliases,
      resolved.name,
      ...resolved.aliases,
    ]);
  }
  return [...found.values()]
    .sort((a, b) => a.rank - b.rank || a.match.name.localeCompare(b.match.name))
    .slice(0, limit)
    .map(({ match }) => match);
}

/** Artists, own and shared, whose name or an Alias contains what was typed, best first. */
export function findArtists(
  query: string,
  { db = defaultDb, limit = DEFAULT_NAME_LIMIT }: WriteOptions & { limit?: number } = {},
) {
  return findNames('artist', query, limit, db);
}

/** Sabhas, own and shared, whose name or an Alias contains what was typed, best first. */
export function findSabhas(
  query: string,
  { db = defaultDb, limit = DEFAULT_NAME_LIMIT }: WriteOptions & { limit?: number } = {},
) {
  return findNames('sabha', query, limit, db);
}

function ownEntry(name: string): OwnEntry {
  const trimmed = name.trim();
  if (fold(trimmed) === '') throw new RuleError(['a name needs at least one letter or digit']);
  return {
    id: newId(),
    name: trimmed,
    // Groups promotion candidates (outside voice 9).
    nameKey: fold(trimmed),
    aliases: [],
    mergedIntoId: null,
    ...newTimestamps(),
  };
}

/** A new own Artist, with the name as typed (FR-005). */
export function createArtist(name: string, options: WriteOptions = {}) {
  return save('artists', ownEntry(name), options);
}

/** A new own Sabha, with the name as typed (FR-005). */
export function createSabha(name: string, options: WriteOptions = {}) {
  return save('sabhas', ownEntry(name), options);
}

export interface AppearanceFields {
  role?: Role | null;
  colourPrimary?: Colour | 'unknown' | null;
  colourSecondary?: Colour | null;
  /** From the Plan or the Schedule. */
  billed?: boolean;
}

// FR-013: a Lecdem has at most 3 presenters.
const MAX_PRESENTERS = 3;

async function liveAppearances(eventId: string, db: WrappedDB) {
  return (await db.appearances.where('eventId').equals(eventId).toArray()).filter(
    (appearance) => appearance.deletedAt === null,
  );
}

async function checkPresenters(appearance: Appearance, db: WrappedDB) {
  if (appearance.role !== 'presenter') return;
  const event = await getLive('events', appearance.eventId, { db });
  if (event.kind !== 'lecdem') return;
  const others = (await liveAppearances(appearance.eventId, db)).filter(
    (other) => other.id !== appearance.id && other.role === 'presenter',
  );
  if (others.length >= MAX_PRESENTERS) {
    throw new RuleError([`a Lecdem has at most ${MAX_PRESENTERS} presenters`]);
  }
}

/**
 * Add an Artist to an Event, last in billing order. The Artist is any own or shared id, so an
 * Artist from an earlier Event gets a new Appearance, not a new Artist.
 */
export async function addAppearance(
  eventId: string,
  artistId: string,
  fields: AppearanceFields = {},
  { db = defaultDb }: WriteOptions = {},
): Promise<Appearance> {
  return db.transaction('rw', [db.events, db.appearances, db.outbox], async () => {
    await getLive('events', eventId, { db });
    const positions = (await liveAppearances(eventId, db)).map((a) => a.position);
    const appearance: Appearance = {
      id: newId(),
      eventId,
      artistId,
      role: fields.role ?? null,
      colourPrimary: fields.colourPrimary ?? null,
      colourSecondary: fields.colourSecondary ?? null,
      billed: fields.billed ?? false,
      position: Math.max(0, ...positions) + 1,
      ...newTimestamps(),
    };
    check(appearanceProblems(appearance));
    await checkPresenters(appearance, db);
    return save('appearances', appearance, { db });
  });
}

/** Change an Appearance's Artist, Role or Colours. Colours can be set at any time (DD3). */
export async function editAppearance(
  id: string,
  changes: AppearanceFields & { artistId?: string },
  { db = defaultDb }: WriteOptions = {},
): Promise<Appearance> {
  return db.transaction('rw', [db.events, db.appearances, db.outbox], async () => {
    const edited: Appearance = { ...(await getLive('appearances', id, { db })), ...changes };
    check(appearanceProblems(edited));
    await checkPresenters(edited, db);
    return save('appearances', edited, { db });
  });
}

export function removeAppearance(id: string, options: WriteOptions = {}) {
  return remove('appearances', id, options);
}
