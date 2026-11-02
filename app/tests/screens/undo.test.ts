// Required test (constitution IV; T048a, design D16): an Undo whose restore fails keeps its
// offer, marked not saved, so a deleted Concert always has a way back; the offer goes only once
// the restore succeeded. Undo waits for the catalog, so a restored Item never keeps retired keys.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Catalog } from '../../src/catalog/load';
import type { DeletionReceipt } from '../../src/store/receipts';

const mocks = vi.hoisted(() => ({
  catalog: { version: 'test' } as unknown as Catalog,
  restoreEvent: vi.fn(),
  restoreItem: vi.fn(),
  restoreAppearance: vi.fn(),
}));

vi.mock('../../src/catalog/use-catalog', () => ({
  readyCatalog: () => Promise.resolve(mocks.catalog),
}));
vi.mock('../../src/store/events', () => ({ restoreEvent: mocks.restoreEvent }));
vi.mock('../../src/store/items', () => ({ restoreItem: mocks.restoreItem }));
vi.mock('../../src/store/people', () => ({ restoreAppearance: mocks.restoreAppearance }));

const { currentUndo, dismissUndo, offerUndo, undo } = await import('../../src/screens/undo');

const receipt = (kind: DeletionReceipt['kind']): DeletionReceipt => ({
  id: `r-${kind}`,
  kind,
  eventId: 'e1',
  position: kind === 'event' ? null : 3,
  records: [],
  at: new Date().toISOString(),
});

afterEach(() => {
  dismissUndo();
  vi.resetAllMocks();
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
});
