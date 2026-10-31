// The loader refuses a snapshot whose bytes don't match its name and keeps the previous
// version (contracts/catalog-snapshot.md, "Hash and integrity").

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CatalogError, decodeSnapshot, loadCatalog, sha256Hex } from '../../src/catalog/load';

const fixture = (name: string) => {
  const bytes = readFileSync(join(import.meta.dirname, '../fixtures', name));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

async function named(bytes: ArrayBuffer) {
  return `catalog.${await sha256Hex(bytes)}.json`;
}

describe('catalog loader', () => {
  it('loads a snapshot whose hash matches its name', async () => {
    const v1 = fixture('catalog-v1.json');
    const file = await named(v1);
    const loaded = await loadCatalog([file], async () => v1);

    expect(loaded.file).toBe(file);
    if (loaded.file === null) return;
    const { catalog } = loaded;
    expect(catalog.version).toBe('2026.11.10-1');
    expect(catalog.songs).toHaveLength(21);
    expect(catalog.songByKritiId.get('c0016')).toMatchObject({
      raga: null,
      tala: { key: 'rupakam' },
    });
    expect(catalog.songByKritiId.get('c0016')?.ragamalika.map((raga) => raga.key)).toEqual([
      'Saveri',
      'Mohanam',
      'Kalyani',
    ]);
    expect(catalog.songByKritiId.get('c0015')?.composer).toBeNull();
  });

  it('refuses a valid file whose bytes do not match its name, and keeps the previous version', async () => {
    const v1 = fixture('catalog-v1.json');
    const v2 = fixture('catalog-v2.json');
    const previous = await named(v1);
    // v2's name over v1's bytes: a snapshot that decodes, so only the hash check refuses it.
    const mismatched = await named(v2);
    const bytes: Record<string, ArrayBuffer> = { [mismatched]: v1, [previous]: v1 };

    const loaded = await loadCatalog([mismatched, previous], async (file) => bytes[file]!);
    expect(loaded.file).toBe(previous);
  });

  it('refuses a ragamalika that lists no raga (-1) as a member', () => {
    const raw = JSON.parse(new TextDecoder().decode(fixture('catalog-v1.json')));
    const c0016 = raw.songs.kritiId.indexOf('c0016');
    raw.songs.ragamalika[c0016] = [13, -1];
    expect(() => decodeSnapshot(raw)).toThrow(CatalogError);
  });

  it('reports why when no file loads', async () => {
    const loaded = await loadCatalog(['catalog.json'], async () => new ArrayBuffer(0));
    expect(loaded).toEqual({
      file: null,
      errors: ['catalog.json is not named catalog.<sha256>.json'],
    });
  });

  it('decodes the v2 changes the fixtures were made for', async () => {
    const v2 = fixture('catalog-v2.json');
    const loaded = await loadCatalog([await named(v2)], async () => v2);
    if (loaded.file === null) throw new Error(loaded.errors.join('; '));
    const { catalog } = loaded;

    expect(catalog.ragaByKey.has('Sankarabharanam')).toBe(false);
    expect(catalog.remap.ragas).toEqual({ Sankarabharanam: 'Dheerasankarabharanam' });
    expect(catalog.remap.songs).toEqual({ c0021: null });
    expect(catalog.songByKritiId.has('c0021')).toBe(false);
    expect(catalog.ragaByKey.get('Kamavardhini')?.groupKey).toBe(
      catalog.ragaByKey.get('Pantuvarali')?.groupKey,
    );
  });
});
