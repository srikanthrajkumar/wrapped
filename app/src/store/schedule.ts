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
const SCHEDULE_FORMAT = 1;

/** The `meta` row that says which file the stored entries came from. */
const SCHEDULE_META = 'schedule';

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
   * What the fetch knows this file by (store/schedule-fetch.ts: the server's `ETag`, which is the
   * file's sha256), so it can ask for a changed one only; null when it gave none. Opaque to
   * everything else.
   */
  tag: string | null;
}

/** Why an entry can't be added. */
const ENTRY_GONE = 'this Schedule entry is no longer on the phone';
export const ENTRY_CANCELLED = 'this Schedule entry is cancelled';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SEASON = /^\d{4}-\d{2}$/;
/**
 * An instant with its offset, as `2026-11-20T10:00:00Z` or `2026-11-20T15:30:00+05:30`: a time
 * of day that exists (no 24:00 or :60) and an offset of hours and minutes. Its date is checked
 * apart (`realDate`), since `2026-11-31` would otherwise be read as 1 December.
 */
const INSTANT =
  /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** A calendar date that exists: `2026-02-30` and `2026-13-01` are not. Never throws. */
function realDate(date: unknown): date is string {
  if (typeof date !== 'string' || !ISO_DATE.test(date)) return false;
  const day = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(date);
}

/** The instant a `publishedAt` names, in ms; NaN for one that names none, or no real day. */
function publishedInstant(publishedAt: string): number {
  const match = INSTANT.exec(publishedAt);
  return match && realDate(match[1]) ? Date.parse(publishedAt) : Number.NaN;
}

/** Why a file is refused whole; read by the tests and the fetch, never shown. */
const MALFORMED = Symbol('malformed');

function readBilled(value: unknown): BilledArtist | typeof MALFORMED {
  if (!isObject(value)) return MALFORMED;
  const name = text(value.name);
  if (name === null) return MALFORMED;
  if (value.group != null && typeof value.group !== 'string') return MALFORMED;
  if (value.role != null && typeof value.role !== 'string') return MALFORMED;
  // `support` is optional (2026-11-10): absent or null reads as false, anything but a boolean
  // refuses the file, as a Role of the wrong type does.
  if (value.support != null && typeof value.support !== 'boolean') return MALFORMED;
  // A Role is a hint: one this reader doesn't know reads as none.
  const role = ROLES.includes(value.role as Role) ? (value.role as Role) : null;
  return { name, role, group: text(value.group), support: value.support === true };
}

/** An entry as read; null for one of a kind this reader doesn't know (skipped). */
function readEntry(value: unknown): ScheduleEntry | null | typeof MALFORMED {
  if (!isObject(value)) return MALFORMED;
  const id = typeof value.id === 'string' && value.id !== '' ? value.id : null;
  const sabha = text(value.sabha);
  const { version, date, startTime, title, cancelled } = value;
  if (id === null || sabha === null) return MALFORMED;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return MALFORMED;
  if (!realDate(date)) return MALFORMED;
  if (startTime != null && (typeof startTime !== 'string' || !TIME.test(startTime))) {
    return MALFORMED;
  }
  // Only `startTime`, `title`, a billed `role`, `group` and `support` may be null (contracts/schedule-feed.md):
  // a `cancelled` of null would read as false and reinstate a cancelled Event (Codex, PR #25).
  if (title != null && typeof title !== 'string') return MALFORMED;
  if (typeof cancelled !== 'boolean') return MALFORMED;
  if (typeof value.kind !== 'string') return MALFORMED;
  if (!Array.isArray(value.billed)) return MALFORMED;
  const billed = value.billed.map(readBilled);
  if (billed.includes(MALFORMED)) return MALFORMED;
  // An entry of a kind this reader doesn't know is skipped (contracts/schedule-feed.md).
  if (!EVENT_KINDS.includes(value.kind as EventKind)) return null;
  const kind = value.kind as EventKind;
  return {
    id,
    version,
    date,
    startTime: (startTime as string | null | undefined) ?? null,
    sabha,
    kind,
    title: kind === 'concert' ? null : text(title),
    billed: billed as BilledArtist[],
    cancelled,
  };
}

