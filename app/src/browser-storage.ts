// The page's localStorage, or null where it is blocked (private modes, a denied site setting):
// shared by the journal of values not saved and the failed Undo bars.

export type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export function browserStorage(): BrowserStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
