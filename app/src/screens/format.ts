// How records read on the screens (DESIGN.md "Components", "Detail values and their six
// states"). Names are shown as stored: the catalog's plain English spelling, or as typed.

import type { DetailValue, Event, EventKind, Item, Role } from '../model';
import type { ConcertType } from '../store/stage';

/** A Detail as text: "?" when Unknown, "" when Not applicable, else its text. */
export function detailText(value: DetailValue): string {
  if (value.state === 'unknown') return '?';
  if (value.state === 'na') return '';
  return value.text;
}

const STATE_SPOKEN: Record<DetailValue['state'], string> = {
  catalog: '',
  override: 'changed from the catalog',
  unknown: 'unknown',
  na: 'not applicable',
  unresolved: 'not matched',
};

/** A Detail's spoken name: field, value and state, as "Raga, Todi, guess" (design D24). */
export function spokenDetail(field: string, value: DetailValue): string {
  const parts = [field];
  if (value.state !== 'unknown' && value.state !== 'na') parts.push(value.text);
  if (STATE_SPOKEN[value.state]) parts.push(STATE_SPOKEN[value.state]);
  if (value.guess) parts.push('guess');
  return parts.join(', ');
}

/** A Detail in a list line: Not applicable is left out, a Guess carries "(?)". */
function listText(value: DetailValue): string | null {
  if (value.state === 'na') return null;
  const text = detailText(value);
  return value.guess ? `${text} (?)` : text;
}

/** The Ragas in order, as one text: "Todi" or "Kalyani, Kambhoji" for a ragamalika. */
export function ragasText(ragas: readonly DetailValue[]): string | null {
  const texts = ragas.map(listText).filter((text): text is string => text !== null);
  return texts.length > 0 ? texts.join(', ') : null;
}

/** The Tala with its Nadai: "Adi (khanda nadai)"; a Nadai that is Not applicable adds nothing. */
export function talaText(item: Pick<Item, 'tala' | 'nadai'>): string {
  const tala = detailText(item.tala);
  if (item.nadai.state === 'na') return tala;
  const nadai = item.nadai.state === 'unknown' ? '? nadai' : `${item.nadai.text} nadai`;
  return tala ? `${tala} (${nadai})` : `(${nadai})`;
}

/** An Item's title line: the title, or for an Item started from its Raga, that Raga. */
export function itemTitle(item: Pick<Item, 'title' | 'ragas'>): string {
  if (item.title.trim() !== '') return item.title;
  return ragasText(item.ragas) ?? '?';
}

/** The running order's second line: "Raga · Composer", leaving out what is Not applicable. */
export function itemLine(item: Item): string {
  const titleIsRaga = item.title.trim() === '';
  return [titleIsRaga ? null : (ragasText(item.ragas) ?? '?'), listText(item.composer)]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat 14 Dec". */
export function dayText(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const day = new Date(y, m - 1, d);
  return `${WEEKDAYS[day.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** "2 Nov", from the date part of "2026-11-02" or a timestamp. */
export function shortDayText(date: string): string {
  const [, m, d] = date.slice(0, 10).split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}

/** "6:30 pm". */
export function timeText(time: string): string {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/**
 * "Music Academy · Sat 14 Dec · 6:30 pm": the line under the Artists an Event is known by
 * (walkthrough S2).
 */
export function eventLine(event: Pick<Event, 'date' | 'startTime'>, sabha?: string | null) {
  return [sabha, dayText(event.date), event.startTime && timeText(event.startTime)]
    .filter(Boolean)
    .join(' · ');
}

// Roles whose stored key is not their name (T057): `support` is vocal support.
const ROLE_NAMES: Partial<Record<Role, string>> = { support: 'Vocal support' };

/** A Role as shown, capitalised like the other chips: "Vocal". Stored lower case (FR-004). */
export const roleName = (role: Role) =>
  ROLE_NAMES[role] ?? role.charAt(0).toUpperCase() + role.slice(1);

/**
 * What someone was billed as, under their name: their Role, with "support" when the Schedule
 * credits them as support (2026-11-10), as "Violin support"; null when neither is known. The
 * vocal support Role already says so.
 */
export function creditName(role: Role | null, support = false): string | null {
  if (!support || role === 'support') return role && roleName(role);
  return role ? `${roleName(role)} support` : 'Support';
}

/** An Event's kind as a word, where one is said: "Concert", "Lecdem", "Dance", "Harikatha". */
/** A concert's type as a row names it (ADR 0011): "Flute", "Jugalbandi". */
export const typeName = (type: ConcertType) =>
  type === 'jugalbandi' ? 'Jugalbandi' : roleName(type);

export const kindName = (kind: EventKind) => kind.charAt(0).toUpperCase() + kind.slice(1);

/** The current time as `HH:MM`, for an Event logged now. */
export function nowTime(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** "1 Item", "8 Items". */
export const itemCount = (n: number) => `${n} ${n === 1 ? 'Item' : 'Items'}`;
