// The listing sheet (docs/designs/season-spine.md Parts 1 and 5; the Maintainer, 2026-11-08 and
// 2026-11-11): tapping a concert's row opens it, never a button on the row. It shows the full
// billing (each Artist with their Role and group), the Sabha, date, time and printed title, each
// led by a mark, and two buttons. "Shortlist" makes the rasika's Event through addFromSchedule,
// with one id per attempt (docs/adr/0007): a retry or a second tap makes the same Event, and a
// failure shows its row here. Once made it reads "Shortlisted", and tapped again takes the
// concert off the Shortlist: it deletes that Event, synced, with Undo (SF-D22). The second button
// opens the Event ready for its first Item, Shortlisting it first if need be (SF-D25); the first
// Item makes it Heard (ADR 0010). A concert whose window has passed offers only that button, as
// "I was there". A cancelled listing has neither; one the rasika had Shortlisted keeps
// "Shortlisted" alone, to take it off.

import {
  IconBuildingCommunity,
  IconCalendar,
  IconCalendarX,
  IconClock,
  IconLetterT,
  IconMapPin,
  IconStar,
  IconStarFilled,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { newId, type ScheduleEntry } from '../../model';
import { isDeletedEvent } from '../../store/events';
import { windowEnd } from '../../store/logging-note';
import { addFromSchedule } from '../../store/schedule';
import { byStage } from '../../store/stage';
import { unshortlistConcert } from '../deletes';
import { listingLead } from '../timeline';
import { creditName, dayText, timeText } from '../format';
import { MESSAGES } from '../messages';
import { saveFeedback, type Target } from '../save-feedback';
import { stageOf, type Concert } from '../spine';
import { NotSavedLine, saveWith, useSaveFeedback } from './feedback';
import { KindMark } from './kind-mark';
import { SheetFrame } from './sheet-frame';

// One id per entry's add, kept for the page's life: a retry, or a second tap after the sheet
// was closed and opened again, makes the same Event (docs/adr/0007). Kept only while its Event
// is live or its save unsettled: once that Event is deleted, the next add is a new attempt with
// a new id, since a deleted Event's id is never made again (PR #30 review).
const attempts = new Map<string, string>();
const attemptOf = (entryId: string) => attempts.get(entryId) ?? null;
const addTarget = (id: string): Target => ({ table: 'events', id, field: '*' });

async function add(entry: ScheduleEntry) {
  let id = attempts.get(entry.id);
  if (id) {
    const status = saveFeedback.get(addTarget(id))?.status;
    const unsettled = status === 'saving' || status === 'failed' || status === 'typed';
    if (!unsettled && (await isDeletedEvent(id))) id = undefined;
  }
  if (!id) attempts.set(entry.id, (id = newId()));
  // The entry's id goes with it, so the journal settles even when the Event returned is one
  // planned before, under another id (store/journal-check.ts).
  const value = {
    kind: entry.kind,
    date: entry.date,
    startTime: entry.startTime,
    scheduleEntryId: entry.id,
  };
  const made = id;
  const event = await saveWith(addTarget(made), value, () =>
    addFromSchedule(entry.id, { id: made }),
  );
  if (event) madeAt.set(entry.id, performance.now());
  return event;
}

// When each entry was last Shortlisted from here. The button that made it becomes the one that
// takes it off, in the same place, so the second tap of a double tap must not undo the first.
const madeAt = new Map<string, number>();
const DOUBLE_TAP_MS = 700;
const justMade = (entryId: string) =>
  performance.now() - (madeAt.get(entryId) ?? -Infinity) < DOUBLE_TAP_MS;

function Fact({ mark: Mark, name, children }: { mark: Icon; name: string; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3">
      <dt className="pt-0.5">
        <Mark role="img" aria-label={name} className="size-5 text-muted-foreground" />
      </dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

export function ListingSheet({
  concert,
  open,
  onOpenChange,
  now,
}: {
  /** A concert with its Schedule listing: Listed, or the rasika's own, Shortlisted. */
  concert: Concert;
  open: boolean;
  onOpenChange(open: boolean): void;
  now: Date;
}) {
  const entry = concert.listing!.entry;
  const own = concert.own;
  const [, navigate] = useLocation();
  const feedback = useSaveFeedback();
  const attempt = attemptOf(entry.id);
  const saving = attempt !== null && feedback.get(addTarget(attempt))?.status === 'saving';
  const lead = listingLead(entry);
  const billed = entry.billed.map((person, i) => ({ ...person, position: i + 1 })).sort(byStage);
  const shortlisted = stageOf(concert) === 'shortlisted';
  // Its window has passed: nothing to Shortlist, only to say the rasika was there.
  const past = now.getTime() > windowEnd(entry).getTime();
  // Opens the Event ready for its first Item, which makes it Heard (ADR 0010).
  const here = async () => {
    const event = own?.event ?? (await add(entry));
    if (!event) return;
    onOpenChange(false);
    navigate(`/event/${event.id}`);
  };

  // A cancelled concert can be neither Shortlisted nor heard; one the rasika had Shortlisted
  // can still be taken off.
  const off = entry.cancelled || concert.cancelled;
  const toggle = shortlisted ? (
    // Tapped again, it comes off the Shortlist: its Event deleted, with Undo.
    <Button
      size="lg"
      variant="outline"
      aria-pressed
      onClick={(tap) => {
        // The second tap of a double tap on "Shortlist" lands here: it must not undo the first.
        if (tap.detail > 1 || justMade(entry.id)) return;
        onOpenChange(false);
        void unshortlistConcert(own!.event);
      }}
    >
      <IconStarFilled aria-hidden />
      {MESSAGES.spine.shortlisted}
    </Button>
  ) : !past && !off ? (
    <Button
      size="lg"
      variant="outline"
      aria-pressed={false}
      disabled={saving}
      onClick={() => void add(entry)}
    >
      <IconStar aria-hidden />
      {MESSAGES.spine.shortlist}
    </Button>
  ) : null;
  const second = off ? null : (
    <Button size="lg" disabled={saving} onClick={() => void here()}>
      <IconMapPin aria-hidden />
      {past ? MESSAGES.spine.wasThere : MESSAGES.spine.here}
    </Button>
  );

  return (
    <SheetFrame
      open={open}
      onOpenChange={onOpenChange}
      title={lead}
      // Drawn as every sheet's title is, with the kind's mark before it.
      header={
        <span className="flex min-h-12 items-center font-heading text-title font-semibold break-words text-foreground">
          <span>
            <KindMark kind={entry.kind} className="mr-1.5" />
            {lead}
          </span>
        </span>
      }
    >
      <dl className="flex flex-col gap-4 pb-2">
        {entry.title && (
          <Fact mark={IconLetterT} name="Title">
            {entry.title}
          </Fact>
        )}
        <Fact mark={IconCalendar} name="Date">
          {dayText(entry.date)}
        </Fact>
        {entry.startTime && (
          <Fact mark={IconClock} name="Time">
            {timeText(entry.startTime)}
          </Fact>
        )}
        <Fact mark={IconBuildingCommunity} name="Sabha">
          {entry.sabha}
        </Fact>
        {billed.length > 0 && (
          <Fact mark={IconUsers} name="Artists">
            <ul className="flex flex-col gap-1.5">
              {/* Each name with its Role and group under it, so a long name never splits from
                  them. */}
              {billed.map((person) => (
                <li key={person.position} className="flex flex-col">
                  {person.name}
                  {(person.role || person.support || person.group) && (
                    <span className="text-sub text-muted-foreground">
                      {/* A group the title already names isn't said again. */}
                      {[
                        creditName(person.role, person.support),
                        person.group !== lead && person.group,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Fact>
        )}
        {/* Cancelled: the mark says it, with no add below. */}
        {entry.cancelled && <Fact mark={IconCalendarX} name="Cancelled" />}
      </dl>
      {attempt && <NotSavedLine targets={[addTarget(attempt)]} />}
      {(toggle || second) && (
        <div className={toggle && second ? 'mt-4 grid grid-cols-2 gap-2' : 'mt-4 grid'}>
          {toggle}
          {second}
        </div>
      )}
    </SheetFrame>
  );
}
