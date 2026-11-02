// When home offers the waiting update (FR-038; design D29). Never while a Concert is being
// logged, and never while a failed write is waiting for Try again or a failed Undo is on its bar:
// the update reloads the page, and a write to try again lives only in memory. Journal entries
// Try again can't write (copied back, refused, a repick) lose nothing to a reload.

export function offersUpdate({
  available,
  later,
  logging,
  unsaved,
}: {
  available: boolean;
  /** "Later" was tapped this launch. */
  later: boolean;
  logging: boolean;
  /** A failed write still held for Try again, or a failed Undo still on its bar. */
  unsaved: boolean;
}): boolean {
  return available && !later && !logging && !unsaved;
}

/**
 * Whether a waiting update may be applied without asking: only when first launch's Try again
 * found a newer build (`requested`) and first launch isn't finished, so nothing is being logged
 * and the reload loses nothing. A request left over must never reload the page mid-Concert.
 */
export function appliesWaitingUpdate({
  requested,
  firstLaunchDone,
}: {
  requested: boolean;
  firstLaunchDone: boolean;
}): boolean {
  return requested && !firstLaunchDone;
}
