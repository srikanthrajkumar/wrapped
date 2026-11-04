// The Season home (DESIGN.md "Season (home, DD2)"; design D3, D11, D14, D17, D29; walkthrough S1,
// S2). Under the title, the install row in a phone's browser tab, and "Getting ready for
// offline…" while the app isn't ready; no status line until sync exists (decided 2026-11-03).
// Then the new-catalog row when there is one; then Now, the Concert that holds it as a card
// tapped to continue; then Next and Season so far, each shown only once it has something in it.
// "Log a Concert" sits in the fixed bottom bar, always, as Add Item does on the Event screen, so
// another Concert can be started while one is open.

import { IconChevronRight, IconLoader2, IconPlus } from '@tabler/icons-react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { updateNow, useOfflineState, useUpdate } from '../pwa';
import { createEvent, today } from '../store/events';
import { eventStart, isBeingLogged, nowEvent } from '../store/logging-note';
import { useEventSummaries, useLoggingNotes, type EventSummary } from '../store/queries';
import { newId } from '../model';
import { saveWith, SeasonFeedback, useSaveFeedback } from './components/feedback';
import { InstallRow } from './components/InstallRow';
import { BottomDock, useNow } from './components/layout';
import { UndoBar } from './components/UndoBar';
import { dayText, itemCount, nowTime, timeText } from './format';
import { MESSAGES } from './messages';
import { subscribeUndo, undoOffers } from './undo';
import { offersUpdate } from './update-offer';

// "Later" hides the catalog row until the next launch (design D29): kept for this page's life.
let updateLater = false;

/** The Artists an Event is known by, else its Sabha (walkthrough S2). */
const title = (summary: EventSummary) => summary.knownBy ?? summary.sabha?.name ?? 'No Sabha yet';

/** The line under the title: the Sabha when Artists are the title, then the facts given. */
const line = (summary: EventSummary, ...facts: (string | null | false)[]) =>
  [summary.knownBy && summary.sabha?.name, ...facts].filter(Boolean).join(' · ');

const time = (summary: EventSummary) =>
  summary.event.startTime !== null && timeText(summary.event.startTime);

export function HomeScreen() {
  const summaries = useEventSummaries();
  const notes = useLoggingNotes();
  const offline = useOfflineState();
  const now = useNow();
  const update = useUpdate();
  const [later, setLater] = useState(updateLater);
  const [, navigate] = useLocation();
  const feedback = useSaveFeedback();
  const undos = useSyncExternalStore(subscribeUndo, undoOffers);
  // One Concert per tap: a double tap must not make two.
  const creating = useRef(false);

  if (summaries === undefined || notes === undefined) return null;

  const byId = new Map(summaries.map((summary) => [summary.event.id, summary]));
  const selection = nowEvent(
    summaries.map((summary) => summary.event),
    notes,
    now,
  );
  const holder = selection.now ? byId.get(selection.now.id)! : null;
  const logging = holder ? isBeingLogged(holder.event, notes.get(holder.event.id), now) : false;
  const inNow = new Set([selection.now, ...selection.others].filter(Boolean).map((e) => e!.id));

  const upcoming = summaries.filter(
    (s) =>
      s.event.status === 'planned' &&
      !s.event.cancelled &&
      !inNow.has(s.event.id) &&
      (eventStart(s.event) ?? new Date(`${s.event.date}T23:59`)) > now,
  );
  const days = [...new Set(upcoming.map((s) => s.event.date))].sort();
  const soFar = summaries
    .filter((s) => s.event.status === 'attended')
    .sort(
      (a, b) =>
        b.event.date.localeCompare(a.event.date) ||
        (b.event.startTime ?? '').localeCompare(a.event.startTime ?? ''),
    );

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

  const showUpdate = offersUpdate({
    available: update.available,
    later,
    logging,
    unsaved: feedback.hasRetryableFailures() || undos.length > 0,
  });

  return (
    <>
      <h1 className="pt-4 pb-2 text-title font-semibold">Season</h1>
      <InstallRow />
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
      {/* Home has no top bar: the season-wide line goes under its title. */}
      <SeasonFeedback />

      {showUpdate && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-y border-border py-1">
          <span className="py-2">
            {update.newCatalog ? MESSAGES.newCatalog : MESSAGES.appUpdate}
          </span>
          <span className="flex gap-1">
            <Button variant="ghost" onClick={updateNow}>
              {MESSAGES.actions.update}
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
                <span className="text-title font-semibold break-words">{title(holder)}</span>
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
                  {[title(summary), time(summary)].filter(Boolean).join(' · ')}
                </span>
                <IconChevronRight aria-hidden className="size-5 shrink-0" />
              </Link>
            );
          })}
        </section>
      )}

      {days.length > 0 && (
        <section aria-labelledby="next" className="pb-8">
          <h2 id="next" className="pb-2 text-heading font-bold">
            Next
          </h2>
          {days.map((day) => (
            <div key={day}>
              <h3 className="pt-2 text-sub font-semibold text-muted-foreground">{dayText(day)}</h3>
              <ul className="border-t border-border">
                {upcoming
                  .filter((s) => s.event.date === day)
                  .map((s) => (
                    <EventRow key={s.event.id} summary={s} line={line(s, time(s))} />
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
          <ul className="border-t border-border">
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
            className="flex min-h-12 items-center justify-between gap-2 border-b border-border"
          >
            Your Wrapped
            <IconChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </section>
      )}

      <BottomDock>
        <UndoBar />
        <div className="border-t border-border bg-background px-4 py-2">
          <Button size="lg" className="w-full" onClick={() => void logNow()}>
            <IconPlus aria-hidden />
            Log a Concert
          </Button>
        </div>
      </BottomDock>
    </>
  );
}

function EventRow({ summary, line }: { summary: EventSummary; line: string }) {
  return (
    <li className="border-b border-border">
      <Link
        href={`/event/${summary.event.id}`}
        className="flex min-h-[60px] flex-col justify-center py-2 text-foreground"
      >
        <span className="font-semibold break-words">{title(summary)}</span>
        {line && <span className="text-sub text-muted-foreground">{line}</span>}
      </Link>
    </li>
  );
}
