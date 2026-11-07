// The Schedule (T061; the Maintainer, 2026-11-07): pushed from the calendar button beside
// Season's "Next", with the D5 top bar back to Season. The logger's entries from today on, by day,
// each a card: an empty tile at its leading edge kept for the motif, the Artists it is billed by
// (a Group by its name) or else its Sabha, a printed title, the Sabha and time, and an add
// button that puts it in Next as Planned. A cancelled entry stays on its day, dimmed, with a
// cancelled mark and no add button. Few words: marks carry the meaning, their names the words.

import { IconCalendarOff, IconCalendarX, IconCheck, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { newId, type ScheduleEntry } from '../model';
import { today } from '../store/events';
import { useSchedule, type ScheduleListing } from '../store/queries';
import { addFromSchedule } from '../store/schedule';
import { byStage, joinNames, knownBy, knownNames } from '../store/stage';
import { NotSavedLine, saveWith, useSaveFeedback } from './components/feedback';
import { KindMark } from './components/kind-mark';
import { Screen, TopBar } from './components/layout';
import { dayText, timeText } from './format';
import type { Target } from './save-feedback';

/** Whom the entry is billed by, as an Event row names its Artists (T121): null when nobody. */
function billedNames(entry: ScheduleEntry): string | null {
  const stage = entry.billed.map((person, i) => ({ ...person, position: i + 1 })).sort(byStage);
  const names = knownNames(knownBy(entry.kind, stage), (person) => person.name);
  return names.length > 0 ? joinNames(names) : null;
}

export function ScheduleScreen() {
  return (
    <Screen>
      <TopBar back={{ href: '/', label: 'Season' }} />
      <h1 className="pt-4 pb-2 text-title font-semibold">Schedule</h1>
      <ScheduleList />
    </Screen>
  );
}

function ScheduleList() {
  const listings = useSchedule(today());
  // One id per entry's add: a retry, or a second tap, makes the same Event (docs/adr/0007).
  const [attempts, setAttempts] = useState<ReadonlyMap<string, string>>(new Map());
  if (listings === undefined) return null;
  if (listings.length === 0) {
    return (
      <IconCalendarOff
        role="img"
        aria-label="Nothing scheduled from today"
        className="mx-auto mt-16 size-10 text-muted-foreground"
      />
    );
  }

  const add = (entry: ScheduleEntry) => {
    const id = attempts.get(entry.id) ?? newId();
    if (!attempts.has(entry.id)) setAttempts(new Map(attempts).set(entry.id, id));
    const value = { kind: entry.kind, date: entry.date, startTime: entry.startTime };
    void saveWith({ table: 'events', id, field: '*' }, value, () =>
      addFromSchedule(entry.id, { id }),
    );
  };

  const days = [...new Set(listings.map((listing) => listing.entry.date))];
  return (
    <div className="pb-8">
      {days.map((day) => (
        // A long season draws only the days near the screen.
        <section
          key={day}
          aria-labelledby={`day-${day}`}
          className="[contain-intrinsic-size:auto_480px] [content-visibility:auto]"
        >
          <h2 id={`day-${day}`} className="pt-4 pb-2 text-sub font-semibold text-muted-foreground">
            {dayText(day)}
          </h2>
          <ul className="flex flex-col gap-2">
            {listings
              .filter((listing) => listing.entry.date === day)
              .map((listing) => (
                <EntryCard
                  key={listing.entry.id}
                  listing={listing}
                  attempt={attempts.get(listing.entry.id) ?? null}
                  onAdd={() => add(listing.entry)}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EntryCard({
  listing: { entry, plannedId },
  attempt,
  onAdd,
}: {
  listing: ScheduleListing;
  attempt: string | null;
  onAdd(): void;
}) {
  const names = billedNames(entry);
  const lead = names ?? entry.sabha;
  const line = [names && entry.sabha, entry.startTime && timeText(entry.startTime)]
    .filter(Boolean)
    .join(' · ');
  return (
    <li>
      <div
        className={cn(
          'flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-2 dark:border-transparent',
          // Dimmed: the card gives up its fill for an outline, and its words go muted.
          entry.cancelled && 'bg-transparent text-muted-foreground dark:border-border',
        )}
      >
        {/* Kept for the motif (DESIGN.md "The motif"): bounded, empty until it is drawn. */}
        <span
          aria-hidden
          data-motif=""
          className={cn(
            'size-12 shrink-0 rounded-xl bg-secondary',
            entry.cancelled && 'opacity-50',
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col py-1">
          <span className="font-semibold break-words">
            <KindMark kind={entry.kind} className="mr-1.5" />
            {lead}
          </span>
          {entry.title && <span className="text-sub break-words">{entry.title}</span>}
          {line && <span className="text-sub text-muted-foreground">{line}</span>}
        </div>
        {entry.cancelled ? (
          <span className="flex size-12 shrink-0 items-center justify-center">
            <IconCalendarX role="img" aria-label="Cancelled" className="size-6" />
          </span>
        ) : plannedId ? (
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href={`/event/${plannedId}`} aria-label={`In Next: ${lead}`}>
              <IconCheck aria-hidden className="text-muted-foreground" />
            </Link>
          </Button>
        ) : (
          <AddButton lead={lead} attempt={attempt} onAdd={onAdd} />
        )}
      </div>
      {attempt && <NotSavedLine targets={[{ table: 'events', id: attempt, field: '*' }]} />}
    </li>
  );
}

/** The add button; once tapped, it waits while its write runs, so a tap then adds nothing. */
function AddButton({
  lead,
  attempt,
  onAdd,
}: {
  lead: string;
  attempt: string | null;
  onAdd(): void;
}) {
  const button = (saving: boolean) => (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0"
      aria-label={`Add to Next: ${lead}`}
      disabled={saving}
      onClick={onAdd}
    >
      <IconPlus aria-hidden />
    </Button>
  );
  // Only a card tapped follows save feedback: a season's cards don't each redraw on every save.
  return attempt ? <Tracked attempt={attempt} button={button} /> : button(false);
}

function Tracked({
  attempt,
  button,
}: {
  attempt: string;
  button(saving: boolean): React.ReactNode;
}) {
  const feedback = useSaveFeedback();
  const target: Target = { table: 'events', id: attempt, field: '*' };
  return button(feedback.get(target)?.status === 'saving');
}
