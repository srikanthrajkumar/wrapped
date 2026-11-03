// Required test (constitution IV): a Detail set while a repick is being written is written after
// it, never before. The repick clears the Details the new pick doesn't keep, so a Detail written
// first, for the new pick, would be cleared by it and lost.

import { describe, expect, it } from 'vitest';
import { WriteGate } from '../../src/screens/write-gate';

describe('a Detail set during a repick (required)', () => {
  it('waits for the repick, then is written', async () => {
    const gate = new WriteGate();
    const log: string[] = [];
    let finish!: () => void;
    gate.hold(
      new Promise<void>((resolve) => (finish = resolve)).then(() => void log.push('repick')),
    );

    const detail = gate.after(async () => void log.push('tala'))();
    await Promise.resolve();
    expect(log).toEqual([]);

    finish();
    await detail;
    expect(log).toEqual(['repick', 'tala']);
  });

  it('with no repick being written, a Detail is written at once', async () => {
    const gate = new WriteGate();
    const log: string[] = [];
    await gate.after(async () => void log.push('tala'))();
    expect(log).toEqual(['tala']);
  });
});
