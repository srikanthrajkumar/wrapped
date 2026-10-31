import { describe, expect, it } from 'vitest';

describe('test setup', () => {
  it('provides IndexedDB and crypto.randomUUID', () => {
    expect(globalThis.indexedDB).toBeDefined();
    expect(crypto.randomUUID()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
