// T067 (required, constitution IV): push and pull against the local stack. Sync without
// duplicates, delete and reorder reaching the server, and restore onto an empty device are
// paths where a failure silently loses the season.

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Item, RasikaTable } from '../../app/src/model/records';
import type { PushOp } from '../../app/src/model/sync-payloads';
import {
  claim,
  db,
  latestRows,
  newAppearance,
  newArtist,
  newEvent,
  newItem,
  newSabha,
  op,
  pull,
  pullAll,
  push,
  pushOk,
  signUp,
  signUpWriter,
  type Rasika,
} from './server';

const TABLES: RasikaTable[] = ['events', 'appearances', 'items', 'artists', 'sabhas'];

async function storedCounts(rasika: Rasika) {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const [row] = await db<{ count: number }[]>`
      select count(*)::int as count from ${db('private.' + table)} where rasika_id = ${rasika.rasikaId}`;
    counts[table] = row!.count;
  }
  const [processed] = await db<{ count: number }[]>`
    select count(*)::int as count from private.processed_op where rasika_id = ${rasika.rasikaId}`;
  counts.processed_op = processed!.count;
  return counts;
}

describe('the same push sent twice stores each op once (FR-015)', () => {
  it('acks the repeat with the first answer and changes nothing', async () => {
    const rasika = await signUpWriter();
    const event = newEvent();
    const artist = newArtist('Sanjay Subrahmanyan');
    const ops = [
      op('events', event),
      op('artists', artist),
      op('appearances', newAppearance(event.id, artist.id, 0)),
      op('items', newItem(event.id, 1)),
      op('items', newItem(event.id, 2)),
    ];

    const first = await pushOk(rasika, ops);
    expect(first.rejected).toEqual([]);
    expect(first.acked.map((ack) => ack.opId)).toEqual(ops.map((o) => o.opId));
    const afterFirst = await storedCounts(rasika);
    const [{ max: seqAfterFirst } = { max: 0 }] = await db<{ max: number }[]>`
      select max(seq)::int as max from private.items where rasika_id = ${rasika.rasikaId}`;

    // The reply was lost; the phone sends the same batch again.
    const second = await pushOk(rasika, ops);

    expect(second).toEqual(first);
    expect(await storedCounts(rasika)).toEqual(afterFirst);
    expect(afterFirst).toEqual({
      events: 1,
      appearances: 1,
      items: 2,
      artists: 1,
      sabhas: 0,
      processed_op: 5,
    });
    const [{ max: seqAfterSecond } = { max: 0 }] = await db<{ max: number }[]>`
      select max(seq)::int as max from private.items where rasika_id = ${rasika.rasikaId}`;
    expect(seqAfterSecond).toBe(seqAfterFirst);
  });

  it('stores an op repeated inside one push once', async () => {
    const rasika = await signUpWriter();
    const write = op('events', newEvent());

    const response = await pushOk(rasika, [write, write]);

    expect(response.acked).toHaveLength(2);
    expect(response.acked[0]).toEqual(response.acked[1]);
    expect((await storedCounts(rasika)).events).toBe(1);
  });

  it('answers a repeated rejected op with the same rejection, not a retry', async () => {
    const rasika = await signUpWriter();
    const orphan = op('items', newItem(randomUUID(), 1));

    const first = await pushOk(rasika, [orphan]);
    const second = await pushOk(rasika, [orphan]);

    expect(first.rejected).toEqual([
      { opId: orphan.opId, code: 'missing_event', message: expect.any(String) as string },
    ]);
    expect(second).toEqual(first);
    expect((await storedCounts(rasika)).processed_op).toBe(1);
  });
});

