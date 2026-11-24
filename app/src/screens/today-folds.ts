// Today on What's on, split for its two folds (docs/design/screens/whats-on.md, decisions 1 and
// 4): what is over, under "Earlier today"; what is under way, under "On now" once three or more
// are and something is still to come; then the rest. Pure, so the rules are tested apart from the
// page. The same with or without a filter: a filter only narrows the rows it is given.

import { isOver, startMs, underWay, type Concert, type Notes } from './spine';

/** "On now" folds from this many concerts under way. */
export const ON_NOW_FOLD = 3;

export interface TodayParts {
  /** Over, by start time: 2½ hours after the start, or a cancelled one past its start. */
  over: Concert[];
  /** Under way, by start time, the Concert being logged included. Never a cancelled one. */
  on: Concert[];
  /** Still to come, by start time; a concert with no time is always here. */
  ahead: Concert[];
  /** Whether "On now" folds: three or more under way, with something still to come. */
  foldOn: boolean;
}

/** Splits today's rows, already in start order. */
export function todayParts(rows: readonly Concert[], notes: Notes, now: Date): TodayParts {
  const over: Concert[] = [];
  const on: Concert[] = [];
  const ahead: Concert[] = [];
  for (const row of rows) {
    const start = startMs(row);
    // A cancelled concert is never on now; once its start has passed it goes with what is over,
    // so it never stands first after the folds.
    if (isOver(row, notes, now) || (row.cancelled && start !== null && start <= now.getTime()))
      over.push(row);
    else if (underWay(row, notes, now)) on.push(row);
    else ahead.push(row);
  }
  return { over, on, ahead, foldOn: on.length >= ON_NOW_FOLD && ahead.length > 0 };
}

/**
 * Whether "Earlier today" would be all the list shows (decision 1): today is the only day listed,
 * and everything in it is over. It then starts open, so the page never starts as closed folds.
 */
export const onlyEarlier = (parts: TodayParts, daysListed: number) =>
  daysListed === 1 && parts.over.length > 0 && parts.on.length === 0 && parts.ahead.length === 0;
