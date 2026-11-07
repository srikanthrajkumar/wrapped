// The phone's calls to the server (contracts/sync-api.md), through Supabase's API: each contract
// path is a Postgres function called with `rpc` (ADR 0001). This file turns a reply into either
// its body or one SyncError naming what the sync loop must do; it holds no state.

import {
  SYNC_FUNCTIONS,
  type ClaimRequest,
  type ClaimResponse,
  type ConsentRequest,
  type ConsentResponse,
  type MeResponse,
  type PullRequest,
  type PullResponse,
  type PushRequest,
  type PushResponse,
} from '../model';

/** How a call failed, as the contract's table of responses reads it. */
export type SyncFailure =
  /** No answer, or a 5xx: retried with backoff. */
  | { kind: 'network'; status: number; message: string }
  /** 401: the session is missing or ended. Keep everything; ask to sign in again. */
  | { kind: 'signed_out' }
  /**
   * The session belongs to another account than the season on this phone (store/auth.ts). Found
   * before any call, so nothing was sent; keep everything, and sign in as this phone's account.
   */
  | { kind: 'other_account' }
  /** 409: another device writes for this rasika (FR-022). */
  | { kind: 'not_writer'; writerDeviceId: string | null }
  /** 426: this app is below the server's minimum version (eng review D14). */
  | { kind: 'update_required'; minimumVersion: string | null }
  /**
   * 400: the request was malformed and nothing was applied. Never retried with backoff, which
   * would block the outbox behind one bad batch; for a push, `opIds` names the batch.
   */
  | { kind: 'bad_request'; message: string; opIds?: string[] }
  /** Any other refusal, such as 403 `no_account` after a deletion. Not retried in a loop. */
  | { kind: 'refused'; status: number; code: string; message: string };

export class SyncError extends Error {
  constructor(readonly failure: SyncFailure) {
    super(`sync ${failure.kind}${'message' in failure ? `: ${failure.message}` : ''}`);
    this.name = 'SyncError';
  }

  /** True for a failure that the loop retries with backoff. */
  get retryable(): boolean {
    return this.failure.kind === 'network';
  }
}

/** The server as the sync loop sees it. Each call answers its body or throws a SyncError. */
export interface SyncApi {
  push(request: PushRequest): Promise<PushResponse>;
  pull(request: PullRequest): Promise<PullResponse>;
  claim(request: ClaimRequest): Promise<ClaimResponse>;
  me(): Promise<MeResponse>;
  consent(request: ConsentRequest): Promise<ConsentResponse>;
}

/** What a Supabase client's `rpc` answers; postgrest-js gives status 0 when fetch itself fails. */
export interface RpcReply {
  data: unknown;
  error: { code: string; message: string; details: string | null; hint: string | null } | null;
  status: number;
}

/**
 * The one method of a Supabase client the sync API uses, so tests can stand in for it. A
 * Supabase client's call also takes an abort signal (postgrest-js), which the deadline uses.
 */
export interface RpcClient {
  rpc(
    fn: string,
    args?: object,
  ): PromiseLike<RpcReply> & { abortSignal?(signal: AbortSignal): PromiseLike<RpcReply> };
}

/**
 * How long a sync call may go unanswered before it counts as a network failure (retried with
 * backoff). A sync holds the cross-tab lock, and so does a sign-in, so a call that never settles
 * must not hold it for ever. 30 s: the server stops a statement after 8 s (Supabase's default
 * for signed-in callers), and the largest reply, a 500-row pull page of about 250 KB, takes
 * about 20 s at 100 kbit/s, a congested hall's worst. Every call is safe to repeat: a push that
 * did land is answered as already processed (FR-015).
 */
export const RPC_DEADLINE_MS = 30_000;

/** Read one reply: its body on success, else the SyncError for its status. */
export function readReply<T>(reply: RpcReply): T {
  const { status, error } = reply;
  if (error === null && status >= 200 && status < 300) return reply.data as T;
  const code = error?.code ?? '';
  const message = error?.message ?? `HTTP ${status}`;
  if (status === 0 || status >= 500) throw new SyncError({ kind: 'network', status, message });
  if (status === 401) throw new SyncError({ kind: 'signed_out' });
  if (status === 409 && code === 'not_writer') {
    throw new SyncError({ kind: 'not_writer', writerDeviceId: error?.details ?? null });
  }
  if (status === 426) {
    throw new SyncError({ kind: 'update_required', minimumVersion: error?.details ?? null });
  }
  if (status === 400) throw new SyncError({ kind: 'bad_request', message });
  throw new SyncError({ kind: 'refused', status, code, message });
}

/**
 * The SyncApi over a Supabase client made with the app version header (APP_VERSION_HEADER) on
 * every request. A call that throws, rather than answering, counts as a network failure.
 */
export function rpcSyncApi(
  client: RpcClient,
  { deadlineMs = RPC_DEADLINE_MS }: { deadlineMs?: number } = {},
): SyncApi {
  const call = async <T>(fn: string, body?: object): Promise<T> => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        const message = `No answer in ${deadlineMs / 1000} s`;
        reject(new SyncError({ kind: 'network', status: 0, message }));
      }, deadlineMs);
    });
    let reply: RpcReply;
    try {
      const request = client.rpc(fn, body);
      const sent = request.abortSignal ? request.abortSignal(abort.signal) : request;
      reply = await Promise.race([sent, deadline]);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw new SyncError({ kind: 'network', status: 0, message: String(error) });
    } finally {
      clearTimeout(timer);
    }
    return readReply<T>(reply);
  };
  return {
    push: (request) => call(SYNC_FUNCTIONS.push, request),
    pull: (request) => call(SYNC_FUNCTIONS.pull, request),
    claim: (request) => call(SYNC_FUNCTIONS.claim, request),
    me: () => call(SYNC_FUNCTIONS.me),
    consent: (request) => call(SYNC_FUNCTIONS.consent, request),
  };
}