describe('an offline delete and a reorder come back identical on pull', () => {
  it('returns the reordered and deleted rows exactly as the phone holds them', async () => {
    const rasika = await signUpWriter();
    const event = newEvent();
    const artist = newArtist('T. M. Krishna');
    const appearance = newAppearance(event.id, artist.id, 0);
    const items = [1, 2, 3, 4].map((position) => newItem(event.id, position));
    const synced = await pushOk(rasika, [
      op('events', event),
      op('artists', artist),
      op('appearances', appearance),
      ...items.map((item) => op('items', item)),
    ]);
    const seqOf = new Map(synced.acked.map((ack, i) => [i, ack.seq]));
    const itemSeq = (index: number) => seqOf.get(3 + index)!;

    // Offline on the phone: move the fourth Item to the top, renumbering every Item, then
    // delete the second Item and remove the Artist from the Stage. Each change is one op with
    // the seq the phone last saw; the deleted Item was renumbered in the same batch.
    const deletedAt = '2026-12-14T19:02:11.000Z';
    const [one, two, three, four] = items as [Item, Item, Item, Item];
    const reordered: Item[] = [
      { ...four, position: 1 },
      { ...one, position: 2 },
      { ...two, position: 3 },
      { ...three, position: 4 },
    ];
    const deletedTwo: Item = { ...two, position: 3, deletedAt, updatedAt: deletedAt };
    const removed = { ...appearance, deletedAt, updatedAt: deletedAt };
    const offline: PushOp[] = [
      op('items', reordered[0]!, itemSeq(3)),
      op('items', reordered[1]!, itemSeq(0)),
      op('items', reordered[2]!, itemSeq(1)),
      op('items', reordered[3]!, itemSeq(2)),
      op('items', deletedTwo, itemSeq(1)),
      op('appearances', removed, seqOf.get(2)!),
    ];

    const response = await pushOk(rasika, offline);
    expect(response.rejected).toEqual([]);
    expect(response.acked).toHaveLength(offline.length);

    const { changes } = await pullAll(rasika);
    const rows = latestRows(
      changes.filter(
        (change) => change.table !== 'sharedArtists' && change.table !== 'sharedSabhas',
      ),
    );
    const phone = new Map<string, unknown>([
      [`events:${event.id}`, event],
      [`artists:${artist.id}`, artist],
      [`appearances:${appearance.id}`, removed],
      [`items:${four.id}`, reordered[0]],
      [`items:${one.id}`, reordered[1]],
      [`items:${two.id}`, deletedTwo],
      [`items:${three.id}`, reordered[3]],
    ]);
    expect(rows).toEqual(phone);
    // Each record comes back once, at its latest version.
    expect(changes.filter((change) => change.table === 'items')).toHaveLength(4);

    // The tombstones stay on the server, so a restore replays the delete.
    const [stored] = await db<{ deleted_at: Date | null }[]>`
      select deleted_at from private.items where id = ${two.id}`;
    expect(stored!.deleted_at?.toISOString()).toBe(deletedAt);
  });

  it('stores an Event deleted with its Items and Appearances, in the order the phone sends them', async () => {
    const rasika = await signUpWriter();
    const event = newEvent();
    const item = newItem(event.id, 1);
    const synced = await pushOk(rasika, [op('events', event), op('items', item)]);
    const [eventSeq, itemSeq] = synced.acked.map((ack) => ack.seq) as [number, number];

    // deleteEvent tombstones the children first, then the Event.
    const deletedAt = '2026-12-15T10:00:00.000Z';
    const response = await pushOk(rasika, [
      op('items', { ...item, deletedAt }, itemSeq),
      op('events', { ...event, deletedAt }, eventSeq),
    ]);

    expect(response.rejected).toEqual([]);
    const rows = latestRows((await pullAll(rasika)).changes);
    expect(rows.get(`events:${event.id}`)).toEqual({ ...event, deletedAt });
    expect(rows.get(`items:${item.id}`)).toEqual({ ...item, deletedAt });
  });

  it('stores a deleted Item or Appearance under an Event whose deletion is already on the server', async () => {
    const rasika = await signUpWriter();
    const event = newEvent();
    const artist = newArtist('Sikkil Gurucharan');
    const item = newItem(event.id, 1);
    const appearance = newAppearance(event.id, artist.id, 0);
    const synced = await pushOk(rasika, [
      op('events', event),
      op('artists', artist),
      op('items', item),
      op('appearances', appearance),
    ]);
    const [eventSeq, , itemSeq, appearanceSeq] = synced.acked.map((ack) => ack.seq) as number[];

    // The Event's tombstone reaches the server first, in its own push.
    const deletedAt = '2026-12-15T10:00:00.000Z';
    expect(
      (await pushOk(rasika, [op('events', { ...event, deletedAt }, eventSeq)])).rejected,
    ).toEqual([]);

    // The children's tombstones arrive after it: stored, not rejected missing_event.
    const tombstones = [
      op('items', { ...item, deletedAt }, itemSeq),
      op('appearances', { ...appearance, deletedAt }, appearanceSeq),
    ];
    const response = await pushOk(rasika, tombstones);

    expect(response.rejected).toEqual([]);
    expect(response.acked.map((ack) => ack.opId)).toEqual(tombstones.map((t) => t.opId));
    const rows = latestRows((await pullAll(rasika)).changes);
    expect(rows.get(`items:${item.id}`)).toEqual({ ...item, deletedAt });
    expect(rows.get(`appearances:${appearance.id}`)).toEqual({ ...appearance, deletedAt });

    // A live Item under the deleted Event is still refused.
    const live = op('items', newItem(event.id, 2));
    expect((await pushOk(rasika, [live])).rejected).toEqual([
      { opId: live.opId, code: 'missing_event', message: expect.any(String) as string },
    ]);
  });
});

