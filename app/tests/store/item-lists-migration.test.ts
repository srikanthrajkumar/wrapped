// Required tests (constitution IV, nothing lost; ADR 0012). A Manodharma part's Ragas and the
// Layavinyasam's nadais become lists. Every old shape a phone can hold is migrated with nothing
// lost; an outbox entry already sent goes out as it was; rows the server still holds in the old
// shape are upgraded as they are pulled; and an Item survives a round trip through the outbox,
// the server and another phone.

import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import {
  catalogValue,
  newId,
  notApplicableValue,
  unknownValue,
  unresolvedValue,
  upgradeItemFieldValue,
  upgradeItemShape,
  type DetailValue,
  type Item,
  type PullChange,
  type PullRequest,
  type PullResponse,
  type PushRequest,
  type PushResponse,
} from '../../src/model';
import { WrappedDB, type OutboxEntry } from '../../src/store/db';
import { holdsValue } from '../../src/store/journal-check';
import { setImprovised, setLayaNadais } from '../../src/store/items';
import { itemProblems } from '../../src/store/rules';
import { keepMine, keepServers, listAttention } from '../../src/store/attention';
import { syncOnce } from '../../src/store/sync';
import { SyncError, type SyncApi } from '../../src/store/sync-api';
import { freshDb } from '../helpers';

const kalyani = catalogValue('kalyani', 'Kalyani');
const kanada = catalogValue('kanada', 'Kanada');
const khanda = catalogValue('khanda', 'khanda');
const guessTisra: DetailValue = { ...catalogValue('tisra', 'tisra'), guess: true };

/** An Item as a build before 0.4.0 stored it: one Raga per part, one nadai. */
type OldItem = Omit<Item, 'improvised' | 'layaVinyasam'> & {
  improvised: { kind: Item['improvised'][number]['kind']; raga: DetailValue | null }[];
  layaVinyasam: { nadai: DetailValue; note: string | null } | null;
};

