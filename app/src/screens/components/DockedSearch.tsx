// The one search (docs/design/search.md; DESIGN.md "The docked search", "Search box", "Search
// result", "Search states"): every search in the app, the Item editor's, the Detail and the
// Artist and Sabha pickers', and What's on's. Top to bottom: a note when there is one, the
// pinned rows, the results on a panel from weakest to best, then the box, standing on the
// keyboard. The best match is the row by the box. Only the results scroll. Screen readers read
// the same order, hear the list as "best match last", and hear the count once typing pauses.
//
// The best match is never the row that is cut (decided 2026-11-15). When the room above the box
// is too short for it under the pinned rows (a keyboard up on a small phone, large text), the
// pinned rows give way: first all but "Use what I typed" step aside, and if that is not enough
// everything above the box scrolls as one, resting at its foot.

import { IconCircleXFilled, IconSearch } from '@tabler/icons-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '@/lib/utils';
import { MESSAGES } from '../messages';
import { ActionRow, ListRowBody, ROW_SHAPE } from './rows';

export interface SearchRow {
  key: string;
  title: string;
  /** The distinguishing line: "Raga · Composer · Tala", or an Artist's usual Role. */
  line?: string | null;
  /** A kind word at the right, on the title's line: "Raga", "Artist", "Sabha". */
  badge?: string;
  /** Spoken name, when the visible text is not enough. */
  label?: string;
  onPick(): void;
}

// The count is announced after typing pauses this long, never per keystroke (design D24).
const ANNOUNCE_AFTER_MS = 700;

/**
 * How far the fade under the panel's top edge reaches: solid for 16px, then fading over 24.
 * A row that starts below it is whole.
 */
const FADE_PX = 40;
/** Its solid part, which never shortens. */
const FADE_SOLID_PX = 16;

/**
 * What the room above the box holds: `all`, the pinned rows over the scrolling results;
 * `aside`, only "Use what I typed" pinned, the other pinned rows out of the way; `scroll`,
 * everything above the box scrolling as one.
 */
type Fit = 'all' | 'aside' | 'scroll';

/** The field's one class string, for every search box (DESIGN.md "Search box"). */
export const SEARCH_FIELD =
  'min-h-12 w-full rounded-fill bg-secondary py-2 pr-12 pl-11 text-body text-foreground placeholder:text-muted-foreground focus:shadow-[inset_0_0_0_2px_var(--ring)] focus-visible:outline-none';

/** How much taller the sheet holding `node` could still grow, if it is in one. */
function slack(node: HTMLElement): number {
  const sheet = node.closest<HTMLElement>('[data-slot="sheet-content"]');
  if (!sheet) return 0;
  const max = parseFloat(getComputedStyle(sheet).maxHeight);
  return Number.isFinite(max) ? Math.max(0, max - sheet.offsetHeight) : 0;
}

