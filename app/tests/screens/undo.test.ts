// Required test (constitution IV; T048a, design D16): an Undo whose restore fails keeps its
// offer, marked not saved, so a deleted Concert always has a way back; the offer goes only once
// the restore succeeded. Undo waits for the catalog, so a restored Item never keeps retired keys.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Catalog } from '../../src/catalog/load';
import type { DeletionReceipt } from '../../src/store/receipts';
import { RuleError } from '../../src/store/rules';

const mocks = vi.hoisted(() => ({
  catalog: { version: 'test' } as unknown as Catalog,
  restoreEvent: vi.fn(),
  restoreItem: vi.fn(),
  restoreAppearance: vi.fn(),
  dropReceipt: vi.fn(),
}));

vi.mock('../../src/catalog/use-catalog', () => ({
  readyCatalog: () => Promise.resolve(mocks.catalog),
}));
vi.mock('../../src/store/events', () => ({ restoreEvent: mocks.restoreEvent }));
vi.mock('../../src/store/items', () => ({ restoreItem: mocks.restoreItem }));
vi.mock('../../src/store/people', () => ({ restoreAppearance: mocks.restoreAppearance }));
vi.mock('../../src/store/receipts', () => ({ dropReceipt: mocks.dropReceipt }));

const { currentUndo, dismissUndo, leaveEvent, offerUndo, undo, undoOffers, undoText, UNDO_MS } =
  await import('../../src/screens/undo');

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
    await vi.advanceTimersByTimeAsync(1000);
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
    expect(undoText(offer)).toBe("Artist removed. Can't undo: a Lecdem has at most 3 presenters.");
    expect(logged).not.toHaveBeenCalled();

    // Any other failure is a write that didn't happen, and is logged.
    mocks.restoreAppearance.mockRejectedValue(new Error('disk full'));
    await undo(artist);
    expect(undoText(currentUndo()!)).toBe('Artist removed. Not saved on this phone.');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
