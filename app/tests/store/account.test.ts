// The account on the phone (T079, T081-T083): consent answers and the writer claim are local
// writes the next sync carries, before its push; a failure leaves them and the outbox as they
// were. And restore: the claim, then the push of what was logged on the empty phone, then the
// pull from an empty cursor, with first launch waiting at most 10 seconds for it.

import { afterEach, describe, expect, it } from 'vitest';
import {
  newId,
  type ClaimRequest,
  type ConsentRequest,
  type Event,
  type MeResponse,
  type PullRequest,
  type PushRequest,
} from '../../src/model';
import {
  ACCOUNT_KEY,
  ACCOUNT_KEYS,
  accountAsked,
  answerConsent,
  CLAIM_PENDING_KEY,
  CONSENT_PENDING_KEY,
  deviceLabel,
  readConsent,
  requestClaim,
  sendConsent,
  settleConsent,
  storeAccount,
} from '../../src/store/account';
import {
  ConsentWaitingError,
  readIdentity,
  recordIdentity,
  sendLastAccountsConsent,
  type Identity,
} from '../../src/store/auth';
import { save } from '../../src/store/mutate';
import { restoreAfterSignIn } from '../../src/store/restore';
import { createSyncLoop, syncOnce, type SyncLock } from '../../src/store/sync';
import { changeConsent, startSync } from '../../src/store/sync-runtime';
import { readReply, SyncError, type SyncApi } from '../../src/store/sync-api';
import { freshDb } from '../helpers';

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

/** A server that records every call in order; the writer is whichever device claimed last. */
class AccountServer implements SyncApi {
  calls: string[] = [];
  writer: string | null = 'ipad';
  consents: ConsentRequest[] = [];
  season: Event[] = [];
  seq = 0;
  failClaim: (() => never) | null = null;
  onConsent: (() => Promise<void>) | null = null;

  async claim(request: ClaimRequest) {
    this.calls.push('claim');
    if (this.failClaim) this.failClaim();
    this.writer = request.deviceId;
    return { writerDeviceId: request.deviceId };
  }
  async consent(request: ConsentRequest) {
    this.calls.push('consent');
    await this.onConsent?.();
    this.consents.push(request);
    return {
      shareAdditions: request.shareAdditions ?? null,
      seasonReports: request.seasonReports ?? null,
    };
  }
  async push(request: PushRequest) {
    this.calls.push('push');
    if (request.deviceId !== this.writer) {
      readReply({
        data: null,
        status: 409,
        error: { code: 'not_writer', message: '', details: this.writer, hint: null },
      });
    }
    for (const op of request.ops) this.season.push(op.row as Event);
    return { acked: request.ops.map((op) => ({ opId: op.opId, seq: ++this.seq })), rejected: [] };
  }
  async pull(request: PullRequest) {
    this.calls.push(`pull:${request.cursor}`);
    return {
      changes: this.season.map((row, index) => ({
        table: 'events' as const,
        seq: index + 1,
        row,
      })),
      cursor: 'end',
      more: false,
    };
  }
  me = () => Promise.reject(new Error('not scripted'));
}

