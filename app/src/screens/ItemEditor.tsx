// The Item editor (T044; DESIGN.md "Item editor (DD4)", design D7, D12, D13, D25;
// docs/design/item-editor.md). A new Item opens on its search box, focused and docked at the
// bottom; the Item exists from its first pick (a song, a Raga, a special form, "? Don't know" or
// "Use what I typed"), and typed text that was not picked survives the phone locking. After a
// pick, the Details sit on one panel with no lines inside, each a 68px label-over-value cell,
// the Raga line full width; Manodharma follows as a fold of List rows with a check, then the
// Layavinyasam on its own one-row panel. A Raga's order and removal are in its sheet. Each change
// saves at once, and every removal offers Undo; the bottom bar holds "Next Item →" and, filled
// at the right, "Done", which goes back to the Concert (P1).

import { IconArrowRight, IconDots } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { cn } from '@/lib/utils';
import { formName, suggestedDetails, type Suggested } from '../catalog/details';
import type { SearchResult } from '../catalog/search';
import { currentCatalog, readyCatalog, useCatalog } from '../catalog/use-catalog';
import {
  newId,
  settlePartRagas,
  unknownValue,
  type DetailValue,
  type ImprovisedKind,
  type Item,
} from '../model';
import {
  addItemFrom,
  describePick,
  discardItemDraft,
  readItemDraft,
  repickItem,
  saveItemDraft,
  setDetail,
  removePartRagas,
  removePiece,
  setImprovised,
  setLayaNadais,
  setLayaNote,
  setRagas,
  type DetailField as ItemField,
  type ItemPick,
  type SpecialForm,
} from '../store/items';
import { getEvent, listItems, useItem, useSabha } from '../store/queries';
import { DetailInput, NadaiChips, type DetailField } from './components/DetailInput';
import { Chip, DockedSearch, FixedRow, type SearchRow } from './components/DockedSearch';
import { useAutosave } from './components/autosave';
import { NotSavedLine, saveWith, Saved, useSaveFeedback } from './components/feedback';
import { Fold } from './components/fold';
import {
  LayavinyasamRow,
  LayavinyasamSheet,
  ManodharmaRows,
  PartSheet,
} from './components/manodharma';
import { hintShown, markHintShown, talaNadaiName } from './item-words';
import { AddButton, MoveLine, ValueButton, ValueNotes, ValueText } from './components/values';
import { BarHold, BottomDock, Panel, Screen, TopBar, useFocusOnOpen } from './components/layout';
import { SheetFrame, useLingering } from './components/sheet-frame';
import { deleteItem } from './deletes';
import { isRtp } from '../store/rules';
import { offerUndo, onUndone } from './undo';
import { WriteGate } from './write-gate';
import { detailText, ragasText, spokenDetail, talaText } from './format';
import { MESSAGES } from './messages';

/** The Event's name for the back chevron: its Sabha, or "Concert" until it has one. */
function useBack(eventId: string) {
  const event = useLiveQuery(() => getEvent(eventId), [eventId]);
  const sabha = useSabha(event?.sabhaId ?? null);
  return { href: `/event/${eventId}`, label: sabha?.name ?? 'Concert' };
}

export function ItemEditor({ eventId, itemId }: { eventId: string; itemId: string }) {
  return (
    <Screen>
      {itemId === 'new' ? (
        <NewItem key={eventId} eventId={eventId} />
      ) : (
        <EditItem key={itemId} eventId={eventId} itemId={itemId} />
      )}
    </Screen>
  );
}

/** One search result as a row: "Raga · Composer · Tala" under a song, a badge on a Raga. */
function resultRow(result: SearchResult, onPick: (pick: ItemPick) => void): SearchRow {
  if (result.kind === 'raga') {
    return {
      key: `raga:${result.raga.key}`,
      title: result.raga.display,
      // The badge says enough; one line, so a list of Ragas stays short.
      badge: 'Raga',
      onPick: () => onPick({ kind: 'raga', raga: result.raga }),
    };
  }
  const { song } = result;
  const raga = song.raga?.display ?? (song.ragamalika.length > 0 ? 'Ragamalika' : null);
  return {
    key: `song:${song.kritiId}`,
    title: song.title,
    line: [raga, song.composer?.display, song.tala?.display].filter(Boolean).join(' · '),
    onPick: () => onPick({ kind: 'song', song }),
  };
}

const SPECIAL: { form: SpecialForm; label: string }[] = [
  { form: 'rtp', label: 'RTP' },
  { form: 'viruttam', label: 'Viruttam / Slokam' },
  { form: 'medley', label: 'Medley' },
];

