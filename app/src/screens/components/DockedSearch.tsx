// The one search pattern of the logging screens (DESIGN.md "Item editor", "Search box",
// "Search result", "Search states"): a box docked at the bottom, and above it, top to bottom, a
// note when there is one, the pinned rows, a divider, then the results from weakest to best, so
// the best match sits by the box. Only the results scroll. Screen readers read the same order,
// hear the list as "best match last", and hear the count once typing pauses.
//
// The best match is never the row that is cut. When the room above the box is too short for
// it under the pinned rows (a keyboard up on a small phone, large text), the pinned rows give
// way: first all but "Use what I typed" step aside, and if that is not enough the whole stack
// scrolls as one, resting at its foot (DESIGN.md "Search states").

import { IconSearch } from '@tabler/icons-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MESSAGES } from '../messages';

export interface SearchRow {
  key: string;
  title: string;
  /** The distinguishing line: "Raga · Composer · Tala", or an Artist's usual Role. */
  line?: string | null;
  badge?: string;
  /** Spoken name, when the visible text is not enough. */
  label?: string;
  onPick(): void;
}

// The count is announced after typing pauses this long, never per keystroke (design D24).
const ANNOUNCE_AFTER_MS = 700;

// Once rows are scrolled up under what is above them, they are gone in the first 12px and fade
// in over the next 20, so a row half under the pinned rows shows no second rule. Unscrolled,
// nothing fades.
const FADE =
  'data-[scrolled=true]:[mask-image:linear-gradient(to_bottom,transparent_12px,black_32px)]';
/** How far down the fade reaches: a row that starts below it is whole. */
const FADE_PX = 32;

/**
 * What the room above the box holds (DESIGN.md "Search states"): `all`, the pinned rows over
 * the scrolling results; `typed`, only "Use what I typed" pinned, the other pinned rows out of
 * the way; `scroll`, everything above the box scrolling as one.
 */
type Fit = 'all' | 'typed' | 'scroll';

