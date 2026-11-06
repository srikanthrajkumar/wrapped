// The Item editor (T044; DESIGN.md "Item editor (DD4)", design D7, D12, D13, D25). A new Item
// opens on its search box, focused and docked at the bottom; the Item exists from its first pick
// (a song, a Raga, a special form, "? Don't know" or "Use what I typed"), and typed text that
// was not picked survives the phone locking. After a pick, the Details show as rows of values,
// each a muted label over its value underlined (walkthrough P2), with the improvised parts and
// the Laya vinyasam in one fold underneath (S14). Each change saves at once; the bottom bar holds
// "Next Item →" and, filled at the right, "Done", which goes back to the Concert (P1).

import { IconArrowLeft, IconArrowRight, IconDots, IconPlus } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
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
  IMPROVISED_KINDS,
  newId,
  notApplicableValue,
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
  setImprovised,
  setLayaNadai,
  setLayaNote,
  setLayaVinyasam,
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
  BarHold,
  BottomDock,
  QuietButton,
  Screen,
  TopBar,
  useFocusOnOpen,
} from './components/layout';
import { SheetFrame, useLingering } from './components/sheet-frame';
import { deleteItem } from './deletes';
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
}: {
  query: string;
  onQuery(query: string): void;
  onPick(pick: ItemPick): void;
  autoFocus?: boolean;
}) {
  const catalog = useCatalog();
  const typed = query.trim();
  // The search runs once per keystroke, not per render; turning its results into rows is cheap.
  const found = useMemo(
    () => (catalog.status === 'ready' && typed ? catalog.index.search(typed, 12) : []),
    [catalog, typed],
  );
  const results = found.map((result) => resultRow(result, onPick));
  const note =
    catalog.status === 'missing'
      ? MESSAGES.search.noCatalog
      : typed && catalog.status === 'ready' && results.length === 0
        ? MESSAGES.search.noMatch
        : null;
  return (
    <DockedSearch
      label="Search songs and Ragas"
      placeholder="Song or Raga…"
      query={query}
      onQueryChange={onQuery}
      autoFocus={autoFocus}
      note={note}
      onSubmit={() =>
        results[0] ? results[0].onPick() : typed && onPick({ kind: 'typed', text: typed })
      }
      fixed={
        <>
          {/* One row, scrolling sideways when the chips don't fit (large text, a narrow phone,
              Android's text zoom), so the results keep their room. The padding, taken back by
              the margin, keeps the focus rings inside the scrolling box. The hairline under them
              sits the chips' own 8px gap below them (walkthrough P5). */}
          <div className="-m-1 mb-0 flex gap-2 overflow-x-auto overscroll-x-contain p-1">
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
          {typed && (
            <FixedRow onClick={() => onPick({ kind: 'typed', text: typed })}>
              Use what I typed: “{typed}”
            </FixedRow>
          )}
        </>
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
    <div
      className="flex flex-col pb-2"
      style={{
        height: `calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - ${inset}px)`,
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
      <h1 className="pt-1 pb-2 text-title font-semibold">
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
  | { kind: 'improvised'; heard: ImprovisedKind }
  | { kind: 'laya' }
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

const IMPROVISED_NAMES: Record<ImprovisedKind, string> = {
  alapana: 'Alapana',
  tanam: 'Tanam',
  niraval: 'Niraval',
  kalpana_swaram: 'Kalpana swaram',
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
  // Open when the Item opens with anything in it; a tap decides from then on, so clearing the
  // last chip never folds it away under the finger.
  const [foldOpen, setFoldOpen] = useState<boolean | null>(null);
  const layaNoteField = useRef<HTMLTextAreaElement>(null);
  const [ragaOrder, setRagaOrder] = useState(false);
  const head = useFocusOnOpen<HTMLHeadingElement>(itemId);
  const feedback = useSaveFeedback();
  // Details set while a repick is written are written after it (screens/write-gate.ts).
  const [gate] = useState(() => new WriteGate());

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
  const improvised = shown('improvised', item.improvised);
  const saveImprovised = (next: Item['improvised']) =>
    void saveWith(
      target('improvised'),
      next,
      gate.after(() => setImprovised(item.id, next)),
    );
  // The Laya vinyasam is whether there is one, with its Nadai; its note has its own target and
  // write, so typing the note never rebuilds the Nadai from a value not yet saved.
  const laya = shown<{ nadai: DetailValue } | null>('layaVinyasam', item.layaVinyasam);
  const layaNote = shown('layaNote', item.layaVinyasam?.note ?? null);
  const saveLayaNadai = (nadai: DetailValue) =>
    void saveWith(
      target('layaVinyasam'),
      { nadai },
      gate.after(() => setLayaNadai(item.id, nadai)),
    );
  const removeLaya = () =>
    void saveWith(
      target('layaVinyasam'),
      null,
      gate.after(() => setLayaVinyasam(item.id, null)),
    );

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
  const improvisedOpen = foldOpen ?? (improvised.length > 0 || laya !== null);
  if (foldOpen === null) setFoldOpen(improvisedOpen);
  const form = shown('form', item.form);

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

      <Saved target={[target('*'), target('pick'), target('deletedAt')]}>
        <h1
          ref={head}
          tabIndex={-1}
          className="flex flex-col items-start pt-3 pb-4 text-title font-semibold break-words"
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

      {/* Ragas first, as values in the order sung (design D25), each tapped to change, and a
          muted "+" for another: values, not pills (walkthrough P2, FB-42). */}
      <Saved target={target('ragas')} className="pb-2">
        {/* The label and Edit order share one line; the button's 48px reaches past it. */}
        <div className="flex min-h-4 items-center justify-between">
          <span className="text-caption text-muted-foreground">
            {ragas.length > 1 ? 'Ragas' : 'Raga'}
          </span>
          {ragas.length >= 2 && (
            <QuietButton className="-my-4 -mr-2" onClick={() => setRagaOrder(!ragaOrder)}>
              {ragaOrder ? 'Done' : 'Edit order'}
            </QuietButton>
          )}
        </div>
        <div role="list" aria-label="Ragas, in order" className="flex flex-wrap items-center">
          {ragas.map((raga, index) => (
            <span role="listitem" key={index} className="flex items-center">
              {ragaOrder && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  aria-label={`Move ${detailText(raga) || 'Raga'} earlier`}
                  onClick={() => saveRagas(swap(ragas, index, index - 1))}
                >
                  <IconArrowLeft aria-hidden />
                </Button>
              )}
              <ValueButton
                aria-label={spokenDetail(`Raga ${index + 1}`, raga)}
                onClick={() => setOpen({ kind: 'raga', index })}
              >
                <ValueText value={raga} />
              </ValueButton>
              {ragaOrder ? (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === ragas.length - 1}
                  aria-label={`Move ${detailText(raga) || 'Raga'} later`}
                  onClick={() => saveRagas(swap(ragas, index, index + 1))}
                >
                  <IconArrowRight aria-hidden />
                </Button>
              ) : (
                index < ragas.length - 1 && (
                  <span aria-hidden className="mr-2 text-muted-foreground">
                    ,
                  </span>
                )
              )}
            </span>
          ))}
          {ragas.length === 0 && (
            <ValueButton
              aria-label="Raga, unknown"
              onClick={() => setOpen({ kind: 'raga', index: 0 })}
            >
              ?
            </ValueButton>
          )}
          {ragas.length > 0 && !ragaOrder && (
            <AddButton
              label="Add Raga"
              onClick={() => setOpen({ kind: 'raga', index: ragas.length })}
            />
          )}
        </div>
        <ValueNotes value={ragas[0] ?? unknownValue()} suggested={suggested.ragas?.[0]} />
      </Saved>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,calc(8*var(--text-body))),1fr))] gap-x-4">
        {cell(
          'tala',
          item.tala,
          talaText({ tala: shown('tala', item.tala), nadai: shown('nadai', item.nadai) }),
        )}
        {cell('composer', item.composer)}
        {cell('language', item.language)}
        {cell('subject', item.subject)}
        {cell('form', item.form, formText(form))}
      </div>

      {/* One fold for what was improvised, the Laya vinyasam a row like the others (S14). A
          chip's own state shows its save, so none of it plays the highlight (P7). */}
      <Fold title="Improvised" open={improvisedOpen} onOpenChange={setFoldOpen}>
        <Saved target={[target('improvised'), target('layaVinyasam'), target('layaNote')]} quiet>
          <ul className="flex flex-col">
            {IMPROVISED_KINDS.map((kind) => {
              const heard = improvised.find((entry) => entry.kind === kind);
              return (
                <li
                  key={kind}
                  className="flex min-h-16 flex-wrap items-center gap-2 py-2 hairline-b"
                >
                  <Chip
                    pressed={heard !== undefined}
                    onClick={() =>
                      saveImprovised(
                        heard
                          ? improvised.filter((entry) => entry.kind !== kind)
                          : [...improvised, { kind, raga: null }],
                      )
                    }
                  >
                    {IMPROVISED_NAMES[kind]}
                  </Chip>
                  {heard && (
                    <ValueButton
                      onClick={() => setOpen({ kind: 'improvised', heard: kind })}
                      aria-label={
                        heard.raga
                          ? spokenDetail(`${IMPROVISED_NAMES[kind]} Raga`, heard.raga)
                          : `${IMPROVISED_NAMES[kind]} Raga, the Item’s Raga`
                      }
                      className="text-sub text-muted-foreground"
                    >
                      {heard.raga ? <ValueText value={heard.raga} /> : 'In the Item’s Raga'}
                    </ValueButton>
                  )}
                </li>
              );
            })}
            <li className="flex flex-col py-2 hairline-b">
              <div className="flex min-h-12 flex-wrap items-center gap-2">
                <Chip
                  pressed={laya !== null}
                  // Tapped again it is removed, like the others, but never with a note typed
                  // under it: one tap would lose the text, so the tap goes to the note instead,
                  // to clear it first.
                  onClick={() =>
                    !laya
                      ? saveLayaNadai(notApplicableValue())
                      : layaNote
                        ? layaNoteField.current?.focus()
                        : removeLaya()
                  }
                >
                  Laya vinyasam
                </Chip>
                {/* The Tala's usual nadai until asked for (FB-29): many rasikas won't know it. */}
                {laya &&
                  (laya.nadai.state === 'na' ? (
                    <AddButton label="Nadai" onClick={() => setOpen({ kind: 'laya' })} text />
                  ) : (
                    <ValueButton
                      aria-label={spokenDetail('Laya vinyasam nadai', laya.nadai)}
                      onClick={() => setOpen({ kind: 'laya' })}
                      className="text-sub text-muted-foreground"
                    >
                      {laya.nadai.state === 'unknown' ? '?' : detailText(laya.nadai)} nadai
                      {laya.nadai.guess && ' (?)'}
                    </ValueButton>
                  ))}
              </div>
              {laya && (
                // Grows open under its row rather than appearing at full height.
                <div className="grow-in">
                  <div>
                    <div className="pt-2">
                      <LayaNote
                        fieldRef={layaNoteField}
                        stored={layaNote}
                        onSave={(note) => {
                          // A note still pending when the Laya vinyasam is removed goes with it.
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
                    </div>
                  </div>
                </div>
              )}
            </li>
          </ul>
        </Saved>
      </Fold>

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
                <span className="text-caption text-muted-foreground">Nadai</span>
                <NadaiChips
                  value={shown('nadai', item.nadai)}
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
        <DetailInput
          open={sheetOpen}
          onOpenChange={(next) => !next && setOpen(null)}
          field="raga"
          title={ragas.length > 1 || sheet.index > 0 ? `Raga ${sheet.index + 1}` : 'Raga'}
          value={ragas[sheet.index] ?? unknownValue()}
          suggested={suggested.ragas?.[sheet.index]}
          onChange={(value) => {
            const next = [...ragas];
            next[sheet.index] = value;
            saveRagas(next);
          }}
          extra={
            ragas.length > 1 && sheet.index < ragas.length ? (
              <QuietButton
                className="-ml-2 self-start"
                onClick={() => {
                  setOpen(null);
                  saveRagas(ragas.filter((_, i) => i !== sheet.index));
                }}
              >
                Remove this Raga
              </QuietButton>
            ) : undefined
          }
        />
      )}
      {sheet?.kind === 'improvised' && (
        <DetailInput
          open={sheetOpen}
          onOpenChange={(next) => !next && setOpen(null)}
          field="raga"
          title={`${IMPROVISED_NAMES[sheet.heard]} Raga`}
          value={improvised.find((entry) => entry.kind === sheet.heard)?.raga ?? unknownValue()}
          onChange={(value) =>
            saveImprovised(
              improvised.map((entry) =>
                entry.kind === sheet.heard ? { ...entry, raga: value } : entry,
              ),
            )
          }
          extra={
            <QuietButton
              className="-ml-2 self-start"
              onClick={() => {
                setOpen(null);
                saveImprovised(
                  improvised.map((entry) =>
                    entry.kind === sheet.heard ? { ...entry, raga: null } : entry,
                  ),
                );
              }}
            >
              In the Item’s Raga
            </QuietButton>
          }
        />
      )}
      {sheet?.kind === 'laya' && laya && (
        <DetailInput
          open={sheetOpen}
          onOpenChange={(next) => !next && setOpen(null)}
          field="nadai"
          title="Laya vinyasam nadai"
          value={laya.nadai}
          onChange={(nadai) => saveLayaNadai(nadai)}
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
          tall
        >
          <ItemSearch query={query} onQuery={setQuery} onPick={repick} />
        </SheetFrame>
      )}
    </>
  );
}

