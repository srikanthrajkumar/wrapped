// The Schedule on the phone (T058, contracts/schedule-feed.md): the logger's feed read and kept,
// an entry added to the Plan, and each new version applied to the Events made from it. The
// Schedule only ever suggests: an Event the rasika has edited, started or changed the Stage of
// is never changed by it, only flagged (FR-027, constitution III).

import {
  EVENT_KINDS,
  newId,
  ROLES,
  type Appearance,
  type BilledArtist,
  type Event,
  type EventKind,
  type Role,
  type ScheduleEntry,
} from '../model';
import { md5 } from '../md5';
import { db as defaultDb, type WrappedDB } from './db';
import { checkLecdem, createEvent, titleFor } from './events';
import { getLive, newTimestamps, remove, save, type WriteOptions } from './mutate';
import { createArtist, createSabha, nameMatcher, type NameMatcher } from './people';
import { loadEntries } from './queries';
import { writeReceipt, type DeletionReceipt } from './receipts';
import { appearanceProblems, check, eventProblems, RuleError } from './rules';

/** The feed's format this reader knows (contracts/schedule-feed.md, "Format number"). */
export const SCHEDULE_FORMAT = 1;

/** The `meta` row that says which file the stored entries came from. */
export const SCHEDULE_META = 'schedule';

/** A feed file as read: only entries this reader can use. */
export interface ScheduleFile {
  season: string;
  publishedAt: string;
  entries: ScheduleEntry[];
}

/** What the phone keeps of the file its entries came from. */
export interface ScheduleMeta {
  season: string;
  publishedAt: string;
  /**
   * What the fetch knows this file by (store/schedule-fetch.ts: today the server's `ETag`), so it
   * can ask for a changed one only; null when it gave none. Opaque to everything else.
   */
  tag: string | null;
}

/** Why an entry can't be added. */
export const ENTRY_GONE = 'this Schedule entry is no longer on the phone';
export const ENTRY_CANCELLED = 'this Schedule entry is cancelled';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

function readBilled(value: unknown): BilledArtist | null {
  if (!isObject(value)) return null;
  const name = text(value.name);
  if (name === null) return null;
  // A Role is a hint: one this reader doesn't know reads as none.
  const role = ROLES.includes(value.role as Role) ? (value.role as Role) : null;
  return { name, role, group: text(value.group) };
}

function readEntry(value: unknown): ScheduleEntry | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === 'string' && value.id !== '' ? value.id : null;
  const sabha = text(value.sabha);
  const { version, date, startTime } = value;
  if (id === null || sabha === null) return null;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return null;
  if (typeof date !== 'string' || !ISO_DATE.test(date)) return null;
  if (startTime != null && (typeof startTime !== 'string' || !TIME.test(startTime))) return null;
  // An entry of a kind this reader doesn't know is skipped (contracts/schedule-feed.md).
  if (!EVENT_KINDS.includes(value.kind as EventKind)) return null;
  const kind = value.kind as EventKind;
  const billed = Array.isArray(value.billed) ? value.billed.map(readBilled) : [];
  return {
    id,
    version,
    date,
    startTime: (startTime as string | null | undefined) ?? null,
    sabha,
    kind,
    title: kind === 'concert' ? null : text(value.title),
    billed: billed.filter((person): person is BilledArtist => person !== null),
    cancelled: value.cancelled === true,
  };
}

/**
 * Read a feed file. Null for a file this reader can't use (not format 1, or not the feed's
 * shape), so the last stored copy stays. Fields it doesn't know are ignored, and an entry it
 * can't read, or of a kind it doesn't know, is left out; the rest of the file still counts.
 * Nothing is ever read from an entry's `id`.
 */
export function readScheduleFile(json: unknown): ScheduleFile | null {
  if (!isObject(json) || json.format !== SCHEDULE_FORMAT) return null;
  const season = text(json.season);
  const publishedAt = text(json.publishedAt);
  if (season === null || publishedAt === null || !Array.isArray(json.entries)) return null;
  const entries = new Map<string, ScheduleEntry>();
  for (const value of json.entries) {
    const entry = readEntry(value);
    if (entry && !entries.has(entry.id)) entries.set(entry.id, entry);
  }
  return { season, publishedAt, entries: [...entries.values()] };
}

