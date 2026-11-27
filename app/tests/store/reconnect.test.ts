// Required test (constitution IV): WebKit drops a background page's store connection
// ("Connection to Indexed Database server lost", an UnknownError), and the Maintainer's iPhone
// showed the rescue screen for it (2026-11-27). The app opens a new connection, quietly, before the
// rescue screen; a save that hit the dead connection lands after the reopen, or is reported as
// "Not saved" and kept, never dropped; and a stray "ResizeObserver loop" error never rescues.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveFeedback } from '../../src/screens/save-feedback';
import { REOPEN_LIMIT_MS, WrappedDB, isConnectionLost } from '../../src/store/db';
import { createEvent, editEvent } from '../../src/store/events';
import {
  healAfterCrash,
  mayHealCrash,
  recordCrash,
  resetStoreHealth,
  storeHealth,
  watchForeground,
  watchStore,
  watchStrayErrors,
} from '../../src/store/health';
import { holdsValue } from '../../src/store/journal-check';
import { latestRescueCause, recordRescue, RESCUE_CAUSES_KEY } from '../../src/store/rescue-cause';
import { freshDb } from '../helpers';

/** localStorage, for the rescue causes and the journal. */
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  get length() {
    return storage.size;
  },
  key: (index: number) => [...storage.keys()][index] ?? null,
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});

const LOST = 'Connection to Indexed Database server lost. Refresh the page to try again';
const lostError = () => new DOMException(LOST, 'UnknownError');

/** Connections the browser has dropped: every transaction on them fails, as on WebKit. */
const lostConnections = new WeakSet<IDBDatabase>();
const transaction = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args) {
  if (lostConnections.has(this)) throw lostError();
  return transaction.apply(this, args);
};

/** WebKit's lost connection: the old connection refuses every transaction from now on. */
function loseConnection(db: WrappedDB): IDBDatabase {
  const idb = db.backendDB();
  lostConnections.add(idb);
  return idb;
}

/** The connection is lost while a write is running: its next put fails, and the rest after. */
function loseConnectionMidWrite(db: WrappedDB): void {
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function () {
    IDBObjectStore.prototype.put = put;
    loseConnection(db);
    throw lostError();
  };
}

/**
 * Opens answer `ms` late, as WebKit's may after the app has given up on them: the browser's real
 * open runs, and its events reach the app only then. Returns the undo.
 */
function answerOpensLate(ms: number): () => void {
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (this: IDBFactory, ...args) {
    const real = open.apply(this, args);
    const late = {} as Record<string, ((event: Event) => void) | null>;
    for (const name of ['onsuccess', 'onerror', 'onupgradeneeded', 'onblocked'] as const) {
      real[name] = (event: Event) => setTimeout(() => late[name]?.(event), ms);
    }
    return new Proxy(real, {
      get: (target, key) =>
        typeof key === 'string' && key in late ? late[key] : Reflect.get(target, key),
      set: (target, key, value) => {
        if (typeof key === 'string' && key.startsWith('on')) late[key] = value;
        else Reflect.set(target, key, value);
        return true;
      },
    });
  };
  return () => {
    IDBFactory.prototype.open = open;
  };
}

/** No new connection will open. */
function refuseOpens(db: WrappedDB) {
  return vi.spyOn(db, 'open').mockImplementation(() => Promise.reject(lostError()) as never);
}

/** What the store holds, read on a connection of its own. */
async function stored(db: WrappedDB, id: string) {
  const reader = new WrappedDB(db.name);
  try {
    const event = await reader.events.get(id);
    const queued = await reader.outbox.where('recordId').equals(id).toArray();
    const probe = await reader.meta.get(id);
    return { event, queued, probe };
  } finally {
    reader.close();
  }
}

async function watched(): Promise<WrappedDB> {
  const db = freshDb();
  watchStore(db);
  await vi.waitFor(() => expect(storeHealth()).toEqual({ state: 'open' }));
  return db;
}

