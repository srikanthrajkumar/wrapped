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

export const REJECT_CODES = ['foreign_rasika', 'missing_event', 'conflict'] as const;
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

/** 409: another device is the writer (FR-022). */
export interface NotWriterResponse {
  code: 'not_writer';
  writerDeviceId: string;
}

/** 426: this app version is below the server's minimum (eng review D14). */
export interface UpdateRequiredResponse {
  code: 'update_required';
}

/** The tables a pull returns: the rasika's own, their Links and the shared lists. */
export interface PulledRows extends RasikaRows {
  links: Link;
  sharedArtists: SharedArtist;
  sharedSabhas: SharedSabha;
}
export type PulledTable = keyof PulledRows;

export type PullChange = {
  [T in PulledTable]: { table: T; row: PulledRows[T] };
}[PulledTable];

export interface PullResponse {
  changes: PullChange[];
  /** Opaque; the next request sends it back. Empty or missing returns everything (restore). */
  cursor: string;
  more: boolean;
}
