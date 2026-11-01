// Test-only: the store and catalog code the e2e tests drive inside the real app's page, until
// the screens that call them exist (T040 to T044). e2e/harness/build.ts bundles it for
// injection; it is never part of the app's build.

import { decodeSnapshot, verifySnapshot } from '../../src/catalog/load';
import { buildIndex } from '../../src/catalog/search';
import * as model from '../../src/model';
import { db } from '../../src/store/db';
import * as events from '../../src/store/events';
import * as items from '../../src/store/items';
import * as people from '../../src/store/people';
import * as queries from '../../src/store/queries';

const harness = {
  db,
  events,
  items,
  people,
  queries,
  model,
  decodeSnapshot,
  verifySnapshot,
  buildIndex,
};

export type Harness = typeof harness;

(globalThis as { harness?: Harness }).harness = harness;
