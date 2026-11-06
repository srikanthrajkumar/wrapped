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

/**
 * The Appearances an Event is known by, from its Appearances in Stage order: those in its
 * kind's Roles, or without one the first Artist on Stage; none before any Artist. It orders what
 * is shown only: no Role ranks above another in the Wrapped.
 */
export function knownBy<T extends Pick<Appearance, 'role'>>(
  kind: EventKind,
  stage: readonly T[],
): T[] {
  const roles = KNOWN_BY[kind] ?? KNOWN_BY.concert;
  const known = stage.filter((appearance) => appearance.role && roles.includes(appearance.role));
  return known.length > 0 ? known : stage.slice(0, 1);
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