describe('a pull from an empty cursor returns the full season (restore, FR-017)', () => {
  it('pages through every own row, every Link and both shared lists', async () => {
    const rasika = await signUpWriter();
    const sabha = newSabha('Our Sabha');
    const events = [
      newEvent({ sabhaId: sabha.id }),
      newEvent({ kind: 'lecdem', title: 'On Begada' }),
    ];
    const artist = newArtist('Bombay Jayashri');
    const items = events.flatMap((event) =>
      Array.from({ length: 12 }, (_, i) => newItem(event.id, i + 1)),
    );
    const sent: PushOp[] = [
      op('sabhas', sabha),
      op('artists', artist),
      ...events.map((event) => op('events', event)),
      ...events.map((event, i) => op('appearances', newAppearance(event.id, artist.id, i))),
      ...items.map((item) => op('items', item)),
    ];
    expect((await pushOk(rasika, sent)).rejected).toEqual([]);
    // A Link the Maintainer's promotion would write (FR-044).
    const link = { id: randomUUID(), ownTable: 'artist', ownId: artist.id, sharedId: randomUUID() };
    await db`
      insert into private.link (id, rasika_id, seq, own_table, own_id, shared_id)
      values (${link.id}, ${rasika.rasikaId}, nextval('private.season_seq'), ${link.ownTable},
        ${link.ownId}, ${link.sharedId})`;
    const [shared] = await db<{ artists: number; sabhas: number }[]>`
      select (select count(*)::int from private.shared_artist) as artists,
             (select count(*)::int from private.shared_sabha) as sabhas`;

    for (const limit of [7, undefined]) {
      const { changes, pages } = await pullAll(rasika, { limit });
      const own = latestRows(changes.filter((change) => !change.table.startsWith('shared')));
      const expected = new Map<string, unknown>(sent.map((o) => [`${o.table}:${o.row.id}`, o.row]));
      expected.set(`links:${link.id}`, link);
      expect(own).toEqual(expected);
      expect(changes.filter((change) => change.table === 'sharedArtists')).toHaveLength(
        shared!.artists,
      );
      expect(changes.filter((change) => change.table === 'sharedSabhas')).toHaveLength(
        shared!.sabhas,
      );
      // Nothing comes twice, even across page boundaries.
      expect(new Set(changes.map((c) => `${c.table}:${c.row.id}`)).size).toBe(changes.length);
      if (limit) expect(pages).toBe(Math.ceil(changes.length / limit));
    }
  });

  it('returns only what changed since the cursor afterwards', async () => {
    const rasika = await signUpWriter();
    const event = newEvent();
    const synced = await pushOk(rasika, [op('events', event)]);
    const { cursor } = await pullAll(rasika);

    const empty = await pull(rasika, { cursor });
    expect(empty.data).toEqual({ changes: [], cursor, more: false });

    const edited = { ...event, note: 'Encore: Tillana' };
    const editAck = await pushOk(rasika, [op('events', edited, synced.acked[0]!.seq)]);
    const next = await pullAll(rasika, { cursor });
    expect(next.changes).toEqual([{ table: 'events', seq: editAck.acked[0]!.seq, row: edited }]);
  });

  it("gives each pulled record its seq, so a restored phone's first edits are acked, not conflicts", async () => {
    // The season, synced from the old phone.
    const rasika = await signUpWriter();
    const event = newEvent();
    const artist = newArtist('Ranjani-Gayatri');
    const appearance = newAppearance(event.id, artist.id, 0);
    const items = [1, 2, 3].map((position) => newItem(event.id, position));
    const synced = await pushOk(rasika, [
      op('events', event),
      op('artists', artist),
      op('appearances', appearance),
      ...items.map((item) => op('items', item)),
    ]);
    // An edit after the first sync, so seqs differ from the first acks.
    const renamed = { ...artist, name: 'Ranjani and Gayatri' };
    const renameAck = await pushOk(rasika, [op('artists', renamed, synced.acked[1]!.seq)]);
    const link = { id: randomUUID(), ownTable: 'artist', ownId: artist.id, sharedId: randomUUID() };
    await db`
      insert into private.link (id, rasika_id, seq, own_table, own_id, shared_id)
      values (${link.id}, ${rasika.rasikaId}, nextval('private.season_seq'), ${link.ownTable},
        ${link.ownId}, ${link.sharedId})`;

    // The phone is wiped. The empty phone claims writing and pulls from an empty cursor.
    const restored: Rasika = { ...rasika, deviceId: randomUUID() };
    expect(
      (await claim(restored, { deviceId: restored.deviceId, label: 'New phone' })).error,
    ).toBeNull();
    const { changes } = await pullAll(restored);

    // Every own row and Link comes with the seq the server holds for it.
    const pulledSeq = new Map<string, number>();
    for (const change of changes) {
      if (change.table === 'sharedArtists' || change.table === 'sharedSabhas') {
        expect(change).not.toHaveProperty('seq');
        continue;
      }
      expect(typeof change.seq).toBe('number');
      pulledSeq.set(change.row.id, change.seq);
    }
    for (const table of [...TABLES, 'link']) {
      const rows = await db<{ id: string; seq: string }[]>`
        select id, seq from ${db('private.' + table)} where rasika_id = ${rasika.rasikaId}`;
      for (const row of rows)
        expect(pulledSeq.get(row.id), `${table} ${row.id}`).toBe(Number(row.seq));
    }
    expect(pulledSeq.get(artist.id)).toBe(renameAck.acked[0]!.seq);
    const seqOf = (id: string): number => {
      const seq = pulledSeq.get(id);
      if (seq === undefined) throw new Error(`no seq pulled for ${id}`);
      return seq;
    };

    // The rasika edits every restored record, each op based on its pulled seq.
    const [first, second, third] = items as [Item, Item, Item];
    const edits: PushOp[] = [
      op('events', { ...event, note: 'Restored, then edited' }, seqOf(event.id)),
      op('artists', { ...renamed, aliases: ['Ranjani-Gayatri'] }, seqOf(artist.id)),
      op('appearances', { ...appearance, colourPrimary: 'green' }, seqOf(appearance.id)),
      op('items', { ...third, position: 1 }, seqOf(third.id)),
      op('items', { ...first, position: 2 }, seqOf(first.id)),
      op(
        'items',
        { ...second, position: 3, deletedAt: '2026-12-20T18:00:00.000Z' },
        seqOf(second.id),
      ),
    ];
    const response = await pushOk(restored, edits);

    expect(response.rejected).toEqual([]);
    expect(response.acked.map((ack) => ack.opId)).toEqual(edits.map((edit) => edit.opId));
  });

  it('refuses a cursor it did not make', async () => {
    const rasika = await signUpWriter();
    const reply = await pull(rasika, { cursor: 'not-a-cursor' });
    expect(reply.status).toBe(400);
  });
});

