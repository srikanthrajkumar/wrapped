// Last season's sheet, row by row, as the app's records (T045). Every Item goes through the
// app's own matching (app/src/catalog/match.ts, FR-039), so what matches here is what the app
// would match for the same typing. Nothing is guessed: a title that names several songs is
// narrowed only by the Raga and Composer logged with it, and otherwise stays Unresolved.

import { createHash } from 'node:crypto';
import { settleDetail, suggestedDetails, type Suggested } from '../../app/src/catalog/details';
import type { Catalog, Song } from '../../app/src/catalog/load';
import { fold } from '../../app/src/catalog/fold';
import type { KeptForm, Matcher, MatchField } from '../../app/src/catalog/match';
import {
  catalogValue,
  COLOURS,
  notApplicableValue,
  unknownValue,
  type Appearance,
  type Colour,
  type DetailValue,
  type Event,
  type Item,
  type Nadai,
  type OwnEntry,
  type Role,
  type SharedEntry,
} from '../../app/src/model';
import { itemProblems } from '../../app/src/store/rules';

export type Cell = string | number | boolean | Date | null;
export type Row = Cell[];

/** The four outcomes SC-005 counts separately. */
export type Outcome = 'composition' | 'unknown' | 'special' | 'unresolved';

export interface ImportedItem {
  sheetRow: number;
  outcome: Outcome;
  item: Item;
  /** How a title naming several songs was settled, or why it wasn't. */
  why: string;
}

// Fixed, so a rerun writes the same fixture.
const STAMP = '2024-12-31T00:00:00.000Z';
const timestamps = { createdAt: STAMP, updatedAt: STAMP, deletedAt: null };

/** A UUID derived from `name`, so the same row gets the same id on every run. */
export function stableId(name: string): string {
  const hex = createHash('sha1').update(`wrapped-2024-25:${name}`).digest('hex');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const text = (cell: Cell | undefined): string =>
  cell === null || cell === undefined ? '' : String(cell).trim();

// What the sheet wrote for "nothing applies": an instrumental piece has no language.
const NOT_APPLICABLE = new Set(['', '-', 'none']);

/** A Detail as typed in the sheet, through the app's matcher. */
export function sheetDetail(matcher: Matcher, field: MatchField, cell: Cell | undefined) {
  const typed = text(cell);
  if (NOT_APPLICABLE.has(typed.toLowerCase())) return notApplicableValue();
  return matcher.detail(field, typed);
}

// The sheet's spellings of the Nadai, as in "Adi (Tishra Gati)", folded.
const NADAI_NAMES: Record<string, Nadai> = {
  [fold('tisra')]: 'tisra',
  [fold('tishra')]: 'tisra',
  [fold('chatusra')]: 'chatusra',
  [fold('chaturshra')]: 'chatusra',
  [fold('chatushra')]: 'chatusra',
  [fold('khanda')]: 'khanda',
  [fold('misra')]: 'misra',
  [fold('mishra')]: 'misra',
  [fold('sankeerna')]: 'sankeerna',
};

/** "Adi (Tishra Gati)" → the tala "Adi" and the Nadai tisra; anything else is all tala. */
export function splitTala(typed: string): { tala: string; nadai: DetailValue } {
  const found = /^(.*?)\s*\(\s*(\w+)\s+(?:gati|nadai)\s*\)$/i.exec(typed);
  const nadai = found && NADAI_NAMES[fold(found[2]!)];
  if (!found || !nadai) return { tala: typed, nadai: notApplicableValue() };
  return { tala: found[1]!, nadai: catalogValue(nadai, found[2]!) };
}

/** "Malayamarutham + Varali" → two Ragas, in order. */
export function sheetRagas(matcher: Matcher, cell: Cell | undefined): DetailValue[] {
  const typed = text(cell);
  if (NOT_APPLICABLE.has(typed.toLowerCase())) return [notApplicableValue()];
  return typed
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => matcher.detail('raga', part));
}

const songRagaKeys = (song: Song) =>
  (song.raga ? [song.raga, ...song.ragamalika] : song.ragamalika).map((raga) => raga.key);

/**
 * The one song a title names, using the logged Raga and then Composer only to choose among
 * songs that share the title. Null, with the reason, when it is not exactly one.
 */
