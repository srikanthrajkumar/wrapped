// T076 (required, privacy; FR-047, data-model.md "Deletion and de-identification"): a deletion
// request erases the rasika's identity, every note, their entries in Supabase Auth's audit log
// and their processed ops; keeps the season unlinked only if they said yes to season reports;
// keeps the consent events; and only the Maintainer can ask.

import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Item } from '../../app/src/model/records';
import {
  call,
  consent,
  db,
  me,
  newAppearance,
  newArtist,
  newEvent,
  newItem,
  newSabha,
  op,
  pull,
  push,
  pushOk,
  signUp,
  signUpWriter,
  type Rasika,
} from './server';

const SEASON_TABLES = ['events', 'appearances', 'items', 'artists', 'sabhas', 'link'] as const;

let maintainer: Rasika;

beforeAll(async () => {
  maintainer = await signUp('maintainer');
  await db`insert into private.maintainer (auth_user_id) values (${maintainer.userId})`;
});

/** A rasika with a name only they have, a season with notes everywhere, a Link, and consents. */
async function rasikaWithSeason(seasonReports: boolean | null) {
  const label = `del${randomUUID().slice(0, 8)}`;
  const rasika = await signUpWriter(label);
  const notes = [
    `Went with my sister ${label}`,
    `Sat in row 3 ${label}`,
    `Amazing korvai ${label}`,
  ];
  const event = newEvent({ note: notes[0]! });
  const artist = newArtist('My guru');
  const sabha = newSabha('Our street sabha');
  const items: Item[] = [
    newItem(event.id, 1, { note: notes[1]! }),
    newItem(event.id, 2, {
      layaVinyasam: {
        nadai: { state: 'catalog', key: 'khanda', text: 'Khanda', guess: false },
        note: notes[2]!,
      },
    }),
  ];
  const pushed = await pushOk(rasika, [
    op('events', event),
    op('artists', artist),
    op('sabhas', sabha),
    op('appearances', newAppearance(event.id, artist.id, 0)),
    ...items.map((item) => op('items', item)),
  ]);
  expect(pushed.rejected).toEqual([]);
  await db`
    insert into private.link (rasika_id, seq, own_table, own_id, shared_id)
    values (${rasika.rasikaId}, nextval('private.season_seq'), 'artist', ${artist.id}, ${randomUUID()})`;
  await consent(rasika, { shareAdditions: true });
  if (seasonReports !== null) await consent(rasika, { seasonReports });
  return { rasika, name: `Test ${label}`, event, artist, sabha, items, notes };
}

function deletion(by: Rasika, email: string) {
  return call(by.client, 'admin_deletion', { email });
}

async function seasonCounts(rasikaId: string) {
  const counts: Record<string, number> = {};
  for (const table of SEASON_TABLES) {
    const [row] = await db<{ n: number }[]>`
      select count(*)::int as n from ${db('private.' + table)} where rasika_id = ${rasikaId}`;
    counts[table] = row!.n;
  }
  return counts;
}

async function processedOps(rasikaId: string) {
  const [row] = await db<{ n: number }[]>`
    select count(*)::int as n from private.processed_op where rasika_id = ${rasikaId}`;
  return row!.n;
}

async function consentEvents(rasikaId: string) {
  return db`select purpose, value, at from private.consent_event where rasika_id = ${rasikaId} order by id`;
}

/** Every table in the database, in every schema, holding a row that mentions any of `needles`. */
async function tablesMentioning(needles: string[]) {
  const tables = await db<{ schema: string; name: string }[]>`
    select n.nspname as schema, c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
    order by 1, 2`;
  const patterns = needles.map((needle) => `%${needle}%`);
  const found: string[] = [];
  for (const { schema, name } of tables) {
    const [row] = await db<{ n: number }[]>`
      select count(*)::int as n from ${db(schema + '.' + name)} x
      where x::text ilike any(${patterns})`;
    if (row!.n > 0) found.push(`${schema}.${name}`);
  }
  return found;
}

describe('a deletion request, with a yes to season reports', () => {
  it('keeps the season unlinked from the email, the name and the auth user, with every note gone', async () => {
    const { rasika, name, event, artist, sabha, items, notes } = await rasikaWithSeason(true);
    const consentsBefore = await consentEvents(rasika.rasikaId);
    const countsBefore = await seasonCounts(rasika.rasikaId);
    expect(await processedOps(rasika.rasikaId)).toBeGreaterThan(0);

    const reply = await deletion(maintainer, rasika.email);
    expect(reply.status).toBe(200);
    expect(reply.data).toEqual({ deidentified: true });

    // The rasika row keeps only its opaque id and consents.
    const [row] = await db`select * from private.rasika where id = ${rasika.rasikaId}`;
    expect(row).toMatchObject({
      auth_user_id: null,
      email: null,
      name: null,
      writer_device_id: null,
      share_additions: true,
      season_reports: true,
    });
    expect(row!.deidentified_at).toBeInstanceOf(Date);
    expect(await db`select 1 from private.device where rasika_id = ${rasika.rasikaId}`).toEqual([]);
    expect(await db`select 1 from auth.users where id = ${rasika.userId}`).toEqual([]);
    expect(await db`select 1 from auth.sessions where user_id = ${rasika.userId}`).toEqual([]);

    // The season stays, every note nulled; nothing else in the records changes. Own names and
    // titles stay: season reports count them.
    expect(await seasonCounts(rasika.rasikaId)).toEqual(countsBefore);
    const [storedArtist] = await db<{ data: unknown }[]>`
      select data from private.artists where id = ${artist.id}`;
    expect(storedArtist!.data).toEqual(artist);
    const [storedSabha] = await db<{ data: unknown }[]>`
      select data from private.sabhas where id = ${sabha.id}`;
    expect(storedSabha!.data).toEqual(sabha);
    const [storedEvent] = await db<{ data: Record<string, unknown> }[]>`
      select data from private.events where id = ${event.id}`;
    expect(storedEvent!.data).toEqual({ ...event, note: null });
    const storedItems = await db<{ id: string; data: Item }[]>`
      select id, data from private.items where rasika_id = ${rasika.rasikaId}`;
    for (const item of items) {
      const stored = storedItems.find((row) => row.id === item.id)!.data;
      const expected: Item = {
        ...item,
        note: null,
        layaVinyasam: item.layaVinyasam && { ...item.layaVinyasam, note: null },
      };
      expect(stored).toEqual(expected);
    }
    // Each note is unique to this rasika, so a match anywhere would be theirs.
    for (const note of notes) {
      expect(await tablesMentioning([note]), note).toEqual([]);
    }

    // The consent events stay.
    expect(await consentEvents(rasika.rasikaId)).toEqual(consentsBefore);

    // Nothing anywhere names them, Supabase Auth's audit log included.
    expect(await tablesMentioning([rasika.email, name, rasika.userId])).toEqual([]);
    expect(await processedOps(rasika.rasikaId)).toBe(0);
  });
});

