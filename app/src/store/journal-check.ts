// Whether the phone store holds a journal entry's value (docs/adr/0007): the projection, per
// field, from the stored record to the value as the rasika entered it. A journal entry leaves
// only when this says yes, so each projection follows how the store keeps that field: a note
// emptied is stored as null, a Sabha is kept with its name, Colours are two columns, a catalog
// value can be stored as an Override of the song's, and a new Item is held only with its own
// pick. Screens use the same projections (storedHolds) to tell when what they read back is the
// value entered.

import type { DetailValue, OwnEntry } from '../model';
import type { JournalEntry } from '../screens/save-feedback';
import { db as defaultDb, type WrappedDB } from './db';
import { draftKey } from './items';
import { MAX_MERGE_HOPS } from './queries';

type Row = Record<string, unknown> & { deletedAt?: string | null };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** A Detail as the rasika chose it: an Override is the catalog value they picked. */
function chosen(value: DetailValue | null | undefined) {
  if (!value) return null;
  const state = value.state === 'override' ? 'catalog' : value.state;
  return { state, key: value.key, text: value.text, guess: value.guess };
}

const sameDetail = (a: unknown, b: unknown) =>
  same(chosen(a as DetailValue), chosen(b as DetailValue));

const sameDetails = (a: unknown, b: unknown) => {
  const left = (a ?? []) as DetailValue[];
  const right = (b ?? []) as DetailValue[];
  return left.length === right.length && left.every((value, i) => sameDetail(value, right[i]));
};

const DETAILS = new Set(['form', 'tala', 'nadai', 'composer', 'language', 'subject']);

/** Whether a stored Item has the pick an entry records (items/pick, items/'*'). */
function holdsPick(item: Row, pick: Record<string, string> | undefined): boolean {
  if (!pick) return false;
  const ragas = (item.ragas ?? []) as DetailValue[];
  switch (pick.kind) {
    case 'song':
      return item.compositionKey === pick.kritiId;
    case 'raga':
      return item.compositionKey === null && ragas[0]?.key === pick.key;
    case 'form':
      return (
        item.compositionKey === null && (item.form as DetailValue | undefined)?.key === pick.form
      );
    case 'unknown':
      return item.compositionKey === null && item.title === '?';
    case 'typed':
      return item.compositionKey === null && item.title === pick.text?.trim();
    default:
      return false;
  }
}

type Entered = Pick<JournalEntry, 'table' | 'id' | 'field' | 'value'>;

/** Whether a stored, live record holds the value entered for one of its fields. */
function fieldHolds(table: string, field: string, value: unknown, row: Row): boolean {
  if (table === 'events') {
    if (field === 'note') return (row.note ?? '') === (value ?? '');
    if (field === 'sabhaId') return row.sabhaId === (value as { id?: string } | null)?.id;
    // A title is stored trimmed, and an emptied one as null (store/events.ts).
    const titleHolds = (title: unknown) =>
      (row.title ?? '') === (typeof title === 'string' ? title.trim() : '');
    if (field === 'title') return titleHolds(value);
    // A kind is entered with the title it is saved with, and held only with both.
    if (field === 'kind') {
      const entered = value as { kind?: unknown; title?: unknown } | null;
      return row.kind === entered?.kind && titleHolds(entered?.title);
    }
  }
  if (table === 'appearances' && field === 'colours') {
    const colours = value as { colourPrimary?: unknown; colourSecondary?: unknown };
    return (
      row.colourPrimary === colours.colourPrimary && row.colourSecondary === colours.colourSecondary
    );
  }
  if (table === 'items') {
    if (field === 'pick') return holdsPick(row, (value as { pick?: Record<string, string> }).pick);
    if (DETAILS.has(field)) return sameDetail(row[field], value);
    if (field === 'ragas') return sameDetails(row.ragas, value);
    const laya = row.layaVinyasam as { nadai: DetailValue; note: string | null } | null;
    // The Laya vinyasam's own entry is whether there is one, and its Nadai; the note is apart.
    if (field === 'layaVinyasam') {
      const entered = value as { nadai: DetailValue } | null;
      if (!laya || !entered) return !laya && !entered;
      return sameDetail(laya.nadai, entered.nadai);
    }
    if (field === 'layaNote') return (laya?.note ?? '') === ((value as string | null) ?? '');
    if (field === 'improvised') {
      const kinds = (list: unknown) =>
        ((list ?? []) as { kind: string; raga: DetailValue | null }[]).map((heard) => ({
          kind: heard.kind,
          raga: chosen(heard.raga),
        }));
      const sorted = (list: ReturnType<typeof kinds>) =>
        [...list].sort((a, b) => a.kind.localeCompare(b.kind));
      return same(sorted(kinds(row.improvised)), sorted(kinds(value)));
    }
  }
  return same(row[field], value);
}

