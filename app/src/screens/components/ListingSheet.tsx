// A Schedule listing's sheet (the Maintainer, 2026-11-08): tapping a listing on Season's timeline
// opens it, never a button on the row, so nothing nudges the rasika to add. It shows the full
// billing (each Artist with their Role and group), the Sabha, date, time and printed title, each
// led by a mark, and one add, which plans it through addFromSchedule with one id per attempt
// (docs/adr/0007): a retry or a second tap makes the same Event, and a failure shows its row
// here. Once added, the sheet shows it planned, linking to the Event. A cancelled listing has no
// add.

import {
  IconBuildingCommunity,
  IconCalendar,
  IconCalendarCheck,
  IconCalendarX,
  IconChevronRight,
  IconClock,
  IconLetterT,
  IconPlus,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { newId, type ScheduleEntry } from '../../model';
import type { ScheduleListing } from '../../store/queries';
import { isDeletedEvent } from '../../store/events';
import { addFromSchedule } from '../../store/schedule';
import { byStage } from '../../store/stage';
import { listingLead } from '../timeline';
import { creditName, dayText, timeText } from '../format';
import { saveFeedback, type Target } from '../save-feedback';
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
  await saveWith(addTarget(made), value, () => addFromSchedule(entry.id, { id: made }));
}

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
  listing,
  open,
  onOpenChange,
}: {
  listing: ScheduleListing;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { entry, plannedId } = listing;
  const feedback = useSaveFeedback();
  const attempt = attemptOf(entry.id);
  const saving = attempt !== null && feedback.get(addTarget(attempt))?.status === 'saving';
  const lead = listingLead(entry);
  const billed = entry.billed.map((person, i) => ({ ...person, position: i + 1 })).sort(byStage);

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
      {plannedId ? (
        <Button size="lg" variant="outline" className="mt-4 w-full justify-between" asChild>
          <Link href={`/event/${plannedId}`}>
            <span className="flex items-center gap-2">
              <IconCalendarCheck aria-hidden />
              Planned
            </span>
            <IconChevronRight aria-hidden />
          </Link>
        </Button>
      ) : (
        !entry.cancelled && (
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={saving}
            onClick={() => void add(entry)}
          >
            <IconPlus aria-hidden />
            Add
          </Button>
        )
      )}
    </SheetFrame>
  );
}
