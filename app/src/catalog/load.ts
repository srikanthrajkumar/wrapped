// The catalog snapshot loader (contracts/catalog-snapshot.md, ADR 0004). The snapshot is a
// precached, content-hashed file; it is decoded into in-memory tables with lookups by natural
// key. A file whose bytes don't match the hash in its name is refused.

export interface Raga {
  key: string;
  display: string;
  aliases: string[];
  /** Ragas sharing a groupKey are Linked ragas. */
  groupKey: string;
  mela: number | null;
}

export interface Composer {
  key: string;
  display: string;
  aliases: string[];
}

export interface Tala {
  key: string;
  display: string;
}

export interface Song {
  kritiId: string;
  title: string;
  firstLine: string;
  /** Null for a song with several ragas; those are in `ragamalika`. */
  raga: Raga | null;
  ragamalika: Raga[];
  tala: Tala | null;
  composer: Composer | null;
  language: string | null;
  subject: string | null;
  form: string | null;
}

export interface Remap {
  ragas: Record<string, string | null>;
  composers: Record<string, string | null>;
  songs: Record<string, string | null>;
}

export interface Catalog {
  version: string;
  ragas: Raga[];
  composers: Composer[];
  talas: Tala[];
  languages: string[];
  subjects: string[];
  forms: string[];
  songs: Song[];
  ragaByKey: Map<string, Raga>;
  composerByKey: Map<string, Composer>;
  talaByKey: Map<string, Tala>;
  songByKritiId: Map<string, Song>;
  /** Cumulative from every earlier version: a key mapped to null is retired. */
  remap: Remap;
}

export class CatalogError extends Error {
  override name = 'CatalogError';
}

/** `catalog.<sha256>.json`, the name the logger's export gives the file. */
export const CATALOG_FILE = /^catalog\.([0-9a-f]{64})\.json$/;

type Json = Record<string, unknown>;

function object(value: unknown, where: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CatalogError(`${where} is not an object`);
  }
  return value as Json;
}

function column<T>(
  value: unknown,
  where: string,
  check: (item: unknown) => item is T,
  length?: number,
): T[] {
  if (!Array.isArray(value) || !value.every(check)) {
    throw new CatalogError(`${where} is not a list of the expected values`);
  }
  if (length !== undefined && value.length !== length) {
    throw new CatalogError(`${where} has ${value.length} entries, expected ${length}`);
  }
  return value;
}

const isString = (item: unknown): item is string => typeof item === 'string';
const isInt = (item: unknown): item is number => Number.isInteger(item);
const isStrings = (item: unknown): item is string[] => Array.isArray(item) && item.every(isString);
const isInts = (item: unknown): item is number[] => Array.isArray(item) && item.every(isInt);

/** `-1` means no value; any other index must exist. */
function at<T>(list: T[], index: number, where: string): T | null {
  if (index === -1) return null;
  const value = list[index];
  if (value === undefined) throw new CatalogError(`${where} points at missing entry ${index}`);
  return value;
}

/** An index that must name an entry: `-1` is refused, as in a ragamalika's member list. */
function member<T>(list: T[], index: number, where: string): T {
  const value = at(list, index, where);
  if (value === null) throw new CatalogError(`${where} lists no value (-1) as a member`);
  return value;
}

/** A lookup by key. Keys are unique in a snapshot (the contract), so a repeat is refused. */
function byKey<T>(entries: T[], keyOf: (entry: T) => string, where: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (map.has(key)) throw new CatalogError(`${where} repeats the key ${JSON.stringify(key)}`);
    map.set(key, entry);
  }
  return map;
}

function remapTable(value: unknown, where: string): Record<string, string | null> {
  const table = object(value ?? {}, where);
  for (const [from, to] of Object.entries(table)) {
    if (to !== null && typeof to !== 'string') throw new CatalogError(`${where}.${from} is bad`);
  }
  // No prototype, so a lookup of a key like "constructor" finds nothing rather than a function.
  return Object.assign(Object.create(null) as Record<string, string | null>, table);
}

