// What a blank Concert offers (docs/design/log-entry.md, decided 2026-11-22): the Schedule's
// listings near the Concert's own date and time, so one tap fills it in, and the span of days in
// which it offers a search of What's on. Framework-free, so the rules are unit-tested
// (tests/screens/near-listings.test.ts).

import { fold as foldName } from '../catalog/fold';
import { eventStart } from '../store/logging-note';
import type { ScheduleListing } from '../store/queries';
import { stageOf, UNDER_WAY_MS, type Concert } from './spine';

/** A listing is near when it started up to 2½ hours before the Concert's time... */
export const NEAR_BEFORE_MS = UNDER_WAY_MS;
/** ...or starts within the hour after it. */
export const NEAR_AFTER_MS = 60 * 60 * 1000;
/** At most this many rows: 90% of concerts just begun are among them on peak days. */
export const NEAR_ROWS = 4;
/** "Search What's on…" shows until this many days after the Schedule's last listing. */
export const SPAN_AFTER_DAYS = 7;
/** The Concert's time reads as "now" within this much of the clock. */
export const NOW_WITHIN_MS = 5 * 60 * 1000;

/**
 * The listings near `at`, at most `most`: none cancelled, none the rasika has heard, none with
 * no time. The rasika's Shortlisted ones first, then the rest nearest to `at` first; listings
 * that start at the same time in Sabha order, as the Schedule lists them.
 */
export function nearListings(
  all: readonly Concert[],
  at: Date,
  most: number = NEAR_ROWS,
): Concert[] {
  const time = at.getTime();
  const near: { concert: Concert; start: number }[] = [];
  for (const concert of all) {
    if (!concert.listing || concert.cancelled || concert.listing.entry.cancelled) continue;
    if (stageOf(concert) === 'heard') continue;
    const start = eventStart(concert)?.getTime();
    if (start === undefined) continue;
    if (start < time - NEAR_BEFORE_MS || start > time + NEAR_AFTER_MS) continue;
    near.push({ concert, start });
  }
  const mine = (concert: Concert) => (stageOf(concert) === 'shortlisted' ? 0 : 1);
  return near
    .sort(
      (a, b) =>
        mine(a.concert) - mine(b.concert) ||
        Math.abs(a.start - time) - Math.abs(b.start - time) ||
        a.start - b.start ||
        a.concert.listing!.entry.sabha.localeCompare(b.concert.listing!.entry.sabha),
    )
    .slice(0, most)
    .map((one) => one.concert);
}

/** Whether `at` is the clock's now, near enough to say "On now or within the hour". */
export const isNow = (at: Date, now: Date) =>
  Math.abs(at.getTime() - now.getTime()) <= NOW_WITHIN_MS;

const addDays = (date: string, days: number) => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
};

/**
 * Whether `date` falls in the stored Schedule's span, from its first listing's day to a week
 * after its last: while it does, a blank Concert offers "Search What's on…". With no Schedule on
 * the phone, never.
 */
export function inScheduleSpan(listings: readonly ScheduleListing[], date: string): boolean {
  if (listings.length === 0) return false;
  let first = listings[0]!.entry.date;
  let last = first;
  for (const { entry } of listings) {
    if (entry.date < first) first = entry.date;
    if (entry.date > last) last = entry.date;
  }
  return date >= first && date <= addDays(last, SPAN_AFTER_DAYS);
}

/**
 * The listings a search of What's on finds for `query`, by an Artist billed or the Sabha, best
 * first: a match on the name the concert is known by before its Sabha, and its Sabha before an
 * accompanist; whole words before the starts of words, before parts of them; then the Concert's
 * own day first, the days nearest it next, then by time. Cancelled and heard listings are left
 * out.
 */
export function searchListings(
  all: readonly Concert[],
  query: string,
  day: string,
  most = 30,
): Concert[] {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const dayMs = Date.parse(`${day}T00:00:00Z`);
  const found: { concert: Concert; score: number; distance: number }[] = [];
  for (const concert of all) {
    const entry = concert.listing?.entry;
    if (!entry || entry.cancelled || concert.cancelled || stageOf(concert) === 'heard') continue;
    // Where a word is found, best first: the lead, the Sabha, everyone else billed.
    const places = [
      [fold(concert.lead)],
      [fold(entry.sabha)],
      entry.billed.map((person) => fold(person.name)),
    ];
    let score = 0;
    for (const word of words) {
      const how = (name: string) =>
        ` ${name} `.includes(` ${word} `)
          ? 0
          : ` ${name}`.includes(` ${word}`)
            ? 1
            : name.includes(word)
              ? 2
              : null;
      let best: number | null = null;
      places.forEach((names, place) => {
        for (const name of names) {
          const kind = how(name);
          if (kind === null) continue;
          // A whole word anywhere beats a part of one; within a kind, the better place wins.
          const rank = kind * places.length + place;
          if (best === null || rank < best) best = rank;
        }
      });
      if (best === null) {
        score = -1;
        break;
      }
      score += best;
    }
    if (score < 0) continue;
    const distance = Math.abs(Date.parse(`${entry.date}T00:00:00Z`) - dayMs);
    found.push({ concert, score, distance });
  }
  return found
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.distance - b.distance ||
        a.concert.date.localeCompare(b.concert.date) ||
        (a.concert.startTime ?? '99').localeCompare(b.concert.startTime ?? '99') ||
        a.concert.listing!.entry.sabha.localeCompare(b.concert.listing!.entry.sabha),
    )
    .slice(0, most)
    .map((one) => one.concert);
}

/** The transliteration fold, initials run together: "T.M. Krishna" meets "TM Krishna". */
const fold = (text: string) => foldName(text.replace(/\./g, ''));
