// The Event screen (T043; DESIGN.md "Event (DD3)", design D4 to D6, D8, D16, D17, D18, and the
// iPhone walkthrough's S2 to S12). Top to bottom: the Artists it is known by, with the Sabha,
// date and time under them; Stage, listed by Role; the note; the Items, last, so the list ends
// right above the fixed 56px bar that holds the one action for the Event's state, "Start
// logging" or "Add Item". "Done with this Concert" is an optional row after the last Item.
// Lists are rows on the background, not cards.

import { IconArrowDown, IconArrowUp, IconDots, IconPlus, IconTrash } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fold } from '../catalog/fold';
import { useCatalog } from '../catalog/use-catalog';
import { newId, type Colour, type Item, type Role } from '../model';
import { editEvent, setStatus } from '../store/events';
import { moveItemBy } from '../store/items';
import { endLogging, isBeingLogged } from '../store/logging-note';
import { addAppearance, editAppearance, renameArtist, usualRoles } from '../store/people';
import {
  getEvent,
  useAppearances,
  useItems,
  useLoggingNotes,
  useReceipts,
  useSabha,
  countRagas,
  useWhatItAdded,
  type ResolvedAppearance,
  type ResolvedEntry,
  type ResolvedEvent,
} from '../store/queries';
import { joinNames, knownBy } from '../store/stage';
import { ColourPicker, colourName, SwatchDot } from './components/ColourPicker';
import { NotSavedLine, saveWith, Saved, useSaveFeedback } from './components/feedback';
import { useAutosave } from './components/autosave';
import {
  BottomDock,
  QuietButton,
  Screen,
  SectionHead,
  TopBar,
  useFocusOnOpen,
  useNow,
} from './components/layout';
import { NamePicker, RoleChips } from './components/NamePicker';
import { SheetFrame } from './components/sheet-frame';
import { UndoBar } from './components/UndoBar';
import { eventLine, itemCount, itemLine, itemTitle, roleName } from './format';
import { deleteConcert, deleteItem, removeArtist } from './deletes';
import { undo, undoMessage } from './undo';
import type { SaveFeedback } from './save-feedback';

type Order = 'items' | null;

/** An Artist picked to add, with their usual Role as the picker read it (undefined: not read). */
type Picked = { id: string; name: string; usualRole?: Role | null };

/** The Event, null once it is missing or deleted, undefined while loading. */
function useEventOrNull(id: string) {
  return useLiveQuery(async () => (await getEvent(id)) ?? null, [id]);
}

const eventTarget = (eventId: string, field: string) => ({
  table: 'events' as const,
  id: eventId,
  field,
});

const appearanceTarget = (id: string, field: string) => ({
  table: 'appearances' as const,
  id,
  field,
});

export function EventScreen({ eventId }: { eventId: string }) {
  return (
    <Screen>
      <EventView eventId={eventId} />
    </Screen>
  );
}

