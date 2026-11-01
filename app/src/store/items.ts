// Item actions (T038, T039; data-model.md "Item"). The catalog suggests and the rasika decides
// (constitution III): picking a Composition fills in its Details, and any Detail can then be
// changed, with no confirmation, and is kept exactly as entered (FR-007, FR-008).

import { settleDetail, suggestedDetails, type Suggested } from '../catalog/details';
import type { Catalog, Song } from '../catalog/load';
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
import { getLive, newTimestamps, remove, save, type WriteOptions } from './mutate';
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

type ItemStart = Partial<Pick<Item, 'title' | 'form' | 'ragas' | 'nadai' | 'composer' | 'note'>>;

/** Insert a new Item last in its Event's running order, in one transaction. */
async function insertItem(eventId: string, start: ItemStart, db: WrappedDB): Promise<Item> {
  return db.transaction('rw', [db.events, db.items, db.outbox], async () => {
    await getLive('events', eventId, { db });
    const items = await liveItems(eventId, db);
    const item: Item = {
      id: newId(),
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
  return db.transaction('rw', [db.items, db.outbox], async () => {
    const changed = change(await getLive('items', id, { db }));
    check(itemProblems(changed));
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
  return db.transaction('rw', [db.items, db.outbox], async () => {
    const moving = await getLive('items', id, { db });
    const items = await liveItems(moving.eventId, db);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      throw new RuleError([`no place ${index} in a running order of ${items.length}`]);
    }
    const order = items.filter((item) => item.id !== id);
    order.splice(index, 0, moving);
    const result: Item[] = [];
    for (const [i, item] of order.entries()) {
      const position = i + 1;
      result.push(
        item.position === position ? item : await save('items', { ...item, position }, { db }),
      );
    }
    return result;
  });
}

/** Delete an Item as a tombstone. The others keep their positions, which stay unique. */
export function removeItem(id: string, options: WriteOptions = {}) {
  return remove('items', id, options);
}
