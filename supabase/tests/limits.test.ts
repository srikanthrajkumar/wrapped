// T109 (the security review of 2026-11-27; 0008_limits.sql): one account can't fill the Free
// plan's database, a signed-out device stops at once, and a deleted record keeps no note.
//
// The limits are the server's own (private.server_config), never lowered here: other test files
// run against the same stack at the same time. Where reaching a limit through the API would take
// minutes, the rasika's own rows are written directly as the database owner first.

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Artist, Item } from '../../app/src/model/records';
import type { PushOp } from '../../app/src/model/sync-payloads';
import {
  apiClient,
  claim,
  consent,
  db,
  me,
  newArtist,
  newEvent,
  newItem,
  op,
  pull,
  pullAll,
  push,
  pushOk,
  signUpWriter,
  type Rasika,
} from './server';

interface Limits {
  max_row_bytes: number;
  max_season_bytes: string;
  max_ops_per_day: number;
  max_consent_changes_per_day: number;
  max_devices: number;
}

async function limits(): Promise<Limits> {
  const [row] = await db<Limits[]>`
    select max_row_bytes, max_season_bytes, max_ops_per_day,
      max_consent_changes_per_day, max_devices
    from private.server_config`;
  return row!;
}

/** Random hex of `bytes` characters, which compresses poorly, as real text would not. */
function filler(bytes: number): string {
  let text = '';
  while (text.length < bytes) text += randomUUID().replaceAll('-', '');
  return text.slice(0, bytes);
}

async function stored(table: string, id: string) {
  const [row] = await db.unsafe<{ data: Record<string, unknown> }[]>(
    `select data from private.${table} where id = $1`,
    [id],
  );
  return row?.data;
}

async function seasonBytes(rasika: Rasika): Promise<number> {
  const [row] = await db<{ bytes: string }[]>`
    select private.season_bytes(${rasika.rasikaId}) as bytes`;
  return Number(row!.bytes);
}

describe('a pushed row over the size limit', () => {
  it('is rejected invalid_op and stores nothing, while a row under it is acked', async () => {
    const rasika = await signUpWriter('big-row');
    const { max_row_bytes } = await limits();
    const big = { ...newArtist('Too long'), aliases: [filler(max_row_bytes)] };
    const fits = newArtist('Fits');

    const reply = await pushOk(rasika, [op('artists', big), op('artists', fits)]);

    expect(reply.acked).toHaveLength(1);
    expect(reply.rejected).toEqual([
      expect.objectContaining({ code: 'invalid_op', message: expect.stringContaining('larger') }),
    ]);
    expect(await stored('artists', big.id)).toBeUndefined();
    expect(await stored('artists', fits.id)).toBeDefined();
  });

  it('takes a row at exactly the limit, and its plain delete, but not a byte more', async () => {
    const rasika = await signUpWriter('row-at-limit');
    const { max_row_bytes } = await limits();
    // The row's size as the limit counts it: its JSON text without the two timestamps.
    const counted = async (row: Artist): Promise<number> => {
      const [size] = await db<{ bytes: number }[]>`
        select octet_length(((${JSON.stringify(row)}::text)::jsonb - 'deletedAt' - 'updatedAt')::text)
          as bytes`;
      return size!.bytes;
    };
    const bare = { ...newArtist('At the limit'), aliases: [''] };
    const atLimit = { ...bare, aliases: [filler(max_row_bytes - (await counted(bare)))] };
    expect(await counted(atLimit)).toBe(max_row_bytes);
    const overLimit = {
      ...newArtist('At the limit'),
      aliases: [filler(max_row_bytes - (await counted(bare)) + 1)],
    };

    const reply = await pushOk(rasika, [op('artists', atLimit), op('artists', overLimit)]);
    expect(reply.acked.map((ack) => ack.opId)).toHaveLength(1);
    expect(reply.rejected).toEqual([expect.objectContaining({ code: 'invalid_op' })]);

    const deletedAt = new Date().toISOString();
    const deleted = await pushOk(rasika, [
      op('artists', { ...atLimit, deletedAt, updatedAt: deletedAt }, reply.acked[0]!.seq),
    ]);
    expect(deleted.rejected).toEqual([]);
    expect(await stored('artists', atLimit.id)).toMatchObject({ deletedAt });
  });
});

