// Required test (constitution IV; T048a, design D16): an Undo whose restore fails keeps its
// offer, marked not saved, so a deleted Concert always has a way back; the offer goes only once
// the restore succeeded. Undo waits for the catalog, so a restored Item never keeps retired keys.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Catalog } from '../../src/catalog/load';
import type { DeletionReceipt } from '../../src/store/receipts';
import { RuleError } from '../../src/store/rules';

const mocks = vi.hoisted(() => ({
  catalog: { version: 'test' } as unknown as Catalog,
  ready: vi.fn(),
  restoreEvent: vi.fn(),
  restoreItem: vi.fn(),
  restoreAppearance: vi.fn(),
  dropReceipt: vi.fn(),
}));

vi.mock('../../src/catalog/use-catalog', () => ({
  readyCatalog: () => mocks.ready(),
}));
vi.mock('../../src/store/events', () => ({ restoreEvent: mocks.restoreEvent }));
vi.mock('../../src/store/items', () => ({ restoreItem: mocks.restoreItem }));
vi.mock('../../src/store/people', () => ({ restoreAppearance: mocks.restoreAppearance }));
vi.mock('../../src/store/receipts', () => ({ dropReceipt: mocks.dropReceipt }));

/** localStorage, shared by the Undo module and its reload. */
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

const { canRetryUndo, dismissUndo, leaveEvent, offerUndo, undo, undoOffers, undoText, UNDO_MS } =
  await import('../../src/screens/undo');

/** The live offer, else the latest failed one: what the bar shows first. */
const currentUndo = () =>
  undoOffers().find((offer) => !offer.failed) ?? undoOffers().at(-1) ?? null;

const receipt = (kind: DeletionReceipt['kind']): DeletionReceipt => ({
  id: `r-${kind}`,
  kind,
  eventId: 'e1',
  position: kind === 'event' ? null : 3,
  records: [],
  at: new Date().toISOString(),
});

beforeEach(() => {
  mocks.dropReceipt.mockResolvedValue(undefined);
  mocks.ready.mockResolvedValue(mocks.catalog);
});

