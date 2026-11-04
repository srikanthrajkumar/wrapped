// The Stage's order and the Artists an Event is known by (walkthrough S2, S4). Artists are listed by Role, as
// in a printed kutcheri listing, and ties keep the order added (the Appearance's `position`).
// Derived each time, never stored: no Role ranks above another in the data (FR-004).

import type { Appearance, EventKind, Role } from '../model';

/** The Roles in Stage order; an Appearance with no Role comes after them all. */
export const STAGE_ORDER = [
  'vocal',
  'veena',
  'flute',
  'violin',
  'mridangam',
  'ghatam',
  'khanjira',
  'morsing',
  'other',
  'presenter',
] as const satisfies readonly Role[];

const rank = (role: Role | null) =>
  role === null ? STAGE_ORDER.length : STAGE_ORDER.indexOf(role);

type Placed = Pick<Appearance, 'role' | 'position'>;

/** Compare two Appearances of one Event for the Stage: by Role, then by the order added. */
export function byStage(a: Placed, b: Placed): number {
  return rank(a.role) - rank(b.role) || a.position - b.position;
}

/** Whom each kind of Event is known by: vocal, veena or flute, or a Lecdem's presenters. */
const MAIN: Record<EventKind, readonly Role[]> = {
  concert: ['vocal', 'veena', 'flute'],
  lecdem: ['presenter'],
};

/**
 * The Appearances an Event is known by, from its Appearances in Stage order: its vocal, veena or
 * flute Artists (a Lecdem's presenters), or without one the first Artist on Stage; none before
 * any Artist. It orders what is shown only: no Role ranks above another in the Wrapped.
 */
export function knownBy<T extends Pick<Appearance, 'role'>>(
  kind: EventKind,
  stage: readonly T[],
): T[] {
  const main = stage.filter(
    (appearance) => appearance.role && MAIN[kind].includes(appearance.role),
  );
  return main.length > 0 ? main : stage.slice(0, 1);
}

/** Names joined as a listing reads them: "A", "A & B", "A, B & C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}
