// The one search pattern of the logging screens (DESIGN.md "Item editor", "Search box",
// "Search result", "Search states"): a box docked at the bottom, and above it, top to bottom, a
// note when there is one, the pinned rows, a divider, then the results from weakest to best, so
// the best match sits by the box. Only the results scroll. Screen readers read the same order,
// hear the list as "best match last", and hear the count once typing pauses.

import { IconSearch } from '@tabler/icons-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
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
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
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
      <div className="flex shrink-0 flex-col gap-1">
        {note && <p className="px-1 py-2 text-sub text-muted-foreground">{note}</p>}
        {fixed}
        {drawn.length > 0 && <hr className="my-1 border-border" />}
      </div>
      <div
        ref={list}
        className="flex min-h-0 shrink flex-col overflow-y-auto overscroll-contain pb-2"
      >
        {drawn.length > 0 && (
          <ul aria-label={resultsLabel} className="flex flex-col gap-1">
            {drawn.map((row, i) => (
              <li key={row.key}>
                <button
                  type="button"
                  aria-label={row.label}
                  onClick={row.onPick}
                  className={cn(
                    'flex min-h-[60px] w-full flex-col items-stretch justify-center rounded-xl px-3 py-2 text-left',
                    // The best match sits on surface; in light, its border does that job.
                    i === drawn.length - 1 &&
                      'border border-border bg-card dark:border-transparent',
                  )}
                >
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {row.title}
                    {row.badge && <Badge variant="secondary">{row.badge}</Badge>}
                  </span>
                  {row.line && <span className="text-sub text-muted-foreground">{row.line}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {lastRow}
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
      className="flex min-h-12 w-full items-center rounded-xl px-3 py-2 text-left text-body"
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
        'inline-flex min-h-12 items-center rounded-full border border-border px-4 py-2 text-sub',
        pressed && 'border-foreground bg-secondary font-semibold',
        className,
      )}
      {...props}
    />
  );
}
