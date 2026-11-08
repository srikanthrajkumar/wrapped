// The shared Sabhas' Aliases in the seed (the logger's short names, 2026-11-08): a name typed
// in the picker or printed by the Schedule feed finds the right Sabha by Alias, and no Alias
// folds to another Sabha's name or Alias, where the first one read would silently win.

import { describe, expect, it } from 'vitest';
import { fold } from '../../src/catalog/fold';
import seed from '../../src/reference/shared-lists.seed.json';
import { findSabhas, nameMatcher } from '../../src/store/people';
import { freshDb } from '../helpers';

const byName = new Map(seed.sabhas.map((sabha) => [sabha.name, sabha]));

describe('the seed Sabhas', () => {
  it('give each name and Alias one Sabha', () => {
    const owners = new Map<string, string>();
    for (const sabha of seed.sabhas) {
      for (const name of [sabha.name, ...sabha.aliases]) {
        const key = fold(name);
        expect(owners.get(key) ?? sabha.id, `${name} is also another Sabha's`).toBe(sabha.id);
        owners.set(key, sabha.id);
      }
    }
  });

  it.each([
    ['PSS', 'Parthasarathy Swami Sabha'],
    ['MA', 'Music Academy'],
    ['Madras Music Academy', 'Music Academy'],
    ['NGS', 'Narada Gana Sabha'],
    ['RR Sabha', 'Rasika Ranjani Sabha'],
    ['RRS', 'Rasika Ranjani Sabha'],
    ['IFAS', 'Indian Fine Arts'],
    ['Indian Fine Arts Society', 'Indian Fine Arts'],
    ['SRLKM', 'Sri Rama Lalitha Kala Mandir'],
    ['KGS', 'Krishna Gana Sabha'],
    ['TBGS', 'Vani Mahal'],
    ['Sri Thyaga Brahma Gana Sabha', 'Vani Mahal'],
    ['Bharat Kalachar', 'Bharat Kalachar'],
  ])('find %s as %s, typed or fed', async (alias, name) => {
    const db = freshDb();
    await db.sharedSabhas.bulkPut(seed.sabhas);
    const id = byName.get(name)!.id;

    expect((await findSabhas(alias, { db }))[0]?.id).toBe(id);
    expect((await nameMatcher('sabha', db)).match(alias)).toBe(id);
  });
});
