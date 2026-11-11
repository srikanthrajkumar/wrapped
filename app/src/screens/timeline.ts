// What's on as days (the Maintainer, 2026-11-08; the Season spine, 2026-11-11; DESIGN.md "What's
// on"): every day of the Season in date order, past and to come. Each day holds the rasika's own
// Events shown that day (Shortlisted, Heard, being logged, cancelled and kept, and those made by
// hand) and the Schedule's other listings; the screen draws the two together, by start time. A
// listing the rasika Shortlisted or heard shows once, as their Event. An Event that is Missed, or
// Shortlisted and lapsed, is shown nowhere, so its entry reads as a plain listing again (ADR
// 0010). A cancelled Event stays in its day, marked, until the rasika deletes it or it lapses.
// Framework-free, so the rules are unit-tested (tests/screens/timeline.test.ts).

import type { ScheduleEntry } from '../model';
import type { EventSummary, ScheduleListing } from '../store/queries';
import { hasLapsed } from '../store/lapse';
import {
  accompanying,
  byStage,
  concertType,
  joinNames,
  knownBy,
  knownNames,
  type ConcertType,
} from '../store/stage';

export interface TimelineDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** The rasika's own Events that day, by start time; one with none last. */
  own: EventSummary[];
  /** The Schedule's listings that day with no Event of the rasika's shown, by start time. */
  listings: ScheduleListing[];
}

const byStart = (a: EventSummary, b: EventSummary) =>
  (a.event.startTime ?? '99').localeCompare(b.event.startTime ?? '99');

/**
 * Whether the rasika heard it: Attended, or holding an Item whatever its stored status (a
 * build before ADR 0010, or a pull, can leave an Item on a Shortlisted or Missed Event). A log
 * is never hidden.
 */
export const isHeard = (summary: EventSummary) =>
  summary.event.status === 'attended' || summary.itemCount > 0;

/**
 * Whether the rasika's Event is shown at all: always one they heard; never one Missed, or
 * Shortlisted and lapsed.
 */
export const isShown = (summary: EventSummary, now: Date) =>
  isHeard(summary) || (summary.event.status !== 'missed' && !hasLapsed(summary.event, now));

/**
 * The days that have something in them, in date order, every shown Event in its day (the hero's
 * too: the list is the whole Schedule, the hero a way in). `listings` come sorted (listSchedule).
 */
export function timeline(
  summaries: readonly EventSummary[],
  listings: readonly ScheduleListing[],
  now: Date,
): TimelineDay[] {
  const days = new Map<string, TimelineDay>();
  const day = (date: string) => {
    let found = days.get(date);
    if (!found) days.set(date, (found = { date, own: [], listings: [] }));
    return found;
  };
  const shown = new Set<string>();
  for (const summary of summaries) {
    if (!isShown(summary, now)) continue;
    shown.add(summary.event.id);
    day(summary.event.date).own.push(summary);
  }
  for (const listing of listings) {
    if (listing.plannedId === null || !shown.has(listing.plannedId))
      day(listing.entry.date).listings.push(listing);
  }
  for (const found of days.values()) found.own.sort(byStart);
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * What a Schedule entry is known by, as an Event row names its Artists (T121): its billed
 * Artists (a Group by its name), else its Sabha.
 */
export function listingLead(entry: ScheduleEntry): string {
  const stage = entry.billed.map((person, i) => ({ ...person, position: i + 1 })).sort(byStage);
  const names = knownNames(knownBy(entry.kind, stage), (person) => person.name);
  return names.length > 0 ? joinNames(names) : entry.sabha;
}

/** A Schedule entry's accompanists and type, as a row shows them (ADR 0011). */
export function listingFacts(entry: ScheduleEntry): {
  accompanists: string[];
  type: ConcertType | null;
} {
  const stage = entry.billed.map((person, i) => ({ ...person, position: i + 1 })).sort(byStage);
  return {
    accompanists: accompanying(entry.kind, stage).map((person) => person.name),
    type: concertType(entry.kind, stage),
  };
}
