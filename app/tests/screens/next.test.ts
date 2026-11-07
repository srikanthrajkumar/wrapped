// Required (the Maintainer, 2026-11-07): a cancelled Planned Event stays in Next, marked, until
// the rasika deletes it, even once its start time has passed; and it is never Now.

import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/model';
import { asNowReads, nextEvents } from '../../src/screens/next';
import { nowEvent } from '../../src/store/logging-note';
import type { EventSummary } from '../../src/store/queries';

const event = (fields: Partial<Event>): Event => ({
  id: 'e1',
  kind: 'concert',
  date: '2026-12-15',
  startTime: '16:00',
  sabhaId: null,
  status: 'planned',
  cancelled: false,
  source: 'schedule',
  scheduleEntryId: 'academy-1',
  scheduleVersionSeen: '1',
  scheduleChanged: false,
  touched: true,
  title: null,
  note: null,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  ...fields,
});

const summary = (fields: Partial<Event>, cancelled: boolean): EventSummary => ({
  event: event(fields),
  sabha: null,
  knownBy: null,
  itemCount: 0,
  cancelled,
});

describe('Next', () => {
  const before = new Date('2026-12-15T15:00:00');
  const after = new Date('2026-12-15T21:00:00');

  it('keeps a cancelled Planned Event past its start, and drops one that is not', () => {
    const cancelled = summary({ id: 'off' }, true);
    const on = summary({ id: 'on' }, false);
    expect(nextEvents([cancelled, on], new Set(), before).map((s) => s.event.id)).toEqual([
      'off',
      'on',
    ]);
    expect(nextEvents([cancelled, on], new Set(), after).map((s) => s.event.id)).toEqual(['off']);
  });

  it('never makes an Event whose entry is cancelled Now, though its stored cancelled is false', () => {
    const at = new Date('2026-12-15T16:30:00');
    const off = summary({ id: 'off' }, true);
    expect(nowEvent(asNowReads([off]), new Map(), at).now).toBeNull();
    expect(nowEvent(asNowReads([summary({ id: 'on' }, false)]), new Map(), at).now?.id).toBe('on');
  });
});