describe('consent answers', () => {
  it('start unanswered, are kept on the phone at once, and the next sync sends them', async () => {
    const db = freshDb();
    expect(await readConsent(db)).toEqual({ shareAdditions: null, seasonReports: null });
    await answerConsent('shareAdditions', false, db);
    await answerConsent('seasonReports', true, db);
    expect(await readConsent(db)).toEqual({ shareAdditions: false, seasonReports: true });

    const server = new AccountServer();
    server.writer = null;
    await syncOnce(server, { db });
    expect(server.consents).toEqual([{ shareAdditions: false, seasonReports: true }]);
    expect(await db.meta.get(CONSENT_PENDING_KEY)).toBeUndefined();
  });

  it('an answer changed while the call is on its way is sent again next time', async () => {
    const db = freshDb();
    await answerConsent('shareAdditions', true, db);
    const server = new AccountServer();
    server.onConsent = async () => {
      server.onConsent = null;
      await answerConsent('shareAdditions', false, db);
    };
    await syncOnce(server, { db });
    expect(await readConsent(db)).toMatchObject({ shareAdditions: false });
    await syncOnce(server, { db });
    expect(server.consents).toEqual([{ shareAdditions: true }, { shareAdditions: false }]);
    expect(await db.meta.get(CONSENT_PENDING_KEY)).toBeUndefined();
  });

  it('a failed call keeps the answer to send, and the outbox as it was', async () => {
    const db = freshDb();
    await save('events', concert(), { db });
    await answerConsent('seasonReports', false, db);
    const server = new AccountServer();
    server.consent = () =>
      Promise.reject(new SyncError({ kind: 'network', status: 0, message: '' }));
    await expect(syncOnce(server, { db })).rejects.toThrow(SyncError);
    expect((await db.meta.get(CONSENT_PENDING_KEY))?.value).toEqual({ seasonReports: false });
    expect(await db.outbox.count()).toBe(1);
  });

  it('the server’s answers replace the phone’s only when none is waiting to be sent', async () => {
    const db = freshDb();
    const me: MeResponse = {
      id: newId(),
      name: 'Rasika',
      shareAdditions: true,
      seasonReports: true,
      writerDeviceId: null,
      deletionContact: 'privacy@example.test',
    };
    await answerConsent('shareAdditions', false, db);
    await storeAccount(me, await accountAsked(db), db);
    expect(await readConsent(db)).toMatchObject({ shareAdditions: false, seasonReports: null });
    expect((await db.meta.get(ACCOUNT_KEY))?.value).toEqual(me);

    await db.meta.delete(CONSENT_PENDING_KEY);
    await storeAccount(me, await accountAsked(db), db);
    expect(await readConsent(db)).toEqual({ shareAdditions: true, seasonReports: true });
  });
});

