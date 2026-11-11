// The Stage's order and the Artists an Event is known by (walkthrough S2, S4). Artists are
// listed by Role, as in a printed kutcheri listing, and ties keep the order added (the
// Appearance's `position`).
// Derived each time, never stored: no Role ranks above another in the data (FR-004).

import type { Appearance, EventKind, Role } from '../model';

/**
 * The Roles in Stage order (DESIGN.md, "Stage order"); an Appearance with no Role comes after
 * them all. The Roles added on 2026-11-06 slot in without moving the earlier ones.
 */
export const STAGE_ORDER = [
  'dancer',
  'nattuvangam',
  'vocal',
  'support',
  'veena',
  'chitravina',
  'flute',
  'nagaswaram',
  'saxophone',
  'mandolin',
  'violin',
  'mridangam',
  'thavil',
  'ghatam',
  'khanjira',
  'morsing',
  'other',
  'presenter',
] as const satisfies readonly Role[];

// A Role left out of STAGE_ORDER would rank -1 and jump to the top of Stage, so this fails to
// compile until every Role is listed (`satisfies` alone checks only that each listed one is a
// Role).
type Unplaced = Exclude<Role, (typeof STAGE_ORDER)[number]>;
const everyRolePlaced: [Unplaced] extends [never] ? true : Unplaced = true;
void everyRolePlaced;

const rank = (role: Role | null) =>
  role === null ? STAGE_ORDER.length : STAGE_ORDER.indexOf(role);

type Placed = Pick<Appearance, 'role' | 'position'>;

/** Compare two Appearances of one Event for the Stage: by Role, then by the order added. */
export function byStage(a: Placed, b: Placed): number {
  return rank(a.role) - rank(b.role) || a.position - b.position;
}

/**
 * Whom each kind of Event is known by (DESIGN.md, "Event"): a Concert by its lead melodic
 * Roles, a Lecdem or a Harikatha by its presenters, a Dance by its dancers.
 */
const KNOWN_BY: Record<EventKind, readonly Role[]> = {
  concert: ['vocal', 'veena', 'chitravina', 'flute', 'nagaswaram', 'saxophone', 'mandolin'],
  lecdem: ['presenter'],
  dance: ['dancer'],
  harikatha: ['presenter'],
};

type Known = Pick<Appearance, 'role' | 'support'>;

/** Credited as support: billed `support` (2026-11-10), or the vocal support Role. */
const isSupport = (appearance: Known) =>
  appearance.support === true || appearance.role === 'support';

/**
 * The Appearances an Event is known by, from its Appearances in Stage order (the Maintainer,
 * 2026-11-10):
 * - those in its kind's Roles who are not support;
 * - for a Concert with none, every violinist who is not support, as equals (a violin duo, such as
 *   the Akkarai Sisters, reads as both: "Some of them are equal");
 * - else the first Artist on Stage who is not support.
 * A support Appearance (a support violinist, a vocal support singer) never names the Event while
 * anyone else could, and stays on Stage. With only support on Stage, its first names the Event,
 * as before 2026-11-10, so a lone vocal support singer still gives a heading. None before any
 * Artist. It orders what is shown only: no Role ranks above another in the Wrapped.
 */
export function knownBy<T extends Known>(kind: EventKind, stage: readonly T[]): T[] {
  const roles = KNOWN_BY[kind] ?? KNOWN_BY.concert;
  const leads = stage.filter((appearance) => !isSupport(appearance));
  const known = leads.filter((appearance) => appearance.role && roles.includes(appearance.role));
  if (known.length > 0) return known;
  if (kind === 'concert') {
    const violins = leads.filter((appearance) => appearance.role === 'violin');
    if (violins.length > 0) return violins;
  }
  return (leads.length > 0 ? leads : stage).slice(0, 1);
}

/** Names joined as a listing reads them: "A", "A & B", "A, B & C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

/**
 * The names an Event's known-by Appearances show as (T121): where two or more of them share a
 * `group`, the group's name once, in the place of its first member; everyone else by their own
 * name. A member left alone (the others removed) shows by their own name. Display only: each
 * member keeps their own Appearance and counts on their own.
 */
export function knownNames<T extends Partial<Pick<Appearance, 'group'>>>(
  known: readonly T[],
  nameOf: (appearance: T) => string,
): string[] {
  const members = new Map<string, number>();
  for (const appearance of known) {
    const group = appearance.group ?? null;
    if (group !== null) members.set(group, (members.get(group) ?? 0) + 1);
  }
  const names: string[] = [];
  const shown = new Set<string>();
  for (const appearance of known) {
    const group = appearance.group ?? null;
    if (group !== null && (members.get(group) ?? 0) > 1) {
      if (!shown.has(group)) names.push(group);
      shown.add(group);
    } else {
      names.push(nameOf(appearance));
    }
  }
  return names;
}

/** A concert's type as a row names it (ADR 0011): its lead's Role, or a Jugalbandi. */
export type ConcertType = Role | 'jugalbandi';

/** The Roles a type is named for; a vocal concert, the usual kind, shows none. */
const TYPED: readonly Role[] = [
  'veena',
  'chitravina',
  'flute',
  'nagaswaram',
  'saxophone',
  'mandolin',
  'violin',
  'mridangam',
  'thavil',
  'ghatam',
  'khanjira',
  'morsing',
];

/**
 * A Concert's type, read from its Stage each time and never stored (ADR 0011): the Role of the
 * Artists it is known by; two of different Roles are a Jugalbandi. None for a vocal Concert,
 * for one whose Stage carries no Roles, and for a Lecdem, a Dance and a Harikatha, which keep
 * their kind's mark.
 */
export function concertType(kind: EventKind, stage: readonly Known[]): ConcertType | null {
  if (kind !== 'concert') return null;
  const roles = new Set(knownBy(kind, stage).map((appearance) => appearance.role));
  roles.delete(null);
  if (roles.size > 1) return 'jugalbandi';
  const [role] = roles;
  return role && TYPED.includes(role) ? role : null;
}

/** Everyone on Stage the Event is not known by, in Stage order: its accompanists. */
export function accompanying<T extends Known>(kind: EventKind, stage: readonly T[]): T[] {
  const known = new Set(knownBy(kind, stage));
  return stage.filter((appearance) => !known.has(appearance));
}
