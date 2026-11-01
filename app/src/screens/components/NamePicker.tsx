// The Artist and Sabha pickers (T041; DESIGN.md "Artist and Sabha pickers", design D26): the
// same docked search. Before typing it lists the rasika's recent names; as they type, matches
// from their own and the shared lists, each with a distinguishing line where known. The last row
// is always "Add “what you typed” as a new Sabha" (or Artist), so a new entry is a deliberate
// choice, never a typo's side effect.

import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import type { Role } from '../../model';
import {
  createArtist,
  createSabha,
  findArtists,
  findSabhas,
  recentNames,
  usualRoles,
  type NameMatch,
} from '../../store/people';
import { ROLE_NAMES } from '../format';
import { DockedSearch, FixedRow, type SearchRow } from './DockedSearch';
import { SheetFrame } from './sheet-frame';

type Kind = 'artist' | 'sabha';
const NOUN: Record<Kind, string> = { artist: 'Artist', sabha: 'Sabha' };

export function NamePicker({
  kind,
  open,
  onOpenChange,
  onPick,
  after,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Called with the picked or new entry's id and name. */
  onPick(entry: { id: string; name: string }): void;
  /** Shown instead of the search once something is picked (the Role chips). */
  after?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const typed = query.trim();
  const noun = NOUN[kind];
  const found = useLiveQuery(async () => {
    const names = typed
      ? await (kind === 'artist' ? findArtists : findSabhas)(typed)
      : await recentNames(kind);
    const roles: Map<string, Role> = kind === 'artist' ? await usualRoles() : new Map();
    return { names, roles };
  }, [kind, typed, open]);

  const pick = (entry: NameMatch | { id: string; name: string }) => {
    setQuery('');
    onPick({ id: entry.id, name: entry.name });
  };

  const addNew = async () => {
    const created = await (kind === 'artist' ? createArtist : createSabha)(typed);
    pick(created);
  };

  const rows: SearchRow[] = (found?.names ?? []).map((name) => {
    const role = found?.roles.get(name.id);
    return {
      key: name.id,
      title: name.name,
      line: role ? ROLE_NAMES[role] : name.aliases.length > 0 ? name.aliases.join(', ') : null,
      onPick: () => pick(name),
    };
  });

  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('');
        onOpenChange(next);
      }}
      title={kind === 'artist' ? 'Add Artist' : 'Sabha'}
      tall={!after}
    >
      {after ?? (
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
      )}
    </SheetFrame>
  );
}

/** The Role chips after an Artist is picked; skippable, so the Role can stay blank. */
export function RoleChips({ onRole }: { onRole(role: Role | null): void }) {
  const roles: (Role | null)[] = [
    'vocal',
    'violin',
    'veena',
    'flute',
    'mridangam',
    'khanjira',
    'ghatam',
    'morsing',
    'other',
    'presenter',
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sub text-muted-foreground">Role</p>
      <div role="group" aria-label="Role" className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <FixedChip key={role} onClick={() => onRole(role)}>
            {ROLE_NAMES[role!]}
          </FixedChip>
        ))}
        <FixedChip onClick={() => onRole(null)}>Not sure</FixedChip>
      </div>
    </div>
  );
}

function FixedChip(props: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className="inline-flex min-h-12 items-center rounded-full border border-border px-4 py-2 text-sub"
      {...props}
    />
  );
}

export { FixedRow };
