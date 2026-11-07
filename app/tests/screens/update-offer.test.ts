// Required test (constitution IV; ADR 0007): the update prompt reloads the page, so it is never
// offered while a value that failed to save is held only in memory.

import { describe, expect, it } from 'vitest';
import { SaveFeedback } from '../../src/screens/save-feedback';
import { appliesWaitingUpdate, offersUpdate, onReloadTap } from '../../src/screens/update-offer';

describe('the update offer', () => {
  const base = { available: true, later: false, logging: false, unsaved: false };

  it('offers a waiting update when nothing is at stake', () => {
    expect(offersUpdate(base)).toBe(true);
  });

  it('waits while a value is not saved on this phone', () => {
    expect(offersUpdate({ ...base, unsaved: true })).toBe(false);
  });

  it('waits while a Concert is being logged, or after Later', () => {
    expect(offersUpdate({ ...base, logging: true })).toBe(false);
    expect(offersUpdate({ ...base, later: true })).toBe(false);
  });

  it('third review: Try again applies a newer build itself only during first launch', () => {
    expect(appliesWaitingUpdate({ requested: true, firstLaunchDone: false })).toBe(true);
    // Later, a stale request must never reload the page mid-Concert.
    expect(appliesWaitingUpdate({ requested: true, firstLaunchDone: true })).toBe(false);
    expect(appliesWaitingUpdate({ requested: false, firstLaunchDone: false })).toBe(false);
  });

  it('Update asks to Export first while a value lives only in memory, and applies on the next tap', () => {
    // No storage: the journal can't keep what is entered, and a reload would lose it.
    const feedback = new SaveFeedback({ storage: null });
    expect(onReloadTap(feedback, false)).toBe('reload');

    feedback.hold({ table: 'events', id: 'e1', field: 'note' }, 'Tisram');
    expect(onReloadTap(feedback, false)).toBe('ask');
    expect(onReloadTap(feedback, true)).toBe('reload');
  });
});
