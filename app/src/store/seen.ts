// The last value a screen's query read, kept in memory for this page's life, so a screen drawn
// again starts from what it last showed rather than from "still loading" (the Maintainer,
// 2026-11-28: moving between the tabs flickered). It is only ever a first frame: the query
// still runs on every mount and its answer replaces it at once. Nothing here is written to the
// store, and it is forgotten when the account on this phone changes.

import { useLiveQuery } from 'dexie-react-hooks';

const seen = new Map<string, unknown>();

// Bumped by `forgetSeen`, so an answer read for the account before never lands after it.
let generation = 0;

/** Which account's values are being kept: read it before a query starts, for `remember`. */
export const readGeneration = () => generation;

/** Keep `value` as the last read for `key`, unless the account changed since `readIn`. */
export function remember<T>(key: string, value: T, readIn: number): T {
  if (readIn === generation) seen.set(key, value);
  return value;
}

/** The last value read for `key`; undefined before any. */
export function lastSeen<T>(key: string): T | undefined {
  return seen.get(key) as T | undefined;
}

/** Forget every value kept: the account on this phone changed, or its data went. */
export function forgetSeen(): void {
  generation += 1;
  seen.clear();
}

/**
 * `useLiveQuery`, starting from the last value read under `key` rather than undefined. `key`
 * must name everything the query depends on, as its deps would.
 */
export function useSeenLiveQuery<T>(key: string, querier: () => Promise<T>): T | undefined {
  return useLiveQuery(
    async () => {
      const readIn = generation;
      return remember(key, await querier(), readIn);
    },
    [key],
    lastSeen<T>(key),
  );
}