/**
 * Read a feed file. Null for a file this reader can't use, so the last stored copy and its tag
 * stay: not format 1, not the feed's shape, a Season or `publishedAt` it can't read (an instant
 * with its offset), or any entry it can't read (a version, date, time or billing of the wrong
 * shape). Refused whole, never in part, so a damaged file can't stand in for the Schedule.
 * Fields it doesn't know are ignored, an entry of a kind it doesn't know is left out, and a
 * repeated id keeps its first entry. Nothing is ever read from an entry's `id`.
 */
export function readScheduleFile(json: unknown): ScheduleFile | null {
  if (!isObject(json) || json.format !== SCHEDULE_FORMAT) return null;
  const season = text(json.season);
  const publishedAt = text(json.publishedAt);
  if (season === null || !SEASON.test(season)) return null;
  if (publishedAt === null || Number.isNaN(publishedInstant(publishedAt))) return null;
  if (!Array.isArray(json.entries)) return null;
  const entries = new Map<string, ScheduleEntry>();
  for (const value of json.entries) {
    const entry = readEntry(value);
    if (entry === MALFORMED) return null;
    if (entry && !entries.has(entry.id)) entries.set(entry.id, entry);
  }
  return { season, publishedAt, entries: [...entries.values()] };
}

/**
 * Keep a feed file's entries in place of the last ones, in one transaction. A file for an
 * earlier Season than the one stored, or published before it in the same Season (compared as
 * instants, so `+05:30` and `Z` order right), is a stale copy and changes nothing (returns
 * false): no entry, version or tag moves. The entries are the logger's, not the rasika's:
 * replacing them loses nothing logged.
 */