export function pickSong(
  candidates: Song[],
  ragas: DetailValue[],
  composer: DetailValue,
): { song: Song | null; why: string } {
  if (candidates.length === 0) return { song: null, why: 'no song has this title' };
  if (candidates.length === 1) return { song: candidates[0]!, why: 'one song has this title' };
  const ragaKeys = ragas.flatMap((raga) => (raga.key ? [raga.key] : []));
  let narrowed = candidates;
  if (ragaKeys.length > 0) {
    const inRaga = narrowed.filter((song) => ragaKeys.some((k) => songRagaKeys(song).includes(k)));
    if (inRaga.length > 0) narrowed = inRaga;
  }
  if (narrowed.length > 1 && composer.key) {
    const byComposer = narrowed.filter((song) => song.composer?.key === composer.key);
    if (byComposer.length > 0) narrowed = byComposer;
  }
  if (narrowed.length === 1) {
    return {
      song: narrowed[0]!,
      why: `${candidates.length} songs have this title; the logged Raga and Composer name one`,
    };
  }
  return {
    song: null,
    why: `${candidates.length} songs have this title; the logged Raga and Composer leave ${narrowed.length}`,
  };
}

export interface ConvertContext {
  catalog: Catalog;
  matcher: Matcher;
  keptForms: readonly KeptForm[];
  /** Event ids by the sheet's Concert number ("ID No."). */
  eventIdFor: (concert: number) => string;
}

/** One row of the Compositions tab: Sl No., ID No., Composition, Raga, Tala, Composer, Language, Topic. */
export function convertItem(row: Row, position: number, ctx: ConvertContext): ImportedItem {
  const { matcher, keptForms } = ctx;
  const sheetRow = Number(row[0]);
  let title = text(row[2]);
  let note: string | null = null;
  // "Chamaki (?)": the rasika wasn't sure of the title.
  if (/\(\?\)\s*$/.test(title)) {
    title = title.replace(/\s*\(\?\)\s*$/, '');
    note = 'Title marked (?) in the sheet';
  }

  let ragas = sheetRagas(matcher, row[3]);
  const { tala: talaText, nadai } = splitTala(text(row[4]));
  const typed = {
    tala: NOT_APPLICABLE.has(talaText.toLowerCase())
      ? notApplicableValue()
      : matcher.detail('tala', talaText),
    composer: sheetDetail(matcher, 'composer', row[5]),
    language: sheetDetail(matcher, 'language', row[6]),
    // The sheet's Topic column holds what the catalog calls the subject ("Rama", "Devi").
    subject: sheetDetail(matcher, 'subject', row[7]),
  };

  const base = {
    id: stableId(`item:${sheetRow}`),
    eventId: ctx.eventIdFor(Number(row[1])),
    position,
    title,
    nadai,
    layaVinyasam: null,
    improvised: [],
    note,
    ...timestamps,
  };

  const formKey = matcher.key('form', title);
  const kept = keptForms.find((form) => form.key === formKey);
  if (title === '?' || kept) {
    const item: Item = {
      ...base,
      compositionKey: null,
      form: kept ? catalogValue(kept.key, kept.display) : unknownValue(),
      ragas,
      ...typed,
    };
    return finish(
      sheetRow,
      kept ? 'special' : 'unknown',
      item,
      kept ? `the form ${kept.display}` : 'typed "?"',
    );
  }

  const { song, why } = pickSong(matcher.songs(title), ragas, typed.composer);
  if (!song) {
    const item: Item = { ...base, compositionKey: null, form: unknownValue(), ragas, ...typed };
    return finish(sheetRow, 'unresolved', item, why);
  }

  const suggested: Suggested = suggestedDetails(song);
  // "Ragamalika" in the sheet, for a song whose member Ragas the catalog lists: the rasika
  // logged the form of the list, not a different one, so the catalog's list stands.
  const loggedRagamalika = ragas.length === 1 && fold(ragas[0]!.text) === fold('Ragamalika');
  if (loggedRagamalika && suggested.ragas.length > 1) ragas = suggested.ragas;
  const settle = (value: DetailValue, catalogs: DetailValue | undefined) =>
    settleDetail(value, catalogs, true);
  const item: Item = {
    ...base,
    compositionKey: song.kritiId,
    form: suggested.form,
    ragas: ragas.map((raga, i) => settle(raga, suggested.ragas[i])),
    tala: settle(typed.tala, suggested.tala),
    composer: settle(typed.composer, suggested.composer),
    language: settle(typed.language, suggested.language),
    subject: settle(typed.subject, suggested.subject),
  };
  return finish(sheetRow, 'composition', item, why);
}

function finish(sheetRow: number, outcome: Outcome, item: Item, why: string): ImportedItem {
  const problems = itemProblems(item);
  if (problems.length > 0) throw new Error(`sheet row ${sheetRow}: ${problems.join('; ')}`);
  return { sheetRow, outcome, item, why };
}