/** The search over songs and Ragas, with its fixed rows (design D7, D13). */
function ItemSearch({
  query,
  onQuery,
  onPick,
  autoFocus,
  on = 'page',
}: {
  query: string;
  onQuery(query: string): void;
  onPick(pick: ItemPick): void;
  autoFocus?: boolean;
  /** The new Item's page, or the Composition sheet. */
  on?: 'page' | 'sheet';
}) {
  const catalog = useCatalog();
  const typed = query.trim();
  // The search runs once per keystroke, not per render; turning its results into rows is cheap.
  const found = useMemo(
    () => (catalog.status === 'ready' && typed ? catalog.index.search(typed, 12) : []),
    [catalog, typed],
  );
  const results = found.map((result) => resultRow(result, onPick));
  return (
    <DockedSearch
      label="Search songs and Ragas"
      placeholder="Song or Raga…"
      query={query}
      onQueryChange={onQuery}
      autoFocus={autoFocus}
      on={on}
      note={catalog.status === 'missing' ? MESSAGES.search.noCatalog : null}
      noMatch={catalog.status === 'ready'}
      onSubmit={() =>
        results[0] ? results[0].onPick() : typed && onPick({ kind: 'typed', text: typed })
      }
      pinned={
        <>
          {/* One row, scrolling sideways when the chips don't fit (large text, a narrow phone,
              Android's text zoom), so the results keep their room. The padding, taken back by
              the margin, keeps the focus rings inside the scrolling box. The hairline under them
              sits the chips' own 8px gap below them (walkthrough P5). Their outlines on the 8px
              edge, their words on the 24px column (the Maintainer, 2026-11-20). */}
          <div className="-mx-5 -mt-1 mb-1 flex gap-2 overflow-x-auto overscroll-x-contain p-1">
            {SPECIAL.map(({ form, label }) => (
              <Chip
                key={form}
                className="shrink-0 whitespace-nowrap"
                onClick={() => onPick({ kind: 'form', form })}
              >
                {label}
              </Chip>
            ))}
          </div>
          <FixedRow onClick={() => onPick({ kind: 'unknown' })}>? Don’t know</FixedRow>
        </>
      }
      typedRow={
        typed && (
          <FixedRow onClick={() => onPick({ kind: 'typed', text: typed })}>
            Use what I typed: “{typed}”
          </FixedRow>
        )
      }
      results={results}
    />
  );
}

/** What a pick is called while it is saving or not saved. */
const pickLabel = (pick: ItemPick) =>
  pick.kind === 'song'
    ? pick.song.title
    : pick.kind === 'raga'
      ? pick.raga.display
      : pick.kind === 'form'
        ? pick.form
        : pick.kind === 'typed'
          ? pick.text
          : '?';

