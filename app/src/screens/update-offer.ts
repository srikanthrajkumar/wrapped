// When home offers the waiting update (FR-038; design D29). Never while a Concert is being
// logged, while a failed write is waiting for Try again, or while any Undo bar shows: the update
// reloads the page, a write to try again lives only in memory, and a live Undo's 5 seconds would
// end with it. A failed Undo, or one being written, is kept in localStorage and comes back after
// a reload, but its bar still holds the update back until it is done. Journal entries Try again
// can't write (copied back, refused, a repick) lose nothing to a reload.

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
  /** A failed write still held for Try again, or an Undo bar showing (live, being written or failed). */
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
