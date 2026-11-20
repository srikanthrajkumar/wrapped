// A Detail's value as the Item editor shows it (DESIGN.md "Values"): its text with its state, a
// tap target underlined as every value is, the muted "+" that adds one, the notes under it, and
// the line a sheet uses to pick one of several values (a part's Ragas, the Layavinyasam's
// nadais) with "← Earlier", "Later →" and "Remove" under it (docs/design/item-editor.md §3-§5).

import { IconArrowLeft, IconArrowRight, IconPlus } from '@tabler/icons-react';
import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';
import type { DetailValue } from '../../model';
import { detailText } from '../format';

/** A value with its state (DESIGN.md "Detail values and their six states"). */
export function ValueText({ value, text }: { value: DetailValue; text?: string }) {
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
export function ValueNotes({ value, suggested }: { value: DetailValue; suggested?: DetailValue }) {
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
export function ValueButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'min-h-12 min-w-12 rounded-xl text-left underline decoration-border underline-offset-4 focus-visible:-outline-offset-2',
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
export function AddButton({
  label,
  onClick,
  text = false,
  ref,
  className,
}: {
  label: string;
  onClick(): void;
  text?: boolean;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={text ? undefined : label}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-12 items-center gap-1 rounded-xl text-sub text-muted-foreground focus-visible:-outline-offset-2',
        text ? 'px-2' : 'min-w-12 justify-center',
        className,
      )}
    >
      <IconPlus aria-hidden className="size-5" />
      {text && label}
    </button>
  );
}

/**
 * Several values in a line in a sheet, each a 48px target, the comma in the gap between them:
 * the selected one in 600 with an ink underline, the others in ink with the faint value
 * underline, never muted, so they read as tappable (docs/design/item-editor.md §4, §5).
 */
export function PickLine({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: { key: string; text: ReactNode; spoken: string }[];
  /** The selected one's place; null while a new one is being added. */
  selected: number | null;
  onSelect(index: number): void;
}) {
  return (
    <div role="list" aria-label={label} className="flex flex-wrap items-center">
      {items.map((item, index) => (
        <span role="listitem" key={item.key} className="flex items-center">
          <button
            type="button"
            aria-label={item.spoken}
            aria-current={index === selected ? 'true' : undefined}
            onClick={() => onSelect(index)}
            className={cn(
              'min-h-12 rounded-xl text-left text-foreground underline underline-offset-4 focus-visible:-outline-offset-2',
              index === selected ? 'font-semibold decoration-foreground' : 'decoration-border',
            )}
          >
            {item.text}
          </button>
          {index < items.length - 1 && (
            <span aria-hidden className="mr-2 text-foreground">
              ,
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * "← Earlier", "Later →" and "Remove" on one line, for one of several values (decision 2).
 * Earlier and Later keep fixed places, each a whole 48px target, one dimmed and aria-disabled at
 * either end, never removed, so the next tap never lands on the wrong control; they show only
 * with two or more. "Remove" stands at the right, 24px clear of Later, and drops to its own line
 * at the right when the text is large.
 */
export function MoveLine({
  index,
  count,
  name,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  /** What moves, for screen readers: "Kanada". */
  name: string;
  onMove(by: -1 | 1): void;
  onRemove(): void;
}) {
  // Quiet, as the signed-off sheets draw them: sub, muted, an arrow beside each word.
  const quiet =
    'inline-flex min-h-12 items-center gap-1 rounded-xl px-2 text-sub text-muted-foreground focus-visible:-outline-offset-2';
  const move = (by: -1 | 1, disabled: boolean) => (
    <button
      type="button"
      aria-disabled={disabled}
      aria-label={`Move ${name} ${by < 0 ? 'earlier' : 'later'}`}
      onClick={() => !disabled && onMove(by)}
      className={cn(quiet, 'min-w-28', disabled && 'opacity-40')}
    >
      {by < 0 && <IconArrowLeft aria-hidden className="size-5" />}
      {by < 0 ? 'Earlier' : 'Later'}
      {by > 0 && <IconArrowRight aria-hidden className="size-5" />}
    </button>
  );
  return (
    <div className="-mx-2 flex flex-wrap items-center gap-x-6">
      {count >= 2 && (
        <span className="flex">
          {move(-1, index === 0)}
          {move(1, index === count - 1)}
        </span>
      )}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className={cn(quiet, 'ml-auto')}
      >
        Remove
      </button>
    </div>
  );
}

/** A quiet "+ Another Raga" in a sheet: a plus, then the words, muted. */
export function AnotherButton({ children, onClick }: { children: ReactNode; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 inline-flex min-h-12 items-center gap-1 self-start rounded-xl px-2 text-sub text-muted-foreground focus-visible:-outline-offset-2"
    >
      <IconPlus aria-hidden className="size-5" />
      {children}
    </button>
  );
}