function NewItem({ eventId }: { eventId: string }) {
  const back = useBack(eventId);
  const [, navigate] = useLocation();
  const inset = useKeyboardInset();
  const number = useLiveQuery(async () => (await listItems(eventId)).length + 1, [eventId]);
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  const feedback = useSaveFeedback();

  // Restore what was typed before the phone locked or the app was closed (design D12). A store
  // that can't be read still gives a search box: the draft is only a convenience.
  useEffect(() => {
    let live = true;
    void readItemDraft(eventId)
      .catch(() => null)
      .then((stored) => {
        if (live) {
          setDraft(stored ? { id: stored.id, text: stored.text } : { id: newId(), text: '' });
        }
      });
    return () => {
      live = false;
    };
  }, [eventId]);

  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  // What is typed is journalled at once, like a note, and stored as the draft when the page is
  // hidden; the journal lets it go once the draft (or the Item) is stored.
  const draftTarget = (id: string) => ({ table: 'items' as const, id, field: 'draft' });
  const type = (text: string) => {
    if (!draft) return;
    setDraft({ ...draft, text });
    if (text.trim()) feedback.hold(draftTarget(draft.id), { eventId, text });
    else feedback.release(draftTarget(draft.id));
  };
  useEffect(() => {
    const keep = () => {
      const current = latest.current;
      if (document.visibilityState === 'hidden' && current && current.text.trim()) {
        const typed = { id: current.id, eventId, text: current.text };
        void saveWith(draftTarget(current.id), { eventId, text: current.text }, () =>
          saveItemDraft(typed),
        );
      }
    };
    document.addEventListener('visibilitychange', keep);
    window.addEventListener('pagehide', keep);
    return () => {
      document.removeEventListener('visibilitychange', keep);
      window.removeEventListener('pagehide', keep);
    };
  }, [eventId]);

  // The editor moves on whenever the Item exists, whether the first pick or its Try again made
  // it, so a consumed draft id is never picked again. An id a deleted Item (or another Event's)
  // holds can't be used: the editor takes a new one, keeping what was typed.
  const created = useItem(draft?.id ?? null, { withDeleted: true });
  // Until the query answers for a new id, it still holds the last id's Item.
  const current = created?.id === draft?.id ? created : null;
  const ready = current?.deletedAt === null && current.eventId === eventId;
  const taken = current != null && !ready;
  useEffect(() => {
    if (ready) navigate(`/event/${eventId}/item/${current.id}`, { replace: true });
  }, [ready, current, eventId, navigate]);
  if (taken && draft) setDraft({ ...draft, id: newId() });

  // One first pick at a time: a second tap while one is written would make the same Item with
  // another pick, and only one of the two could be kept.
  const picking = useRef(false);
  const pick = async (choice: ItemPick) => {
    if (!draft || picking.current) return;
    picking.current = true;
    const id = draft.id;
    // From here a page-hide never writes the draft back (the store refuses it too); the pick's
    // own entry holds what was chosen.
    latest.current = null;
    feedback.drop(draftTarget(id));
    try {
      await saveWith(
        { table: 'items', id, field: '*' },
        { eventId, pick: describePick(choice), label: pickLabel(choice) },
        () => addItemFrom(eventId, choice, { id }),
      );
    } finally {
      picking.current = false;
    }
  };

  if (!draft) return null;
  const failed = feedback.get({ table: 'items', id: draft.id, field: '*' });
  const failedLabel =
    failed && failed.status !== 'saved' ? (failed.value as { label?: string }).label : undefined;
  return (
    // As tall as the screen above the keyboard: the page's 24px of scroll room is taken back.
    <div
      className="-mb-6 flex flex-col pb-2"
      style={{
        height: `calc(var(--app-height) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - ${inset}px)`,
      }}
    >
      {/* Backing out discards what was typed (design D12). */}
      <TopBar
        back={back}
        onBack={() => {
          feedback.drop(draftTarget(draft.id));
          void discardItemDraft(eventId);
        }}
      />
      {/* The page's title, 8px under the bar, 24px over what follows (foundations). */}
      <h1 className="pt-2 pb-6 text-heading font-bold">
        Item {number ?? ''}
        {failedLabel !== undefined && ` · ${failedLabel}`}
      </h1>
      {failed?.status === 'failed' && (
        <NotSavedLine targets={[{ table: 'items', id: draft.id, field: '*' }]} />
      )}
      <ItemSearch
        query={draft.text}
        onQuery={type}
        onPick={(choice) => void pick(choice)}
        autoFocus
      />
    </div>
  );
}

type Open =
  | { kind: 'detail'; field: ItemField }
  | { kind: 'raga'; index: number }
  | { kind: 'part'; part: ImprovisedKind }
  | { kind: 'laya' }
  /** The Nadai's own sheet, from the Layavinyasam's "Other…". */
  | { kind: 'layaOther' }
  | { kind: 'composition' }
  | null;

const FIELD_NAMES: Record<ItemField, string> = {
  form: 'Form',
  tala: 'Tala',
  nadai: 'Nadai',
  composer: 'Composer',
  language: 'Language',
  subject: 'Subject',
};