describe('consent is account data (required, privacy)', () => {
  const me = (answers: Partial<MeResponse>): MeResponse => ({
    id: newId(),
    name: null,
    shareAdditions: null,
    seasonReports: null,
    writerDeviceId: null,
    deletionContact: null,
    ...answers,
  });
  const noLock: SyncLock = (_name, work) => work();
  const identity = (userId: string): Identity => ({
    userId,
    email: `${userId}@example.test`,
    name: null,
    signedInAt: new Date().toISOString(),
  });

  it('another account signing in on an empty phone is asked afresh, and the last one’s answers are never sent as its own', async () => {
    const db = freshDb();
    await recordIdentity(identity('a'), db, { lock: noLock });
    await answerConsent('shareAdditions', true, db);
    await answerConsent('seasonReports', true, db);
    await requestClaim(db);
    await storeAccount(me({ shareAdditions: true }), await accountAsked(db), db);
    // B's sign-in first sends A's answers with A's session.
    const serverA = new AccountServer();
    await sendLastAccountsConsent('b', async () => serverA, db, noLock);
    expect(serverA.consents).toEqual([{ shareAdditions: true, seasonReports: true }]);

    await recordIdentity(identity('b'), db, { lock: noLock });
    expect(await readConsent(db)).toEqual({ shareAdditions: null, seasonReports: null });
    for (const key of ACCOUNT_KEYS) expect(await db.meta.get(key)).toBeUndefined();
    const server = new AccountServer();
    server.writer = null;
    await syncOnce(server, { db });
    expect(server.consents).toEqual([]);
    expect(server.calls).not.toContain('claim');
  });

  it('a change made while another phone writes reaches the server at once, and the season waits', async () => {
    const db = freshDb();
    await recordIdentity(identity('a'), db, { lock: noLock });
    await save('events', concert(), { db });
    const server = new AccountServer();
    const loop = createSyncLoop({ db, getApi: async () => server, lock: (_n, work) => work() });
    await loop.request('start');
    expect(loop.status()).toMatchObject({ state: 'stopped', failure: { kind: 'not_writer' } });

    await answerConsent('seasonReports', false, db);
    await sendConsent(async () => server, db, { lock: noLock });
    expect(server.consents).toEqual([{ seasonReports: false }]);
    expect(await db.meta.get(CONSENT_PENDING_KEY)).toBeUndefined();
    // Nothing of the season was sent, and sync still waits for the rasika.
    expect(await db.outbox.count()).toBe(1);
    expect(loop.status()).toMatchObject({ state: 'stopped', failure: { kind: 'not_writer' } });
    loop.dispose();
  });

  it('with no signal the change waits, and the next sync sends it', async () => {
    const db = freshDb();
    await answerConsent('shareAdditions', false, db);
    await sendConsent(async () => {
      throw new SyncError({ kind: 'network', status: 0, message: 'no signal' });
    }, db);
    expect((await db.meta.get(CONSENT_PENDING_KEY))?.value).toEqual({ shareAdditions: false });
    const server = new AccountServer();
    server.writer = null;
    await syncOnce(server, { db });
    expect(server.consents).toEqual([{ shareAdditions: false }]);
  });

  it('a /me reply asked before a change never brings the old answer back, even after the change is sent', async () => {
    const db = freshDb();
    await answerConsent('seasonReports', true, db);
    const server = new AccountServer();
    await settleConsent(server, db);
    // Settings asks /me; meanwhile the rasika turns it off, and that reaches the server first.
    const asked = await accountAsked(db);
    await answerConsent('seasonReports', false, db);
    await settleConsent(server, db);
    await storeAccount(me({ seasonReports: true, deletionContact: 'x@example.test' }), asked, db);
    expect(await readConsent(db)).toMatchObject({ seasonReports: false });
    expect((await db.meta.get(ACCOUNT_KEY))?.value).toMatchObject({
      deletionContact: 'x@example.test',
    });
  });
});

