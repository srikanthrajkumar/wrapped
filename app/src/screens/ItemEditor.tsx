// The Item editor (T044; DESIGN.md "Item editor (DD4)", design D7, D12, D13, D25). A new Item
// opens on its search box, focused and docked at the bottom; the Item exists from its first pick
// (a song, a Raga, a special form, "? Don't know" or "Use what I typed"), and typed text that
// was not picked survives the phone locking. After a pick, the Details show as a grid of
// tappable values, with the Laya vinyasam and the improvised Details folded underneath. Each
// change saves at once; the bottom bar holds "Done" and "Next Item →".

import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
  IconDots,
  IconPlus,
} from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useTextScale } from '@/hooks/use-text-scale';
import { cn } from '@/lib/utils';
import { suggestedDetails, type Suggested } from '../catalog/details';
import type { SearchResult } from '../catalog/search';
import { currentCatalog, useCatalog } from '../catalog/use-catalog';
import {
  IMPROVISED_KINDS,
  newId,
  notApplicableValue,
  unknownValue,
  type DetailValue,
  type ImprovisedKind,
  type Item,
} from '../model';
import { db } from '../store/db';
import {
  addItemFrom,
  discardItemDraft,
  readItemDraft,
  removeItem,
  repickItem,
  saveItemDraft,
  setDetail,
  setImprovised,
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
import { BottomDock, QuietButton, TopBar, useFocusOnOpen } from './components/layout';
import { SheetFrame } from './components/sheet-frame';
import { UndoBar } from './components/UndoBar';
import { detailText, ragasText, spokenDetail, talaText } from './format';
import { MESSAGES } from './messages';
import { offerUndo } from './undo';

/** The Event's name for the back chevron: its Sabha, or "Concert" until it has one. */
function useBack(eventId: string) {
  const event = useLiveQuery(() => getEvent(eventId), [eventId]);
  const sabha = useSabha(event?.sabhaId ?? null);
  return { href: `/event/${eventId}`, label: sabha?.name ?? 'Concert' };
}

export function ItemEditor({ eventId, itemId }: { eventId: string; itemId: string }) {
  return itemId === 'new' ? (
    <NewItem key={eventId} eventId={eventId} />
  ) : (
    <EditItem key={itemId} eventId={eventId} itemId={itemId} />
  );
}

/** One search result as a row: "Raga · Composer · Tala" under a song, a badge on a Raga. */
function resultRow(result: SearchResult, onPick: (pick: ItemPick) => void): SearchRow {
  if (result.kind === 'raga') {
    return {
      key: `raga:${result.raga.key}`,
      title: result.raga.display,
      badge: 'Raga',
      line: 'Start this Item with only its Raga',
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
  const scale = useTextScale();
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
          {/* At large text the chips scroll sideways in one row, leaving room for results. */}
          <div
            className={cn(
              'flex gap-2 pb-1',
              scale >= 1.5 ? 'overflow-x-auto overscroll-x-contain' : 'flex-wrap',
            )}
          >
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

  // Restore what was typed before the phone locked or the app was closed (design D12).
  useEffect(() => {
    let live = true;
    void readItemDraft(eventId).then((stored) => {
      if (live) setDraft(stored ? { id: stored.id, text: stored.text } : { id: newId(), text: '' });
    });
    return () => {
      live = false;
    };
  }, [eventId]);

  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  useEffect(() => {
    const keep = () => {
      const current = latest.current;
      if (document.visibilityState === 'hidden' && current && current.text.trim()) {
        void saveItemDraft({ id: current.id, eventId, text: current.text });
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
  // it, so a consumed draft id is never picked again.
  const created = useLiveQuery(
    async () => (draft ? ((await db.items.get(draft.id)) ?? null) : null),
    [draft?.id],
  );
  const ready = created?.deletedAt === null && created.eventId === eventId;
  useEffect(() => {
    if (ready) navigate(`/event/${eventId}/item/${created.id}`, { replace: true });
  }, [ready, created, eventId, navigate]);

  const pick = (choice: ItemPick) => {
    if (!draft) return;
    const id = draft.id;
    // From here a page-hide never writes the draft back (the store refuses it too).
    latest.current = null;
    void saveWith({ table: 'items', id, field: '*' }, pickLabel(choice), () =>
      addItemFrom(eventId, choice, { id }),
    );
  };

  if (!draft) return null;
  const failed = feedback.get({ table: 'items', id: draft.id, field: '*' });
  return (
    <div
      className="flex flex-col pb-2"
      style={{
        height: `calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - ${inset}px)`,
      }}
    >
      {/* Backing out discards what was typed (design D12). */}
      <TopBar back={back} onBack={() => void discardItemDraft(eventId)} />
      <h1 className="pt-1 pb-2 text-title font-semibold">
        Item {number ?? ''}
        {failed && failed.status !== 'saved' && ` · ${String(failed.value)}`}
      </h1>
      {failed?.status === 'failed' && (
        <NotSavedLine targets={[{ table: 'items', id: draft.id, field: '*' }]} />
      )}
      <ItemSearch
        query={draft.text}
        onQuery={(text) => setDraft({ ...draft, text })}
        onPick={pick}
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
  const [, navigate] = useLocation();
  const catalogState = useCatalog();
  const catalog = catalogState.status === 'ready' ? catalogState.catalog : null;
  const [open, setOpen] = useState<Open>(null);
  const [query, setQuery] = useState('');
  // Null follows the content (open once filled); a tap decides from then on.
  const [folds, setFolds] = useState<{ laya: boolean | null; improvised: boolean | null }>({
    laya: null,
    improvised: null,
  });
  const [ragaOrder, setRagaOrder] = useState(false);
  const head = useFocusOnOpen<HTMLHeadingElement>(itemId);
  const feedback = useSaveFeedback();

  if (item === undefined) return null;
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
    void saveWith(target(field), value, () =>
      setDetail(item.id, field, value, { catalog: currentCatalog() ?? undefined }),
    );
  const saveRagas = (next: DetailValue[]) =>
    void saveWith(target('ragas'), next, () =>
      setRagas(item.id, next, { catalog: currentCatalog() ?? undefined }),
    );
  const improvised = shown('improvised', item.improvised);
  const saveImprovised = (next: Item['improvised']) =>
    void saveWith(target('improvised'), next, () => setImprovised(item.id, next));
  const laya = shown('layaVinyasam', item.layaVinyasam);
  const saveLaya = (next: Item['layaVinyasam']) =>
    void saveWith(target('layaVinyasam'), next, () => setLayaVinyasam(item.id, next));

  // One write: the pick, the Details it clears and the logging note (store/items.ts repickItem).
  const repick = (choice: ItemPick) => {
    setOpen(null);
    setQuery('');
    void saveWith(target('title'), pickLabel(choice), () =>
      repickItem(item.id, choice, { catalog: currentCatalog() ?? undefined }),
    );
  };

  const title = shown('title', item.title) || ragasText(ragas) || '?';
  const cell = (field: ItemField, value: DetailValue, text?: string) => (
    <DetailCell
      key={field}
      name={FIELD_NAMES[field]}
      value={shown(field, value)}
      text={text}
      suggested={suggested[field as keyof Suggested] as DetailValue | undefined}
      // The Tala cell shows the Nadai too, so it carries the Nadai's feedback.
      target={field === 'tala' ? [target('tala'), target('nadai')] : [target(field)]}
      onOpen={() => setOpen({ kind: 'detail', field })}
    />
  );
  const layaOpen = folds.laya ?? laya !== null;
  const improvisedOpen = folds.improvised ?? improvised.length > 0;

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
                onSelect={() =>
                  void removeItem(item.id).then((deleted) => {
                    if (deleted) offerUndo(deleted.receipt);
                    navigate(`/event/${eventId}`);
                  })
                }
              >
                Delete Item
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <Saved target={[target('*'), target('title')]}>
        <h1
          ref={head}
          tabIndex={-1}
          className="flex flex-wrap items-center gap-x-2 pt-1 pb-4 text-title font-semibold break-words"
        >
          <span>Item {item.position} ·</span>
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

      {/* Ragas first: an ordered row of chips with "+ Raga" (design D25). */}
      <Saved target={target('ragas')} className="pb-3">
        <div className="flex items-center justify-between">
          <span className="text-caption text-muted-foreground">
            {ragas.length > 1 ? 'Ragas' : 'Raga'}
          </span>
          {ragas.length >= 2 && (
            <QuietButton onClick={() => setRagaOrder(!ragaOrder)}>
              {ragaOrder ? 'Done' : 'Edit order'}
            </QuietButton>
          )}
        </div>
        <div role="list" aria-label="Ragas, in order" className="flex flex-wrap items-center gap-2">
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
              <Chip
                aria-label={spokenDetail(`Raga ${index + 1}`, raga)}
                onClick={() => setOpen({ kind: 'raga', index })}
                className="text-body"
              >
                <ValueText value={raga} />
              </Chip>
              {ragaOrder && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === ragas.length - 1}
                  aria-label={`Move ${detailText(raga) || 'Raga'} later`}
                  onClick={() => saveRagas(swap(ragas, index, index + 1))}
                >
                  <IconArrowRight aria-hidden />
                </Button>
              )}
            </span>
          ))}
          {ragas.length === 0 && (
            <Chip
              aria-label="Raga, unknown"
              onClick={() => setOpen({ kind: 'raga', index: 0 })}
              className="text-body"
            >
              ?
            </Chip>
          )}
          {ragas.length > 0 && !ragaOrder && (
            <Chip onClick={() => setOpen({ kind: 'raga', index: ragas.length })}>
              <IconPlus aria-hidden className="mr-1 size-4" /> Raga
            </Chip>
          )}
        </div>
        <ValueNotes value={ragas[0] ?? unknownValue()} suggested={suggested.ragas?.[0]} />
      </Saved>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,calc(8*var(--text-body))),1fr))] gap-x-4 gap-y-1">
        {cell(
          'tala',
          item.tala,
          talaText({ tala: shown('tala', item.tala), nadai: shown('nadai', item.nadai) }),
        )}
        {cell('composer', item.composer)}
        {cell('language', item.language)}
        {cell('subject', item.subject)}
        {cell('form', item.form)}
      </div>

      <Fold
        title="Laya vinyasam"
        open={layaOpen}
        onToggle={() => setFolds({ ...folds, laya: !layaOpen })}
      >
        <Saved target={target('layaVinyasam')}>
          {laya === null ? (
            <Button
              variant="outline"
              onClick={() => saveLaya({ nadai: notApplicableValue(), note: null })}
            >
              <IconPlus aria-hidden /> Laya vinyasam after this Item
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <DetailCell
                name="Nadai"
                value={laya.nadai}
                text={laya.nadai.state === 'na' ? 'The Tala’s usual nadai' : undefined}
                target={null}
                onOpen={() => setOpen({ kind: 'laya' })}
              />
              <LayaNote
                stored={laya.note}
                onSave={(note) => {
                  // Saved against the latest Laya vinyasam, so a Nadai changed meanwhile stays;
                  // a note still pending when the Laya vinyasam is removed goes with it.
                  const current = shown('layaVinyasam', item.layaVinyasam);
                  if (current) saveLaya({ ...current, note: note || null });
                }}
              />
              <Button variant="ghost" className="self-start" onClick={() => saveLaya(null)}>
                Remove Laya vinyasam
              </Button>
            </div>
          )}
        </Saved>
      </Fold>

      <Fold
        title="Improvised"
        open={improvisedOpen}
        onToggle={() => setFolds({ ...folds, improvised: !improvisedOpen })}
      >
        <Saved target={target('improvised')}>
          <ul className="flex flex-col">
            {IMPROVISED_KINDS.map((kind) => {
              const heard = improvised.find((entry) => entry.kind === kind);
              return (
                <li
                  key={kind}
                  className="flex flex-wrap items-center gap-2 border-b border-border py-1"
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
                    <button
                      type="button"
                      onClick={() => setOpen({ kind: 'improvised', heard: kind })}
                      aria-label={
                        heard.raga
                          ? spokenDetail(`${IMPROVISED_NAMES[kind]} Raga`, heard.raga)
                          : `${IMPROVISED_NAMES[kind]} Raga, the Item’s Raga`
                      }
                      className="min-h-12 rounded-xl px-2 text-left text-sub text-muted-foreground"
                    >
                      {heard.raga ? <ValueText value={heard.raga} /> : 'In the Item’s Raga'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Saved>
      </Fold>

      <BottomDock>
        <UndoBar />
        <div className="flex flex-wrap gap-2 border-t border-border bg-background px-4 py-2">
          <Button size="lg" variant="outline" className="min-w-32 flex-1" asChild>
            <Link href={`/event/${eventId}`}>Done</Link>
          </Button>
          <Button size="lg" className="min-w-32 flex-[2]" asChild>
            <Link href={`/event/${eventId}/item/new`} replace>
              Next Item
              <IconArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </BottomDock>

      {open?.kind === 'detail' && (
        <DetailInput
          open
          onOpenChange={(next) => !next && setOpen(null)}
          field={open.field as DetailField}
          title={FIELD_NAMES[open.field]}
          value={shown(open.field, item[open.field])}
          suggested={suggested[open.field as keyof Suggested] as DetailValue | undefined}
          onChange={(value) => save(open.field, value)}
          extra={
            open.field === 'tala' ? (
              <div className="flex flex-col gap-1">
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
      {open?.kind === 'raga' && (
        <DetailInput
          open
          onOpenChange={(next) => !next && setOpen(null)}
          field="raga"
          title={ragas.length > 1 || open.index > 0 ? `Raga ${open.index + 1}` : 'Raga'}
          value={ragas[open.index] ?? unknownValue()}
          suggested={suggested.ragas?.[open.index]}
          onChange={(value) => {
            const next = [...ragas];
            next[open.index] = value;
            saveRagas(next);
          }}
          extra={
            ragas.length > 1 && open.index < ragas.length ? (
              <Button
                variant="ghost"
                className="self-start"
                onClick={() => {
                  setOpen(null);
                  saveRagas(ragas.filter((_, i) => i !== open.index));
                }}
              >
                Remove this Raga
              </Button>
            ) : undefined
          }
        />
      )}
      {open?.kind === 'improvised' && (
        <DetailInput
          open
          onOpenChange={(next) => !next && setOpen(null)}
          field="raga"
          title={`${IMPROVISED_NAMES[open.heard]} Raga`}
          value={improvised.find((entry) => entry.kind === open.heard)?.raga ?? unknownValue()}
          onChange={(value) =>
            saveImprovised(
              improvised.map((entry) =>
                entry.kind === open.heard ? { ...entry, raga: value } : entry,
              ),
            )
          }
          extra={
            <Button
              variant="ghost"
              className="self-start"
              onClick={() => {
                setOpen(null);
                saveImprovised(
                  improvised.map((entry) =>
                    entry.kind === open.heard ? { ...entry, raga: null } : entry,
                  ),
                );
              }}
            >
              In the Item’s Raga
            </Button>
          }
        />
      )}
      {open?.kind === 'laya' && laya && (
        <DetailInput
          open
          onOpenChange={(next) => !next && setOpen(null)}
          field="nadai"
          title="Laya vinyasam nadai"
          value={laya.nadai}
          onChange={(nadai) => saveLaya({ ...laya, nadai })}
        />
      )}
      {open?.kind === 'composition' && (
        <SheetFrame
          open
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

function DetailCell({
  name,
  value,
  text,
  suggested,
  target,
  onOpen,
}: {
  name: string;
  value: DetailValue;
  text?: string;
  suggested?: DetailValue;
  target: { table: 'items'; id: string; field: string }[] | null;
  onOpen(): void;
}) {
  return (
    <Saved target={target}>
      <button
        type="button"
        aria-label={spokenDetail(name, value)}
        onClick={onOpen}
        className="flex min-h-[60px] w-full flex-col items-stretch justify-center rounded-xl py-2 text-left"
      >
        <span className="text-caption text-muted-foreground">{name}</span>
        <span className="break-words">
          <ValueText value={value} text={text} />
        </span>
        <ValueNotes value={value} suggested={suggested} />
      </button>
    </Saved>
  );
}

function Fold({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle(): void;
  children: ReactNode;
}) {
  const id = `fold-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section className="border-t border-border">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center justify-between py-2 text-left text-sub font-semibold text-muted-foreground"
        >
          {title}
          <IconChevronDown
            aria-hidden
            className={cn('size-5 transition-transform duration-150', open && 'rotate-180')}
          />
        </button>
      </h2>
      <div id={id} hidden={!open} className="pb-4">
        {children}
      </div>
    </section>
  );
}

/** The Laya vinyasam's note, saved as the rasika pauses, leaves the field or the app. */
function LayaNote({ stored, onSave }: { stored: string | null; onSave(note: string): void }) {
  const note = useAutosave(stored ?? '', onSave);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption text-muted-foreground">Note</span>
      <textarea
        value={note.text}
        rows={2}
        onChange={(e) => note.change(e.target.value)}
        onBlur={note.flush}
        className="w-full rounded-xl bg-secondary p-3 text-body"
      />
    </label>
  );
}
