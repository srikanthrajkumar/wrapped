// When home offers the waiting update (FR-038; design D29). Never while a Concert is being
// logged, and never while a value is not saved on this phone: the update reloads the page, and
// a value held only in memory would go with it.

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
  /** Something failed to save and is still held in memory. */
  unsaved: boolean;
}): boolean {
  return available && !later && !logging && !unsaved;
}
