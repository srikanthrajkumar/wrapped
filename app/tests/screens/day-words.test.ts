// The words for a day (docs/design/screens/hub.md decision 2; docs/design/screens/whats-on.md
// decision 2): the Hub's word, and What's on's label with the date.

import { describe, expect, it } from 'vitest';
import { dayLabel, dayName } from '../../src/screens/day-words';

const at = (iso: string) => new Date(iso);

describe('dayLabel', () => {
  const evening = at('2026-12-14T19:30:00');

  it("gives today and tomorrow the Hub's word and the date", () => {
    expect(dayLabel('2026-12-14', evening)).toEqual({
      text: 'Today · Mon 14 Dec',
      spoken: 'Today, Monday 14 December',
    });
    expect(dayLabel('2026-12-15', evening)).toEqual({
      text: 'Tomorrow · Tue 15 Dec',
      spoken: 'Tomorrow, Tuesday 15 December',
    });
  });

  it('keeps the date alone for any other day, and has no "Yesterday"', () => {
    expect(dayLabel('2026-12-16', evening)).toEqual({ text: 'Wed 16 Dec' });
    expect(dayLabel('2026-12-13', evening)).toEqual({ text: 'Sun 13 Dec' });
  });

  it('moves on at midnight, by the calendar day', () => {
    expect(dayLabel('2026-12-14', at('2026-12-14T23:59:00')).text).toBe('Today · Mon 14 Dec');
    expect(dayLabel('2026-12-14', at('2026-12-15T00:00:00')).text).toBe('Mon 14 Dec');
    expect(dayLabel('2026-12-15', at('2026-12-15T00:00:00')).text).toBe('Today · Tue 15 Dec');
    // Across a month and a year.
    expect(dayLabel('2027-01-01', at('2026-12-31T21:00:00')).text).toBe('Tomorrow · Fri 1 Jan');
  });
});

describe('dayName', () => {
  it("says the Hub's word, as before", () => {
    const now = at('2026-12-14T19:30:00');
    expect(dayName('2026-12-14', now)).toBe('Today');
    expect(dayName('2026-12-15', now)).toBe('Tomorrow');
    expect(dayName('2026-12-16', now)).toBe('Wed 16 Dec');
  });
});