describe('a non-writer device gets 409 not_writer (FR-022)', () => {
  it('applies nothing from the other device, and the writer changes with each claim', async () => {
    const rasika = await signUpWriter();
    const ipad = randomUUID();

    const refused = await push(rasika, [op('events', newEvent())], ipad);
    expect(refused.status).toBe(409);
    expect(refused.error).toMatchObject({ code: 'not_writer', details: rasika.deviceId });
    expect(await storedCounts(rasika)).toMatchObject({ events: 0, processed_op: 0 });

    // The iPad takes writing; now the phone is refused, and its queue is kept for later.
    expect((await claim(rasika, { deviceId: ipad, label: 'iPad' })).data).toEqual({
      writerDeviceId: ipad,
    });
    const phoneOp = op('events', newEvent());
    const phoneRefused = await push(rasika, [phoneOp]);
    expect(phoneRefused.status).toBe(409);
    expect(phoneRefused.error).toMatchObject({ code: 'not_writer', details: ipad });

    // The phone takes writing back and pushes its queued op (eng review D6).
    await claim(rasika, { deviceId: rasika.deviceId, label: 'Test phone' });
    const resumed = await pushOk(rasika, [phoneOp]);
    expect(resumed.acked.map((ack) => ack.opId)).toEqual([phoneOp.opId]);
  });

  it('refuses a rasika who has never claimed a device, with null as the writer', async () => {
    const rasika = await signUp('unclaimed');
    const reply = await push(rasika, [op('events', newEvent())]);
    expect(reply.status).toBe(409);
    expect(reply.error).toMatchObject({ code: 'not_writer', details: null });
  });
});

