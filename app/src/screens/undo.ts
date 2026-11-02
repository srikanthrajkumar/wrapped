// The Undo bar's state (DESIGN.md "Deleting"; design D16). A delete removes at once and offers
// Undo for 5 seconds, paused while the bar has focus. A second delete replaces the bar with Undo
// for the latest; earlier deletes in the same Event stay undoable from its "⋯" menu (their
// receipts, store/receipts.ts) until the rasika leaves the Event.

import { readyCatalog } from '../catalog/use-catalog';
import { restoreEvent } from '../store/events';
import { restoreItem } from '../store/items';
import { restoreAppearance } from '../store/people';
import { dropReceipt, type DeletionReceipt } from '../store/receipts';
import { db } from '../store/db';
import { MESSAGES } from './messages';

export const UNDO_MS = 5000;

export interface UndoOffer {
  receipt: DeletionReceipt;
  /** What the bar says: "Item 5 deleted", "Artist removed", "Concert deleted". */
  message: string;
  /** The Undo itself failed to write: the bar stays, with Try again, until it works. */
  failed?: boolean;
}

let offer: UndoOffer | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let paused = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** The bar's words for a receipt. */
export function undoMessage(receipt: DeletionReceipt): string {
  if (receipt.kind === 'item') return MESSAGES.undo.itemDeleted(receipt.position ?? 0);
  if (receipt.kind === 'appearance') return MESSAGES.undo.artistRemoved;
  return MESSAGES.undo.concertDeleted;
}

function arm() {
  if (timer) clearTimeout(timer);
  timer = paused || offer?.failed ? null : setTimeout(expire, UNDO_MS);
}

function expire() {
  const ended = offer;
  offer = null;
  timer = null;
  // An Event's own receipt lives only as long as its bar on home; Item receipts stay for
  // "Recently deleted" until the rasika leaves the Event.
  if (ended?.receipt.kind === 'event')
    void dropReceipt(ended.receipt.id, db).catch(() => undefined);
  notify();
}

export function offerUndo(receipt: DeletionReceipt): void {
  offer = { receipt, message: undoMessage(receipt) };
  paused = false;
  arm();
  notify();
}

/** The bar has keyboard or screen-reader focus: the 5 seconds wait (design D16). */
export function pauseUndo(on: boolean): void {
  paused = on;
  if (offer) arm();
}

export function dismissUndo(): void {
  if (timer) clearTimeout(timer);
  offer = null;
  timer = null;
  notify();
}

/**
 * Undo a delete from its receipt; resolves to whether anything came back. The offer goes only
 * once the restore succeeded (or found nothing to restore). When the restore fails, the offer
 * stays, marked failed, with no countdown, even for an Undo started from the "⋯" menu: a deleted
 * Concert's receipt is in no menu, so the bar is its only way back.
 */
export async function undo(receipt: DeletionReceipt): Promise<boolean> {
  try {
    const catalog = await readyCatalog();
    const restored =
      receipt.kind === 'item'
        ? await restoreItem(receipt.id, { catalog })
        : receipt.kind === 'appearance'
          ? await restoreAppearance(receipt.id)
          : await restoreEvent(receipt.id, { catalog });
    if (offer?.receipt.id === receipt.id) dismissUndo();
    return restored !== null;
  } catch {
    if (timer) clearTimeout(timer);
    timer = null;
    offer = { receipt, message: undoMessage(receipt), failed: true };
    notify();
    return false;
  }
}

export function currentUndo(): UndoOffer | null {
  return offer;
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
