// Required test (constitution IV; T048d, design D15, eng D5 and D6): a failed write never looks
// saved, keeps the value as entered until a retry succeeds, and its value reaches a rescue
// Export without touching the database. Run against a real store whose writes reject.

import { describe, expect, it } from 'vitest';
import { unresolvedValue } from '../../src/model';
import { NOT_SAVED_KEY, SaveFeedback } from '../../src/screens/save-feedback';
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

    expect(JSON.parse(storage.getItem(NOT_SAVED_KEY)!)).toEqual([
      { ...target, value: 'Adi', enteredAt: expect.any(String) },
    ]);

    await feedback.track(target, 'Adi', () => Promise.resolve('ok'));
    expect(storage.getItem(NOT_SAVED_KEY)).toBeNull();
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

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}
