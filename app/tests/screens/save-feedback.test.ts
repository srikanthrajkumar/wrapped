// Required test (constitution IV; T048d, design D15, eng D5 and D6): a failed write never looks
// saved, keeps the value as entered until a retry succeeds, and its value reaches a rescue
// Export without touching the database. Run against a real store whose writes reject.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { unresolvedValue } from '../../src/model';
import { offersUpdate } from '../../src/screens/update-offer';
import { NOT_SAVED_PREFIX, SaveFeedback, SETTLE_MS } from '../../src/screens/save-feedback';
import { createEvent } from '../../src/store/events';
import { buildExport } from '../../src/store/export';
import { addItem, editItem, setDetail } from '../../src/store/items';
import { freshDb } from '../helpers';

/** A store whose Item writes fail while `failing` is set, as a full disk would. */
async function storeWithItem() {
  const db = freshDb();
  const event = await createEvent({ kind: 'concert' }, { db });
  const item = await addItem(event.id, { title: 'Varnam' }, { db });
  const disk = { failing: false };
  db.items.hook('updating', () => {
    if (disk.failing) throw new Error('disk full');
  });
  return { db, item, disk };
}

/** A write whose settling the test controls. */
function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('save feedback (required)', () => {
  it('shows saved only once the write to the phone succeeded', async () => {
    const { db, item } = await storeWithItem();
    const feedback = new SaveFeedback();
    const target = { table: 'items', id: item.id, field: 'tala' } as const;
    const value = unresolvedValue('Adi');

    const saving = feedback.track(target, value, () => setDetail(item.id, 'tala', value, { db }));
    expect(feedback.get(target)?.status).toBe('saving');
    expect(feedback.shown(target, item.tala)).toEqual(value);

    await saving;
    expect(feedback.get(target)?.status).toBe('saved');
    expect((await db.items.get(item.id))?.tala).toEqual(value);
  });

  it('keeps a failed value on screen as "not saved", never saved, until a retry works', async () => {
    const { db, item, disk } = await storeWithItem();
    const feedback = new SaveFeedback();
    const target = { table: 'items', id: item.id, field: 'title' } as const;
    disk.failing = true;

    const result = await feedback.track(target, 'Viriboni', () =>
      editItem(item.id, { title: 'Viriboni' }, { db }),
    );

    expect(result).toBeUndefined();
    expect(feedback.get(target)).toMatchObject({ status: 'failed', value: 'Viriboni' });
    expect(feedback.shown(target, 'Varnam')).toBe('Viriboni');
    expect((await db.items.get(item.id))?.title).toBe('Varnam');
    expect(feedback.hasFailures(item.id)).toBe(true);

    // Still failing: still not saved.
    await feedback.retry(target);
    expect(feedback.get(target)?.status).toBe('failed');

    disk.failing = false;
    await feedback.retry(target);
    expect(feedback.get(target)?.status).toBe('saved');
    expect((await db.items.get(item.id))?.title).toBe('Viriboni');
    expect(feedback.hasFailures()).toBe(false);
  });

  it('lets the latest edit of a field decide, whatever order the writes settle in', async () => {
    const feedback = new SaveFeedback();
    const target = { table: 'items', id: 'i1', field: 'title' } as const;
    const first = deferred();
    const second = deferred();

    const a = feedback.track(target, 'A', () => first.promise);
    const b = feedback.track(target, 'B', () => second.promise);
    // The newer edit succeeds first; the older one's failure arrives late and changes nothing.
    second.resolve('B');
    await b;
    first.reject(new Error('disk full'));
    await a;
    expect(feedback.get(target)?.status).toBe('saved');
    expect(feedback.notSaved()).toEqual([]);

    // The older edit succeeds, the newer fails: the newer value stays, not saved.
    const third = deferred();
    const fourth = deferred();
    const c = feedback.track(target, 'C', () => third.promise);
    const d = feedback.track(target, 'D', () => fourth.promise);
    third.resolve('C');
    await c;
    expect(feedback.get(target)?.status).toBe('saving');
    fourth.reject(new Error('disk full'));
    await d;
    expect(feedback.get(target)).toMatchObject({ status: 'failed', value: 'D' });
  });

  it('keeps a failure on one field while another field saves', async () => {
    const feedback = new SaveFeedback();
    const title = { table: 'items', id: 'i1', field: 'title' } as const;
    const tala = { table: 'items', id: 'i1', field: 'tala' } as const;
    await feedback.track(title, 'A', () => Promise.reject(new Error('disk full')));
    await feedback.track(tala, 'Adi', () => Promise.resolve('ok'));
    expect(feedback.get(title)?.status).toBe('failed');
    expect(feedback.get(tala)?.status).toBe('saved');
  });

  it('clears a failure when a later edit of the same field saves', async () => {
    const feedback = new SaveFeedback();
    const target = { table: 'items', id: 'i1', field: 'title' } as const;
    await feedback.track(target, 'A', () => Promise.reject(new Error('disk full')));
    await feedback.track(target, 'B', () => Promise.resolve('ok'));
    expect(feedback.get(target)?.status).toBe('saved');
    expect(feedback.notSaved()).toEqual([]);
  });

  it('gives each successful write its own highlight', async () => {
    const feedback = new SaveFeedback();
    const target = { table: 'items', id: 'i1', field: 'title' } as const;
    await feedback.track(target, 'A', () => Promise.resolve('ok'));
    const first = feedback.get(target)!.edit;
    await feedback.track(target, 'B', () => Promise.resolve('ok'));
    expect(feedback.get(target)!.edit).toBeGreaterThan(first);
  });

  it('exports the stored season plus the values that failed, while writes still fail', async () => {
    const { db, item, disk } = await storeWithItem();
    const feedback = new SaveFeedback();
    disk.failing = true;
    const value = unresolvedValue('Khanda Chapu');
    await feedback.track({ table: 'items', id: item.id, field: 'tala' }, value, () =>
      setDetail(item.id, 'tala', value, { db }),
    );

    const file = await buildExport({ db, appVersion: 'test', notSaved: feedback.notSaved() });

    expect(file.items).toHaveLength(1);
    expect(file.notSaved).toEqual([
      { table: 'items', id: item.id, field: 'tala', value, enteredAt: expect.any(String) },
    ]);
    // The stored Item is untouched: the rescue never wrote anything.
    expect((file.items[0] as { tala: unknown }).tala).toEqual(item.tala);
  });

  it('copies a failed value to storage, and drops it once it saves', async () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    const target = { table: 'items', id: 'i1', field: 'tala' } as const;
    await feedback.track(target, 'Adi', () => Promise.reject(new Error('disk full')));

    expect(storage.copies()).toEqual([{ ...target, value: 'Adi', enteredAt: expect.any(String) }]);

    await feedback.track(target, 'Adi', () => Promise.resolve('ok'));
    expect(storage.copies()).toEqual([]);
  });

  it('after a relaunch, offers the copied values for Export, with nothing to replay', async () => {
    const storage = memoryStorage();
    const before = new SaveFeedback({ storage });
    const target = { table: 'events', id: 'new-1', field: '*' } as const;
    await before.track(target, 'concert', () => Promise.reject(new Error('disk full')));

    const after = new SaveFeedback({ storage });

    expect(after.notSaved()).toEqual(before.notSaved());
    expect(after.hasFailures()).toBe(true);
    expect(after.canRetry(target)).toBe(false);
    await after.retryAll();
    expect(after.notSaved()).toHaveLength(1);
  });

  it('A1: after a relaunch, copied values hold back no update, and Clear removes them once exported', async () => {
    const storage = memoryStorage();
    const target = { table: 'events', id: 'new-1', field: '*' } as const;
    await new SaveFeedback({ storage }).track(target, 'concert', () =>
      Promise.reject(new Error('disk full')),
    );
    const base = { available: true, later: false, logging: false };

    // Relaunch: the value is still there, for Export, but no write is waiting to be replayed,
    // so a reload loses nothing and the update is offered again.
    const after = new SaveFeedback({ storage });
    expect(after.notSaved()).toHaveLength(1);
    expect(offersUpdate({ ...base, unsaved: after.hasRetryableFailures() })).toBe(true);

    // Clear only once an Export has held it.
    expect(after.canClear(target)).toBe(false);
    after.markExported(after.notSaved());
    expect(after.canClear(target)).toBe(true);
    after.clear([target]);
    expect(after.notSaved()).toEqual([]);
    expect(storage.copies()).toEqual([]);
    expect(after.unshown()).toEqual([]);
  });

  it('A1: a write the rules refuse is not offered again, and holds back no update', async () => {
    const feedback = new SaveFeedback();
    const target = { table: 'items', id: 'i1', field: '*' } as const;
    const refused = Object.assign(new Error('item id i1 is already used'), { name: 'RuleError' });
    await feedback.track(target, 'Varnam', () => Promise.reject(refused));

    expect(feedback.get(target)?.status).toBe('failed');
    expect(feedback.canRetry(target)).toBe(false);
    expect(feedback.hasRetryableFailures()).toBe(false);
  });

  it('A1: a failure that Try again can still save holds back the update', async () => {
    const feedback = new SaveFeedback();
    await feedback.track({ table: 'items', id: 'i1', field: 'tala' }, 'Adi', () =>
      Promise.reject(new Error('disk full')),
    );
    expect(feedback.hasRetryableFailures()).toBe(true);
  });

  it('A2: keeps the copy while a retry is in flight, so a force-close then loses nothing', async () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    const target = { table: 'items', id: 'i1', field: 'tala' } as const;
    let attempts = 0;
    // The first write fails; the retry never settles: the page is killed while it runs.
    const write = () =>
      ++attempts === 1 ? Promise.reject(new Error('disk full')) : new Promise<never>(() => {});
    await feedback.track(target, 'Adi', write);

    void feedback.retry(target);
    expect(feedback.get(target)?.status).toBe('saving');

    const relaunched = new SaveFeedback({ storage });
    expect(relaunched.notSaved()).toEqual([
      { ...target, value: 'Adi', enteredAt: expect.any(String) },
    ]);
  });

  it('A2: copies typed text at once, before any write starts, and lets it go if unchanged', () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    const target = { table: 'events', id: 'e1', field: 'note' } as const;

    feedback.hold(target, 'Tisram');
    expect(new SaveFeedback({ storage }).notSaved()).toEqual([
      { ...target, value: 'Tisram', enteredAt: expect.any(String) },
    ]);
    // The field shows its own typing; the stored value is what a save is compared with.
    expect(feedback.shown(target, null)).toBeNull();

    feedback.release(target);
    expect(storage.copies()).toEqual([]);
  });

  it('A4: an attempt that succeeds supersedes the failed attempts of the same intent', async () => {
    const feedback = new SaveFeedback();
    const made: string[] = [];
    const logNow = (id: string, fail: boolean) =>
      feedback.track(
        { table: 'events', id, field: '*' },
        'concert',
        () => (fail ? Promise.reject(new Error('disk full')) : Promise.resolve(made.push(id))),
        { intent: 'log-now' },
      );
    await logNow('c1', true);
    await logNow('c2', true);
    await logNow('c3', false);

    expect(feedback.notSaved()).toEqual([]);
    await feedback.retryAll();
    expect(made).toEqual(['c3']);
  });

  it('A4: Try again replays one attempt of each intent', async () => {
    const feedback = new SaveFeedback();
    const made: string[] = [];
    let failing = true;
    const logNow = (id: string) =>
      feedback.track(
        { table: 'events', id, field: '*' },
        'concert',
        () => (failing ? Promise.reject(new Error('disk full')) : Promise.resolve(made.push(id))),
        { intent: 'log-now' },
      );
    await logNow('c1');
    await logNow('c2');
    expect(feedback.unshown()).toHaveLength(2);

    failing = false;
    await feedback.retryAll(feedback.unshown());
    expect(made).toEqual(['c2']);
    expect(feedback.notSaved()).toEqual([]);
  });

  it('A8: shows a just-saved value until the stored one catches up', async () => {
    vi.useFakeTimers();
    const feedback = new SaveFeedback();
    const target = { table: 'events', id: 'e1', field: 'note' } as const;
    await feedback.track(target, 'Tisram', () => Promise.resolve('ok'));

    // The screen still holds the record read before the write: the saved text stays.
    expect(feedback.shown(target, 'old')).toBe('Tisram');
    expect(feedback.shown(target, 'Tisram')).toBe('Tisram');
    // A different value that arrives later (another tab) wins once the moment has passed.
    vi.advanceTimersByTime(SETTLE_MS);
    expect(feedback.shown(target, 'from another tab')).toBe('from another tab');
  });

  it("B1: two tabs keep each other's copies, and hear of each other's", async () => {
    const storage = memoryStorage();
    const first = new SaveFeedback({ storage, listen: storage.listen });
    const second = new SaveFeedback({ storage, listen: storage.listen });
    const fail = () => Promise.reject(new Error('disk full'));
    const tala = { table: 'items', id: 'i1', field: 'tala' } as const;
    const note = { table: 'events', id: 'e1', field: 'note' } as const;
    await first.track(tala, 'Adi', fail);
    await second.track(note, 'Tisram', fail);

    expect(storage.copies().map((copy) => copy.field)).toEqual(['tala', 'note']);
    expect(first.notSaved().map((entry) => entry.field)).toEqual(['tala', 'note']);

    await second.track(note, 'Tisram', () => Promise.resolve('ok'));
    expect(first.notSaved().map((entry) => entry.field)).toEqual(['tala']);
  });

  it('B4: a damaged copy is skipped, and the rest still load', () => {
    const storage = memoryStorage();
    storage.setItem(`${NOT_SAVED_PREFIX}bad`, '{not json');
    storage.setItem(`${NOT_SAVED_PREFIX}wrong`, JSON.stringify({ table: 3, id: null }));
    storage.setItem(
      `${NOT_SAVED_PREFIX}items:i1:tala`,
      JSON.stringify({ table: 'items', id: 'i1', field: 'tala', value: 'Adi', enteredAt: 'x' }),
    );
    // The unversioned list an earlier build wrote is read once, then moved.
    storage.setItem('wrapped.notSaved', JSON.stringify([{ table: 'items', id: 'i2' }, 7]));

    const feedback = new SaveFeedback({ storage });
    expect(feedback.notSaved()).toEqual([
      { table: 'items', id: 'i1', field: 'tala', value: 'Adi', enteredAt: 'x' },
    ]);
    expect(storage.getItem('wrapped.notSaved')).toBeNull();
  });

  it('B3: Try again tells the write which fields were saved since it failed', async () => {
    const feedback = new SaveFeedback();
    const pick = { table: 'items', id: 'i1', field: 'pick' } as const;
    const seen: string[][] = [];
    let failing = true;
    await feedback.track(pick, 'Bhavayami', (replay) => {
      seen.push(replay?.changedSince ?? []);
      return failing ? Promise.reject(new Error('disk full')) : Promise.resolve('ok');
    });
    await feedback.track({ table: 'items', id: 'i1', field: 'tala' }, 'Adi', () =>
      Promise.resolve('ok'),
    );
    failing = false;
    await feedback.retry(pick);
    expect(seen).toEqual([[], ['tala']]);
  });

  it('drops copied values the store already holds, after a relaunch', async () => {
    const storage = memoryStorage();
    const before = new SaveFeedback({ storage });
    const fail = () => Promise.reject(new Error('disk full'));
    await before.track({ table: 'events', id: 'c1', field: '*' }, 'concert', fail);
    await before.track({ table: 'events', id: 'c2', field: '*' }, 'concert', fail);
    await before.track({ table: 'items', id: 'i1', field: 'title' }, 'Varnam', fail);

    const after = new SaveFeedback({ storage });
    // The page was killed after c1 and the title committed, before they were marked saved.
    const store: Record<string, Record<string, unknown>> = {
      'events/c1': { id: 'c1', deletedAt: null },
      'items/i1': { id: 'i1', title: 'Varnam', deletedAt: null },
    };
    await after.reconcile(async (table, id) => store[`${table}/${id}`]);
    expect(after.notSaved().map((entry) => entry.id)).toEqual(['c2']);
  });

  it('counts the failures no screen is showing, for the season-wide line', async () => {
    const feedback = new SaveFeedback();
    const shown = { table: 'items', id: 'i1', field: 'tala' } as const;
    const hidden = { table: 'appearances', id: 'new-1', field: '*' } as const;
    const fail = () => Promise.reject(new Error('disk full'));
    await feedback.track(shown, 'Adi', fail);
    await feedback.track(hidden, 'T M Krishna', fail);

    const stop = feedback.showing([shown]);
    expect(feedback.unshown()).toEqual([hidden]);

    stop();
    expect(feedback.unshown()).toEqual([shown, hidden]);
  });

  it('keeps each attempt of a new record apart, so a second failure never hides the first', async () => {
    const feedback = new SaveFeedback();
    const fail = () => Promise.reject(new Error('disk full'));
    await feedback.track({ table: 'appearances', id: 'a1', field: '*' }, 'Vocal', fail);
    await feedback.track({ table: 'appearances', id: 'a2', field: '*' }, 'Violin', fail);
    expect(feedback.notSaved().map((entry) => entry.value)).toEqual(['Vocal', 'Violin']);
  });
});

/** localStorage as two tabs share it: per-key values and the `storage` event to the other tabs. */
function memoryStorage() {
  const values = new Map<string, string>();
  const tabs = new Set<(key: string, value: string | null) => void>();
  const tell = (key: string, value: string | null) => tabs.forEach((tab) => tab(key, value));
  return {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
      tell(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
      tell(key, null);
    },
    /** Each tab hears the others' changes (the browser never tells a tab of its own). */
    listen(onChange: (key: string, value: string | null) => void) {
      const own = onChange;
      // Changes are delivered after the writing call returns, as the browser does.
      tabs.add((key, value) => queueMicrotask(() => own(key, value)));
    },
    copies: () =>
      [...values.entries()]
        .filter(([key]) => key.startsWith(NOT_SAVED_PREFIX))
        .map(([, value]) => JSON.parse(value) as Record<string, unknown>),
  };
}
