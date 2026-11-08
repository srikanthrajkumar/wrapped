// The Season home (DESIGN.md "Season (home, DD2)"; design D3, D11, D14, D17, D29; walkthrough S1,
// S2): one timeline of the whole Season (the Maintainer, 2026-11-08). The days gone come first,
// then the header: the title with the + that logs a Concert not on the Schedule at its right,
// the install row in a phone's browser tab, "Getting ready for offline…" while the app isn't
// ready, the new-catalog row when there is one, and Now, the Concert that holds it as a card
// tapped to continue. Then today and the days to come, to the end of the Season. Each day lists
// the rasika's own Events, then the Schedule's other listings, quieter, with no button: a tap
// opens the listing's sheet, whose one add plans it (screens/timeline.ts, ListingSheet). The page
// opens at the header, the past above it, and comes back to where it was left. No bottom bar.

import {
  IconCalendarExclamation,
  IconCalendarOff,
  IconCalendarX,
  IconChevronRight,
  IconLoader2,
  IconPlus,
} from '@tabler/icons-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateNow, useOfflineState, useUpdate } from '../pwa';
import { createEvent, today } from '../store/events';
import { isBeingLogged, nowEvent } from '../store/logging-note';
import {
  useEventSummaries,
  useLoggingNotes,
  useSchedule,
  useSeasonRagaKeys,
  type EventSummary,
  type ScheduleListing,
} from '../store/queries';
import { useCatalog } from '../catalog/use-catalog';
import { newId } from '../model';
import { Motif } from '../motif/Motif';
import { ragaSeeds } from '../motif/ragas';
import { saveWith, useSaveFeedback } from './components/feedback';
import { useReloadGuard } from './components/reload-guard';
import { KindMark } from './components/kind-mark';
import { ScheduleChangedSheet } from './components/ScheduleChanged';
import { ListingSheet } from './components/ListingSheet';
import { useLingering } from './components/sheet-frame';
import { Screen, TabHeader, useNow } from './components/layout';
import { dayText, itemCount, nowTime, timeText } from './format';
import { MESSAGES } from './messages';
import { noteNewConcert, sweepNewConcerts } from './new-concert';
import { asNowReads, listingLead, timeline, type TimelineDay } from './timeline';
import { subscribeUndo, undoOffers } from './undo';
import { offersUpdate } from './update-offer';

/** The season so far as one field (DESIGN.md "The motif"), drawn once its Ragas are known. */
function SeasonArt() {
  const keys = useSeasonRagaKeys();
  const catalog = useCatalog();
  if (keys === undefined || catalog.status === 'loading') return null;
  const ragas = ragaSeeds(keys, catalog.status === 'ready' ? catalog.catalog : null);
  return (
    <Motif
      seed={{ kind: 'season', ragas }}
      className="size-full animate-in duration-300 fade-in motion-reduce:animate-none"
    />
  );
}

// "Later" hides the catalog row until the next launch (design D29): kept for this page's life.
let updateLater = false;

/** The Artists an Event is known by, else its Sabha (walkthrough S2). */
const title = (summary: EventSummary) => summary.knownBy ?? summary.sabha?.name ?? 'No Sabha yet';

/** The title with the Event's kind as a mark before it; a Concert has none (T122). */
const Title = ({ summary }: { summary: EventSummary }) => (
  <>
    <KindMark kind={summary.event.kind} className="mr-1.5" />
    {title(summary)}
  </>
);

/** The line under the title: the Sabha when Artists are the title, then the facts given. */
const line = (summary: EventSummary, ...facts: (string | null | false)[]) =>
  [summary.knownBy && summary.sabha?.name, ...facts].filter(Boolean).join(' · ');

const time = (summary: EventSummary) =>
  summary.event.startTime !== null && timeText(summary.event.startTime);

export function HomeScreen() {
  return (
    <Screen>
      <HomeView />
    </Screen>
  );
}

/**
 * Where Season was left: the day at the top of the screen (or the header) and how far it was
 * scrolled past, so coming back finds the same place whatever the days above drew at. Kept for
 * the page's life; a launch opens at the header.
 */
let place: { at: string; offset: number } | null = null;

