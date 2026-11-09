// Deletes go through save feedback as their own kind (docs/adr/0007; decided 2026-11-02): a
// failed one reads "Not deleted · Concert, Mon 2 Nov" with Try again, and Try again, from the
// record's row or the season-wide one, runs the same whole delete as the first tap: the store's
// delete, then the Undo offer, then leaving the deleted record's screen if it is open.

import { navigate } from 'wouter/use-browser-location';
import { deleteEvent } from '../store/events';
import { removeItem } from '../store/items';
import { removeAppearance } from '../store/people';
import { saveWith } from './components/feedback';
import { dayText, timeText } from './format';
import { eventBack } from './event-back';
import { MESSAGES } from './messages';
import { offerUndo } from './undo';

/** Off the screen of what was deleted, if the rasika is still on it. */
function leave(deleted: string, to: string) {
  const path = window.location.pathname;
  if (path === deleted || path.startsWith(`${deleted}/`)) navigate(to, { replace: true });
}

/** What a failed delete names: "Concert, Mon 2 Nov, 7:30 pm". */
function concertLabel(event: { date: string; startTime: string | null }): string {
  return [MESSAGES.short.concert, dayText(event.date), event.startTime && timeText(event.startTime)]
    .filter(Boolean)
    .join(', ');
}

export function deleteConcert(event: { id: string; date: string; startTime: string | null }) {
  return saveWith(
    { table: 'events', id: event.id, field: 'deletedAt' },
    { label: concertLabel(event) },
    async () => {
      const deleted = await deleteEvent(event.id);
      if (deleted) {
        offerUndo(deleted.receipt);
        leave(`/event/${event.id}`, eventBack().href);
      }
      return deleted;
    },
    { kind: 'delete' },
  );
}

export function deleteItem(item: { id: string; eventId: string; position: number }) {
  return saveWith(
    { table: 'items', id: item.id, field: 'deletedAt' },
    { label: MESSAGES.undo.subject.item(item.position) },
    async () => {
      const deleted = await removeItem(item.id);
      if (deleted) {
        offerUndo(deleted.receipt);
        leave(`/event/${item.eventId}/item/${item.id}`, `/event/${item.eventId}`);
      }
      return deleted;
    },
    { kind: 'delete' },
  );
}

export function removeArtist(appearance: { id: string; name: string | null }) {
  return saveWith(
    { table: 'appearances', id: appearance.id, field: 'deletedAt' },
    { label: appearance.name ?? MESSAGES.undo.subject.artist },
    async () => {
      const removed = await removeAppearance(appearance.id);
      if (removed) offerUndo(removed.receipt);
      return removed;
    },
    { kind: 'delete' },
  );
}
