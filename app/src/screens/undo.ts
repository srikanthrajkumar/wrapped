// The Undo bar's state (DESIGN.md "Deleting"; design D16). A delete removes at once and offers
// Undo for 5 seconds, paused while the bar has focus and stopped while the Undo is being
// written. A second delete replaces the bar with Undo for the latest; earlier deletes in the same
// Event stay undoable from its "⋯" menu (their receipts, store/receipts.ts) until the rasika
// leaves the Event. An Undo that fails keeps its own bar, with Try again and Dismiss, until it
// works or is dismissed, even after leaving the Event or a reload: failed offers are kept in
// localStorage, and their receipts with them (store/receipts.ts pruneReceipts).

import { readyCatalog } from '../catalog/use-catalog';
import { restoreEvent } from '../store/events';
import { restoreItem } from '../store/items';
import { restoreAppearance } from '../store/people';
import { dropReceipt, type DeletionReceipt } from '../store/receipts';
import { EVENT_DELETED, RuleError } from '../store/rules';
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

/** Where failed Undos are kept, one key per receipt, so their bars survive a reload. */
const FAILED_PREFIX = 'wrapped.undo.v1:';

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readFailed(): UndoOffer[] {
  const store = storage();
  const offers: UndoOffer[] = [];
  try {
    for (let i = 0; store && i < store.length; i += 1) {
      const key = store.key(i);
      if (!key?.startsWith(FAILED_PREFIX)) continue;
      const offer = JSON.parse(store.getItem(key) ?? 'null') as UndoOffer | null;
      if (offer?.receipt?.id) offers.push({ ...offer, failed: true, inFlight: false });
    }
  } catch {
    // A damaged copy, or blocked storage: the bars come back only from this page's memory.
  }
  return offers.sort((a, b) => a.receipt.at.localeCompare(b.receipt.at));
}

function keepFailed(offer: UndoOffer) {
  try {
    storage()?.setItem(`${FAILED_PREFIX}${offer.receipt.id}`, JSON.stringify(offer));
  } catch {
    // Kept in memory for this page's life.
  }
}

function forgetFailed(receiptId: string) {
  try {
    storage()?.removeItem(`${FAILED_PREFIX}${receiptId}`);
  } catch {
    // Nothing more to do.
  }
}

/** The latest delete's offer, counting down. */
let live: UndoOffer | null = null;
/** Failed Undos, oldest first. */
let failed: UndoOffer[] = readFailed();
/** Failed offers, then the live one: one array per change, for useSyncExternalStore. */
let offers: UndoOffer[] = failed;
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

/** What a failed Undo's bar names. */
export function undoSubject(receipt: DeletionReceipt): string {
  if (receipt.kind === 'item') return MESSAGES.undo.subject.item(receipt.position ?? 0);
  if (receipt.kind === 'appearance') return MESSAGES.undo.subject.artist;
  return MESSAGES.undo.subject.concert;
}

/** What an offer's bar says in full, failed or refused included. */
export function undoText(offer: UndoOffer): string {
  const subject = undoSubject(offer.receipt);
  if (offer.refused) return MESSAGES.undo.refused(subject, offer.refused);
  return offer.failed ? MESSAGES.undo.failed(subject) : offer.message;
}

/** A failed or refused offer's short label, shown on its bar. */
export function undoLabel(offer: UndoOffer): string {
  const subject = undoSubject(offer.receipt);
  return offer.refused
    ? MESSAGES.undo.refusedShort(subject, offer.refused)
    : MESSAGES.undo.failedShort(subject);
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
    forgetFailed(dismissed.receipt.id);
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
    forgetFailed(receipt.id);
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
    keepFailed(next);
    notify();
    return false;
  }
}

/** Every offer to show: failed ones first, then the live one. */
export function undoOffers(): UndoOffer[] {
  return offers;
}

/** The receipts failed Undo bars still offer: kept by pruneReceipts and clearReceipts. */
export function failedUndoReceipts(): Set<string> {
  return new Set(failed.map((offer) => offer.receipt.id));
}

/** Whether Try again can work: not while the Concert the Item or Artist was in is deleted. */
export function canRetryUndo(offer: UndoOffer): boolean {
  return offer.refused !== EVENT_DELETED;
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
