// The Undo bar's state (DESIGN.md "Deleting"; design D16). A delete removes at once and offers
// Undo for 5 seconds, paused while the bar has focus. A second delete replaces the bar with Undo
// for the latest; earlier deletes in the same Event stay undoable from its "⋯" menu (their
// receipts, store/receipts.ts) until the rasika leaves the Event.

import { currentCatalog } from '../catalog/use-catalog';
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
  timer = paused ? null : setTimeout(expire, UNDO_MS);
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

/** Undo a delete from its receipt; resolves to whether anything came back. */
export async function undo(receipt: DeletionReceipt): Promise<boolean> {
  if (offer?.receipt.id === receipt.id) dismissUndo();
  const catalog = currentCatalog();
  switch (receipt.kind) {
    case 'item':
      return (await restoreItem(receipt.id, { catalog })) !== null;
    case 'appearance':
      return (await restoreAppearance(receipt.id)) !== null;
    case 'event':
      return (await restoreEvent(receipt.id, { catalog })) !== null;
  }
}

export function currentUndo(): UndoOffer | null {
  return offer;
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
