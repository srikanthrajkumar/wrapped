// Required tests (constitution IV, "sync without duplicates"; T069). The phone's side of sync
// against a scripted server: every failure the contract names leaves the outbox and the season
// as they were, rejected ops are kept and counted, and a pulled row never replaces a record the
// phone still has to send. The scenarios that need the server's own rules (re-claiming, another
// device's edit, a lost reply) run against the local stack in supabase/tests/sync-client.test.ts.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  newId,
  type Event,
  type PullChange,
  type PullRequest,
  type PullResponse,
  type PushRequest,
  type PushResponse,
} from '../../src/model';
import { discard, keepMine, keepServers, listAttention, tryAgain } from '../../src/store/attention';
import type { WrappedDB } from '../../src/store/db';
import { save } from '../../src/store/mutate';
import { countUnsynced } from '../../src/store/outbox';
import {
  applyPullPage,
  createSyncLoop,
  PULL_CURSOR_KEY,
  pushBatch,
  syncOnce,
  type SyncLoop,
  type SyncLoopOptions,
} from '../../src/store/sync';
import { readReply, SyncError, type SyncApi } from '../../src/store/sync-api';
import { freshDb, reopen } from '../helpers';

function concert(overrides: Partial<Event> = {}): Event {
  const now = new Date().toISOString();
  return {
    id: newId(),
    kind: 'concert',
    date: '2026-12-15',
    startTime: '16:00',
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
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

/** A failed call, read exactly as a real reply would be. */
function failWith(
  status: number,
  error: { code?: string; message?: string; details?: string | null } = {},
) {
  return (): never => {
    readReply({
      data: null,
      status,
      error: {
        code: error.code ?? '',
        message: error.message ?? `HTTP ${status}`,
        details: error.details ?? null,
        hint: null,
      },
    });
    throw new Error(`a ${status} was read as a success`);
  };
}

/** A server whose answers each test scripts. By default it acks every op and has nothing new. */
class ScriptedServer implements SyncApi {
  pushes: PushRequest[] = [];
  pulls: PullRequest[] = [];
  seq = 100;
  onPush: (request: PushRequest) => PushResponse | Promise<PushResponse> = (request) =>
    this.ackAll(request);
  onPull: (request: PullRequest) => PullResponse | Promise<PullResponse> = () => ({
    changes: [],
    cursor: 'c1',
    more: false,
  });

  ackAll(request: PushRequest): PushResponse {
    return { acked: request.ops.map((op) => ({ opId: op.opId, seq: ++this.seq })), rejected: [] };
  }

  async push(request: PushRequest) {
    this.pushes.push(structuredClone(request));
    return this.onPush(request);
  }
  async pull(request: PullRequest) {
    this.pulls.push(request);
    return this.onPull(request);
  }
  claim = () => Promise.reject(new Error('not scripted'));
  me = () => Promise.reject(new Error('not scripted'));
  consent = () => Promise.reject(new Error('not scripted'));
}

/** Everything the season holds, to compare before and after a failure. */
async function snapshot(db: WrappedDB) {
  return {
    events: await db.events.toArray(),
    outbox: await db.outbox.toArray(),
  };
}

const loops: SyncLoop[] = [];
afterEach(() => {
  for (const loop of loops.splice(0)) loop.dispose();
  vi.unstubAllGlobals();
});

/** Wait until `done()` holds; for a push or pull a test has left on its way. */
async function until(done: () => boolean) {
  for (let tries = 0; !done(); tries += 1) {
    if (tries > 200) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

/** A reply the test lets through when it chooses. */
function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { open, opened };
}

const rejectAll =
  (code: 'conflict' | 'invalid_op') =>
  (request: PushRequest): PushResponse => ({
    acked: [],
    rejected: request.ops.map((op) => ({ opId: op.opId, code, message: 'rejected' })),
  });

/**
 * A synced Event whose next edit (`note: 'mine'`) the server rejected `conflict`, with the
 * other device's version (seq 150, `note: 'iPad'`) held by the pull that followed.
 */
async function conflicted(db: WrappedDB, server: ScriptedServer) {
  const event = concert({ note: 'v1' });
  await save('events', event, { db });
  await syncOnce(server, { db });
  await save('events', { ...event, note: 'mine' }, { db });
  server.onPush = rejectAll('conflict');
  server.onPull = () => ({
    changes: [{ table: 'events', seq: 150, row: { ...event, note: 'iPad' } }],
    cursor: 'c2',
    more: false,
  });
  await syncOnce(server, { db });
  server.onPull = () => ({ changes: [], cursor: 'c2', more: false });
  const [entry] = await listAttention(db);
  expect(entry).toMatchObject({ code: 'conflict', server: { note: 'iPad' } });
  return { event, entry: entry! };
}

/** A server that refuses an op on `event` unless it is based on seq 150, as the real one does. */
function onlyOn150(server: ScriptedServer) {
  return (request: PushRequest): PushResponse => {
    const answer: PushResponse = { acked: [], rejected: [] };
    for (const op of request.ops) {
      if (op.baseSeq === 150) answer.acked.push({ opId: op.opId, seq: ++server.seq });
      else answer.rejected.push({ opId: op.opId, code: 'conflict', message: 'newer (seq 150)' });
    }
    return answer;
  };
}

/**
 * A loop with a recorded, never-firing retry timer, so a test can fire it itself. It holds a
 * stand-in for the Web Lock, since Node has none; pass `{ lock: undefined }` for the real one.
 */
function loopFor(db: WrappedDB, server: SyncApi | null, extra: Partial<SyncLoopOptions> = {}) {
  const timers: { run: () => void; ms: number }[] = [];
  const loop = createSyncLoop({
    db,
    getApi: async () => server,
    random: () => 0.5,
    setTimer: (run, ms) => {
      timers.push({ run, ms });
      return timers.length;
    },
    clearTimer: () => {},
    lock: (_name, work) => work(),
    ...extra,
  });
  loops.push(loop);
  return { loop, timers };
}

describe('sync client (required)', () => {
  it('pushes the outbox in order, then pulls, and empties the outbox only on acks', async () => {
    const db = freshDb();
    const events = [concert(), concert(), concert()];
    for (const event of events) await save('events', event, { db });
    const server = new ScriptedServer();

    await syncOnce(server, { db });

    expect(server.pushes).toHaveLength(1);
    expect(server.pushes[0]!.ops.map((op) => op.row.id)).toEqual(events.map((e) => e.id));
    expect(server.pushes[0]!.ops.every((op) => op.baseSeq === 0)).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    expect(server.pulls).toHaveLength(1);
    expect((await db.meta.get(PULL_CURSOR_KEY))?.value).toBe('c1');
    // Each ack's seq is the base of the record's next op (eng review D11).
    await save('events', { ...events[0]!, note: 'later' }, { db });
    await syncOnce(server, { db });
    expect(server.pushes[1]!.ops[0]!.baseSeq).toBe(101);
  });

  it.each([
    ['401', failWith(401), 'stopped', 'signed_out'],
    ['network error', failWith(0, { message: 'TypeError: fetch failed' }), 'waiting', 'network'],
    ['5xx', failWith(503), 'waiting', 'network'],
    [
      '426',
      failWith(426, { code: 'update_required', details: '0.2.0' }),
      'stopped',
      'update_required',
    ],
  ])('a %s leaves the outbox and local data intact', async (_name, fail, state, kind) => {
    const db = freshDb();
    await save('events', concert(), { db });
    await save('events', concert({ note: 'second' }), { db });
    const before = await snapshot(db);
    const server = new ScriptedServer();
    server.onPush = fail;
    const { loop } = loopFor(db, server);

    await loop.request('start');

    const status = loop.status();
    expect(status.state).toBe(state);
    expect('failure' in status && status.failure.kind).toBe(kind);
    const after = await snapshot(db);
    expect(after.events).toEqual(before.events);
    expect(after.outbox.map((entry) => [entry.opId, entry.row])).toEqual(
      before.outbox.map((entry) => [entry.opId, entry.row]),
    );
    expect(server.pulls).toHaveLength(0);
  });

  it('a 426 stops syncing until the next launch, and logging carries on', async () => {
    const db = freshDb();
    await save('events', concert(), { db });
    const server = new ScriptedServer();
    server.onPush = failWith(426, { code: 'update_required', details: '0.2.0' });
    const { loop } = loopFor(db, server);

    await loop.request('start');
    await save('events', concert(), { db });
    await loop.request('save');
    await loop.request('online');

    expect(server.pushes).toHaveLength(1);
    expect(loop.status()).toMatchObject({
      state: 'stopped',
      failure: { kind: 'update_required', minimumVersion: '0.2.0' },
    });
    expect(await db.outbox.count()).toBe(2);
  });

  it('retries a network error with backoff, from the same head with the same ops', async () => {
    const db = freshDb();
    const events = [concert(), concert()];
    for (const event of events) await save('events', event, { db });
    const server = new ScriptedServer();
    // The server stored the push, but the reply never came back.
    server.onPush = (request) => {
      server.ackAll(request);
      throw new SyncError({ kind: 'network', status: 0, message: 'reply lost' });
    };
    const { loop, timers } = loopFor(db, server, { baseDelayMs: 1000 });

    await loop.request('start');
    expect(loop.status().state).toBe('waiting');
    // Full jitter: half of the first ceiling, then half of twice it.
    expect(timers.map((timer) => timer.ms)).toEqual([500]);

    // A save while waiting doesn't skip the backoff; it joins the next attempt.
    const third = concert();
    await save('events', third, { db });
    await loop.request('save');
    expect(server.pushes).toHaveLength(1);

    server.onPush = (request) => server.ackAll(request);
    timers[0]!.run();
    await loop.request('resume');

    const [lost, retry] = server.pushes;
    expect(retry!.ops.length).toBeGreaterThanOrEqual(lost!.ops.length);
    expect(retry!.ops.slice(0, lost!.ops.length)).toEqual(lost!.ops);
    expect(retry!.ops.map((op) => op.row.id)).toEqual([...events, third].map((e) => e.id));
    expect(await db.outbox.count()).toBe(0);
    expect(loop.status().state).toBe('idle');
  });

  it('a 409 stops pushing and keeps the outbox until the device claims again', async () => {
    const db = freshDb();
    await save('events', concert(), { db });
    const server = new ScriptedServer();
    const ipad = newId();
    server.onPush = failWith(409, { code: 'not_writer', details: ipad });
    const { loop } = loopFor(db, server);

    await loop.request('start');
    await save('events', concert(), { db });
    await loop.request('save');
    await loop.request('visible');

    expect(server.pushes).toHaveLength(1);
    expect(loop.status()).toMatchObject({
      state: 'stopped',
      failure: { kind: 'not_writer', writerDeviceId: ipad },
    });
    expect(await db.outbox.count()).toBe(2);

    server.onPush = (request) => server.ackAll(request);
    await loop.resume();
    expect(server.pushes.at(-1)!.ops).toHaveLength(2);
    expect(await db.outbox.count()).toBe(0);
  });

  it('a 400 stops the loop at once and moves the batch into "needs attention", kept across a relaunch', async () => {
    const db = freshDb();
    const first = concert({ note: 'first' });
    const second = concert({ note: 'second' });
    await save('events', first, { db });
    await save('events', second, { db });
    const before = await snapshot(db);
    const server = new ScriptedServer();
    server.onPush = failWith(400, { code: 'bad_request', message: 'opId must be a uuid' });
    const { loop, timers } = loopFor(db, server);

    await loop.request('start');
    await loop.request('online');

    expect(server.pushes).toHaveLength(1);
    expect(timers).toHaveLength(0);
    expect(loop.status()).toMatchObject({
      state: 'stopped',
      failure: { kind: 'bad_request', opIds: before.outbox.map((entry) => entry.opId) },
    });
    // Out of the outbox, so the batch can't block every later sync, but kept and counted.
    expect(await db.outbox.count()).toBe(0);
    expect(await countUnsynced(db)).toBe(2);
    expect((await snapshot(db)).events).toEqual(before.events);

    // A relaunch finds the batch still listed, and syncs past it.
    const relaunched = reopen(db);
    const listed = await listAttention(relaunched);
    expect(listed.map((entry) => [entry.recordId, entry.code, entry.message])).toEqual([
      [first.id, 'bad_request', 'opId must be a uuid'],
      [second.id, 'bad_request', 'opId must be a uuid'],
    ]);
    expect(await countUnsynced(relaunched)).toBe(2);
    server.onPush = (request) => server.ackAll(request);
    await loopFor(relaunched, server).loop.request('start');
    expect(server.pushes).toHaveLength(1);
    expect(server.pulls).toHaveLength(1);

    // "Try again" sends the record again; "discard" lets it go and keeps the row.
    const opFor = (id: string) => listed.find((entry) => entry.recordId === id)!.opId;
    await tryAgain(opFor(first.id), relaunched);
    await syncOnce(server, { db: relaunched });
    expect(server.pushes.at(-1)!.ops.map((op) => (op.row as Event).note)).toEqual(['first']);
    await discard(opFor(second.id), { db: relaunched });
    expect(await listAttention(relaunched)).toEqual([]);
    expect(await countUnsynced(relaunched)).toBe(0);
    expect((await relaunched.events.get(second.id))?.note).toBe('second');
  });

  it('keeps a rejected op locally, lists it as needing attention, and still counts it', async () => {
    const db = freshDb();
    const kept = concert({ note: 'rejected' });
    const acked = concert();
    await save('events', kept, { db });
    await save('events', acked, { db });
    const server = new ScriptedServer();
    server.onPush = (request) => ({
      acked: [{ opId: request.ops[1]!.opId, seq: 7 }],
      rejected: [{ opId: request.ops[0]!.opId, code: 'invalid_op', message: 'bad row' }],
    });

    await syncOnce(server, { db });

    expect(await db.outbox.count()).toBe(0);
    expect((await db.events.get(kept.id))?.note).toBe('rejected');
    const attention = await listAttention(db);
    expect(attention).toMatchObject([
      { recordId: kept.id, code: 'invalid_op', message: 'bad row' },
    ]);
    expect(await countUnsynced(db)).toBe(1);
    // Never re-sent in a loop.
    await syncOnce(server, { db });
    expect(server.pushes).toHaveLength(1);
  });

  it('a row edited while a pull is in flight keeps the edit, and the edit reaches the server (D4)', async () => {
    const db = freshDb();
    const event = concert({ note: 'first' });
    await save('events', event, { db });
    const server = new ScriptedServer();
    await syncOnce(server, { db });
    const serverCopy = server.pushes[0]!.ops[0]!.row as Event;

    server.onPull = async () => {
      // The rasika edits while the page is on its way.
      await save('events', { ...event, note: 'edited in the hall' }, { db });
      return {
        // A server version this phone hasn't applied yet, as on a restore or a first pull.
        changes: [{ table: 'events', seq: 150, row: { ...serverCopy, note: 'first' } }],
        cursor: 'c2',
        more: false,
      };
    };
    await syncOnce(server, { db });
    expect((await db.events.get(event.id))?.note).toBe('edited in the hall');

    server.onPull = () => ({ changes: [], cursor: 'c2', more: false });
    await syncOnce(server, { db });
    const last = server.pushes.at(-1)!.ops;
    expect(last.map((op) => [op.row.id, (op.row as Event).note])).toEqual([
      [event.id, 'edited in the hall'],
    ]);
  });

  it('a pulled row never replaces a record whose op was rejected', async () => {
    const db = freshDb();
    const event = concert({ note: 'mine' });
    await save('events', event, { db });
    const server = new ScriptedServer();
    server.onPush = (request) => ({
      acked: [],
      rejected: [{ opId: request.ops[0]!.opId, code: 'conflict', message: 'newer (seq 40)' }],
    });
    const theirs = { ...event, note: 'theirs' };
    server.onPull = () => ({
      changes: [{ table: 'events', seq: 40, row: theirs }],
      cursor: 'c1',
      more: false,
    });

    await syncOnce(server, { db });

    expect((await db.events.get(event.id))?.note).toBe('mine');
    const [entry] = await listAttention(db);
    expect(entry).toMatchObject({ code: 'conflict', local: { note: 'mine' }, server: theirs });
  });

  it('a held server version never becomes the base of a queued op (D11)', async () => {
    const db = freshDb();
    const event = concert({ note: 'v1' });
    await save('events', event, { db });
    const server = new ScriptedServer();
    await syncOnce(server, { db });
    // Edited offline; not yet sent.
    await save('events', { ...event, note: 'v2, queued' }, { db });
    // Another device wrote seq 300 meanwhile; a pull sees it while the edit waits.
    await applyPullPage(db, {
      changes: [{ table: 'events', seq: 300, row: { ...event, note: 'iPad' } }],
      cursor: 'c1',
      more: false,
    });
    expect((await db.events.get(event.id))?.note).toBe('v2, queued');

    await syncOnce(server, { db });
    // Based on the seq this phone last wrote, so the server can refuse it as a conflict.
    expect(server.pushes.at(-1)!.ops[0]).toMatchObject({
      baseSeq: 101,
      row: { note: 'v2, queued' },
    });
  });

  it('"keep mine" re-sends the phone’s row on the server’s newer seq; "keep the server’s" stores theirs', async () => {
    const db = freshDb();
    const mine = concert({ note: 'mine' });
    const other = concert({ note: 'mine too' });
    await save('events', mine, { db });
    await save('events', other, { db });
    const server = new ScriptedServer();
    server.onPush = (request) => ({
      acked: [],
      rejected: request.ops.map((op) => ({
        opId: op.opId,
        code: 'conflict' as const,
        message: '',
      })),
    });
    const changes: PullChange[] = [
      { table: 'events', seq: 50, row: { ...mine, note: 'server' } },
      { table: 'events', seq: 51, row: { ...other, note: 'server too' } },
    ];
    server.onPull = () => ({ changes, cursor: 'c1', more: false });
    await syncOnce(server, { db });
    const attention = await listAttention(db);
    const opFor = (id: string) => attention.find((entry) => entry.recordId === id)!.opId;

    // Edited again before choosing: a queued op "keep the server's" drops with the rest.
    await save('events', { ...other, note: 'mine, edited again' }, { db });
    await keepMine(opFor(mine.id), db);
    await keepServers(opFor(other.id), { db });
    server.onPush = (request) => server.ackAll(request);
    server.onPull = () => ({ changes: [], cursor: 'c1', more: false });
    await syncOnce(server, { db });

    expect(server.pushes.at(-1)!.ops).toMatchObject([
      { baseSeq: 50, row: { id: mine.id, note: 'mine' } },
    ]);
    expect((await db.events.get(other.id))?.note).toBe('server too');
    expect(await listAttention(db)).toEqual([]);
    expect(await countUnsynced(db)).toBe(0);
  });

  it('runs one sync at a time, and once more for requests made during it', async () => {
    const db = freshDb();
    await save('events', concert(), { db });
    const server = new ScriptedServer();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.onPull = async () => {
      await gate;
      return { changes: [], cursor: 'c', more: false };
    };
    const { loop } = loopFor(db, server);

    const first = loop.request('start');
    await new Promise((resolve) => setTimeout(resolve, 10));
    void loop.request('save');
    void loop.request('online');
    release();
    await first;

    expect(server.pulls).toHaveLength(2);
  });

  it('does nothing without a session, and logging is untouched (FR-018)', async () => {
    const db = freshDb();
    await save('events', concert(), { db });
    const { loop } = loopFor(db, null);

    await loop.request('start');

    expect(loop.status()).toMatchObject({ state: 'stopped', failure: { kind: 'signed_out' } });
    expect(await db.outbox.count()).toBe(1);
  });
});

describe('late replies, tabs and the rasika’s choices (required)', () => {
  it('runs one sync at a time across tabs, through the Web Locks API', async () => {
    const names: string[] = [];
    let tail = Promise.resolve();
    vi.stubGlobal('navigator', {
      locks: {
        request(name: string, work: () => Promise<void>) {
          names.push(name);
          const run = tail.then(work);
          tail = run.catch(() => undefined);
          return run;
        },
      },
    });
    const db = freshDb();
    await save('events', concert(), { db });
    const server = new ScriptedServer();
    let sending = 0;
    let most = 0;
    server.onPush = async (request) => {
      most = Math.max(most, ++sending);
      await new Promise((resolve) => setTimeout(resolve, 10));
      sending -= 1;
      return server.ackAll(request);
    };
    // Two tabs, each with its own loop on the same store.
    const tabs = [
      loopFor(db, server, { lock: undefined }).loop,
      loopFor(db, server, { lock: undefined }).loop,
    ];

    await Promise.all(tabs.map((tab) => tab.request('start')));

    expect(names).toEqual([`wrapped-sync:${db.name}`, `wrapped-sync:${db.name}`]);
    expect(most).toBe(1);
    expect(server.pushes).toHaveLength(1);
    expect(await countUnsynced(db)).toBe(0);
  });

  it('does not sync without Web Locks, and keeps the outbox', async () => {
    vi.stubGlobal('navigator', {});
    const db = freshDb();
    await save('events', concert(), { db });
    const server = new ScriptedServer();
    const { loop } = loopFor(db, server, { lock: undefined });

    await loop.request('start');

    expect(server.pushes).toHaveLength(0);
    expect(server.pulls).toHaveLength(0);
    expect(loop.status()).toMatchObject({
      state: 'stopped',
      failure: { kind: 'refused', code: 'web_locks_missing' },
    });
    expect(await countUnsynced(db)).toBe(1);
  });

  it('a late ack of an earlier op never clears a later op’s rejection', async () => {
    const db = freshDb();
    const server = new ScriptedServer();
    const event = concert({ note: 'v1' });
    await save('events', event, { db });
    await syncOnce(server, { db });
    await save('events', { ...event, note: 'A' }, { db });

    // Tab 2 sends A, and its reply is slow.
    const slow = gate();
    server.onPush = async (request) => {
      const answer = server.ackAll(request);
      await slow.opened;
      return answer;
    };
    const late = pushBatch(server, { db });
    await until(() => server.pushes.length === 2);
    // Tab 1 sends A again and gets the server's repeated answer at once.
    const seqOfA = server.seq;
    server.onPush = (request) => ({
      acked: request.ops.map((op) => ({ opId: op.opId, seq: seqOfA })),
      rejected: [],
    });
    await pushBatch(server, { db });
    // Edit B is rejected `conflict`, and the pull holds the other device's version.
    await save('events', { ...event, note: 'B' }, { db });
    server.onPush = rejectAll('conflict');
    server.onPull = () => ({
      changes: [{ table: 'events', seq: 150, row: { ...event, note: 'iPad' } }],
      cursor: 'c2',
      more: false,
    });
    await syncOnce(server, { db });

    slow.open();
    await late;

    expect(await listAttention(db)).toMatchObject([
      { code: 'conflict', local: { note: 'B' }, server: { note: 'iPad' } },
    ]);
    expect(await countUnsynced(db)).toBe(1);
  });

  it('a late rejection of an op the rasika has settled since changes nothing', async () => {
    const db = freshDb();
    const server = new ScriptedServer();
    const event = concert({ note: 'v1' });
    await save('events', event, { db });
    await syncOnce(server, { db });
    await save('events', { ...event, note: 'mine' }, { db });

    // Tab 2 sends the edit, and its reply is slow.
    const slow = gate();
    server.onPush = async (request) => {
      await slow.opened;
      return rejectAll('conflict')(request);
    };
    const late = pushBatch(server, { db });
    await until(() => server.pushes.length === 2);
    // Tab 1 sends it too, is refused, and the pull holds the other device's version.
    server.onPush = rejectAll('conflict');
    server.onPull = () => ({
      changes: [{ table: 'events', seq: 150, row: { ...event, note: 'iPad' } }],
      cursor: 'c2',
      more: false,
    });
    await syncOnce(server, { db });
    const [entry] = await listAttention(db);
    await keepServers(entry!.opId, { db });

    slow.open();
    await late;

    expect(await listAttention(db)).toEqual([]);
    expect(await countUnsynced(db)).toBe(0);
    expect((await db.events.get(event.id))?.note).toBe('iPad');
  });

  it('"keep the server’s" drops an op already sent, so the record can’t be stuck in "needs attention"', async () => {
    const db = freshDb();
    const server = new ScriptedServer();
    const { event, entry } = await conflicted(db, server);
    // Edited again in a hall with bad signal: the push goes out and no reply comes back.
    await save('events', { ...event, note: 'mine again' }, { db });
    server.onPush = failWith(0, { message: 'TypeError: fetch failed' });
    await expect(syncOnce(server, { db })).rejects.toThrow(SyncError);

    await keepServers(entry.opId, { db });
    server.onPush = onlyOn150(server);
    await syncOnce(server, { db });

    expect(await listAttention(db)).toEqual([]);
    expect(await countUnsynced(db)).toBe(0);
    expect((await db.events.get(event.id))?.note).toBe('iPad');
    // The next edit is based on the server's version, and is acked.
    await save('events', { ...event, note: 'after' }, { db });
    await syncOnce(server, { db });
    expect(server.pushes.at(-1)!.ops).toMatchObject([{ baseSeq: 150, row: { note: 'after' } }]);
    expect(await countUnsynced(db)).toBe(0);
  });

  it('"keep the server’s" chosen while a push is on its way: its reply settles nothing', async () => {
    const db = freshDb();
    const server = new ScriptedServer();
    const { event, entry } = await conflicted(db, server);
    await save('events', { ...event, note: 'mine again' }, { db });
    const slow = gate();
    server.onPush = async (request) => {
      await slow.opened;
      return onlyOn150(server)(request);
    };
    const sync = syncOnce(server, { db });
    await until(() => server.pushes.length === 3);

    await keepServers(entry.opId, { db });
    slow.open();
    await sync;

    expect(await listAttention(db)).toEqual([]);
    expect(await countUnsynced(db)).toBe(0);
    expect((await db.events.get(event.id))?.note).toBe('iPad');
  });

  it('"discard" of a conflict keeps the server’s version', async () => {
    const db = freshDb();
    const server = new ScriptedServer();
    const { event, entry } = await conflicted(db, server);
    await save('events', { ...event, note: 'mine, edited again' }, { db });

    await discard(entry.opId, { db });
    server.onPush = onlyOn150(server);
    await syncOnce(server, { db });

    expect((await db.events.get(event.id))?.note).toBe('iPad');
    expect(await listAttention(db)).toEqual([]);
    expect(await countUnsynced(db)).toBe(0);
    expect(server.pushes).toHaveLength(2);
  });

  it('an ack of a later edit clears the record’s earlier rejection', async () => {
    const db = freshDb();
    const event = concert({ note: 'rejected' });
    await save('events', event, { db });
    const server = new ScriptedServer();
    server.onPush = rejectAll('invalid_op');
    await syncOnce(server, { db });
    expect(await countUnsynced(db)).toBe(1);

    await save('events', { ...event, note: 'fixed' }, { db });
    server.onPush = (request) => server.ackAll(request);
    await syncOnce(server, { db });

    expect(await listAttention(db)).toEqual([]);
    expect(await countUnsynced(db)).toBe(0);
  });

  it('a pull page answered before the phone’s latest ack never rolls the record back', async () => {
    const db = freshDb();
    const event = concert({ note: 'v1' });
    await save('events', event, { db });
    const server = new ScriptedServer();
    await syncOnce(server, { db });
    // A page another tab asked for while v1 (seq 101) was the server's latest.
    const early: PullResponse = {
      changes: [{ table: 'events', seq: 101, row: event }],
      cursor: 'c1',
      more: false,
    };
    await save('events', { ...event, note: 'v2' }, { db });
    await syncOnce(server, { db });

    await applyPullPage(db, early);

    expect((await db.events.get(event.id))?.note).toBe('v2');
    await save('events', { ...event, note: 'v3' }, { db });
    await syncOnce(server, { db });
    expect(server.pushes.at(-1)!.ops[0]!.baseSeq).toBe(102);
  });

  it('stops when a pull answers `more` without moving its cursor', async () => {
    const db = freshDb();
    const server = new ScriptedServer();
    server.onPull = () => {
      if (server.pulls.length > 5) throw new Error('pulled forever');
      return { changes: [], cursor: 'same', more: true };
    };

    const failure = await syncOnce(server, { db }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SyncError);
    expect((failure as SyncError).failure).toMatchObject({ kind: 'refused', code: 'stuck_cursor' });
    expect(server.pulls).toHaveLength(2);
  });

  it('stops when a push is answered with none of its ops, and keeps them', async () => {
    const db = freshDb();
    await save('events', concert(), { db });
    const server = new ScriptedServer();
    server.onPush = () => {
      if (server.pushes.length > 5) throw new Error('pushed forever');
      return { acked: [], rejected: [] };
    };

    const failure = await syncOnce(server, { db }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SyncError);
    expect((failure as SyncError).failure).toMatchObject({ kind: 'refused', code: 'unanswered' });
    expect(server.pushes).toHaveLength(1);
    expect(await db.outbox.count()).toBe(1);
  });

  it('a retry repeats the lost push with the bases it was first sent with', async () => {
    const db = freshDb();
    const server = new ScriptedServer();
    const { event, entry } = await conflicted(db, server);
    await save('events', { ...event, note: 'mine again' }, { db });
    server.onPush = failWith(0, { message: 'TypeError: fetch failed' });
    await expect(syncOnce(server, { db })).rejects.toThrow(SyncError);
    const lost = server.pushes.at(-1)!;

    // "Keep mine" moves the record's base to the server's version before the retry.
    await keepMine(entry.opId, db);
    server.onPush = (request) => server.ackAll(request);
    await syncOnce(server, { db });

    const retry = server.pushes.at(-1)!;
    expect(retry.ops.slice(0, lost.ops.length)).toEqual(lost.ops);
    expect(lost.ops[0]!.baseSeq).toBe(101);
    expect(retry.ops.at(-1)).toMatchObject({ baseSeq: 150, row: { note: 'mine again' } });
  });
});