function EditItem({ eventId, itemId }: { eventId: string; itemId: string }) {
  const item = useItem(itemId);
  const back = useBack(eventId);
  const catalogState = useCatalog();
  const catalog = catalogState.status === 'ready' ? catalogState.catalog : null;
  const [open, setOpen] = useState<Open>(null);
  // The sheet last opened, kept while it slides closed.
  const [sheet, sheetOpen] = useLingering(open);
  const [query, setQuery] = useState('');
  // Open when the Item opens with any part; a tap decides from then on, so turning the last part
  // off never folds it away under the finger.
  const [foldOpen, setFoldOpen] = useState<boolean | null>(null);
  const layaNoteField = useRef<HTMLTextAreaElement>(null);
  // The Layavinyasam's selected nadai, kept while its "Other…" sheet is open.
  const [layaSelected, setLayaSelected] = useState<number | 'add'>(0);
  // The one-time hint, on the first part ever turned on on this phone (§4): it stays until a
  // part's sheet opens or the Item is left.
  const [hint, setHint] = useState<ImprovisedKind | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // A Raga put back by Undo, or the one that took a removed Raga's place (the "+" if the last
  // went), takes focus once drawn (§3).
  const pendingRaga = useRef<number | null>(null);
  const head = useFocusOnOpen<HTMLHeadingElement>(itemId);
  const feedback = useSaveFeedback();
  // Details set while a repick is written are written after it (screens/write-gate.ts).
  const [gate] = useState(() => new WriteGate());

  useEffect(
    () =>
      onUndone((receipt) => {
        const piece = receipt.piece;
        if (receipt.records[0]?.id === itemId && piece?.field === 'ragas') {
          pendingRaga.current = piece.index;
        }
      }),
    [itemId],
  );

  if (item === undefined) return <BarHold />;
  if (item === null) {
    return (
      <>
        <TopBar back={back} />
        <p className="py-6 text-body text-muted-foreground">This Item is not on this phone.</p>
      </>
    );
  }

  const song = item.compositionKey ? catalog?.songByKritiId.get(item.compositionKey) : undefined;
  const suggested: Partial<Suggested> = song ? suggestedDetails(song) : {};
  const target = (field: string) => ({ table: 'items' as const, id: item.id, field });
  // A value waiting to save, or not saved, is shown as entered (design D15).
  const shown = <T,>(field: string, stored: T): T => feedback.shown(target(field), stored);
  const ragas = shown('ragas', item.ragas);
  const announce = (text: string) => setAnnouncement(text);
  const takeFocus = (place: number | 'add') => (element: HTMLButtonElement | null) => {
    const pending = pendingRaga.current;
    if (!element || pending === null) return;
    if ((pending < ragas.length ? pending : 'add') !== place) return;
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    pendingRaga.current = null;
    element.focus({ preventScroll: true });
  };

  const save = (field: ItemField, value: DetailValue) =>
    void saveWith(
      target(field),
      value,
      gate.after(() =>
        setDetail(item.id, field, value, { catalog: currentCatalog() ?? undefined }),
      ),
    );
  const saveRagas = (next: DetailValue[]) =>
    void saveWith(
      target('ragas'),
      next,
      gate.after(() => setRagas(item.id, next, { catalog: currentCatalog() ?? undefined })),
    );
  const removeRaga = (index: number) => {
    const value = ragas[index];
    if (!value) return;
    setOpen(null);
    pendingRaga.current = index;
    void saveWith(
      target('ragas'),
      ragas.filter((_, i) => i !== index),
      gate.after(async () => {
        const removed = await removePiece(item.id, { field: 'ragas', index, value });
        if (removed) offerUndo(removed.receipt);
        return removed;
      }),
    );
  };

  const improvised = shown('improvised', item.improvised);
  const saveImprovised = (next: Item['improvised']) =>
    void saveWith(
      target('improvised'),
      next,
      gate.after(() => setImprovised(item.id, next)),
    );
  const setPart = (kind: ImprovisedKind, partRagas: (DetailValue | null)[]) =>
    saveImprovised(
      improvised.map((part) =>
        part.kind === kind ? { ...part, ragas: settlePartRagas(partRagas) } : part,
      ),
    );
  // A part turned off, or its own Ragas removed, offers Undo, Ragas and all (§4).
  const turnOffPart = (kind: ImprovisedKind) =>
    void saveWith(
      target('improvised'),
      improvised.filter((part) => part.kind !== kind),
      gate.after(async () => {
        const removed = await removePiece(item.id, { field: 'improvised', kind });
        if (removed) offerUndo(removed.receipt);
        return removed;
      }),
    );
  const removePartRaga = (kind: ImprovisedKind, slot: number | 'all') => {
    const part = improvised.find((heard) => heard.kind === kind);
    if (!part) return;
    setOpen(null);
    void saveWith(
      target('improvised'),
      improvised.map((heard) =>
        heard === part
          ? {
              ...heard,
              ragas:
                slot === 'all' ? [] : settlePartRagas(heard.ragas.filter((_, i) => i !== slot)),
            }
          : heard,
      ),
      gate.after(async () => {
        const removed = await removePartRagas(
          item.id,
          kind,
          slot === 'all' ? 'all' : { index: slot, value: part.ragas[slot] ?? null },
        );
        if (removed) offerUndo(removed.receipt);
        return removed;
      }),
    );
  };
  const turnOnPart = (kind: ImprovisedKind) => {
    if (!hintShown()) {
      markHintShown();
      setHint(kind);
    }
    saveImprovised([...improvised, { kind, ragas: [] }]);
  };
  const openPart = (kind: ImprovisedKind) => {
    setHint(null);
    setOpen({ kind: 'part', part: kind });
  };

  // The Layavinyasam is whether there is one, with its nadais; its note has its own target and
  // write, so typing the note never rebuilds the nadais from a value not yet saved.
  const laya = shown<{ nadais: DetailValue[] } | null>('layaVinyasam', item.layaVinyasam);
  const layaNote = shown('layaNote', item.layaVinyasam?.note ?? null);
  const nadais = laya?.nadais ?? [];
  const saveNadais = (next: DetailValue[]) =>
    void saveWith(
      target('layaVinyasam'),
      { nadais: next },
      gate.after(() => setLayaNadais(item.id, next)),
    );
  const removeNadai = (index: number) => {
    const value = nadais[index];
    if (!value) return;
    setLayaSelected(Math.max(0, Math.min(index, nadais.length - 2)));
    void saveWith(
      target('layaVinyasam'),
      { nadais: nadais.filter((_, i) => i !== index) },
      gate.after(async () => {
        const removed = await removePiece(item.id, { field: 'nadais', index, value });
        if (removed) offerUndo(removed.receipt);
        return removed;
      }),
    );
  };
  const removeLaya = () =>
    void saveWith(
      target('layaVinyasam'),
      null,
      gate.after(async () => {
        const removed = await removePiece(item.id, { field: 'layaVinyasam' });
        if (removed) offerUndo(removed.receipt);
        return removed;
      }),
    );
  const tala = shown('tala', item.tala);
  const nadai = shown('nadai', item.nadai);
  const talaNadai = talaNadaiName(tala, nadai);
  const talaNadaiKey =
    talaNadai === null ? null : nadai.state === 'na' ? 'chatusra' : (nadai.key ?? null);

  // One write: the pick, the Details it clears and the logging note (store/items.ts repickItem).
  // It waits for the catalog (for a while at most), so a Guess is never taken for the old song's
  // value; a Detail set meanwhile is written after it, so the repick never clears it. A failed
  // repick is never retried ("Not changed"): the rasika picks again; the pick is journalled for
  // Export.
  const repick = (choice: ItemPick) => {
    setOpen(null);
    setQuery('');
    gate.hold(
      saveWith(
        target('pick'),
        { eventId, pick: describePick(choice), label: pickLabel(choice) },
        async () => repickItem(item.id, choice, { catalog: (await readyCatalog()) ?? undefined }),
        { kind: 'repick' },
      ),
    );
  };

  // A pick being written shows at once; a failed one didn't happen, so the title stays.
  // It shows until the Item read back holds the pick (store/journal-check.ts storedHolds).
  const pickShown =
    feedback.get(target('pick'))?.status === 'failed' ? item : shown<unknown>('pick', item);
  const picking = pickShown === item ? null : (pickShown as { label: string });
  const title = picking?.label || item.title || ragasText(ragas) || '?';
  // Weight and contrast say how much a value matters (walkthrough P2): the Composition bold,
  // Raga and Tala in full contrast, the rest muted.
  const cell = (field: ItemField, value: DetailValue, text?: string) => (
    <DetailCell
      key={field}
      name={FIELD_NAMES[field]}
      value={shown(field, value)}
      text={text}
      muted={field !== 'tala'}
      suggested={suggested[field as keyof Suggested] as DetailValue | undefined}
      // The Tala cell shows the Nadai too, so it carries the Nadai's feedback.
      target={field === 'tala' ? [target('tala'), target('nadai')] : [target(field)]}
      onOpen={() => setOpen({ kind: 'detail', field })}
    />
  );
  const manodharmaOpen = foldOpen ?? improvised.length > 0;
  if (foldOpen === null) setFoldOpen(manodharmaOpen);
  const form = shown('form', item.form);
  const itemRaga = ragas[0] ?? null;
  const rtp = isRtp({ form });
  const openPartKind = sheet?.kind === 'part' ? sheet.part : null;
  const openPartValue = improvised.find((part) => part.kind === openPartKind);

  return (
    <>
      <TopBar
        back={back}
        right={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Item actions">
                <IconDots aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                // A failed delete stays here, with "Not deleted" under the title.
                onSelect={() => void deleteItem(item)}
              >
                Delete Item
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <Saved target={[target('*'), target('pick'), target('deletedAt')]}>
        <h1
          ref={head}
          tabIndex={-1}
          // The block 8px under the bar, its title in heading 700 (foundations, 2026-11-16).
          className="flex flex-col items-start pt-2 pb-4 text-heading font-bold break-words"
        >
          {/* The Item's number is an eyebrow over its title (walkthrough S10). */}
          <span className="-mb-2 text-caption font-normal text-muted-foreground">
            Item {item.position}
          </span>
          <button
            type="button"
            aria-label={`Composition, ${title}, change`}
            onClick={() => setOpen({ kind: 'composition' })}
            className="min-h-12 rounded-xl text-left underline decoration-border underline-offset-4"
          >
            {title}
          </button>
        </h1>
      </Saved>

      {/* The Details on one panel, with no lines inside (§2): the Raga line full width, then
          Tala | Composer, Language | Subject, and Form, each a 68px label-over-value cell. */}
      {/* Under the title block, as the signed-off mock places it (§2, §6). */}
      <Panel as="div">
        <Saved target={target('ragas')} className="-mx-2 px-2 py-3">
          <span className="block text-sub text-muted-foreground">
            {ragas.length > 1 ? 'Ragas' : 'Raga'}
          </span>
          {/* Each Raga is its own 48px target and a comma stays with its Raga; wrapped lines
              step 48px, so every target is whole and none overlap (§3). */}
          <div role="list" aria-label="Ragas, in order" className="-my-3 flex flex-wrap">
            {ragas.map((raga, index) => (
              <span role="listitem" key={index} className="flex items-center">
                <ValueButton
                  ref={takeFocus(index)}
                  aria-label={`${detailText(raga) || 'Raga'}, Raga ${index + 1} of ${ragas.length}${raga.guess ? ', guess' : ''}`}
                  onClick={() => setOpen({ kind: 'raga', index })}
                  className="min-w-0 no-underline"
                >
                  <span className="underline decoration-border underline-offset-4">
                    <ValueText value={raga} />
                  </span>
                  {index < ragas.length - 1 && (
                    <span aria-hidden className="text-muted-foreground">
                      ,
                    </span>
                  )}
                </ValueButton>
                {index < ragas.length - 1 && <span aria-hidden className="w-2" />}
              </span>
            ))}
            {ragas.length === 0 && (
              <ValueButton
                ref={takeFocus(0)}
                aria-label="Raga, unknown"
                onClick={() => setOpen({ kind: 'raga', index: 0 })}
              >
                ?
              </ValueButton>
            )}
            {ragas.length > 0 && (
              <AddButton
                ref={takeFocus('add')}
                label="Add Raga"
                // Its ink 8px after the word, as a comma's 8px.
                className="-ml-1.5"
                onClick={() => setOpen({ kind: 'raga', index: ragas.length })}
              />
            )}
          </div>
          <ValueNotes value={ragas[0] ?? unknownValue()} suggested={suggested.ragas?.[0]} />
        </Saved>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(max(calc(8*var(--text-body)),calc(50%-8px)),1fr))] gap-x-4">
          {cell('tala', item.tala, talaText({ tala, nadai }))}
          {cell('composer', item.composer)}
          {cell('language', item.language)}
          {cell('subject', item.subject)}
          {cell('form', item.form, formText(form))}
        </div>
      </Panel>

      {/* Manodharma: one fold of List rows with a check (§4). A part's own state shows its save,
          so none of it plays the highlight (P7). A label over its panel, 32px under the panel
          above (foundations, 2026-11-16). */}
      <Fold
        title="Manodharma"
        open={manodharmaOpen}
        onOpenChange={setFoldOpen}
        line={false}
        className="mt-4"
      >
        <Saved target={target('improvised')} quiet>
          <Panel>
            <ManodharmaRows
              parts={improvised}
              itemRaga={itemRaga}
              rtp={rtp}
              hint={hint}
              onTurnOn={turnOnPart}
              onTurnOff={turnOffPart}
              onOpen={openPart}
            />
          </Panel>
        </Saved>
      </Fold>

      {/* The Layavinyasam: its own one-row panel, 32px under Manodharma, always shown (§5). */}
      <Saved target={[target('layaVinyasam'), target('layaNote')]} quiet className="mt-4">
        <Panel>
          <LayavinyasamRow
            on={laya !== null}
            nadais={nadais}
            talaNadai={talaNadai}
            noteTyped={!!layaNote}
            onTurnOn={() => saveNadais([])}
            onTurnOff={removeLaya}
            onNote={() => {
              // The decided rule (2026-11-05): with a note typed, the tap goes to the note, its
              // text selected, to clear it first.
              layaNoteField.current?.focus();
              layaNoteField.current?.select();
            }}
            onOpen={() => {
              setLayaSelected(0);
              setOpen({ kind: 'laya' });
            }}
            note={
              <LayaNote
                fieldRef={layaNoteField}
                stored={layaNote}
                onSave={(note) => {
                  // A note still pending when the Layavinyasam is removed goes with it.
                  if (shown('layaVinyasam', item.layaVinyasam) === null) {
                    feedback.release(target('layaNote'));
                    return;
                  }
                  void saveWith(
                    target('layaNote'),
                    note,
                    gate.after(() => setLayaNote(item.id, note)),
                  );
                }}
                onPending={(note) =>
                  note === null
                    ? feedback.release(target('layaNote'))
                    : feedback.hold(target('layaNote'), note)
                }
              />
            }
          />
        </Panel>
      </Saved>

      <BottomDock>
        <div className="flex flex-wrap gap-2">
          {/* Done is the main action, filled, at the right (walkthrough S9). */}
          <Button size="lg" variant="outline" className="min-w-32 flex-1" asChild>
            <Link href={`/event/${eventId}/item/new`} replace>
              Next Item
              <IconArrowRight aria-hidden />
            </Link>
          </Button>
          <Button size="lg" className="min-w-32 flex-1" asChild>
            <Link href={`/event/${eventId}`}>Done</Link>
          </Button>
        </div>
      </BottomDock>

      {sheet?.kind === 'detail' && (
        <DetailInput
          open={sheetOpen}
          onOpenChange={(next) => !next && setOpen(null)}
          field={sheet.field as DetailField}
          title={FIELD_NAMES[sheet.field]}
          value={shown(sheet.field, item[sheet.field])}
          suggested={suggested[sheet.field as keyof Suggested] as DetailValue | undefined}
          onChange={(value) => save(sheet.field, value)}
          extra={
            sheet.field === 'tala' ? (
              // The label sits with the chips it names: 24px above, 8px below.
              <div className="flex flex-col gap-2 pt-3">
                <span className="text-sub text-muted-foreground">Nadai</span>
                <NadaiChips
                  value={nadai}
                  allowUnknown
                  onChange={(value) => save('nadai', value)}
                  onOther={() => setOpen({ kind: 'detail', field: 'nadai' })}
                />
              </div>
            ) : undefined
          }
        />
      )}
      {sheet?.kind === 'raga' && (
        <RagaSheet
          open={sheetOpen}
          onOpenChange={(next) => !next && setOpen(null)}
          ragas={ragas}
          index={sheet.index}
          suggested={suggested.ragas?.[sheet.index]}
          onChange={(value) => {
            const next = [...ragas];
            next[sheet.index] = value;
            saveRagas(next);
          }}
          onMove={(by) => {
            const to = sheet.index + by;
            const moving = ragas[sheet.index]!;
            const next = [...ragas];
            [next[sheet.index], next[to]] = [next[to]!, moving];
            saveRagas(next);
            // The sheet stays open, its title following the Raga (§3).
            setOpen({ kind: 'raga', index: to });
            announce(`${detailText(moving) || 'Raga'}, now Raga ${to + 1} of ${ragas.length}`);
          }}
          onRemove={() => removeRaga(sheet.index)}
        />
      )}
      {sheet?.kind === 'part' && openPartValue && (
        <PartSheet
          open={sheetOpen}
          onOpenChange={(next) => !next && setOpen(null)}
          part={openPartValue}
          itemRaga={itemRaga}
          onSave={(next) => setPart(openPartValue.kind, next)}
          onRemove={(index) => removePartRaga(openPartValue.kind, index)}
          onFollow={() => removePartRaga(openPartValue.kind, 'all')}
          onAnnounce={announce}
        />
      )}
      {sheet?.kind === 'laya' && laya && (
        <LayavinyasamSheet
          open={sheetOpen}
          onOpenChange={(next) => !next && setOpen(null)}
          nadais={nadais}
          talaNadai={talaNadai}
          talaNadaiKey={talaNadaiKey}
          selected={layaSelected}
          onSelect={setLayaSelected}
          onSave={saveNadais}
          onRemove={removeNadai}
          onOther={() => setOpen({ kind: 'layaOther' })}
          onAnnounce={announce}
        />
      )}
      {sheet?.kind === 'layaOther' && laya && (
        <DetailInput
          open={sheetOpen}
          onOpenChange={(next) => !next && setOpen(null)}
          field="nadai"
          title="Nadai"
          value={
            layaSelected === 'add' || nadais.length === 0
              ? unknownValue()
              : (nadais[Math.min(layaSelected, nadais.length - 1)] ?? unknownValue())
          }
          onChange={(value) => {
            if (value.state === 'na') return;
            if (nadais.length === 0) saveNadais([value]);
            else if (layaSelected === 'add') saveNadais([...nadais, value]);
            else {
              const at = Math.min(layaSelected, nadais.length - 1);
              saveNadais(nadais.map((old, index) => (index === at ? value : old)));
            }
          }}
        />
      )}
      {sheet?.kind === 'composition' && (
        <SheetFrame
          open={sheetOpen}
          onOpenChange={(next) => {
            if (next) return;
            setOpen(null);
            setQuery('');
          }}
          title="Composition"
        >
          <ItemSearch query={query} onQuery={setQuery} onPick={repick} on="sheet" />
        </SheetFrame>
      )}
    </>
  );
}