/**
 * The season's size counted directly, to check season_bytes against: each row's JSON text without
 * its two timestamps, plus 128 bytes for them (0008_limits.sql, private.row_bytes).
 */
async function measuredBytes(rasika: Rasika): Promise<number> {
  const [row] = await db<{ bytes: string }[]>`
    select coalesce(sum(octet_length((data - 'deletedAt' - 'updatedAt')::text) + 128), 0) as bytes
    from (
      select data from private.events where rasika_id = ${rasika.rasikaId}
      union all select data from private.appearances where rasika_id = ${rasika.rasikaId}
      union all select data from private.items where rasika_id = ${rasika.rasikaId}
      union all select data from private.artists where rasika_id = ${rasika.rasikaId}
      union all select data from private.sabhas where rasika_id = ${rasika.rasikaId}
    ) s`;
  return Number(row!.bytes);
}

/** Brings the season to exactly `target` bytes with one filler row, written directly. */
async function fillTo(rasika: Rasika, target: number) {
  // `{"pad": "…"}` is the padding and 11 bytes, and every row counts 128 more.
  const pad = target - (await seasonBytes(rasika)) - 11 - 128;
  await db`
    insert into private.artists (id, rasika_id, seq, data)
    values (gen_random_uuid(), ${rasika.rasikaId}, nextval('private.season_seq'),
      jsonb_build_object('pad', repeat('x', ${pad}::integer)))`;
  expect(await seasonBytes(rasika)).toBe(target);
}

/** Drops the filler, which would weigh on every later run against this stack. */
async function dropFiller(rasika: Rasika) {
  await db`delete from private.artists where rasika_id = ${rasika.rasikaId} and data ? 'pad'`;
}

