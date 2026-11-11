// What every Season screen reads (the hub, What's on, the Shortlist, the Diary): the rasika's
// Events and the stored Schedule as concerts, each once (screens/spine.ts), with the logging
// notes and the clock that say what is under way; and the two sheets a row opens, its listing
// and what the Schedule changed.

import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  useEventSummaries,
  useLoggingNotes,
  useSchedule,
  type EventSummary,
  type ScheduleListing,
} from '../store/queries';
import { ListingSheet } from './components/ListingSheet';
import { useNow } from './components/layout';
import { ScheduleChangedSheet } from './components/ScheduleChanged';
import { useLingering } from './components/sheet-frame';
import { leavingNow, subscribeLeaving } from './new-concert';
import { concerts, type Concert, type Notes } from './spine';

export interface Season {
  /** The rasika's live Events, but for a new Concert being taken back as it is left. */
  summaries: EventSummary[];
  /** The whole stored Schedule, the days gone included. */
  listings: ScheduleListing[];
  notes: Notes;
  now: Date;
  /** Every concert, each once, in start order. */
  all: Concert[];
  /** A new Concert is being checked on its way out, and may yet be kept. */
  settling: boolean;
}

/** The Season as stored: undefined until read. */
export function useSeason(): Season | undefined {
  const stored = useEventSummaries();
  // A new Concert being taken back as the rasika leaves it is never drawn on its way out.
  const leaving = useSyncExternalStore(subscribeLeaving, leavingNow);
  const notes = useLoggingNotes();
  const listings = useSchedule('');
  const now = useNow();
  return useMemo(() => {
    if (stored === undefined || notes === undefined || listings === undefined) return undefined;
    const summaries = stored.filter((summary) => !leaving.has(summary.event.id));
    return {
      summaries,
      listings,
      notes,
      now,
      all: concerts(summaries, listings, now),
      settling: leaving.size > 0,
    };
  }, [stored, leaving, notes, listings, now]);
}

/**
 * The sheets a row opens, and how to open them: a concert's listing sheet, and for a Shortlisted
 * row what the Schedule changed. Each is drawn from the Season as it now stands, and kept drawn
 * while it closes.
 */
export function useConcertSheets(season: Season | undefined): {
  open(concert: Concert): void;
  hint(eventId: string): void;
  sheets: ReactNode;
} {
  // The Event whose "schedule changed" sheet is open, kept drawn while it closes.
  const [hint, setHint] = useState<string | null>(null);
  const [hintShown, hintOpen] = useLingering(hint);
  // The concert whose sheet is open, by its key, likewise.
  const [opened, setOpened] = useState<string | null>(null);
  const [openedShown, openedOpen] = useLingering(opened);
  const concert = openedShown
    ? (season?.all.find((one) => one.key === openedShown && one.listing) ?? null)
    : null;
  return {
    open: (one) => setOpened(one.key),
    hint: setHint,
    sheets: (
      <>
        {hintShown && (
          <ScheduleChangedSheet
            eventId={hintShown}
            open={hintOpen}
            onOpenChange={(open) => {
              if (!open) setHint(null);
            }}
          />
        )}
        {concert && season && (
          <ListingSheet
            concert={concert}
            now={season.now}
            open={openedOpen}
            onOpenChange={(open) => {
              if (!open) setOpened(null);
            }}
          />
        )}
      </>
    ),
  };
}