describe('consent sends never cross, and never reach the wrong account (required, privacy)', () => {
  const me = (answers: Partial<MeResponse>): MeResponse => ({
    id: newId(),
    name: null,
    shareAdditions: null,
    seasonReports: null,
    writerDeviceId: null,
    deletionContact: null,
    ...answers,
  });
  const identity = (userId: string): Identity => ({
    userId,
    email: `${userId}@example.test`,
    name: null,
    signedInAt: new Date().toISOString(),
  });
  /** One holder at a time, as the Web Lock is. */
  function mutex(): SyncLock {
    let tail: Promise<unknown> = Promise.resolve();
    return (_name, work) => {
      const run = tail.then(work);
      tail = run.catch(() => undefined);
      return run;
    };
  }
  const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

  it('a /me reply asked while an answer waited never brings the old answer back once it is sent', async () => {
    const db = freshDb();
    await recordIdentity(identity('a'), db, { lock: mutex() });
    await answerConsent('seasonReports', false, db);
    // Settings asks /me with "No" still waiting; the server still holds the old "Yes".
    const asked = await accountAsked(db);
    const server = new AccountServer();
    await settleConsent(server, db);
    expect(await db.meta.get(CONSENT_PENDING_KEY)).toBeUndefined();
    await storeAccount(me({ seasonReports: true }), asked, db);
    expect(await readConsent(db)).toMatchObject({ seasonReports: false });
  });

  it('the last account’s /me reply, landing after another account signed in, is dropped', async () => {
    const db = freshDb();
    const lock = mutex();
    await recordIdentity(identity('a'), db, { lock });
    const asked = await accountAsked(db);
    await recordIdentity(identity('b'), db, { lock });
    await storeAccount(
      me({ shareAdditions: true, seasonReports: true, deletionContact: 'a@example.test' }),
      asked,
      db,
    );
    expect(await readConsent(db)).toEqual({ shareAdditions: null, seasonReports: null });
    expect(await db.meta.get(ACCOUNT_KEY)).toBeUndefined();
  });

  it('an earlier answer still on its way never lands after a later one', async () => {
    const db = freshDb();
    const lock = mutex();
    await recordIdentity(identity('a'), db, { lock });
    const landed: ConsentRequest[] = [];
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    const server = new AccountServer();
    server.consent = async (request) => {
      calls += 1;
      // The first call is slow; a second one, if it is let through, lands first and lets it go.
      if (calls === 1) await held;
      else release();
      landed.push(request);
      return { shareAdditions: request.shareAdditions ?? null, seasonReports: null };
    };
    setTimeout(() => release(), 100);

    await answerConsent('shareAdditions', true, db);
    const first = sendConsent(async () => server, db, { lock });
    await tick();
    await answerConsent('shareAdditions', false, db);
    const second = sendConsent(async () => server, db, { lock });
    await Promise.all([first, second]);
    // The server ends at the rasika's last answer, "No".
    expect(landed.at(-1)).toEqual({ shareAdditions: false });
    expect(await db.meta.get(CONSENT_PENDING_KEY)).toBeUndefined();
  });

  it('answers given after another account signed in are never sent with the last one’s session', async () => {
    const db = freshDb();
    const lock = mutex();
    await recordIdentity(identity('a'), db, { lock });
    await answerConsent('shareAdditions', true, db);
    const serverA = new AccountServer();
    // A's session is fetched; before the send, B signs in on the emptied phone (sending A's
    // answer first, as signIn does) and answers.
    await sendConsent(
      async () => {
        await sendLastAccountsConsent('b', async () => serverA, db, lock);
        await recordIdentity(identity('b'), db, { lock });
        await answerConsent('shareAdditions', false, db);
        return serverA;
      },
      db,
      { lock },
    );
    expect(serverA.consents).toEqual([{ shareAdditions: true }]);
    expect((await db.meta.get(CONSENT_PENDING_KEY))?.value).toEqual({ shareAdditions: false });
  });

  it('a sync whose session was the last account’s sends nothing, and runs again as the new one', async () => {
    const db = freshDb();
    const lock = mutex();
    await recordIdentity(identity('a'), db, { lock });
    const serverA = new AccountServer();
    const serverB = new AccountServer();
    serverB.writer = null;
    let first = true;
    const loop = createSyncLoop({
      db,
      lock,
      getApi: async () => {
        if (!first) return serverB;
        first = false;
        // B signs in on the empty phone, answers and logs, while A's session is in hand.
        await recordIdentity(identity('b'), db, { lock });
        await requestClaim(db);
        await answerConsent('seasonReports', false, db);
        await save('events', concert(), { db });
        return serverA;
      },
    });
    await loop.request('start');
    expect(serverA.calls).toEqual([]);
    expect(serverB.consents).toEqual([{ seasonReports: false }]);
    expect(serverB.season).toHaveLength(1);
    loop.dispose();
  });
});

