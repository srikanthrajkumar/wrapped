// The Event screen (T043; DESIGN.md "Event (DD3)", design D4 to D6, D8, D16, D17, D18, and the
// iPhone walkthrough's S2 to S12). Top to bottom: the Artists it is known by, with the Sabha,
// date and time under them; Stage, listed by Role; the note; the Items, last, so the list ends
// right above the fixed 56px bar that holds the one action for the Event's state, "Start
// logging" or "Add Item". Nothing ends a Concert by hand (S13): it ends on its own, stays
// editable, and its summary shows once as a modal (components/ConcertSummary). Lists are rows on
// the background, not cards.

import {
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconChevronRight,
  IconClock,
  IconDots,
  IconGripVertical,
  IconMetronome,
  IconMusic,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { fold } from '../catalog/fold';
import { EVENT_KINDS, newId, type Colour, type EventKind, type Item, type Role } from '../model';
import { changeKind, editEvent } from '../store/events';
import { moveItemBy } from '../store/items';
import { addAppearance, editAppearance, renameArtist, usualRoles } from '../store/people';
import {
  getEvent,
  useAppearances,
  useItems,
  useReceipts,
  useSabha,
  type ResolvedAppearance,
  type ResolvedEntry,
  type ResolvedEvent,
} from '../store/queries';
import { joinNames, knownBy, knownNames } from '../store/stage';
import { ColourPicker, colourName, SwatchDot } from './components/ColourPicker';
import { NotSavedLine, saveWith, Saved, useSaveFeedback } from './components/feedback';
import { useAutosave } from './components/autosave';
import { useDragOrder } from './components/drag-order';
import {
  BarHold,
  BottomDock,
  QuietButton,
  Screen,
  SectionHead,
  TopBar,
  useBack,
  useFocusOnOpen,
  useKeptScroll,
} from './components/layout';
import { NamePicker, RoleChips } from './components/NamePicker';
import { SheetFrame, useLingering } from './components/sheet-frame';
import { Fold } from './components/fold';
import { Chip } from './components/DockedSearch';
import { KindMark } from './components/kind-mark';
import { creditName, dayText, eventLine, itemLine, itemTitle, kindName, timeText } from './format';
import { deleteConcert, deleteItem, removeArtist } from './deletes';
import { MESSAGES } from './messages';
import { offerUndo, undo, undoMessage } from './undo';
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
  const receipts = useReceipts(eventId);
  const [order, setOrder] = useState<Order>(null);
  const [artistOpen, setArtistOpen] = useState(false);
  const [artistFailed, setArtistFailed] = useState<{ id: string; entry: Picked } | null>(null);
  // The Role chips after an add, with the Role chosen for the Artist (their usual one).
  const [rolesFor, setRolesFor] = useState<{ id: string; role: Role | null } | null>(null);
  const [coloursFor, setColoursFor] = useState<string | null>(null);
  const [appearanceFor, setAppearanceFor] = useState<string | null>(null);
  const feedback = useSaveFeedback();
  // Back to the page it was opened from, in its tab (screens/nav.ts).
  const back = useBack();
  useKeptScroll(event !== undefined && items !== undefined && appearances !== undefined);
  // The Artist sheets, kept while they slide closed (an Artist removed included).
  const [colours, coloursOpen] = useLingering(
    appearances?.find((a) => a.id === coloursFor) ?? null,
  );
  const [sheetFor, sheetOpen] = useLingering(
    appearances?.find((a) => a.id === appearanceFor) ?? null,
  );
  const rows = useRef(new Map<string, HTMLElement>());
  const concertHead = useRef<HTMLHeadingElement>(null);
  const itemsHead = useRef<HTMLHeadingElement>(null);
  const stageHead = useRef<HTMLHeadingElement>(null);
  // After a delete, focus the row that took the deleted one's place (design D16).
  const focusAfter = useRef<{ list: 'items' | 'stage'; index: number } | null>(null);
  const setFocusAfter = (next: { list: 'items' | 'stage'; index: number }) => {
    focusAfter.current = next;
  };
  // A move is never retried: "Not moved", and the rasika moves it again.
  const moveItem = (id: string, by: number) =>
    saveWith(
      { table: 'items', id, field: 'position' },
      (items?.findIndex((item) => item.id === id) ?? 0) + by + 1,
      () => moveItemBy(id, by),
      { kind: 'move' },
    );
  const drag = useDragOrder({ ids: items?.map((item) => item.id) ?? [], onDrop: moveItem });

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

  if (event === undefined || items === undefined || appearances === undefined) return <BarHold />;
  if (event === null) {
    return (
      <>
        <TopBar back={back} />
        <p className="py-6 text-body text-muted-foreground">This Concert is not on this phone.</p>
      </>
    );
  }

  const known = knownBy(event.kind, appearances);
  const knownAs =
    known.length > 0 ? joinNames(knownNames(known, (a) => nameShown(feedback, a.artist))) : null;

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
        back={back}
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

      {/* Items, then Stage, then Note (the Maintainer, 2026-11-11, restoring the order before
          2026-11-04): what was sung leads, and each section's lines are its own rows'. */}
      {items.length === 0 && (
        // Where logging starts: nothing sung yet, and Add Item in the bar.
        <Empty className="pt-10 pb-2">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconMusic aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{MESSAGES.spine.empty.items.title}</EmptyTitle>
            <EmptyDescription>{MESSAGES.spine.empty.items.line}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {items.length > 0 && (
        <section aria-labelledby="items" className="pt-8">
          <SectionHead
            id="items"
            headRef={itemsHead}
            action={
              items.length >= 2 &&
              order === null && (
                <QuietButton className="-my-3 -mr-2" onClick={() => setOrder('items')}>
                  Edit order
                </QuietButton>
              )
            }
          >
            Items
          </SectionHead>
          <ol className="hairline-t">
            {(order === 'items'
              ? drag.order.map((id, index) => ({
                  // Numbered as they stand, so a dropped row takes its new number at once.
                  ...items.find((item) => item.id === id)!,
                  position: index + 1,
                }))
              : items
            ).map((item, index) => (
              <li
                key={item.id}
                ref={drag.rowRef(item.id)}
                style={order === 'items' ? drag.style(item.id) : undefined}
                // The lifted row leaves its hairline behind.
                className={drag.lifted === item.id ? undefined : 'hairline-b'}
              >
                {/* A dropped row shows its own move, so only a new or restored row highlights. */}
                <Saved
                  target={['*', 'position', 'deletedAt'].map((field) => ({
                    table: 'items' as const,
                    id: item.id,
                    field,
                  }))}
                  quiet={[{ table: 'items', id: item.id, field: 'position' }]}
                >
                  {order === 'items' ? (
                    // One line each while ordering, so every row is 64px; the full names show
                    // outside it. At large text the controls wrap under the title.
                    <div
                      className={cn(
                        'relative -mx-2 flex min-h-16 flex-wrap items-center justify-end rounded-xl py-2 pl-2',
                        drag.lifted === item.id && 'bg-secondary shadow-lg dark:shadow-none',
                      )}
                    >
                      <span className="flex min-w-[min(100%,calc(12*var(--text-body)))] flex-1 items-start gap-3">
                        <ItemLabel item={item} oneLine />
                      </span>
                      {/* The arrows stay for VoiceOver and the keyboard; the grip is for a finger. */}
                      <MoveButtons
                        name={`Item ${item.position}`}
                        first={index === 0}
                        last={index === items.length - 1}
                        onMove={(by) => void moveItem(item.id, by)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete Item ${item.position}`}
                        onClick={() => void removeItemAt(item, index)}
                      >
                        <IconTrash aria-hidden />
                      </Button>
                      <span
                        aria-hidden
                        data-grip
                        {...drag.grip(item.id)}
                        // The grip's mark ends on the gutter; the page doesn't scroll under it.
                        className="-mr-2 flex size-12 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground select-none [-webkit-touch-callout:none] active:cursor-grabbing"
                      >
                        <IconGripVertical />
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={`/event/${eventId}/item/${item.id}`}
                      ref={(node: HTMLAnchorElement | null) => {
                        if (node) rows.current.set(item.id, node);
                        else rows.current.delete(item.id);
                      }}
                      className="flex min-h-16 items-start gap-3 py-2.5 text-foreground"
                    >
                      <ItemLabel item={item} />
                    </Link>
                  )}
                </Saved>
              </li>
            ))}
          </ol>
        </section>
      )}

      {appearances.length > 0 && (
        <section aria-labelledby="stage" className="pt-8">
          <SectionHead
            id="stage"
            headRef={stageHead}
            // One + at the heading's right opens the Artist picker (the Maintainer, 2026-11-10:
            // the "Add Artist" row could go; a +, not a pencil, since it adds). Its mark on the
            // gutter, its 48px reaching past the heading's line so the line keeps its height.
            action={
              order === null && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Add Artist"
                  className="-my-3.5 -mr-3.5"
                  onClick={() => setArtistOpen(true)}
                >
                  <IconPlus aria-hidden />
                </Button>
              )
            }
          >
            Stage
          </SectionHead>
          <ul className="hairline-t">
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
          </ul>
        </section>
      )}

      <NoteField eventId={eventId} stored={event.note} />

      <BottomDock>
        {order !== null ? (
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              // A drag still in hand under another finger moves nothing.
              drag.cancel();
              setOrder(null);
            }}
          >
            Done
          </Button>
        ) : (
          // Logging starts here, whatever the Event's stage: the first Item makes a Shortlisted
          // concert Heard (ADR 0010), so nothing stands before it.
          <Button size="lg" className="w-full" asChild>
            <Link href={`/event/${eventId}/item/new`}>
              <IconPlus aria-hidden />
              Add Item
            </Link>
          </Button>
        )}
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
              kind={event.kind}
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

      {colours && (
        <ColoursSheet appearance={colours} open={coloursOpen} onClose={() => setColoursFor(null)} />
      )}

      {sheetFor && (
        <AppearanceSheet
          appearance={sheetFor}
          kind={event.kind}
          open={sheetOpen}
          onClose={() => setAppearanceFor(null)}
          onColours={() => {
            setAppearanceFor(null);
            setColoursFor(sheetFor.id);
          }}
          onRemove={() => void removeFromStage(sheetFor.id)}
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
  // A kind is entered with the title it is saved with, as one value (journal-check.ts).
  const kind = feedback.shown(target('kind'), { kind: event.kind, title: event.title });
  const title = feedback.shown(target('title'), kind.title);

  // The kind and its title are written, journalled and checked together, so a failed write
  // keeps both. A change to Concert that takes a typed title away offers Undo, as a delete does
  // (T122).
  const saveKind = async (next: EventKind, nextTitle: string | null = title) => {
    const entered = { kind: next, title: next === 'concert' ? null : nextTitle };
    const changed = await saveWith(target('kind'), entered, () =>
      changeKind(event.id, next, next === 'concert' ? {} : { title: nextTitle }),
    );
    if (changed?.receipt) offerUndo(changed.receipt);
  };

  return (
    <section className="pt-2">
      <h1 ref={head} tabIndex={-1} className="text-title font-semibold break-words">
        {knownBy !== null && <KindMark kind={kind.kind} className="mr-2" />}
        {knownBy ?? (
          <button
            type="button"
            className="-my-2.5 inline-flex min-h-12 items-center gap-2 rounded-xl text-left"
            onClick={onAddArtist}
          >
            <IconPlus aria-hidden className="size-5" />
            Add Artist
          </button>
        )}
      </h1>
      <Saved
        target={[
          target('date'),
          target('startTime'),
          target('sabhaId'),
          target('kind'),
          target('title'),
        ]}
      >
        {/* 56px tall to tap (S11), its text 8px under the title (one step more than the title's
            own line gap, so it never reads as a third line) and flush above Stage. Under "Add
            Artist" it starts below that button's 48px, so neither covers the other's tap area. */}
        <div
          className={cn(
            '-mb-4 flex flex-wrap items-center gap-x-4',
            knownBy === null ? 'mt-2.5' : '-mt-2',
          )}
        >
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
            // Underlined as every value is, so it reads as one to change (walkthrough P2).
            className="min-h-14 rounded-xl py-2 text-left text-muted-foreground underline decoration-border underline-offset-4"
          >
            {/* A Lecdem's, a Dance's or a Harikatha's title reads first, as printed. */}
            {kind.kind !== 'concert' && title && (
              <span className="block text-foreground">{title}</span>
            )}
            {eventLine({ date, startTime }, sabhaName)}
          </button>
        </div>
      </Saved>

      <EventFacts
        open={factsOpen}
        onOpenChange={setFactsOpen}
        eventId={event.id}
        kind={kind.kind}
        title={title}
        onKind={(next) => void saveKind(next)}
        onTitle={(next, as) => {
          if (as !== kind.kind) void saveKind(as, next);
          else {
            void saveWith(target('title'), next, () => editEvent(event.id, { title: next }));
          }
        }}
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
    <li className="hairline-b">
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
            className="flex min-h-16 min-w-[min(100%,calc(9*var(--text-body)))] flex-1 flex-col items-stretch justify-center py-2 text-left"
          >
            <span className="break-words">{name}</span>
            {creditName(appearance.role, appearance.support) && (
              <span className="text-sub text-muted-foreground">
                {creditName(appearance.role, appearance.support)}
              </span>
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
  open,
  onClose,
}: {
  appearance: ResolvedAppearance;
  open: boolean;
  onClose(): void;
}) {
  const appearance = useShownAppearance(stored);
  const feedback = useSaveFeedback();
  return (
    <ColourPicker
      open={open}
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
    // Typing shows itself, so the name plays no highlight (walkthrough P7).
    <Saved target={artistName(own.id)} quiet>
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
  kind,
  open,
  onClose,
  onColours,
  onRemove,
}: {
  appearance: ResolvedAppearance;
  kind: EventKind;
  open: boolean;
  onClose(): void;
  onColours(): void;
  onRemove(): void;
}) {
  const appearance = useShownAppearance(stored);
  const feedback = useSaveFeedback();
  const removal = appearanceTarget(appearance.id, 'deletedAt');
  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={nameShown(feedback, appearance.artist)}
      header={<ArtistName artist={appearance.artist} />}
    >
      <div className="flex flex-col gap-4">
        {feedback.get(removal)?.status === 'failed' && (
          <NotSavedLine targets={[removal]} onRetry={onRemove} />
        )}
        <RoleChips
          value={appearance.role}
          kind={kind}
          onRole={(role) => {
            onClose();
            void saveRole(appearance.id, role);
          }}
        />
        <Button variant="outline" onClick={onColours}>
          {/* The button carries the mark it sets, as the Stage row does. */}
          {appearance.colourPrimary && (
            <SwatchDot colour={appearance.colourPrimary} second={appearance.colourSecondary} />
          )}
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
function ItemLabel({ item, oneLine = false }: { item: Item; oneLine?: boolean }) {
  const line = itemLine(item);
  const fit = oneLine ? 'truncate' : 'break-words';
  return (
    <>
      <span className="min-w-[2ch] text-right text-muted-foreground tabular-nums">
        {item.position}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('flex items-center gap-2', !oneLine && 'flex-wrap')}>
          <span className={cn('font-semibold', fit)}>{itemTitle(item)}</span>
          {/* A mark, not a pill, so the row keeps its height (FB-27). */}
          {item.layaVinyasam && (
            <IconMetronome
              role="img"
              aria-label="Laya vinyasam"
              className="size-5 shrink-0 text-muted-foreground"
            />
          )}
        </span>
        {line && <span className={cn('text-sub text-muted-foreground', fit)}>{line}</span>}
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
    // Out of sight until the keyboard reaches them, then over the row's text beside the bin, so
    // the row never reflows under a tap.
    <span className="absolute right-24 flex bg-background [clip-path:inset(50%)] focus-within:[clip-path:none]">
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
      // 48px to tap, the dot's edge on the gutter, with the hairline. With no Colours yet it is
      // the same dot, empty (the Maintainer, 2026-11-11, replacing the word "Colours").
      className="-mr-3.5 flex size-12 shrink-0 items-center justify-center rounded-xl focus-visible:-outline-offset-4"
    >
      <SwatchDot colour={primary} second={secondary as Colour | null} />
    </button>
  );
}

/**
 * The Event's facts: its kind, a title where it has one, Sabha, date and start time, each saved
 * as it changes (T122). A Lecdem needs a title, so one picked without a title waits for it to be
 * typed before it is saved.
 */
function EventFacts({
  open,
  onOpenChange,
  eventId,
  kind,
  title,
  onKind,
  onTitle,
  date,
  startTime,
  sabhaName,
  onSabha,
  onChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  eventId: string;
  kind: EventKind;
  title: string | null;
  onKind(kind: EventKind): void;
  /** A title typed, saved as `kind`'s: a Lecdem picked without one is saved with it. */
  onTitle(title: string | null, kind: EventKind): void;
  date: string;
  startTime: string | null;
  sabhaName: string | null;
  onSabha(): void;
  onChange(changes: { date?: string; startTime?: string | null }): void;
}) {
  // A Lecdem picked while the Event has no title: shown, and saved once a title is typed.
  const [waiting, setWaiting] = useState<EventKind | null>(null);
  const shownKind = waiting ?? kind;
  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) setWaiting(null);
        onOpenChange(next);
      }}
      title={kindName(shownKind)}
    >
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Kind" className="flex flex-wrap gap-2">
          {EVENT_KINDS.map((each) => (
            <Chip
              key={each}
              pressed={shownKind === each}
              onClick={() => {
                if (each === 'lecdem' && !title?.trim()) {
                  setWaiting(kind === 'lecdem' ? null : 'lecdem');
                  return;
                }
                setWaiting(null);
                if (each !== kind) onKind(each);
              }}
            >
              <KindMark kind={each} className="-ml-1 mr-1.5" />
              {kindName(each)}
            </Chip>
          ))}
        </div>
        {shownKind !== 'concert' && (
          <TitleField
            key={`${eventId}:${shownKind}`}
            eventId={eventId}
            stored={title}
            waitingAs={waiting}
            required={shownKind === 'lecdem'}
            autoFocus={waiting !== null}
            onSave={(next) => {
              onTitle(next, shownKind);
              setWaiting(null);
            }}
          />
        )}
        {/* Drawn as a field like Date and Start time, with the same label gap. */}
        <div className="flex flex-col gap-1">
          <span id="facts-sabha" className="text-sub text-muted-foreground">
            Sabha
          </span>
          <button
            type="button"
            aria-labelledby="facts-sabha facts-sabha-value"
            onClick={onSabha}
            className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-secondary px-3 text-left text-body"
          >
            <span id="facts-sabha-value">{sabhaName ?? 'Add Sabha'}</span>
            <IconChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sub text-muted-foreground">Date</span>
          {/* The phone's own picker, transparent over the value as the app writes it. */}
          <span className="relative flex min-h-12 items-center justify-between gap-2 rounded-xl bg-secondary px-3 text-body has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
            <span aria-hidden>{dayText(date)}</span>
            <IconCalendar aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <input
              type="date"
              required
              defaultValue={date}
              onChange={(e) => e.target.value && onChange({ date: e.target.value })}
              className="absolute inset-0 opacity-0"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sub text-muted-foreground">Start time</span>
          {/* The phone's own picker, transparent over the value as the app writes it. */}
          <span className="relative flex min-h-12 items-center justify-between gap-2 rounded-xl bg-secondary px-3 text-body has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
            <span aria-hidden>{startTime ? timeText(startTime) : ''}</span>
            <IconClock aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <input
              type="time"
              defaultValue={startTime ?? ''}
              onChange={(e) => onChange({ startTime: e.target.value || null })}
              className="absolute inset-0 opacity-0"
            />
          </span>
        </label>
      </div>
    </SheetFrame>
  );
}

/**
 * A Lecdem's, a Dance's or a Harikatha's title, saved as the rasika pauses or leaves the field,
 * journalled as typed (ADR 0007). Emptied, a Dance's or a Harikatha's title is none; a Lecdem's
 * is required, so an emptied one is not written and the title stays. Typed for a kind not yet
 * saved (`waitingAs`), it is journalled with that kind, as the one value they are saved as. It is
 * stored trimmed, and the stored title never replaces the text typed, so a space typed before a
 * pause stays for the next word.
 */
function TitleField({
  eventId,
  stored,
  waitingAs,
  required,
  autoFocus,
  onSave,
}: {
  eventId: string;
  stored: string | null;
  waitingAs: EventKind | null;
  required: boolean;
  autoFocus: boolean;
  onSave(title: string | null): void;
}) {
  const feedback = useSaveFeedback();
  const target = eventTarget(eventId, waitingAs ? 'kind' : 'title');
  const entered = (text: string) => (waitingAs ? { kind: waitingAs, title: text } : text);
  const title = useAutosave(
    stored ?? '',
    (value) => {
      if (value.trim() === '' && required) {
        feedback.release(target);
        return;
      }
      onSave(value.trim() === '' ? null : value);
    },
    (value) => (value === null ? feedback.release(target) : feedback.hold(target, entered(value))),
    (typed, saved) => typed.trim() === saved.trim(),
  );
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sub text-muted-foreground">Title</span>
      <Saved target={target} quiet>
        <input
          value={title.text}
          required={required}
          // A Lecdem picked without a title: the title is what it waits for.
          autoFocus={autoFocus}
          onChange={(e) => title.change(e.target.value)}
          onBlur={title.flush}
          className="block min-h-12 w-full rounded-xl bg-secondary px-3 text-body"
        />
      </Saved>
    </label>
  );
}

/**
 * The note, in a fold (walkthrough P6): open when it has text, so a note written stays in view,
 * and one row when empty. Saved as the rasika pauses, leaves the field or the app; typed text is
 * copied to save feedback's storage before its write starts. Typing shows itself, so it plays no
 * highlight (P7).
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
  // Open when the screen opens with a note; a tap decides from then on, so clearing the text
  // never folds the field away under the finger.
  const [open, setOpen] = useState(() => note.text !== '');
  return (
    // The page's last section. No line above it: it follows a list that ends on its own. Its
    // 48px row holds the label 14px down, so 16px above it sets the label where a section's is.
    <section aria-label="Note" className="pt-4 pb-4">
      <Fold title="Note" open={open} onOpenChange={setOpen} line={false}>
        <Saved target={target} quiet>
          <textarea
            aria-label="Note"
            value={note.text}
            rows={3}
            onChange={(e) => note.change(e.target.value)}
            onBlur={note.flush}
            className="block w-full rounded-xl bg-secondary p-3 text-body"
          />
        </Saved>
      </Fold>
    </section>
  );
}
