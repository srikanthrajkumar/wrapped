// Search accuracy (SC-010): at least 95% of about 100 variant spellings find their intended
// entry in the top 3. It needs the private catalog snapshot in app/public/catalog/, so it runs
// locally and before each deploy, not in CI (CONTRIBUTING.md).
//
// golden.json is a draft from last season's sheet plus hand-added cases. The Maintainer
// reviews it against the snapshot: each case's `expect` gets the intended `kritiId` (a song)
// or `ragaKey` (a raga), and cases for songs the catalog doesn't hold are dropped or replaced.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG_FILE, verifySnapshot } from '../../app/src/catalog/load';
import { buildIndex } from '../../app/src/catalog/search';

interface GoldenCase {
  query: string;
  expect: { kritiId: string | null } | { ragaKey: string | null };
  hint: string;
  from: string;
}

const cases = JSON.parse(
  readFileSync(join(import.meta.dirname, 'golden.json'), 'utf8'),
) as GoldenCase[];

const catalogDir = join(import.meta.dirname, '../../app/public/catalog');
const snapshot = (() => {
  try {
    return readdirSync(catalogDir).find((name) => CATALOG_FILE.test(name));
  } catch {
    return undefined;
  }
})();

const intended = (c: GoldenCase) => ('kritiId' in c.expect ? c.expect.kritiId : c.expect.ragaKey);

describe('golden set', () => {
  it('holds about 100 cases, each naming one kind of entry', () => {
    expect(cases.length).toBeGreaterThanOrEqual(90);
    for (const c of cases) {
      expect(c.query.trim(), c.from).not.toBe('');
      expect(Object.keys(c.expect), c.query).toHaveLength(1);
      expect(['kritiId', 'ragaKey'], c.query).toContain(Object.keys(c.expect)[0]);
    }
  });

  describe.skipIf(!snapshot)('against the catalog snapshot', () => {
    it('every case has been reviewed', () => {
      const unreviewed = cases.filter((c) => intended(c) === null).map((c) => c.query);
      expect(unreviewed, 'cases with no intended entry yet').toEqual([]);
    });

    it('at least 95% find the intended entry in the top 3 (SC-010)', async () => {
      const bytes = readFileSync(join(catalogDir, snapshot!));
      const catalog = await verifySnapshot(
        snapshot!,
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      );
      const index = buildIndex(catalog);

      const misses = cases.filter((c) => {
        const top = index.search(c.query, 3);
        return !top.some((result) =>
          'kritiId' in c.expect
            ? result.kind === 'song' && result.song.kritiId === c.expect.kritiId
            : result.kind === 'raga' && result.raga.key === c.expect.ragaKey,
        );
      });
      const hitRate = 1 - misses.length / cases.length;
      expect(hitRate, `misses: ${misses.map((c) => c.query).join(', ')}`).toBeGreaterThanOrEqual(
        0.95,
      );
    });
  });
});
