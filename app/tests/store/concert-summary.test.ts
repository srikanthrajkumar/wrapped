// A Concert ends on its own and its summary shows once (walkthrough S13). Ending writes nothing,
// so no value is lost and the Concert stays editable; "shown" is per Event on this phone, never
// synced, recorded before the modal opens so it shows exactly once, and a legacy "Done" is
// harmless.

import { describe, expect, it } from 'vitest';
import { nextSummary, summaryShown, takeSummary } from '../../src/store/concert-summary';
import { createEvent, setStatus } from '../../src/store/events';
import { addItem, removeItem } from '../../src/store/items';
import type { LoggingNote } from '../../src/store/logging-note';
import { listItems } from '../../src/store/queries';
import type { Event } from '../../src/model';
import { freshDb, reopen } from '../helpers';

const HOUR = 60 * 60 * 1000;
const later = (ms: number) => new Date(Date.now() + ms);

describe('nextSummary', () => {
  const at = (hhmm: string) => new Date(`2026-12-14T${hhmm}:00`);
  const event = (id: string, fields: Partial<Event> = {}) => ({
    id,
    date: '2026-12-14',
    startTime: '18:00',
    status: 'attended' as const,
    deletedAt: null,
    ...fields,
  });
  const note = (eventId: string, hhmm: string): LoggingNote => ({
    eventId,
    lastLoggedAt: at(hhmm).toISOString(),
  });
  const notes = (...list: LoggingNote[]) => new Map(list.map((n) => [n.eventId, n]));
  const counts = (...ids: string[]) => new Map(ids.map((id) => [id, 3]));
  const none = new Set<string>();

  it('is due an hour after the last Item changed, not before', () => {
    const concert = event('a');
    expect(nextSummary([concert], notes(note('a', '20:00')), none, counts('a'), at('20:59'))).toBe(
      null,
    );
    expect(nextSummary([concert], notes(note('a', '20:00')), none, counts('a'), at('21:01'))).toBe(
      'a',
    );
  });

  it('waits an hour for a past Concert being filled in, though its window is over', () => {
    const past = event('past', { date: '2026-12-10' });
    const filled = notes(note('past', '20:00'));
    expect(nextSummary([past], filled, none, counts('past'), at('20:30'))).toBe(null);
    expect(nextSummary([past], filled, none, counts('past'), at('21:01'))).toBe('past');
  });

  it('shows nothing already shown, with no Items, never logged here, or not Attended', () => {
    const now = at('23:00');
    const logged = notes(note('a', '20:00'), note('b', '20:00'), note('c', '20:00'));
    expect(nextSummary([event('a')], logged, new Set(['a']), counts('a'), now)).toBe(null);
    expect(nextSummary([event('b')], logged, none, counts(), now)).toBe(null);
    expect(nextSummary([event('d')], logged, none, counts('d'), now)).toBe(null);
    expect(nextSummary([event('c', { status: 'missed' })], logged, none, counts('c'), now)).toBe(
      null,
    );
    const gone = event('c', { deletedAt: '2026-12-14T21:00:00Z' });
    expect(nextSummary([gone], logged, none, counts('c'), now)).toBe(null);
  });

  it('waits while any Concert is being logged, then shows the one that ended first', () => {
    const first = event('first', { startTime: '16:00' });
    const second = event('second', { startTime: '18:00' });
    const live = event('live', { startTime: '21:00' });
    const logged = notes(note('second', '19:30'), note('first', '18:00'), note('live', '21:30'));
    const all = counts('first', 'second', 'live');
    expect(nextSummary([first, second, live], logged, none, all, at('21:45'))).toBe(null);
    expect(nextSummary([first, second], logged, none, all, at('21:45'))).toBe('first');
  });

  it('ignores a legacy "Done with this Concert"', () => {
    const legacy = { ...note('a', '20:00'), doneAt: at('20:05').toISOString() };
    expect(nextSummary([event('a')], notes(legacy), none, counts('a'), at('20:30'))).toBe(null);
    expect(nextSummary([event('a')], notes(legacy), none, counts('a'), at('21:01'))).toBe('a');
  });
});

describe('takeSummary', () => {
  /** A Concert logged now on this phone, with `n` Items. */
  async function loggedConcert(db: ReturnType<typeof freshDb>, n = 2) {
    const event = await createEvent({ kind: 'concert' }, { db });
    for (let i = 0; i < n; i += 1) await addItem(event.id, {}, { db });
    return event;
  }

  it('marks the summaries already due on its first run, without showing them', async () => {
    const db = freshDb();
    const old = await loggedConcert(db);
    expect(await takeSummary({ db, now: later(2 * HOUR) })).toBe(null);
    expect(await summaryShown(old.id, db)).toBe(true);
    expect(await takeSummary({ db, now: later(3 * HOUR) })).toBe(null);
  });

  it('shows a Concert once, after it ends, and never again, across a relaunch', async () => {
    let db = freshDb();
    await takeSummary({ db });
    const concert = await loggedConcert(db);

    expect(await takeSummary({ db, now: later(30 * 60 * 1000) })).toBe(null);
    expect(await takeSummary({ db, now: later(HOUR + 1000) })).toBe(concert.id);
    expect(await takeSummary({ db, now: later(HOUR + 2000) })).toBe(null);

    db = reopen(db);
    expect(await summaryShown(concert.id, db)).toBe(true);
    expect(await takeSummary({ db, now: later(2 * HOUR) })).toBe(null);
  });

  it('ends a Concert without writing it: every value stays, and it can still be edited', async () => {
    const db = freshDb();
    await takeSummary({ db });
    const concert = await loggedConcert(db, 3);
    const before = {
      events: await db.events.toArray(),
      items: await db.items.toArray(),
      outbox: await db.outbox.toArray(),
    };

    expect(await takeSummary({ db, now: later(HOUR + 1000) })).toBe(concert.id);

    // Nothing of the season changed, and "shown" never goes to the server.
    expect(await db.events.toArray()).toEqual(before.events);
    expect(await db.items.toArray()).toEqual(before.items);
    expect(await db.outbox.toArray()).toEqual(before.outbox);

    // Still editable after it ended: a new Item and a delete are kept, and it doesn't show again.
    const items = await listItems(concert.id, db);
    await addItem(concert.id, {}, { db });
    await removeItem(items[0]!.id, { db });
    expect((await listItems(concert.id, db)).length).toBe(3);
    expect(await takeSummary({ db, now: later(3 * HOUR) })).toBe(null);
  });

  it('shows nothing for a Concert with no Items, until one is added', async () => {
    const db = freshDb();
    await takeSummary({ db });
    const concert = await loggedConcert(db, 1);
    await removeItem((await listItems(concert.id, db))[0]!.id, { db });
    expect(await takeSummary({ db, now: later(HOUR + 1000) })).toBe(null);
    expect(await summaryShown(concert.id, db)).toBe(false);
  });

  it('shows one Concert per call, the other on the next', async () => {
    const db = freshDb();
    await takeSummary({ db });
    const first = await loggedConcert(db);
    const second = await loggedConcert(db);
    const now = later(HOUR + 1000);
    const shown = [await takeSummary({ db, now }), await takeSummary({ db, now })];
    expect(shown).toEqual([first.id, second.id]);
    expect(await takeSummary({ db, now })).toBe(null);
  });

  it('shows nothing for a Planned Event never started', async () => {
    const db = freshDb();
    await takeSummary({ db });
    const concert = await loggedConcert(db);
    await setStatus(concert.id, 'planned', { db });
    expect(await takeSummary({ db, now: later(HOUR + 1000) })).toBe(null);
  });
});
