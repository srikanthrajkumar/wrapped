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
  type DetailValue,
  type Improvised,
  type Item,
  type LayaVinyasam,
} from '../model';
import { db as defaultDb, type WrappedDB } from './db';
import { noteLogging } from './logging-note';
import { getLive, newTimestamps, remove, save, type WriteOptions } from './mutate';
import { takeReceipt, writeReceipt, type DeletionReceipt } from './receipts';
import { check, isRtp, itemProblems, RTP_FORM, RuleError } from './rules';

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
 * Insert a new Item last in its Event's running order, in one transaction with its outbox
 * entry and the logging note. With `id`, an Item that already has it is returned unchanged, so
 * a create replayed after a reopen never adds a second one.
 */
async function insertItem(
  eventId: string,
  start: ItemStart,
  db: WrappedDB,
  id: string = newId(),
): Promise<Item> {
  return db.transaction('rw', [db.events, db.items, db.outbox, db.meta], async () => {
    const existing = await db.items.get(id);
    if (existing) return existing;
    await getLive('events', eventId, { db });
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

/**
 * Pick a Composition: its title and Details are filled in from the catalog as `catalog` values
 * (FR-007). Picking replaces every Detail the catalog knows; the Nadai, Laya vinyasam,
 * improvised Details and note stay as they were. An RTP has no Composition, so picking one
 * makes the Item an ordinary one.
 */
export function pickComposition(
  id: string,
  song: Song,
  { db = defaultDb }: WriteOptions = {},
): Promise<Item> {
  return changeItem(
    id,
    (item) => ({
      ...item,
      ...suggestedDetails(song),
      compositionKey: song.kritiId,
      title: song.title,
      nadai: isRtp(item) ? notApplicableValue() : item.nadai,
    }),
    db,
  );
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

/** The Laya vinyasam that followed this Item, with its Nadai and note (FR-011); null clears it. */
export function setLayaVinyasam(
  id: string,
  layaVinyasam: LayaVinyasam | null,
  { db = defaultDb }: WriteOptions = {},
): Promise<Item> {
  return changeItem(id, (item) => ({ ...item, layaVinyasam }), db);
}

/** The improvised Details heard (FR-051), kept in the usual concert order, not the order heard. */
export function setImprovised(
  id: string,
  improvised: Improvised[],
  { db = defaultDb }: WriteOptions = {},
): Promise<Item> {
  const order = (heard: Improvised) => IMPROVISED_KINDS.indexOf(heard.kind);
  const sorted = [...improvised].sort((a, b) => order(a) - order(b));
  return changeItem(id, (item) => ({ ...item, improvised: sorted }), db);
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
    return renumber(order, db);
  });
}

/** Number `order` 1..n, saving only the Items whose place changed, inside the caller's transaction. */
async function renumber(order: Item[], db: WrappedDB): Promise<Item[]> {
  const result: Item[] = [];
  for (const [i, item] of order.entries()) {
    const position = i + 1;
    result.push(
      item.position === position ? item : await save('items', { ...item, position }, { db }),
    );
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
 * stale receipt restores nothing and returns null; so does one whose Event is itself deleted
 * (that receipt is kept, for after the Event's own Undo).
 */
export async function restoreItem(
  receiptId: string,
  { db = defaultDb, catalog }: RestoreOptions = {},
): Promise<Item | null> {
  return db.transaction('rw', [db.events, db.items, db.outbox, db.meta], async () => {
    const pending = (await db.meta.get(`receipt:${receiptId}`))?.value as
      DeletionReceipt | undefined;
    const event = pending && (await db.events.get(pending.eventId));
    if (!event || event.deletedAt !== null) return null;
    const receipt = await takeReceipt(db, receiptId, 'item');
    const record = receipt?.records[0];
    const tombstone = record && (await db.items.get(record.id));
    if (!tombstone) return null;
    const item = catalog ? remapItem(tombstone, catalog.remap) : tombstone;
    const live = await liveItems(item.eventId, db);
    const index = live.filter((other) => other.position < item.position).length;
    const order = [...live];
    order.splice(index, 0, { ...item, position: index + 1 });
    const restored = await save('items', { ...item, position: index + 1 }, { db, restore: true });
    await noteLogging(db, item.eventId);
    const renumbered = await renumber(
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
      return { ragas: [catalogValue(pick.raga.key, pick.raga.display)] };
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

const draftKey = (eventId: string) => `itemDraft:${eventId}`;

/** Keep the typed text, so it survives the phone locking or the app being closed. */
export async function saveItemDraft(
  draft: Omit<ItemDraft, 'at'>,
  { db = defaultDb }: WriteOptions = {},
): Promise<void> {
  await db.meta.put({
    key: draftKey(draft.eventId),
    value: { ...draft, at: new Date().toISOString() },
  });
}

export async function readItemDraft(
  eventId: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<ItemDraft | null> {
  return ((await db.meta.get(draftKey(eventId)))?.value as ItemDraft | undefined) ?? null;
}

/** Backing out of a new Item discards what was typed. */
export async function discardItemDraft(
  eventId: string,
  { db = defaultDb }: WriteOptions = {},
): Promise<void> {
  await db.meta.delete(draftKey(eventId));
}