/** Decode a parsed format-1 snapshot. Throws CatalogError when its shape is wrong. */
export function decodeSnapshot(raw: unknown): Catalog {
  const snapshot = object(raw, 'snapshot');
  if (snapshot.format !== 1)
    throw new CatalogError(`unsupported format ${String(snapshot.format)}`);
  if (typeof snapshot.version !== 'string') throw new CatalogError('version is missing');

  const r = object(snapshot.ragas, 'ragas');
  const ragaKeys = column(r.key, 'ragas.key', isString);
  const n = ragaKeys.length;
  const ragaDisplay = column(r.display, 'ragas.display', isString, n);
  const ragaAliases = column(r.aliases, 'ragas.aliases', isStrings, n);
  const groupKeys = column(r.groupKey, 'ragas.groupKey', isString, n);
  const melas = column(r.mela, 'ragas.mela', isInt, n);
  const ragas = ragaKeys.map<Raga>((key, i) => ({
    key,
    display: ragaDisplay[i]!,
    aliases: ragaAliases[i]!,
    groupKey: groupKeys[i]!,
    mela: melas[i] === -1 ? null : melas[i]!,
  }));

  const c = object(snapshot.composers, 'composers');
  const composerKeys = column(c.key, 'composers.key', isString);
  const composerDisplay = column(c.display, 'composers.display', isString, composerKeys.length);
  const composerAliases = column(c.aliases, 'composers.aliases', isStrings, composerKeys.length);
  const composers = composerKeys.map<Composer>((key, i) => ({
    key,
    display: composerDisplay[i]!,
    aliases: composerAliases[i]!,
  }));

  const t = object(snapshot.talas, 'talas');
  const talaKeys = column(t.key, 'talas.key', isString);
  const talaDisplay = column(t.display, 'talas.display', isString, talaKeys.length);
  const talas = talaKeys.map<Tala>((key, i) => ({ key, display: talaDisplay[i]! }));

  const keys = (name: string) => column(object(snapshot[name], name).key, `${name}.key`, isString);
  const languages = keys('languages');
  const subjects = keys('subjects');
  const forms = keys('forms');

  const s = object(snapshot.songs, 'songs');
  const kritiIds = column(s.kritiId, 'songs.kritiId', isString);
  const count = kritiIds.length;
  const title = column(s.title, 'songs.title', isString, count);
  const firstLine = column(s.firstLine, 'songs.firstLine', isString, count);
  const raga = column(s.raga, 'songs.raga', isInt, count);
  const tala = column(s.tala, 'songs.tala', isInt, count);
  const composer = column(s.composer, 'songs.composer', isInt, count);
  const language = column(s.language, 'songs.language', isInt, count);
  const subject = column(s.subject, 'songs.subject', isInt, count);
  const form = column(s.form, 'songs.form', isInt, count);
  const ragamalika = column(s.ragamalika, 'songs.ragamalika', isInts, count);

  const songs = kritiIds.map<Song>((kritiId, i) => {
    const where = `song ${kritiId}`;
    return {
      kritiId,
      title: title[i]!,
      firstLine: firstLine[i]!,
      raga: at(ragas, raga[i]!, where),
      ragamalika: ragamalika[i]!.map((index) => member(ragas, index, where)),
      tala: at(talas, tala[i]!, where),
      composer: at(composers, composer[i]!, where),
      language: at(languages, language[i]!, where),
      subject: at(subjects, subject[i]!, where),
      form: at(forms, form[i]!, where),
    };
  });

  const remap = object(snapshot.remap ?? {}, 'remap');
  return {
    version: snapshot.version,
    ragas,
    composers,
    talas,
    languages,
    subjects,
    forms,
    songs,
    ragaByKey: byKey(ragas, (entry) => entry.key, 'ragas'),
    composerByKey: byKey(composers, (entry) => entry.key, 'composers'),
    talaByKey: byKey(talas, (entry) => entry.key, 'talas'),
    songByKritiId: byKey(songs, (entry) => entry.kritiId, 'songs'),
    remap: {
      ragas: remapTable(remap.ragas, 'remap.ragas'),
      composers: remapTable(remap.composers, 'remap.composers'),
      songs: remapTable(remap.songs, 'remap.songs'),
    },
  };
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Check the bytes against the hash in `fileName`, then decode them. */
export async function verifySnapshot(fileName: string, bytes: ArrayBuffer): Promise<Catalog> {
  const expected = CATALOG_FILE.exec(fileName)?.[1];
  if (!expected) throw new CatalogError(`${fileName} is not named catalog.<sha256>.json`);
  const actual = await sha256Hex(bytes);
  if (actual !== expected) throw new CatalogError(`${fileName} does not match its hash`);
  return decodeSnapshot(JSON.parse(new TextDecoder().decode(bytes)));
}

export interface LoadedCatalog {
  file: string;
  catalog: Catalog;
}

const fetchFromPrecache = async (file: string) => {
  const response = await fetch(`/catalog/${file}`);
  if (!response.ok) throw new CatalogError(`${file}: HTTP ${response.status}`);
  return response.arrayBuffer();
};

/**
 * Load the first good snapshot of `files`: the build's own first, then the version accepted
 * last, so a damaged new file leaves the previous version in use. Returns null, with the
 * reasons, when none loads.
 */
export async function loadCatalog(
  files: readonly string[],
  fetchBytes: (file: string) => Promise<ArrayBuffer> = fetchFromPrecache,
): Promise<LoadedCatalog | { file: null; errors: string[] }> {
  const errors: string[] = [];
  for (const file of files) {
    try {
      return { file, catalog: await verifySnapshot(file, await fetchBytes(file)) };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { file: null, errors };
}
