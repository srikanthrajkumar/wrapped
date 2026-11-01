// The Event screen (T043; DESIGN.md "Event (DD3)", design D4 to D6, D8, D16, D17, D18). Top to
// bottom: the concert as the first block, the running order, Stage, the note. A fixed 56px bar
// holds the one action for the Event's state, "Start logging" or "Add Item"; "Done with this
// Concert" is an optional row after the last Item. Lists are rows on the background, not cards.

import { IconArrowDown, IconArrowUp, IconDots, IconPlus, IconTrash } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
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
import { cn } from '@/lib/utils';
import type { Appearance, Colour, Item, Role } from '../model';
import { deleteEvent, editEvent, setStatus } from '../store/events';
import { moveItem, removeItem } from '../store/items';
import { endLogging, isBeingLogged } from '../store/logging-note';
import { addAppearance, editAppearance, moveAppearance, removeAppearance } from '../store/people';
import {
  getEvent,
  useAppearances,
  useItems,
  useLoggingNotes,
  useReceipts,
  useSabha,
  useWhatItAdded,
  type ResolvedAppearance,
} from '../store/queries';
import { ColourPicker, colourName, SwatchDot } from './components/ColourPicker';
import { exportSeason } from './components/export-file';
import { saveWith, Saved } from './components/feedback';
import {
  BottomDock,
  QuietButton,
  SectionHead,
  TopBar,
  useFocusOnOpen,
  useNow,
} from './components/layout';
import { NamePicker, RoleChips } from './components/NamePicker';
import { SheetFrame } from './components/sheet-frame';
import { UndoBar } from './components/UndoBar';
import { eventLine, itemCount, itemLine, itemTitle, ROLE_NAMES } from './format';
import { offerUndo, undo, undoMessage } from './undo';

type Order = 'items' | 'stage' | null;

/** The Event, null once it is missing or deleted, undefined while loading. */
function useEventOrNull(id: string) {
  return useLiveQuery(async () => (await getEvent(id)) ?? null, [id]);
}

