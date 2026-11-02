// Whether the phone store holds a journal entry's value (docs/adr/0007): the projection, per
// field, from the stored record to the value as the rasika entered it. A journal entry leaves
// only when this says yes, so each projection follows how the store keeps that field: a note
// emptied is stored as null, a Sabha is kept with its name, Colours are two columns, a catalog
// value can be stored as an Override of the song's, and "Done with this Concert" lives in the
// Event's logging note.

import type { DetailValue } from '../model';
import type { JournalEntry } from '../screens/save-feedback';
import { db as defaultDb, type WrappedDB } from './db';
import { readLoggingNote } from './logging-note';

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

export async function holdsValue(
  entry: Pick<JournalEntry, 'table' | 'id' | 'field' | 'value'>,
  db: WrappedDB = defaultDb,
): Promise<boolean> {
  const { table, id, field, value } = entry;
  if (table === 'events' && field === 'logging') {
    return (await readLoggingNote(id, db))?.doneAt != null;
  }
  const row = (await db.table(table).get(id)) as Row | undefined;
  if (!row) return false;
  if (field === '*') return row.deletedAt === null;
  if (field === 'deletedAt') return row.deletedAt != null;
  if (row.deletedAt !== null) return false;
  if (table === 'events') {
    if (field === 'note') return (row.note ?? '') === (value ?? '');
    if (field === 'sabhaId') return row.sabhaId === (value as { id?: string } | null)?.id;
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
    if (field === 'layaVinyasam') {
      const stored = row.layaVinyasam as { nadai: DetailValue; note: string | null } | null;
      const entered = value as { nadai: DetailValue; note: string | null } | null;
      if (!stored || !entered) return stored === entered;
      return (
        sameDetail(stored.nadai, entered.nadai) && (stored.note ?? '') === (entered.note ?? '')
      );
    }
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
