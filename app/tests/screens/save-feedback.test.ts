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
    expect(feedback.unshown()).toEqual([target]);

    // Still failing: still not saved.
    await feedback.retry(target);
    expect(feedback.get(target)?.status).toBe('failed');

    disk.failing = false;
    await feedback.retry(target);
    expect(feedback.get(target)?.status).toBe('saved');
    expect((await db.items.get(item.id))?.title).toBe('Viriboni');
    expect(feedback.unshown()).toEqual([]);
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
      {
        table: 'items',
        id: item.id,
        field: 'tala',
        value,
        enteredAt: expect.any(String),
        state: 'failed',
      },
    ]);
    // The stored Item is untouched: the rescue never wrote anything.
    expect((file.items[0] as { tala: unknown }).tala).toEqual(item.tala);
  });

  it('copies a failed value to storage, and drops it once it saves', async () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    const target = { table: 'items', id: 'i1', field: 'tala' } as const;
    await feedback.track(target, 'Adi', () => Promise.reject(new Error('disk full')));

    expect(storage.copies()).toEqual([
      expect.objectContaining({ ...target, value: 'Adi', enteredAt: expect.any(String) }),
    ]);

    await feedback.track(target, 'Adi', () => Promise.resolve('ok'));
    expect(storage.copies()).toEqual([]);
  });

  it('after a relaunch, offers the copied values for Export, with nothing to replay', async () => {
    const storage = memoryStorage();
    const before = new SaveFeedback({ storage });
    const target = { table: 'events', id: 'new-1', field: '*' } as const;
    await before.track(target, 'concert', () => Promise.reject(new Error('disk full')), {
      kind: 'create',
    });

    const after = new SaveFeedback({ storage });

    expect(after.notSaved()).toEqual(before.notSaved());
    expect(after.unshown()).toEqual([target]);
    expect(after.canRetry(target)).toBe(false);
    await after.retryAll([target]);
    expect(after.notSaved()).toHaveLength(1);
  });

  it('after a relaunch, copied values hold back no update; Clear takes what a saved Export holds', async () => {
    const storage = memoryStorage();
    const target = { table: 'events', id: 'new-1', field: '*' } as const;
    await new SaveFeedback({ storage }).track(
      target,
      { kind: 'concert' },
      () => Promise.reject(new Error('disk full')),
      { kind: 'create' },
    );
    const base = { available: true, later: false, logging: false };

    const after = new SaveFeedback({ storage });
    expect(after.notSaved()).toHaveLength(1);
    expect(offersUpdate({ ...base, unsaved: after.hasRetryableFailures() })).toBe(true);

    const file = after.notSaved();
    expect(after.canClear(target, [])).toBe(false);
    expect(after.canClear(target, file)).toBe(true);
    after.clearSaved(file);
    expect(after.notSaved()).toEqual([]);
    expect(storage.copies()).toEqual([]);
  });

  it('a write the rules refuse is not offered again, and holds back no update', async () => {
    const feedback = new SaveFeedback();
    const target = { table: 'items', id: 'i1', field: '*' } as const;
    const refused = Object.assign(new Error('item id i1 is already used'), { name: 'RuleError' });
    await feedback.track(target, 'Varnam', () => Promise.reject(refused), { kind: 'create' });

    expect(feedback.get(target)?.status).toBe('failed');
    expect(feedback.canRetry(target)).toBe(false);
    expect(feedback.hasRetryableFailures()).toBe(false);
  });

  it('a failure that Try again can still save holds back the update', async () => {
    const feedback = new SaveFeedback();
    await feedback.track({ table: 'items', id: 'i1', field: 'tala' }, 'Adi', () =>
      Promise.reject(new Error('disk full')),
    );
    expect(feedback.hasRetryableFailures()).toBe(true);
  });

  it('keeps the copy while a retry is in flight, so a force-close then loses nothing', async () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    const target = { table: 'items', id: 'i1', field: 'tala' } as const;
    let attempts = 0;
    const write = () =>
      ++attempts === 1 ? Promise.reject(new Error('disk full')) : new Promise<never>(() => {});
    await feedback.track(target, 'Adi', write);

    void feedback.retry(target);
    expect(feedback.get(target)?.status).toBe('saving');
    const relaunched = new SaveFeedback({ storage });
    expect(relaunched.notSaved()).toEqual([expect.objectContaining({ ...target, value: 'Adi' })]);
  });

  it('copies typed text at once, before any write starts, and lets it go if unchanged', () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    const target = { table: 'events', id: 'e1', field: 'note' } as const;

    feedback.hold(target, 'Tisram');
    expect(new SaveFeedback({ storage }).notSaved()).toEqual([
      expect.objectContaining({ ...target, value: 'Tisram' }),
    ]);
    expect(feedback.shown(target, null)).toBeNull();

    feedback.release(target);
    expect(storage.copies()).toEqual([]);
  });

  it('third review: Export carries typed and in-flight values too, not only failed ones', async () => {
    const feedback = new SaveFeedback();
    feedback.hold({ table: 'events', id: 'e1', field: 'note' }, 'Tisram');
    void feedback.track(
      { table: 'items', id: 'i1', field: 'tala' },
      'Adi',
      () => new Promise(() => {}),
    );
    expect(feedback.notSaved().map((entry) => [entry.field, entry.state])).toEqual([
      ['note', 'typed'],
      ['tala', 'saving'],
    ]);
  });

  it('third review: an entry leaves only once the store is seen holding its value', async () => {
    const storage = memoryStorage();
    const held = new Map<string, boolean>([['tala', false]]);
    const feedback = new SaveFeedback({
      storage,
      confirm: async (entry) => held.get(entry.field) ?? true,
    });
    const tala = { table: 'items', id: 'i1', field: 'tala' } as const;
    await feedback.track(tala, 'Adi', () => Promise.resolve('ok'));

    // The write said it succeeded, but the store doesn't hold the value: it stays for Export.
    expect(feedback.get(tala)?.status).toBe('saved');
    expect(storage.copies()).toEqual([expect.objectContaining({ field: 'tala', value: 'Adi' })]);

    held.set('tala', true);
    await feedback.reconcile();
    expect(storage.copies()).toEqual([]);
  });

  it('third review: a later Concert that saves leaves an earlier failed one in place', async () => {
    const feedback = new SaveFeedback();
    const logNow = (id: string, fail: boolean) =>
      feedback.track(
        { table: 'events', id, field: '*' },
        { kind: 'concert' },
        () => (fail ? Promise.reject(new Error('disk full')) : Promise.resolve(id)),
        { kind: 'create' },
      );
    await logNow('c1', true);
    await logNow('c2', false);
    expect(feedback.notSaved().map((entry) => entry.id)).toEqual(['c1']);
  });

  it('third review: a failed move or repick is not retried', async () => {
    const feedback = new SaveFeedback();
    const fail = () => Promise.reject(new Error('disk full'));
    const move = { table: 'items', id: 'i1', field: 'position' } as const;
    const pick = { table: 'items', id: 'i1', field: 'pick' } as const;
    await feedback.track(move, 2, fail, { kind: 'move' });
    await feedback.track(pick, { label: 'Bhavayami' }, fail, { kind: 'repick' });

    expect(feedback.canRetry(move)).toBe(false);
    expect(feedback.canRetry(pick)).toBe(false);
    expect(feedback.hasRetryableFailures()).toBe(false);
    // The pick stays for Export; a move is nothing typed, so it isn't kept.
    expect(feedback.notSaved().map((entry) => entry.field)).toEqual(['pick']);
  });

  it('third review: Try again writes one entry at a time, in the order entered', async () => {
    const feedback = new SaveFeedback();
    const log: string[] = [];
    let failing = true;
    const write = (name: string) => async () => {
      log.push(`start ${name}`);
      await Promise.resolve();
      log.push(`end ${name}`);
      if (failing) throw new Error('disk full');
    };
    const tala = { table: 'items', id: 'i1', field: 'tala' } as const;
    const nadai = { table: 'items', id: 'i1', field: 'nadai' } as const;
    await feedback.track(tala, 'Adi', write('tala'));
    await feedback.track(nadai, 'khanda', write('nadai'));
    log.length = 0;

    failing = false;
    await feedback.retryAll([nadai, tala]);
    expect(log).toEqual(['start tala', 'end tala', 'start nadai', 'end nadai']);
  });

  it('third review: Clear matches what the Export held, value and time, never the field alone', async () => {
    const feedback = new SaveFeedback();
    const target = { table: 'events', id: 'new-1', field: '*' } as const;
    const refused = Object.assign(new Error('event id new-1 is already used'), {
      name: 'RuleError',
    });
    await feedback.track(target, { at: 'A' }, () => Promise.reject(refused), { kind: 'create' });
    const file = feedback.notSaved();
    // While the file was being handed over, the same field failed again with another value.
    await feedback.track(target, { at: 'B' }, () => Promise.reject(refused), { kind: 'create' });

    expect(feedback.canClear(target, file)).toBe(false);
    feedback.clearSaved(file);
    expect(feedback.notSaved()).toEqual([expect.objectContaining({ value: { at: 'B' } })]);
  });

  it('third review: values written by another visit come in when the page is shown again', () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    new SaveFeedback({ storage }).hold({ table: 'events', id: 'e1', field: 'note' }, 'Tisram');

    feedback.reload();
    expect(feedback.notSaved()).toEqual([expect.objectContaining({ value: 'Tisram' })]);
  });

  it('a shown just-saved value stays until the stored one catches up', async () => {
    vi.useFakeTimers();
    const feedback = new SaveFeedback();
    const target = { table: 'events', id: 'e1', field: 'note' } as const;
    await feedback.track(target, 'Tisram', () => Promise.resolve('ok'));

    expect(feedback.shown(target, 'old')).toBe('Tisram');
    vi.advanceTimersByTime(SETTLE_MS);
    expect(feedback.shown(target, 'from elsewhere')).toBe('from elsewhere');
  });

  it('a damaged copy is skipped, and the rest still load', () => {
    const storage = memoryStorage();
    storage.setItem(`${NOT_SAVED_PREFIX}bad`, '{not json');
    storage.setItem(`${NOT_SAVED_PREFIX}wrong`, JSON.stringify({ table: 3, id: null }));
    storage.setItem(
      `${NOT_SAVED_PREFIX}items:i1:tala`,
      JSON.stringify({ table: 'items', id: 'i1', field: 'tala', value: 'Adi', enteredAt: 'x' }),
    );
    const feedback = new SaveFeedback({ storage });
    expect(feedback.notSaved()).toEqual([
      expect.objectContaining({ table: 'items', id: 'i1', field: 'tala', value: 'Adi' }),
    ]);
  });
});

/** localStorage, per key. */
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    copies: () =>
      [...values.entries()]
        .filter(([key]) => key.startsWith(NOT_SAVED_PREFIX))
        .map(([, value]) => JSON.parse(value) as Record<string, unknown>),
  };
}