export function EventScreen({ eventId }: { eventId: string }) {
  const event = useEventOrNull(eventId);
  const items = useItems(eventId);
  const appearances = useAppearances(eventId);
  const sabha = useSabha(event?.sabhaId ?? null);
  const notes = useLoggingNotes();
  const receipts = useReceipts(eventId);
  const now = useNow();
  const [, navigate] = useLocation();
  const [order, setOrder] = useState<Order>(null);
  const [factsOpen, setFactsOpen] = useState(false);
  const [sabhaOpen, setSabhaOpen] = useState(false);
  const [artistOpen, setArtistOpen] = useState(false);
  const [rolesFor, setRolesFor] = useState<string | null>(null);
  const [coloursFor, setColoursFor] = useState<string | null>(null);
  const [appearanceFor, setAppearanceFor] = useState<string | null>(null);
  const head = useFocusOnOpen<HTMLHeadingElement>(eventId);
  const rows = useRef(new Map<string, HTMLElement>());
  const runningHead = useRef<HTMLHeadingElement>(null);
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
    (target ?? (pending.list === 'items' ? runningHead : stageHead).current)?.focus();
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
  const firstArtist = appearances[0]?.artist?.name ?? null;
  const target = (field: string) => ({ table: 'events' as const, id: eventId, field });
  const editing = (id: string) => appearances.find((a) => a.id === id) ?? null;

  const removeItemAt = async (item: Item, index: number) => {
    const deleted = await removeItem(item.id);
    if (deleted) offerUndo(deleted.receipt);
    setFocusAfter({ list: 'items', index });
  };

  const removeFromStage = async (appearance: Appearance) => {
    const index = appearances.findIndex((a) => a.id === appearance.id);
    setAppearanceFor(null);
    const removed = await removeAppearance(appearance.id);
    if (removed) offerUndo(removed.receipt);
    setFocusAfter({ list: 'stage', index });
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
              <DropdownMenuItem onSelect={() => void exportSeason()}>Export</DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  void deleteEvent(eventId).then((deleted) => {
                    if (deleted) offerUndo(deleted.receipt);
                    navigate('/');
                  })
                }
              >
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

      {/* The concert, as the first block (design D5). */}
      <section className="pt-2 pb-6">
        <h1 ref={head} tabIndex={-1} className="text-title font-semibold break-words">
          {sabha ? (
            <button type="button" className="text-left" onClick={() => setFactsOpen(true)}>
              {sabha.name}
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl text-left"
              onClick={() => setSabhaOpen(true)}
            >
              <IconPlus aria-hidden className="size-5" />
              Add Sabha
            </button>
          )}
        </h1>
        <Saved target={[target('date'), target('startTime'), target('sabhaId')]}>
          <button
            type="button"
            onClick={() => setFactsOpen(true)}
            className="min-h-12 py-1 text-left text-sub text-muted-foreground"
          >
            {eventLine(event, firstArtist)}
          </button>
        </Saved>
      </section>

      {items.length > 0 && (
        <section aria-labelledby="running-order" className="pb-6">
          <SectionHead
            id="running-order"
            headRef={runningHead}
            action={
              items.length >= 2 &&
              order === null && (
                <QuietButton onClick={() => setOrder('items')}>Edit order</QuietButton>
              )
            }
          >
            Running order
          </SectionHead>
          <ol className="border-t border-border">
            {items.map((item, index) => (
              <li key={item.id} className="border-b border-border">
                <Saved target={{ table: 'items', id: item.id, field: '*' }}>
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
                        onMove={(by) => void moveItem(item.id, index + by)}
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
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => void endLogging(eventId)}
              >
                Done with this Concert
              </Button>
            ) : (
              <Summary eventId={eventId} items={items} />
            ))}
        </section>
      )}

      <section aria-labelledby="stage" className="pb-6">
        <SectionHead
          id="stage"
          headRef={stageHead}
          action={
            appearances.length >= 2 &&
            order === null && (
              <QuietButton onClick={() => setOrder('stage')}>Edit order</QuietButton>
            )
          }
        >
          Stage
        </SectionHead>
        <ul className="border-t border-border">
          {appearances.map((appearance, index) => (
            <li key={appearance.id} className="border-b border-border">
              <Saved
                target={[
                  { table: 'appearances', id: appearance.id, field: '*' },
                  { table: 'appearances', id: appearance.id, field: 'role' },
                  { table: 'appearances', id: appearance.id, field: 'colours' },
                ]}
              >
                <div className="flex flex-wrap items-center justify-end gap-x-1">
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) rows.current.set(appearance.id, node);
                      else rows.current.delete(appearance.id);
                    }}
                    disabled={order === 'stage'}
                    onClick={() => setAppearanceFor(appearance.id)}
                    className="flex min-h-[60px] min-w-[min(100%,calc(9*var(--text-body)))] flex-1 flex-col items-stretch justify-center py-2 text-left"
                  >
                    <span className="break-words">{appearance.artist?.name ?? '?'}</span>
                    {appearance.role && (
                      <span className="text-sub text-muted-foreground">
                        {ROLE_NAMES[appearance.role]}
                      </span>
                    )}
                  </button>
                  {order === 'stage' ? (
                    <MoveButtons
                      name={appearance.artist?.name ?? 'Artist'}
                      first={index === 0}
                      last={index === appearances.length - 1}
                      onMove={(by) => void moveAppearance(appearance.id, index + by)}
                    />
                  ) : (
                    <ColoursButton
                      appearance={appearance}
                      onOpen={() => setColoursFor(appearance.id)}
                    />
                  )}
                </div>
              </Saved>
            </li>
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

      <NoteField eventId={eventId} stored={event.note} />

      <BottomDock>
        <UndoBar />
        <div className="border-t border-border bg-background px-4 py-2">
          {order !== null ? (
            <Button size="lg" className="w-full" onClick={() => setOrder(null)}>
              Done
            </Button>
          ) : event.status === 'planned' ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() =>
                void saveWith(target('status'), 'attended', () => setStatus(eventId, 'attended'))
              }
            >
              Start logging
            </Button>
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

      <EventFacts
        open={factsOpen}
        onOpenChange={setFactsOpen}
        date={event.date}
        startTime={event.startTime}
        sabhaName={sabha?.name ?? null}
        onSabha={() => {
          setFactsOpen(false);
          setSabhaOpen(true);
        }}
        onChange={(changes) => {
          const [field] = Object.keys(changes);
          void saveWith(target(field!), Object.values(changes)[0], () =>
            editEvent(eventId, changes),
          );
        }}
      />

      <NamePicker
        kind="sabha"
        open={sabhaOpen}
        onOpenChange={setSabhaOpen}
        onPick={(entry) => {
          setSabhaOpen(false);
          void saveWith(target('sabhaId'), entry.name, () =>
            editEvent(eventId, { sabhaId: entry.id }),
          );
        }}
      />

      <NamePicker
        kind="artist"
        open={artistOpen}
        onOpenChange={(open) => {
          setArtistOpen(open);
          if (!open) setRolesFor(null);
        }}
        onPick={(entry) =>
          void saveWith(
            { table: 'appearances', id: `new:${eventId}`, field: '*' },
            entry.name,
            () => addAppearance(eventId, entry.id),
          ).then((appearance) => appearance && setRolesFor(appearance.id))
        }
        after={
          rolesFor && (
            <RoleChips
              onRole={(role) => {
                const id = rolesFor;
                setRolesFor(null);
                setArtistOpen(false);
                if (role) void saveRole(id, role);
              }}
            />
          )
        }
      />

      {coloursFor && editing(coloursFor) && (
        <ColourPicker
          open
          onOpenChange={(open) => !open && setColoursFor(null)}
          artistName={editing(coloursFor)!.artist?.name ?? 'Artist'}
          primary={editing(coloursFor)!.colourPrimary}
          secondary={editing(coloursFor)!.colourSecondary}
          onChange={(colours) =>
            void saveWith({ table: 'appearances', id: coloursFor, field: 'colours' }, colours, () =>
              editAppearance(coloursFor, colours),
            )
          }
        />
      )}

      {appearanceFor && editing(appearanceFor) && (
        <SheetFrame
          open
          onOpenChange={(open) => !open && setAppearanceFor(null)}
          title={editing(appearanceFor)!.artist?.name ?? 'Artist'}
        >
          <div className="flex flex-col gap-4">
            <RoleChips
              onRole={(role) => {
                const id = appearanceFor;
                setAppearanceFor(null);
                void saveRole(id, role);
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                const id = appearanceFor;
                setAppearanceFor(null);
                setColoursFor(id);
              }}
            >
              Colours
            </Button>
            <Button
              variant="destructive"
              onClick={() => void removeFromStage(editing(appearanceFor)!)}
            >
              Remove from Stage
            </Button>
          </div>
        </SheetFrame>
      )}
    </>
  );
}

