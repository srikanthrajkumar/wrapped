// The list row's kinds (docs/design/row.md; DESIGN.md "The row", 2026-11-16), beside the Concert
// row (ConcertRow.tsx) and the Event's Item row:
// - a List row names anything else, whatever a tap does (Stage, Settings, both search lists): an
//   optional 20px mark in a 24px box, then 8px, its title in `body`, an optional `sub` line of its
//   own facts, and at most one trailing thing (a value, a kind word and a check, a chevron when it
//   opens a page) or one nested 48px control;
// - an Action row is a one-line reply to its group's question ("None of these", "? Don't know"),
//   in `body` 600.
// Each is one target, at least 48px, 12px above and below its text, its focus ring inside it;
// its hairline is drawn inside its foot (the panel takes the last one away).

import { IconCheck, IconChevronRight } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The shape every row's target takes: 12px above and below, at least 48px, ring inside. */
export const ROW_SHAPE =
  'row-hover flex min-h-12 w-full min-w-0 items-center gap-2 py-3 text-left focus-visible:-outline-offset-2';

/**
 * A List row's text and its trailing slot, for the target that holds it (a button, a link).
 * `mark` is the 20px leading mark; within a panel every row has one or none does.
 */
export function ListRowBody({
  mark,
  title,
  line,
  value,
  kindWord,
  checked,
  chevron = false,
  warn = false,
}: {
  mark?: ReactNode;
  title: ReactNode;
  /** One `sub` line of the row's own facts. */
  line?: ReactNode;
  /** A value at the right, in `sub` ("Last: 2 Nov"). */
  value?: ReactNode;
  /** A kind word at the right, in `caption` ("Raga"), before a check when both show. */
  kindWord?: ReactNode;
  /** Picked: a check at the right. `false` keeps the check's room, unpicked. */
  checked?: boolean;
  /** Only where the tap opens a page. */
  chevron?: boolean;
  /** Something to fix: the mark and title turn amber. */
  warn?: boolean;
}) {
  return (
    <>
      {mark !== undefined && (
        <span
          className={cn(
            'flex w-6 shrink-0 items-center justify-center self-start pt-0.5 [&_svg]:size-5',
            warn && 'text-warning',
          )}
        >
          {mark}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('break-words', warn ? 'text-warning' : 'text-foreground')}>
          {title}
        </span>
        {line && <span className="text-sub text-muted-foreground">{line}</span>}
      </span>
      {value !== undefined && value !== null && (
        <span className="shrink-0 text-sub text-muted-foreground">{value}</span>
      )}
      {/* On the title's first line, however many lines it wraps to: each in a box one body
          line tall. */}
      {kindWord && (
        <span className="flex h-lh shrink-0 items-center self-start">
          <span className="text-caption text-muted-foreground">{kindWord}</span>
        </span>
      )}
      {checked !== undefined && (
        <span className="flex h-lh shrink-0 items-center self-start">
          <IconCheck
            aria-hidden
            className={cn('size-5', checked ? 'text-foreground' : 'invisible')}
          />
        </span>
      )}
      {chevron && (
        // Its ink ends on the column.
        <IconChevronRight aria-hidden className="-mr-2 size-5 shrink-0 text-muted-foreground" />
      )}
    </>
  );
}

/** An Action row: a one-line reply to its group's question, its words carrying any sign. */
export function ActionRow({
  children,
  onClick,
  label,
  className,
}: {
  children: ReactNode;
  onClick(): void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-row="action"
      className={cn(ROW_SHAPE, 'font-semibold break-words text-foreground', className)}
    >
      {children}
    </button>
  );
}