/**
 * Keep a feed file's entries in place of the last ones, in one transaction. A file published
 * before the one stored, for the same Season, is a stale copy and changes nothing (returns
 * false). The entries are the logger's, not the rasika's: replacing them loses nothing logged.
 */
export async function storeSchedule(
  file: ScheduleFile,
  tag: string | null,
  { db = defaultDb }: WriteOptions = {},
): Promise<boolean> {
  return db.transaction('rw', [db.schedule, db.meta], async () => {
    const stored = (await db.meta.get(SCHEDULE_META))?.value as ScheduleMeta | undefined;
    if (stored?.season === file.season && file.publishedAt < stored.publishedAt) return false;
    await db.schedule.clear();
    await db.schedule.bulkPut(file.entries);
    const meta: ScheduleMeta = { season: file.season, publishedAt: file.publishedAt, tag };
    await db.meta.put({ key: SCHEDULE_META, value: meta });
    return true;
  });
}

/** The stored file's details, or null before any. */
export async function scheduleMeta(db: WrappedDB = defaultDb): Promise<ScheduleMeta | null> {
  return ((await db.meta.get(SCHEDULE_META))?.value as ScheduleMeta | undefined) ?? null;
}

// Every table a Schedule write reads or writes: the Event, its Stage, the names it matches or
// makes, and the stored entries.
const tablesOf = (db: WrappedDB) => [
  db.events,
  db.appearances,
  db.items,
  db.artists,
  db.sabhas,
  db.sharedArtists,
  db.sharedSabhas,
  db.links,
  db.outbox,
  db.schedule,
];

interface Names {
  artists: NameMatcher;
  sabhas: NameMatcher;
}

async function readNames(db: WrappedDB): Promise<Names> {
  const [artists, sabhas] = await Promise.all([
    nameMatcher('artist', db),
    nameMatcher('sabha', db),
  ]);
  return { artists, sabhas };
}

/** The entry's name as an Artist or Sabha: the one it matches, else a new own one. */
async function idFor(kind: 'artist' | 'sabha', name: string, names: Names, db: WrappedDB) {
  const matcher = kind === 'artist' ? names.artists : names.sabhas;
  const found = matcher.match(name);
  if (found) return found;
  const made = await (kind === 'artist' ? createArtist : createSabha)(name, { db });
  matcher.remember(name, made.id);
  return made.id;
}

/**
 * The id of the Appearance the Schedule bills at `place` (1-based) on an Event: a name-based
 * UUID (version 3) of the Event and the place, the same on every phone. Two phones applying the
 * same version before they sync (one of them not the writer, FR-022) then write the same record,
 * which the server sees as a conflict on identical rows, rather than billing the Artist twice.
 */
