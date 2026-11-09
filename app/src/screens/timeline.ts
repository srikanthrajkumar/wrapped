// Season as one timeline (the Maintainer, 2026-11-08; DESIGN.md "Season (home, DD2)"): every day
// of the Season in date order, past and to come. Each day lists the rasika's own Events first,
// by start time (planned, attended, being logged, cancelled and kept, and those made by hand),
// then the Schedule's other listings for that day. A listing the rasika planned shows once, as
// their Event. A cancelled Event stays in its day, marked, until the rasika deletes it, however
// long ago it started (the Maintainer, 2026-11-07). Framework-free, so the rules are unit-tested
// (tests/screens/timeline.test.ts).

import type { ScheduleEntry } from '../model';
import type { EventSummary, ScheduleListing } from '../store/queries';
import { byStage, joinNames, knownBy, knownNames } from '../store/stage';

export interface TimelineDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** The rasika's own Events that day, by start time; one with none last. */
  own: EventSummary[];
  /** The Schedule's listings that day the rasika hasn't planned, by start time, then Sabha. */
  listings: ScheduleListing[];
}

const byStart = (a: EventSummary, b: EventSummary) =>
  (a.event.startTime ?? '99').localeCompare(b.event.startTime ?? '99');

/**
 * The days that have something in them, in date order, every Event in its day (the hero's too:
 * the list is the whole Schedule, the hero a way in). `listings` come sorted (listSchedule).
 */
export function timeline(
  summaries: readonly EventSummary[],
  listings: readonly ScheduleListing[],
): TimelineDay[] {
  const days = new Map<string, TimelineDay>();
  const day = (date: string) => {
    let found = days.get(date);
    if (!found) days.set(date, (found = { date, own: [], listings: [] }));
    return found;
  };
  for (const summary of summaries) day(summary.event.date).own.push(summary);
  for (const listing of listings) {
    if (listing.plannedId === null) day(listing.entry.date).listings.push(listing);
  }
  for (const found of days.values()) found.own.sort(byStart);
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The Events as Now reads them: one whose Schedule entry is cancelled counts as cancelled. */
export const asNowReads = (summaries: readonly EventSummary[]) =>
  summaries.map((s) =>
    s.cancelled && !s.event.cancelled ? { ...s.event, cancelled: true } : s.event,
  );

/**
 * What a Schedule entry is known by, as an Event row names its Artists (T121): its billed
 * Artists (a Group by its name), else its Sabha.
 */
export function listingLead(entry: ScheduleEntry): string {
  const stage = entry.billed.map((person, i) => ({ ...person, position: i + 1 })).sort(byStage);
  const names = knownNames(knownBy(entry.kind, stage), (person) => person.name);
  return names.length > 0 ? joinNames(names) : entry.sabha;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/** When an Event starts, for ordering: its start time, else the start of its day. */
const startOf = ({ date, startTime }: { date: string; startTime: string | null }) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = (startTime ?? '00:00').split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm).getTime();
};

/**
 * The rasika's concert for Season's hero (the Maintainer, 2026-11-09, option C): the Event that
 * holds Now, else their next Planned one still to start (one with no time counts all its day),
 * soonest first; a cancelled one never. Null with neither: the hero falls back to the title.
 */
export function heroEvent(
  summaries: readonly EventSummary[],
  holder: EventSummary | null,
  now: Date,
): { summary: EventSummary; now: boolean } | null {
  if (holder) return { summary: holder, now: true };
  const day = isoDay(now);
  const next = summaries
    .filter(
      ({ event, cancelled }) =>
        event.status === 'planned' &&
        !cancelled &&
        event.deletedAt === null &&
        (event.startTime === null ? event.date >= day : startOf(event) > now.getTime()),
    )
    .sort((a, b) => startOf(a.event) - startOf(b.event))[0];
  return next ? { summary: next, now: false } : null;
}
