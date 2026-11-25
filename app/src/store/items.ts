// Item actions (T038, T039; data-model.md "Item"). The catalog suggests and the rasika decides
// (constitution III): picking a Composition fills in its Details, and any Detail can then be
// changed, with no confirmation, and is kept exactly as entered (FR-007, FR-008).

import { settleDetail, suggestedDetails, type Suggested } from '../catalog/details';
import type { Catalog, Raga, Song } from '../catalog/load';
import { remapItem } from '../catalog/upgrade';
import forms from '../reference/forms.json';
import {
  catalogValue,
  IMPROVISED_KINDS,
  newId,
  notApplicableValue,
  unknownValue,
  settlePartRagas,
  type DetailValue,
  type Event,
  type Improvised,
  type ImprovisedKind,
  type Item,
  type LayaVinyasam,
  type RasikaRows,
} from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { noteLogging } from './logging-note';
import { getLive, newTimestamps, remove, save, type WriteOptions } from './mutate';
import { peekReceipt, takeReceipt, writeReceipt, type DeletionReceipt } from './receipts';
import { check, EVENT_DELETED, isRtp, itemProblems, RTP_FORM, RuleError } from './rules';

/** The single-valued Details of an Item. Ragas are a list and have their own action. */
export type DetailField = 'form' | 'tala' | 'nadai' | 'composer' | 'language' | 'subject';

async function liveItems(eventId: string, db: WrappedDB): Promise<Item[]> {
  const items = await db.items
    .where('[eventId+position]')
    .between([eventId, -Infinity], [eventId, Infinity])
    .toArray();
  return items.filter((item) => item.deletedAt === null);
}

type ItemStart = Partial<
  Pick<
    Item,
    | 'compositionKey'
    | 'title'
    | 'form'
    | 'ragas'
    | 'tala'
    | 'nadai'
    | 'composer'
    | 'language'
    | 'subject'
    | 'note'
  >
>;

/**
 * An Item made live makes its concert Heard (ADR 0010): a Shortlisted Event, or one that had
 * lapsed to Missed, becomes Attended in the caller's transaction, so an Event is never left
 * Shortlisted or hidden by an Item the rasika entered or brought back. It is then their record:
 * `touched`, with no Schedule hint.
 */
async function markHeard(event: Event, db: WrappedDB): Promise<void> {
  if (event.status === 'attended') return;
  await save(
    'events',
    { ...event, status: 'attended', touched: true, scheduleChanged: false },
    { db },
  );
}

/**
 * Insert a new Item last in its Event's running order, in one transaction with its outbox
 * entry and the logging note. With `id`, a live Item of the same Event that already has it is
 * returned unchanged, so a create replayed after a reopen never adds a second one; an id taken
 * by a tombstone or another Event's Item is refused.
 */
async function insertItem(
  eventId: string,
  start: ItemStart,
  db: WrappedDB,
  id: string = newId(),
): Promise<Item> {
  return db.transaction('rw', [db.events, db.items, db.outbox, db.meta], async () => {
    const existing = await db.items.get(id);
    if (existing) {
      if (existing.deletedAt === null && existing.eventId === eventId) return existing;
      throw new RuleError([`item id ${id} is already used`]);
    }
    await markHeard(await getLive('events', eventId, { db }), db);
    const items = await liveItems(eventId, db);
    const item: Item = {
      id,
      eventId,
      position: (items.at(-1)?.position ?? 0) + 1,
      compositionKey: null,
      title: '',
      form: unknownValue(),
      ragas: [],
      tala: unknownValue(),
      nadai: notApplicableValue(),
      composer: unknownValue(),
      language: unknownValue(),
      subject: unknownValue(),
      layaVinyasam: null,
      improvised: [],
      note: null,
      ...start,
      ...newTimestamps(),
    };
    check(itemProblems(item));
    await noteLogging(db, eventId);
    return save('items', item, { db });
  });
}

/**
 * A new Item at the end of the running order. It has no Composition (FR-010) until one is
 * picked; its Details start as "?", and its Nadai as Not applicable, the usual case.
 */
