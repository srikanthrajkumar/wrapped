// A Concert ends on its own and its summary shows once (walkthrough S13). Ending writes nothing,
// so no value is lost and the Concert stays editable; "shown" is per Event on this phone, never
// synced, and written only once the summary is read and about to open, so it shows exactly once
// and a summary that couldn't be read stays due. A legacy "Done" is harmless.

import { describe, expect, it } from 'vitest';
import {
  dueSummary,
  markSummaryShown,
  nextSummary,
  summaryShown,
} from '../../src/store/concert-summary';
import { createEvent, setStatus } from '../../src/store/events';
import { addItem, removeItem } from '../../src/store/items';
import type { LoggingNote } from '../../src/store/logging-note';
import { listItems } from '../../src/store/queries';
import type { Event } from '../../src/model';
import { freshDb, reopen } from '../helpers';

const HOUR = 60 * 60 * 1000;
const later = (ms: number) => new Date(Date.now() + ms);

describe('nextSummary', () => {
  const at = (hhmm: string, day = 14) => new Date(`2026-12-${day}T${hhmm}:00`);
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

  it('is due once an hour has passed since the last Item and the window is over', () => {
    // 6 pm start: the window runs to 10 pm.
    const logged = notes(note('a', '20:00'));
    expect(nextSummary([event('a')], logged, none, counts('a'), at('21:30'))).toBe(null);
    expect(nextSummary([event('a')], logged, none, counts('a'), at('22:01'))).toBe('a');
    // Logged until late: an hour after the last Item, past the window.
    const late = notes(note('a', '21:50'));
    expect(nextSummary([event('a')], late, none, counts('a'), at('22:30'))).toBe(null);
    expect(nextSummary([event('a')], late, none, counts('a'), at('22:51'))).toBe('a');
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

  it('waits while any Concert was logged in the hour, in its window or not', () => {
    const first = event('first', { startTime: '14:00' });
    const second = event('second', { startTime: '15:00' });
    const live = event('live', { startTime: '21:00' });
    const pastBeingFilled = event('past', { date: '2026-12-10' });
    const logged = notes(note('second', '17:30'), note('first', '17:00'));
    const all = counts('first', 'second', 'live', 'past');
    const now = at('23:30');
    expect(
      nextSummary(
        [first, second, live],
        new Map([...logged, ...notes(note('live', '23:00'))]),
        none,
        all,
        now,
      ),
    ).toBe(null);
    expect(
      nextSummary(
        [first, second, pastBeingFilled],
        new Map([...logged, ...notes(note('past', '23:10'))]),
        none,
        all,
        now,
      ),
    ).toBe(null);
    // Then the one that ended first.
    expect(nextSummary([first, second], logged, none, all, now)).toBe('first');
  });

  it('ignores a legacy "Done with this Concert"', () => {
    const legacy = { ...note('a', '20:00'), doneAt: at('20:05').toISOString() };
    expect(nextSummary([event('a')], notes(legacy), none, counts('a'), at('21:30'))).toBe(null);
    expect(nextSummary([event('a')], notes(legacy), none, counts('a'), at('22:01'))).toBe('a');
  });
});

describe('dueSummary and markSummaryShown', () => {
  /** A Concert from long ago, out of its window, logged now on this phone with `n` Items. */
  async function loggedConcert(db: ReturnType<typeof freshDb>, n = 2) {
    const event = await createEvent(
      { kind: 'concert', date: '2020-01-04', startTime: '18:00' },
      { db },
    );
    for (let i = 0; i < n; i += 1) await addItem(event.id, {}, { db });
    return event;
  }
  /** What the app does on an open: the due summary, marked shown as it opens. */
  async function open(db: ReturnType<typeof freshDb>, now: Date) {
    const id = await dueSummary({ db, now });
    return id && (await markSummaryShown(id, { db, now })) ? id : null;
  }

  it('marks the summaries already over on its first run, without showing them', async () => {
    const db = freshDb();
    const old = await loggedConcert(db);
    expect(await open(db, later(2 * HOUR))).toBe(null);
    expect(await summaryShown(old.id, db)).toBe(true);
    expect(await open(db, later(3 * HOUR))).toBe(null);
  });

  it('marks a Concert ended with the old Done on its first run, however recent', async () => {
    const db = freshDb();
    const done = await loggedConcert(db);
    const key = `loggingNote:${done.id}`;
    const note = (await db.meta.get(key))!.value as LoggingNote;
    await db.meta.put({ key, value: { ...note, doneAt: new Date().toISOString() } });
    expect(await open(db, later(60 * 1000))).toBe(null);
    expect(await summaryShown(done.id, db)).toBe(true);
    expect(await open(db, later(2 * HOUR))).toBe(null);
  });

  it('shows a Concert once, after it ends, and never again, across a relaunch', async () => {
    let db = freshDb();
    await dueSummary({ db });
    const concert = await loggedConcert(db);

    expect(await open(db, later(30 * 60 * 1000))).toBe(null);
    expect(await open(db, later(HOUR + 1000))).toBe(concert.id);
    expect(await open(db, later(HOUR + 2000))).toBe(null);

    db = reopen(db);
    expect(await summaryShown(concert.id, db)).toBe(true);
    expect(await open(db, later(2 * HOUR))).toBe(null);
  });

  it('stays due until it is marked: a summary that could not be read shows on the next open', async () => {
    const db = freshDb();
    await dueSummary({ db });
    const concert = await loggedConcert(db);
    // The first open finds it due, but the read fails before anything is marked.
    expect(await dueSummary({ db, now: later(HOUR + 1000) })).toBe(concert.id);
    expect(await summaryShown(concert.id, db)).toBe(false);
    expect(await open(db, later(HOUR + 2000))).toBe(concert.id);
  });

  it('marks once: a second mark, as from another tab, shows nothing', async () => {
    const db = freshDb();
    await dueSummary({ db });
    const concert = await loggedConcert(db);
    expect(await markSummaryShown(concert.id, { db })).toBe(true);
    expect(await markSummaryShown(concert.id, { db })).toBe(false);
  });

  it('ends a Concert without writing it: every value stays, and it can still be edited', async () => {
    const db = freshDb();
    await dueSummary({ db });
    const concert = await loggedConcert(db, 3);
    const before = {
      events: await db.events.toArray(),
      items: await db.items.toArray(),
      outbox: await db.outbox.toArray(),
    };

    expect(await open(db, later(HOUR + 1000))).toBe(concert.id);

    // Nothing of the season changed, and "shown" never goes to the server.
    expect(await db.events.toArray()).toEqual(before.events);
    expect(await db.items.toArray()).toEqual(before.items);
    expect(await db.outbox.toArray()).toEqual(before.outbox);

    // Still editable after it ended: a new Item and a delete are kept, and it doesn't show again.
    const items = await listItems(concert.id, db);
    await addItem(concert.id, {}, { db });
    await removeItem(items[0]!.id, { db });
    expect((await listItems(concert.id, db)).length).toBe(3);
    expect(await open(db, later(3 * HOUR))).toBe(null);
  });

  it('shows nothing for a Concert with no Items', async () => {
    const db = freshDb();
    await dueSummary({ db });
    const concert = await loggedConcert(db, 1);
    await removeItem((await listItems(concert.id, db))[0]!.id, { db });
    expect(await open(db, later(HOUR + 1000))).toBe(null);
    expect(await summaryShown(concert.id, db)).toBe(false);
  });

  it('shows one Concert per open, the other on the next', async () => {
    const db = freshDb();
    await dueSummary({ db });
    const first = await loggedConcert(db);
    const second = await loggedConcert(db);
    const now = later(HOUR + 1000);
    expect([await open(db, now), await open(db, now)]).toEqual([first.id, second.id]);
    expect(await open(db, now)).toBe(null);
  });

  it('shows nothing for a Planned Event never started', async () => {
    const db = freshDb();
    await dueSummary({ db });
    const concert = await loggedConcert(db);
    await setStatus(concert.id, 'planned', { db });
    expect(await open(db, later(HOUR + 1000))).toBe(null);
  });
});