function swap<T>(list: readonly T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
}

/** A value with its state (DESIGN.md "Detail values and their six states"). */
function ValueText({ value, text }: { value: DetailValue; text?: string }) {
  if (value.state === 'na' && !text)
    return <span className="text-muted-foreground">Not applicable</span>;
  const shown = text ?? detailText(value);
  return (
    <span>
      {shown}
      {value.guess && <span className="text-muted-foreground"> (?)</span>}
    </span>
  );
}

/** The muted line under a value: "not matched", or "catalog: Todi" on an Override. */
function ValueNotes({ value, suggested }: { value: DetailValue; suggested?: DetailValue }) {
  if (value.state === 'unresolved')
    return <span className="block text-caption text-muted-foreground">not matched</span>;
  if (value.state === 'override' && suggested) {
    return (
      <span className="block text-caption text-muted-foreground">
        catalog: {detailText(suggested)}
      </span>
    );
  }
  return null;
}

/** A value tapped to change it, underlined as every value is (walkthrough P2, FB-33). */
function ValueButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'min-h-12 min-w-12 rounded-xl text-left underline decoration-border underline-offset-4',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Adding a value: a muted "+", not a pill (walkthrough P2, FB-32). Alone, the mark carries the
 * meaning and `label` is its name; with `text`, the label shows after it ("+ Nadai").
 */
function AddButton({
  label,
  onClick,
  text = false,
}: {
  label: string;
  onClick(): void;
  text?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={text ? undefined : label}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-12 items-center gap-1 rounded-xl text-sub text-muted-foreground',
        text ? 'px-2' : 'min-w-12 justify-center',
      )}
    >
      <IconPlus aria-hidden className="size-5" />
      {text && label}
    </button>
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
    <Saved target={target}>
      <button
        type="button"
        aria-label={spokenDetail(name, value)}
        onClick={onOpen}
        className="flex min-h-16 w-full flex-col items-start justify-center rounded-xl py-2 text-left"
      >
        <span className="text-caption text-muted-foreground">{name}</span>
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

/** The Laya vinyasam's note, saved as the rasika pauses, leaves the field or the app. */
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
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption text-muted-foreground">Note</span>
      <textarea
        ref={fieldRef}
        value={note.text}
        rows={2}
        onChange={(e) => note.change(e.target.value)}
        onBlur={note.flush}
        className="w-full rounded-xl bg-secondary p-3 text-body"
      />
    </label>
  );
}