describe('a season near its size limit', () => {
  it('refuses a new row once full, but still takes a delete and a smaller edit', async () => {
    const rasika = await signUpWriter('full-season');
    const { max_season_bytes } = await limits();
    const kept = newEvent({ note: filler(2000) });
    const keptSeq = (await pushOk(rasika, [op('events', kept)])).acked[0]!.seq;
    const other = newArtist('Another');
    const otherSeq = (await pushOk(rasika, [op('artists', other)])).acked[0]!.seq;
    await fillTo(rasika, Number(max_season_bytes) - 100);

    const refused = await pushOk(rasika, [op('artists', newArtist('One more'))]);
    expect(refused.acked).toEqual([]);
    expect(refused.rejected).toEqual([
      expect.objectContaining({ code: 'invalid_op', message: expect.stringContaining('season') }),
    ]);

    const tidied = await pushOk(rasika, [
      op('events', { ...kept, note: 'Shorter' }, keptSeq),
      op('artists', { ...other, deletedAt: new Date().toISOString() }, otherSeq),
    ]);
    expect(tidied.rejected).toEqual([]);
    expect(tidied.acked).toHaveLength(2);
    await dropFiller(rasika);
  });

  it('takes every plain delete in a full season, however many', async () => {
    const rasika = await signUpWriter('tidy-season');
    const { max_season_bytes } = await limits();
    // 4,000 small live Artists without notes, as the phone stores them, written directly; then
    // the season filled to its limit.
    const rows = await db<{ id: string; seq: string; data: Record<string, unknown> }[]>`
      insert into private.artists (id, rasika_id, seq, data)
      select g.id, ${rasika.rasikaId}, nextval('private.season_seq'), jsonb_build_object(
        'id', g.id, 'name', 'Artist ' || g.n, 'nameKey', 'artist ' || g.n, 'aliases', '[]'::jsonb,
        'mergedIntoId', null, 'createdAt', '2026-12-01T10:00:00.000Z',
        'updatedAt', '2026-12-01T10:00:00.000Z', 'deletedAt', null)
      from (select gen_random_uuid() as id, n from generate_series(1, 4000) n) g
      returning id, seq, data`;
    await fillTo(rasika, Number(max_season_bytes));

    for (let start = 0; start < rows.length; start += 200) {
      const deletedAt = new Date().toISOString();
      const ops = rows
        .slice(start, start + 200)
        .map((row) =>
          op(
            'artists',
            { ...(row.data as unknown as Artist), deletedAt, updatedAt: deletedAt },
            Number(row.seq),
          ),
        );
      const reply = await pushOk(rasika, ops);
      expect(reply.rejected).toEqual([]);
      expect(reply.acked).toHaveLength(ops.length);
    }
    expect(await seasonBytes(rasika)).toBeLessThanOrEqual(Number(max_season_bytes));
    await db`delete from private.artists where rasika_id = ${rasika.rasikaId}`;
  });

  it('takes a plain delete at exactly the limit, whatever its notes hold', async () => {
    const rasika = await signUpWriter('delete-at-limit');
    const { max_season_bytes } = await limits();
    const event = newEvent();
    // Notes that emptying could grow if it wrote null: "" and one character.
    const rows = [
      op('events', event),
      op('items', newItem(event.id, 1, { note: '' })),
      op('items', newItem(event.id, 2, { note: 'a' })),
      op('items', newItem(event.id, 3, { layaVinyasam: { nadais: [], note: 'b' } })),
      op('items', newItem(event.id, 4, { note: null })),
    ];
    const acks = (await pushOk(rasika, rows)).acked;
    expect(acks).toHaveLength(rows.length);
    await fillTo(rasika, Number(max_season_bytes));

    const deletedAt = new Date().toISOString();
    const deletes = rows
      .slice(1)
      .map((row, index) =>
        op(
          'items',
          { ...(row.row as Item), deletedAt, updatedAt: deletedAt },
          acks[index + 1]!.seq,
        ),
      );
    const reply = await pushOk(rasika, deletes);
    expect(reply.rejected).toEqual([]);
    expect(reply.acked).toHaveLength(deletes.length);
    expect(await seasonBytes(rasika)).toBeLessThanOrEqual(Number(max_season_bytes));
    await dropFiller(rasika);
  });

  it('refuses a timestamp too long for the count to cover', async () => {
    const rasika = await signUpWriter('long-timestamp');
    const artist = newArtist('Padded');
    const reply = await pushOk(rasika, [
      op('artists', { ...artist, updatedAt: `2026-12-01T10:00:00.000Z${' '.repeat(30)}` }),
    ]);
    expect(reply.rejected).toEqual([
      expect.objectContaining({
        code: 'invalid_op',
        message: expect.stringContaining('timestamps'),
      }),
    ]);
    expect(await stored('artists', artist.id)).toBeUndefined();
  });

  it('never lets deletes grow it past the limit, however often a tombstone is rewritten', async () => {
    const rasika = await signUpWriter('growing-tombstone');
    const { max_season_bytes } = await limits();
    const artist = newArtist('Deleted');
    let seq = (await pushOk(rasika, [op('artists', artist)])).acked[0]!.seq;
    await fillTo(rasika, Number(max_season_bytes) - 1000);

    let refusals = 0;
    for (let round = 1; round <= 6; round += 1) {
      // Each round rewrites the tombstone 400 bytes larger.
      const tombstone = {
        ...artist,
        aliases: [filler(400 * round)],
        deletedAt: new Date().toISOString(),
      };
      const reply = await pushOk(rasika, [op('artists', tombstone, seq)]);
      if (reply.acked[0]) seq = reply.acked[0].seq;
      else refusals += 1;
      expect(await seasonBytes(rasika)).toBeLessThanOrEqual(Number(max_season_bytes));
    }
    expect(refusals).toBeGreaterThan(0);
    await dropFiller(rasika);
  });

  it('counts an edit by exactly what it adds or frees, compressible or not', async () => {
    const rasika = await signUpWriter('measured');
    const artist = { ...newArtist('Long aliases'), aliases: ['a'.repeat(60_000)] };
    const seq = (await pushOk(rasika, [op('artists', artist)])).acked[0]!.seq;
    expect(await seasonBytes(rasika)).toBe(await measuredBytes(rasika));
    expect(await seasonBytes(rasika)).toBeGreaterThan(60_000);

    await pushOk(rasika, [op('artists', { ...artist, aliases: ['a'.repeat(1_000)] }, seq)]);
    expect(await seasonBytes(rasika)).toBe(await measuredBytes(rasika));
    expect(await seasonBytes(rasika)).toBeLessThan(2_000);
  });
});