export function addItem(
  eventId: string,
  start: Pick<ItemStart, 'title' | 'form' | 'note'> = {},
  { db = defaultDb }: WriteOptions = {},
): Promise<Item> {
  return insertItem(eventId, start, db);
}

/**
 * An RTP, at the end of the running order: no Composition, one or more Ragas in order, a tala
 * and Nadai to fill in, and a Composer that is Not applicable unless the rasika knows who wrote
 * the pallavi (FR-041). Its first Raga starts as "?", so it always has one.
 */
export function addRtp(eventId: string, { db = defaultDb }: WriteOptions = {}): Promise<Item> {
  return insertItem(
    eventId,
    {
      title: 'RTP',
      form: catalogValue(RTP_FORM, 'RTP'),
      ragas: [unknownValue()],
      nadai: unknownValue(),
      composer: notApplicableValue(),
    },
    db,
  );
}

/** Read an Item, apply `change`, check the rules, and save it, in one transaction. */
async function changeItem(id: string, change: (item: Item) => Item, db: WrappedDB): Promise<Item> {
  return db.transaction('rw', [db.items, db.outbox, db.meta], async () => {
    const changed = change(await getLive('items', id, { db }));
    check(itemProblems(changed));
    await noteLogging(db, changed.eventId);
    return save('items', changed, { db });
  });
}

function suggestionsFor(item: Item, catalog: Catalog | undefined): Partial<Suggested> {
  const song = item.compositionKey ? catalog?.songByKritiId.get(item.compositionKey) : undefined;
  return song ? suggestedDetails(song) : {};
}

export interface DetailOptions extends WriteOptions {
  /** The catalog in use, to tell an Override from the catalog's own value. */
  catalog?: Catalog;
}

/**
 * Set one Detail to what the rasika chose: a matched value, "?" (Unknown), Not applicable, a
 * Guess, or free text (Unresolved), kept exactly as given (FR-008). A matched value that
 * differs from the Composition's becomes an Override, with no confirmation (FR-007).
 */
export function setDetail(
  id: string,
  field: DetailField,
  value: DetailValue,
  { db = defaultDb, catalog }: DetailOptions = {},
): Promise<Item> {
  return changeItem(
    id,
    (item) => {
      const suggested = field === 'nadai' ? undefined : suggestionsFor(item, catalog)[field];
      return { ...item, [field]: settleDetail(value, suggested, item.compositionKey !== null) };
    },
    db,
  );
}

/**
 * Set the Ragas, in order: one for most Items, several for a ragamalika or an RTP (FR-009).
 * Each is compared with the Composition's Raga in the same place.
 */
export function setRagas(
  id: string,
  ragas: DetailValue[],
  { db = defaultDb, catalog }: DetailOptions = {},
): Promise<Item> {
  return changeItem(
    id,
    (item) => {
      const suggested = suggestionsFor(item, catalog).ragas ?? [];
      const hasComposition = item.compositionKey !== null;
      return {
        ...item,
        ragas: ragas.map((raga, i) => settleDetail(raga, suggested[i], hasComposition)),
      };
    },
    db,
  );
}

/** The Layavinyasam that followed this Item, with its nadais and note (FR-011); null clears it. */
export function setLayaVinyasam(
  id: string,
  layaVinyasam: LayaVinyasam | null,
  { db = defaultDb }: WriteOptions = {},
): Promise<Item> {
  return changeItem(id, (item) => ({ ...item, layaVinyasam }), db);
}

/**
 * The Layavinyasam's nadais alone, in order, adding the Layavinyasam if there is none: a note
 * written meanwhile stays (the note has its own write, setLayaNote). Empty, only the Tala's
 * nadai was heard (ADR 0012).
 */
export function setLayaNadais(
  id: string,
  nadais: DetailValue[],
  { db = defaultDb }: WriteOptions = {},
): Promise<Item> {
  return changeItem(
    id,
    (item) => ({ ...item, layaVinyasam: { note: null, ...item.layaVinyasam, nadais } }),
    db,
  );
}

