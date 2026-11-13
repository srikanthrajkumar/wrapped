// The Season spine's rules (docs/designs/season-spine.md, approved 2026-11-10; the Maintainer's
// decisions of 2026-11-11; ADR 0010 and 0011): one concert as every row shows it, whichever stage
// it is at (Listed, Shortlisted, Heard); what is under way; the hub's hero, which never picks
// for the rasika; the hub's first section; and the Shortlist's slots. Framework-free, so the rules are
// unit-tested (tests/screens/spine.test.ts).

import type { EventKind } from '../model';
import { hasLapsed, lapseVerdict, sameSlot as inOneSlot, SLOT_MS } from '../store/lapse';
import { eventStart, isBeingLogged, type LoggingNote } from '../store/logging-note';
import type { EventSummary, ScheduleListing } from '../store/queries';
import type { ConcertType } from '../store/stage';
import { isHeard, isShown, listingFacts, listingLead } from './timeline';

/** A concert reads as under way from its start until this long after it (SF-D30). */
export const UNDER_WAY_MS = 2.5 * 60 * 60 * 1000;
/** The hub's first section shows at most this many rows (SF-D26). */
export const SOON_ROWS = 4;

/** One concert as a row shows it: a Schedule listing, the rasika's own Event, or both. */
export interface Concert {
  /** The Schedule entry's id, else the Event's. */
  key: string;
  date: string;
  startTime: string | null;
  kind: EventKind;
  /** Who it is known by: its lead Artists, else its Sabha. */
  lead: string;
  /** Its type when it isn't vocal (ADR 0011). */
  type: ConcertType | null;
  /** The printed title of a Lecdem, a Dance or a Harikatha. */
  title: string | null;
  accompanists: string[];
  /** Its Sabha, unless the Sabha is already its lead. */
  sabha: string | null;
  cancelled: boolean;
  /** The Schedule's listing; null for a concert the rasika made by hand. */
  listing: ScheduleListing | null;
  /** The rasika's Event when one is shown: Shortlisted or Heard. */
  own: EventSummary | null;
}

export type Stage = 'listed' | 'shortlisted' | 'heard';

/** Which stage of the spine a concert is at for this rasika. */
export const stageOf = (concert: Concert): Stage =>
  concert.own === null ? 'listed' : isHeard(concert.own) ? 'heard' : 'shortlisted';

/** A Schedule listing nobody has Shortlisted, as a row. */
export function listed(listing: ScheduleListing): Concert {
  const { entry } = listing;
  const lead = listingLead(entry);
  return {
    key: entry.id,
    date: entry.date,
    startTime: entry.startTime,
    kind: entry.kind,
    lead,
    title: entry.title,
    sabha: lead === entry.sabha ? null : entry.sabha,
    cancelled: entry.cancelled,
    listing,
    own: null,
    ...listingFacts(entry),
  };
}

/** The rasika's own Event as a row, with its listing when it came from the Schedule. */
export function owned(summary: EventSummary, listing: ScheduleListing | null = null): Concert {
  const { event } = summary;
  return {
    key: event.scheduleEntryId ?? event.id,
    date: event.date,
    startTime: event.startTime,
    kind: event.kind,
    lead: summary.knownBy ?? summary.sabha?.name ?? 'No Sabha yet',
    type: summary.type,
    title: event.kind === 'concert' ? null : event.title,
    accompanists: summary.accompanists,
    sabha: summary.knownBy ? (summary.sabha?.name ?? null) : null,
    cancelled: summary.cancelled,
    listing,
    own: summary,
  };
}

const startMs = (concert: Pick<Concert, 'date' | 'startTime'>) =>
  eventStart(concert)?.getTime() ?? null;

/** By start time, one with no time last in its day, then by Sabha, as the Schedule is listed. */
export const byStart = (a: Concert, b: Concert) =>
  a.date.localeCompare(b.date) ||
  (a.startTime ?? '99').localeCompare(b.startTime ?? '99') ||
  (a.sabha ?? a.lead).localeCompare(b.sabha ?? b.lead);

/**
 * Every concert of the Season, each once, in start order: a listing the rasika Shortlisted or
 * heard is their Event, and an Event that is Missed or lapsed is not shown, so its listing
 * stands alone again (ADR 0010).
 */
export function concerts(
  summaries: readonly EventSummary[],
  listings: readonly ScheduleListing[],
  now: Date,
): Concert[] {
  const shown = new Map(
    summaries.filter((summary) => isShown(summary, now)).map((s) => [s.event.id, s]),
  );
  const all: Concert[] = [];
  const placed = new Set<string>();
  for (const listing of listings) {
    const own = listing.plannedId ? shown.get(listing.plannedId) : undefined;
    if (own) placed.add(own.event.id);
    all.push(own ? owned(own, listing) : listed(listing));
  }
  for (const summary of shown.values()) if (!placed.has(summary.event.id)) all.push(owned(summary));
  return all.sort(byStart);
}

export type Notes = ReadonlyMap<string, LoggingNote>;