describe('the day’s op limit', () => {
  it('stops a push at the day’s limit, leaving the rest unanswered, and 429s one that can answer nothing', async () => {
    const rasika = await signUpWriter('busy');
    const { max_ops_per_day } = await limits();
    await db`
      insert into private.processed_op (rasika_id, op_id, code, message)
      select ${rasika.rasikaId}, gen_random_uuid(), 'invalid_op', 'earlier'
      from generate_series(1, ${max_ops_per_day - 1})`;
    const first = op('events', newEvent());
    const event = newEvent();
    const second = op('events', event);

    const reply = await pushOk(rasika, [first, second]);
    expect(reply.acked.map((ack) => ack.opId)).toEqual([first.opId]);
    expect(reply.rejected).toEqual([]);
    expect(await stored('events', event.id)).toBeUndefined();

    const refused = await push(rasika, [second]);
    expect(refused.status).toBe(429);
    expect(refused.error?.code).toBe('too_many_ops');
    expect(await stored('events', event.id)).toBeUndefined();
  });

  it('answers a retried op from its first answer, without counting it, even at the limit', async () => {
    const rasika = await signUpWriter('retry-at-limit');
    const { max_ops_per_day } = await limits();
    await db`
      insert into private.processed_op (rasika_id, op_id, code, message)
      select ${rasika.rasikaId}, gen_random_uuid(), 'invalid_op', 'earlier'
      from generate_series(1, ${max_ops_per_day - 1})`;
    const last = op('events', newEvent());
    const ack = (await pushOk(rasika, [last])).acked[0]!;

    // Its reply was lost: the phone sends it again, alone and then with a new op after it.
    expect((await pushOk(rasika, [last])).acked).toEqual([ack]);
    const next = op('events', newEvent());
    const mixed = await pushOk(rasika, [last, next]);
    expect(mixed.acked).toEqual([ack]);
    expect(mixed.rejected).toEqual([]);
  });
});

describe('consent changes', () => {
  it('answers 429 too_many_changes past the day’s limit, but always takes an unchanged answer', async () => {
    const rasika = await signUpWriter('toggler');
    const { max_consent_changes_per_day } = await limits();
    await db`
      insert into private.consent_event (rasika_id, purpose, value)
      select ${rasika.rasikaId}, 'share_additions', (n % 2 = 0)
      from generate_series(1, ${max_consent_changes_per_day}) n`;

    const changed = await consent(rasika, { shareAdditions: true });
    expect(changed.status).toBe(429);
    expect(changed.error?.code).toBe('too_many_changes');
    expect((await me(rasika)).data?.shareAdditions).toBeNull();

    const unchanged = await consent(rasika, {});
    expect(unchanged.status).toBe(200);
  });

  it('counts the changes a call would make, so two at once can’t pass the limit', async () => {
    const rasika = await signUpWriter('two-at-once');
    const { max_consent_changes_per_day } = await limits();
    await db`
      insert into private.consent_event (rasika_id, purpose, value)
      select ${rasika.rasikaId}, 'share_additions', (n % 2 = 0)
      from generate_series(1, ${max_consent_changes_per_day - 1}) n`;

    const both = await consent(rasika, { shareAdditions: true, seasonReports: true });
    expect(both.status).toBe(429);
    expect(both.error?.code).toBe('too_many_changes');

    const one = await consent(rasika, { seasonReports: true });
    expect(one.status).toBe(200);
    const [row] = await db<{ count: string }[]>`
      select count(*) from private.consent_event where rasika_id = ${rasika.rasikaId}`;
    expect(Number(row!.count)).toBe(max_consent_changes_per_day);
  });
});

