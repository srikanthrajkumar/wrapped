// The Undo bar's state (DESIGN.md "Deleting"; design D16). A delete removes at once and offers
// Undo for 5 seconds, paused while the bar has focus and stopped while the Undo is being
// written. A second delete replaces the bar with Undo for the latest; earlier deletes in the same
// Event stay undoable from its "⋯" menu (their receipts, store/receipts.ts) until the rasika
// leaves the Event. An Undo that fails keeps its own bar, with Try again and Dismiss, until it
// works or is dismissed, even after leaving the Event or a reload: failed offers, and an Undo
// while it is being written, are kept in localStorage, and their receipts with them
// (store/receipts.ts pruneReceipts). One Undo of a receipt runs at a time. Undo is only for
// whole things, a Concert, an Item, an Artist, the Shortlist (the Maintainer, 2026-11-25): a bar
// kept by an earlier build for a piece of an Item or a title is dropped quietly.

import { browserStorage as storage } from '../browser-storage';
import type { Event } from '../model';
import { readyCatalog } from '../catalog/use-catalog';
import { restoreEvent } from '../store/events';
import { restoreItem } from '../store/items';
import { restoreAppearance } from '../store/people';
import { dropReceipt, undoableKind, type DeletionReceipt } from '../store/receipts';
import { EVENT_DELETED, RuleError } from '../store/rules';
import { FILL_CHANGED, undoFill } from '../store/schedule';
import { db } from '../store/db';
import { MESSAGES } from './messages';
import {
  claimNewConcert,
  dropNewConcert,
  forgetNewConcert,
  handOverNewConcert,
  noteNewConcert,
} from './new-concert';
import { saveFeedback } from './save-feedback';

export const UNDO_MS = 5000;

export interface UndoOffer {
  receipt: DeletionReceipt;
  /** What the bar says: "Item 5 deleted", "Artist removed", "Concert deleted". */
  message: string;
  /** The Undo itself failed: the bar stays, with Try again and Dismiss, until it works. */
  failed?: boolean;
  /** The rule that refused the restore, as "a Lecdem has at most 6 presenters". */
  refused?: string;
  /** How many times it failed, so each failure is announced afresh. */
  attempt: number;
  /** Being written: its 5 seconds stop. */
  inFlight?: boolean;
}

/** Where failed Undos are kept, one key per receipt, so their bars survive a reload. */
const FAILED_PREFIX = 'wrapped.undo.v1:';

/**
 * One kept offer, checked field by field; null for anything damaged, or of a kind Undo no longer
 * restores.
 */
function parseOffer(text: string | null): UndoOffer | null {
  try {
    const offer = JSON.parse(text ?? '') as Partial<UndoOffer> | null;
    const receipt = offer?.receipt as Partial<DeletionReceipt> | undefined;
    const strings = [receipt?.id, receipt?.at, receipt?.kind, receipt?.eventId];
    if (!strings.every((value) => typeof value === 'string')) return null;
    if (!undoableKind(receipt!.kind)) return null;
    if (!Array.isArray(receipt!.records)) return null;
    return {
      receipt: receipt as DeletionReceipt,
      message:
        typeof offer!.message === 'string'
          ? offer!.message
          : undoMessage(receipt as DeletionReceipt),
      failed: true,
      refused: typeof offer!.refused === 'string' ? offer!.refused : undefined,
      attempt: typeof offer!.attempt === 'number' ? offer!.attempt : 1,
    };
  } catch {
    return null;
  }
}

/** Whether a kept copy is of a retired kind, a piece of an Item or a title, from an earlier build. */
function retired(text: string | null): boolean {
  try {
    const kind = (JSON.parse(text ?? '') as { receipt?: { kind?: unknown } } | null)?.receipt?.kind;
    return typeof kind === 'string' && !undoableKind(kind);
  } catch {
    return false;
  }
}

/**
 * The kept offers, oldest first; one damaged copy never hides the others. A copy of a retired
 * kind is forgotten, its bar never shown, and its receipt is pruned on the next launch
 * (store/receipts.ts pruneReceipts).
 */
