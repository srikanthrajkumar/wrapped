// Whether this phone has been through first launch (design D10): Welcome, then (with T081)
// sign-in and the two consent questions, then "Getting ready to log offline". Kept in `meta`.

import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type WrappedDB } from './db';

export const FIRST_LAUNCH_KEY = 'firstLaunch';

export async function finishFirstLaunch(db: WrappedDB = defaultDb): Promise<void> {
  await db.meta.put({ key: FIRST_LAUNCH_KEY, value: { doneAt: new Date().toISOString() } });
}

/** True once first launch is done, false before, undefined while the store is read. */
export function useFirstLaunchDone(): boolean | undefined {
  return useLiveQuery(async () => (await defaultDb.meta.get(FIRST_LAUNCH_KEY)) !== undefined);
}