describe('devices', () => {
  it('keeps only the most recently seen, and always the one claiming', async () => {
    const rasika = await signUpWriter('many-phones');
    const { max_devices } = await limits();
    await db`
      insert into private.device (rasika_id, id, label, last_seen_at)
      select ${rasika.rasikaId}, gen_random_uuid(), 'old', now() - make_interval(days => n)
      from generate_series(1, ${max_devices + 5}) n`;
    const phone = randomUUID();

    expect((await claim(rasika, { deviceId: phone, label: 'New phone' })).status).toBe(200);

    const devices = await db<{ id: string }[]>`
      select id from private.device where rasika_id = ${rasika.rasikaId}`;
    expect(devices).toHaveLength(max_devices);
    expect(devices.map((device) => device.id)).toContain(phone);
  });
});

describe('a signed-out session', () => {
  it("stops at once when another device signs out the account's other sessions", async () => {
    const rasika = await signUpWriter('lost-phone');
    const newPhone = apiClient();
    const signedIn = await newPhone.auth.signInWithPassword({
      email: rasika.email,
      password: rasika.password,
    });
    expect(signedIn.error).toBeNull();
    const fresh: Rasika = { ...rasika, client: newPhone, deviceId: randomUUID() };
    expect((await me(rasika)).status).toBe(200);

    const { error } = await newPhone.auth.signOut({ scope: 'others' });
    expect(error).toBeNull();

    // The lost phone's access token is still signed and unexpired, but its session is gone.
    for (const reply of [
      await me(rasika),
      await pull(rasika),
      await push(rasika, [op('events', newEvent())]),
      await claim(rasika, { deviceId: rasika.deviceId, label: 'Lost phone' }),
    ]) {
      expect(reply.status).toBe(401);
      expect(reply.error?.code).toBe('session_ended');
    }
    // The device that signed the others out carries on.
    expect((await claim(fresh, { deviceId: fresh.deviceId, label: 'New phone' })).status).toBe(200);
    expect((await me(fresh)).data?.writerDeviceId).toBe(fresh.deviceId);
  });
});

describe('a deleted record', () => {
  it('keeps no note text on the server, and Undo brings it back', async () => {
    const rasika = await signUpWriter('deleter');
    const event = newEvent({ note: 'Went with my cousin', title: 'Kept' });
    const item = newItem(event.id, 1, {
      note: 'Cried a little',
      layaVinyasam: { nadais: [], note: 'Tisram in the swarams' },
    });
    const [eventAck, itemAck] = (await pushOk(rasika, [op('events', event), op('items', item)]))
      .acked;

    const deletedAt = new Date().toISOString();
    const deleted = await pushOk(rasika, [
      op('items', { ...item, deletedAt }, itemAck!.seq),
      op('events', { ...event, deletedAt }, eventAck!.seq),
    ]);
    expect(deleted.rejected).toEqual([]);

    expect(await stored('events', event.id)).toMatchObject({
      title: 'Kept',
      note: '',
      deletedAt,
    });
    expect(await stored('items', item.id)).toMatchObject({
      title: 'Item 1',
      note: '',
      layaVinyasam: { nadais: [], note: '' },
    });
    const pulled = (await pullAll(rasika)).changes.find((change) => change.row.id === event.id);
    expect(pulled?.row).toMatchObject({ note: '', deletedAt });

    // Undo pushes the phone's own copy, note and all.
    const ops: PushOp[] = [
      op('events', { ...event, deletedAt: null }, deleted.acked[1]!.seq),
      op('items', { ...item, deletedAt: null }, deleted.acked[0]!.seq),
    ];
    expect((await pushOk(rasika, ops)).rejected).toEqual([]);
    expect(await stored('events', event.id)).toMatchObject({ note: 'Went with my cousin' });
    expect(await stored('items', item.id)).toMatchObject({
      note: 'Cried a little',
      layaVinyasam: { note: 'Tisram in the swarams' },
    });
  });
});