beforeEach(() => {
  storage.clear();
  resetStoreHealth();
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('a lost connection, before the rescue screen', () => {
  it('reopens and the save lands: stored once, queued once, no rescue', async () => {
    const db = await watched();
    const event = await createEvent({ kind: 'concert' }, { db });
    const old = loseConnection(db);

    const edited = await editEvent(event.id, { note: 'typed after hours away' }, { db });

    expect(db.backendDB()).not.toBe(old);
    expect(edited.note).toBe('typed after hours away');
    const { event: kept, queued } = await stored(db, event.id);
    expect(kept?.note).toBe('typed after hours away');
    // One never-sent entry per record: the run again replaced it, never added a second.
    expect(queued).toHaveLength(1);
    expect(queued[0]!.row).toMatchObject({ note: 'typed after hours away' });
    expect(storeHealth()).toEqual({ state: 'open' });
    expect(latestRescueCause()).toBeNull();
  });

  it('a save in flight when the connection goes is run again after the reopen', async () => {
    const db = await watched();
    const event = await createEvent({ kind: 'concert' }, { db });
    loseConnectionMidWrite(db);

    await editEvent(event.id, { note: 'mid-write' }, { db });

    const { event: kept, queued } = await stored(db, event.id);
    expect(kept?.note).toBe('mid-write');
    expect(queued).toHaveLength(1);
    expect(storeHealth()).toEqual({ state: 'open' });
  });

  it('when no new connection opens: the save is refused to its caller and the rescue shows, with its cause', async () => {
    const db = await watched();
    const event = await createEvent({ kind: 'concert' }, { db });
    loseConnection(db);
    refuseOpens(db);

    const saving = editEvent(event.id, { note: 'stranded' }, { db });

    await expect(saving).rejects.toMatchObject({ name: 'UnknownError' });
    expect(storeHealth()).toMatchObject({ state: 'failed' });
    expect(latestRescueCause()).toEqual({
      kind: 'store',
      name: 'UnknownError',
      detail: 'connection lost',
      at: expect.any(String),
    });
  });

  it('a new connection that never opens is given up in time: the rescue screen, never a wait forever', async () => {
    const db = await watched();
    const event = await createEvent({ kind: 'concert' }, { db });
    loseConnection(db);
    // WebKit's open request that never answers.
    vi.spyOn(db, 'open').mockImplementation(() => new Promise(() => undefined) as never);

    const started = Date.now();
    const saving = editEvent(event.id, { note: 'stranded' }, { db });
    await expect(saving).rejects.toMatchObject({ name: 'UnknownError' });
    expect(Date.now() - started).toBeLessThan(REOPEN_LIMIT_MS + 1_500);
    expect(storeHealth()).toMatchObject({ state: 'failed' });
    expect(latestRescueCause()).toMatchObject({
      kind: 'store',
      name: 'OpenTimeoutError',
      detail: 'open timed out',
    });
  }, 15_000);

  it('screens that broke wait for a reopen that never opens only until it is given up', async () => {
    const db = await watched();
    loseConnection(db);
    vi.spyOn(db, 'open').mockImplementation(() => new Promise(() => undefined) as never);

    // RescueBoundary draws nothing while this runs, then the rescue screen once it is false.
    expect(mayHealCrash(lostError())).toBe(true);
    await expect(healAfterCrash()).resolves.toBe(false);
    expect(storeHealth()).toMatchObject({ state: 'failed' });
  }, 15_000);

  it('a value entered across the lost connection: saved after the reopen, else kept as "Not saved"', async () => {
    const db = await watched();
    const event = await createEvent({ kind: 'concert' }, { db });
    const journal = new SaveFeedback({ storage: localStorage, confirm: (e) => holdsValue(e, db) });
    const note = { table: 'events' as const, id: event.id, field: 'note' };

    // Reopened: saved, confirmed in the store, and out of the journal.
    loseConnection(db);
    await journal.track(note, 'first', () => editEvent(event.id, { note: 'first' }, { db }));
    expect(journal.get(note)).toMatchObject({ status: 'saved', value: 'first' });
    expect((await stored(db, event.id)).event?.note).toBe('first');
    await vi.waitFor(() => expect(journal.notSaved()).toEqual([]));

    // Not reopened: failed, shown as "Not saved", and journalled for Export, never dropped.
    loseConnection(db);
    refuseOpens(db);
    await journal.track(note, 'second', () => editEvent(event.id, { note: 'second' }, { db }));
    expect(journal.get(note)).toMatchObject({ status: 'failed', value: 'second' });
    expect(journal.notSaved()).toEqual([
      expect.objectContaining({ id: event.id, field: 'note', value: 'second', state: 'failed' }),
    ]);
    expect([...storage.values()].some((copy) => copy.includes('"second"'))).toBe(true);
    expect(storeHealth()).toMatchObject({ state: 'failed' });
  });

  it('a store that refused to open gets one more try before the rescue screen', async () => {
    const db = freshDb();
    const open = vi.spyOn(db, 'open');
    open.mockImplementationOnce(() => Promise.reject(lostError()) as never);
    watchStore(db);
    await vi.waitFor(() => expect(storeHealth()).toEqual({ state: 'open' }));
    expect(open.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(await db.events.count()).toBe(0);
  });

  it('a connection that answers is kept, not closed under running writes', async () => {
    const db = await watched();
    const idb = db.backendDB();
    await db.reopen();
    expect(db.backendDB()).toBe(idb);
  });
});

describe('an open that answers after the rescue screen', () => {
  it('lands no write: each value entered meanwhile is kept once, as "Not saved", until a reload', async () => {
    const db = await watched();
    const event = await createEvent({ kind: 'concert' }, { db });
    const journal = new SaveFeedback({ storage: localStorage, confirm: (e) => holdsValue(e, db) });
    const note = { table: 'events' as const, id: event.id, field: 'note' };
    const title = { table: 'events' as const, id: event.id, field: 'startTime' };
    loseConnection(db);
    const restore = answerOpensLate(REOPEN_LIMIT_MS + 500);

    // The save that finds the connection lost, and one made while the reopen waits on the open.
    const first = journal.track(note, 'typed first', () =>
      editEvent(event.id, { note: 'typed first' }, { db }),
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const queued = journal.track(title, '19:00', () =>
      editEvent(event.id, { startTime: '19:00' }, { db }),
    );
    await Promise.all([first, queued]);
    expect(storeHealth()).toMatchObject({ state: 'failed' });

    // The late open answers, behind the rescue screen: Dexie takes its connection all the same.
    await vi.waitFor(() => expect(db.backendDB()).not.toBeNull(), { timeout: 3_000 });
    // Nothing writes until a reload: a save, and a write of the store's own.
    await expect(editEvent(event.id, { note: 'after' }, { db })).rejects.toMatchObject({
      name: 'DatabaseClosedError',
    });
    await expect(db.meta.put({ key: 'probe', value: 1 })).rejects.toMatchObject({
      name: 'DatabaseClosedError',
    });
    restore();

    const { event: kept, queued: entries } = await stored(db, event.id);
    expect(kept).toMatchObject({ note: null, startTime: null });
    expect(entries.map((entry) => entry.row)).not.toContainEqual(
      expect.objectContaining({ note: 'typed first' }),
    );
    expect(entries.map((entry) => entry.row)).not.toContainEqual(
      expect.objectContaining({ startTime: '19:00' }),
    );
    expect(await stored(db, 'probe').then(({ probe }) => probe)).toBeUndefined();
    // Each value is in the journal once, failed, for Export and Try again after the reload.
    expect(journal.notSaved()).toEqual([
      expect.objectContaining({ field: 'note', value: 'typed first', state: 'failed' }),
      expect.objectContaining({ field: 'startTime', value: '19:00', state: 'failed' }),
    ]);
    expect([...storage.values()].filter((copy) => copy.includes('typed first'))).toHaveLength(1);
    expect([...storage.values()].filter((copy) => copy.includes('19:00'))).toHaveLength(1);
  }, 20_000);
});

describe('back in the foreground', () => {
  function page(visibilityState: DocumentVisibilityState) {
    const doc = Object.assign(new EventTarget(), { visibilityState });
    const win = new EventTarget();
    watchForeground(doc as unknown as Document, win as unknown as Window);
    return { doc, win };
  }

  it('the page shown again finds the connection lost and opens a new one before the next tap', async () => {
    const db = await watched();
    const old = loseConnection(db);
    const { doc } = page('visible');
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(db.backendDB()).not.toBe(old));
    expect(await db.events.count()).toBe(0);
    expect(storeHealth()).toEqual({ state: 'open' });
  });

  it('back from the back-forward cache, too; a fresh pageshow or a hidden page checks nothing', async () => {
    const db = await watched();
    const reopen = vi.spyOn(db, 'reopen');
    const { doc, win } = page('hidden');
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    expect(reopen).not.toHaveBeenCalled();
    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(reopen).toHaveBeenCalledOnce();
  });
});

describe('the screens breaking', () => {
  it('on a lost connection: one quiet heal, then the rescue screen if they break again soon', async () => {
    await watched();
    const now = 1_000_000;
    expect(mayHealCrash(lostError(), now)).toBe(true);
    expect(await healAfterCrash(now)).toBe(true);
    expect(mayHealCrash(lostError(), now + 1_000)).toBe(false);
    expect(mayHealCrash(lostError(), now + 10_000)).toBe(true);
  });

  it('anything else is the rescue screen, recorded as a crash', async () => {
    await watched();
    const broken = new TypeError("Cannot read properties of undefined (reading 'title')");
    expect(mayHealCrash(broken)).toBe(false);
    recordCrash(broken);
    expect(latestRescueCause()).toEqual({
      kind: 'crash',
      name: 'TypeError',
      detail: null,
      at: expect.any(String),
    });
  });

  it('keeps no error message: what the rasika typed never reaches the record or the screen', async () => {
    await watched();
    const typed = 'Bhairavi at Narada Gana Sabha';
    recordCrash(new RangeError(`Invalid raga "${typed}"`));
    recordCrash(Object.assign(new Error(typed), { name: `Custom ${typed}` }));
    recordRescue('store', Object.assign(new Error(`while saving "${typed}"`), { name: 'Oops' }));
    recordRescue(
      'store',
      new DOMException(`Quota exceeded saving "${typed}"`, 'QuotaExceededError'),
    );

    expect(storage.get(RESCUE_CAUSES_KEY)).not.toContain(typed);
    expect(storage.get(RESCUE_CAUSES_KEY)).not.toContain('Invalid raga');
    const kept = JSON.parse(storage.get(RESCUE_CAUSES_KEY)!) as unknown[];
    expect(kept).toEqual([
      { kind: 'crash', name: 'RangeError', detail: null, at: expect.any(String) },
      // A name not on the list is kept as "Error".
      { kind: 'crash', name: 'Error', detail: null, at: expect.any(String) },
      { kind: 'store', name: 'Error', detail: null, at: expect.any(String) },
      { kind: 'store', name: 'QuotaExceededError', detail: 'storage full', at: expect.any(String) },
    ]);
  });

  it('a record holding anything but known names and details is never shown', () => {
    storage.set(
      RESCUE_CAUSES_KEY,
      JSON.stringify([
        { kind: 'crash', name: 'TypeError', detail: 'typed by the rasika', at: '2026-11-27' },
        { kind: 'crash', name: 'Custom', detail: null, at: '2026-11-27' },
      ]),
    );
    expect(latestRescueCause()).toBeNull();
  });
});

describe('a stray "ResizeObserver loop" error', () => {
  const RESIZE = 'ResizeObserver loop completed with undelivered notifications.';

  it('never heals, never rescues, never records', async () => {
    const db = await watched();
    const reopen = vi.spyOn(db, 'reopen');
    const win = new EventTarget();
    watchStrayErrors(win as unknown as Window);

    // As browsers report it: an ErrorEvent with a message and no error object.
    win.dispatchEvent(Object.assign(new Event('error'), { message: RESIZE, error: null }));
    win.dispatchEvent(Object.assign(new Event('error'), { error: new Error(RESIZE) }));
    win.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: new Error(RESIZE) }),
    );
    await Promise.resolve();

    expect(isConnectionLost(new Error(RESIZE))).toBe(false);
    expect(mayHealCrash(new Error(RESIZE))).toBe(false);
    expect(reopen).not.toHaveBeenCalled();
    expect(storeHealth()).toEqual({ state: 'open' });
    expect(storage.has(RESCUE_CAUSES_KEY)).toBe(false);
  });

  it('while a lost connection left unawaited does heal', async () => {
    const db = await watched();
    const old = loseConnection(db);
    const win = new EventTarget();
    watchStrayErrors(win as unknown as Window);
    win.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: lostError() }));
    await vi.waitFor(() => expect(db.backendDB()).not.toBe(old));
    expect(storeHealth()).toEqual({ state: 'open' });
  });
});
