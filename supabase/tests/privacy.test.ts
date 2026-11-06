// T068 (required, privacy; SC-015, eng review D5, outside voice 10): rasika A cannot read or
// write rasika B's rows through any table or function; a pushed row for another rasika is
// rejected `foreign_rasika`; the private schema is unreachable through the API; every
// Maintainer function refuses an ordinary rasika; and an anonymous caller can execute nothing.

import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { SYNC_FUNCTIONS, type PushOp } from '../../app/src/model/sync-payloads';
import {
  asRasika,
  apiClient,
  call,
  claim,
  consent,
  db,
  latestRows,
  me,
  newAppearance,
  newArtist,
  newEvent,
  newItem,
  op,
  pullAll,
  pushOk,
  signUpWriter,
  type Rasika,
} from './server';

const RASIKA_FUNCTIONS: string[] = Object.values(SYNC_FUNCTIONS);
/**
 * The Maintainer's functions in `public` (Phase 8). Every function the API exposes must be
 * listed here or in RASIKA_FUNCTIONS, so a new one is classified before it ships.
 */
const MAINTAINER_FUNCTIONS: string[] = ['admin_deletion'];

let a: Rasika;
let b: Rasika;
const aEvent = newEvent({ note: 'A private note' });
const aArtist = newArtist('Abhishek Raghuram');
const aItem = newItem(aEvent.id, 1, { note: 'Sat in row 3' });
const aAppearance = newAppearance(aEvent.id, aArtist.id, 0);

beforeAll(async () => {
  [a, b] = await Promise.all([signUpWriter('a'), signUpWriter('b')]);
  const pushed = await pushOk(a, [
    op('events', aEvent),
    op('artists', aArtist),
    op('appearances', aAppearance),
    op('items', aItem),
  ]);
  expect(pushed.rejected).toEqual([]);
  await consent(a, { shareAdditions: true, seasonReports: false });
  await pushOk(b, [op('events', newEvent())]);
});

async function aRows() {
  return db`
    select 'events' as t, id, seq, data from private.events where rasika_id = ${a.rasikaId}
    union all select 'items', id, seq, data from private.items where rasika_id = ${a.rasikaId}
    union all select 'artists', id, seq, data from private.artists where rasika_id = ${a.rasikaId}
    union all select 'appearances', id, seq, data from private.appearances where rasika_id = ${a.rasikaId}
    order by seq`;
}

describe('through the functions', () => {
  it("B's pull returns none of A's rows", async () => {
    const { changes } = await pullAll(b);
    const ids = new Set(changes.map((change) => change.row.id));
    for (const id of [aEvent.id, aArtist.id, aItem.id, aAppearance.id])
      expect(ids.has(id)).toBe(false);
    expect(JSON.stringify(changes)).not.toContain('A private note');
  });

  it("B's me shows only B", async () => {
    const reply = await me(b);
    expect(reply.data?.id).toBe(b.rasikaId);
    expect(reply.data?.writerDeviceId).toBe(b.deviceId);
    expect(reply.data?.shareAdditions).toBeNull();
  });

  it("rejects B's push of a row with A's id as foreign_rasika and leaves A's row as it was", async () => {
    const before = await aRows();
    const seqOf = new Map(before.map((row) => [`${row.t}:${row.id}`, Number(row.seq)]));
    // Each attempt is a new push with new opIds, so the owner check runs every time and no
    // answer is replayed from processed_op.
    const takeovers = (guess: boolean) => {
      const rows = [
        ['events', { ...newEvent(), id: aEvent.id, note: 'B was here' }],
        ['items', { ...newItem(aEvent.id, 9), id: aItem.id }],
        ['artists', { ...newArtist('B'), id: aArtist.id }],
        ['appearances', { ...newAppearance(aEvent.id, aArtist.id, 1), id: aAppearance.id }],
      ] as const;
      return rows.map(([table, row]) => {
        // With guess, baseSeq is A's real seq for that record: right for A, still refused for B.
        const baseSeq = guess ? seqOf.get(`${table}:${row.id}`) : 0;
        if (baseSeq === undefined) throw new Error(`no seq for ${table} ${row.id}`);
        return { opId: randomUUID(), table, baseSeq, row } as PushOp;
      });
    };

    for (const guess of [false, true]) {
      const attempt = takeovers(guess);
      const response = await pushOk(b, attempt);
      expect(response.acked).toEqual([]);
      expect(response.rejected.map((r) => [r.opId, r.code])).toEqual(
        attempt.map((o) => [o.opId, 'foreign_rasika']),
      );
    }
    expect(await aRows()).toEqual(before);
  });

  it("rejects B's new Item or Appearance under A's Event as missing_event", async () => {
    const response = await pushOk(b, [
      op('items', newItem(aEvent.id, 1)),
      op('appearances', newAppearance(aEvent.id, randomUUID(), 0)),
    ]);
    expect(response.rejected.map((r) => r.code)).toEqual(['missing_event', 'missing_event']);
  });

  it("does not let B's consent or claim touch A", async () => {
    const [before] = await db`select * from private.rasika where id = ${a.rasikaId}`;
    await consent(b, { shareAdditions: false, seasonReports: true });
    await claim(b, { deviceId: a.deviceId, label: "A's phone id" });
    const [after] = await db`select * from private.rasika where id = ${a.rasikaId}`;
    expect(after).toEqual(before);
    const [events] = await db<{ count: number }[]>`
      select count(*)::int as count from private.consent_event where rasika_id = ${a.rasikaId}`;
    // A answered both questions once, in beforeAll.
    expect(events!.count).toBe(2);
    await claim(b, { deviceId: b.deviceId, label: 'Test phone' });
  });
});

