// Push and pull payloads (contracts/sync-api.md). Shared by the phone's sync client and the
// server's tests, so the two sides read one definition.

import type { Link, RasikaRows, RasikaTable, SharedArtist, SharedSabha } from './records';

/** Sent as a header on every sync request; below the server's minimum it answers 426 (D14). */
export const APP_VERSION_HEADER = 'X-App-Version';

export const PUSH_BATCH_LIMIT = 200;
export const PULL_PAGE_LIMIT = 500;

/** One change to one record. A delete is the full row with `deletedAt` set (outside voice 8). */
export type PushOp = {
  [T in RasikaTable]: {
    /** The idempotency key: the server stores it, so a repeated push is a no-op (FR-015). */
    opId: string;
    table: T;
    /** The server `seq` the phone last saw for this record; 0 for a new one (eng review D11). */
    baseSeq: number;
    row: RasikaRows[T];
  };
}[RasikaTable];

export interface PushRequest {
  deviceId: string;
  /** At most PUSH_BATCH_LIMIT, in outbox order. */
  ops: PushOp[];
}

export interface PushAck {
  opId: string;
  /** The record's new server `seq`, the base for its later ops. */
  seq: number;
}

/**
 * Why an op was rejected. `invalid_op` is an op the server cannot read (an unknown table, a row
 * without a uuid id or eventId, a baseSeq that is not a whole number, a deletedAt that is not a
 * timestamp): a phone bug, kept and listed like any rejection.
 */
export const REJECT_CODES = ['foreign_rasika', 'missing_event', 'conflict', 'invalid_op'] as const;
export type RejectCode = (typeof REJECT_CODES)[number];

export interface PushRejection {
  opId: string;
  code: RejectCode;
  message: string;
}

/** The 200 answer. Every op in the request is either acked or rejected. */
export interface PushResponse {
  acked: PushAck[];
  rejected: PushRejection[];
}

/**
 * PostgREST's error body, which a raised 409 or 426 takes (ADR 0001). PostgREST takes `details`
 * only as a string, so it holds one plain value.
 */
interface ServerError<Code extends string, Details extends string | null> {
  code: Code;
  message: string;
  details: Details;
  hint: string | null;
}

/**
 * 409: another device is the writer (FR-022). `details` is the writer device's id, or null when
 * no device has claimed writing yet.
 */
export type NotWriterResponse = ServerError<'not_writer', string | null>;

/** 426: this app version is below the server's minimum (eng review D14). `details` is the minimum. */
export type UpdateRequiredResponse = ServerError<'update_required', string>;

/** The tables a pull returns: the rasika's own, their Links and the shared lists. */
export interface PulledRows extends RasikaRows {
  links: Link;
  sharedArtists: SharedArtist;
  sharedSabhas: SharedSabha;
}
export type PulledTable = keyof PulledRows;

/** The tables whose rows carry a server `seq`: the rasika's own and their Links. */
export type SeqTable = RasikaTable | 'links';

/**
 * One pulled row. An own row or Link carries its server `seq`, which the phone keeps as the
 * baseSeq for its next edit of that record (eng review D11), so a restored record can be
 * edited without a `conflict`. A shared entry carries its version in `row.listVersion`.
 */
export type PullChange =
  | { [T in SeqTable]: { table: T; seq: number; row: PulledRows[T] } }[SeqTable]
  | { [T in Exclude<PulledTable, SeqTable>]: { table: T; row: PulledRows[T] } }[Exclude<
      PulledTable,
      SeqTable
    >];

export interface PullRequest {
  /** The last response's cursor. Empty or missing returns everything (restore). */
  cursor?: string;
  /** At most PULL_PAGE_LIMIT, the default. */
  limit?: number;
}

export interface PullResponse {
  changes: PullChange[];
  /** Opaque; the next request sends it back. Empty or missing returns everything (restore). */
  cursor: string;
  more: boolean;
}

/** GET /v1/me (contracts/sync-api.md, "Account"). Consents are null until answered. */
export interface MeResponse {
  id: string;
  name: string | null;
  shareAdditions: boolean | null;
  seasonReports: boolean | null;
  writerDeviceId: string | null;
  /** Where to ask for deletion (FR-046); null until the server sets one. */
  deletionContact: string | null;
}

/** PUT /v1/me/consent. A value left out is unchanged. */
export interface ConsentRequest {
  shareAdditions?: boolean;
  seasonReports?: boolean;
}

export interface ConsentResponse {
  shareAdditions: boolean | null;
  seasonReports: boolean | null;
}

/** POST /v1/devices/claim: makes this device the writer (FR-022). */
export interface ClaimRequest {
  deviceId: string;
  label: string;
}

export interface ClaimResponse {
  writerDeviceId: string;
}

/** The functions the phone calls through `supabase.rpc` (ADR 0001): contract path -> name. */
export const SYNC_FUNCTIONS = {
  push: 'sync_push',
  pull: 'sync_pull',
  me: 'me',
  consent: 'me_consent',
  claim: 'devices_claim',
} as const;