describe('rejected ops (eng review D11)', () => {
  it('rejects an op based on an older version as conflict and keeps the newer row', async () => {
    const rasika = await signUpWriter();
    const event = newEvent();
    const created = await pushOk(rasika, [op('events', event)]);
    const base = created.acked[0]!.seq;
    const ipadEdit = { ...event, note: 'From the iPad' };
    const edited = await pushOk(rasika, [op('events', ipadEdit, base)]);

    const stale = op('events', { ...event, note: 'From the phone' }, base);
    const response = await pushOk(rasika, [stale]);

    expect(response.rejected).toEqual([
      { opId: stale.opId, code: 'conflict', message: expect.any(String) as string },
    ]);
    const rows = latestRows((await pullAll(rasika)).changes);
    expect(rows.get(`events:${event.id}`)).toEqual(ipadEdit);

    // "Keep mine" pushes the phone's version again on the server's seq.
    const keepMine = op('events', { ...event, note: 'From the phone' }, edited.acked[0]!.seq);
    expect((await pushOk(rasika, [keepMine])).rejected).toEqual([]);
  });

  it('rejects a new record whose baseSeq is not 0', async () => {
    const rasika = await signUpWriter();
    const response = await pushOk(rasika, [op('events', newEvent(), 41)]);
    expect(response.rejected[0]?.code).toBe('conflict');
  });

  it('rejects an Item for a deleted Event as missing_event, and an unreadable op as invalid_op', async () => {
    const rasika = await signUpWriter();
    const event = newEvent();
    const created = await pushOk(rasika, [op('events', event)]);
    await pushOk(rasika, [
      op('events', { ...event, deletedAt: '2026-12-16T09:00:00.000Z' }, created.acked[0]!.seq),
    ]);

    const late = op('items', newItem(event.id, 1));
    const broken = {
      opId: randomUUID(),
      table: 'kritis',
      baseSeq: 0,
      row: { id: randomUUID() },
    } as unknown as PushOp;
    const response = await pushOk(rasika, [late, broken]);

    expect(response.rejected.map((r) => [r.opId, r.code])).toEqual([
      [late.opId, 'missing_event'],
      [broken.opId, 'invalid_op'],
    ]);
  });

  it('answers 400 to a push of more than 200 ops, and applies none', async () => {
    const rasika = await signUpWriter();
    const ops = Array.from({ length: 201 }, () => op('artists', newArtist('Too many')));
    const reply = await push(rasika, ops);
    expect(reply.status).toBe(400);
    expect((await storedCounts(rasika)).artists).toBe(0);
  });
});