/**
 * A Raga's sheet (§3): "Raga 2", spoken "Raga 2 of 3", then "Now: Kanada", the chips ("?" and
 * "Not sure" with two or more; "N/A" too for a lone Raga), "← Earlier", "Later →" and "Remove"
 * with two or more, and the box. A Raga being added (from the +) has none of the three.
 */
function RagaSheet({
  open,
  onOpenChange,
  ragas,
  index,
  suggested,
  onChange,
  onMove,
  onRemove,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  ragas: DetailValue[];
  index: number;
  suggested?: DetailValue;
  onChange(value: DetailValue): void;
  onMove(by: -1 | 1): void;
  onRemove(): void;
}) {
  const adding = index >= ragas.length;
  const several = ragas.length > 1 || (adding && ragas.length > 0);
  const title = several || index > 0 ? `Raga ${index + 1}` : 'Raga';
  const count = adding ? ragas.length + 1 : ragas.length;
  const value = ragas[index] ?? unknownValue();
  return (
    <DetailInput
      open={open}
      onOpenChange={onOpenChange}
      field="raga"
      title={title}
      spokenTitle={several ? `Raga ${index + 1} of ${count}` : undefined}
      value={value}
      suggested={suggested}
      na={!several}
      onChange={onChange}
      extra={
        !adding && ragas.length > 1 ? (
          <MoveLine
            index={index}
            count={ragas.length}
            name={detailText(value) || 'Raga'}
            onMove={onMove}
            onRemove={onRemove}
          />
        ) : undefined
      }
    />
  );
}

