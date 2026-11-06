// Helpers for the server tests: rasikas signed in through Supabase Auth, the API calls as the
// phone makes them, records shaped by app/src/model/records.ts, and a direct database
// connection to check what the server stored.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres, { type TransactionSql } from 'postgres';
import { afterAll, expect, inject } from 'vitest';
import type { DetailValue } from '../../app/src/model/detail-value';
import type {
  Appearance,
  Artist,
  Event,
  Item,
  RasikaRows,
  RasikaTable,
  Sabha,
} from '../../app/src/model/records';
import {
  APP_VERSION_HEADER,
  SYNC_FUNCTIONS,
  type ClaimRequest,
  type ClaimResponse,
  type ConsentRequest,
  type ConsentResponse,
  type MeResponse,
  type PullChange,
  type PullRequest,
  type PullResponse,
  type PushOp,
  type PushRequest,
  type PushResponse,
} from '../../app/src/model/sync-payloads';

const stack = inject('stack');

/** The version the phone sends, from app/package.json. */
export const APP_VERSION = (
  JSON.parse(readFileSync(new URL('../../app/package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

/** A client as the phone makes one; `version` null sends no version header. */
export function apiClient(version: string | null = APP_VERSION): SupabaseClient {
  return createClient(stack.apiUrl, stack.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: version === null ? {} : { [APP_VERSION_HEADER]: version } },
  });
}

const admin = createClient(stack.apiUrl, stack.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A direct connection as the database owner, to look past the API at what is stored. */
export const db = postgres(stack.dbUrl, { onnotice: () => {}, max: 2 });
afterAll(async () => {
  await db.end();
});

export interface Rasika {
  client: SupabaseClient;
  email: string;
  userId: string;
  rasikaId: string;
  /** This rasika's phone. */
  deviceId: string;
}

/** A new Supabase Auth user, signed in; the sign-in trigger has made their Rasika row. */
export async function signUp(
  label = 'rasika',
  version: string | null = APP_VERSION,
  email = `${label}-${randomUUID()}@example.test`,
): Promise<Rasika> {
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (created.error) throw created.error;
  const client = apiClient(version);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const [row] = await db<{ id: string }[]>`
    select id from private.rasika where auth_user_id = ${created.data.user.id}`;
  if (!row) throw new Error('The sign-in made no Rasika row');
  return {
    client,
    email,
    userId: created.data.user.id,
    rasikaId: row.id,
    deviceId: randomUUID(),
  };
}

export /** Runs `body` in a transaction as `rasika` would inside a function: role and JWT claims set. */
async function asRasika<T>(rasika: Rasika, body: (sql: TransactionSql) => Promise<T>): Promise<T> {
  return (await db.begin(async (sql) => {
    const claims = JSON.stringify({ sub: rasika.userId, role: 'authenticated' });
    await sql`select set_config('request.jwt.claims', ${claims}, true)`;
    await sql`set local role authenticated`;
    return body(sql);
  })) as T;
}

/** Changes the rasika's sign-in email, as Supabase Auth does on a confirmed change. */
export async function changeEmail(rasika: Rasika, email: string) {
  const updated = await admin.auth.admin.updateUserById(rasika.userId, {
    email,
    email_confirm: true,
  });
  if (updated.error) throw updated.error;
}

/** A new rasika whose phone has claimed writing, as restore does first (FR-017). */
export async function signUpWriter(label = 'writer'): Promise<Rasika> {
  const rasika = await signUp(label);
  const reply = await claim(rasika, { deviceId: rasika.deviceId, label: 'Test phone' });
  expect(reply.error).toBeNull();
  return rasika;
}

export interface ServerErrorBody {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}

export interface Reply<T> {
  status: number;
  data: T | null;
  error: ServerErrorBody | null;
}

async function rpc<T>(client: SupabaseClient, name: string, body?: object): Promise<Reply<T>> {
  const reply = await client.rpc(name, body);
  return {
    status: reply.status,
    data: (reply.data as T | null) ?? null,
    error: reply.error
      ? {
          code: reply.error.code,
          message: reply.error.message,
          details: reply.error.details,
          hint: reply.error.hint,
        }
      : null,
  };
}

export function push(rasika: Rasika, ops: PushOp[], deviceId = rasika.deviceId) {
  return rpc<PushResponse>(rasika.client, SYNC_FUNCTIONS.push, {
    deviceId,
    ops,
  } satisfies PushRequest);
}

/** A push that must answer 200. */
export async function pushOk(rasika: Rasika, ops: PushOp[]): Promise<PushResponse> {
  const reply = await push(rasika, ops);
  expect(reply.error).toBeNull();
  expect(reply.status).toBe(200);
  return reply.data!;
}

export function pull(rasika: Rasika, body: PullRequest = {}) {
  return rpc<PullResponse>(rasika.client, SYNC_FUNCTIONS.pull, body);
}

/** Pulls from `cursor` until `more` is false, as the phone does; returns every change and the last cursor. */
export async function pullAll(
  rasika: Rasika,
  { cursor = '', limit }: { cursor?: string; limit?: number } = {},
): Promise<{ changes: PullChange[]; cursor: string; pages: number }> {
  const changes: PullChange[] = [];
  let pages = 0;
  for (;;) {
    const reply = await pull(rasika, { cursor, limit });
    expect(reply.error).toBeNull();
    const page = reply.data!;
    changes.push(...page.changes);
    cursor = page.cursor;
    pages += 1;
    if (!page.more) return { changes, cursor, pages };
    if (pages > 1000) throw new Error('pull never finished');
  }
}

export function me(rasika: Rasika) {
  return rpc<MeResponse>(rasika.client, SYNC_FUNCTIONS.me);
}

export function consent(rasika: Rasika, body: ConsentRequest) {
  return rpc<ConsentResponse>(rasika.client, SYNC_FUNCTIONS.consent, body);
}

export function claim(rasika: Rasika, body: ClaimRequest) {
  return rpc<ClaimResponse>(rasika.client, SYNC_FUNCTIONS.claim, body);
}

/** Calls any function by name, with any client. */
export function call(client: SupabaseClient, name: string, body?: object) {
  return rpc<unknown>(client, name, body);
}

// Records, shaped as the phone stores them.

const now = () => new Date().toISOString();
const timestamps = () => ({ createdAt: now(), updatedAt: now(), deletedAt: null });
const unresolved = (text: string): DetailValue => ({
  state: 'unresolved',
  key: null,
  text,
  guess: false,
});
const notApplicable: DetailValue = { state: 'na', key: null, text: '', guess: false };

export function newEvent(fields: Partial<Event> = {}): Event {
  return {
    id: randomUUID(),
    kind: 'concert',
    date: '2026-12-14',
    startTime: '18:30',
    sabhaId: null,
    status: 'attended',
    cancelled: false,
    source: 'spot',
    scheduleEntryId: null,
    scheduleVersionSeen: null,
    scheduleChanged: false,
    touched: true,
    title: null,
    note: null,
    ...timestamps(),
    ...fields,
  };
}

export function newItem(eventId: string, position: number, fields: Partial<Item> = {}): Item {
  return {
    id: randomUUID(),
    eventId,
    position,
    compositionKey: null,
    title: `Item ${position}`,
    form: unresolved('kriti'),
    ragas: [unresolved('?')],
    tala: unresolved('adi'),
    nadai: notApplicable,
    composer: { state: 'unknown', key: null, text: '?', guess: false },
    language: unresolved('telugu'),
    subject: unresolved('?'),
    layaVinyasam: null,
    improvised: [],
    note: null,
    ...timestamps(),
    ...fields,
  };
}

export function newArtist(name: string): Artist {
  return {
    id: randomUUID(),
    name,
    nameKey: name.toLowerCase(),
    aliases: [],
    mergedIntoId: null,
    ...timestamps(),
  };
}

export function newSabha(name: string): Sabha {
  return newArtist(name);
}

export function newAppearance(eventId: string, artistId: string, position: number): Appearance {
  return {
    id: randomUUID(),
    eventId,
    artistId,
    role: 'vocal',
    colourPrimary: 'blue',
    colourSecondary: null,
    billed: false,
    group: null,
    position,
    ...timestamps(),
  };
}

/** An outbox op for `row`, with a new opId. */
export function op<T extends RasikaTable>(table: T, row: RasikaRows[T], baseSeq = 0): PushOp {
  return { opId: randomUUID(), table, baseSeq, row } as PushOp;
}

/** The latest row of each record in `changes`, by table and id. */
export function latestRows(changes: PullChange[]): Map<string, unknown> {
  const rows = new Map<string, unknown>();
  for (const change of changes) rows.set(`${change.table}:${change.row.id}`, change.row);
  return rows;
}