describe('row-level security, as B inside the database', () => {
  const tables = async () =>
    (
      await db<{ name: string }[]>`
        select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'private' and c.relkind in ('r', 'p') order by 1`
    ).map((row) => row.name);

  it('is on for every table', async () => {
    const off = await db`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'private' and c.relkind in ('r', 'p') and not c.relrowsecurity`;
    expect(off).toEqual([]);
  });

  it("shows B none of A's rows in any table or view B can read", async () => {
    const readable = await db<{ name: string }[]>`
      select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'private' and c.relkind in ('r', 'p', 'v')
        and has_table_privilege('authenticated', c.oid, 'select') order by 1`;
    expect(readable.length).toBeGreaterThan(0);
    for (const { name } of readable) {
      const leaked = await asRasika(
        b,
        (sql) => sql`
        select 1 from ${sql('private.' + name)} t
        where to_jsonb(t)::text like ${'%' + a.rasikaId + '%'}
           or to_jsonb(t)::text like ${'%' + aEvent.id + '%'}
           or to_jsonb(t)::text like ${'%' + a.userId + '%'}`,
      );
      expect(leaked, name).toEqual([]);
    }
  });

  it("lets B update or insert nothing of A's", async () => {
    for (const name of ['events', 'items', 'artists', 'appearances', 'sabhas']) {
      const updated = await asRasika(
        b,
        (sql) => sql`
        update ${sql('private.' + name)} set data = '{}'::jsonb where rasika_id = ${a.rasikaId}`,
      );
      expect(updated.count, name).toBe(0);
    }
    const updated = await asRasika(
      b,
      (sql) => sql`
      update private.rasika set writer_device_id = ${b.deviceId} where id = ${a.rasikaId}`,
    );
    expect(updated.count).toBe(0);
    await expect(
      asRasika(
        b,
        (sql) => sql`
        insert into private.events (id, rasika_id, seq, data)
        values (${randomUUID()}, ${a.rasikaId}, 1, '{}'::jsonb)`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asRasika(
        b,
        (sql) => sql`
        insert into private.consent_event (rasika_id, purpose, value)
        values (${a.rasikaId}, 'season_reports', true)`,
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await tables()).toContain('events');
  });

  it('gives B no way to delete a row or rewrite a consent', async () => {
    for (const name of ['events', 'items', 'processed_op', 'consent_event', 'rasika', 'device']) {
      await expect(
        asRasika(b, (sql) => sql`delete from ${sql('private.' + name)}`),
        name,
      ).rejects.toThrow(/permission denied/);
    }
    await expect(
      asRasika(b, (sql) => sql`update private.consent_event set value = true`),
    ).rejects.toThrow(/permission denied/);
  });

  it('never shows anyone the Maintainer allowlist', async () => {
    await expect(asRasika(b, (sql) => sql`select * from private.maintainer`)).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('through the API', () => {
  it('exposes no table or view at all: the season is reachable only through the functions', async () => {
    const exposed = await db`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')`;
    expect(exposed).toEqual([]);
  });

  it('refuses every private table and view, for B and for an anonymous caller', async () => {
    const all = await db<{ name: string }[]>`
      select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'private' and c.relkind in ('r', 'p', 'v', 'm') order by 1`;
    expect(all.map((row) => row.name)).toEqual(
      expect.arrayContaining(['events', 'season_change', 'shared_change', 'maintainer', 'rasika']),
    );
    for (const client of [b.client, apiClient()]) {
      for (const { name } of all) {
        const viaSchema = await client.schema('private').from(name).select('*');
        expect(viaSchema.data, name).toBeNull();
        expect(viaSchema.error?.code, name).toBe('PGRST106');
        const viaPublic = await client.from(name).select('*');
        expect(viaPublic.data, name).toBeNull();
        expect(viaPublic.error, name).not.toBeNull();
        const insert = await client.schema('private').from(name).insert({ id: randomUUID() });
        expect(insert.error, name).not.toBeNull();
      }
    }
  });

  it('cannot call a private helper as an API function', async () => {
    for (const name of ['apply_op', 'owned_by_another', 'check_request', 'current_rasika_id']) {
      const reply = await call(b.client, name, {});
      expect(reply.status, name).toBe(404);
    }
  });
});

describe('who may execute what', () => {
  const functions = (schema: string) =>
    db<{ name: string; signature: string; anon: boolean; everyone: boolean }[]>`
      select p.proname as name, p.oid::regprocedure::text as signature,
        has_function_privilege('anon', p.oid, 'execute') as anon,
        exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                where acl.grantee = 0 and acl.privilege_type = 'EXECUTE') as everyone
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = ${schema}
      order by 1`;

  it('lets an anonymous caller execute no function, in the database or through the API', async () => {
    for (const schema of ['public', 'private']) {
      for (const fn of await functions(schema)) {
        expect(fn.anon, fn.signature).toBe(false);
        expect(fn.everyone, fn.signature).toBe(false);
      }
    }
    const anonymous = apiClient();
    for (const fn of await functions('public')) {
      const reply = await call(anonymous, fn.name, {});
      expect(reply.status, fn.name).toBe(401);
    }
  });

  it('classifies every exposed function as a rasika one or a Maintainer one', async () => {
    const names = (await functions('public')).map((fn) => fn.name).sort();
    expect(names).toEqual([...RASIKA_FUNCTIONS, ...MAINTAINER_FUNCTIONS].sort());
  });

  it('has every Maintainer function refuse an ordinary rasika, and change nothing', async () => {
    expect(MAINTAINER_FUNCTIONS.length).toBeGreaterThan(0);
    const [before] = await db`select * from private.rasika where id = ${a.rasikaId}`;
    for (const name of MAINTAINER_FUNCTIONS) {
      // An empty body, and one that names a real rasika: both refused before any other check.
      for (const body of [{}, { email: a.email }]) {
        const reply = await call(b.client, name, body);
        expect(reply.status, name).toBe(403);
        expect(reply.error?.code, name).toBe('not_maintainer');
      }
    }
    const [after] = await db`select * from private.rasika where id = ${a.rasikaId}`;
    expect(after).toEqual(before);
    expect((await me(a)).status).toBe(200);
  });
});

describe('what A keeps', () => {
  it("still pulls A's season untouched after everything B tried", async () => {
    const rows = latestRows((await pullAll(a)).changes);
    expect(rows.get(`events:${aEvent.id}`)).toEqual(aEvent);
    expect(rows.get(`items:${aItem.id}`)).toEqual(aItem);
    expect(rows.get(`artists:${aArtist.id}`)).toEqual(aArtist);
    expect(rows.get(`appearances:${aAppearance.id}`)).toEqual(aAppearance);
  });
});
