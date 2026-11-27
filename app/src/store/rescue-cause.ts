// Why the rescue screen showed, kept for diagnosis (the Maintainer's iPhone, 2026-11-27): a store
// that wouldn't open or answer ('store'), or screens that broke ('crash'), with the time. It is
// kept in localStorage, since the store may be what failed, and never leaves the phone. The rescue
// screen shows the latest in small text.
//
// Only known diagnostics are kept, never an error's own message: a message may quote what the
// rasika typed. The error's name only when it is one listed below (else "Error"), and for a
// store error a fixed detail ("connection lost").

import { browserStorage, type BrowserStorage } from '../browser-storage';
import { isConnectionLost } from './db';

export interface RescueCause {
  kind: 'store' | 'crash';
  /** One of KNOWN_NAMES. */
  name: string;
  /** A store error's fixed detail (STORE_DETAILS), never the error's message. */
  detail: string | null;
  /** ISO time it happened. */
  at: string;
}

/** The store errors known, with the fixed detail kept for each. */
const STORE_DETAILS: Record<string, string> = {
  UnknownError: 'connection lost',
  InvalidStateError: 'connection lost',
  DatabaseClosedError: 'connection lost',
  OpenTimeoutError: 'open timed out',
  QuotaExceededError: 'storage full',
  VersionError: 'version mismatch',
  OpenFailedError: 'open failed',
  AbortError: 'write aborted',
  TimeoutError: 'timed out',
};

/** Error names kept as they are; any other is kept as "Error". */
const KNOWN_NAMES = new Set([
  ...Object.keys(STORE_DETAILS),
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'NotFoundError',
  'DataError',
  'ConstraintError',
  'RuleError',
  'NewerStoreError',
]);
const DETAILS = new Set([...Object.values(STORE_DETAILS), 'connection lost']);

export const RESCUE_CAUSES_KEY = 'wrapped.rescueCauses.v1';
/** The latest causes kept, newest last. */
const KEPT = 5;

/** Bumped on each record, so a rescue screen drawn before its cause was kept reads it again. */
let recorded = 0;
const listeners = new Set<() => void>();

export function subscribeRescueCauses(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function rescueCausesRecorded(): number {
  return recorded;
}

/** Record why the rescue screen is about to show. Never throws. */
export function recordRescue(
  kind: RescueCause['kind'],
  error: unknown,
  {
    storage = browserStorage(),
    now = new Date(),
  }: { storage?: BrowserStorage | null; now?: Date } = {},
): RescueCause {
  const cause: RescueCause = { kind, ...describe(kind, error), at: now.toISOString() };
  try {
    const kept = [...rescueCauses(storage), cause].slice(-KEPT);
    storage?.setItem(RESCUE_CAUSES_KEY, JSON.stringify(kept));
  } catch {
    // A full or blocked storage keeps nothing: the rescue screen still shows.
  }
  recorded += 1;
  listeners.forEach((listener) => listener());
  return cause;
}

/** The causes recorded, oldest first; none when storage is blocked or damaged. */
export function rescueCauses(storage: BrowserStorage | null = browserStorage()): RescueCause[] {
  try {
    const kept = JSON.parse(storage?.getItem(RESCUE_CAUSES_KEY) ?? '[]') as unknown;
    return Array.isArray(kept) ? kept.filter(isCause) : [];
  } catch {
    return [];
  }
}

export function latestRescueCause(
  storage: BrowserStorage | null = browserStorage(),
): RescueCause | null {
  return rescueCauses(storage).at(-1) ?? null;
}

/**
 * The error's known name and, for the store, its fixed detail. Dexie wraps the browser's error
 * as its `inner`, so a store error is named by the first known store error in the chain.
 */
function describe(kind: RescueCause['kind'], error: unknown): Pick<RescueCause, 'name' | 'detail'> {
  const top = knownName(error);
  if (kind === 'crash') return { name: top, detail: null };
  let at: unknown = error;
  for (let depth = 0; at && typeof at === 'object' && depth < 4; depth++) {
    const name = (at as { name?: unknown }).name;
    if (typeof name === 'string' && name in STORE_DETAILS) {
      return { name, detail: STORE_DETAILS[name]! };
    }
    at = (at as { inner?: unknown }).inner;
  }
  return { name: top, detail: isConnectionLost(error) ? 'connection lost' : null };
}

function knownName(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === 'string' && KNOWN_NAMES.has(name) ? name : 'Error';
}

function isCause(value: unknown): value is RescueCause {
  const cause = value as Partial<RescueCause> | null;
  return (
    cause !== null &&
    typeof cause === 'object' &&
    (cause.kind === 'store' || cause.kind === 'crash') &&
    typeof cause.name === 'string' &&
    KNOWN_NAMES.has(cause.name) &&
    (cause.detail === null || (typeof cause.detail === 'string' && DETAILS.has(cause.detail))) &&
    typeof cause.at === 'string'
  );
}