function EventView({ eventId }: { eventId: string }) {
  const event = useEventOrNull(eventId);
  const items = useItems(eventId);
  const appearances = useAppearances(eventId);
  const notes = useLoggingNotes();
  const receipts = useReceipts(eventId);
  const now = useNow();
  const [order, setOrder] = useState<Order>(null);
  const [artistOpen, setArtistOpen] = useState(false);
  const [artistFailed, setArtistFailed] = useState<{ id: string; entry: Picked } | null>(null);
  // The Role chips after an add, with the Role chosen for the Artist (their usual one).
  const [rolesFor, setRolesFor] = useState<{ id: string; role: Role | null } | null>(null);
  const [coloursFor, setColoursFor] = useState<string | null>(null);
  const [appearanceFor, setAppearanceFor] = useState<string | null>(null);
  const feedback = useSaveFeedback();
  const rows = useRef(new Map<string, HTMLElement>());
  const concertHead = useRef<HTMLHeadingElement>(null);
  const itemsHead = useRef<HTMLHeadingElement>(null);
  const stageHead = useRef<HTMLHeadingElement>(null);
  // After a delete, focus the row that took the deleted one's place (design D16).
  const focusAfter = useRef<{ list: 'items' | 'stage'; index: number } | null>(null);
  const setFocusAfter = (next: { list: 'items' | 'stage'; index: number }) => {
    focusAfter.current = next;
  };

  useEffect(() => {
    const pending = focusAfter.current;
    if (!pending) return;
    focusAfter.current = null;
    const list = pending.list === 'items' ? items : appearances;
    const next = list?.[pending.index] ?? list?.[pending.index - 1];
    const target = next ? rows.current.get(next.id) : undefined;
    // Stage goes once its last Artist is removed; the Concert's heading, "Add Artist", stays.
    const head =
      pending.list === 'items' ? itemsHead.current : (stageHead.current ?? concertHead.current);
    (target ?? head)?.focus();
  }, [items, appearances]);

  if (event === undefined || items === undefined || appearances === undefined) return null;
  if (event === null) {
    return (
      <>
        <TopBar back={{ href: '/', label: 'Season' }} />
        <p className="py-6 text-body text-muted-foreground">This Concert is not on this phone.</p>
      </>
    );
  }

  const note = notes?.get(eventId);
  const logging = isBeingLogged(event, note, now);
  const known = knownBy(event.kind, appearances);
  const knownAs =
    known.length > 0 ? joinNames(known.map((a) => nameShown(feedback, a.artist))) : null;
  const target = (field: string) => eventTarget(eventId, field);
  const appearanceById = (id: string | null) => appearances.find((a) => a.id === id);

  // Deletes go through save feedback as their own kind (screens/deletes.ts): a failed one reads
  // "Not deleted", its Try again offers Undo too, and nothing is thrown.
  const removeItemAt = async (item: Item, index: number) => {
    if (!(await deleteItem(item))) return;
    setFocusAfter({ list: 'items', index });
  };

  // The sheet closes only once the Artist is removed; a failure stays in it.
  const removeFromStage = async (id: string) => {
    const index = appearances.findIndex((a) => a.id === id);
    const appearance = appearances[index];
    if (!appearance) return;
    if (!(await removeArtist({ id, name: appearance.artist?.name ?? null }))) return;
    setAppearanceFor(null);
    setFocusAfter({ list: 'stage', index });
  };

  // Each add has its own id, so a second failure never hides the first, and a retry adds it
  // once. The Role chips follow only an add made in this sheet, never one retried from the
  // season-wide row. An Artist logged before gets their usual Role at once (walkthrough S6), as
  // the picker read it (read here if it had not yet), as its own write, so a Role a rule refuses
  // never stops the add. The chips show it chosen, as the Stage row does, saved or not; "Not
  // sure" clears it.
  const addArtist = async (entry: Picked, id = newId()) => {
    const usual =
      entry.usualRole !== undefined
        ? entry.usualRole
        : await usualRoles().then(
            (roles) => roles.get(entry.id) ?? null,
            () => null,
          );
    const appearance = await saveWith(
      appearanceTarget(id, '*'),
      { eventId, artistId: entry.id, name: entry.name },
      () => addAppearance(eventId, entry.id, {}, { id }),
    );
    setArtistFailed(appearance ? null : { id, entry });
    if (!appearance) return;
    setRolesFor({ id: appearance.id, role: usual });
    if (usual) void saveRole(appearance.id, usual);
  };

  return (
    <>
      <TopBar
        back={{ href: '/', label: 'Season' }}
        right={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Concert actions">
                <IconDots aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => void deleteConcert(event)}>
                Delete Event
              </DropdownMenuItem>
              {receipts && receipts.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Recently deleted</DropdownMenuLabel>
                  {receipts.map((receipt) => (
                    <DropdownMenuItem key={receipt.id} onSelect={() => void undo(receipt)}>
                      {undoMessage(receipt)} · Undo
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <ConcertBlock
        event={event}
        knownBy={knownAs}
        headRef={concertHead}
        onAddArtist={() => setArtistOpen(true)}
      />

      {appearances.length > 0 && (
        <section aria-labelledby="stage" className="pb-6">
          <SectionHead id="stage" headRef={stageHead}>
            Stage
          </SectionHead>
          <ul className="border-t border-border">
            {appearances.map((appearance) => (
              <StageRow
                key={appearance.id}
                appearance={appearance}
                rowRef={(node) => {
                  if (node) rows.current.set(appearance.id, node);
                  else rows.current.delete(appearance.id);
                }}
                onOpen={() => setAppearanceFor(appearance.id)}
                onColours={() => setColoursFor(appearance.id)}
              />
            ))}
            {order === null && (
              <li className="border-b border-border">
                <button
                  type="button"
                  onClick={() => setArtistOpen(true)}
                  className="flex min-h-12 w-full items-center gap-2 py-2 text-left text-muted-foreground"
                >
                  <IconPlus aria-hidden className="size-5" />
                  Add Artist
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      <NoteField eventId={eventId} stored={event.note} />

      {items.length > 0 && (
        <section aria-labelledby="items" className="pb-6">
          <SectionHead
            id="items"
            headRef={itemsHead}
            action={
              items.length >= 2 &&
              order === null && (
                <QuietButton onClick={() => setOrder('items')}>Edit order</QuietButton>
              )
            }
          >
            Items
          </SectionHead>
          <ol className="border-t border-border">
            {items.map((item, index) => (
              <li key={item.id} className="border-b border-border">
                <Saved
                  target={['*', 'position', 'deletedAt'].map((field) => ({
                    table: 'items' as const,
                    id: item.id,
                    field,
                  }))}
                >
                  {order === 'items' ? (
                    // At large text the move and delete controls wrap under the title.
                    <div className="flex flex-wrap items-center justify-end gap-1 py-1">
                      <span className="flex min-w-[min(100%,calc(12*var(--text-body)))] flex-1 items-start gap-3">
                        <ItemLabel item={item} />
                      </span>
                      <MoveButtons
                        name={`Item ${item.position}`}
                        first={index === 0}
                        last={index === items.length - 1}
                        onMove={(by) =>
                          // A move is never retried: "Not moved", and the rasika moves it again.
                          void saveWith(
                            { table: 'items', id: item.id, field: 'position' },
                            index + by + 1,
                            () => moveItemBy(item.id, by),
                            { kind: 'move' },
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete Item ${item.position}`}
                        onClick={() => void removeItemAt(item, index)}
                      >
                        <IconTrash aria-hidden />
                      </Button>
                    </div>
                  ) : (
                    <Link
                      href={`/event/${eventId}/item/${item.id}`}
                      ref={(node: HTMLAnchorElement | null) => {
                        if (node) rows.current.set(item.id, node);
                        else rows.current.delete(item.id);
                      }}
                      className="flex min-h-[60px] items-start gap-3 py-2 text-foreground"
                    >
                      <ItemLabel item={item} />
                    </Link>
                  )}
                </Saved>
              </li>
            ))}
          </ol>
          {order === null &&
            (logging ? (
              <Saved target={target('logging')} className="mt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    void saveWith(target('logging'), 'done', () => endLogging(eventId))
                  }
                >
                  Done with this Concert
                </Button>
              </Saved>
            ) : (
              <Summary eventId={eventId} items={items} />
            ))}
        </section>
      )}

      <BottomDock>
        <UndoBar />
        <div className="border-t border-border bg-background px-4 py-2">
          {order !== null ? (
            <Button size="lg" className="w-full" onClick={() => setOrder(null)}>
              Done
            </Button>
          ) : event.status === 'planned' ? (
            <Saved target={target('status')}>
              <Button
                size="lg"
                className="w-full"
                onClick={() =>
                  void saveWith(target('status'), 'attended', () => setStatus(eventId, 'attended'))
                }
              >
                Start logging
              </Button>
            </Saved>
          ) : (
            <Button size="lg" className="w-full" asChild>
              <Link href={`/event/${eventId}/item/new`}>
                <IconPlus aria-hidden />
                Add Item
              </Link>
            </Button>
          )}
        </div>
      </BottomDock>

      <NamePicker
        kind="artist"
        open={artistOpen}
        onOpenChange={(open) => {
          setArtistOpen(open);
          if (!open) {
            setRolesFor(null);
            setArtistFailed(null);
          }
        }}
        onPick={(entry, usualRole) => void addArtist({ ...entry, usualRole })}
        notice={
          artistFailed && (
            <NotSavedLine
              targets={[appearanceTarget(artistFailed.id, '*')]}
              onRetry={() => void addArtist(artistFailed.entry, artistFailed.id)}
            />
          )
        }
        after={
          rolesFor && (
            <RoleChips
              skippable
              value={rolesFor.role}
              onRole={(role) => {
                setRolesFor(null);
                setArtistOpen(false);
                // A tap saves even the Role already chosen, whose own write may yet fail.
                if (role !== null || rolesFor.role !== null) void saveRole(rolesFor.id, role);
              }}
            />
          )
        }
      />

      {coloursFor && appearanceById(coloursFor) && (
        <ColoursSheet
          appearance={appearanceById(coloursFor)!}
          onClose={() => setColoursFor(null)}
        />
      )}

      {appearanceFor && appearanceById(appearanceFor) && (
        <AppearanceSheet
          appearance={appearanceById(appearanceFor)!}
          onClose={() => setAppearanceFor(null)}
          onColours={() => {
            setAppearanceFor(null);
            setColoursFor(appearanceFor);
          }}
          onRemove={() => void removeFromStage(appearanceFor)}
        />
      )}
    </>
  );
}

/**
 * The concert, as the first block (design D5, walkthrough S2): the Artists it is known by, or
 * "Add Artist" before any Artist, then its Sabha, date and start time, with the sheet that edits
 * them. A date, time or Sabha saving or not saved shows as entered, here and when the sheet
 * reopens (design D15). `headRef` is its heading, where focus goes when Stage empties.
 */
function ConcertBlock({
  event,
  knownBy,
  headRef,
  onAddArtist,
}: {
  event: ResolvedEvent;
  knownBy: string | null;
  headRef: RefObject<HTMLHeadingElement | null>;
  onAddArtist(): void;
}) {
  const feedback = useSaveFeedback();
  const [factsOpen, setFactsOpen] = useState(false);
  const [sabhaOpen, setSabhaOpen] = useState(false);
  const focusRef = useFocusOnOpen<HTMLHeadingElement>(event.id);
  const head = useCallback(
    (node: HTMLHeadingElement | null) => {
      focusRef.current = node;
      headRef.current = node;
    },
    [focusRef, headRef],
  );
  const target = (field: string) => eventTarget(event.id, field);
  const date = feedback.shown(target('date'), event.date);
  const startTime = feedback.shown(target('startTime'), event.startTime);
  // A Sabha is kept with its name, so one not saved still reads by name.
  const chosen = feedback.shown<{ id: string | null; name: string | null }>(target('sabhaId'), {
    id: event.sabhaId,
    name: null,
  });
  const resolved = useSabha(chosen.id);
  const sabhaName = resolved?.name ?? chosen.name;

  return (
    <section className="pt-2 pb-2">
      <h1 ref={head} tabIndex={-1} className="text-title font-semibold break-words">
        {knownBy ?? (
          <button
            type="button"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl text-left"
            onClick={onAddArtist}
          >
            <IconPlus aria-hidden className="size-5" />
            Add Artist
          </button>
        )}
      </h1>
      <Saved target={[target('date'), target('startTime'), target('sabhaId')]}>
        <div className="flex flex-wrap items-center gap-x-4">
          {!sabhaName && (
            <button
              type="button"
              onClick={() => setSabhaOpen(true)}
              className="inline-flex min-h-14 items-center gap-2 rounded-xl py-2 text-left text-muted-foreground"
            >
              <IconPlus aria-hidden className="size-5" />
              Add Sabha
            </button>
          )}
          <button
            type="button"
            onClick={() => setFactsOpen(true)}
            className="min-h-14 rounded-xl py-2 text-left text-muted-foreground"
          >
            {eventLine({ date, startTime }, sabhaName)}
          </button>
        </div>
      </Saved>

      <EventFacts
        open={factsOpen}
        onOpenChange={setFactsOpen}
        date={date}
        startTime={startTime}
        sabhaName={sabhaName}
        onSabha={() => {
          setFactsOpen(false);
          setSabhaOpen(true);
        }}
        onChange={(changes) => {
          const [field] = Object.keys(changes);
          void saveWith(target(field!), Object.values(changes)[0], () =>
            editEvent(event.id, changes),
          );
        }}
      />

      <NamePicker
        kind="sabha"
        open={sabhaOpen}
        onOpenChange={setSabhaOpen}
        onPick={(entry) => {
          setSabhaOpen(false);
          void saveWith(target('sabhaId'), { id: entry.id, name: entry.name }, () =>
            editEvent(event.id, { sabhaId: entry.id }),
          );
        }}
      />
    </section>
  );
}

/** An Appearance with its Role and Colours as entered while saving or not saved (design D15). */
function useShownAppearance(appearance: ResolvedAppearance): ResolvedAppearance {
  const feedback = useSaveFeedback();
  return {
    ...appearance,
    role: feedback.shown(appearanceTarget(appearance.id, 'role'), appearance.role),
    ...feedback.shown(appearanceTarget(appearance.id, 'colours'), {
      colourPrimary: appearance.colourPrimary,
      colourSecondary: appearance.colourSecondary,
    }),
  };
}

/** An Artist on Stage: name and Role, and their Colours at the right. */
function StageRow({
  appearance: stored,
  rowRef,
  onOpen,
  onColours,
}: {
  appearance: ResolvedAppearance;
  rowRef(node: HTMLButtonElement | null): void;
  onOpen(): void;
  onColours(): void;
}) {
  const appearance = useShownAppearance(stored);
  const feedback = useSaveFeedback();
  const own = appearance.artist?.shared ? null : appearance.artist?.own;
  const name = nameShown(feedback, appearance.artist);
  return (
    <li className="border-b border-border">
      <Saved
        target={[
          ...['*', 'role', 'colours', 'deletedAt'].map((field) =>
            appearanceTarget(appearance.id, field),
          ),
          // A rename not saved shows on the row that shows it.
          ...(own ? [artistName(own.id)] : []),
        ]}
      >
        <div className="flex flex-wrap items-center justify-end gap-x-1">
          <button
            type="button"
            ref={rowRef}
            onClick={onOpen}
            className="flex min-h-[60px] min-w-[min(100%,calc(9*var(--text-body)))] flex-1 flex-col items-stretch justify-center py-2 text-left"
          >
            <span className="break-words">{name}</span>
            {appearance.role && (
              <span className="text-sub text-muted-foreground">{roleName(appearance.role)}</span>
            )}
          </button>
          <ColoursButton appearance={appearance} onOpen={onColours} />
        </div>
      </Saved>
    </li>
  );
}

function ColoursSheet({
  appearance: stored,
  onClose,
}: {
  appearance: ResolvedAppearance;
  onClose(): void;
}) {
  const appearance = useShownAppearance(stored);
  const feedback = useSaveFeedback();
  return (
    <ColourPicker
      open
      onOpenChange={(open) => !open && onClose()}
      artistName={nameShown(feedback, appearance.artist)}
      primary={appearance.colourPrimary}
      secondary={appearance.colourSecondary}
      onChange={(colours) =>
        void saveWith(appearanceTarget(appearance.id, 'colours'), colours, () =>
          editAppearance(appearance.id, colours),
        )
      }
    />
  );
}

const artistName = (id: string) => ({ table: 'artists' as const, id, field: 'name' });

/** An Artist's name, as entered while a rename of it is saving or not saved (design D15). */
function nameShown(feedback: SaveFeedback, artist: ResolvedEntry | null): string {
  const own = artist && !artist.shared ? artist.own : null;
  return own ? feedback.shown(artistName(own.id), own.name) : (artist?.name ?? '?');
}

/**
 * The Artist's name at the top of their sheet, which corrects it in every Concert (walkthrough
 * S5). The field journals exactly what it shows as it is typed (ADR 0007), so a lock or kill
 * loses nothing, and writes it when the field is left, Done is pressed or the sheet closes:
 * never per keystroke, nor when the page is hidden, since each rename keeps the name it replaces
 * as an Alias and a half-typed name would stay as one. Emptied, it goes back to the name as it
 * was. The same name again writes nothing new, so what was typed always ends as what is shown.
 * A shared Artist's name belongs to the Maintainer, and one whose merges can't be followed can't
 * be renamed, so those show as plain text.
 */
function ArtistName({ artist }: { artist: ResolvedEntry | null }) {
  const feedback = useSaveFeedback();
  const own = artist && !artist.shared && !artist.own?.mergedIntoId ? artist.own : null;
  const shown = own ? feedback.shown(artistName(own.id), own.name) : null;
  const [draft, setDraft] = useState<string | null>(null);
  // The name to write for what is typed, so a sheet closed while the field has focus writes it.
  const typed = useRef<{ id: string; name: string } | null>(null);
  const commit = useCallback(() => {
    const pending = typed.current;
    if (!pending) return;
    typed.current = null;
    setDraft(null);
    void saveWith(artistName(pending.id), pending.name, () =>
      renameArtist(pending.id, pending.name),
    );
  }, []);
  useEffect(() => commit, [commit]);

  if (!own) {
    return <p className="text-title font-semibold break-words">{artist?.name ?? 'Artist'}</p>;
  }
  return (
    <Saved target={artistName(own.id)}>
      <input
        aria-label="Artist name"
        value={draft ?? shown ?? ''}
        onChange={(e) => {
          const text = e.target.value;
          // Emptied: back to the name the field showed.
          const name = fold(text) === '' ? (shown ?? own.name) : text.trim();
          typed.current = { id: own.id, name };
          setDraft(text);
          feedback.hold(artistName(own.id), name);
        }}
        // Leaving the app blurs the window, not the field, which keeps focus: a half-typed name
        // is not written then, so it never stays as an Alias.
        onBlur={(e) => document.activeElement !== e.currentTarget && commit()}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        enterKeyHint="done"
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        className="-mx-3 min-h-12 w-[calc(100%+1.5rem)] rounded-xl bg-transparent px-3 text-title font-semibold underline decoration-border underline-offset-4 focus:bg-secondary focus:no-underline"
      />
    </Saved>
  );
}

/** An Artist on Stage: their name, Role, Colours, and Remove, whose failure shows in the sheet. */
function AppearanceSheet({
  appearance: stored,
  onClose,
  onColours,
  onRemove,
}: {
  appearance: ResolvedAppearance;
  onClose(): void;
  onColours(): void;
  onRemove(): void;
}) {
  const appearance = useShownAppearance(stored);
  const feedback = useSaveFeedback();
  const removal = appearanceTarget(appearance.id, 'deletedAt');
  return (
    <SheetFrame
      open
      onOpenChange={(open) => !open && onClose()}
      title={nameShown(feedback, appearance.artist)}
      header={<ArtistName artist={appearance.artist} />}
    >
      <div className="flex flex-col gap-4">
        {feedback.get(removal)?.status === 'failed' && (
          <NotSavedLine targets={[removal]} onRetry={onRemove} />
        )}
        <RoleChips
          value={appearance.role}
          onRole={(role) => {
            onClose();
            void saveRole(appearance.id, role);
          }}
        />
        <Button variant="outline" onClick={onColours}>
          Colours
        </Button>
        <Button variant="destructive" onClick={onRemove}>
          <IconTrash aria-hidden />
          Remove
        </Button>
      </div>
    </SheetFrame>
  );
}

function saveRole(appearanceId: string, role: Role | null) {
  return saveWith({ table: 'appearances', id: appearanceId, field: 'role' }, role, () =>
    editAppearance(appearanceId, { role }),
  );
}

/** An Item row's text: number, title, then Raga · Composer. */
function ItemLabel({ item }: { item: Item }) {
  const line = itemLine(item);
  return (
    <>
      <span className="min-w-[2ch] pt-px text-right text-muted-foreground tabular-nums">
        {item.position}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold break-words">{itemTitle(item)}</span>
          {item.layaVinyasam && <Badge variant="secondary">Laya vinyasam</Badge>}
        </span>
        {line && <span className="text-sub break-words text-muted-foreground">{line}</span>}
      </span>
    </>
  );
}

function MoveButtons({
  name,
  first,
  last,
  onMove,
}: {
  name: string;
  first: boolean;
  last: boolean;
  onMove(by: -1 | 1): void;
}) {
  return (
    <span className="flex shrink-0">
      <Button
        variant="ghost"
        size="icon"
        disabled={first}
        aria-label={`Move ${name} up`}
        onClick={() => onMove(-1)}
      >
        <IconArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={last}
        aria-label={`Move ${name} down`}
        onClick={() => onMove(1)}
      >
        <IconArrowDown aria-hidden />
      </Button>
    </span>
  );
}

function ColoursButton({ appearance, onOpen }: { appearance: ResolvedAppearance; onOpen(): void }) {
  const { colourPrimary: primary, colourSecondary: secondary } = appearance;
  const name = appearance.artist?.name ?? 'Artist';
  const spoken =
    primary === null
      ? `Colours for ${name}, none`
      : `Colours for ${name}, ${primary === 'unknown' ? "didn't notice" : colourName(primary)}${secondary ? ` and ${colourName(secondary)}` : ''}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={spoken}
      className="flex min-h-12 shrink-0 items-center gap-1 rounded-xl px-2 text-sub text-muted-foreground"
    >
      {primary === null ? (
        'Colours'
      ) : (
        <>
          <SwatchDot colour={primary} />
          {secondary && <SwatchDot colour={secondary as Colour} />}
        </>
      )}
    </button>
  );
}

/** The summary at the end of a Concert no longer being logged (DESIGN.md "Finishing a Concert"). */
function Summary({ eventId, items }: { eventId: string; items: Item[] }) {
  const catalogState = useCatalog();
  const catalog = catalogState.status === 'ready' ? catalogState.catalog : null;
  const added = useWhatItAdded(eventId, catalog);
  // Linked ragas count once (constitution: analytics aggregate on the linked pair).
  const ragaCount = countRagas(items, catalog);
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 dark:border-transparent">
      <p className="font-semibold">
        {itemCount(items.length)} · {ragaCount} {ragaCount === 1 ? 'Raga' : 'Ragas'}
      </p>
      {added && (added.ragas.length > 0 || added.composers.length > 0) && (
        <>
          <h3 className="pt-2 text-sub text-muted-foreground">What it added</h3>
          <ul className="text-sub">
            {added.ragas.map((raga) => (
              <li key={`r:${raga}`}>First Raga: {raga}</li>
            ))}
            {added.composers.map((composer) => (
              <li key={`c:${composer}`}>New Composer: {composer}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** The Event's facts: Sabha, date and start time, each saved as it changes. */
function EventFacts({
  open,
  onOpenChange,
  date,
  startTime,
  sabhaName,
  onSabha,
  onChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  date: string;
  startTime: string | null;
  sabhaName: string | null;
  onSabha(): void;
  onChange(changes: { date?: string; startTime?: string | null }): void;
}) {
  return (
    <SheetFrame open={open} onOpenChange={onOpenChange} title="Concert">
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={onSabha}
          className="flex min-h-12 flex-col items-start rounded-xl text-left"
        >
          <span className="text-sub text-muted-foreground">Sabha</span>
          <span>{sabhaName ?? 'Add Sabha'}</span>
        </button>
        <label className="flex flex-col gap-1">
          <span className="text-sub text-muted-foreground">Date</span>
          <input
            type="date"
            required
            defaultValue={date}
            onChange={(e) => e.target.value && onChange({ date: e.target.value })}
            className="min-h-12 rounded-xl bg-secondary px-3 text-body"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sub text-muted-foreground">Start time</span>
          <input
            type="time"
            defaultValue={startTime ?? ''}
            onChange={(e) => onChange({ startTime: e.target.value || null })}
            className="min-h-12 rounded-xl bg-secondary px-3 text-body"
          />
        </label>
      </div>
    </SheetFrame>
  );
}

/**
 * The note, last on the screen, saved as the rasika pauses, leaves the field or the app; typed
 * text is copied to save feedback's storage before its write starts.
 */
function NoteField({ eventId, stored }: { eventId: string; stored: string | null }) {
  const feedback = useSaveFeedback();
  const target = eventTarget(eventId, 'note');
  const note = useAutosave(
    feedback.shown(target, stored) ?? '',
    (value) =>
      void saveWith(target, value, () => editEvent(eventId, { note: value === '' ? null : value })),
    (value) => (value === null ? feedback.release(target) : feedback.hold(target, value)),
  );
  return (
    <section aria-labelledby="note" className="pb-6">
      <SectionHead id="note">Note</SectionHead>
      <Saved target={target}>
        <textarea
          aria-labelledby="note"
          value={note.text}
          rows={3}
          onChange={(e) => note.change(e.target.value)}
          onBlur={note.flush}
          className="w-full rounded-xl bg-secondary p-3 text-body"
        />
      </Saved>
    </section>
  );
}
