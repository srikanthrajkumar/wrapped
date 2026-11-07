// Required test (constitution IV; T048d, design D15, eng D5 and D6): a failed write never looks
// saved, keeps the value as entered until a retry succeeds, and its value reaches a rescue
// Export without touching the database. Run against a real store whose writes reject.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { unresolvedValue } from '../../src/model';
import { offersUpdate } from '../../src/screens/update-offer';
import { NOT_SAVED_PREFIX, SaveFeedback } from '../../src/screens/save-feedback';
import { reloadLoses } from '../../src/screens/update-offer';
import { createEvent } from '../../src/store/events';
import { buildExport } from '../../src/store/export';
import { addItem, editItem, removeItem, setDetail } from '../../src/store/items';
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

/** The store holds whatever a write that succeeded wrote. */
const stored = async () => true;

afterEach(() => {
  vi.useRealTimers();
});

describe('save feedback (required)', () => {
  it('shows saved only once the write to the phone succeeded', async () => {
    const { db, item } = await storeWithItem();
    const feedback = new SaveFeedback({ confirm: stored });
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
    const feedback = new SaveFeedback({ confirm: stored });
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
    const feedback = new SaveFeedback({ confirm: stored });
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
    const feedback = new SaveFeedback({ confirm: stored });
    const title = { table: 'items', id: 'i1', field: 'title' } as const;
    const tala = { table: 'items', id: 'i1', field: 'tala' } as const;
    await feedback.track(title, 'A', () => Promise.reject(new Error('disk full')));
    await feedback.track(tala, 'Adi', () => Promise.resolve('ok'));
    expect(feedback.get(title)?.status).toBe('failed');
    expect(feedback.get(tala)?.status).toBe('saved');
  });

  it('clears a failure when a later edit of the same field saves', async () => {
    const feedback = new SaveFeedback({ confirm: stored });
    const target = { table: 'items', id: 'i1', field: 'title' } as const;
    await feedback.track(target, 'A', () => Promise.reject(new Error('disk full')));
    await feedback.track(target, 'B', () => Promise.resolve('ok'));
    expect(feedback.get(target)?.status).toBe('saved');
    expect(feedback.notSaved()).toEqual([]);
  });

  it('gives each successful write its own highlight', async () => {
    const feedback = new SaveFeedback({ confirm: stored });
    const target = { table: 'items', id: 'i1', field: 'title' } as const;
    await feedback.track(target, 'A', () => Promise.resolve('ok'));
    const first = feedback.get(target)!.edit;
    await feedback.track(target, 'B', () => Promise.resolve('ok'));
    expect(feedback.get(target)!.edit).toBeGreaterThan(first);
  });

  it('exports the stored season plus the values that failed, while writes still fail', async () => {
    const { db, item, disk } = await storeWithItem();
    const feedback = new SaveFeedback({ confirm: stored });
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
    const feedback = new SaveFeedback({ storage, confirm: stored });
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
    const before = new SaveFeedback({ storage, confirm: stored });
    const target = { table: 'events', id: 'new-1', field: '*' } as const;
    await before.track(target, 'concert', () => Promise.reject(new Error('disk full')), {});

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
    await new SaveFeedback({ storage, confirm: stored }).track(target, { kind: 'concert' }, () =>
      Promise.reject(new Error('disk full')),
    );
    const base = { available: true, later: false, logging: false };

    const after = new SaveFeedback({ storage });
    expect(after.notSaved()).toHaveLength(1);
    expect(offersUpdate({ ...base, unsaved: after.hasRetryableFailures() })).toBe(true);

    const file = after.notSaved();
    expect(after.canClear(target, [])).toBe(false);
    expect(after.canClear(target, file)).toBe(true);
    after.clearSaved(file, [target]);
    expect(after.notSaved()).toEqual([]);
    expect(storage.copies()).toEqual([]);
  });

  it('a write the rules refuse is not offered again, and holds back no update', async () => {
    const feedback = new SaveFeedback({ confirm: stored });
    const target = { table: 'items', id: 'i1', field: '*' } as const;
    const refused = Object.assign(new Error('item id i1 is already used'), { name: 'RuleError' });
    await feedback.track(target, 'Varnam', () => Promise.reject(refused), {});

    expect(feedback.get(target)?.status).toBe('failed');
    expect(feedback.canRetry(target)).toBe(false);
    expect(feedback.hasRetryableFailures()).toBe(false);
  });

  it('a failure that Try again can still save holds back the update', async () => {
    const feedback = new SaveFeedback({ confirm: stored });
    await feedback.track({ table: 'items', id: 'i1', field: 'tala' }, 'Adi', () =>
      Promise.reject(new Error('disk full')),
    );
    expect(feedback.hasRetryableFailures()).toBe(true);
  });

  it('keeps the copy while a retry is in flight, so a force-close then loses nothing', async () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage, confirm: stored });
    const target = { table: 'items', id: 'i1', field: 'tala' } as const;
    let attempts = 0;
    const write = () =>
      ++attempts === 1 ? Promise.reject(new Error('disk full')) : new Promise<never>(() => {});
    await feedback.track(target, 'Adi', write);

    void feedback.retry(target);
    expect(feedback.get(target)?.status).toBe('saving');
    const relaunched = new SaveFeedback({ storage, confirm: stored });
    expect(relaunched.notSaved()).toEqual([expect.objectContaining({ ...target, value: 'Adi' })]);
  });

  it('copies typed text at once, before any write starts, and lets it go if unchanged', () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage, confirm: stored });
    const target = { table: 'events', id: 'e1', field: 'note' } as const;

    feedback.hold(target, 'Tisram');
    expect(new SaveFeedback({ storage, confirm: stored }).notSaved()).toEqual([
      expect.objectContaining({ ...target, value: 'Tisram' }),
    ]);
    expect(feedback.shown(target, null)).toBeNull();

    feedback.release(target);
    expect(storage.copies()).toEqual([]);
  });

  it('third review: Export carries typed and in-flight values too, not only failed ones', async () => {
    const feedback = new SaveFeedback({ confirm: stored });
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
    const feedback = new SaveFeedback({ confirm: stored });
    const logNow = (id: string, fail: boolean) =>
      feedback.track({ table: 'events', id, field: '*' }, { kind: 'concert' }, () =>
        fail ? Promise.reject(new Error('disk full')) : Promise.resolve(id),
      );
    await logNow('c1', true);
    await logNow('c2', false);
    expect(feedback.notSaved().map((entry) => entry.id)).toEqual(['c1']);
  });

  it('third review: a failed move or repick is not retried', async () => {
    const feedback = new SaveFeedback({ confirm: stored });
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
    const feedback = new SaveFeedback({ confirm: stored });
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
    const feedback = new SaveFeedback({ confirm: stored });
    const target = { table: 'events', id: 'new-1', field: '*' } as const;
    const refused = Object.assign(new Error('event id new-1 is already used'), {
      name: 'RuleError',
    });
    await feedback.track(target, { at: 'A' }, () => Promise.reject(refused), {});
    const file = feedback.notSaved();
    // While the file was being handed over, the same field failed again with another value.
    await feedback.track(target, { at: 'B' }, () => Promise.reject(refused), {});

    expect(feedback.canClear(target, file)).toBe(false);
    feedback.clearSaved(file, [target]);
    expect(feedback.notSaved()).toEqual([expect.objectContaining({ value: { at: 'B' } })]);
  });

  it('third review: values written by another visit come in when the page is shown again', () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage, confirm: stored });
    new SaveFeedback({ storage, confirm: stored }).hold(
      { table: 'events', id: 'e1', field: 'note' },
      'Tisram',
    );

    feedback.reload();
    expect(feedback.notSaved()).toEqual([expect.objectContaining({ value: 'Tisram' })]);
  });

  it('a damaged copy is skipped, and the rest still load', () => {
    const storage = memoryStorage();
    storage.setItem(`${NOT_SAVED_PREFIX}bad`, '{not json');
    storage.setItem(`${NOT_SAVED_PREFIX}wrong`, JSON.stringify({ table: 3, id: null }));
    storage.setItem(
      `${NOT_SAVED_PREFIX}items:i1:tala`,
      JSON.stringify({ table: 'items', id: 'i1', field: 'tala', value: 'Adi', enteredAt: 'x' }),
    );
    const feedback = new SaveFeedback({ storage, confirm: stored });
    expect(feedback.notSaved()).toEqual([
      expect.objectContaining({ table: 'items', id: 'i1', field: 'tala', value: 'Adi' }),
    ]);
  });
});

