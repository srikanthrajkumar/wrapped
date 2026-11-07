// Which Events Season lists under Next (DESIGN.md "Season (home, DD2)"): Planned ones not in Now
// that have yet to start. A cancelled one stays, marked, until the rasika deletes it, even once
// its start time has passed (the Maintainer, 2026-11-07): the cancellation is never hidden by
// the clock. Framework-free, so the rule is unit-tested (tests/screens/next.test.ts).

import { eventStart } from '../store/logging-note';
import type { EventSummary } from '../store/queries';

export function nextEvents(
  summaries: readonly EventSummary[],
  inNow: ReadonlySet<string>,
  now: Date,
): EventSummary[] {
  return summaries.filter(
    (s) =>
      s.event.status === 'planned' &&
      !inNow.has(s.event.id) &&
      (s.cancelled || (eventStart(s.event) ?? new Date(`${s.event.date}T23:59`)) > now),
  );
}

/** The Events as Now reads them: one whose Schedule entry is cancelled counts as cancelled. */
export const asNowReads = (summaries: readonly EventSummary[]) =>
  summaries.map((s) =>
    s.cancelled && !s.event.cancelled ? { ...s.event, cancelled: true } : s.event,
  );
