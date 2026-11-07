// The Season home (DESIGN.md "Season (home, DD2)"; design D3, D11, D14, D17, D29; walkthrough S1,
// S2). Under the title, the install row in a phone's browser tab, and "Getting ready for
// offline…" while the app isn't ready; no status line until sync exists (decided 2026-11-03).
// Then the new-catalog row when there is one; then Now, the Concert that holds it as a card
// tapped to continue; then Next and Season so far, each shown only once it has something in it,
// Next also once a Schedule is stored, for the calendar button beside its heading (T061).
// "Log a Concert" sits in the fixed bottom bar, always, as Add Item does on the Event screen, so
// another Concert can be started while one is open.

import {
  IconCalendarEvent,
  IconCalendarExclamation,
  IconCalendarX,
  IconChevronRight,
  IconLoader2,
  IconPlus,
} from '@tabler/icons-react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateNow, useOfflineState, useUpdate } from '../pwa';
import { createEvent, today } from '../store/events';
import { isBeingLogged, nowEvent } from '../store/logging-note';
import {
  useEventSummaries,
  useHasSchedule,
  useLoggingNotes,
  useSeasonRagaKeys,
  type EventSummary,
} from '../store/queries';
import { useCatalog } from '../catalog/use-catalog';
import { newId } from '../model';
import { Motif } from '../motif/Motif';
import { ragaSeeds } from '../motif/ragas';
import { saveWith, useSaveFeedback } from './components/feedback';
import { useReloadGuard } from './components/reload-guard';
import { KindMark } from './components/kind-mark';
import { ScheduleChangedSheet } from './components/ScheduleChanged';
import { useLingering } from './components/sheet-frame';
import { BottomDock, Screen, TabHeader, useNow } from './components/layout';
import { dayText, itemCount, nowTime, timeText } from './format';
import { MESSAGES } from './messages';
import { asNowReads, nextEvents } from './next';
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