describe('save feedback, fourth review (required)', () => {
  const fail = () => Promise.reject(new Error('disk full'));

  it('a saved value stays shown until the store is seen holding it, however slow', async () => {
    vi.useFakeTimers();
    const feedback = new SaveFeedback();
    const target = { table: 'events', id: 'e1', field: 'note' } as const;
    await feedback.track(target, 'Tisram', () => Promise.resolve('ok'));

    // A slow phone: the screen still reads the note from before the write, 5 s on.
    vi.advanceTimersByTime(5000);
    expect(feedback.shown(target, 'old')).toBe('Tisram');
    // Once the screen has read it back, a later change (an Undo, another tab) shows.
    expect(feedback.shown(target, 'Tisram')).toBe('Tisram');
    expect(feedback.shown(target, 'from elsewhere')).toBe('from elsewhere');
  });

  it('text typed back to what is stored, while a write is in flight, still has to be written', async () => {
    const feedback = new SaveFeedback();
    const target = { table: 'events', id: 'e1', field: 'note' } as const;
    const write = deferred();
    void feedback.track(target, 'Tisram!', () => write.promise);
    // Typed back to the stored "Tisram" before the write for "Tisram!" settled.
    feedback.hold(target, 'Tisram');

    expect(feedback.release(target)).toBe(false);
    expect(feedback.notSaved().map((entry) => entry.value)).toEqual(['Tisram']);
    write.resolve('ok');
  });

  it('Try again on a line runs once, however many taps, and stops at the first failure', async () => {
    const feedback = new SaveFeedback();
    const writes: string[] = [];
    let failing = true;
    const write = (name: string) => async () => {
      writes.push(name);
      await Promise.resolve();
      if (failing || name === 'tala') throw new Error('disk full');
    };
    const tala = { table: 'items', id: 'i1', field: 'tala' } as const;
    const nadai = { table: 'items', id: 'i1', field: 'nadai' } as const;
    await feedback.track(tala, 'Adi', write('tala'));
    await feedback.track(nadai, 'khanda', write('nadai'));
    writes.length = 0;
    failing = false;

    await Promise.all([feedback.retryAll([tala, nadai]), feedback.retryAll([tala, nadai])]);
    // The second tap found the first still running; the first stopped when Tala failed again.
    expect(writes).toEqual(['tala']);
  });

  it('a retried entry keeps its place in the order entered', async () => {
    const feedback = new SaveFeedback();
    const first = { table: 'appearances', id: 'a1', field: '*' } as const;
    const second = { table: 'appearances', id: 'a2', field: '*' } as const;
    await feedback.track(first, { name: 'Sanjay' }, fail, {});
    await feedback.track(second, { name: 'Varadarajan' }, fail, {});

    await feedback.retry(first);
    expect(feedback.unshown()).toEqual([first, second]);
    expect(feedback.notSaved().map((entry) => entry.id)).toEqual(['a1', 'a2']);
  });

  it('after a relaunch, entries come back in the order entered, with the state they had', () => {
    const storage = memoryStorage();
    const copy = (id: string, enteredAt: string, state: string) =>
      storage.setItem(
        `${NOT_SAVED_PREFIX}events:${id}:note`,
        JSON.stringify({ table: 'events', id, field: 'note', value: id, enteredAt, state }),
      );
    // Stored keys come back in no particular order: the later entry first here.
    copy('e2', '2026-12-14T21:31:00.000Z', 'typed');
    copy('e1', '2026-12-14T21:30:00.000Z', 'failed');

    const feedback = new SaveFeedback({ storage });
    expect(feedback.notSaved().map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 'e1', state: 'failed' },
      { id: 'e2', state: 'typed' },
    ]);
  });

  it('entries read again when the page is shown are checked against the store at once', async () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage, confirm: async () => true });
    new SaveFeedback({ storage }).hold({ table: 'events', id: 'e1', field: 'note' }, 'Tisram');
    storage.setItem(
      `${NOT_SAVED_PREFIX}events:e1:note`,
      JSON.stringify({ ...storage.copies()[0], state: 'failed' }),
    );

    feedback.reload();
    await vi.waitFor(() => expect(feedback.notSaved()).toEqual([]));
  });

  it('Clear removes only the entries of the row it was tapped on', async () => {
    const feedback = new SaveFeedback();
    const refused = Object.assign(new Error('refused'), { name: 'RuleError' });
    const note = { table: 'events', id: 'e1', field: 'note' } as const;
    const other = { table: 'events', id: 'e2', field: 'note' } as const;
    await feedback.track(note, 'Tisram', () => Promise.reject(refused));
    await feedback.track(other, 'Misram', () => Promise.reject(refused));
    const file = feedback.notSaved();

    feedback.clearSaved(file, [note]);
    expect(feedback.notSaved().map((entry) => entry.id)).toEqual(['e2']);
  });

  it('a value whose store read-back answers after a newer edit is not let go', async () => {
    const storage = memoryStorage();
    const answer = deferred();
    const feedback = new SaveFeedback({
      storage,
      confirm: async () => (await answer.promise) === 'yes',
    });
    const target = { table: 'events', id: 'e1', field: 'note' } as const;
    void feedback.track(target, 'Tisram', () => Promise.resolve('ok'));
    await Promise.resolve();
    feedback.hold(target, 'Tisram, then');
    answer.resolve('yes');
    await vi.waitFor(() => expect(storage.copies()).toHaveLength(1));
    expect(storage.copies()[0]).toMatchObject({ value: 'Tisram, then' });
  });

  it('a relaunched entry whose store check answers after a newer edit is not let go', async () => {
    const storage = memoryStorage();
    const target = { table: 'events', id: 'e1', field: 'note' } as const;
    await new SaveFeedback({ storage }).track(target, 'Tisram', fail);
    const answer = deferred();
    const after = new SaveFeedback({
      storage,
      confirm: async () => (await answer.promise) === 'yes',
    });
    // Typed again while the store check of the copy from before the relaunch is running.
    after.hold(target, 'Tisram, then');
    answer.resolve('yes');
    await vi.waitFor(() => expect(storage.copies()).toHaveLength(1));
    expect(storage.copies()[0]).toMatchObject({ value: 'Tisram, then' });
  });

  it('a store check left unset never lets an entry go', async () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    await feedback.track({ table: 'events', id: 'e1', field: 'note' }, 'Tisram', () =>
      Promise.resolve('ok'),
    );
    expect(storage.copies()).toEqual([expect.objectContaining({ value: 'Tisram' })]);
  });

  it('a copy that could not be written leaves no older copy behind', async () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    const target = { table: 'events', id: 'e1', field: 'note' } as const;
    feedback.hold(target, 'Tisram');
    storage.full = true;
    feedback.hold(target, 'Tisram, Misram');
    expect(storage.copies()).toEqual([]);
    // The screens say so ("Not kept on this phone") until a copy can be written again.
    expect(feedback.journalBlocked()).toBe(true);
    storage.full = false;
    feedback.hold(target, 'Tisram, Misram, Khandam');
    expect(feedback.journalBlocked()).toBe(false);
  });

  it('a value whose copy failed stays held only in memory, even once a later copy is written', () => {
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage });
    const first = { table: 'events', id: 'e1', field: 'note' } as const;
    const second = { table: 'events', id: 'e2', field: 'note' } as const;
    storage.full = true;
    feedback.hold(first, 'Tisram');
    storage.full = false;
    feedback.hold(second, 'Misram');

    expect(feedback.journalBlocked()).toBe(false);
    expect(feedback.heldOnlyInMemory()).toEqual([
      expect.objectContaining({ ...first, value: 'Tisram' }),
    ]);
    // A reload would lose it: the reload and rescue screens ask first, with Export.
    expect(reloadLoses(feedback)).toBe(true);

    // Written at last, it is kept again.
    feedback.hold(first, 'Tisram, Misram');
    expect(feedback.heldOnlyInMemory()).toEqual([]);
    expect(reloadLoses(feedback)).toBe(false);
  });

  it('with no storage at all, every value entered is held only in memory', () => {
    const feedback = new SaveFeedback({ storage: null });
    feedback.hold({ table: 'events', id: 'e1', field: 'note' }, 'Tisram');
    expect(feedback.heldOnlyInMemory()).toHaveLength(1);
    expect(reloadLoses(feedback)).toBe(true);
  });

  it('Dismiss on a failed delete keeps the record, and takes only that entry', async () => {
    const { db, item, disk } = await storeWithItem();
    const storage = memoryStorage();
    const feedback = new SaveFeedback({ storage, confirm: stored });
    const gone = { table: 'items', id: item.id, field: 'deletedAt' } as const;
    const title = { table: 'items', id: item.id, field: 'title' } as const;
    const move = { table: 'items', id: item.id, field: 'position' } as const;
    disk.failing = true;
    await feedback.track(title, 'Viriboni', () => editItem(item.id, { title: 'Viriboni' }, { db }));
    await feedback.track(gone, { label: 'Item 1' }, () => removeItem(item.id, { db }), {
      kind: 'delete',
    });
    await feedback.track(move, 2, fail, { kind: 'move' });

    feedback.dismiss(gone);

    expect(feedback.get(gone)).toBeUndefined();
    expect(storage.copies().map((copy) => copy.field)).toEqual(['title']);
    expect((await db.items.get(item.id))?.deletedAt).toBeNull();
    expect(feedback.get(title)?.status).toBe('failed');
    expect(feedback.get(move)?.status).toBe('failed');
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
    /** A full disk: every write throws, as Safari's QuotaExceededError does. */
    full: false,
    setItem(key: string, value: string) {
      if (this.full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      values.set(key, value);
    },
    removeItem: (key: string) => void values.delete(key),
    copies: () =>
      [...values.entries()]
        .filter(([key]) => key.startsWith(NOT_SAVED_PREFIX))
        .map(([, value]) => JSON.parse(value) as Record<string, unknown>),
  };
}
