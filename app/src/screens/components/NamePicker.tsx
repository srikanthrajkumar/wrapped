// The Artist and Sabha pickers (T041; DESIGN.md "Artist and Sabha pickers", design D26): the
// same docked search. Before typing it lists the rasika's recent names; as they type, matches
// from their own and the shared lists, each with a distinguishing line where known. Once something
// is typed, "Add “what you typed” as a new Sabha" (or Artist) is pinned under the title, so a new
// entry is a deliberate choice, never a typo's side effect, and the best match sits by the box. The matches include the names the Season's Schedule bills,
// so a billed Artist is found before any listing of theirs is planned. A new name that fails to save shows "Not saved on this
// phone." in the sheet, above the search, with Try again.

import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useRef, useState, type ReactNode } from 'react';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { newId, type EventKind, type Role } from '../../model';
import {
  createArtist,
  createSabha,
  heldEntry,
  findArtists,
  findSabhas,
  recentNames,
  usualRoles,
  type NameMatch,
} from '../../store/people';
import { STAGE_ORDER } from '../../store/stage';
import { roleName } from '../format';
import { Chip, DockedSearch, FixedRow, type SearchRow } from './DockedSearch';
import { NotSavedLine, saveWith } from './feedback';
import { SheetFrame } from './sheet-frame';

type Kind = 'artist' | 'sabha';
const NOUN: Record<Kind, string> = { artist: 'Artist', sabha: 'Sabha' };

export function NamePicker({
  kind,
  open,
  onOpenChange,
  onPick,
  after,
  notice,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange(open: boolean): void;
  /**
   * Called with the picked or new entry's id and name, and an Artist's usual Role (null: none;
   * undefined: not read yet).
   */
  onPick(entry: { id: string; name: string }, usualRole: Role | null | undefined): void;
  /** Shown instead of the search once something is picked (the Role chips). */
  after?: ReactNode;
  /** The caller's own failure line, shown above the search (an Artist not added). */
  notice?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [failedAdd, setFailedAdd] = useState<{
    id: string;
    name: string;
    scheduled?: NameMatch;
  } | null>(null);
  const typed = query.trim();
  const noun = NOUN[kind];
  // The names follow each keystroke; the usual Roles don't change while typing, so they are
  // read once per opening, and neither is read while the picker is closed.
  const names = useLiveQuery(
    async () =>
      !open
        ? []
        : typed
          ? await (kind === 'artist' ? findArtists : findSabhas)(typed)
          : await recentNames(kind),
    [kind, typed, open],
  );
  const roles = useLiveQuery(
    // Undefined while closed, so a reopened picker reads as "not read yet" until they load.
    async (): Promise<Map<string, Role> | undefined> =>
      !open ? undefined : kind === 'artist' ? await usualRoles() : new Map(),
    [kind, open],
  );

  const pick = (entry: NameMatch | { id: string; name: string }) => {
    setQuery('');
    onPick({ id: entry.id, name: entry.name }, roles && (roles.get(entry.id) ?? null));
  };

  // One add at a time: a double tap must not create the name twice. Each add has its own id;
  // the write only creates the name, so Try again from the season-wide line never picks it into
  // whatever the screen shows by then. Try again in the sheet adds it and picks it, as now.
  // A name only on the Season's Schedule is made an entry the same way, by its printed name.
  const adding = useRef(false);
  const add = async (id: string, name: string, scheduled?: NameMatch) => {
    if (adding.current || !name) return;
    adding.current = true;
    const table = kind === 'artist' ? 'artists' : 'sabhas';
    const create = kind === 'artist' ? createArtist : createSabha;
    try {
      // Made by another tab or a planned listing since it was offered: that one, not a twin.
      const held = scheduled && (await heldEntry(kind, name));
      if (held) return pick(held);
      const created = await saveWith({ table, id, field: '*' }, name, () => create(name, { id }));
      setFailedAdd(created ? null : { id, name, scheduled });
      if (created) pick(created);
    } finally {
      adding.current = false;
    }
  };
  const addNew = () => add(newId(), typed);

  const rows: SearchRow[] = (names ?? []).map((name) => {
    // The usual Role, else for a name only on the Schedule the Role it is billed in.
    const role = roles?.get(name.id) ?? name.billedAs;
    return {
      key: name.id,
      title: name.name,
      line: role ? roleName(role) : name.aliases.length > 0 ? name.aliases.join(', ') : null,
      onPick: () => (name.scheduled ? void add(newId(), name.name, name) : pick(name)),
    };
  });

  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery('');
          // Once the sheet is gone, the season-wide line shows the failure.
          setFailedAdd(null);
        }
        onOpenChange(next);
      }}
      title={kind === 'artist' ? 'Add Artist' : 'Sabha'}
    >
      {after ?? (
        <>
          {notice}
          {failedAdd && (
            <NotSavedLine
              targets={[
                { table: kind === 'artist' ? 'artists' : 'sabhas', id: failedAdd.id, field: '*' },
              ]}
              onRetry={() => void add(failedAdd.id, failedAdd.name, failedAdd.scheduled)}
            />
          )}
          <DockedSearch
            label={`Search ${noun}s`}
            placeholder={`${noun}…`}
            query={query}
            onQueryChange={setQuery}
            resultsLabel={typed ? 'Matches, best match last' : `Recent ${noun}s`}
            onSubmit={() => (rows[0] ? rows[0].onPick() : typed && void addNew())}
            results={rows}
            // A pinned row under the title, once something is typed, so a stray tap by the box
            // never makes a duplicate (docs/design/search.md, decision 1).
            pinned={
              typed && (
                <FixedRow onClick={() => void addNew()}>
                  Add “{typed}” as a new {noun}
                </FixedRow>
              )
            }
          />
        </>
      )}
    </SheetFrame>
  );
}

