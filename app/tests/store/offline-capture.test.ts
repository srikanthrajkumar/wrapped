// Required test (constitution IV, "offline capture surviving a forced close"; T019).
// Covers the save path's promises: record and outbox entry together or not at all, data that
// survives a reopen, one never-sent entry per record (eng review D8), and the batch claim
// (outside voice 1).

import { afterEach, describe, expect, it } from 'vitest';
import { newId, type Event, type PushAck, type RasikaRow } from '../../src/model';
import { WrappedDB, type OutboxEntry } from '../../src/store/db';
import { remove, save } from '../../src/store/mutate';
import { acknowledge, claimBatch } from '../../src/store/outbox';

const open: WrappedDB[] = [];

function freshDb(name = `offline-capture-${newId()}`): WrappedDB {
  const db = new WrappedDB(name);
  open.push(db);
  return db;
}

afterEach(async () => {
  for (const db of open.splice(0)) await db.delete();
});

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

/** A stand-in for the server's push: one stored row per record, each opId applied once. */
class FakeServer {
  rows = new Map<string, RasikaRow>();
  processed = new Map<string, number>();
  applied: string[] = [];
  private seq = 0;

  push(entries: OutboxEntry[]): PushAck[] {
    return entries.map((entry) => {
      const seen = this.processed.get(entry.opId);
      if (seen !== undefined) return { opId: entry.opId, seq: seen };
      this.seq += 1;
      this.rows.set(entry.recordId, structuredClone(entry.row));
      this.processed.set(entry.opId, this.seq);
      this.applied.push(entry.opId);
      return { opId: entry.opId, seq: this.seq };
    });
  }
}

/** Push until the outbox is empty, as the sync loop will. */
async function syncAll(db: WrappedDB, server: FakeServer) {
  for (let batch = await claimBatch(200, db); batch.length > 0; batch = await claimBatch(200, db)) {
    const acks = server.push(batch);
    await acknowledge(
      acks.map((ack) => ack.opId),
      db,
    );
  }
}

describe('offline capture (required)', () => {
  it('writes the record and its outbox entry together', async () => {
    const db = freshDb();
    const event = await save('events', concert(), db);

    expect(await db.events.get(event.id)).toEqual(event);
    const outbox = await db.outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      table: 'events',
      recordId: event.id,
      op: 'save',
      row: event,
      firstSentAt: null,
    });
    expect(outbox[0]?.opId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('writes neither when the transaction fails', async () => {
    const db = freshDb();
    db.outbox.hook('creating', () => {
      throw new Error('disk full');
    });
    const event = concert();

    await expect(save('events', event, db)).rejects.toThrow('disk full');
    expect(await db.events.get(event.id)).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps saves and deletes after the database is closed and reopened', async () => {
    const name = `offline-capture-${newId()}`;
    const before = freshDb(name);
    const kept = await save('events', concert(), before);
    const deleted = await save('events', concert(), before);
    await remove('events', deleted.id, before);
    before.close();

    // A new connection, as after a force-close and relaunch.
    const after = freshDb(name);
    expect(await after.events.get(kept.id)).toEqual(kept);
    expect((await after.events.get(deleted.id))?.deletedAt).toEqual(expect.any(String));
    const outbox = await after.outbox.orderBy('seq').toArray();
    expect(outbox.map((entry) => [entry.recordId, entry.op])).toEqual([
      [kept.id, 'save'],
      [deleted.id, 'remove'],
    ]);
  });

  it('a delete queues the full row as a tombstone', async () => {
    const db = freshDb();
    const event = await save('events', concert({ note: 'Thodi alapana' }), db);
    const tombstone = await remove('events', event.id, db);

    expect(tombstone).toMatchObject({ id: event.id, note: 'Thodi alapana' });
    expect(tombstone?.deletedAt).toEqual(expect.any(String));
    const outbox = await db.outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.row).toEqual(tombstone);
  });

  it('ten saves to one record leave one outbox entry with the last row', async () => {
    const db = freshDb();
    const event = concert();
    for (let n = 1; n <= 10; n += 1) await save('events', { ...event, note: `edit ${n}` }, db);

    const outbox = await db.outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect((outbox[0]?.row as Event).note).toBe('edit 10');
  });

  it('an unsent entry keeps its place in the queue when replaced', async () => {
    const db = freshDb();
    const first = concert();
    await save('events', first, db);
    const second = await save('events', concert(), db);
    await save('events', { ...first, note: 'edited' }, db);

    const outbox = await db.outbox.orderBy('seq').toArray();
    expect(outbox.map((entry) => entry.recordId)).toEqual([first.id, second.id]);
  });

  it('a save after a push whose reply was lost adds a second entry, and both reach the server', async () => {
    const db = freshDb();
    const server = new FakeServer();
    const event = await save('events', concert({ note: 'first' }), db);

    // The push reaches the server, but its reply never comes back.
    const lost = await claimBatch(200, db);
    server.push(lost);

    const edited = await save('events', { ...event, note: 'second' }, db);
    const outbox = await db.outbox.orderBy('seq').toArray();
    expect(outbox).toHaveLength(2);
    expect((outbox[0]?.row as Event).note).toBe('first');

    await syncAll(db, server);
    expect(await db.outbox.count()).toBe(0);
    expect(server.applied).toEqual(outbox.map((entry) => entry.opId));
    expect(server.rows.get(event.id)).toEqual(edited);
  });

  it('a save between a batch claim and its acknowledgement still reaches the server', async () => {
    const db = freshDb();
    const server = new FakeServer();
    const event = await save('events', concert({ note: 'before the claim' }), db);

    const batch = await claimBatch(200, db);
    const edited = await save('events', { ...event, note: 'after the claim' }, db);
    expect((batch[0]?.row as Event).note).toBe('before the claim');
    expect(await db.outbox.count()).toBe(2);

    const acks = server.push(batch);
    await acknowledge(
      acks.map((ack) => ack.opId),
      db,
    );
    expect(await db.outbox.count()).toBe(1);

    await syncAll(db, server);
    expect(server.rows.get(event.id)).toEqual(edited);
    expect(await db.outbox.count()).toBe(0);
  });
});
