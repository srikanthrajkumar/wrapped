// The Undo bar's state (DESIGN.md "Deleting"; design D16). A delete removes at once and offers
// Undo for 5 seconds, paused while the bar has focus and stopped while the Undo is being
// written. A second delete replaces the bar with Undo for the latest; earlier deletes in the same
// Event stay undoable from its "⋯" menu (their receipts, store/receipts.ts) until the rasika
// leaves the Event. An Undo that fails keeps its own bar, with Try again and Dismiss, until it
// works or is dismissed, even after leaving the Event; a new delete's bar stacks under it.

import { readyCatalog } from '../catalog/use-catalog';
import { restoreEvent } from '../store/events';
import { restoreItem } from '../store/items';
import { restoreAppearance } from '../store/people';
import { dropReceipt, type DeletionReceipt } from '../store/receipts';
import { RuleError } from '../store/rules';
import { db } from '../store/db';
import { MESSAGES } from './messages';

export const UNDO_MS = 5000;

export interface UndoOffer {
  receipt: DeletionReceipt;
  /** What the bar says: "Item 5 deleted", "Artist removed", "Concert deleted". */
  message: string;
  /** The Undo itself failed: the bar stays, with Try again and Dismiss, until it works. */
  failed?: boolean;
  /** The rule that refused the restore, as "a Lecdem has at most 3 presenters". */
  refused?: string;
  /** How many times it failed, so each failure is announced afresh. */
  attempt: number;
  /** Being written: its 5 seconds stop. */
  inFlight?: boolean;
}

/** The latest delete's offer, counting down. */
let live: UndoOffer | null = null;
/** Failed Undos, oldest first. */
let failed: UndoOffer[] = [];
/** Failed offers, then the live one: one array per change, for useSyncExternalStore. */
let offers: UndoOffer[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let paused = false;
const listeners = new Set<() => void>();

function notify() {
  offers = live ? [...failed, live] : failed;
  listeners.forEach((listener) => listener());
}

/** The bar's words for a receipt. */
export function undoMessage(receipt: DeletionReceipt): string {
  if (receipt.kind === 'item') return MESSAGES.undo.itemDeleted(receipt.position ?? 0);
  if (receipt.kind === 'appearance') return MESSAGES.undo.artistRemoved;
  return MESSAGES.undo.concertDeleted;
}

/** What an offer's bar says, failed or refused included. */
export function undoText(offer: UndoOffer): string {
  if (offer.refused) return MESSAGES.undo.refused(offer.message, offer.refused);
  return offer.failed ? MESSAGES.undo.failed(offer.message) : offer.message;
}

function arm() {
  if (timer) clearTimeout(timer);
  timer = live && !paused && !live.inFlight ? setTimeout(expire, UNDO_MS) : null;
}

/** An Event's own receipt lives only as long as its bar on home. */
function forget(receipt: DeletionReceipt) {
  if (receipt.kind === 'event') void dropReceipt(receipt.id, db).catch(() => undefined);
}

function expire() {
  const ended = live;
  live = null;
  timer = null;
  // Item receipts stay for "Recently deleted" until the rasika leaves the Event.
  if (ended) forget(ended.receipt);
  notify();
}

export function offerUndo(receipt: DeletionReceipt): void {
  live = { receipt, message: undoMessage(receipt), attempt: 0 };
  paused = false;
  arm();
  notify();
}

/** The bar has keyboard or screen-reader focus: the 5 seconds wait (design D16). */
export function pauseUndo(on: boolean): void {
  paused = on;
  arm();
}

/** Dismiss the offer for `receiptId`, or the live one without it. */
export function dismissUndo(receiptId?: string): void {
  if (live && (receiptId === undefined || live.receipt.id === receiptId)) {
    live = null;
    arm();
  }
  const dismissed = failed.find((offer) => offer.receipt.id === receiptId);
  if (dismissed) {
    failed = failed.filter((offer) => offer !== dismissed);
    forget(dismissed.receipt);
  }
  notify();
}

/**
 * The rasika left `eventId`: its live Item or Artist offer goes with its receipt, unless it is
 * being written. Returns the receipts to keep: those of its failed and in-flight offers.
 */
export function leaveEvent(eventId: string): Set<string> {
  if (live?.receipt.eventId === eventId && live.receipt.kind !== 'event' && !live.inFlight) {
    dismissUndo();
  }
  return new Set(
    offers.filter((offer) => offer.receipt.eventId === eventId).map((offer) => offer.receipt.id),
  );
}

/**
 * Undo a delete from its receipt; resolves to whether anything came back. The offer goes only
 * once the restore succeeded (or found nothing to restore). When it fails, the offer stays,
 * marked failed, with no countdown, even for an Undo started from the "⋯" menu: a deleted
 * Concert's receipt is in no menu, so the bar is its only way back. A rule's refusal is told
 * apart from a write that failed, so the bar can say which rule.
 */
export async function undo(receipt: DeletionReceipt): Promise<boolean> {
  if (live?.receipt.id === receipt.id) {
    live = { ...live, inFlight: true };
    arm();
    notify();
  }
  try {
    const catalog = await readyCatalog();
    const restored =
      receipt.kind === 'item'
        ? await restoreItem(receipt.id, { catalog })
        : receipt.kind === 'appearance'
          ? await restoreAppearance(receipt.id)
          : await restoreEvent(receipt.id, { catalog });
    if (live?.receipt.id === receipt.id) live = null;
    failed = failed.filter((offer) => offer.receipt.id !== receipt.id);
    arm();
    notify();
    return restored !== null;
  } catch (error) {
    const refused = error instanceof RuleError ? error.problems.join('; ') : undefined;
    if (!refused) console.error('undo failed', error);
    const before =
      failed.find((offer) => offer.receipt.id === receipt.id) ??
      (live?.receipt.id === receipt.id ? live : null);
    if (live?.receipt.id === receipt.id) live = null;
    arm();
    const next: UndoOffer = {
      receipt,
      message: undoMessage(receipt),
      failed: true,
      refused,
      attempt: (before?.attempt ?? 0) + 1,
    };
    failed = failed.some((offer) => offer.receipt.id === receipt.id)
      ? failed.map((offer) => (offer.receipt.id === receipt.id ? next : offer))
      : [...failed, next];
    notify();
    return false;
  }
}

/** Every offer to show: failed ones first, then the live one. */
export function undoOffers(): UndoOffer[] {
  return offers;
}

/** The live offer, else the latest failed one. */
export function currentUndo(): UndoOffer | null {
  return live ?? failed.at(-1) ?? null;
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
