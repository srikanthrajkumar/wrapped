// The words for a day, shared by the Hub and What's on (docs/design/screens/hub.md decision 2;
// docs/design/screens/whats-on.md decision 2). A day is the phone's calendar day.

import { dayText } from './format';
import { MESSAGES } from './messages';
import { isoDay } from './spine';

/** The day after `now`'s, by the phone's calendar. */
export const tomorrowOf = (now: Date) =>
  isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

/**
 * A day as the Hub says it, one word for one day wherever it names it: "Today", "Tomorrow",
 * else "Mon 21 Dec". No "Yesterday": it keeps its date.
 */
export const dayName = (date: string, now: Date) =>
  date === isoDay(now)
    ? MESSAGES.season.today
    : date === tomorrowOf(now)
      ? MESSAGES.spine.tomorrow
      : dayText(date);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "Monday 14 December", for a screen reader. */
function spokenDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/**
 * A What's on day label (decision 2, C): the Hub's word and the date for today and tomorrow,
 * "Today · Mon 14 Dec", spoken "Today, Monday 14 December"; any other day its date alone, as
 * before. No "Yesterday".
 */
export function dayLabel(date: string, now: Date): { text: string; spoken?: string } {
  const word = dayName(date, now);
  if (word === dayText(date)) return { text: word };
  return { text: `${word} · ${dayText(date)}`, spoken: `${word}, ${spokenDate(date)}` };
}
