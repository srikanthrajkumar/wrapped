// A blank Concert, dated now (the Maintainer, 2026-11-08; docs/design/log-entry.md): what
// Season's + makes, and What's on's "Not listed? Start a Concert" when its search finds nothing.
// Each attempt is its own Concert with its own id: a failed one stays listed, by its date and
// time, whatever later taps do, and its Try again makes it once (docs/adr/0007). One made and
// then left with nothing entered is taken back (screens/new-concert.ts); while it is blank it
// offers the listings near its time (EventScreen's ListingOffer).

import { newId, type Event } from '../model';
import { createEvent, today } from '../store/events';
import { nowTime } from './format';
import { claimNewConcert, dropNewConcert, noteNewConcert } from './new-concert';
import { saveWith } from './save-feedback';

// One Concert per tap: a double tap must not make two.
let creating = false;

/** Make a blank Concert dated now; null when it failed (its row says so) or one is on its way. */
export async function startConcert(): Promise<Event | null> {
  if (creating) return null;
  creating = true;
  try {
    const tappedAt = new Date().toISOString();
    const id = newId();
    const concert = { kind: 'concert' as const, date: today(), startTime: nowTime() };
    // Held for its page before it exists, so no tab's sweep can take it back on the way there.
    await claimNewConcert(id);
    const event = await saveWith({ table: 'events', id, field: '*' }, concert, () =>
      createEvent(concert, { id }),
    );
    if (!event) {
      dropNewConcert(id);
      return null;
    }
    noteNewConcert(event, tappedAt);
    return event;
  } finally {
    creating = false;
  }
}
