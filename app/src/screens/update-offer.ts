// When home offers the waiting update (FR-038; design D29). Never while a Concert is being
// logged, and never while a failed write is waiting for Try again or a failed Undo for its bar:
// the update reloads the page, and both live only in memory. A value copied back from before a
// relaunch, or refused by a rule, is in localStorage and loses nothing to a reload.

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
