// Shared by the store and catalog tests: a fresh database per test, and the handmade snapshots.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { decodeSnapshot, type Catalog } from '../src/catalog/load';
import { newId } from '../src/model';
import { WrappedDB } from '../src/store/db';

const open: WrappedDB[] = [];

afterEach(async () => {
  for (const db of open.splice(0)) await db.delete();
});

/** A database of its own, deleted after the test. */
export function freshDb(name = `test-${newId()}`): WrappedDB {
  const db = new WrappedDB(name);
  open.push(db);
  return db;
}

/** Close `db` and open the same database again: a stand-in for a force-close and relaunch. */
export function reopen(db: WrappedDB): WrappedDB {
  db.close();
  return freshDb(db.name);
}

export function fixtureCatalog(name: 'catalog-v1.json' | 'catalog-v2.json'): Catalog {
  return decodeSnapshot(
    JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')),
  );
}
