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
import { renumber, type Deleted } from './items';
import { getLive, newTimestamps, remove, save, type WriteOptions } from './mutate';
import { entryResolver, loadEntries, MAX_MERGE_HOPS, type ResolvedEntry } from './queries';
import { peekReceipt, takeReceipt, writeReceipt } from './receipts';
import { appearanceProblems, check, EVENT_DELETED, RuleError } from './rules';

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
  // The own, shared and Link tables, read once for both the matching and the resolving.
  const { own, shared, resolve } = await loadEntries(kind, db);

  // Merged-away entries are skipped: their names are Aliases of the one that survived.
  const ownEntries = own.filter(
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
  for (const entry of shared) offer(entry, true, [entry.name, ...entry.aliases]);
  for (const entry of ownEntries) {
    // An own entry the Maintainer promoted reads as the shared one (ADR 0005), so the two are
    // offered once; the name the rasika typed still finds it.
    const resolved = resolve(entry.id);
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

function ownEntry(name: string, id: string): OwnEntry {
  const trimmed = name.trim();
  if (fold(trimmed) === '') throw new RuleError(['a name needs at least one letter or digit']);
  return {
    id,
    name: trimmed,
    // Groups promotion candidates (outside voice 9).
    nameKey: fold(trimmed),
    aliases: [],
    mergedIntoId: null,
    ...newTimestamps(),
  };
}

/** With `id`, a create retried after a failure, or tapped twice, never makes a second entry. */
export interface CreateOptions extends WriteOptions {
  id?: string;
}

async function createOwn(
  table: 'artists' | 'sabhas',
  name: string,
  { db = defaultDb, id = newId() }: CreateOptions,
): Promise<OwnEntry> {
  return db.transaction('rw', [db.table(table), db.outbox], async () => {
    const existing = (await db.table(table).get(id)) as OwnEntry | undefined;
    if (existing?.deletedAt === null) return existing;
    if (existing) throw new RuleError([`${table} id ${id} is already used`]);
    return save(table, ownEntry(name, id), { db });
  });
}

/** A new own Artist, with the name as typed (FR-005). */
export function createArtist(name: string, options: CreateOptions = {}) {
  return createOwn('artists', name, options);
}

/** A new own Sabha, with the name as typed (FR-005). */
export function createSabha(name: string, options: CreateOptions = {}) {
  return createOwn('sabhas', name, options);
}

/** Why a shared Artist's name can't change on the phone: the Maintainer curates it (FR-045). */
export const SHARED_NAME = 'a shared Artist is named by the Maintainer';

/** Why a rename is refused when the Artist's merges can't be followed to the one that survived. */
export const MERGE_UNRESOLVED = 'the Artist this was merged into could not be found';

/**
 * Correct an own Artist's name (walkthrough S5). Appearances point at the Artist, so the new
 * name shows in every Concert, and the name it replaces becomes an Alias, so search still finds
 * it. Nothing is lost whichever way it runs:
 * - the entry is read inside the transaction, following merges to the one that survived, so a
 *   rename from a screen that is out of date, or two at once, keeps every name, each replaced
 *   one as an Alias;
 * - the same name again changes nothing, so a retry adds nothing;
 * - renaming back is the undo: the old name returns and the other stays as an Alias;
 * - a failed write leaves the entry as it was.
 * A shared Artist, or an own one the Maintainer promoted, reads by the shared name, so renaming
 * it is refused until the shared lists reach the phone (Phase 7).
 */
export async function renameArtist(
  id: string,
  name: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<OwnEntry> {
  const trimmed = name.trim();
  const key = fold(trimmed);
  if (key === '') throw new RuleError(['a name needs at least one letter or digit']);
  return db.transaction('rw', [db.artists, db.sharedArtists, db.links, db.outbox], async () => {
    if (!(await db.artists.get(id)) && (await db.sharedArtists.get(id))) {
      throw new RuleError([SHARED_NAME]);
    }
    let entry = await getLive('artists', id, { db });
    for (let hops = 0; entry.mergedIntoId && hops < MAX_MERGE_HOPS; hops += 1) {
      entry = await getLive('artists', entry.mergedIntoId, { db });
    }
    // A chain too long to follow (a cycle written by mistake) never renames a merged-away entry.
    if (entry.mergedIntoId) throw new RuleError([MERGE_UNRESOLVED]);
    if (await db.links.where('[ownTable+ownId]').equals(['artist', entry.id]).first()) {
      throw new RuleError([SHARED_NAME]);
    }
    if (entry.name === trimmed) return entry;
    // One Alias per spelling search tells apart; the new name is no longer an Alias.
    const seen = new Set([key]);
    const aliases = [...entry.aliases, entry.name].filter((alias) => {
      const folded = fold(alias);
      if (seen.has(folded)) return false;
      seen.add(folded);
      return true;
    });
    return save('artists', { ...entry, name: trimmed, nameKey: key, aliases }, { db });
  });
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
 * Add an Artist to an Event, last in the order added. The Artist is any own or shared id, so an
 * Artist from an earlier Event gets a new Appearance, not a new Artist.
 */
export async function addAppearance(
  eventId: string,
  artistId: string,
  fields: AppearanceFields = {},
  { db = defaultDb, id = newId() }: CreateOptions = {},
): Promise<Appearance> {
  return db.transaction('rw', [db.events, db.appearances, db.outbox], async () => {
    // A retried add (each attempt has its own id) never adds the Artist twice.
    const existing = await db.appearances.get(id);
    if (existing?.deletedAt === null && existing.eventId === eventId) return existing;
    if (existing) throw new RuleError([`appearance id ${id} is already used`]);
    await getLive('events', eventId, { db });
    const positions = (await liveAppearances(eventId, db)).map((a) => a.position);
    const appearance: Appearance = {
      id,
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

/** Remove an Appearance as a tombstone, with a receipt for Undo, in one transaction. */
export async function removeAppearance(
  id: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<Deleted<Appearance> | undefined> {
  return db.transaction('rw', [db.appearances, db.outbox, db.meta], async () => {
    const current = await db.appearances.get(id);
    if (!current || current.deletedAt !== null) return undefined;
    const tombstone = (await remove('appearances', id, { db }))!;
    const receipt = await writeReceipt(db, {
      kind: 'appearance',
      eventId: current.eventId,
      position: current.position,
      records: [{ table: 'appearances', id, deletedAt: tombstone.deletedAt! }],
    });
    return { tombstone, receipt };
  });
}

/**
 * Undo an Appearance removal: back at its old place in the order added, the others renumbered,
 * in one transaction. A used or stale receipt restores nothing; one whose Event is deleted is
 * refused with EVENT_DELETED, its receipt kept.
 * A restore that would break a rule (a fourth presenter at a Lecdem) is refused with the
 * receipt kept, so it can be undone once the rasika has changed a Role.
 */
export async function restoreAppearance(
  receiptId: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<Appearance | null> {
  return db.transaction('rw', [db.events, db.appearances, db.outbox, db.meta], async () => {
    const pending = await peekReceipt(db, receiptId);
    const event = pending && (await db.events.get(pending.eventId));
    if (!event) return null;
    if (event.deletedAt !== null) throw new RuleError([EVENT_DELETED]);
    const receipt = await takeReceipt(db, receiptId, 'appearance');
    const record = receipt?.records[0];
    const tombstone = record && (await db.appearances.get(record.id));
    if (!tombstone) return null;
    // Throwing rolls the transaction back, receipt included.
    await checkPresenters(tombstone, db);
    const live = (await liveAppearances(tombstone.eventId, db)).sort(
      (a, b) => a.position - b.position,
    );
    const index = live.filter((other) => other.position < tombstone.position).length;
    const restored = await save(
      'appearances',
      { ...tombstone, position: index + 1 },
      { db, restore: true },
    );
    const order = [...live];
    order.splice(index, 0, restored);
    await renumber('appearances', order, db);
    return restored;
  });
}

/**
 * The rasika's recent Artists or Sabhas, most recent first, for a picker before anything is
 * typed (design D26): Sabhas of the latest Events, Artists of the latest Appearances.
 */
export async function recentNames(
  kind: Kind,
  { db = defaultDb, limit = 8 }: WriteOptions & { limit?: number } = {},
): Promise<NameMatch[]> {
  const ids: string[] = [];
  if (kind === 'sabha') {
    const events = (await db.events.toArray())
      .filter((event) => event.deletedAt === null && event.sabhaId !== null)
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
    for (const event of events) ids.push(event.sabhaId!);
  } else {
    const appearances = (await db.appearances.toArray())
      .filter((appearance) => appearance.deletedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const appearance of appearances) ids.push(appearance.artistId);
  }
  const resolve = await entryResolver(kind, db);
  const found = new Map<string, NameMatch>();
  for (const id of ids) {
    if (found.size >= limit) break;
    const entry = resolve(id);
    if (!entry || found.has(entry.id)) continue;
    found.set(entry.id, {
      id: entry.id,
      name: entry.name,
      aliases: entry.aliases,
      shared: entry.shared,
    });
  }
  return [...found.values()];
}

/** Each Artist's usual Role: the one they appeared in most often, where known (design D26). */
export async function usualRoles({ db = defaultDb }: WriteOptions = {}): Promise<
  Map<string, Role>
> {
  const counts = new Map<string, Map<Role, number>>();
  const resolve = await entryResolver('artist', db);
  for (const appearance of await db.appearances.toArray()) {
    if (appearance.deletedAt !== null || appearance.role === null) continue;
    const entry = resolve(appearance.artistId)?.id ?? appearance.artistId;
    const roles = counts.get(entry) ?? new Map<Role, number>();
    roles.set(appearance.role, (roles.get(appearance.role) ?? 0) + 1);
    counts.set(entry, roles);
  }
  const usual = new Map<string, Role>();
  for (const [artist, roles] of counts) {
    usual.set(artist, [...roles.entries()].sort((a, b) => b[1] - a[1])[0]![0]);
  }
  return usual;
}
