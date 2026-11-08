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
 * The days that have something in them, in date order. `apart` are Events shown elsewhere (the
 * one holding Now, as its card), left out of their day. `listings` come sorted (listSchedule).
 */
export function timeline(
  summaries: readonly EventSummary[],
  listings: readonly ScheduleListing[],
  apart: ReadonlySet<string> = new Set(),
): TimelineDay[] {
  const days = new Map<string, TimelineDay>();
  const day = (date: string) => {
    let found = days.get(date);
    if (!found) days.set(date, (found = { date, own: [], listings: [] }));
    return found;
  };
  for (const summary of summaries) {
    if (!apart.has(summary.event.id)) day(summary.event.date).own.push(summary);
  }
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