describe('a deletion request, without a yes to season reports', () => {
  for (const seasonReports of [false, null]) {
    it(`deletes the season, Links included, when season reports is ${seasonReports}`, async () => {
      const { rasika } = await rasikaWithSeason(seasonReports);
      const consentsBefore = await consentEvents(rasika.rasikaId);

      expect((await deletion(maintainer, rasika.email)).data).toEqual({ deidentified: true });

      expect(await seasonCounts(rasika.rasikaId)).toEqual({
        events: 0,
        appearances: 0,
        items: 0,
        artists: 0,
        sabhas: 0,
        link: 0,
      });
      const [row] = await db`
        select email, name, auth_user_id, deidentified_at from private.rasika
        where id = ${rasika.rasikaId}`;
      expect(row).toMatchObject({ email: null, name: null, auth_user_id: null });
      expect(row!.deidentified_at).toBeInstanceOf(Date);
      expect(await consentEvents(rasika.rasikaId)).toEqual(consentsBefore);
      expect(await processedOps(rasika.rasikaId)).toBe(0);
    });
  }
});

describe('after the deletion', () => {
  it('refuses the old access token and its refresh token', async () => {
    const { rasika } = await rasikaWithSeason(true);
    await deletion(maintainer, rasika.email);

    // The access token is still signed and unexpired, but it names no account any more.
    for (const reply of [
      await me(rasika),
      await pull(rasika),
      await push(rasika, [op('events', newEvent())]),
      await consent(rasika, { seasonReports: false }),
    ]) {
      expect(reply.status).toBe(403);
      expect(reply.error?.code).toBe('no_account');
    }
    const refreshed = await rasika.client.auth.refreshSession();
    expect(refreshed.error).not.toBeNull();
  });

  it('treats a second request for the same email as done, and changes nothing', async () => {
    const { rasika } = await rasikaWithSeason(true);
    expect((await deletion(maintainer, rasika.email)).data).toEqual({ deidentified: true });
    const [rowAfterFirst] = await db`select * from private.rasika where id = ${rasika.rasikaId}`;
    const countsAfterFirst = await seasonCounts(rasika.rasikaId);

    const again = await deletion(maintainer, rasika.email);

    expect(again.status).toBe(200);
    expect(again.data).toEqual({ deidentified: false });
    expect((await db`select * from private.rasika where id = ${rasika.rasikaId}`)[0]).toEqual(
      rowAfterFirst,
    );
    expect(await seasonCounts(rasika.rasikaId)).toEqual(countsAfterFirst);
  });

  it('matches the email whatever its case or spacing, and touches no other rasika', async () => {
    const { rasika } = await rasikaWithSeason(false);
    const other = await rasikaWithSeason(true);
    const otherBefore = await seasonCounts(other.rasika.rasikaId);

    const reply = await deletion(maintainer, `  ${rasika.email.toUpperCase()} `);

    expect(reply.data).toEqual({ deidentified: true });
    expect(await seasonCounts(other.rasika.rasikaId)).toEqual(otherBefore);
    expect((await me(other.rasika)).data?.name).toBe(other.name);
  });

  it("keeps another user's audit log entries, even under an email containing theirs", async () => {
    const { rasika } = await rasikaWithSeason(true);
    const stranger = `x${rasika.email}`;
    const entryId = randomUUID();
    await db`
      insert into auth.audit_log_entries (instance_id, id, payload, created_at)
      values (
        '00000000-0000-0000-0000-000000000000', ${entryId},
        ${db.json({ action: 'login', actor_id: randomUUID(), actor_username: stranger })},
        now()
      )`;

    await deletion(maintainer, rasika.email);

    expect(await db`select 1 from auth.audit_log_entries where id = ${entryId}`).toHaveLength(1);
    expect(await tablesMentioning([rasika.userId])).toEqual([]);
  });

  it('answers false for an email with no account', async () => {
    const reply = await deletion(maintainer, `nobody-${randomUUID()}@example.test`);
    expect(reply.data).toEqual({ deidentified: false });
  });
});

describe('who may ask', () => {
  it('refuses a rasika, even one asking about themselves, and changes nothing', async () => {
    const { rasika } = await rasikaWithSeason(true);
    const before = await seasonCounts(rasika.rasikaId);

    const reply = await deletion(rasika, rasika.email);

    expect(reply.status).toBe(403);
    expect(reply.error?.code).toBe('not_maintainer');
    expect(await seasonCounts(rasika.rasikaId)).toEqual(before);
    expect((await me(rasika)).status).toBe(200);
  });
});
