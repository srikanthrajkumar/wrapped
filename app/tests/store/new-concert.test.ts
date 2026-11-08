// Required (constitution IV; the Maintainer, 2026-11-08; PR #30 review): a Concert made by
// Season's + and left untouched is taken back without a trace on the phone or the server. It
// leaves no row only with proof it never left the phone; a birth the server acked, or refused,
// is deleted as a tombstone that syncs, so the server never keeps an empty Concert, and a
// refused birth's "needs attention" entry goes with it.

import { describe, expect, it } from 'vitest';
import { createEvent, discardUntouched, type Birth } from '../../src/store/events';
import { claimBatch } from '../../src/store/outbox';
import { settlePush } from '../../src/store/sync';
import { freshDb } from '../helpers';

const born = async (db: ReturnType<typeof freshDb>) => {
  const event = await createEvent(
    { kind: 'concert', date: '2026-12-15', startTime: '18:30' },
    { db },
  );
  const birth: Birth = {
    kind: event.kind,
    date: event.date,
    startTime: event.startTime,
    updatedAt: event.updatedAt,
  };
  return { event, birth };
};

describe('taking back an untouched new Concert', () => {
  it('leaves no row and no outbox entry when its birth never left the phone', async () => {
    const db = freshDb();
    const { event, birth } = await born(db);
    expect(await discardUntouched(event.id, birth, { db })).toBe('discarded');
    expect(await db.events.get(event.id)).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
  });

  it('sends a delete when the server acked its birth, so the server keeps no empty Concert', async () => {
    const db = freshDb();
    const { event, birth } = await born(db);
    const batch = await claimBatch(10, db);
    await settlePush(db, batch, { acked: [{ opId: batch[0]!.opId, seq: 7 }], rejected: [] });
    expect(await db.outbox.count()).toBe(0);

    expect(await discardUntouched(event.id, birth, { db })).toBe('discarded');
    expect((await db.events.get(event.id))?.deletedAt).not.toBeNull();
    const queued = await db.outbox.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ table: 'events', recordId: event.id, op: 'remove' });
  });

  it('sends a delete after a birth sent and not yet answered', async () => {
    const db = freshDb();
    const { event, birth } = await born(db);
    await claimBatch(10, db);
    expect(await discardUntouched(event.id, birth, { db })).toBe('discarded');
    expect((await db.events.get(event.id))?.deletedAt).not.toBeNull();
    expect((await db.outbox.toArray()).some((entry) => entry.op === 'remove')).toBe(true);
  });

  it('leaves no "needs attention" entry behind when the server refused its birth', async () => {
    const db = freshDb();
    const { event, birth } = await born(db);
    const batch = await claimBatch(10, db);
    await settlePush(db, batch, {
      acked: [],
      rejected: [{ opId: batch[0]!.opId, code: 'invalid_op', message: 'refused' }],
    });
    expect(await db.attention.count()).toBe(1);

    expect(await discardUntouched(event.id, birth, { db })).toBe('discarded');
    expect(await db.attention.count()).toBe(0);
    expect((await db.events.get(event.id))?.deletedAt).not.toBeNull();
    expect((await db.outbox.toArray()).some((entry) => entry.op === 'remove')).toBe(true);
  });
});