// The first chips (docs/design/instrument-picker.md §4): the eight instruments billed most in
// the 2026-27 feed, in Stage order. A Dance adds its dancers and nattuvanar; a Lecdem and a
// Harikatha their presenters. Every other Role is behind "More" (2026-11-19).
const COMMON_ROLES: ReadonlySet<Role> = new Set<Role>([
  'vocal',
  'veena',
  'flute',
  'violin',
  'mridangam',
  'ghatam',
  'khanjira',
  'morsing',
]);
const FIRST_ROLES: Record<EventKind, ReadonlySet<Role>> = {
  concert: COMMON_ROLES,
  dance: new Set<Role>([...COMMON_ROLES, 'dancer', 'nattuvangam']),
  lecdem: new Set<Role>([...COMMON_ROLES, 'presenter']),
  harikatha: new Set<Role>([...COMMON_ROLES, 'presenter']),
};

/**
 * The instrument picker (docs/design/instrument-picker.md): the first chips, then "More Roles",
 * a quiet line under them that opens every other Role below it, in Stage order (the Maintainer,
 * 2026-11-20). It stays where it is as "Fewer Roles", so a second tap in the same place folds
 * them again; the chips the thumb was on never move. Nobody is put under "Other": the picker
 * never offers it. A Role stored as `other` before 2026-11-19 shows pressed after the last Role,
 * unfolded; another chip replaces it, and tapping it clears it. The current Role shows pressed,
 * and tapping it again clears it; one behind More Roles shows pressed with every Role shown and
 * no fold, so it is never hidden. Right after an Artist is added (`skippable`), the pressed one is
 * the Artist's usual Role, chosen for them (walkthrough S6): tapping it keeps it, and "Not sure",
 * after the first chips, leaves the Role blank.
 */
export function RoleChips({
  value = null,
  kind = 'concert',
  skippable = false,
  onRole,
}: {
  value?: Role | null;
  /** The Event's kind, which sets the first chips. */
  kind?: EventKind;
  skippable?: boolean;
  onRole(role: Role | null): void;
}) {
  const first = FIRST_ROLES[kind] ?? COMMON_ROLES;
  // A pressed Role behind the fold, or one stored as `other`: every Role shows, with no fold.
  const pinned = value !== null && !first.has(value);
  const [open, setOpen] = useState(false);
  const restId = useId();
  const playable = STAGE_ORDER.filter((role) => role !== 'other');
  const firstChips = playable.filter((role) => first.has(role));
  const rest = playable.filter((role) => !first.has(role));
  const chip = (role: Role) => (
    <Chip
      key={role}
      pressed={value === role}
      onClick={() => onRole(value === role && !skippable ? null : role)}
    >
      {roleName(role)}
    </Chip>
  );
  // Stored before every instrument had its Role: kept, never offered (2026-11-19).
  const other = value === 'other' && (
    <Chip pressed onClick={() => onRole(null)}>
      {roleName('other')}
    </Chip>
  );
  const notSure = skippable && <Chip onClick={() => onRole(null)}>Not sure</Chip>;
  return (
    // The label 8px above its chips, as a field's label is ("Nadai"; DESIGN.md).
    <div className="flex flex-col gap-2">
      <p className="text-sub text-muted-foreground">Role</p>
      {/* Chips are fills: their outlines on the 8px edge, their words on the 24px column
          (the Maintainer, 2026-11-20). */}
      <div role="group" aria-label="Role" className="flex flex-col gap-2">
        {pinned ? (
          <div className="fill-edge flex flex-wrap gap-2">
            {firstChips.map(chip)}
            {rest.map(chip)}
            {other}
            {notSure}
          </div>
        ) : (
          <>
            <div className="fill-edge flex flex-wrap gap-2">
              {firstChips.map(chip)}
              {notSure}
            </div>
            {/* A quiet line, not a chip, so it never reads as a Role; its word on the column. */}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={restId}
              onClick={() => setOpen(!open)}
              className="-ml-2 inline-flex min-h-12 items-center gap-1 self-start rounded-xl px-2 text-sub text-muted-foreground focus-visible:-outline-offset-2"
            >
              {open ? 'Fewer Roles' : 'More Roles'}
              {open ? (
                <IconChevronUp aria-hidden className="size-4" />
              ) : (
                <IconChevronDown aria-hidden className="size-4" />
              )}
            </button>
            <div id={restId} hidden={!open} className="fill-edge flex flex-wrap gap-2">
              {open && rest.map(chip)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