export function billedAppearanceId(eventId: string, place: number): string {
  const hex = md5(new TextEncoder().encode(`carnatic-wrapped/billed/${eventId}/${place}`));
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-3${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Make the Event's billed Stage the entry's, in billing order: each place keeps its Appearance,
 * changed in place where the Artist, Role or group differs; places the entry adds are new
 * Appearances, with the place's id (`billedAppearanceId`), brought back if a version dropped the
 * place before; places it no longer has are removed as tombstones. Only for an Event the rasika
 * never changed, whose Stage is all from the Schedule.
 */
async function billStage(event: Event, entry: ScheduleEntry, names: Names, db: WrappedDB) {
  const stage = (await db.appearances.where('eventId').equals(event.id).toArray())
    .filter((appearance) => appearance.deletedAt === null)
    .sort((a, b) => a.position - b.position);
  for (const [index, person] of entry.billed.entries()) {
    const artistId = await idFor('artist', person.name, names, db);
    const current = stage[index];
    const fields = { artistId, role: person.role, group: person.group, billed: true };
    if (
      current &&
      current.artistId === artistId &&
      current.role === person.role &&
      (current.group ?? null) === person.group &&
      current.position === index + 1
    ) {
      continue;
    }
    if (current) {
      const appearance: Appearance = { ...current, ...fields, position: index + 1 };
      check(appearanceProblems(appearance));
      await save('appearances', appearance, { db });
      continue;
    }
    const placeId = billedAppearanceId(event.id, index + 1);
    const earlier = await db.appearances.get(placeId);
    // The place's own tombstone comes back as the same record; a live row of this id (at
    // another place) or one on another Event is never written over.
    const reuse = !earlier || (earlier.deletedAt !== null && earlier.eventId === event.id);
    const appearance: Appearance = {
      id: reuse ? placeId : newId(),
      eventId: event.id,
      ...fields,
      colourPrimary: null,
      colourSecondary: null,
      position: index + 1,
      ...newTimestamps(),
    };
    check(appearanceProblems(appearance));
    await save('appearances', appearance, { db, restore: reuse && earlier !== undefined });
  }
  for (const extra of stage.slice(entry.billed.length)) {
    await remove('appearances', extra.id, { db });
  }
}

/**
 * Add a Schedule entry to the Plan (FR-025, T061): a Planned Event with `source` `schedule`, its
 * date, time, Sabha, kind and title, and the billed Artists in their Roles and groups, in one
 * transaction. Names are matched to the rasika's or the shared Artists and Sabhas, and a name
 * none has becomes an own entry. Adding it again, or retrying with the same `id`, returns the
 * Event already made, so a double tap never plans it twice. A cancelled entry is refused.
 */
export async function addFromSchedule(
  entryId: string,
  { db = defaultDb, id = newId() }: WriteOptions & { id?: string } = {},
): Promise<Event> {
  return db.transaction('rw', tablesOf(db), async () => {
    const made = await db.events.get(id);
    if (made?.deletedAt === null) return made;
    if (made) throw new RuleError([`event id ${id} is already used`]);
    const planned = await db.events
      .where('scheduleEntryId')
      .equals(entryId)
      .filter((event) => event.deletedAt === null)
      .first();
    if (planned) return planned;
    const entry = await db.schedule.get(entryId);
    if (!entry) throw new RuleError([ENTRY_GONE]);
    if (entry.cancelled) throw new RuleError([ENTRY_CANCELLED]);
    const names = await readNames(db);
    const event = await createEvent(
      {
        kind: entry.kind,
        date: entry.date,
        startTime: entry.startTime,
        sabhaId: await idFor('sabha', entry.sabha, names, db),
        source: 'schedule',
        title: entry.title,
        scheduleEntryId: entry.id,
        scheduleVersionSeen: String(entry.version),
      },
      { db, id },
    );
    await billStage(event, entry, names, db);
    // A Lecdem billed with more than 3 presenters is refused whole (FR-013).
    await checkLecdem(event, db);
    return event;
  });
}

/** `scheduleVersionSeen` holds the entry's integer version as text: compare it as a number. */
function versionSeen(event: Event): number {
  if (event.scheduleVersionSeen === null) return -1;
  const seen = Number(event.scheduleVersionSeen);
  return Number.isFinite(seen) ? seen : -1;
}

/**
 * Whether the Schedule must leave a Planned Event alone and only hint: `touched`, or, for a row
 * from before a Stage edit marked the Event touched, any sign of the rasika's hand (an Artist
 * they added, a Colour, an Item). Checked inside the write's transaction, so an edit made at the same moment is seen.
 */
async function changedByRasika(event: Event, db: WrappedDB): Promise<boolean> {
  if (event.touched) return true;
  const stage = await db.appearances.where('eventId').equals(event.id).toArray();
  if (
    stage.some(
      (appearance) =>
        appearance.deletedAt === null &&
        (!appearance.billed ||
          appearance.colourPrimary !== null ||
          appearance.colourSecondary !== null),
    )
  ) {
    return true;
  }
  return (await db.items.where('eventId').equals(event.id).count()) > 0;
}

export type Applied = 'updated' | 'flagged' | 'refused' | 'unchanged';

/**
 * Apply the stored entry's newer version to one Event (FR-027). An Attended or Missed Event is
 * never changed and gets no hint: it is the rasika's record of what happened. A Planned one:
 * - one the rasika never changed takes the new date, time, Sabha, kind, title and billed
 *   Artists with their Roles and groups, and its `cancelled`;
 * - one they changed is left as it is, with `scheduleChanged` set so the hint shows;
 * - either way `scheduleVersionSeen` records the version (on a Planned Event only).
 * An Event whose entry is missing (not in the newest file) is never changed. An update that
 * would break a rule (a Lecdem billed with 4 presenters) is refused whole, the Event left as it
 * was and its version not recorded, so a corrected version still applies.
 */
export async function applyEntry(eventId: string, db: WrappedDB = defaultDb): Promise<Applied> {
  try {
    return await db.transaction('rw', tablesOf(db), async () => {
      const event = await db.events.get(eventId);
      if (!event || event.deletedAt !== null || event.scheduleEntryId === null) return 'unchanged';
      const entry = await db.schedule.get(event.scheduleEntryId);
      if (!entry || versionSeen(event) >= entry.version) return 'unchanged';
      // Attended and Missed are the rasika's record of what happened: a later version leaves
      // them alone, with no hint (2026-11-07).
      if (event.status !== 'planned') return 'unchanged';
      const version = String(entry.version);
      if (await changedByRasika(event, db)) {
        await save(
          'events',
          { ...event, scheduleChanged: true, scheduleVersionSeen: version },
          { db },
        );
        return 'flagged';
      }
      const names = await readNames(db);
      const updated: Event = {
        ...(await getLive('events', eventId, { db })),
        kind: entry.kind,
        title: titleFor(entry.kind, entry.title),
        date: entry.date,
        startTime: entry.startTime,
        sabhaId: await idFor('sabha', entry.sabha, names, db),
        cancelled: entry.cancelled,
        scheduleVersionSeen: version,
        scheduleChanged: false,
      };
      check(eventProblems(updated));
      await save('events', updated, { db });
      await billStage(updated, entry, names, db);
      await checkLecdem(updated, db);
      return 'updated';
    });
  } catch (error) {
    if (error instanceof RuleError) return 'refused';
    throw error;
  }
}

/** Apply the stored Schedule to every live Event made from it, each in its own transaction. */
export async function applySchedule({ db = defaultDb }: WriteOptions = {}): Promise<
  Record<Applied, number>
> {
  const counts: Record<Applied, number> = { updated: 0, flagged: 0, refused: 0, unchanged: 0 };
  const events = await db.events
    .filter((event) => event.deletedAt === null && event.scheduleEntryId !== null)
    .primaryKeys();
  for (const id of events) counts[await applyEntry(id, db)] += 1;
  return counts;
}

/** Why "take it" is refused: the stored entry is no longer the version the sheet showed. */
export const ENTRY_MOVED = 'this Schedule entry changed again';

/** A billed Artist as the "schedule changed" sheet shows them. */
export interface BilledName {
  name: string;
  role: Role | null;
}

/** One field the newer version names differently, the Event's value beside the entry's. */
export type ScheduleChange =
  | { field: 'date'; from: string; to: string }
  | { field: 'startTime'; from: string | null; to: string }
  | { field: 'sabha'; from: string | null; to: string }
  | { field: 'kind'; from: EventKind; to: EventKind }
  | { field: 'title'; from: string | null; to: string | null }
  | { field: 'billed'; from: BilledName[]; to: BilledName[] };

/** What the "schedule changed" hint opens on: the version and the fields it changes. */
export interface ScheduleChanges {
  version: number;
  changes: ScheduleChange[];
}

/**
 * The title "take it" gives the Event: the entry's printed title when it has one, none for a
 * Concert, and otherwise the Event's own. A version with no title, no time or no billed Artists
 * names none, so the rasika's stays.
 */
function takenTitle(event: Event, entry: ScheduleEntry): string | null {
  if (entry.kind === 'concert') return null;
  return titleFor(entry.kind, entry.title) ?? event.title;
}

const liveStage = async (eventId: string, db: WrappedDB) =>
  (await db.appearances.where('eventId').equals(eventId).toArray())
    .filter((appearance) => appearance.deletedAt === null)
    .sort((a, b) => a.position - b.position);

/**
 * The fields the entry names differently from the Event, in the sheet's order (date, time,
 * Sabha, kind, title, billed Artists): what "take it" would change. A name the Schedule prints
 * is matched as an apply matches it, without making anything.
 */
async function compare(event: Event, entry: ScheduleEntry, names: Names, db: WrappedDB) {
  const [artists, sabhas] = await Promise.all([
    loadEntries('artist', db),
    loadEntries('sabha', db),
  ]);
  const changes: ScheduleChange[] = [];
  if (event.date !== entry.date) changes.push({ field: 'date', from: event.date, to: entry.date });
  if (entry.startTime !== null && event.startTime !== entry.startTime) {
    changes.push({ field: 'startTime', from: event.startTime, to: entry.startTime });
  }
  const sabha = event.sabhaId ? sabhas.resolve(event.sabhaId) : undefined;
  const sabhaId = names.sabhas.match(entry.sabha);
  if (sabhaId === undefined || sabha?.id !== sabhaId) {
    changes.push({ field: 'sabha', from: sabha?.name ?? null, to: entry.sabha });
  }
  if (event.kind !== entry.kind) changes.push({ field: 'kind', from: event.kind, to: entry.kind });
  const title = takenTitle(event, entry);
  if ((event.title ?? null) !== title)
    changes.push({ field: 'title', from: event.title, to: title });
  if (entry.billed.length > 0) {
    const billed = (await liveStage(event.id, db)).filter((appearance) => appearance.billed);
    const same =
      billed.length === entry.billed.length &&
      entry.billed.every((person, i) => {
        const appearance = billed[i]!;
        const artistId = names.artists.match(person.name);
        return (
          artistId !== undefined &&
          (artists.resolve(appearance.artistId)?.id ?? appearance.artistId) === artistId &&
          appearance.role === person.role &&
          (appearance.group ?? null) === person.group
        );
      });
    if (!same) {
      changes.push({
        field: 'billed',
        from: billed.map((appearance) => ({
          name: artists.resolve(appearance.artistId)?.name ?? '?',
          role: appearance.role,
        })),
        to: entry.billed.map(({ name, role }) => ({ name, role })),
      });
    }
  }
  return { changes, resolveArtist: (id: string) => artists.resolve(id)?.id ?? id };
}

/**
 * What the "schedule changed" hint shows: the stored entry's version and the fields it names
 * differently from the Event. Null when there is no hint, or its entry is no longer stored.
 */
export async function scheduleChanges(
  eventId: string,
  db: WrappedDB = defaultDb,
): Promise<ScheduleChanges | null> {
  const event = await db.events.get(eventId);
  if (!event || event.deletedAt !== null || !event.scheduleChanged) return null;
  const entry = event.scheduleEntryId ? await db.schedule.get(event.scheduleEntryId) : undefined;
  if (!entry) return null;
  const { changes } = await compare(event, entry, await readNames(db), db);
  return { version: entry.version, changes };
}

/**
 * Make the Event's billed Artists the entry's, keeping what the rasika added: an Artist billed
 * again keeps their Appearance, Colours and all, taking the entry's Role and group; a new one
 * is a new Appearance; an Artist the entry no longer bills is removed as a tombstone, unless
 * the rasika gave them a Colour, when they stay, no longer billed. The rasika's own Artists stay.
 * Billed Artists come first, in billing order, then the rest in their order.
 */
async function rebill(
  event: Event,
  entry: ScheduleEntry,
  names: Names,
  resolveArtist: (id: string) => string,
  db: WrappedDB,
) {
  const stage = await liveStage(event.id, db);
  const used = new Set<string>();
  const placed: Appearance[] = [];
  for (const [index, person] of entry.billed.entries()) {
    const artistId = await idFor('artist', person.name, names, db);
    const free = stage.filter(
      (appearance) => !used.has(appearance.id) && resolveArtist(appearance.artistId) === artistId,
    );
    const found = free.find((appearance) => appearance.billed) ?? free[0];
    const fields = { role: person.role, group: person.group, billed: true };
    if (found) {
      used.add(found.id);
      placed.push({ ...found, ...fields });
      continue;
    }
    const placeId = billedAppearanceId(event.id, index + 1);
    const earlier = await db.appearances.get(placeId);
    const reuse = !earlier || (earlier.deletedAt !== null && earlier.eventId === event.id);
    placed.push({
      id: reuse ? placeId : newId(),
      eventId: event.id,
      artistId,
      ...fields,
      colourPrimary: null,
      colourSecondary: null,
      position: 0,
      ...newTimestamps(),
      ...(reuse && earlier ? { createdAt: earlier.createdAt } : {}),
    });
  }
  for (const appearance of stage.filter((appearance) => !used.has(appearance.id))) {
    if (appearance.billed && appearance.colourPrimary === null) {
      await remove('appearances', appearance.id, { db });
    } else {
      placed.push({ ...appearance, billed: false });
    }
  }
  const before = new Map(stage.map((appearance) => [appearance.id, appearance]));
  for (const [index, appearance] of placed.entries()) {
    const next = { ...appearance, position: index + 1 };
    const current = before.get(next.id);
    if (
      current &&
      current.position === next.position &&
      current.role === next.role &&
      (current.group ?? null) === next.group &&
      current.billed === next.billed
    ) {
      continue;
    }
    check(appearanceProblems(next));
    const restore = !current && (await db.appearances.get(next.id)) !== undefined;
    await save('appearances', next, { db, restore });
  }
}

/**
 * "Take it" (the Maintainer, 2026-11-07): give an Event the rasika changed the stored entry's
 * version, the same update an untouched Event gets, but only in what the version names: its
 * date, a time it gives, its Sabha, kind, a title it prints, and its billed Artists, with
 * `cancelled`. Notes, status, Items, Colours and the rasika's own Artists stay. One
 * transaction, with each record's outbox entry; the hint clears. A rule the result would break
 * refuses it whole. A change to Concert that takes a typed title away writes the same receipt
 * as a kind change does, for its Undo. `version` is the one the sheet showed: once the stored
 * entry is another, it is refused (ENTRY_MOVED). An Event whose hint is already answered is
 * returned as it is, so a retry changes nothing twice.
 */
export async function takeSchedule(
  eventId: string,
  version: number,
  { db = defaultDb }: WriteOptions = {},
): Promise<{ event: Event; receipt: DeletionReceipt | null }> {
  return db.transaction('rw', [...tablesOf(db), db.meta], async () => {
    const event = await getLive('events', eventId, { db });
    if (!event.scheduleChanged) return { event, receipt: null };
    const entry = event.scheduleEntryId ? await db.schedule.get(event.scheduleEntryId) : undefined;
    if (!entry) throw new RuleError([ENTRY_GONE]);
    if (entry.version !== version) throw new RuleError([ENTRY_MOVED]);
    const names = await readNames(db);
    const { changes, resolveArtist } = await compare(event, entry, names, db);
    const changed = new Set(changes.map((change) => change.field));
    const updated: Event = {
      ...event,
      kind: entry.kind,
      title: takenTitle(event, entry),
      date: entry.date,
      startTime: entry.startTime ?? event.startTime,
      sabhaId: changed.has('sabha') ? await idFor('sabha', entry.sabha, names, db) : event.sabhaId,
      cancelled: entry.cancelled,
      scheduleVersionSeen: String(entry.version),
      scheduleChanged: false,
    };
    check(eventProblems(updated));
    const saved = await save('events', updated, { db });
    if (changed.has('billed')) await rebill(saved, entry, names, resolveArtist, db);
    await checkLecdem(saved, db);
    const taken = entry.kind === 'concert' && event.title?.trim() ? event.title : null;
    const receipt = taken
      ? await writeReceipt(db, {
          kind: 'title',
          eventId,
          position: null,
          records: [{ table: 'events', id: eventId, deletedAt: null }],
          title: { kind: event.kind, title: taken },
        })
      : null;
    return { event: saved, receipt };
  });
}

/**
 * "Keep mine": the Event stays exactly as it is, and the hint clears for this version. Its
 * version was recorded when the hint was set, so only a newer one shows the hint again.
 */
export async function keepMine(eventId: string, { db = defaultDb }: WriteOptions = {}) {
  return db.transaction('rw', [db.events, db.outbox], async () => {
    const event = await getLive('events', eventId, { db });
    if (!event.scheduleChanged) return event;
    return save('events', { ...event, scheduleChanged: false }, { db });
  });
}