export function DockedSearch({
  label,
  placeholder,
  query,
  onQueryChange,
  autoFocus = false,
  note,
  fixed,
  typedRow,
  results,
  resultsLabel = 'Results, best match last',
  onSubmit,
  lastRow,
  className,
}: {
  label: string;
  placeholder: string;
  query: string;
  onQueryChange(query: string): void;
  autoFocus?: boolean;
  note?: string | null;
  /** The pinned rows that don't depend on what is typed: the chips, "? Don't know". */
  fixed?: ReactNode;
  /**
   * "Use what I typed: …", pinned under `fixed`. On a short screen it is the last pinned row
   * to give way: with it there, `fixed` steps aside before the best match is cut.
   */
  typedRow?: ReactNode;
  /** Best first; drawn weakest to best. */
  results: SearchRow[];
  resultsLabel?: string;
  onSubmit?(): void;
  /** Always the last row, under the best match: "Add “…” as a new Sabha". */
  lastRow?: ReactNode;
  className?: string;
}) {
  const stack = useRef<HTMLDivElement>(null);
  const pinned = useRef<HTMLDivElement>(null);
  const aside = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit>('all');
  // Whether the rasika has left the stack resting at its foot, by the box.
  const atFoot = useRef(true);
  const [announced, setAnnounced] = useState('');
  const typed = query.trim() !== '';
  const canStepAside = Boolean(fixed) && Boolean(typedRow);

  useEffect(() => {
    if (!typed) return;
    const timer = setTimeout(
      () => setAnnounced(MESSAGES.search.results(results.length)),
      ANNOUNCE_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [typed, query, results.length]);

  // What fits. Every number read here is the same whichever way the stack is laid out now, so
  // the answer never flips back and forth.
  const measure = useCallback(() => {
    const room = stack.current?.clientHeight ?? 0;
    const rows = pinned.current;
    const box = list.current;
    // Not laid out: a sheet still closed.
    if (!rows || !box || room === 0) return;
    const gap = parseFloat(getComputedStyle(rows).rowGap) || 0;
    const stepping = aside.current ? aside.current.offsetHeight + gap : 0;
    // The pinned rows' height with all of them showing.
    const full = rows.offsetHeight + (rows.dataset.aside === 'away' ? stepping : 0);
    // What the results need: all of them when that is little, else the best match whole,
    // clear of the fade, with whatever sits under it.
    const natural = box.scrollHeight;
    const best = box.querySelector('[data-best]');
    const need = best
      ? Math.min(
          natural,
          natural -
            (best.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop) +
            FADE_PX,
        )
      : natural;
    setFit(
      full + need <= room
        ? 'all'
        : canStepAside && full - stepping + need <= room
          ? 'typed'
          : 'scroll',
    );
  }, [canStepAside]);

  /** Rest the stack at its foot: the best match by the box. */
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
  useLayoutEffect(toFoot, [results, fit, toFoot]);

  // And as the room changes: a keyboard rising or changing height, the phone turned, larger
  // text. A stack the rasika has scrolled up stays where they left it.
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      measure();
      if (atFoot.current) toFoot();
    });
    for (const box of [stack.current, pinned.current, aside.current, list.current]) {
      if (box) observer.observe(box);
    }
    return () => observer.disconnect();
  }, [measure, toFoot]);

  const scrolled = (event: React.UIEvent<HTMLDivElement>) => {
    const box = event.currentTarget;
    if (event.target !== box) return;
    box.dataset.scrolled = String(box.scrollTop > 0);
    atFoot.current = box.scrollHeight - box.scrollTop - box.clientHeight < 2;
  };

  const drawn = [...results].reverse();
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
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
          // as wide as the rows' fill.
          fit === 'scroll' && cn('-mx-2 overflow-y-auto overscroll-contain px-2', FADE),
        )}
      >
        {/* The stack is bottom-aligned: with few results it shrinks and the pinned rows sit just
            above the box; with many, only the results scroll (design D7). */}
        <div aria-hidden className="min-h-0 flex-1" />
        <div
          ref={pinned}
          data-aside={fit === 'typed' ? 'away' : undefined}
          className="flex shrink-0 flex-col gap-1"
        >
          {note && <p className="px-1 py-2 text-sub text-muted-foreground">{note}</p>}
          {fixed && (
            // Stepped aside, the rows keep their size to be measured by, and take no room.
            <div className={cn(fit === 'typed' && 'invisible -mb-1 h-0 overflow-hidden')}>
              <div ref={aside} className="flex flex-col gap-1">
                {fixed}
              </div>
            </div>
          )}
          {typedRow}
          {drawn.length > 0 && <hr className="my-1 border-border" />}
        </div>
        <div
          ref={list}
          onScroll={scrolled}
          // As wide as the rows' fill, which would otherwise be clipped by the scrolling.
          className={cn(
            '-mx-2 flex flex-col px-2 pt-2 pb-2',
            fit === 'scroll'
              ? 'shrink-0'
              : cn('min-h-0 shrink overflow-y-auto overscroll-contain', FADE),
          )}
        >
          {drawn.length > 0 && (
            // Rows divided by the hairline, as every list is (DESIGN.md "Shapes").
            <ul aria-label={resultsLabel} className="flex flex-col [&>li+li]:hairline-t">
              {drawn.map((row, i) => (
                <li key={row.key}>
                  <button
                    type="button"
                    aria-label={row.label}
                    data-best={i === drawn.length - 1 ? '' : undefined}
                    onClick={row.onPick}
                    className={cn(
                      // The text sits on the gutter; the best match's fill reaches 8px past it.
                      '-mx-2 flex w-[calc(100%+16px)] flex-col items-stretch justify-center rounded-xl px-2 py-2 text-left',
                      // Two lines make a 64px row; one line, 48px.
                      row.line ? 'min-h-16' : 'min-h-12',
                      // The best match is the one filled row, the same in both themes and on a
                      // page or in a sheet: a fill means "this one is different".
                      i === drawn.length - 1 && 'bg-secondary',
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {row.title}
                      {/* A kind word, not a pill: a fill on every row would say nothing. */}
                      {row.badge && (
                        <span className="text-caption font-normal text-muted-foreground">
                          {row.badge}
                        </span>
                      )}
                    </span>
                    {row.line && <span className="text-sub text-muted-foreground">{row.line}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lastRow}
        </div>
      </div>
      <form
        role="search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.();
        }}
      >
        <IconSearch
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
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
          className="min-h-12 w-full rounded-xl bg-secondary py-2 pr-3 pl-10 text-body text-foreground placeholder:text-muted-foreground focus:shadow-[inset_0_0_0_2px_var(--ring)] focus-visible:outline-none"
        />
      </form>
    </div>
  );
}

/** A pinned row above the divider: "? Don't know", "Use what I typed: …", an "Add new" row. */
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
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      // A row like the results: a hairline above it, its text on the gutter.
      className="flex min-h-12 w-full items-center py-2 text-left text-body hairline-t"
    >
      {children}
    </button>
  );
}

/** A fully round chip (DESIGN.md "Shapes"), pressed when `pressed` is set. */
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
        'inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border px-4 py-2 text-sub',
        pressed && 'border-foreground bg-secondary font-semibold',
        className,
      )}
      {...props}
    />
  );
}