const logging = (concert: Concert, notes: Notes, now: Date) =>
  concert.own !== null && isBeingLogged(concert.own.event, notes.get(concert.own.event.id), now);

/**
 * Whether a concert is under way (SF-D30): from its start until 2½ hours after it; the
 * rasika's own, while it is still being logged, for as long as the logging holds it, so no list
 * ever disagrees with the hero. Never a cancelled one.
 */
export function underWay(concert: Concert, notes: Notes, now: Date): boolean {
  if (concert.cancelled) return false;
  if (logging(concert, notes, now)) return true;
  const start = startMs(concert);
  return start !== null && start <= now.getTime() && now.getTime() < start + UNDER_WAY_MS;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (at: Date) =>
  `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/**
 * Whether a concert of today is over (SF-D30): 2½ hours after its start, unless the rasika is
 * still logging it. One with no time is never over on its day.
 */
export function isOver(concert: Concert, notes: Notes, now: Date): boolean {
  const start = startMs(concert);
  if (start === null) return concert.date < isoDay(now);
  return now.getTime() >= start + UNDER_WAY_MS && !logging(concert, notes, now);
}

export interface Soon {
  /**
   * The day the hub's first section is of: today while anything is on or ahead, else the next
   * day that has a concert; null with nothing ahead at all.
   */
  day: string | null;
  /**
   * Up to four rows. Today: the rasika's Shortlisted ones, then the next slot, then others under
   * way. Another day: its first four, in start order.
   */
  rows: Concert[];
  /** How many concerts the section's page holds for that day: today's not yet over, or all. */
  count: number;
}

/**
 * The hub's first section (SF-D26, SF-D27, SF-D37; the Maintainer, 2026-11-13). Today, only
 * concerts under way or in the next slot qualify: the next start time today and any within 30
 * minutes of it, however far off. Up to four rows: the rasika's Shortlisted ones among them
 * first, then the rest of the next slot, then the others under way, the latest to start first,
 * so the 3:40 pick is never pushed out by concerts long under way. `hero` is the Event the hero
 * already shows as being logged, left out. With nothing left today the section is the next
 * day's, its first four in start order: the star marks a Shortlisted one where it falls.
 */
export function startingSoon(
  all: readonly Concert[],
  notes: Notes,
  now: Date,
  hero: string | null = null,
): Soon {
  const today = isoDay(now);
  const live = all.filter((concert) => !concert.cancelled);
  const open = live.filter((concert) => hero === null || concert.own?.event.id !== hero);
  const on = open.filter((concert) => underWay(concert, notes, now));
  const ahead = open.filter(
    (concert) => concert.date === today && (startMs(concert) ?? 0) > now.getTime(),
  );
  const first = ahead[0] ? startMs(ahead[0])! : null;
  const slot = ahead.filter((concert) => startMs(concert)! - first! <= SLOT_MS);
  const mine = (concert: Concert) => stageOf(concert) === 'shortlisted';
  const ordered = [
    ...[...slot, ...on].filter(mine).sort(byStart),
    ...slot.filter((concert) => !mine(concert)),
    ...on.filter((concert) => !mine(concert)).reverse(),
  ];
  if (ordered.length > 0) {
    return {
      day: today,
      rows: ordered.slice(0, SOON_ROWS),
      count: live.filter(
        (concert) =>
          underWay(concert, notes, now) || (concert.date === today && !isOver(concert, notes, now)),
      ).length,
    };
  }
  const day = live.find((concert) => concert.date > today)?.date ?? null;
  const ofDay = day === null ? [] : live.filter((concert) => concert.date === day);
  return { day, rows: ofDay.slice(0, SOON_ROWS), count: ofDay.length };
}

/** A concert reads as near from this long before its start (the Maintainer, 2026-11-13). */
export const NEAR_MS = 60 * 60 * 1000;

/**
 * The whole minutes until a concert starts, while it is inside the hour: 1 to 59, rounded up,
 * so "in 1 min" holds until the minute it starts. Null further off, once started, or with no
 * time. Worked out from the clock and the start time; nothing is stored.
 */
export function minutesTo(concert: Pick<Concert, 'date' | 'startTime'>, now: Date): number | null {
  const start = startMs(concert);
  if (start === null) return null;
  const minutes = Math.ceil((start - now.getTime()) / 60_000);
  return minutes >= 1 && minutes * 60_000 < NEAR_MS ? minutes : null;
}

export type Hero =
  /** The rasika's concert on now: being logged, or one of theirs under way. */
  | { kind: 'now'; summary: EventSummary }
  /** Their soonest one ahead. */
  | { kind: 'next'; summary: EventSummary }
  /** Two or more they Shortlisted in one slot: a choice, never a pick (SF-D19, SF-D33). */
  | { kind: 'pick'; summaries: EventSummary[]; now: boolean };

const sameSlot = (a: EventSummary, b: EventSummary) => inOneSlot(a.event, b.event);

const bySummaryStart = (a: EventSummary, b: EventSummary) =>
  (eventStart(a.event)?.getTime() ?? 0) - (eventStart(b.event)?.getTime() ?? 0) ||
  (a.sabha?.name ?? '').localeCompare(b.sabha?.name ?? '');

/**
 * The hub's hero (Part 7): the concert the rasika is logging now; else one of theirs under way
 * (a Heard one before a Shortlisted one); else their soonest ahead, one with no time counting
 * all its day. Shortlisted concerts in one slot, starting within 30 minutes of each other, read
 * as a choice between them. A cancelled, Missed or lapsed one never; null with none, when the
 * hero falls back to the title.
 */
export function hubHero(summaries: readonly EventSummary[], notes: Notes, now: Date): Hero | null {
  const t = now.getTime();
  const mine = summaries.filter(
    (s) => isShown(s, now) && !s.cancelled && !s.event.cancelled && s.event.deletedAt === null,
  );
  const logged = (s: EventSummary) => Date.parse(notes.get(s.event.id)?.lastLoggedAt ?? '') || 0;
  const beingLogged = mine
    .filter((s) => isBeingLogged(s.event, notes.get(s.event.id), now))
    .sort((a, b) => logged(b) - logged(a))[0];
  if (beingLogged) return { kind: 'now', summary: beingLogged };

  const choice = (among: EventSummary[], lead: EventSummary, on: boolean): Hero => {
    if (isHeard(lead)) return { kind: on ? 'now' : 'next', summary: lead };
    const slot = among
      .filter((s) => !isHeard(s) && (s === lead || sameSlot(s, lead)))
      .sort(bySummaryStart);
    return slot.length > 1
      ? { kind: 'pick', summaries: slot, now: on }
      : { kind: on ? 'now' : 'next', summary: lead };
  };

  const on = mine
    .filter((s) => {
      const start = eventStart(s.event)?.getTime();
      return start !== undefined && start <= t && t < start + UNDER_WAY_MS;
    })
    .sort((a, b) => bySummaryStart(b, a));
  const heard = on.find(isHeard);
  if (heard) return { kind: 'now', summary: heard };
  if (on[0]) return choice(on, on[0], true);

  const day = isoDay(now);
  const startOf = (s: EventSummary) =>
    eventStart(s.event)?.getTime() ??
    eventStart({ date: s.event.date, startTime: '00:00' })!.getTime();
  const ahead = mine
    .filter((s) => (s.event.startTime === null ? s.event.date >= day : startOf(s) > t))
    .sort((a, b) => startOf(a) - startOf(b));
  return ahead[0] ? choice(ahead, ahead[0], false) : null;
}

/** The slot's name for the hero's choice, by its start (placeholder words, not approved). */
export function slotName(startTime: string | null): 'morning' | 'afternoon' | 'dusk' | 'evening' {
  const time = startTime ?? '00:00';
  if (time < '11:30') return 'morning';
  if (time < '15:30') return 'afternoon';
  if (time < '17:30') return 'dusk';
  return 'evening';
}

/** The rasika's Shortlisted concerts still ahead or under way, in start order. */
export function shortlist(all: readonly Concert[]): Concert[] {
  return all.filter((concert) => stageOf(concert) === 'shortlisted');
}

export interface ShortlistDay {
  date: string;
  /** Concerts starting within 30 minutes of the slot's first read as one slot (SF-D33). */
  slots: Concert[][];
}

/** The Shortlist by day, then by slot: a clash is simply one slot with two rows. */
export function shortlistDays(shortlisted: readonly Concert[]): ShortlistDay[] {
  const days: ShortlistDay[] = [];
  for (const concert of [...shortlisted].sort(byStart)) {
    let day = days.at(-1);
    if (day?.date !== concert.date) days.push((day = { date: concert.date, slots: [] }));
    const slot = day.slots.at(-1);
    const [first, start] = [slot?.[0] ? startMs(slot[0]) : null, startMs(concert)];
    if (slot && first !== null && start !== null && start - first <= SLOT_MS) slot.push(concert);
    else day.slots.push([concert]);
  }
  return days;
}

/** The rasika's Heard concerts, newest first: the Diary. */
export function diary(summaries: readonly EventSummary[]): EventSummary[] {
  return summaries
    .filter(isHeard)
    .sort(
      (a, b) =>
        b.event.date.localeCompare(a.event.date) ||
        (b.event.startTime ?? '').localeCompare(a.event.startTime ?? '') ||
        b.event.createdAt.localeCompare(a.event.createdAt),
    );
}

/**
 * The lapsed Shortlisted Events the hub's card asks about, newest day first (ADR 0010): never
 * one the store settles unasked (store/lapse.ts `lapseVerdict`).
 */
export function lapsedToAsk(summaries: readonly EventSummary[], now: Date): EventSummary[] {
  const heard = summaries.filter(isHeard).map((s) => s.event);
  return summaries
    .filter(
      (summary) =>
        hasLapsed(summary.event, now) &&
        !isHeard(summary) &&
        lapseVerdict(summary.event, {
          items: summary.itemCount,
          cancelled: summary.cancelled,
          heard,
        }) === 'ask',
    )
    .sort((a, b) => b.event.date.localeCompare(a.event.date) || bySummaryStart(a, b));
}
