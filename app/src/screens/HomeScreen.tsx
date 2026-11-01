// The Season home (DESIGN.md "Season (home, DD2)"; design D3, D11, D14, D17, D29). Under the title,
// one muted status line; the new-catalog row when there is one; then Now, one large block with
// one primary action; then Next and Season so far, each shown only once it has something in it.

import { IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { updateNow, useUpdate } from '../pwa';
import { createEvent, setStatus, today } from '../store/events';
import { eventStart, isBeingLogged, nowEvent } from '../store/logging-note';
import {
  useEventSummaries,
  useLoggingNotes,
  useUnsyncedCount,
  type EventSummary,
} from '../store/queries';
import { saveWith } from './components/feedback';
import { BottomDock, useNow } from './components/layout';
import { UndoBar } from './components/UndoBar';
import { dayText, eventLine, itemCount, nowTime, timeText } from './format';
import { MESSAGES } from './messages';

// "Later" hides the catalog row until the next launch (design D29): kept for this page's life.
let updateLater = false;

const sabhaName = (summary: EventSummary) => summary.sabha?.name ?? 'No Sabha yet';

export function HomeScreen() {
  const summaries = useEventSummaries();
  const notes = useLoggingNotes();
  const unsynced = useUnsyncedCount();
  const now = useNow();
  const update = useUpdate();
  const [later, setLater] = useState(updateLater);
  const [, navigate] = useLocation();

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

  const logNow = async () => {
    const event = await saveWith({ table: 'events', id: 'new', field: '*' }, 'concert', () =>
      createEvent({ kind: 'concert', date: today(), startTime: nowTime() }),
    );
    if (event) navigate(`/event/${event.id}`);
  };

  const showUpdate = update.available && !later && !logging;

  return (
    <>
      <h1 className="pt-4 text-title font-semibold">Season</h1>
      <Link href="/settings" className="flex min-h-12 items-center text-sub text-muted-foreground">
        {unsynced ? MESSAGES.homeStatus.changesWaiting(unsynced) : MESSAGES.homeStatus.allSynced}
      </Link>

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

      <section aria-label="Now" className="pt-2 pb-8">
        {holder ? (
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 dark:border-transparent">
            <h2 className="text-title font-semibold break-words">{sabhaName(holder)}</h2>
            <p className="text-sub text-muted-foreground">
              {[holder.event.startTime && timeText(holder.event.startTime), holder.firstArtist]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {holder.event.status === 'planned' ? (
              <Button
                size="lg"
                className="mt-3 w-full"
                onClick={() =>
                  void setStatus(holder.event.id, 'attended').then(() =>
                    navigate(`/event/${holder.event.id}`),
                  )
                }
              >
                Start logging
              </Button>
            ) : (
              <Button size="lg" className="mt-3 w-full" asChild>
                <Link href={`/event/${holder.event.id}`}>
                  Continue: {itemCount(holder.itemCount)}
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 dark:border-transparent">
            <Button size="lg" className="w-full" onClick={() => void logNow()}>
              Log a Concert now
            </Button>
          </div>
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
                {[sabhaName(summary), other.startTime && timeText(other.startTime)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <IconChevronRight aria-hidden className="size-5 shrink-0" />
            </Link>
          );
        })}
      </section>

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
                    <EventRow
                      key={s.event.id}
                      summary={s}
                      line={[s.event.startTime && timeText(s.event.startTime), s.firstArtist]
                        .filter(Boolean)
                        .join(' · ')}
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
          <ul className="border-t border-border">
            {soFar.map((s) => (
              <EventRow
                key={s.event.id}
                summary={s}
                line={`${eventLine({ date: s.event.date, startTime: null })} · ${itemCount(s.itemCount)}`}
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
        <span className="font-semibold break-words">{sabhaName(summary)}</span>
        {line && <span className="text-sub text-muted-foreground">{line}</span>}
      </Link>
    </li>
  );
}