function saveRole(appearanceId: string, role: Role | null) {
  return saveWith({ table: 'appearances', id: appearanceId, field: 'role' }, role, () =>
    editAppearance(appearanceId, { role }),
  );
}

/** A running-order row's text: number, title, then Raga · Composer. */
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
  const added = useWhatItAdded(eventId);
  const ragas = new Set(items.flatMap((item) => item.ragas.map((raga) => raga.key ?? raga.text)));
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 dark:border-transparent">
      <p className="font-semibold">
        {itemCount(items.length)} · {ragas.size} {ragas.size === 1 ? 'Raga' : 'Ragas'}
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

/** The note, last on the screen, saved when the rasika pauses or leaves the field. */
function NoteField({ eventId, stored }: { eventId: string; stored: string | null }) {
  const [text, setText] = useState(stored ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const target = { table: 'events' as const, id: eventId, field: 'note' };
  const commit = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    if ((stored ?? '') === value) return;
    void saveWith(target, value, () => editEvent(eventId, { note: value === '' ? null : value }));
  };
  return (
    <section aria-labelledby="note" className="pb-6">
      <SectionHead id="note">Note</SectionHead>
      <Saved target={target}>
        <textarea
          aria-labelledby="note"
          value={text}
          rows={3}
          onChange={(e) => {
            setText(e.target.value);
            if (timer.current) clearTimeout(timer.current);
            const value = e.target.value;
            timer.current = setTimeout(() => commit(value), 800);
          }}
          onBlur={() => commit(text)}
          className={cn('w-full rounded-xl bg-secondary p-3 text-body')}
        />
      </Saved>
    </section>
  );
}
