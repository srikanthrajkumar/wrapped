// The sync loop's state for the screens (T082, T083): its status as a hook, and taking writing
// back.

import { useSyncExternalStore } from 'react';
import { requestClaim } from '../store/account';
import type { SyncStatus } from '../store/sync';
import { resumeSync, subscribeSyncStatus, syncStatus } from '../store/sync-runtime';

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, syncStatus);
}

/**
 * "Make this the writing device again" (FR-022, eng review D6): claim this phone, then push what
 * it holds. A change based on an older version than the server's comes back as a conflict.
 */
export function writeHere(): Promise<void> {
  return requestClaim().then(resumeSync);
}