export function DockedSearch({
  label,
  placeholder,
  query,
  onQueryChange,
  autoFocus = false,
  field,
  on = 'sheet',
  note,
  pinned,
  typedRow,
  caption,
  results,
  shade = true,
  most,
  resultsLabel = 'Results, best match last',
  noMatch = true,
  onSubmit,
  className,
}: {
  label: string;
  placeholder: string;
  query: string;
  onQueryChange(query: string): void;
  autoFocus?: boolean;
  /** The box, for a sheet that focuses it as it opens. */
  field?: RefObject<HTMLInputElement | null>;
  /** On a page the panel is a step lighter than it; on a sheet, a step darker. */
  on?: 'page' | 'sheet';
  note?: ReactNode;
  /**
   * The pinned rows that step aside when the room is short: the chips, "? Don't know", "Add
   * new", What's on's picks.
   */
  pinned?: ReactNode;
  /** "Use what I typed: …", pinned under the rest, the one pinned row that never steps aside. */
  typedRow?: ReactNode;
  /** A muted caption over the results ("Often heard"). */
  caption?: string;
  /** Best first; drawn weakest to best. */
  results: SearchRow[];
  /** Whether the best match is shaded: not before typing on What's on, where Enter does nothing. */
  shade?: boolean;
  /** Show only as many results as fit whole, this many at most. */
  most?: number;
  resultsLabel?: string;
  /** Whether a search with no results says so: not with no catalog to search. */
  noMatch?: boolean;
  onSubmit?(): void;
  className?: string;
}) {
  const own = useRef<HTMLInputElement>(null);
  const input = field ?? own;
  const stack = useRef<HTMLDivElement>(null);
  const pinnedRows = useRef<HTMLDivElement>(null);
  const aside = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit>('all');
  // How many results fit whole, when only those that do are shown.
  const [fits, setFits] = useState(most ?? Infinity);
  // Whether the rasika has left the results resting at their foot, by the box.
  const atFoot = useRef(true);
  const [announced, setAnnounced] = useState('');
  const typed = query.trim() !== '';
  const canStepAside = Boolean(pinned) && typed;
  const nothing = typed && noMatch && results.length === 0;

  useEffect(() => {
    if (!typed) return;
    const timer = setTimeout(
      () => setAnnounced(MESSAGES.search.results(results.length)),
      ANNOUNCE_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [typed, query, results.length]);

  // What fits. Every number read here is the same whichever way the stack is laid out now, so
  // the answer never flips back and forth: the room is the stack's height and what its sheet
  // could still grow by, the pinned rows are counted with those stepped aside, and the results
  // with those not shown.
  const measure = useCallback(() => {
    const room = stack.current;
    const rows = pinnedRows.current;
    const box = list.current;
    const holder = panel.current;
    // Not laid out: a sheet still closed. (The stack itself can be empty: rows stepped aside
    // with nothing typed to show.)
    if (!room || !rows || !input.current?.offsetHeight) return;
    const height = room.clientHeight + slack(room);
    const stepping = aside.current?.scrollHeight ?? 0;
    const full = rows.offsetHeight + (rows.dataset.aside === 'away' ? stepping : 0);
    // The panel's own height beyond its rows: its gap above, its padding.
    const caption = room.querySelector<HTMLElement>('[data-caption]')?.offsetHeight ?? 0;
    const frame =
      caption + (holder && box ? holder.offsetHeight - box.clientHeight + gapAbove(holder) : 0);
    const items = box ? [...box.querySelectorAll<HTMLElement>(':scope > ul > li')] : [];
    // Each row's height, a row not shown counted at its own (scrollHeight holds it).
    const heights = items.map((item) => item.scrollHeight);
    const natural = heights.reduce((sum, h) => sum + h, 0);
    // What the results need: all of them when that is little, else the best match whole and
    // clear of the fade.
    const best = heights.at(-1) ?? 0;
    const needWith = (fade: number) =>
      frame + (heights.length === 0 ? (box?.scrollHeight ?? 0) : Math.min(natural, best + fade));
    // Where the room is short, the fade's soft part shortens before "Use what I typed" would
    // have to scroll away: the best match stays whole and clear of it either way.
    const typedOnly = full - stepping;
    const next: Fit =
      full + needWith(FADE_PX) <= height
        ? 'all'
        : canStepAside && typedOnly + needWith(FADE_SOLID_PX) <= height
          ? 'aside'
          : 'scroll';
    setFit(next);
    if (most !== undefined) {
      // As many as fit whole, from the best up: no row half under the fade.
      let left = height - (next === 'aside' ? full - stepping : full) - frame;
      let count = 0;
      for (let i = heights.length - 1; i >= 0 && count < most; i -= 1) {
        if (heights[i]! > left) break;
        left -= heights[i]!;
        count += 1;
      }
      setFits(Math.max(1, count));
    }
  }, [canStepAside, most, input]);

  /** Rest the results at their foot: the best match by the box. */
  const toFoot = useCallback(() => {
    for (const box of [stack.current, list.current]) {
      if (!box) continue;
      box.scrollTop = box.scrollHeight;
      box.dataset.scrolled = String(box.scrollTop > 0);
    }
    atFoot.current = true;
  }, []);

  // After every draw: what was typed changes the rows and the results at once.
  useLayoutEffect(measure);

  // Keep the best match, by the box, in view as the results change.
  useLayoutEffect(toFoot, [results, fit, fits, toFoot]);

  // The fade, drawn over the rows under the panel's top edge: solid for 16px, then fading over
  // 24, and never over the best match: where the room is short its soft part shortens.
  const shadeTop = useCallback(() => {
    const box = list.current;
    const fade = box?.querySelector<HTMLElement>(':scope > [data-fade]');
    if (!box || !fade) return;
    const best = box.querySelector<HTMLElement>(':scope > ul > li:last-child');
    const toBest = best
      ? best.getBoundingClientRect().top - box.getBoundingClientRect().top
      : box.clientHeight;
    const soft = Math.max(0, Math.min(FADE_PX - FADE_SOLID_PX, toBest - FADE_SOLID_PX));
    fade.style.height = `${FADE_SOLID_PX + soft}px`;
    fade.style.marginBottom = `-${FADE_SOLID_PX + soft}px`;
  }, []);
  useLayoutEffect(shadeTop);

  // And as the room changes: a keyboard rising or changing height, the phone turned, larger
  // text. Results the rasika has scrolled stay where they left them.
  useEffect(() => {
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        measure();
        if (atFoot.current) toFoot();
        shadeTop();
      });
    };
    const observer = new ResizeObserver(again);
    for (const box of [stack.current, pinnedRows.current, aside.current, list.current]) {
      if (box) observer.observe(box);
    }
    const sheet = stack.current?.closest('[data-slot="sheet-content"]');
    if (sheet) observer.observe(sheet);
    window.visualViewport?.addEventListener('resize', again);
    window.addEventListener('resize', again);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', again);
      window.removeEventListener('resize', again);
    };
  }, [measure, toFoot, shadeTop]);

  const scrolled = (event: React.UIEvent<HTMLDivElement>) => {
    const box = event.currentTarget;
    if (event.target !== box) return;
    box.dataset.scrolled = String(box.scrollTop > 0);
    atFoot.current = box.scrollHeight - box.scrollTop - box.clientHeight < 2;
    shadeTop();
  };

  const drawn = [...results].reverse();
  // Those that don't fit whole are kept, out of sight, to be measured by.
  const hiddenUpTo = most === undefined ? 0 : Math.max(0, drawn.length - Math.min(fits, most));
  const shown = drawn.length > 0 || nothing;
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        // The box 8px over the keyboard on a sheet as on a page: the sheet's 16px foot taken
        // back by half.
        on === 'page' ? 'search-on-page' : 'search-on-sheet -mb-2',
        className,
      )}
    >
      <div aria-live="polite" className="sr-only">
        {typed ? announced : ''}
      </div>
      <div
        ref={stack}
        data-fit={fit}
        onScroll={scrolled}
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          // With no room for the best match under any pinned row, all of it scrolls as one,
          // wide enough for the panel, which stands 16px past the text.
          fit === 'scroll' && 'group/stack -mx-4 overflow-y-auto overscroll-contain px-4',
        )}
      >
        {fit === 'scroll' && (
          // Once scrolled, what passes under its top is covered there in the ground's colour,
          // as the results are in the panel's; nothing is masked, so the panel's own edge
          // never fades.
          <div
            aria-hidden
            data-fade
            className="pointer-events-none sticky top-0 z-20 -mx-4 -mb-10 h-10 shrink-0 bg-[linear-gradient(to_bottom,var(--search-ground)_16px,transparent)] opacity-0 group-data-[scrolled=true]/stack:opacity-100"
          />
        )}
        {/* The stack is bottom-aligned: with few results it shrinks and the pinned rows sit just
            above the panel; with many, only the results scroll (design D7). */}
        <div aria-hidden className="min-h-0 flex-1" />
        <div
          ref={pinnedRows}
          data-aside={fit === 'aside' ? 'away' : undefined}
          className="flex shrink-0 flex-col"
        >
          {note && <div className="py-2 text-sub text-muted-foreground">{note}</div>}
          {pinned && (
            // Stepped aside, the rows keep their size to be measured by, and take no room.
            <div
              ref={aside}
              data-pinned
              className={cn('flex flex-col', fit === 'aside' && 'invisible h-0 overflow-hidden')}
            >
              {pinned}
            </div>
          )}
          {typedRow}
        </div>
        {caption && shown && (
          // Over the panel, on the text column (DESIGN.md "Search states").
          <p data-caption className="pt-2 text-caption text-muted-foreground">
            {caption}
          </p>
        )}
        {shown && (
          // The results' panel (decision 4): 8px from the screen with 16px corners, its top edge
          // the break from the pinned rows, so no divider is drawn. On a page it is the panel
          // colour, a step lighter; on a sheet the page colour, a step darker than the sheet.
          <div
            ref={panel}
            data-results-panel
            className={cn(
              'fill-edge mt-2 flex min-h-0 flex-col overflow-hidden rounded-fill',
              'bg-(--search-panel)',
              fit === 'scroll' ? 'shrink-0' : 'shrink',
            )}
          >
            <div
              ref={list}
              onScroll={scrolled}
              className={cn(
                'group/results relative flex flex-col',
                fit !== 'scroll' && 'min-h-0 overflow-y-auto overscroll-contain',
              )}
            >
              {/* While a row is under the panel's top edge, it is covered there in the panel's
                  colour: solid for 16px, fading over the next 24. The panel's own edge never
                  fades. */}
              <div
                aria-hidden
                data-fade
                className="pointer-events-none sticky top-0 z-10 -mb-10 h-10 shrink-0 bg-[linear-gradient(to_bottom,var(--search-panel)_16px,transparent)] opacity-0 group-data-[scrolled=true]/results:opacity-100"
              />
              {nothing ? (
                // In the best match's place, by the box: the same words in every search.
                <p className="flex min-h-12 items-center px-4 py-3 text-sub text-muted-foreground">
                  {MESSAGES.search.nothingMatches(query.trim())}
                </p>
              ) : (
                // Rows divided by the hairline across the text column (DESIGN.md "Shapes").
                <ul aria-label={resultsLabel} className="flex flex-col px-4">
                  {drawn.map((row, i) => {
                    const best = i === drawn.length - 1;
                    const away = i < hiddenUpTo;
                    return (
                      <li
                        key={row.key}
                        aria-hidden={away || undefined}
                        className={cn(
                          i > hiddenUpTo && 'hairline-t',
                          away && 'invisible h-0 overflow-hidden',
                        )}
                      >
                        <button
                          type="button"
                          aria-label={row.label}
                          data-best={best ? '' : undefined}
                          tabIndex={away ? -1 : undefined}
                          onClick={row.onPick}
                          className={cn(
                            // A List row (the row spec, 2026-11-16): 48px with one line, 68px
                            // with two, its text on the 24px column.
                            ROW_SHAPE,
                            // The best match's shading runs the panel's full width as its last
                            // row, sharing its bottom corners; it dims with its text when
                            // pressed.
                            best && shade && '-mx-4 w-[calc(100%+32px)] bg-(--search-best) px-4',
                          )}
                        >
                          {/* Its title in body 400; a kind word in the trailing slot, with no
                              room kept for a check. */}
                          <ListRowBody title={row.title} line={row.line} kindWord={row.badge} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
      {/* The field on the 8px edge with 16px corners (foundations, 2026-11-16). */}
      <form
        role="search"
        className="relative mt-2 shrink-0 fill-edge"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.();
        }}
      >
        <IconSearch
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={input}
          type="search"
          aria-label={label}
          placeholder={placeholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          // The one autofocus allowed on mobile: the Item editor's search (DD4, design D7).
          autoFocus={autoFocus}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={SEARCH_FIELD}
        />
        {query !== '' && (
          // A filled circle with an ×, 20px in a 48px target: never taken for a sheet's close.
          <button
            type="button"
            aria-label={MESSAGES.search.clear}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              onQueryChange('');
              input.current?.focus({ preventScroll: true });
            }}
            className="absolute top-0 right-0 flex size-12 items-center justify-center rounded-fill text-muted-foreground"
          >
            {/* Its circle 20px across: Tabler draws it inside a 24px box. */}
            <IconCircleXFilled aria-hidden className="size-6" />
          </button>
        )}
      </form>
    </div>
  );
}

/** The space above an element, its own top margin. */
const gapAbove = (node: HTMLElement) => parseFloat(getComputedStyle(node).marginTop) || 0;

/**
 * A pinned row: "? Don't know", "Use what I typed: …", "Add “…” as a new Sabha". An Action row
 * (the row spec, 2026-11-16), its text on the column, with a hairline above it when a pinned row
 * is over it.
 */
export function FixedRow({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick(): void;
  label?: string;
}) {
  return (
    <ActionRow label={label} onClick={onClick} className="pinned-row">
      {children}
    </ActionRow>
  );
}

/**
 * A fully round chip (DESIGN.md "Shapes"), pressed when `pressed` is set. Its border and padding
 * make a 16px inset, so a chip row on the 8px edge has its first word on the 24px column.
 */
export function Chip({
  pressed,
  className,
  ...props
}: React.ComponentProps<'button'> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border px-[15px] py-2 text-sub',
        pressed && 'border-foreground bg-secondary font-semibold',
        className,
      )}
      {...props}
    />
  );
}