export async function holdsValue(entry: Entered, db: WrappedDB = defaultDb): Promise<boolean> {
  const { table, id, field, value } = entry;
  // A legacy "Done with this Concert" entry: the action is gone (walkthrough S13), a Concert
  // ends on its own, so there is nothing left to save and the entry leaves.
  if (table === 'events' && field === 'logging') return true;
  const row = (await db.table(table).get(id)) as Row | undefined;
  // A new Item's search text: held once its draft is stored with it, or the Item is made.
  if (table === 'items' && field === 'draft') {
    if (row) return true;
    const typed = value as { eventId?: string; text?: string } | null;
    const draft = (await db.meta.get(draftKey(typed?.eventId ?? '')))?.value as
      { id?: string; text?: string } | undefined;
    return draft?.id === id && draft.text === typed?.text;
  }
  // A rename writes the Artist the id was merged into (store/people.ts renameArtist): read there.
  if (table === 'artists' && field === 'name') {
    let artist = row as OwnEntry | undefined;
    for (let hops = 0; artist?.mergedIntoId && hops < MAX_MERGE_HOPS; hops += 1) {
      artist = await db.artists.get(artist.mergedIntoId);
    }
    return artist?.deletedAt === null && artist.mergedIntoId === null && artist.name === value;
  }
  if (!row) return false;
  if (field === 'deletedAt') return row.deletedAt != null;
  if (row.deletedAt !== null) return false;
  // A new Item is held only with the pick entered: another made with the same id isn't it.
  if (field === '*') {
    const pick = (value as { pick?: Record<string, string> } | null)?.pick;
    return table !== 'items' || !pick || holdsPick(row, pick);
  }
  return fieldHolds(table, field, value, row);
}

/**
 * Whether the value a screen read from the store for `target` is the one entered, by the same
 * projection: while it isn't, the screen shows the value entered (screens/save-feedback.ts).
 */
export function storedHolds(
  { table, field }: Pick<JournalEntry, 'table' | 'field'>,
  entered: unknown,
  stored: unknown,
): boolean {
  if (table === 'appearances' && field === 'colours') {
    return fieldHolds(table, field, entered, { ...(stored as Row) });
  }
  // A kind is read back with the Event's title.
  if (table === 'events' && field === 'kind') {
    return fieldHolds(table, field, entered, { ...(stored as Row) });
  }
  if (table === 'events' && field === 'sabhaId') {
    const sabha = stored as { id?: string | null } | null;
    return fieldHolds(table, field, entered, { sabhaId: sabha?.id ?? null });
  }
  // A pick is read back as the whole Item.
  if (table === 'items' && field === 'pick') {
    return fieldHolds(table, field, entered, { ...(stored as Row) });
  }
  if (table === 'items' && field === 'layaNote') {
    return fieldHolds(table, field, entered, { layaVinyasam: { note: stored ?? null } });
  }
  return fieldHolds(table, field, entered, { [field]: stored });
}