describe('another account signing in never drops a waiting consent change (required, privacy)', () => {
  const lock: SyncLock = (_name, work) => work();
  const identity = (userId: string): Identity => ({
    userId,
    email: `${userId}@example.test`,
    name: null,
    signedInAt: new Date().toISOString(),
  });

  it('sends the last account’s withdrawal with its own session, then lets the new one in, unanswered', async () => {
    const db = freshDb();
    await recordIdentity(identity('a'), db, { lock });
    await answerConsent('shareAdditions', true, db);
    const serverA = new AccountServer();
    await settleConsent(serverA, db);
    // Turned off with no signal; then B signs in on this phone, which has no season.
    await answerConsent('shareAdditions', false, db);
    await sendLastAccountsConsent('b', async () => serverA, db, lock);
    await recordIdentity(identity('b'), db, { lock });
    expect(serverA.consents.at(-1)).toEqual({ shareAdditions: false });
    expect(await readConsent(db)).toEqual({ shareAdditions: null, seasonReports: null });
    expect(await db.meta.get(CONSENT_PENDING_KEY)).toBeUndefined();
  });

  it('refuses the new account when the withdrawal can’t be sent, and keeps it to send', async () => {
    const db = freshDb();
    await recordIdentity(identity('a'), db, { lock });
    await answerConsent('seasonReports', false, db);
    // A's session has ended (or the server doesn't answer): it can't be sent now.
    await sendLastAccountsConsent('b', async () => null, db, lock);
    await expect(recordIdentity(identity('b'), db, { lock })).rejects.toBeInstanceOf(
      ConsentWaitingError,
    );
    expect((await readIdentity(db))?.userId).toBe('a');
    expect((await db.meta.get(CONSENT_PENDING_KEY))?.value).toEqual({ seasonReports: false });
    expect(await readConsent(db)).toMatchObject({ seasonReports: false });
    // Never sent as B's: B isn't signed in, and A's next sync sends it as A's.
    const server = new AccountServer();
    server.writer = null;
    await syncOnce(server, { db });
    expect(server.consents).toEqual([{ seasonReports: false }]);
  });

  it('the same account signing in again sends nothing first and keeps its answers', async () => {
    const db = freshDb();
    await recordIdentity(identity('a'), db, { lock });
    await answerConsent('seasonReports', false, db);
    const server = new AccountServer();
    await sendLastAccountsConsent('a', async () => server, db, lock);
    await recordIdentity(identity('a'), db, { lock });
    expect(server.consents).toEqual([]);
    expect((await db.meta.get(CONSENT_PENDING_KEY))?.value).toEqual({ seasonReports: false });
  });
});

describe('a consent answer waiting while sync is stopped is still sent (required, privacy)', () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });
  const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

  /** The app's sync started on a phone that holds a season while another phone writes. */
  async function stoppedForAnotherPhone() {
    const db = freshDb();
    await recordIdentity(
      { userId: 'a', email: null, name: null, signedInAt: new Date().toISOString() },
      db,
      { lock: (_n, work) => work() },
    );
    await save('events', concert(), { db });
    const server = new AccountServer();
    let signal = true;
    const target = new EventTarget();
    const page = Object.assign(new EventTarget(), { visibilityState: 'visible' as string });
    stops.push(
      startSync({
        db,
        target: target as unknown as Window,
        page: page as unknown as Document,
        loop: {
          getApi: async () => {
            if (!signal) throw new SyncError({ kind: 'network', status: 0, message: 'no signal' });
            return server;
          },
          lock: (_n, work) => work(),
        },
      }),
    );
    await tick();
    const setSignal = (on: boolean) => (signal = on);
    return { db, server, target, page, setSignal };
  }

  it('Settings’ answer is sent at once, and the season waits', async () => {
    const { db, server } = await stoppedForAnotherPhone();
    expect(server.calls).toEqual(['push']);
    await changeConsent('shareAdditions', false, db);
    expect(server.consents).toEqual([{ shareAdditions: false }]);
    expect(await db.outbox.count()).toBe(1);
  });

  it('a "No" given with no signal is sent when signal returns', async () => {
    const { db, server, target, setSignal } = await stoppedForAnotherPhone();
    setSignal(false);
    await changeConsent('seasonReports', false, db);
    expect(server.consents).toEqual([]);
    setSignal(true);
    target.dispatchEvent(new Event('online'));
    await tick();
    expect(server.consents).toEqual([{ seasonReports: false }]);
    expect(await db.meta.get(CONSENT_PENDING_KEY)).toBeUndefined();
    expect(await db.outbox.count()).toBe(1);
  });

  it('… or when the app is shown again', async () => {
    const { db, server, page, setSignal } = await stoppedForAnotherPhone();
    setSignal(false);
    await changeConsent('seasonReports', false, db);
    setSignal(true);
    page.dispatchEvent(new Event('visibilitychange'));
    await tick();
    expect(server.consents).toEqual([{ seasonReports: false }]);
  });
});