function DetailCell({
  name,
  value,
  text,
  suggested,
  target,
  muted = false,
  onOpen,
}: {
  name: string;
  value: DetailValue;
  text?: string;
  suggested?: DetailValue;
  target: { table: 'items'; id: string; field: string }[] | null;
  /** A value that matters less, shown muted (walkthrough P2). */
  muted?: boolean;
  onOpen(): void;
}) {
  return (
    // Each cell is one target and one spoken element, its full height; across the 16px gap the
    // two targets meet at its middle, so no strip is dead (§2).
    <Saved target={target} className="-mx-2">
      <button
        type="button"
        aria-label={spokenDetail(name, value)}
        onClick={onOpen}
        className="flex min-h-[68px] w-full flex-col items-start rounded-xl px-2 py-3 text-left focus-visible:-outline-offset-2"
      >
        <span className="text-sub text-muted-foreground">{name}</span>
        <span
          className={cn(
            'break-words underline decoration-border underline-offset-4',
            muted && 'text-muted-foreground',
          )}
        >
          <ValueText value={value} text={text} />
        </span>
        <ValueNotes value={value} suggested={suggested} />
      </button>
    </Saved>
  );
}

/** A form as shown, in sentence case (walkthrough P4): "Kriti", stored by the catalog as "kriti". */
function formText(value: DetailValue): string | undefined {
  return value.key !== null && (value.state === 'catalog' || value.state === 'override')
    ? formName(value.key)
    : undefined;
}

/**
 * The Layavinyasam's note, saved as the rasika pauses, leaves the field or the app. Its label
 * sits 8px over it, tied to it; it starts at one line (48px) and grows with its text (§5).
 */
function LayaNote({
  fieldRef,
  stored,
  onSave,
  onPending,
}: {
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  stored: string | null;
  onSave(note: string): void;
  onPending(note: string | null): boolean | void;
}) {
  const note = useAutosave(stored ?? '', onSave, onPending);
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }, [fieldRef, note.text]);
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sub text-muted-foreground">Note</span>
      <textarea
        ref={fieldRef}
        value={note.text}
        rows={1}
        onChange={(e) => note.change(e.target.value)}
        onBlur={note.flush}
        // A fill a step from the panel's, so it reads as a field on it.
        className="min-h-12 w-full resize-none overflow-hidden rounded-fill bg-input px-4 py-3 text-body dark:bg-secondary"
      />
    </label>
  );
}