function oldItem(overrides: Partial<OldItem> = {}): OldItem {
  const now = '2026-12-14T14:00:00.000Z';
  return {
    id: newId(),
    eventId: 'e1',
    position: 1,
    compositionKey: null,
    title: 'Nidhi chala sukhama',
    form: unknownValue(),
    ragas: [kalyani],
    tala: unknownValue(),
    nadai: notApplicableValue(),
    composer: unknownValue(),
    language: unknownValue(),
    subject: unknownValue(),
    layaVinyasam: null,
    improvised: [],
    note: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

/** Every old shape a part or a Layavinyasam could be stored in. */
const OLD_SHAPES: { name: string; old: Partial<OldItem>; parts: unknown; laya: unknown }[] = [
  { name: 'nothing heard', old: {}, parts: [], laya: null },
  {
    name: 'a part in the Item’s Raga',
    old: { improvised: [{ kind: 'alapana', raga: null }] },
    parts: [{ kind: 'alapana', ragas: [] }],
    laya: null,
  },
  {
    name: 'parts with a Raga of their own, "?" and Not applicable',
    old: {
      improvised: [
        { kind: 'alapana', raga: kanada },
        { kind: 'tanam', raga: unknownValue() },
        { kind: 'niraval', raga: notApplicableValue() },
        { kind: 'kalpana_swaram', raga: unresolvedValue('Hamsanadam', true) },
      ],
    },
    parts: [
      { kind: 'alapana', ragas: [kanada] },
      { kind: 'tanam', ragas: [unknownValue()] },
      { kind: 'niraval', ragas: [notApplicableValue()] },
      { kind: 'kalpana_swaram', ragas: [unresolvedValue('Hamsanadam', true)] },
    ],
    laya: null,
  },
  {
    name: 'a Layavinyasam in the Tala’s nadai, with a note',
    old: { layaVinyasam: { nadai: notApplicableValue(), note: 'tisram korvai' } },
    parts: [],
    laya: { nadais: [], note: 'tisram korvai' },
  },
  {
    name: 'a Layavinyasam in a set nadai',
    old: { layaVinyasam: { nadai: khanda, note: null } },
    parts: [],
    laya: { nadais: [khanda], note: null },
  },
  {
    name: 'a Layavinyasam in "?", a guess and typed text',
    old: { layaVinyasam: { nadai: unknownValue(), note: 'fast' } },
    parts: [],
    laya: { nadais: [unknownValue()], note: 'fast' },
  },
  {
    name: 'a guessed nadai',
    old: { layaVinyasam: { nadai: guessTisra, note: null } },
    parts: [],
    laya: { nadais: [guessTisra], note: null },
  },
  {
    name: 'a nadai typed in',
    old: { layaVinyasam: { nadai: unresolvedValue('tisra-khanda'), note: null } },
    parts: [],
    laya: { nadais: [unresolvedValue('tisra-khanda')], note: null },
  },
];

/**
 * The phone store as 0.3.0 left it: version 4, with the same tables. Rows are written straight
 * in, as that build stored them.
 */
class OldStore extends Dexie {
  constructor(name: string) {
    super(name);
    this.version(4).stores({
      events: 'id, status, date, sabhaId, scheduleEntryId',
      appearances: 'id, eventId, artistId',
      items: 'id, eventId, [eventId+position]',
      artists: 'id, name, mergedIntoId',
      sabhas: 'id, name, mergedIntoId',
      links: 'id, [ownTable+ownId]',
      sharedArtists: 'id, name',
      sharedSabhas: 'id, name',
      schedule: 'id, date',
      outbox: '++seq, opId, recordId',
      meta: 'key',
      serverSeqs: '[table+id]',
      attention: 'opId, [table+recordId]',
    });
  }
}

async function oldStore(fill: (old: OldStore) => Promise<void>): Promise<WrappedDB> {
  const name = `test-${newId()}`;
  const old = new OldStore(name);
  await old.open();
  await fill(old);
  old.close();
  const db = freshDb(name);
  await db.open();
  return db;
}

function outboxEntry(row: unknown, sent: boolean, table = 'items'): OutboxEntry {
  return {
    opId: newId(),
    table: table as OutboxEntry['table'],
    recordId: (row as { id: string }).id,
    op: 'save',
    row: row as Item,
    queuedAt: '2026-12-14T14:00:00.000Z',
    firstSentAt: sent ? '2026-12-14T14:00:01.000Z' : null,
    ...(sent ? { baseSeq: 3 } : {}),
  };
}

/**
 * A server that keeps every row exactly as sent, as the real one does (eng review D7), numbers
 * its writes, and answers a pull with every row written after the cursor.
 */
class KeepingServer implements SyncApi {
  seq = 0;
  rows = new Map<string, { table: string; seq: number; row: unknown }>();
  pushes: PushRequest[] = [];

  /** A row some earlier build pushed. */
  put(table: string, row: { id: string }) {
    this.rows.set(`${table}:${row.id}`, { table, seq: ++this.seq, row: structuredClone(row) });
  }

  async push(request: PushRequest): Promise<PushResponse> {
    this.pushes.push(structuredClone(request));
    const acked = request.ops.map((op) => {
      this.put(op.table, op.row);
      return { opId: op.opId, seq: this.seq };
    });
    return { acked, rejected: [] };
  }

  async pull(request: PullRequest): Promise<PullResponse> {
    const after = Number(request.cursor || 0);
    const changes = [...this.rows.values()]
      .filter((entry) => entry.seq > after)
      .sort((a, b) => a.seq - b.seq)
      .map(
        (entry) =>
          ({ table: entry.table, seq: entry.seq, row: structuredClone(entry.row) }) as PullChange,
      );
    return { changes, cursor: String(this.seq), more: false };
  }

  claim = () => Promise.reject(new Error('not scripted'));
  me = () => Promise.reject(new Error('not scripted'));
  consent = () => Promise.reject(new Error('not scripted'));
}

describe('Manodharma and Layavinyasam lists: the migration (required, ADR 0012)', () => {
  it.each(OLD_SHAPES)('migrates $name, losing nothing', async ({ old, parts, laya }) => {
    const stored = oldItem(old);
    const db = await oldStore(async (store) => {
      await store.table('items').put(stored);
    });

    const item = await db.items.get(stored.id);
    expect(item?.improvised).toEqual(parts);
    expect(item?.layaVinyasam).toEqual(laya);
    // Everything else is as it was.
    const { improvised: _parts, layaVinyasam: _laya, ...rest } = stored;
    void [_parts, _laya];
    expect(item).toMatchObject(rest);
    expect(itemProblems(item!)).toEqual([]);
  });

  it('migrates a deleted Item too, so its Undo restores the new shape', async () => {
    const stored = oldItem({
      deletedAt: '2026-12-14T15:00:00.000Z',
      improvised: [{ kind: 'tanam', raga: kanada }],
      layaVinyasam: { nadai: khanda, note: 'n' },
    });
    const db = await oldStore(async (store) => {
      await store.table('items').put(stored);
    });
    const item = await db.items.get(stored.id);
    expect(item?.deletedAt).toBe(stored.deletedAt);
    expect(item?.improvised).toEqual([{ kind: 'tanam', ragas: [kanada] }]);
    expect(item?.layaVinyasam).toEqual({ nadais: [khanda], note: 'n' });
  });

  it('rewrites an outbox entry never sent, and leaves one already sent exactly as it was', async () => {
    const waiting = oldItem({ improvised: [{ kind: 'alapana', raga: kanada }] });
    const sentRow = oldItem({ layaVinyasam: { nadai: khanda, note: null } });
    const unsent = outboxEntry(waiting, false);
    const sent = outboxEntry(sentRow, true);
    const event = { id: 'e1', note: 'kept' };
    const other = outboxEntry(event, false, 'events');
    const db = await oldStore(async (store) => {
      await store.table('outbox').bulkAdd([unsent, sent, other]);
    });

    const [first, second, third] = await db.outbox.orderBy('seq').toArray();
    expect(first).toMatchObject({ opId: unsent.opId, firstSentAt: null });
    expect((first!.row as Item).improvised).toEqual([{ kind: 'alapana', ragas: [kanada] }]);
    // Sent once, it may be on the server under its opId: never changed (eng review D8).
    expect(second).toEqual({ ...sent, seq: second!.seq });
    expect(third).toEqual({ ...other, seq: third!.seq });
  });

  it('rewrites a rejected op in "needs attention" and a held server version', async () => {
    const rejected = oldItem({ improvised: [{ kind: 'niraval', raga: null }] });
    const held = oldItem({ layaVinyasam: { nadai: guessTisra, note: 'held' } });
    const db = await oldStore(async (store) => {
      await store.table('attention').put({
        opId: 'op1',
        queueSeq: 1,
        table: 'items',
        recordId: rejected.id,
        row: rejected,
        code: 'conflict',
        message: 'newer',
        rejectedAt: '2026-12-14T14:00:00.000Z',
      });
      await store.table('serverSeqs').put({
        table: 'items',
        id: held.id,
        seq: 4,
        held: { seq: 9, row: held },
      });
    });

    const attention = await db.attention.get('op1');
    expect((attention!.row as Item).improvised).toEqual([{ kind: 'niraval', ragas: [] }]);
    const known = await db.serverSeqs.get(['items', held.id]);
    expect(known).toMatchObject({ seq: 4, held: { seq: 9 } });
    expect((known!.held!.row as Item).layaVinyasam).toEqual({ nadais: [guessTisra], note: 'held' });
  });

  it('is idempotent: an Item already in the new shape comes back as the same object', () => {
    const item = upgradeItemShape(
      oldItem({ improvised: [{ kind: 'alapana', raga: kanada }] }) as unknown as Item,
    );
    expect(upgradeItemShape(item)).toBe(item);
  });

  it('a migrated Item can be edited at once, and the edit is queued', async () => {
    const stored = oldItem({
      improvised: [{ kind: 'alapana', raga: kanada }],
      layaVinyasam: { nadai: khanda, note: 'kept' },
    });
    const db = await oldStore(async (store) => {
      await store.table('items').put(stored);
    });

    await setImprovised(
      stored.id,
      [
        { kind: 'alapana', ragas: [kanada, null] },
        { kind: 'tanam', ragas: [] },
      ],
      { db },
    );
    const item = await setLayaNadais(stored.id, [khanda, guessTisra], { db });

    expect(item.improvised).toEqual([
      { kind: 'alapana', ragas: [kanada, null] },
      { kind: 'tanam', ragas: [] },
    ]);
    expect(item.layaVinyasam).toEqual({ nadais: [khanda, guessTisra], note: 'kept' });
    const [queued] = await db.outbox.toArray();
    expect(queued!.row).toEqual(item);
  });

  it('reads a value journalled before 0.4.0 in the new shape, and finds it held', async () => {
    const stored = oldItem({
      improvised: [{ kind: 'alapana', raga: kanada }],
      layaVinyasam: { nadai: notApplicableValue(), note: null },
    });
    const db = await oldStore(async (store) => {
      await store.table('items').put(stored);
    });

    const laya = upgradeItemFieldValue('layaVinyasam', { nadai: notApplicableValue() });
    const parts = upgradeItemFieldValue('improvised', [{ kind: 'alapana', raga: kanada }]);
    expect(laya).toEqual({ nadais: [] });
    expect(parts).toEqual([{ kind: 'alapana', ragas: [kanada] }]);
    const entry = (field: string, value: unknown) =>
      ({
        table: 'items',
        id: stored.id,
        field,
        value,
        enteredAt: '2026-12-14T14:00:00.000Z',
        state: 'failed',
      }) as const;
    expect(await holdsValue(entry('layaVinyasam', laya), db)).toBe(true);
    expect(await holdsValue(entry('improvised', parts), db)).toBe(true);
  });
});

describe('Manodharma and Layavinyasam lists through sync (required, ADR 0012)', () => {
  it('a row the server holds in the old shape is stored in the new one when pulled', async () => {
    const server = new KeepingServer();
    const old = oldItem({
      improvised: [
        { kind: 'alapana', raga: null },
        { kind: 'kalpana_swaram', raga: kanada },
      ],
      layaVinyasam: { nadai: khanda, note: 'from 0.3.0' },
    });
    server.put('items', old);
    const db = freshDb();

    await syncOnce(server, { db });

    const item = await db.items.get(old.id);
    expect(item?.improvised).toEqual([
      { kind: 'alapana', ragas: [] },
      { kind: 'kalpana_swaram', ragas: [kanada] },
    ]);
    expect(item?.layaVinyasam).toEqual({ nadais: [khanda], note: 'from 0.3.0' });
    expect(itemProblems(item!)).toEqual([]);
  });

  it('a server version held while an edit waits is upgraded, and "keep the server’s" stores it', async () => {
    const server = new KeepingServer();
    const db = freshDb();
    const item = upgradeItemShape(oldItem() as unknown as Item);
    await db.items.put(item);
    await db.serverSeqs.put({ table: 'items', id: item.id, seq: 1, held: null });
    server.seq = 1;
    // The phone's edit is rejected as a conflict; the other device's version, pushed by 0.3.0,
    // arrives in the old shape and is held.
    await setImprovised(item.id, [{ kind: 'tanam', ragas: [] }], { db });
    server.push = async (request) => ({
      acked: [],
      rejected: request.ops.map((op) => ({ opId: op.opId, code: 'conflict', message: 'newer' })),
    });
    server.put('items', oldItem({ id: item.id, layaVinyasam: { nadai: khanda, note: 'iPad' } }));

    await syncOnce(server, { db });

    const [entry] = await listAttention(db);
    expect((entry!.server as Item).layaVinyasam).toEqual({ nadais: [khanda], note: 'iPad' });
    await keepServers(entry!.opId, { db });
    expect((await db.items.get(item.id))?.layaVinyasam).toEqual({ nadais: [khanda], note: 'iPad' });
  });

  it('round-trips an Item through the outbox, the server and another phone, unchanged', async () => {
    const server = new KeepingServer();
    const stored = oldItem({
      improvised: [{ kind: 'alapana', raga: kanada }],
      layaVinyasam: { nadai: khanda, note: null },
    });
    // The phone that logged it under 0.3.0, upgraded to 0.4.0.
    const phone = await oldStore(async (store) => {
      await store.table('items').put(stored);
    });
    await setImprovised(
      stored.id,
      [
        { kind: 'alapana', ragas: [null, kanada, unknownValue()] },
        { kind: 'kalpana_swaram', ragas: [] },
      ],
      { db: phone },
    );
    const edited = await setLayaNadais(stored.id, [khanda, unknownValue(), guessTisra], {
      db: phone,
    });

    await syncOnce(server, { db: phone });
    expect(await phone.outbox.count()).toBe(0);
    const pushed = server.pushes.flatMap((push) => push.ops).at(-1)!.row as Item;
    expect(pushed.improvised).toEqual(edited.improvised);
    expect(pushed.layaVinyasam).toEqual(edited.layaVinyasam);

    // A second phone (a reinstall) pulls the season back.
    const other = freshDb();
    await syncOnce(server, { db: other });
    expect(await other.items.get(stored.id)).toEqual(edited);
  });

  it('an outbox entry sent before the upgrade is re-sent as it was, and the phone keeps the new shape', async () => {
    const server = new KeepingServer();
    const stored = oldItem({ layaVinyasam: { nadai: khanda, note: 'sent' } });
    const sent = outboxEntry(stored, true);
    const phone = await oldStore(async (store) => {
      await store.table('items').put(stored);
      await store.table('outbox').add(sent);
    });

    await syncOnce(server, { db: phone });

    // The same op, byte for byte: the server may already hold it under its opId.
    const [push] = server.pushes;
    expect(push!.ops[0]).toMatchObject({ opId: sent.opId, baseSeq: 3, row: stored });
    // Pulled back in the old shape, it never replaces the phone's own row with it.
    expect((await phone.items.get(stored.id))?.layaVinyasam).toEqual({
      nadais: [khanda],
      note: 'sent',
    });
    const other = freshDb();
    await syncOnce(server, { db: other });
    expect((await other.items.get(stored.id))?.layaVinyasam).toEqual({
      nadais: [khanda],
      note: 'sent',
    });
  });

  it('an op sent before the upgrade and rejected after it is kept in "needs attention" in the new shape', async () => {
    const server = new KeepingServer();
    server.push = async (request) => ({
      acked: [],
      rejected: request.ops.map((op) => ({ opId: op.opId, code: 'invalid_op', message: 'no' })),
    });
    const stored = oldItem({
      improvised: [{ kind: 'tanam', raga: kanada }],
      layaVinyasam: { nadai: khanda, note: 'sent' },
    });
    const sent = outboxEntry(stored, true);
    const phone = await oldStore(async (store) => {
      await store.table('items').put(stored);
      await store.table('outbox').add(sent);
    });

    await syncOnce(server, { db: phone });

    const [entry] = await listAttention(phone);
    expect(entry).toMatchObject({ opId: sent.opId, code: 'invalid_op' });
    const kept = (await phone.attention.get(sent.opId))!.row as Item;
    expect(kept.improvised).toEqual([{ kind: 'tanam', ragas: [kanada] }]);
    expect(kept.layaVinyasam).toEqual({ nadais: [khanda], note: 'sent' });
    // "Keep mine" sends the phone's row, in the new shape, as a new op.
    server.push = KeepingServer.prototype.push.bind(server);
    await keepMine(sent.opId, phone);
    await syncOnce(server, { db: phone });
    const resent = server.pushes.flatMap((push) => push.ops).at(-1)!;
    expect(resent.opId).not.toBe(sent.opId);
    expect((resent.row as Item).layaVinyasam).toEqual({ nadais: [khanda], note: 'sent' });
  });

  it('a whole batch refused (400) after the upgrade is kept in the new shape too', async () => {
    const server = new KeepingServer();
    server.push = async () => {
      throw new SyncError({ kind: 'bad_request', message: 'bad' });
    };
    const stored = oldItem({ improvised: [{ kind: 'niraval', raga: null }] });
    const sent = outboxEntry(stored, true);
    const phone = await oldStore(async (store) => {
      await store.table('items').put(stored);
      await store.table('outbox').add(sent);
    });

    await syncOnce(server, { db: phone }).catch(() => undefined);

    const kept = (await phone.attention.toArray()).map((entry) => entry.row as Item);
    expect(kept.map((row) => row.improvised)).toEqual([[{ kind: 'niraval', ragas: [] }]]);
  });
});