describe('the writer claim (FR-022)', () => {
  it('is sent before the push, so a phone that asked to write pushes as the writer', async () => {
    const db = freshDb();
    await save('events', concert(), { db });
    await requestClaim(db);
    const server = new AccountServer();
    await syncOnce(server, { db });
    expect(server.calls).toEqual(['claim', 'push', 'pull:']);
    expect(await db.meta.get(CLAIM_PENDING_KEY)).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
  });

  it('a failed claim pushes nothing and keeps the claim and the outbox', async () => {
    const db = freshDb();
    await save('events', concert(), { db });
    await requestClaim(db);
    const server = new AccountServer();
    server.failClaim = () => {
      throw new SyncError({ kind: 'network', status: 0, message: 'no signal' });
    };
    await expect(syncOnce(server, { db })).rejects.toThrow(SyncError);
    expect(server.calls).toEqual(['claim']);
    expect((await db.meta.get(CLAIM_PENDING_KEY))?.value).toBe(true);
    expect(await db.outbox.count()).toBe(1);
  });

  it('after a 409, "Make this the writing device again" claims and pushes every queued op (D6)', async () => {
    const db = freshDb();
    const logged = [concert({ note: 'one' }), concert({ note: 'two' })];
    for (const event of logged) await save('events', event, { db });
    const server = new AccountServer();
    const loop = createSyncLoop({ db, getApi: async () => server, lock: (_n, work) => work() });

    await loop.request('start');
    expect(loop.status()).toMatchObject({ state: 'stopped', failure: { kind: 'not_writer' } });
    expect(await db.outbox.count()).toBe(2);

    await requestClaim(db);
    await loop.resume();
    expect(loop.status().state).toBe('idle');
    expect(server.season.map((event) => event.id)).toEqual(logged.map((event) => event.id));
    expect(await db.outbox.count()).toBe(0);
    loop.dispose();
  });

  it('labels the phone by its kind', () => {
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)')).toBe('iPhone');
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 9; Redmi Note 5)')).toBe('Android phone');
    expect(deviceLabel('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Browser');
  });
});

describe('restore (required, constitution IV)', () => {
  it('onto an empty store with an op logged before sign-in: claims, keeps the op, returns the season', async () => {
    const db = freshDb();
    const server = new AccountServer();
    const earlier = [concert({ note: 'synced on the old phone' }), concert({ note: '?' })];
    server.season.push(...earlier);
    const loggedHere = concert({ note: 'logged offline on the empty phone' });
    await save('events', loggedHere, { db });

    const loop = createSyncLoop({ db, getApi: async () => server, lock: (_n, work) => work() });
    expect(await restoreAfterSignIn({ resume: loop.resume, db })).toBe('done');

    expect(server.calls).toEqual(['claim', 'push', 'pull:']);
    const stored = await db.events.toArray();
    expect(stored.map((event) => event.id).sort()).toEqual(
      [...earlier, loggedHere].map((event) => event.id).sort(),
    );
    expect(await db.outbox.count()).toBe(0);
    loop.dispose();
  });

  it('opens logging after 10 seconds while the restore carries on', async () => {
    const db = freshDb();
    const timers: { run: () => void; ms: number }[] = [];
    let finish!: () => void;
    const slow = new Promise<void>((resolve) => (finish = resolve));
    const waited = restoreAfterSignIn({
      resume: () => slow,
      db,
      setTimer: (run, ms) => timers.push({ run, ms }),
    });
    for (let tries = 0; timers.length === 0 && tries < 200; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    expect(timers.map((timer) => timer.ms)).toEqual([10_000]);
    timers[0]!.run();
    expect(await waited).toBe('continuing');
    expect((await db.meta.get(CLAIM_PENDING_KEY))?.value).toBe(true);
    finish();
  });
});