/**
 * The Layavinyasam's note alone (emptied, it is stored as null), adding the Layavinyasam with no
 * nadai beyond the Tala's if there is none: nadais written meanwhile stay.
 */
export function setLayaNote(
  id: string,
  note: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<Item> {
  return changeItem(
    id,
    (item) => ({
      ...item,
      layaVinyasam: {
        nadais: item.layaVinyasam?.nadais ?? [],
        note: note === '' ? null : note,
      },
    }),
    db,
  );
}

/**
 * The Manodharma parts heard (FR-051), kept in the usual concert order, not the order heard. A
 * part's list cut back to only the Item's Raga is stored as following it (ADR 0012).
 */
export function setImprovised(
  id: string,
  improvised: Improvised[],
  { db = defaultDb }: WriteOptions = {},
): Promise<Item> {
  const order = (heard: Improvised) => IMPROVISED_KINDS.indexOf(heard.kind);
  const sorted = [...improvised]
    .sort((a, b) => order(a) - order(b))
    .map((heard) => ({ ...heard, ragas: settlePartRagas(heard.ragas) }));
  return changeItem(id, (item) => ({ ...item, improvised: sorted }), db);
}

/**
 * One piece of an Item to remove (ADR 0012). It saves at once, with no Undo: Undo is only for
 * whole things (the Maintainer, 2026-11-25). A Raga or nadai names its place and,
 * optionally, the value seen there: a Try again after the list changed then removes that value
 * where it now is, or nothing, never its neighbour.
 */
export type PieceToRemove =
  | { field: 'ragas'; index: number; value?: DetailValue }
  | { field: 'improvised'; kind: ImprovisedKind }
  | { field: 'nadais'; index: number; value?: DetailValue }
  | { field: 'layaVinyasam' };

/** Where a part's slot holding `value` (null: the Item's Raga) is now, or -1. */
function slotOf(list: readonly (DetailValue | null)[], index: number, value: DetailValue | null) {
  const same = (other: DetailValue | null | undefined) =>
    other !== undefined &&
    (other === null || value === null ? other === value : sameValue(other, value));
  if (same(list[index])) return index;
  return list.findIndex(same);
}

/**
 * The same Detail value, field by field: a row pulled from the server (jsonb) may hold its keys
 * in another order, so whole-object text never decides it.
 */
const sameValue = (a: DetailValue, b: DetailValue) =>
  a.state === b.state && a.key === b.key && a.text === b.text && a.guess === b.guess;

/** Where `value` is in `list`: at `index` if it is still there, else its first place, or -1. */
function placeOf(list: readonly DetailValue[], index: number, value?: DetailValue): number {
  if (!value) return index < list.length ? index : -1;
  const same = (other: DetailValue | undefined) => other !== undefined && sameValue(other, value);
  if (same(list[index])) return index;
  return list.findIndex(same);
}

/** Why the Layavinyasam stays on: a note is typed under it, to be cleared first. */
export const LAYA_NOTE_TYPED = 'clear the note to turn off Layavinyasam';

/**
 * Remove one piece of a live Item, a Raga, a Manodharma part with its Ragas, a nadai, or the
 * Layavinyasam with its nadais, in one transaction with its outbox entry and the logging note.
 * The Layavinyasam is refused with LAYA_NOTE_TYPED while it has a note. Returns undefined when
 * there is nothing there to remove.
 */
export async function removePiece(
  id: string,
  piece: PieceToRemove,
  { db = defaultDb }: WriteOptions = {},
): Promise<Item | undefined> {
  return db.transaction('rw', [db.items, db.outbox, db.meta], async () => {
    const item = await getLive('items', id, { db });
    let changed: Item;
    switch (piece.field) {
      case 'ragas': {
        const index = placeOf(item.ragas, piece.index, piece.value);
        const value = item.ragas[index];
        if (!value) return undefined;
        changed = { ...item, ragas: item.ragas.filter((_, i) => i !== index) };
        break;
      }
      case 'improvised': {
        const part = item.improvised.find((heard) => heard.kind === piece.kind);
        if (!part) return undefined;
        changed = { ...item, improvised: item.improvised.filter((heard) => heard !== part) };
        break;
      }
      case 'nadais': {
        const laya = item.layaVinyasam;
        const index = laya ? placeOf(laya.nadais, piece.index, piece.value) : -1;
        const value = laya?.nadais[index];
        if (!laya || !value) return undefined;
        const nadais = laya.nadais.filter((_, i) => i !== index);
        changed = { ...item, layaVinyasam: { ...laya, nadais } };
        break;
      }
      case 'layaVinyasam': {
        if (!item.layaVinyasam) return undefined;
        // A note is never lost to one tap (the rule of 2026-11-05), and with no Undo a Try again
        // must not take one saved since the first try, from another tab, say.
        if (item.layaVinyasam.note) throw new RuleError([LAYA_NOTE_TYPED]);
        changed = { ...item, layaVinyasam: null };
        break;
      }
    }
    check(itemProblems(changed));
    await noteLogging(db, item.eventId);
    return save('items', changed, { db });
  });
}

/**
 * Remove one of a Manodharma part's own Ragas (its place), or all of them (`'all'`, "Use the
 * Item's Raga only"), in one transaction with its outbox entry and the logging note, with no
 * Undo. A list cut back to only the Item's Raga follows it again. Returns undefined when there
 * is nothing there to remove.
 */
export async function removePartRagas(
  id: string,
  kind: ImprovisedKind,
  target: { index: number; value: DetailValue | null } | 'all',
  { db = defaultDb }: WriteOptions = {},
): Promise<Item | undefined> {
  return db.transaction('rw', [db.items, db.outbox, db.meta], async () => {
    const item = await getLive('items', id, { db });
    const part = item.improvised.find((heard) => heard.kind === kind);
    if (!part || part.ragas.length === 0) return undefined;
    // The Raga seen in that place, found where it now is: a Try again after the list changed
    // removes it, or nothing, never its neighbour.
    const slot = target === 'all' ? 'all' : slotOf(part.ragas, target.index, target.value);
    if (slot === -1) return undefined;
    const after = slot === 'all' ? [] : settlePartRagas(part.ragas.filter((_, i) => i !== slot));
    const changed: Item = {
      ...item,
      improvised: item.improvised.map((heard) =>
        heard === part ? { ...heard, ragas: after } : heard,
      ),
    };
    check(itemProblems(changed));
    await noteLogging(db, item.eventId);
    return save('items', changed, { db });
  });
}

/** Change an Item's title or note. */
export function editItem(
  id: string,
  changes: Partial<Pick<Item, 'title' | 'note'>>,
  { db = defaultDb }: WriteOptions = {},
): Promise<Item> {
  return changeItem(id, (item) => ({ ...item, ...changes }), db);
}

/**
 * Move an Item to `index` (0-based) in its Event's running order. The Items whose place changed
 * are renumbered 1..n in one transaction, each with its own outbox entry, so `position` is
 * unique among the Event's live Items when it commits (constitution II).
 */
export async function moveItem(
  id: string,
  index: number,
  { db = defaultDb }: WriteOptions = {},
): Promise<Item[]> {
  return db.transaction('rw', [db.items, db.outbox, db.meta], async () => {
    const moving = await getLive('items', id, { db });
    const items = await liveItems(moving.eventId, db);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      throw new RuleError([`no place ${index} in a running order of ${items.length}`]);
    }
    const order = items.filter((item) => item.id !== id);
    order.splice(index, 0, moving);
    await noteLogging(db, moving.eventId);
    return renumber('items', order, db);
  });
}

