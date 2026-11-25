// Required (constitution IV; PR #30 reviews): an untouched new Concert is taken back only when the
// journal holds nothing for it, matched by record, and kept when unsure, so a clock that steps
// back can't let typed text or a failed new Sabha be lost; and only when no page anywhere has it
// open, from the + tap on, through a Web Lock each page holds shared and a take-back needs
// exclusively. Without Web Locks, nothing is taken back.

import { describe, expect, it, vi } from 'vitest';
import type { Event } from '../../src/model';
import type { BrowserStorage } from '../../src/browser-storage';
import {
  claimNewConcert,
  holdNewConcert,
  lockName,
  noteNewConcert,
  sweepNewConcerts,
  type NewConcertDeps,
} from '../../src/screens/new-concert';
import type { JournalEntry } from '../../src/screens/save-feedback';
import { lockManager } from './locks';

function memoryStorage(): BrowserStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as BrowserStorage;
}

/** A lock manager with no other holder: every lock is free. */
const freeLocks = {
  request: async (_name: string, ...args: unknown[]) => {
    const callback = args[args.length - 1] as (lock: object | null) => Promise<void>;
    return callback({ name: _name, mode: 'exclusive' });
  },
} as unknown as LockManager;

const concert = {
  id: 'x',
  kind: 'concert',
  date: '2026-12-15',
  startTime: '18:30',
  updatedAt: '2026-12-15T13:00:00.000Z',
} as Event;

function deps(journal: JournalEntry[], locks: LockManager | null = freeLocks) {
  const discard = vi.fn(async () => 'discarded' as const);
  const value: NewConcertDeps = {
    storage: memoryStorage(),
    feedback: { notSaved: () => journal, get: () => undefined, drop: () => undefined },
    discard,
    locks,
  };
  return { value, discard };
}

const note = (enteredAt: string): JournalEntry => ({
  table: 'events',
  id: 'x',
  field: 'note',
  value: 'front row',
  enteredAt,
  state: 'typed',
});

describe('an untouched new Concert', () => {
  it('is taken back when the journal holds nothing for it', async () => {
    const { value, discard } = deps([]);
    noteNewConcert(concert, '2026-12-15T13:00:00.000Z', value);
    await sweepNewConcerts(value);
    expect(discard).toHaveBeenCalledOnce();
  });

  it('is kept when its note was typed, though the clock stepped back since the tap', async () => {
    const { value, discard } = deps([note('2026-12-15T12:59:00.000Z')]);
    noteNewConcert(concert, '2026-12-15T13:00:00.000Z', value);
    await sweepNewConcerts(value);
    expect(discard).not.toHaveBeenCalled();
  });

  it('is kept when a new Artist for it failed to save, whatever the clock says', async () => {
    const artist: JournalEntry = {
      table: 'appearances',
      id: 'a1',
      field: '*',
      value: { eventId: 'x', artistId: 'r1', name: 'Sanjay' },
      enteredAt: '2026-12-15T12:00:00.000Z',
      state: 'failed',
    };
    const { value, discard } = deps([artist]);
    noteNewConcert(concert, '2026-12-15T13:00:00.000Z', value);
    await sweepNewConcerts(value);
    expect(discard).not.toHaveBeenCalled();
  });

  it('is never taken back without Web Locks', async () => {
    const { value, discard } = deps([], null);
    noteNewConcert(concert, '2026-12-15T13:00:00.000Z', value);
    await sweepNewConcerts(value);
    expect(discard).not.toHaveBeenCalled();
  });

  it('is kept when a new Sabha failed to save, whatever the clock says', async () => {
    const sabha: JournalEntry = {
      table: 'sabhas',
      id: 's1',
      field: '*',
      value: 'Music Academy',
      enteredAt: '2026-12-15T12:00:00.000Z',
      state: 'failed',
    };
    const { value, discard } = deps([sabha]);
    noteNewConcert(concert, '2026-12-15T13:00:00.000Z', value);
    await sweepNewConcerts(value);
    expect(discard).not.toHaveBeenCalled();
  });

  it('is never taken back by a sweep that races its birth', async () => {
    const locks = lockManager();
    const { value, discard } = deps([], locks);
    // The + is tapped: the hold comes first, then the Concert and its note.
    await claimNewConcert('x', value);
    noteNewConcert(concert, '2026-12-15T13:00:00.000Z', value);
    // Another tab's Season sweeps before the Concert's page opens here.
    await sweepNewConcerts(value);
    expect(discard).not.toHaveBeenCalled();
    // The page takes the hold over; left with nothing entered, the Concert is taken back.
    const release = holdNewConcert('x', value);
    await release(true);
    expect(discard).toHaveBeenCalledOnce();
  });

  it('is kept while another tab has it open, and taken back once that tab leaves too', async () => {
    const locks = lockManager();
    const { value, discard } = deps([], locks);
    noteNewConcert(concert, '2026-12-15T13:00:00.000Z', value);
    const release = holdNewConcert('x', value);
    // Another tab opens the same Concert.
    let otherLeaves!: () => void;
    const other = locks.request(lockName('x'), { mode: 'shared' }, () => {
      return new Promise<void>((resolve) => (otherLeaves = resolve));
    });
    await Promise.resolve();
    await release(true);
    expect(discard).not.toHaveBeenCalled();
    otherLeaves();
    await other;
    await sweepNewConcerts(value);
    expect(discard).toHaveBeenCalledOnce();
  });
});