/** The day or header at the top of the screen. */
function placeNow(): { at: string; offset: number } | null {
  for (const node of document.querySelectorAll<HTMLElement>('[data-place]')) {
    const box = node.getBoundingClientRect();
    if (box.bottom > 0) return { at: node.dataset.place!, offset: -box.top };
  }
  return null;
}

/** A day's height before it is drawn: its label and a 64px row each (DESIGN.md "Spacing"). */
const dayHeight = (day: TimelineDay) => 30 + 64 * (day.own.length + day.listings.length);

function HomeView() {
  const summaries = useEventSummaries();
  const notes = useLoggingNotes();
  // The whole stored Schedule, the days gone included.
  const listings = useSchedule('');
  const offline = useOfflineState();
  const now = useNow();
  const update = useUpdate();
  const [later, setLater] = useState(updateLater);
  const [, navigate] = useLocation();
  const feedback = useSaveFeedback();
  // Update reloads the page: while a value lives only in memory, it asks to Export first.
  const updating = useReloadGuard(updateNow);
  const undos = useSyncExternalStore(subscribeUndo, undoOffers);
  // The Event whose "schedule changed" sheet is open, kept drawn while it closes.
  const [hint, setHint] = useState<string | null>(null);
  const [hintShown, hintOpen] = useLingering(hint);
  // The Schedule entry whose sheet is open, likewise.
  const [opened, setOpened] = useState<string | null>(null);
  const [openedShown, openedOpen] = useLingering(opened);
  // One Concert per tap: a double tap must not make two.
  const creating = useRef(false);
  // A new Concert left untouched, whose take-back hasn't happened yet, goes now.
  useEffect(() => sweepNewConcerts(), []);
  const ready = summaries !== undefined && notes !== undefined && listings !== undefined;

  // Before the first paint with the timeline: back where Season was left, else at the header.
  // Then held there while the days around draw at their real heights rather than their likely
  // ones (a browser with no scroll anchoring, as Safari, would otherwise let the page slide
  // under the rasika), until the rasika scrolls the page themself.
  useLayoutEffect(() => {
    if (!ready) return;
    const target =
      (place && document.querySelector<HTMLElement>(`[data-place="${place.at}"]`)) ??
      document.querySelector<HTMLElement>('[data-place="header"]');
    if (!target) return;
    const offset = place && target.dataset.place === place.at ? place.offset : 0;
    let set = 0;
    const hold = () => {
      set = Math.max(0, target.getBoundingClientRect().top + window.scrollY + offset);
      if (Math.abs(window.scrollY - set) >= 1) window.scrollTo(0, set);
    };
    hold();
    // Runs after layout and before paint, so a day drawn at its real height never shows the
    // page out of place.
    const sizes = new ResizeObserver(hold);
    sizes.observe(document.body);
    const release = () => {
      sizes.disconnect();
      window.removeEventListener('scroll', moved);
      for (const name of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) {
        window.removeEventListener(name, release);
      }
    };
    // A scroll that isn't the hold's own is the rasika's: the page is theirs from then on.
    const moved = () => {
      if (Math.abs(window.scrollY - set) >= 1) release();
    };
    window.addEventListener('scroll', moved, { passive: true });
    for (const name of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) {
      window.addEventListener(name, release, { passive: true });
    }
    return release;
  }, [ready]);
  // Noted as the rasika scrolls, once a frame at most.
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place = placeNow();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ready]);

  // Each attempt is its own Concert with its own id: a failed one stays listed, by its date and
  // time, whatever later taps do, and its Try again makes it once (docs/adr/0007). One made and
  // then left with nothing entered is taken back (screens/new-concert.ts).
  const logNow = async () => {
    if (creating.current) return;
    creating.current = true;
    try {
      const tappedAt = new Date().toISOString();
      const id = newId();
      const concert = { kind: 'concert' as const, date: today(), startTime: nowTime() };
      const event = await saveWith({ table: 'events', id, field: '*' }, concert, () =>
        createEvent(concert, { id }),
      );
      if (!event) return;
      noteNewConcert(event, tappedAt);
      navigate(`/event/${event.id}`);
    } finally {
      creating.current = false;
    }
  };

  if (!ready) return null;

  const byId = new Map(summaries.map((summary) => [summary.event.id, summary]));
  // A Planned Event whose entry is cancelled is never Now (asNowReads).
  const selection = nowEvent(asNowReads(summaries), notes, now);
  const holder = selection.now ? byId.get(selection.now.id)! : null;
  const logging = holder ? isBeingLogged(holder.event, notes.get(holder.event.id), now) : false;

  // The one holding Now is its card, under the header; every other Event is in its day.
  const days = timeline(summaries, listings, new Set(holder ? [holder.event.id] : []));
  const from = today(now);
  const gone = days.filter((day) => day.date < from);
  const coming = days.filter((day) => day.date >= from);
  const sheetListing = openedShown
    ? (listings.find((listing) => listing.entry.id === openedShown) ?? null)
    : null;

  const showUpdate = offersUpdate({
    available: update.available,
    later,
    logging,
    unsaved: feedback.hasRetryableFailures() || undos.length > 0,
  });

  const dayList = (list: TimelineDay[]) =>
    list.map((day) => (
      <DaySection
        key={day.date}
        day={day}
        onHint={setHint}
        onOpen={(listing) => setOpened(listing.entry.id)}
      />
    ));

  return (
    <>
      {dayList(gone)}

      {/* With days gone above: 32px under the last, as a block is under the one above it, and
          from the header on at least a screen tall, so the page can open with the header at its
          top however little is to come. Without: it fills the screen and no more, so nothing
          scrolls that needn't. */}
      <div className={cn('flex flex-col', gone.length > 0 ? 'mt-8 min-h-dvh' : 'flex-1')}>
        <div data-place="header">
          <TabHeader
            title="Season"
            art={<SeasonArt />}
            top={gone.length === 0}
            action={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Log a Concert"
                onClick={() => void logNow()}
              >
                <IconPlus aria-hidden />
              </Button>
            }
          >
            {offline === 'getting-ready' && (
              <p
                role="status"
                className="flex min-h-12 items-center gap-2 text-sub text-muted-foreground"
              >
                <IconLoader2
                  aria-hidden
                  className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
                />
                {MESSAGES.offline.gettingReady}
              </p>
            )}
          </TabHeader>

          {showUpdate && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-y border-border py-1">
              <span className="py-2">
                {update.newCatalog ? MESSAGES.newCatalog : MESSAGES.appUpdate}
              </span>
              {updating.asking && (
                <p role="alert" className="w-full text-sub text-destructive">
                  {MESSAGES.reloadLoses}
                </p>
              )}
              <span className="flex gap-1">
                <Button variant="ghost" onClick={updating.tap}>
                  {updating.asking ? MESSAGES.actions.updateAnyway : MESSAGES.actions.update}
                </Button>
                <Button
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    updateLater = true;
                    setLater(true);
                  }}
                >
                  {MESSAGES.actions.later}
                </Button>
              </span>
            </div>
          )}

          {holder && (
            <section aria-label="Now" className="pt-2 pb-4">
              <Link
                href={`/event/${holder.event.id}`}
                className="flex min-h-[60px] items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 text-foreground dark:border-transparent"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-title font-semibold break-words">
                    <Title summary={holder} />
                  </span>
                  <span className="text-sub text-muted-foreground">
                    {line(
                      holder,
                      time(holder),
                      holder.event.status === 'attended' && itemCount(holder.itemCount),
                    )}
                  </span>
                </span>
                <IconChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </section>
          )}
        </div>

        {/* Nothing logged, planned or listed yet: one quiet mark in the middle of the empty page,
            clear of the tab bar; no words, no nudge. */}
        {days.length === 0 && !holder && (
          <div className="flex flex-1 items-center justify-center pb-24">
            <IconCalendarOff
              role="img"
              aria-label="Nothing yet"
              className="size-10 text-muted-foreground"
            />
          </div>
        )}
        <div className="pb-8">{dayList(coming)}</div>
      </div>

      {hintShown && (
        <ScheduleChangedSheet
          eventId={hintShown}
          open={hintOpen}
          onOpenChange={(open) => {
            if (!open) setHint(null);
          }}
        />
      )}
      {sheetListing && (
        <ListingSheet
          listing={sheetListing}
          open={openedOpen}
          onOpenChange={(open) => {
            if (!open) setOpened(null);
          }}
        />
      )}
    </>
  );
}

