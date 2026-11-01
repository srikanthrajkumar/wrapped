// T048f (design D28): every string in DESIGN.md's Messages table is in app/src/screens/messages.ts,
// verbatim, so the screens never drift from the table the Maintainer edits.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../src/screens/messages';

const design = readFileSync(join(import.meta.dirname, '../../../DESIGN.md'), 'utf8');

/** The Messages table's rows: Where, When, Text and Action. */
function tableRows(): string[][] {
  const section = design.split(/^## Messages$/m)[1]!.split(/^## /m)[0]!;
  return section
    .split('\n')
    .filter((line) => line.startsWith('|') && !/^\|\s*-/.test(line))
    .slice(1)
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
}

/** The quoted and bold strings of a Text cell; the actions of an Action cell. */
function stringsOf(text: string, action: string): string[] {
  const quoted = [...text.matchAll(/"([^"]+)"|\*\*([^*]+)\*\*/g)].map((m) => m[1] ?? m[2]!);
  const actions = action
    .split(' · ')
    .map((a) => a.trim())
    .filter((a) => a !== '' && !a.startsWith('('));
  return [...quoted, ...actions];
}

/** Every string messages.ts can produce: its strings, and its functions on sample values. */
function produced(): Set<string> {
  const strings: string[] = [];
  const functions: ((arg: never) => string)[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') strings.push(value);
    else if (typeof value === 'function') functions.push(value as (arg: never) => string);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(MESSAGES);
  const numbers = Array.from({ length: 11 }, (_, n) => n);
  const fromNumbers = functions.flatMap((fn) => numbers.map((n) => fn(n as never)));
  const all = [...strings, ...fromNumbers];
  const fromStrings = functions.flatMap((fn) => all.map((s) => fn(s as never)));
  return new Set([...all, ...fromStrings]);
}

describe('messages.ts', () => {
  const rows = tableRows();
  const available = produced();

  it('reads the whole table', () => {
    expect(rows.length).toBeGreaterThanOrEqual(22);
  });

  it.each(rows.map((row) => [`${row[0]}: ${row[1]}`, row] as const))(
    'holds every string of "%s"',
    (_, row) => {
      const [, , text = '', action = ''] = row;
      const strings = stringsOf(text, action);
      expect(strings.length).toBeGreaterThan(0);
      for (const string of strings) expect(available).toContain(string);
    },
  );
});