afterEach(() => {
  for (const offer of undoOffers()) dismissUndo(offer.receipt.id);
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('Undo (required)', () => {
  it('keeps the offer, marked not saved, when the restore fails', async () => {
    const concert = receipt('event');
    offerUndo(concert);
    mocks.restoreEvent.mockRejectedValue(new Error('disk full'));

    expect(await undo(concert)).toBe(false);

    expect(currentUndo()).toMatchObject({ receipt: concert, failed: true });
  });

  it('offers a failed Undo from the "⋯" menu in the bar, so it can be tried again', async () => {
    const item = receipt('item');
    mocks.restoreItem.mockRejectedValueOnce(new Error('disk full'));

    await undo(item);
    expect(currentUndo()).toMatchObject({ receipt: item, failed: true });

    mocks.restoreItem.mockResolvedValueOnce({ id: 'i1' });
    expect(await undo(item)).toBe(true);
    expect(currentUndo()).toBeNull();
  });

  it('dismisses the offer only once the restore succeeded', async () => {
    const concert = receipt('event');
    offerUndo(concert);
    let finish!: (value: unknown) => void;
    mocks.restoreEvent.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const undoing = undo(concert);
    await Promise.resolve();
    expect(currentUndo()?.receipt).toBe(concert);

    finish({ id: 'e1' });
    expect(await undoing).toBe(true);
    expect(currentUndo()).toBeNull();
  });

  it('restores with the opened catalog, even when no screen has asked for it', async () => {
    const item = receipt('item');
    mocks.restoreItem.mockResolvedValue({ id: 'i1' });

    await undo(item);

    expect(mocks.restoreItem).toHaveBeenCalledWith(item.id, { catalog: mocks.catalog });
  });

  it('A6: an Undo in flight is not dropped when its 5 seconds run out', async () => {
    vi.useFakeTimers();
    const concert = receipt('event');
    offerUndo(concert);
    let finish!: (value: unknown) => void;
    mocks.restoreEvent.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    // Tapped just before the end: on iOS the tap doesn't focus the bar, so nothing pauses it.
    await vi.advanceTimersByTimeAsync(UNDO_MS - 100);
    const undoing = undo(concert);
    // Well past where a running 5 seconds would have ended.
    await vi.advanceTimersByTimeAsync(UNDO_MS + 1000);
    expect(mocks.dropReceipt).not.toHaveBeenCalled();
    expect(currentUndo()?.receipt).toBe(concert);

    finish({ id: 'e1' });
    expect(await undoing).toBe(true);
    expect(undoOffers()).toEqual([]);
  });

  it("A6: a new delete's Undo stacks under a failed one, which stays until it works or is dismissed", async () => {
    vi.useFakeTimers();
    const item = receipt('item');
    offerUndo(item);
    mocks.restoreItem.mockRejectedValueOnce(new Error('disk full'));
    await undo(item);

    const artist = receipt('appearance');
    offerUndo(artist);
    expect(undoOffers().map((offer) => [offer.receipt.id, offer.failed === true])).toEqual([
      [item.id, true],
      [artist.id, false],
    ]);

    // The new one runs out; the failed one stays.
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(undoOffers().map((offer) => offer.receipt.id)).toEqual([item.id]);

    dismissUndo(item.id);
    expect(undoOffers()).toEqual([]);
  });

  it('A6: leaving the Event keeps a failed Undo and its receipt', async () => {
    const item = receipt('item');
    mocks.restoreItem.mockRejectedValueOnce(new Error('disk full'));
    await undo(item);
    const artist = receipt('appearance');
    offerUndo(artist);

    const keep = leaveEvent('e1');

    expect(undoOffers().map((offer) => offer.receipt.id)).toEqual([item.id]);
    expect([...keep]).toEqual([item.id]);
  });

  it('A6: a restore the rules refuse says which rule, and is not logged as an error', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const artist = receipt('appearance');
    offerUndo(artist);
    mocks.restoreAppearance.mockRejectedValue(new RuleError(['a Lecdem has at most 3 presenters']));

    expect(await undo(artist)).toBe(false);

    const offer = currentUndo()!;
    expect(offer).toMatchObject({ failed: true, refused: 'a Lecdem has at most 3 presenters' });
    expect(undoText(offer)).toBe('Undo failed: Artist, a Lecdem has at most 3 presenters.');
    expect(logged).not.toHaveBeenCalled();

    // Any other failure is a write that didn't happen, and is logged.
    mocks.restoreAppearance.mockRejectedValue(new Error('disk full'));
    await undo(artist);
    expect(undoText(currentUndo()!)).toBe('Undo failed: Artist. Not saved on this phone.');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('third review: a failed Undo bar survives a reload, receipt and all', async () => {
    const concert = receipt('event');
    offerUndo(concert);
    mocks.restoreEvent.mockRejectedValue(new Error('disk full'));
    await undo(concert);

    vi.resetModules();
    const reloaded = await import('../../src/screens/undo');
    expect(reloaded.undoOffers()).toEqual([
      expect.objectContaining({ receipt: concert, failed: true }),
    ]);
    expect(reloaded.failedUndoReceipts()).toEqual(new Set([concert.id]));

    reloaded.dismissUndo(concert.id);
    expect(storage.size).toBe(0);
  });

  it('third review: an Undo blocked by its deleted Concert says so, never "undone"', async () => {
    const item = receipt('item');
    offerUndo(item);
    mocks.restoreItem.mockRejectedValue(new RuleError(['its Concert is deleted']));

    expect(await undo(item)).toBe(false);
    expect(undoText(currentUndo()!)).toBe('Undo failed: Item 3, its Concert is deleted.');
  });
});

describe('Undo, fourth review (required)', () => {
  /** A restore whose settling the test controls. */
  function deferred() {
    let reject!: (error: Error) => void;
    let resolve!: (value: unknown) => void;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it('Try again on a failed Undo runs once, and a Dismiss meanwhile holds', async () => {
    const concert = receipt('event');
    mocks.restoreEvent.mockRejectedValueOnce(new Error('disk full'));
    await undo(concert);
    const retry = deferred();
    mocks.restoreEvent.mockReturnValue(retry.promise);

    const first = undo(concert);
    const second = undo(concert);
    dismissUndo(concert.id);
    retry.reject(new Error('disk full'));
    await Promise.all([first, second]);

    expect(mocks.restoreEvent).toHaveBeenCalledTimes(2);
    expect(undoOffers()).toEqual([]);
  });

  it('an Undo being written survives a reload as a bar, so the Concert keeps its way back', async () => {
    const concert = receipt('event');
    offerUndo(concert);
    mocks.restoreEvent.mockReturnValue(new Promise(() => undefined));
    void undo(concert);
    await vi.waitFor(() => expect(mocks.restoreEvent).toHaveBeenCalled());

    vi.resetModules();
    const reloaded = await import('../../src/screens/undo');
    expect(reloaded.undoOffers()).toEqual([
      expect.objectContaining({ receipt: concert, failed: true }),
    ]);
    reloaded.dismissUndo(concert.id);
  });

  it('a damaged copy of a failed Undo is skipped, and the others still come back', async () => {
    storage.set('wrapped.undo.v1:bad', '{not json');
    storage.set(
      'wrapped.undo.v1:no-at',
      JSON.stringify({ receipt: { id: 'no-at', kind: 'event' } }),
    );
    const concert = receipt('event');
    storage.set(
      `wrapped.undo.v1:${concert.id}`,
      JSON.stringify({ receipt: concert, message: 'Concert deleted', failed: true, attempt: 1 }),
    );

    vi.resetModules();
    const reloaded = await import('../../src/screens/undo');
    expect(reloaded.undoOffers().map((offer) => offer.receipt.id)).toEqual([concert.id]);
    for (const offer of reloaded.undoOffers()) reloaded.dismissUndo(offer.receipt.id);
    storage.clear();
  });

  it('an Artist comes back without waiting for the catalog', async () => {
    mocks.ready.mockReturnValue(new Promise(() => undefined));
    mocks.restoreAppearance.mockResolvedValue({ id: 'a1' });
    expect(await undo(receipt('appearance'))).toBe(true);
  });

  it('an Undo refused for its deleted Concert can be tried again once the Concert is back', async () => {
    const item = receipt('item');
    mocks.restoreItem.mockRejectedValue(new RuleError(['its Concert is deleted']));
    await undo(item);
    const offer = currentUndo()!;
    expect(canRetryUndo(offer, { eventLive: false })).toBe(false);
    expect(canRetryUndo(offer, { eventLive: true })).toBe(true);
  });
});