/**
 * One day of the timeline: its label, the rasika's own Events, then the Schedule's other
 * listings. A long Season draws only the days near the screen, each held at its likely height
 * until drawn, so scrolling never jumps.
 */
function DaySection({
  day,
  onHint,
  onOpen,
}: {
  day: TimelineDay;
  onHint(eventId: string): void;
  onOpen(listing: ScheduleListing): void;
}) {
  const style = { containIntrinsicSize: `auto ${dayHeight(day)}px` } as CSSProperties;
  return (
    <section
      data-place={day.date}
      aria-labelledby={`day-${day.date}`}
      className="[content-visibility:auto]"
      style={style}
    >
      {/* The day goes with the rows under it: its first row's name 4px under it. */}
      <h2
        id={`day-${day.date}`}
        className="-mb-1.5 pt-4 text-sub font-semibold text-muted-foreground"
      >
        {dayText(day.date)}
      </h2>
      <ul>
        {day.own.map((s) => (
          <EventRow
            key={s.event.id}
            summary={s}
            line={line(s, time(s), s.event.status === 'attended' && itemCount(s.itemCount))}
            onHint={s.event.status === 'planned' ? () => onHint(s.event.id) : undefined}
          />
        ))}
        {day.listings.map((listing) => (
          <ListingRow key={listing.entry.id} listing={listing} onOpen={() => onOpen(listing)} />
        ))}
      </ul>
    </section>
  );
}

