// The one search pattern of the logging screens (DESIGN.md "Item editor", "Search box",
// "Search result", "Search states"): a box docked at the bottom, and above it, top to bottom, a
// note when there is one, the pinned rows, a divider, then the results from weakest to best, so
// the best match sits by the box. Only the results scroll. Screen readers read the same order,
// hear the list as "best match last", and hear the count once typing pauses.

import { IconSearch } from '@tabler/icons-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MESSAGES } from '../messages';
import { ActionRow, ListRowBody, ROW_SHAPE } from './rows';

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

export function DockedSearch({
  label,
  placeholder,
  query,
  onQueryChange,
  autoFocus = false,
  note,
  fixed,
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
  fixed?: ReactNode;
  /** Best first; drawn weakest to best. */
  results: SearchRow[];
  resultsLabel?: string;
  onSubmit?(): void;
  /** Always the last row, under the best match: "Add “…” as a new Sabha". */
  lastRow?: ReactNode;
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [announced, setAnnounced] = useState('');
  const typed = query.trim() !== '';

  useEffect(() => {
    if (!typed) return;
    const timer = setTimeout(
      () => setAnnounced(MESSAGES.search.results(results.length)),
      ANNOUNCE_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [typed, query, results.length]);

  // Keep the best match, by the box, in view as the results change.
  useLayoutEffect(() => {
    const box = list.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
    box.dataset.scrolled = String(box.scrollTop > 0);
  }, [results]);

  const drawn = [...results].reverse();
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div aria-live="polite" className="sr-only">
        {typed ? announced : ''}
      </div>
      {/* The stack is bottom-aligned: with few results it shrinks and the pinned rows sit just
          above the box; with many, only the results scroll (design D7). */}
      <div aria-hidden className="min-h-0 flex-1" />
      {/* The pinned rows touch, each 48px between its hairlines (the row spec, 2026-11-16). */}
      <div className="flex shrink-0 flex-col">
        {note && <p className="px-1 py-2 text-sub text-muted-foreground">{note}</p>}
        {fixed}
        {drawn.length > 0 && <hr className="my-1 border-border" />}
      </div>
      <div
        ref={list}
        // As wide as the rows' fill, which would otherwise be clipped by the scrolling. Once rows
        // are scrolled up under the fixed rows, they are gone in the first 12px and fade in over
        // the next 20, so a row half under them shows no second rule. Unscrolled, nothing fades.
        onScroll={(event) => {
          const box = event.currentTarget;
          box.dataset.scrolled = String(box.scrollTop > 0);
        }}
        className="-mx-2 flex min-h-0 shrink flex-col overflow-y-auto overscroll-contain px-2 pt-2 pb-2 data-[scrolled=true]:[mask-image:linear-gradient(to_bottom,transparent_12px,black_32px)]"
      >
        {drawn.length > 0 && (
          // Rows divided by the hairline, as every list is (DESIGN.md "Shapes").
          <ul aria-label={resultsLabel} className="flex flex-col [&>li+li]:hairline-t">
            {drawn.map((row, i) => (
              <li key={row.key}>
                <button
                  type="button"
                  aria-label={row.label}
                  onClick={row.onPick}
                  className={cn(
                    // A List row (the row spec, 2026-11-16): 12px above and below, so 68px with
                    // two lines and 48px with one. The text sits on the column; the best
                    // match's fill reaches 8px past it.
                    ROW_SHAPE,
                    '-mx-2 w-[calc(100%+16px)] rounded-xl px-2',
                    // The best match is the one filled row, the same in both themes and on a
                    // page or in a sheet: a fill means "this one is different".
                    i === drawn.length - 1 && 'bg-secondary',
                  )}
                >
                  {/* Its title in body 400; a kind word, not a pill, in the trailing slot. */}
                  <ListRowBody title={row.title} line={row.line} kindWord={row.badge} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {lastRow}
      </div>
      {/* The field on the 8px edge with 16px corners (foundations, 2026-11-16). */}
      <form
        role="search"
        className="relative fill-edge"
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
          className="min-h-12 w-full rounded-fill bg-secondary py-2 pr-4 pl-11 text-body text-foreground placeholder:text-muted-foreground focus:shadow-[inset_0_0_0_2px_var(--ring)] focus-visible:outline-none"
        />
      </form>
    </div>
  );
}

/**
 * A pinned row above the divider: "? Don't know", "Use what I typed: …", an "Add new" row. An
 * Action row (the row spec, 2026-11-16), with a hairline above it, its text on the column.
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
    <ActionRow label={label} onClick={onClick} className="hairline-t">
      {children}
    </ActionRow>
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