export async function storeSchedule(
  file: ScheduleFile,
  tag: string | null,
  { db = defaultDb }: WriteOptions = {},
): Promise<boolean> {
  return db.transaction('rw', [db.schedule, db.meta], async () => {
    const stored = (await db.meta.get(SCHEDULE_META))?.value as ScheduleMeta | undefined;
    if (Number.isNaN(publishedInstant(file.publishedAt))) return false;
    if (stored) {
      if (file.season < stored.season) return false;
      if (
        file.season === stored.season &&
        publishedInstant(file.publishedAt) < publishedInstant(stored.publishedAt)
      ) {
        return false;
      }
    }
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
 * The id of the Appearance the Schedule makes for an Artist on an Event: a name-based UUID
 * (version 3) of the Event and the Artist, the same on every phone and whatever place the Artist
 * is billed at. Two phones applying or taking the same version before they sync (one of them not
 * the writer, FR-022) then write the same record, which the server sees as a conflict on
 * identical rows, rather than billing the Artist twice.
 */
export function scheduleAppearanceId(eventId: string, artistId: string): string {
  const hex = md5(new TextEncoder().encode(`carnatic-wrapped/billed/${eventId}/${artistId}`));
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-3${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Whether the Schedule made this Appearance: its id is the one the Schedule derives for its Event
 * and Artist. Any other is the rasika's (added by hand), and the Schedule never bills, changes or
 * removes it. Nothing else makes such an id, and an Appearance's Artist is never changed on the
 * phone, so the id says where the row came from without a field of its own.
 */
export function fromSchedule(appearance: Pick<Appearance, 'id' | 'eventId' | 'artistId'>) {
  return appearance.id === scheduleAppearanceId(appearance.eventId, appearance.artistId);
}

/** Why a billing can't be written: the Artist's Schedule id is held by a row of another Artist. */
export const ID_TAKEN = "this Artist's Schedule record is used by another Artist";

/**
 * Make the Event's billed Stage the entry's, Artist by Artist (an apply on an Event the rasika
 * never changed, and "take it"):
 * - an Artist the rasika added by hand stands for their billing as it is: never billed, its Role
 *   and group never changed, never removed, and never doubled by a Schedule row;
 * - an Artist the Schedule billed before keeps their Appearance, taking the entry's group and
 *   support mark (set or cleared), and its Role unless the entry gives none (a null Role names
 *   nothing);
 * - a new one gets the Artist's Schedule id; when the Event holds a Schedule tombstone of this
 *   Artist, or of one now resolved to them (promoted or merged), it is that row brought back,
 *   Colours and Role and all;
 * - a Schedule Artist the entry no longer bills is removed as a tombstone, unless the rasika gave
 *   them a Colour, when they stay, no longer billed.
 * The Schedule's rows take their places in billing order, among the places they held, new ones
 * after the rest; the rasika's rows keep theirs. Only rows that change are written.
 */
async function syncStage(event: Event, entry: ScheduleEntry, names: Names, db: WrappedDB) {
  const { resolve } = await loadEntries('artist', db);
  const artistOf = (appearance: Appearance) =>
    resolve(appearance.artistId)?.id ?? appearance.artistId;
  const live = await liveStage(event.id, db);
  const scheduleRows = live.filter(fromSchedule);
  const own = live.filter((appearance) => !fromSchedule(appearance));
  // The Schedule's tombstones on this Event: each keeps the Artist it was made for, who may
  // since have been promoted to a shared Artist or merged into another (Codex, PR #25).
  const tombstones = (await db.appearances.where('eventId').equals(event.id).toArray()).filter(
    (appearance) => appearance.deletedAt !== null && fromSchedule(appearance),
  );
  const used = new Set<string>();
  const billedArtists = new Set<string>();
  const billed: { row: Appearance; existing: boolean }[] = [];
  for (const person of entry.billed) {
    const artistId = await idFor('artist', person.name, names, db);
    if (billedArtists.has(artistId)) continue;
    billedArtists.add(artistId);
    if (own.some((appearance) => artistOf(appearance) === artistId)) continue;
    const current = scheduleRows.find(
      (appearance) => !used.has(appearance.id) && artistOf(appearance) === artistId,
    );
    if (current) {
      used.add(current.id);
      billed.push({
        row: {
          ...current,
          role: person.role ?? current.role,
          group: person.group,
          support: person.support === true,
          billed: true,
        },
        existing: true,
      });
      continue;
    }
    // A tombstone of any Artist who is now this one (by Link or merge) comes back as itself,
    // Colours and Role kept. Its Artist stays the one it was made for, which reads as this one:
    // an Appearance's Artist never changes on the phone.
    const resolvedTo = tombstones.find(
      (appearance) => !used.has(appearance.id) && artistOf(appearance) === artistId,
    );
    const id = resolvedTo?.id ?? scheduleAppearanceId(event.id, artistId);
    if (resolvedTo) used.add(resolvedTo.id);
    const earlier = resolvedTo ?? (await db.appearances.get(id));
    // A record never takes another Artist's id: refused whole, nothing written.
    if (earlier && !resolvedTo && (earlier.deletedAt === null || earlier.artistId !== artistId)) {
      throw new RuleError([ID_TAKEN]);
    }
    const row: Appearance = earlier
      ? {
          ...earlier,
          role: person.role ?? earlier.role,
          group: person.group,
          support: person.support === true,
          billed: true,
        }
      : {
          id,
          eventId: event.id,
          artistId,
          role: person.role,
          colourPrimary: null,
          colourSecondary: null,
          billed: true,
          group: person.group,
          support: person.support === true,
          position: 0,
          ...newTimestamps(),
        };
    billed.push({ row, existing: false });
  }
  // Places: those the Schedule's rows held, in order, then new ones after every row on Stage.
  let last = Math.max(0, ...live.map((appearance) => appearance.position));
  const places = [
    ...billed.filter((b) => b.existing).map((b) => b.row.position),
    ...billed.filter((b) => !b.existing).map(() => (last += 1)),
  ].sort((x, y) => x - y);
  const writes: Appearance[] = billed.map((b, i) => ({ ...b.row, position: places[i]! }));
  for (const dropped of scheduleRows.filter((appearance) => !used.has(appearance.id))) {
    if (dropped.colourPrimary === null) {
      await remove('appearances', dropped.id, { db });
    } else if (dropped.billed) {
      writes.push({ ...dropped, billed: false });
    }
  }
  const before = new Map(live.map((appearance) => [appearance.id, appearance]));
  for (const next of writes) {
    const current = before.get(next.id);
    if (
      current &&
      current.position === next.position &&
      current.role === next.role &&
      (current.group ?? null) === next.group &&
      (current.support ?? false) === (next.support ?? false) &&
      current.billed === next.billed
    ) {
      continue;
    }
    check(appearanceProblems(next));
    // A tombstone of the Artist's own id comes back (its Colours with it).
    await save('appearances', next, { db, restore: !current });
  }
}

const liveStage = async (eventId: string, db: WrappedDB) =>
  (await db.appearances.where('eventId').equals(eventId).toArray())
    .filter((appearance) => appearance.deletedAt === null)
    .sort((a, b) => a.position - b.position);

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
    await syncStage(event, entry, names, db);
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
        (!fromSchedule(appearance) ||
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
async function applyEntry(eventId: string, db: WrappedDB = defaultDb): Promise<Applied> {
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
      const names = await readNames(db);
      if (await changedByRasika(event, db)) {
        // The hint only for a version that differs in what the sheet shows: never an empty sheet.
        const differs = (await compare(event, entry, names, db)).length > 0;
        await save(
          'events',
          { ...event, scheduleChanged: differs, scheduleVersionSeen: version },
          { db },
        );
        return differs ? 'flagged' : 'unchanged';
      }
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
      await syncStage(updated, entry, names, db);
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
/** Why "take it" is refused: the Event is no longer Planned. */
export const TAKE_PLANNED_ONLY = 'only a Planned Event takes the Schedule';

/** A billed Artist as the "schedule changed" sheet shows them. */
export interface BilledName {
  name: string;
  role: Role | null;
  /** Billed as support (2026-11-10). */
  support: boolean;
}

/** One field the newer version names differently, the Event's value beside the entry's. */
export type ScheduleChange =
  | { field: 'date'; from: string; to: string }
  | { field: 'startTime'; from: string | null; to: string }
  | { field: 'sabha'; from: string | null; to: string }
  | { field: 'kind'; from: EventKind; to: EventKind }
  | { field: 'title'; from: string | null; to: string | null }
  | { field: 'cancelled'; from: boolean; to: boolean }
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

/**
 * The fields the entry names differently from the Event, in the sheet's order (date, time,
 * Sabha, kind, title, cancelled, billed Artists): what "take it" would change, and what the hint
 * is set for. A name the Schedule prints is matched as an apply matches it, without making
 * anything. Billed Artists differ when one billed has no Appearance, a Schedule-made one has
 * another Role (when the entry gives one), group or support mark, or is in another order, or one
 * the entry no longer bills is still billed; an Artist the rasika added stands for their billing
 * as it is.
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
  if ((event.title ?? null) !== title) {
    changes.push({ field: 'title', from: event.title, to: title });
  }
  if (event.cancelled !== entry.cancelled) {
    changes.push({ field: 'cancelled', from: event.cancelled, to: entry.cancelled });
  }
  if (entry.billed.length > 0) {
    const artistOf = (appearance: Appearance) =>
      artists.resolve(appearance.artistId)?.id ?? appearance.artistId;
    const live = await liveStage(event.id, db);
    const standing = new Set<Appearance>();
    let same = true;
    let place = 0;
    for (const person of entry.billed) {
      const artistId = names.artists.match(person.name);
      const row = artistId === undefined ? undefined : live.find((a) => artistOf(a) === artistId);
      if (!row) {
        same = false;
        continue;
      }
      if (standing.has(row)) continue;
      standing.add(row);
      if (!fromSchedule(row)) continue;
      if (
        !row.billed ||
        (person.role !== null && row.role !== person.role) ||
        (row.group ?? null) !== person.group ||
        (row.support ?? false) !== (person.support ?? false) ||
        row.position < place
      ) {
        same = false;
      }
      place = row.position;
    }
    if (live.some((a) => fromSchedule(a) && a.billed && !standing.has(a))) same = false;
    if (!same) {
      changes.push({
        field: 'billed',
        from: live
          .filter((a) => (fromSchedule(a) && a.billed) || standing.has(a))
          .map((a) => ({
            name: artists.resolve(a.artistId)?.name ?? '?',
            role: a.role,
            support: a.support ?? false,
          })),
        to: entry.billed.map(({ name, role, support }) => ({
          name,
          role,
          support: support === true,
        })),
      });
    }
  }
  return changes;
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
  const changes = await compare(event, entry, await readNames(db), db);
  return { version: entry.version, changes };
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
    // Attended and Missed are the rasika's record of what happened (2026-11-07).
    if (event.status !== 'planned') throw new RuleError([TAKE_PLANNED_ONLY]);
    if (!event.scheduleChanged) return { event, receipt: null };
    const entry = event.scheduleEntryId ? await db.schedule.get(event.scheduleEntryId) : undefined;
    if (!entry) throw new RuleError([ENTRY_GONE]);
    if (entry.version !== version) throw new RuleError([ENTRY_MOVED]);
    const names = await readNames(db);
    const changed = new Set((await compare(event, entry, names, db)).map((c) => c.field));
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
    if (changed.has('billed')) await syncStage(saved, entry, names, db);
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