/** Move an Item `by` places from where it is now in the running order. */
export async function moveItemBy(
  id: string,
  by: number,
  { db = defaultDb }: WriteOptions = {},
): Promise<Item[]> {
  return db.transaction('rw', [db.items, db.outbox, db.meta], async () => {
    const moving = await getLive('items', id, { db });
    const items = await liveItems(moving.eventId, db);
    return moveItem(id, items.findIndex((item) => item.id === id) + by, { db });
  });
}

/**
 * Number `order` 1..n, saving only the records whose place changed, inside the caller's
 * transaction. Shared by the running order and an Appearance restored to its place in the order
 * added.
 */
export async function renumber<T extends 'items' | 'appearances'>(
  table: T,
  order: RasikaRows[T][],
  db: WrappedDB,
): Promise<RasikaRows[T][]> {
  const result: RasikaRows[T][] = [];
  for (const [i, row] of order.entries()) {
    const position = i + 1;
    result.push(row.position === position ? row : await save(table, { ...row, position }, { db }));
  }
  return result;
}

export interface Deleted<T> {
  tombstone: T;
  /** For Undo: names exactly what this delete removed (eng review D7). */
  receipt: DeletionReceipt;
}

/**
 * Delete an Item as a tombstone, with a receipt for Undo, in one transaction. The others keep
 * their positions, which stay unique. Deleting a deleted or missing Item does nothing.
 */
