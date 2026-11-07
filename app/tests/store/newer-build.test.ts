// Required test (constitution IV, nothing lost): a tab still running an older build stops writing
// once a newer build opens the store. Its saves would drop the fields it doesn't know (an
// Appearance's `group`, say) into the outbox both tabs share, and the newer tab would push them
// (contracts/sync-api.md, "Errors"). So the older one closes its store for good and the screens
// ask for a reload; an older build that opens an already upgraded store refuses it the same way.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId, type Event } from '../../src/model';
import { NewerStoreError, WrappedDB } from '../../src/store/db';
import { storeHealth, watchStore } from '../../src/store/health';
import { save } from '../../src/store/mutate';
import { freshDb } from '../helpers';

/** The next release: the same store, one version on. */
class NewerBuild extends WrappedDB {
  constructor(name: string) {
    super(name);
    this.version(this.verno + 1).stores({});
  }
}

const builds: WrappedDB[] = [];
afterEach(async () => {
  for (const build of builds.splice(0)) await build.delete();
});

function newerBuild(name: string): WrappedDB {
  const build = new NewerBuild(name);
  builds.push(build);
  return build;
}

function concert(): Event {
  const now = new Date().toISOString();
  return {
    id: newId(),
    kind: 'concert',
    date: '2026-12-15',
    startTime: '16:00',
    sabhaId: null,
    status: 'attended',
    cancelled: false,
    source: 'spot',
    scheduleEntryId: null,
    scheduleVersionSeen: null,
    scheduleChanged: false,
    touched: true,
    title: null,
    note: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

/** True for the refusal, as thrown or as the `inner` of Dexie's own error. */
function isNewerStore(error: unknown): boolean {
  const inner = (error as { inner?: unknown } | null)?.inner;
  return error instanceof NewerStoreError || inner instanceof NewerStoreError;
}

describe('a tab running an older build (required)', () => {
  it('opens the store at version 3 at least, for the shape Dance, Harikatha and group brought', async () => {
    const store = freshDb();
    await store.open();
    expect(store.backendDB().version / 10).toBeGreaterThanOrEqual(3);
  });

  it('closes its store when a newer build opens it, and saves nothing after', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const older = freshDb();
    await save('events', concert(), { db: older });

    const newer = newerBuild(older.name);
    await newer.open();

    expect(older.isOpen()).toBe(false);
    await expect(save('events', concert(), { db: older })).rejects.toThrow();
    // Not reopened by the write: the newer build's store has only the first save.
    expect(older.isOpen()).toBe(false);
    expect(await newer.events.count()).toBe(1);
    expect(await newer.outbox.count()).toBe(1);
  });

  it('refuses a store a newer build already upgraded, and saves nothing', async () => {
    const name = `test-${newId()}`;
    const newer = newerBuild(name);
    await newer.open();
    newer.close();

    const older = freshDb(name);
    const refused = await older.open().catch((error: unknown) => error);
    expect(isNewerStore(refused)).toBe(true);
    await expect(save('events', concert(), { db: older })).rejects.toThrow();

    await newer.open();
    expect(await newer.events.count()).toBe(0);
    expect(await newer.outbox.count()).toBe(0);
  });

  it('asks for a reload in both cases, instead of the rescue screen', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const older = freshDb();
    watchStore(older);
    await older.open();
    expect(storeHealth()).toEqual({ state: 'open' });
    await newerBuild(older.name).open();
    expect(storeHealth()).toEqual({ state: 'replaced' });

    const late = freshDb(older.name);
    watchStore(late);
    await late.open().catch(() => undefined);
    await Promise.resolve();
    expect(storeHealth()).toEqual({ state: 'replaced' });
  });
});
