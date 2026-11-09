// What the public-data migrations may do in the logger's project (ADR 0009). The logger's
// exposure check (its `tools/check-db-exposure.ts`) flags any `ALTER DEFAULT PRIVILEGES` and any
// grant, table, function or policy in `public`, so these migrations hold only the Schedule's
// bucket and policies on `storage.objects`. The setup steps show the bucket migration for the
// dashboard's SQL Editor, so that copy must be the file exactly.

import { readdirSync, readFileSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, inject, it } from 'vitest';

const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url);
const SETUP = new URL('../../docs/setup/schedule-hosting.md', import.meta.url);

const files = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort();

/** A migration's statements, with comments and spacing taken out. */
function statements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** The only statements a public-data migration may hold. */
const ALLOWED = [
  /^insert into storage\.buckets\b/i,
  /^create policy "[^"]+" on storage\.objects\b/i,
  /^drop policy (if exists )?"[^"]+" on storage\.objects$/i,
];

describe('the public-data migrations (ADR 0009)', () => {
  it('touch only the Schedule’s bucket and policies on storage.objects', () => {
    expect(files).toEqual(['0001_schedule_bucket.sql']);
    for (const file of files) {
      const sql = readFileSync(new URL(file, MIGRATIONS), 'utf8');
      expect(sql, file).not.toMatch(/default\s+privileges/i);
      for (const statement of statements(sql)) {
        expect(
          ALLOWED.some((allowed) => allowed.test(statement)),
          `${file}: ${statement}`,
        ).toBe(true);
      }
    }
  });

  it('leave nothing in public: no table, view, sequence, function or policy', async () => {
    const db = postgres(inject('stack').dbUrl, { onnotice: () => {}, max: 1 });
    afterAll(async () => {
      await db.end();
    });
    const [counts] = await db<{ relations: number; functions: number; policies: number }[]>`
      select
        (select count(*)::int from pg_class where relnamespace = 'public'::regnamespace) as relations,
        (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace) as functions,
        (select count(*)::int from pg_policies where schemaname = 'public') as policies`;
    expect(counts).toEqual({ relations: 0, functions: 0, policies: 0 });
  });

  it('are shown in the setup steps exactly as they are, for the SQL Editor', () => {
    const doc = readFileSync(SETUP, 'utf8');
    const sql = readFileSync(new URL('0001_schedule_bucket.sql', MIGRATIONS), 'utf8');
    const shown = /```sql\n([\s\S]*?)```/.exec(doc)?.[1];
    expect(shown).toBe(sql);
  });
});
