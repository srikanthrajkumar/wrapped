import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SEED_JSON, SEED_SQL, seedSql } from './seed-sql.mjs';

describe('supabase/seed.sql', () => {
  it('matches the shared lists it is generated from', () => {
    const lists = JSON.parse(readFileSync(SEED_JSON, 'utf8'));
    expect(readFileSync(SEED_SQL, 'utf8')).toBe(seedSql(lists));
  });
});