function readFailed(): UndoOffer[] {
  const store = storage();
  const offers: UndoOffer[] = [];
  try {
    const keys: string[] = [];
    for (let i = 0; store && i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(FAILED_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      const text = store!.getItem(key);
      const offer = parseOffer(text);
      if (offer) offers.push(offer);
      else if (retired(text)) store!.removeItem(key);
    }
    offers.sort((a, b) => a.receipt.at.localeCompare(b.receipt.at));
  } catch {
    // Blocked storage: the bars come back only from this page's memory.
  }
  return offers;
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
/** Receipts whose Undo is being written, and those of them dismissed meanwhile. */
const writing = new Set<string>();
const dismissedWhileWriting = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  offers = live ? [...failed, live] : failed;
  listeners.forEach((listener) => listener());
}

/** The bar's words for a receipt. */
export function undoMessage(receipt: DeletionReceipt): string {
  if (receipt.kind === 'item') return MESSAGES.undo.itemDeleted(receipt.position ?? 0);
  if (receipt.kind === 'appearance') return MESSAGES.undo.artistRemoved;
  // A blank Concert filled from a listing: the bar names the listing, "NJ Nandini · Undo".
  if (receipt.kind === 'fill') return receipt.fill?.lead ?? MESSAGES.undo.subject.concert;
  return MESSAGES.undo.concertDeleted;
}

/** What a failed Undo's bar names. */
function undoSubject(receipt: DeletionReceipt): string {
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

/** An Event's own receipt, and a fill's, lives only as long as its bar. */
function forget(receipt: DeletionReceipt) {
  if (receipt.kind === 'event' || receipt.kind === 'fill') {
    void dropReceipt(receipt.id, db).catch(() => undefined);
  }
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
  if (!undoableKind(receipt.kind)) return;
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
  if (receiptId !== undefined && writing.has(receiptId)) {
    dismissedWhileWriting.add(receiptId);
    forgetFailed(receiptId);
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
  // A receipt of a retired kind, from an earlier build, restores nothing: it is dropped quietly.
  if (!undoableKind(receipt.kind)) {
    void dropReceipt(receipt.id, db).catch(() => undefined);
    return false;
  }
  // A second tap while it is written does nothing.
  if (writing.has(receipt.id)) return false;
  writing.add(receipt.id);
  const mark = (offer: UndoOffer) =>
    offer.receipt.id === receipt.id ? { ...offer, inFlight: true } : offer;
  if (live?.receipt.id === receipt.id) live = mark(live);
  failed = failed.map(mark);
  arm();
  notify();
  // Kept while it is written: a kill now must not leave a deleted Concert with no way back.
  keepFailed({
    receipt,
    message: undoMessage(receipt),
    failed: true,
    attempt: failed.find((offer) => offer.receipt.id === receipt.id)?.attempt ?? 0,
  });
  const fill = receipt.kind === 'fill' ? receipt.fill : undefined;
  let claimed = false;
  try {
    if (fill) {
      // Anything typed on the filled Event and not yet in the store that Undo would take away:
      // an Undo then waits until it is written, here or in another tab, and the store's check
      // sees it.
      losesTyped(receipt)();
      // The blank Concert is held and noted as new before it comes back, so no tab's sweep takes
      // it back before its page opens, and a crash leaves it noted (kept, as one edited is).
      if (fill.birth) {
        await claimNewConcert(fill.blank.id);
        claimed = true;
        noteNewConcert({ ...fill.blank, ...fill.birth }, fill.birth.tappedAt);
      }
    }
    const restored =
      receipt.kind === 'item'
        ? await restoreItem(receipt.id, { catalog: await readyCatalog() })
        : receipt.kind === 'appearance'
          ? await restoreAppearance(receipt.id)
          : receipt.kind === 'fill'
            ? await undoFill(receipt.id, { guard: losesTyped(receipt) })
            : await restoreEvent(receipt.id, { catalog: await readyCatalog() });
    // The blank Concert is back as new: still blank, it offers its listings, and left with
    // nothing entered it is taken back (screens/new-concert.ts).
    if (fill?.birth && claimed) {
      if (restored) {
        // Untouched when filled, it is new again as restored; edited (a late log's time), it
        // keeps the birth it had, so leaving it never takes the edit back.
        const { birth, blank } = fill;
        if (blank.updatedAt === birth.updatedAt) {
          noteNewConcert(restored as Event, birth.tappedAt);
        }
        handOverNewConcert(blank.id);
      } else {
        await letBlankGo(fill.blank.id);
      }
    }
    if (live?.receipt.id === receipt.id) live = null;
    failed = failed.filter((offer) => offer.receipt.id !== receipt.id);
    forgetFailed(receipt.id);
    arm();
    notify();
    if (restored !== null) restoredListeners.forEach((listener) => listener(receipt));
    return restored !== null;
  } catch (error) {
    if (fill && claimed) await letBlankGo(fill.blank.id);
    const refused = error instanceof RuleError ? error.problems.join('; ') : undefined;
    if (!refused) console.error('undo failed', error);
    const before =
      failed.find((offer) => offer.receipt.id === receipt.id) ??
      (live?.receipt.id === receipt.id ? live : null);
    if (live?.receipt.id === receipt.id) live = null;
    arm();
    // Dismissed while it was written: the rasika let it go, so its failure isn't brought back.
    if (dismissedWhileWriting.has(receipt.id)) {
      forgetFailed(receipt.id);
      notify();
      return false;
    }
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
  } finally {
    writing.delete(receipt.id);
    dismissedWhileWriting.delete(receipt.id);
  }
}

/**
 * A check that throws (FILL_CHANGED) while something typed and not yet in the store, here or in
 * another tab, would be lost by the Undo: anything for the Event when the fill made it, as Undo
 * deletes it. Into the rasika's own Event, Undo writes back only the fields the fill changed (its
 * Note, when the blank Concert's was added; its status, when Items moved): only a value typed for
 * one of those stops it. Any other (a date; a Note typed before a fill that left the Note as it
 * was) stays with the Event, so it never refuses. Run before the Undo, and again as its last step
 * inside the transaction.
 */
const losesTyped = (receipt: DeletionReceipt) => () => {
  const fill = receipt.fill;
  const before = fill?.before as Record<string, unknown> | null | undefined;
  const after = fill?.after?.event as unknown as Record<string, unknown> | undefined;
  const putBack = (field: string) =>
    !before || !after || (field in before && before[field] !== after[field]);
  const lost = saveFeedback
    .pendingFor(receipt.eventId)
    .some((entry) => fill?.made !== false || (entry.table === 'events' && putBack(entry.field)));
  if (lost) throw new RuleError([FILL_CHANGED]);
};

/**
 * An Undo of a fill brought nothing back: its hold goes, and so does its note, unless the blank
 * Concert is back after all (another tab's Undo of the same fill), whose note that tab wrote.
 */
async function letBlankGo(id: string) {
  dropNewConcert(id);
  const blank = await db.events.get(id).catch(() => undefined);
  if (!blank || blank.deletedAt !== null) forgetNewConcert(id);
}

/** Every offer to show: failed ones first, then the live one. */
export function undoOffers(): UndoOffer[] {
  return offers;
}

/** The receipts failed Undo bars still offer: kept by pruneReceipts and clearReceipts. */
export function failedUndoReceipts(): Set<string> {
  return new Set(failed.map((offer) => offer.receipt.id));
}

/**
 * Whether Try again can work: not while the Concert the Item or Artist was in is deleted, as
 * the bar reads it now (`eventLive`), so it comes back once the Concert is restored.
 */
export function canRetryUndo(offer: UndoOffer, { eventLive }: { eventLive: boolean }): boolean {
  if (offer.inFlight) return false;
  return offer.refused !== EVENT_DELETED || eventLive;
}

const restoredListeners = new Set<(receipt: DeletionReceipt) => void>();

/** Told after an Undo brought something back: a fill undone opens the blank Concert again. */
export function onUndone(listener: (receipt: DeletionReceipt) => void): () => void {
  restoredListeners.add(listener);
  return () => void restoredListeners.delete(listener);
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