/**
 * A Schedule listing the rasika hasn't planned: quieter than their own rows, muted and not bold,
 * with no button of its own; a tap opens its sheet. A cancelled one is dimmed and marked.
 */
function ListingRow({ listing: { entry }, onOpen }: { listing: ScheduleListing; onOpen(): void }) {
  const names = listingLead(entry);
  const facts = [names !== entry.sabha && entry.sabha, entry.startTime && timeText(entry.startTime)]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="hairline-b">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex min-h-16 w-full items-center gap-2 py-2 text-left text-muted-foreground',
          entry.cancelled && 'opacity-60',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="break-words">
            <KindMark kind={entry.kind} className="mr-1.5" />
            {names}
          </span>
          {entry.title && <span className="text-sub break-words">{entry.title}</span>}
          {facts && <span className="text-sub">{facts}</span>}
        </span>
        {entry.cancelled && (
          <IconCalendarX role="img" aria-label="Cancelled" className="size-5 shrink-0" />
        )}
      </button>
    </li>
  );
}

function EventRow({
  summary,
  line,
  onHint,
}: {
  summary: EventSummary;
  line: string;
  /** A Planned row, which carries the Schedule's marks: opens the "schedule changed" sheet. */
  onHint?: () => void;
}) {
  const planned = onHint !== undefined;
  const cancelled = planned && summary.cancelled;
  // The hint shows on a cancelled row too: the sheet lists what else changed (2026-11-07).
  const changed = planned && summary.event.scheduleChanged;
  return (
    <li className="flex items-center gap-2 hairline-b">
      <Link
        href={`/event/${summary.event.id}`}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-2 py-2 text-foreground"
      >
        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <span className={cn('font-semibold break-words', cancelled && 'text-muted-foreground')}>
            <Title summary={summary} />
          </span>
          {line && <span className="text-sub text-muted-foreground">{line}</span>}
        </span>
        {/* Dimmed and marked, kept in place until the rasika removes it (T061). */}
        {cancelled && (
          <IconCalendarX
            role="img"
            aria-label="Cancelled"
            className="size-5 shrink-0 text-muted-foreground"
          />
        )}
      </Link>
      {/* The hint is its own button, its 48px reaching past the row's edge: it opens what
          changed, to take or keep (the Maintainer, 2026-11-07). */}
      {changed && (
        <Button
          variant="ghost"
          size="icon"
          className="-mr-3.5 text-muted-foreground"
          aria-label="Schedule changed"
          onClick={onHint}
        >
          <IconCalendarExclamation aria-hidden />
        </Button>
      )}
    </li>
  );
}
