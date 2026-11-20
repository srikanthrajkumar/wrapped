// Required test (constitution IV; ADR 0012): the store's version 5 upgrade must never stop the
// store from opening. A damaged Item (a Manodharma part that is not an object, a Layavinyasam
// that is not one) is left exactly as it is, never thrown on and never rewritten.

import { describe, expect, it } from 'vitest';
import { upgradeItemFieldValue, upgradeItemShape, type Item } from '../../src/model';
import { createEvent } from '../../src/store/events';
import { addItem, setLayaNadais } from '../../src/store/items';
import { itemProblems, RuleError } from '../../src/store/rules';
import { freshDb } from '../helpers';

const damaged = (fields: Record<string, unknown>) =>
  ({ id: 'i1', improvised: [], layaVinyasam: null, ...fields }) as unknown as Item;

describe('a damaged Item is left as it is by the upgrade (required, ADR 0012)', () => {
  it.each([
    ['a null part', { improvised: [null, { kind: 'alapana', raga: null }] }],
    ['a part that is text', { improvised: ['alapana'] }],
    ['a Layavinyasam that is text', { layaVinyasam: 'tisra' }],
    ['a Layavinyasam that is a number', { layaVinyasam: 5 }],
  ])('%s', (_name, fields) => {
    const item = damaged(fields);
    expect(() => upgradeItemShape(item)).not.toThrow();
    expect(upgradeItemShape(item)).toBe(item);
  });

  it('a damaged journalled value is left as it is too', () => {
    const parts = [null, { kind: 'tanam', raga: null }];
    expect(() => upgradeItemFieldValue('improvised', parts)).not.toThrow();
    expect(upgradeItemFieldValue('improvised', parts)).toBe(parts);
  });
});

const base = {
  id: 'i1',
  eventId: 'e1',
  position: 1,
  compositionKey: null,
  title: 'x',
  form: { state: 'unknown', key: null, text: '?', guess: false },
  ragas: [],
  tala: { state: 'unknown', key: null, text: '?', guess: false },
  nadai: { state: 'na', key: null, text: '', guess: false },
  composer: { state: 'unknown', key: null, text: '?', guess: false },
  language: { state: 'unknown', key: null, text: '?', guess: false },
  subject: { state: 'unknown', key: null, text: '?', guess: false },
  layaVinyasam: null,
  improvised: [],
  note: null,
};

describe('the rules refuse a list in the wrong shape, and nothing is written (ADR 0012)', () => {
  it.each([
    [
      'a part whose Ragas are not a list',
      { improvised: [{ kind: 'alapana', ragas: null }] },
      'alapana ragas must be a list',
    ],
    [
      'a part holding only the Item’s Raga',
      { improvised: [{ kind: 'tanam', ragas: [null] }] },
      "tanam holding only the Item's Raga is stored as following it",
    ],
    [
      'a Layavinyasam whose nadais are not a list',
      { layaVinyasam: { nadais: 'khanda', note: null } },
      'layavinyasam nadais must be a list',
    ],
    [
      'an unknown nadai',
      {
        layaVinyasam: {
          nadais: [{ state: 'catalog', key: 'fast', text: 'fast', guess: false }],
          note: null,
        },
      },
      'layavinyasam nadai 1: unknown nadai "fast"',
    ],
  ])('%s', (_name, fields, problem) => {
    expect(itemProblems({ ...base, ...fields } as unknown as Item)).toContain(problem);
  });

  it('a store action refuses such a list and writes nothing', async () => {
    const db = freshDb();
    const event = await createEvent({ kind: 'concert' }, { db });
    const item = await addItem(event.id, {}, { db });
    const before = { item: await db.items.get(item.id), outbox: await db.outbox.toArray() };
    const fast = { state: 'catalog', key: 'fast', text: 'fast', guess: false } as const;
    await expect(setLayaNadais(item.id, [fast], { db })).rejects.toBeInstanceOf(RuleError);
    expect(await db.items.get(item.id)).toEqual(before.item);
    expect(await db.outbox.toArray()).toEqual(before.outbox);
  });
});