export async function removeItem(
  id: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<Deleted<Item> | undefined> {
  return db.transaction('rw', [db.items, db.outbox, db.meta], async () => {
    const current = await db.items.get(id);
    if (!current || current.deletedAt !== null) return undefined;
    const tombstone = (await remove('items', id, { db }))!;
    await noteLogging(db, current.eventId);
    const receipt = await writeReceipt(db, {
      kind: 'item',
      eventId: current.eventId,
      position: current.position,
      records: [{ table: 'items', id, deletedAt: tombstone.deletedAt! }],
    });
    return { tombstone, receipt };
  });
}

export interface RestoreOptions extends WriteOptions {
  /** The catalog in use: a restored Item is brought to its version (outside voice 9). */
  catalog?: Catalog | null;
}

/**
 * Undo an Item delete: put the Item back at its old place and renumber the running order, in
 * one transaction, so places stay unique even if Items were added or moved since. A used or
 * stale receipt restores nothing and returns null. One whose Event is itself deleted is refused
 * with EVENT_DELETED, and its receipt kept, for after the Event's own Undo.
 */
export async function restoreItem(
  receiptId: string,
  { db = defaultDb, catalog }: RestoreOptions = {},
): Promise<Item | null> {
  return db.transaction('rw', [db.events, db.items, db.outbox, db.meta], async () => {
    const pending = await peekReceipt(db, receiptId);
    const event = pending && (await db.events.get(pending.eventId));
    if (!event) return null;
    // Said, not passed over: the Undo bar must not read as done (receipt kept for later).
    if (event.deletedAt !== null) throw new RuleError([EVENT_DELETED]);
    const receipt = await takeReceipt(db, receiptId, 'item');
    const record = receipt?.records[0];
    const tombstone = record && (await db.items.get(record.id));
    if (!tombstone) return null;
    const item = catalog ? remapItem(tombstone, catalog.remap) : tombstone;
    // Brought back, it is an Item of this Event again: the concert is Heard (ADR 0010).
    await markHeard(event, db);
    const live = await liveItems(item.eventId, db);
    const index = live.filter((other) => other.position < item.position).length;
    const order = [...live];
    order.splice(index, 0, { ...item, position: index + 1 });
    const restored = await save('items', { ...item, position: index + 1 }, { db, restore: true });
    await noteLogging(db, item.eventId);
    const renumbered = await renumber(
      'items',
      order.map((other) => (other.id === restored.id ? restored : other)),
      db,
    );
    return renumbered.find((other) => other.id === restored.id)!;
  });
}

/** Restore Items deleted with their Event, inside the caller's transaction. */
export async function restoreItemRows(
  rows: Item[],
  db: WrappedDB,
  catalog: Catalog | null | undefined,
): Promise<void> {
  for (const row of rows) {
    await save('items', catalog ? remapItem(row, catalog.remap) : row, { db, restore: true });
  }
}

/** The project-kept forms an Item can start from when it has no Composition. */
export type SpecialForm = 'rtp' | 'viruttam' | 'shlokam' | 'medley';

/** The first pick in the Item editor, which creates the Item (design D12). */
export type ItemPick =
  | { kind: 'song'; song: Song }
  | { kind: 'raga'; raga: Raga }
  | { kind: 'form'; form: SpecialForm }
  | { kind: 'unknown' }
  | { kind: 'typed'; text: string };

/**
 * A pick as plain data, for a value not saved (contracts/season-export.md, `notSaved`): enough
 * to place it back by hand, without the catalog's whole song.
 */
export function describePick(pick: ItemPick): Record<string, string> {
  switch (pick.kind) {
    case 'song':
      return { kind: 'song', kritiId: pick.song.kritiId, title: pick.song.title };
    case 'raga':
      return { kind: 'raga', key: pick.raga.key, display: pick.raga.display };
    case 'form':
      return { kind: 'form', form: pick.form };
    case 'unknown':
      return { kind: 'unknown' };
    case 'typed':
      return { kind: 'typed', text: pick.text };
  }
}

const formDisplay = (key: SpecialForm) => forms.find((form) => form.key === key)?.display ?? key;

/** The Item a pick starts, before it has a place. */
function startFrom(pick: ItemPick): ItemStart {
  switch (pick.kind) {
    case 'song':
      return {
        ...suggestedDetails(pick.song),
        compositionKey: pick.song.kritiId,
        title: pick.song.title,
      };
    case 'raga':
      // An alapana before the song is known: only its Raga, the Composition picked later.
      return { title: '', ragas: [catalogValue(pick.raga.key, pick.raga.display)] };
    case 'form': {
      const display = formDisplay(pick.form);
      if (pick.form === RTP_FORM) {
        return {
          title: display,
          form: catalogValue(RTP_FORM, display),
          ragas: [unknownValue()],
          nadai: unknownValue(),
          composer: notApplicableValue(),
        };
      }
      // A viruttam or slokam is sung without a tala.
      const free = pick.form === 'viruttam' || pick.form === 'shlokam';
      return {
        title: display,
        form: catalogValue(pick.form, display),
        ...(free ? { tala: notApplicableValue() } : {}),
      };
    }
    case 'unknown':
      return { title: '?' };
    case 'typed': {
      const text = pick.text.trim();
      if (text === '') throw new RuleError(['nothing typed']);
      return { title: text };
    }
  }
}

/** Whether `value` is what the catalog suggested: the same key, as the song filled it in. */
const sameAsSuggested = (value: DetailValue, suggested: DetailValue | undefined) =>
  suggested !== undefined &&
  value.state === suggested.state &&
  value.key === suggested.key &&
  !value.guess;

/**
 * The Item without its Composition: the Details the old song filled in go back to "?", and
 * whatever the rasika changed from them is kept (an Override, kept as their own value). Without
 * the catalog, a value in the `catalog` state is taken as the song's.
 */
function leaveComposition(item: Item, catalog: Catalog | undefined): Item {
  if (item.compositionKey === null) return item;
  const song = catalog?.songByKritiId.get(item.compositionKey);
  const suggested: Partial<Suggested> = song ? suggestedDetails(song) : {};
  const fromSong = (value: DetailValue, from: DetailValue | undefined) =>
    song ? sameAsSuggested(value, from) : value.state === 'catalog';
  const settle = (value: DetailValue, from: DetailValue | undefined): DetailValue =>
    fromSong(value, from)
      ? unknownValue()
      : value.state === 'override'
        ? { ...value, state: 'catalog' }
        : value;
  return {
    ...item,
    compositionKey: null,
    form: settle(item.form, suggested.form),
    ragas: item.ragas
      .map((raga, i) => settle(raga, suggested.ragas?.[i]))
      .filter((raga) => raga.state !== 'unknown'),
    tala: settle(item.tala, suggested.tala),
    composer: settle(item.composer, suggested.composer),
    language: settle(item.language, suggested.language),
    subject: settle(item.subject, suggested.subject),
  };
}

/**
 * Change an Item's pick from the editor's title, in one transaction with the logging note.
 * A song fills in its title and every Detail the catalog knows, as `catalog` values (FR-007);
 * an RTP has no Composition, so picking a song makes it an ordinary Item. A Raga, a special
 * form, typed text or "?" leaves the Composition (its Details go back to "?") and starts from
 * the pick as a new Item would. The Nadai, the Layavinyasam, the Manodharma parts and note are the
 * rasika's and stay; an RTP gets "?" for its first Raga and Nadai where it has none. A failed
 * repick is never retried (docs/adr/0007): the rasika picks again.
 */
export function repickItem(
  id: string,
  pick: ItemPick,
  { db = defaultDb, catalog }: DetailOptions = {},
): Promise<Item> {
  const start = startFrom(pick);
  return changeItem(id, (item) => applyPick(item, pick, start, catalog), db);
}

/** The Item after `pick`, as `repickItem` describes. */
function applyPick(item: Item, pick: ItemPick, start: ItemStart, catalog?: Catalog): Item {
  if (pick.kind === 'song') {
    return { ...item, ...start, nadai: isRtp(item) ? notApplicableValue() : item.nadai };
  }
  const left = leaveComposition(item, catalog);
  const next: Item = { ...left, ...start };
  if (pick.kind !== 'form') return next;
  if (pick.form === RTP_FORM) {
    return {
      ...next,
      ragas: left.ragas.length > 0 ? left.ragas : [unknownValue()],
      nadai: left.nadai.state === 'na' ? unknownValue() : left.nadai,
      composer: left.composer.state === 'unknown' ? notApplicableValue() : left.composer,
    };
  }
  // Another form: an RTP's own Nadai default goes with it.
  return isRtp(item) && next.nadai.state === 'unknown'
    ? { ...next, nadai: notApplicableValue() }
    : next;
}

/**
 * Create an Item from its first pick, filled in, in one transaction (eng review D3): a song,
 * a Raga, a special form, "? Don't know" or the text typed. `id` is the editor's draft id: the
 * draft is consumed in the same transaction, and an Item that already has the id is returned
 * as it is, so a pick replayed after a reopen never duplicates.
 */
export async function addItemFrom(
  eventId: string,
  pick: ItemPick,
  { db = defaultDb, id = newId() }: WriteOptions & { id?: string } = {},
): Promise<Item> {
  const start = startFrom(pick);
  return db.transaction('rw', [db.events, db.items, db.outbox, db.meta], async () => {
    const item = await insertItem(eventId, start, db, id);
    const draft = (await db.meta.get(draftKey(eventId)))?.value as ItemDraft | undefined;
    if (draft?.id === id) await db.meta.delete(draftKey(eventId));
    return item;
  });
}

/** What the rasika typed in a new Item's search before picking (design D12). */
export interface ItemDraft {
  /** The id the Item takes when it is created. */
  id: string;
  eventId: string;
  text: string;
  at: string;
}

export const draftKey = (eventId: string) => `itemDraft:${eventId}`;

/**
 * Keep the typed text, so it survives the phone locking or the app being closed. A draft whose
 * id an Item already has was consumed by its pick and is never written back (a page-hide that
 * fires after the pick committed).
 */
export async function saveItemDraft(
  draft: Omit<ItemDraft, 'at'>,
  { db = defaultDb }: WriteOptions = {},
): Promise<void> {
  await db.transaction('rw', [db.items, db.meta], async () => {
    if (await db.items.get(draft.id)) return;
    await db.meta.put({
      key: draftKey(draft.eventId),
      value: { ...draft, at: new Date().toISOString() },
    });
  });
}

/** The stored draft; one whose id an Item already has is discarded, never reused. */
export async function readItemDraft(
  eventId: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<ItemDraft | null> {
  return db.transaction('rw', [db.items, db.meta], async () => {
    const draft = (await db.meta.get(draftKey(eventId)))?.value as ItemDraft | undefined;
    if (!draft) return null;
    if (await db.items.get(draft.id)) {
      await db.meta.delete(draftKey(eventId));
      return null;
    }
    return draft;
  });
}

/** Backing out of a new Item discards what was typed. */
export async function discardItemDraft(
  eventId: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<void> {
  await db.meta.delete(draftKey(eventId));
}