/** Artists and Sabhas: the shared entry of the same name, else an own one made for it. */
export class People {
  readonly artists = new Map<string, OwnEntry>();
  readonly sabhas = new Map<string, OwnEntry>();
  private readonly shared: Record<'artist' | 'sabha', Map<string, SharedEntry>>;

  constructor(seed: { artists: SharedEntry[]; sabhas: SharedEntry[] }) {
    const byFold = (entries: SharedEntry[]) =>
      new Map(
        entries.flatMap((entry) => [entry.name, ...entry.aliases].map((n) => [fold(n), entry])),
      );
    this.shared = { artist: byFold(seed.artists), sabha: byFold(seed.sabhas) };
  }

  id(kind: 'artist' | 'sabha', name: string): string {
    const shared = this.shared[kind].get(fold(name));
    if (shared) return shared.id;
    const own = kind === 'artist' ? this.artists : this.sabhas;
    const key = fold(name);
    let entry = own.get(key);
    if (!entry) {
      entry = {
        id: stableId(`${kind}:${key}`),
        name,
        nameKey: key,
        aliases: [],
        mergedIntoId: null,
        ...timestamps,
      };
      own.set(key, entry);
    }
    return entry.id;
  }
}

// The Main and Colours tabs, column by column after their ID: Artist #1 and #2 with a blank
// Role, then the accompanists. Main has a Date column the Colours tab lacks.
const STAGE: (Role | null)[] = [null, null, 'violin', 'mridangam', 'khanjira', 'ghatam', 'morsing'];

function colour(cell: Cell | undefined): Colour | 'unknown' | null {
  const typed = text(cell).toLowerCase();
  if (typed === '') return null;
  return (COLOURS as readonly string[]).includes(typed) ? (typed as Colour) : 'unknown';
}

/** A Concert from the Main tab, with its Appearances in the sheet's column order. */
export function convertConcert(
  main: Row,
  colours: Row | undefined,
  people: People,
  eventId: string,
): { event: Event; appearances: Appearance[] } {
  const sabha = text(main[9]);
  const event: Event = {
    id: eventId,
    kind: 'concert',
    // The sheet has no Concert dates; every Concert is put on the season's first day.
    date: '2024-12-01',
    startTime: null,
    sabhaId: sabha ? people.id('sabha', sabha) : null,
    status: 'attended',
    cancelled: false,
    source: 'spot',
    scheduleEntryId: null,
    scheduleVersionSeen: null,
    scheduleChanged: false,
    touched: true,
    title: null,
    note: null,
    ...timestamps,
  };
  const appearances: Appearance[] = [];
  STAGE.forEach((role, i) => {
    const name = text(main[2 + i]);
    if (!name) return;
    appearances.push({
      id: stableId(`appearance:${eventId}:${i}`),
      eventId,
      artistId: people.id('artist', name),
      role,
      colourPrimary: colour(colours?.[1 + i]),
      colourSecondary: null,
      billed: false,
      position: appearances.length + 1,
      ...timestamps,
    });
  });
  return { event, appearances };
}

/** "23/12/2024" → "2024-12-23". */
export function isoDate(typed: string): string | null {
  const found = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(typed.trim());
  if (!found) return null;
  const [, day, month, year] = found;
  return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
}

/** A Lecdem from the Lecdems tab: Sl No., Date, up to three presenters, Title. */
export function convertLecdem(
  row: Row,
  people: People,
): { event: Event; appearances: Appearance[] } {
  const eventId = stableId(`lecdem:${text(row[0])}`);
  const event: Event = {
    id: eventId,
    kind: 'lecdem',
    date: isoDate(text(row[1])) ?? '2024-12-01',
    startTime: null,
    sabhaId: null,
    status: 'attended',
    cancelled: false,
    source: 'spot',
    scheduleEntryId: null,
    scheduleVersionSeen: null,
    scheduleChanged: false,
    touched: true,
    title: text(row[5]),
    note: null,
    ...timestamps,
  };
  const appearances = [row[2], row[3], row[4]]
    .map(text)
    .filter((name) => name !== '')
    .map((name, i): Appearance => ({
      id: stableId(`appearance:${eventId}:${i}`),
      eventId,
      artistId: people.id('artist', name),
      role: 'presenter',
      colourPrimary: null,
      colourSecondary: null,
      billed: false,
      position: i + 1,
      ...timestamps,
    }));
  return { event, appearances };
}
