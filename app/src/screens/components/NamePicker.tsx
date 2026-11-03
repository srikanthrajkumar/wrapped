// The Artist and Sabha pickers (T041; DESIGN.md "Artist and Sabha pickers", design D26): the
// same docked search. Before typing it lists the rasika's recent names; as they type, matches
// from their own and the shared lists, each with a distinguishing line where known. The last row
// is always "Add “what you typed” as a new Sabha" (or Artist), so a new entry is a deliberate
// choice, never a typo's side effect. A new name that fails to save shows "Not saved on this
// phone." in the sheet, above the search, with Try again.

import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ReactNode } from 'react';
import { newId, ROLES, type Role } from '../../model';
import {
  createArtist,
  createSabha,
  findArtists,
  findSabhas,
  recentNames,
  usualRoles,
  type NameMatch,
} from '../../store/people';
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
  /** Called with the picked or new entry's id and name. */
  onPick(entry: { id: string; name: string }): void;
  /** Shown instead of the search once something is picked (the Role chips). */
  after?: ReactNode;
  /** The caller's own failure line, shown above the search (an Artist not added). */
  notice?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [failedAdd, setFailedAdd] = useState<{ id: string; name: string } | null>(null);
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
    async (): Promise<Map<string, Role>> =>
      open && kind === 'artist' ? await usualRoles() : new Map(),
    [kind, open],
  );

  const pick = (entry: NameMatch | { id: string; name: string }) => {
    setQuery('');
    onPick({ id: entry.id, name: entry.name });
  };

  // One add at a time: a double tap must not create the name twice. Each add has its own id;
  // the write only creates the name, so Try again from the season-wide line never picks it into
  // whatever the screen shows by then. Try again in the sheet adds it and picks it, as now.
  const adding = useRef(false);
  const add = async (id: string, name: string) => {
    if (adding.current || !name) return;
    adding.current = true;
    const table = kind === 'artist' ? 'artists' : 'sabhas';
    const create = kind === 'artist' ? createArtist : createSabha;
    try {
      const created = await saveWith({ table, id, field: '*' }, name, () => create(name, { id }));
      setFailedAdd(created ? null : { id, name });
      if (created) pick(created);
    } finally {
      adding.current = false;
    }
  };
  const addNew = () => add(newId(), typed);

  const rows: SearchRow[] = (names ?? []).map((name) => {
    const role = roles?.get(name.id);
    return {
      key: name.id,
      title: name.name,
      line: role ?? (name.aliases.length > 0 ? name.aliases.join(', ') : null),
      onPick: () => pick(name),
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
      tall={!after}
    >
      {after ?? (
        <>
          {notice}
          {failedAdd && (
            <NotSavedLine
              targets={[
                { table: kind === 'artist' ? 'artists' : 'sabhas', id: failedAdd.id, field: '*' },
              ]}
              onRetry={() => void add(failedAdd.id, failedAdd.name)}
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
            lastRow={
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

/**
 * The Role chips. The current Role shows pressed, and tapping it again clears it. Right after an
 * Artist is added (`skippable`), "Not sure" moves on with the Role left blank.
 */
export function RoleChips({
  value = null,
  skippable = false,
  onRole,
}: {
  value?: Role | null;
  skippable?: boolean;
  onRole(role: Role | null): void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sub text-muted-foreground">Role</p>
      <div role="group" aria-label="Role" className="flex flex-wrap gap-2">
        {ROLES.map((role) => (
          <Chip
            key={role}
            pressed={value === role}
            onClick={() => onRole(value === role ? null : role)}
          >
            {role}
          </Chip>
        ))}
        {skippable && <Chip onClick={() => onRole(null)}>Not sure</Chip>}
      </div>
    </div>
  );
}