function HomeView() {
  const summaries = useEventSummaries();
  const notes = useLoggingNotes();
  const offline = useOfflineState();
  const now = useNow();
  const update = useUpdate();
  const [later, setLater] = useState(updateLater);
  const [, navigate] = useLocation();
  const feedback = useSaveFeedback();
  // Update reloads the page: while a value lives only in memory, it asks to Export first.
  const updating = useReloadGuard(updateNow);
  const undos = useSyncExternalStore(subscribeUndo, undoOffers);
  const hasSchedule = useHasSchedule();
  // The Event whose "schedule changed" sheet is open, kept drawn while it closes.
  const [hint, setHint] = useState<string | null>(null);
  const [hintShown, hintOpen] = useLingering(hint);
  // One Concert per tap: a double tap must not make two.
  const creating = useRef(false);

  // Each attempt is its own Concert with its own id: a failed one stays listed, by its date and
  // time, whatever later taps do, and its Try again makes it once (docs/adr/0007).
  const logNow = async () => {
    if (creating.current) return;
    creating.current = true;
    try {
      const id = newId();
      const concert = { kind: 'concert' as const, date: today(), startTime: nowTime() };
      const event = await saveWith({ table: 'events', id, field: '*' }, concert, () =>
        createEvent(concert, { id }),
      );
      if (event) navigate(`/event/${event.id}`);
    } finally {
      creating.current = false;
    }
  };

  // The bar needs nothing read, so it shows from the first frame, before the season does.
  const bar = (
    <BottomDock>
      <Button size="lg" className="w-full" onClick={() => void logNow()}>
        <IconPlus aria-hidden />
        Log a Concert
      </Button>
    </BottomDock>
  );

  if (summaries === undefined || notes === undefined) return bar;

  const byId = new Map(summaries.map((summary) => [summary.event.id, summary]));
  // A Planned Event whose entry is cancelled is never Now (asNowReads).
  const selection = nowEvent(asNowReads(summaries), notes, now);
  const holder = selection.now ? byId.get(selection.now.id)! : null;
  const logging = holder ? isBeingLogged(holder.event, notes.get(holder.event.id), now) : false;
  const inNow = new Set([selection.now, ...selection.others].filter(Boolean).map((e) => e!.id));

  // A cancelled one stays, marked, until the rasika removes it, even past its start (next.ts).
  const upcoming = nextEvents(summaries, inNow, now);
  const days = [...new Set(upcoming.map((s) => s.event.date))].sort();
  const soFar = summaries
    .filter((s) => s.event.status === 'attended')
    .sort(
      (a, b) =>
        b.event.date.localeCompare(a.event.date) ||
        (b.event.startTime ?? '').localeCompare(a.event.startTime ?? ''),
    );

  const showUpdate = offersUpdate({
    available: update.available,
    later,
    logging,
    unsaved: feedback.hasRetryableFailures() || undos.length > 0,
  });

  return (
    <>
      <TabHeader title="Season" art={<SeasonArt />}>
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

      {(holder || selection.others.length > 0) && (
        <section aria-label="Now" className="pt-2 pb-8">
          {holder && (
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
          )}
          {selection.others.map((other) => {
            const summary = byId.get(other.id)!;
            return (
              <Link
                key={other.id}
                href={`/event/${other.id}`}
                className="flex min-h-12 items-center justify-between gap-2 px-1 text-sub text-muted-foreground"
              >
                <span className="break-words">
                  <KindMark kind={summary.event.kind} className="mr-1.5" />
                  {[title(summary), time(summary)].filter(Boolean).join(' · ')}
                </span>
                <IconChevronRight aria-hidden className="size-5 shrink-0" />
              </Link>
            );
          })}
        </section>
      )}

      {(days.length > 0 || hasSchedule) && (
        <section aria-labelledby="next" className="pb-8">
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 id="next" className="text-heading font-bold">
              Next
            </h2>
            {/* The Schedule, once one is stored (T061): its 48px reaches past the line. */}
            {hasSchedule && (
              <Button variant="ghost" size="icon" className="-my-3 -mr-3.5" asChild>
                <Link href="/schedule" aria-label="Schedule">
                  <IconCalendarEvent aria-hidden />
                </Link>
              </Button>
            )}
          </div>
          {days.map((day, i) => (
            <div key={day}>
              {/* The day goes with the rows under it: no hairline between, and its first row's
                  name 4px under it. The first day sits 8px under "Next"; each later one 16px
                  under the row above. */}
              <h3
                className={cn(
                  '-mb-1.5 text-sub font-semibold text-muted-foreground',
                  i > 0 && 'pt-4',
                )}
              >
                {dayText(day)}
              </h3>
              <ul>
                {upcoming
                  .filter((s) => s.event.date === day)
                  .map((s) => (
                    <EventRow
                      key={s.event.id}
                      summary={s}
                      line={line(s, time(s))}
                      onHint={() => setHint(s.event.id)}
                    />
                  ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {soFar.length > 0 && (
        <section aria-labelledby="so-far" className="pb-8">
          <h2 id="so-far" className="pb-2 text-heading font-bold">
            Season so far
          </h2>
          {/* Its first name 8px under the heading, as Next's first date is. */}
          <ul className="-mt-2.5">
            {soFar.map((s) => (
              <EventRow
                key={s.event.id}
                summary={s}
                line={line(s, dayText(s.event.date), itemCount(s.itemCount))}
              />
            ))}
          </ul>
          <Link
            href="/wrapped"
            className="flex min-h-12 items-center justify-between gap-2 hairline-b"
          >
            Your Wrapped
            <IconChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </section>
      )}

      {hintShown && (
        <ScheduleChangedSheet
          eventId={hintShown}
          open={hintOpen}
          onOpenChange={(open) => {
            if (!open) setHint(null);
          }}
        />
      )}

      {bar}
    </>
  );
}

function EventRow({
  summary,
  line,
  onHint,
}: {
  summary: EventSummary;
  line: string;
  /** A row of Next, which carries the Schedule's marks: opens the "schedule changed" sheet. */
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
